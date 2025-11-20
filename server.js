// server.js — Ordinals-only backend (ESM)
// Start with: node server.js
// Requires: "type": "module" in package.json

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3001;
const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.hiro.so", "https://ordinals.com", "https://blockchain.info", "https://api-mainnet.magiceden.dev"],
      objectSrc: ["'self'", "data:", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding ordinal content
}));

// CORS configuration - restrict to specific origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // SECURITY: Only allow explicitly listed origins (no bypass)
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' })); // Limit payload size

// Rate limiting - prevent abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Limit to 20 requests per minute for intensive operations
  message: 'Too many requests, please slow down.',
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// In-memory cache for API responses
const cache = new NodeCache({
  stdTTL: 600, // Default TTL: 10 minutes
  checkperiod: 120, // Check for expired keys every 2 minutes
  useClones: false, // Don't clone data (better performance)
});

// Clear cache on startup to ensure fresh data
cache.flushAll();
console.log('🗑️  Cache cleared on startup');

/* ------------------------------ Utilities ------------------------------ */

// Taproot addresses: bc1p + bech32 characters, typically 62 but can vary (62-90 chars total)
const TAPROOT_RE = /^bc1p[0-9a-z]{58,86}$/i;

async function tryFetch(url, opts = {}) {
  const r = await fetch(url, opts);
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    const err = new Error(`HTTP ${r.status} ${r.statusText} @ ${url} :: ${text.slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  return r;
}

/* -------------------------------- Routes -------------------------------- */

app.get('/test', (_req, res) => {
  res.json({ ok: true, message: 'Server is running!' });
});

/**
 * GET /api/ordinals?address=<bc1p...>&offset=0&excludeBrc20=true
 * Lists inscriptions owned by a Taproot address (via Hiro).
 * Uses in-memory caching to reduce API calls.
 */
app.get('/api/ordinals', strictLimiter, async (req, res) => {
  const address = (req.query.address || '').trim();
  const offset = parseInt(req.query.offset || '0', 10);
  const excludeBrc20 = req.query.excludeBrc20 === 'true';

  console.log('GET /api/ordinals address =', address || '(none)', 'offset =', offset, 'excludeBrc20 =', excludeBrc20);

  if (!address) {
    return res.status(400).json({
      error: 'address is required (Taproot owner address starting with bc1p...)',
    });
  }
  if (!TAPROOT_RE.test(address)) {
    return res.status(400).json({
      error: 'invalid address: must be a Taproot (bc1p...) owner address',
    });
  }

  // Cache key includes offset and filter settings
  const cacheKey = `ordinals:${address}:${offset}:${excludeBrc20}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`Cache HIT for ${address} (offset: ${offset})`);
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, max-age=600');
    return res.json(cached);
  }

  try {
    const r = await tryFetch(
      `https://api.hiro.so/ordinals/v1/inscriptions?address=${encodeURIComponent(address)}&limit=60&offset=${offset}`,
      { headers: { Accept: 'application/json' } },
    );
    const json = await r.json();

    let results = json.results || [];

    // Optionally filter out BRC-20 tokens (text/plain) to show only actual ordinals (images, etc.)
    if (excludeBrc20) {
      results = results.filter((it) => {
        const contentType = it.content_type || '';
        // Keep non-text items (images, videos, etc.) and exclude text-based BRC-20 tokens
        return !contentType.startsWith('text/plain');
      });
      console.log(`Filtered ${json.results.length} inscriptions to ${results.length} (excluded ${json.results.length - results.length} BRC-20 tokens)`);
    }

    const items = results.map((it) => ({
      id: it.id,
      number: it.number,
      content_type: it.content_type || null,
      content_uri: `/api/ordinal-bytes/${it.id}`,
      preview_uri: `/api/ordinal-bytes/${it.id}`,
    }));

    const response = {
      items,
      total: json.total,
      limit: json.limit,
      offset: json.offset,
    };

    // Store in cache
    cache.set(cacheKey, response, 600); // 10 minutes TTL
    console.log(`Cache MISS for ${address} (offset: ${offset}), stored ${items.length} items`);

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=600');
    return res.json(response);
  } catch (e) {
    console.error('List error:', e.message);
    const statusCode = e.status || 502;
    let errorMessage = 'Failed to fetch ordinals';

    // Provide more specific error messages based on status code
    if (statusCode === 404) {
      errorMessage = 'Address not found. This address may not have any inscriptions.';
    } else if (statusCode === 429) {
      errorMessage = 'Rate limit exceeded. Please try again in a moment.';
    } else if (statusCode === 503 || statusCode === 502) {
      errorMessage = 'Ordinals API is temporarily unavailable. Please try again later.';
    } else if (statusCode >= 500) {
      errorMessage = 'Server error occurred while fetching ordinals.';
    } else if (statusCode === 400) {
      errorMessage = 'Invalid address format. Please check the address and try again.';
    }

    return res.status(statusCode).json({
      error: errorMessage,
      details: e.message
    });
  }
});

/**
 * GET /api/ordinal-meta/:id
 * Returns { id, number, content_type }.
 * Uses Hiro; if missing content_type, probes content endpoints with HEAD.
 * Cached for 24 hours since metadata rarely changes.
 */
app.get('/api/ordinal-meta/:id', async (req, res) => {
  const { id } = req.params;

  // Check cache first
  const cacheKey = `meta:${id}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.json(cached);
  }

  try {
    // 1) Try Hiro JSON
    let number = null;
    let contentType = null;

    try {
      const r = await fetch(`https://api.hiro.so/ordinals/v1/inscriptions/${id}`, {
        headers: { Accept: 'application/json' },
      });
      if (r.ok) {
        const j = await r.json();
        number = j.number ?? null;
        contentType = j.content_type || null;
      }
    } catch {}

    // 2) If unknown, probe candidates with HEAD to infer type
    if (!contentType) {
      const candidates = [
        `https://api.hiro.so/ordinals/v1/inscriptions/${id}/content`,
        `https://ordinals.com/content/${id}`,
      ];
      for (const url of candidates) {
        try {
          const head = await fetch(url, { method: 'HEAD' });
          if (head.ok) {
            const t = head.headers.get('content-type');
            if (t) { contentType = t; break; }
          }
        } catch {}
      }
    }

    const result = {
      id,
      number,
      content_type: contentType || 'application/octet-stream',
    };

    // Cache for 24 hours (metadata is immutable)
    cache.set(cacheKey, result, 86400);

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.json(result);
  } catch (e) {
    console.error('Meta error:', e.message);
    return res.status(502).json({ error: 'Failed to fetch metadata' });
  }
});

/**
 * GET /api/ordinal-activity/:id
 * Fetches transaction/activity history for a specific inscription from Magic Eden.
 * Returns purchase price, sale history, etc.
 */
app.get('/api/ordinal-activity/:id', async (req, res) => {
  const { id } = req.params;

  // Check cache first (cache for 5 minutes since activity changes)
  const cacheKey = `activity:${id}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json(cached);
  }

  try {
    // Prepare headers with API key if available
    const headers = { Accept: 'application/json' };
    if (process.env.MAGICEDEN_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.MAGICEDEN_API_KEY}`;
    }

    // Magic Eden requires 'kind' parameter - fetch relevant activity types
    // We need: sale (actual sales), buying_broadcasted (purchases), list (listings)
    const activityKinds = ['sale', 'buying_broadcasted', 'list'];
    const allActivities = [];

    for (const kind of activityKinds) {
      try {
        const r = await fetch(
          `https://api-mainnet.magiceden.dev/v2/ord/btc/activities?tokenId=${encodeURIComponent(id)}&kind=${kind}`,
          { headers }
        );

        if (r.ok) {
          const json = await r.json();
          if (json.activities) {
            allActivities.push(...json.activities);
          }
        }
      } catch (err) {
        // Continue fetching other kinds even if one fails
        console.error(`Failed to fetch ${kind} activities for ${id}:`, err.message);
      }
    }

    // Sort activities by date (newest first)
    const activities = allActivities.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });

    // Find the most recent "buy" or "sale" to get purchase price
    const lastPurchase = activities.find(a =>
      a.kind === 'buying_broadcasted' ||
      a.kind === 'sale' ||
      a.kind === 'list_sale'
    );

    const result = {
      id,
      activities: activities.slice(0, 10), // Return last 10 activities
      lastPurchasePrice: lastPurchase?.listedPrice || lastPurchase?.price || null,
      lastPurchaseDate: lastPurchase?.createdAt || null,
    };

    // Cache for 5 minutes
    cache.set(cacheKey, result, 300);

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json(result);
  } catch (e) {
    console.error(`Activity fetch error for ${id}:`, e.message);

    // Return empty result on error (graceful degradation)
    const emptyResult = {
      id,
      activities: [],
      lastPurchasePrice: null,
      lastPurchaseDate: null,
      error: 'Could not fetch activity data'
    };

    return res.status(200).json(emptyResult);
  }
});

/**
 * GET /api/ordinal-value/:id
 * Fetches current listing price and market data for a specific inscription from Magic Eden.
 * Used to calculate current value vs purchase price for tax harvesting.
 */
app.get('/api/ordinal-value/:id', async (req, res) => {
  const { id } = req.params;

  // Check cache first (cache for 5 minutes since prices change)
  const cacheKey = `value:${id}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json(cached);
  }

  try {
    // Prepare headers with API key if available
    const headers = { Accept: 'application/json' };
    if (process.env.MAGICEDEN_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.MAGICEDEN_API_KEY}`;
    }

    // Note: Magic Eden API uses 'tokenIds' (plural) not 'tokenId' (singular)
    const r = await fetch(
      `https://api-mainnet.magiceden.dev/v2/ord/btc/tokens?tokenIds=${encodeURIComponent(id)}`,
      { headers }
    );

    if (!r.ok) {
      throw new Error(`Magic Eden API returned ${r.status}`);
    }

    const json = await r.json();
    const tokens = json.tokens || [];
    const token = tokens[0]; // Get first token (should only be one for a specific ID)

    const result = {
      id,
      currentPrice: token?.listedPrice || null,
      floorPrice: token?.collection?.floorPrice || null,
      collectionId: token?.collection?.id || null,
      isListed: token?.listedPrice !== null && token?.listedPrice !== undefined,
    };

    // Cache for 5 minutes
    cache.set(cacheKey, result, 300);

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json(result);
  } catch (e) {
    console.error(`Value fetch error for ${id}:`, e.message);

    // Return empty result on error (graceful degradation)
    const emptyResult = {
      id,
      currentPrice: null,
      floorPrice: null,
      collectionId: null,
      isListed: false,
      error: 'Could not fetch value data'
    };

    return res.status(200).json(emptyResult);
  }
});

/**
 * GET /api/ordinal-bytes/:id
 * Streams raw content. Tries Hiro, then ordinals.com as a fallback.
 * Includes retry logic with exponential backoff for transient failures.
 */
app.get('/api/ordinal-bytes/:id', async (req, res) => {
  const { id } = req.params;
  // Try ordinals.com first - Hiro API has aggressive rate limiting
  const candidates = [
    `https://ordinals.com/content/${id}`,
    `https://api.hiro.so/ordinals/v1/inscriptions/${id}/content`,
  ];

  const maxRetries = 2;
  const timeout = 15000; // 15 seconds per attempt

  async function fetchWithRetry(url, retries = 0) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const upstream = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 Harvy/1.0',
          Accept: '*/*',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!upstream.ok) {
        // Retry on 5xx errors or 429 (rate limit)
        if (retries < maxRetries && (upstream.status >= 500 || upstream.status === 429)) {
          const delay = Math.min(1000 * Math.pow(2, retries), 5000); // Exponential backoff, max 5s
          console.log(`Retrying ${url} after ${delay}ms (attempt ${retries + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchWithRetry(url, retries + 1);
        }
        return null;
      }

      return upstream;
    } catch (err) {
      // Retry on timeout or network errors
      if (retries < maxRetries && (err.name === 'AbortError' || err.code === 'ECONNRESET')) {
        const delay = Math.min(1000 * Math.pow(2, retries), 5000);
        console.log(`Retrying ${url} after ${delay}ms due to ${err.name} (attempt ${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, retries + 1);
      }
      return null;
    }
  }

  // Try each candidate source with retry logic
  for (const url of candidates) {
    const upstream = await fetchWithRetry(url);
    if (upstream) {
      const type = upstream.headers.get('content-type') || 'application/octet-stream';
      res.setHeader('Content-Type', type);
      res.setHeader('Cache-Control', 'public, max-age=86400');

      // Handle stream errors gracefully
      upstream.body.pipe(res).on('error', (err) => {
        console.error('Stream error:', err.message);
        if (!res.headersSent) {
          res.status(502).send('Stream error');
        }
      });
      return;
    }
  }

  console.error(`Failed to fetch content for ${id} from all sources`);
  return res.status(502).send('Failed to fetch content from all upstream sources');
});

/* ------------------------ Serve frontend in prod ------------------------ */

const frontendBuild = path.join(__dirname, 'frontend', 'build');
app.use(express.static(frontendBuild));
app.get('*', (_req, res) => {
  try {
    res.sendFile(path.join(frontendBuild, 'index.html'));
  } catch {
    res.status(200).send('Backend running');
  }
});

/* --------------------------------- Boot --------------------------------- */

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
