// server.js — Ordinals-only backend (ESM)
// Start with: node server.js
// Requires: "type": "module" in package.json

import 'dotenv/config'; // Load environment variables from .env
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import * as bitcoin from 'bitcoinjs-lib';
import {
  calculateServiceFee,
  usdToSats,
  satsToUSD,
  createOrdinalPurchasePSBT,
  createBatchedOrdinalPurchasePSBT,
  broadcastPSBT,
} from './psbt-utils.js';

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

// Per-address rate limiting for transactions (prevent rapid-fire attacks)
const transactionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 10, // Max 10 transactions per address per hour
  message: 'Too many transactions from this address. Please wait before trying again.',
  keyGenerator: (req) => {
    // Use seller address as the key for rate limiting
    return req.body.sellerAddress || req.ip;
  },
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
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

    // Debug logging
    if (lastPurchase) {
      console.log(`📊 Activity for ${id.slice(0, 12)}...: ${activities.length} activities, lastPurchase FOUND`);
      console.log(`   → Raw price data: listedPrice=${lastPurchase.listedPrice}, price=${lastPurchase.price}, priceSymbol=${lastPurchase.priceSymbol}`);
    } else {
      console.log(`📊 Activity for ${id.slice(0, 12)}...: ${activities.length} activities, lastPurchase=none`);
    }

    // Convert satoshis to BTC (Magic Eden returns prices in sats)
    const priceSats = lastPurchase?.listedPrice || lastPurchase?.price || null;
    const priceBTC = priceSats !== null ? priceSats / 100000000 : null;

    const result = {
      id,
      activities: activities.slice(0, 10), // Return last 10 activities
      lastPurchasePrice: priceBTC,
      lastPurchaseDate: lastPurchase?.createdAt || null,
    };

    // Cache for 24 hours (prices don't change much in dead market)
    cache.set(cacheKey, result, 86400);

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

    // Debug logging
    if (!token) {
      console.log(`⚠️  No token data found for ${id.slice(0, 12)}... on Magic Eden`);
    } else {
      console.log(`✅ Found token data for ${id.slice(0, 12)}...: listed=${token.listedPrice}, floor=${token.collection?.floorPrice}`);
    }

    // Convert satoshis to BTC (Magic Eden returns prices in sats)
    const listedPriceSats = token?.listedPrice || null;
    const floorPriceSats = token?.collection?.floorPrice || null;
    const listedPriceBTC = listedPriceSats !== null ? listedPriceSats / 100000000 : null;
    const floorPriceBTC = floorPriceSats !== null ? floorPriceSats / 100000000 : null;

    const result = {
      id,
      currentPrice: listedPriceBTC,
      floorPrice: floorPriceBTC,
      collectionId: token?.collection?.id || null,
      collectionSymbol: token?.collection?.symbol || null,
      collectionName: token?.collection?.name || null,
      isListed: listedPriceSats !== null && listedPriceSats !== undefined,
    };

    // Cache for 24 hours (prices don't change much in dead market)
    cache.set(cacheKey, result, 86400);

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
      collectionSymbol: null,
      collectionName: null,
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

/**
 * POST /api/create-psbt-offer
 * Creates a PSBT (Partially Signed Bitcoin Transaction) for buying an ordinal
 * Body: {
 *   inscriptionId,
 *   sellerAddress,
 *   sellerPaymentUTXOs,  // UTXOs seller will use to pay service fee
 *   purchasePriceSats,   // Original purchase price
 *   currentPriceSats,    // Current market price (optional)
 *   btcPriceUSD          // Current BTC/USD price
 * }
 */
app.post('/api/create-psbt-offer', transactionLimiter, async (req, res) => {
  const {
    inscriptionId,
    sellerAddress,
    sellerPaymentUTXOs = [],
    purchasePriceSats,
    currentPriceSats,
    btcPriceUSD,
    userTaxRate // User-provided tax rate (decimal, e.g., 0.30 for 30%)
  } = req.body;

  console.log('📝 Creating PSBT offer for:', {
    inscriptionId: inscriptionId?.slice(0, 20) + '...',
    sellerAddress: sellerAddress?.slice(0, 20) + '...',
    purchasePriceSats,
    currentPriceSats,
    btcPriceUSD
  });

  // Validation
  if (!inscriptionId || !sellerAddress || !purchasePriceSats || !btcPriceUSD) {
    return res.status(400).json({
      error: 'Missing required fields: inscriptionId, sellerAddress, purchasePriceSats, btcPriceUSD'
    });
  }

  // Validate Taproot address
  if (!TAPROOT_RE.test(sellerAddress)) {
    return res.status(400).json({
      error: 'Invalid seller address: must be a Taproot (bc1p...) address'
    });
  }

  try {
    // Get Harvy's wallet address from environment variable
    const harvyAddress = process.env.HARVY_WALLET_ADDRESS;
    if (!harvyAddress) {
      console.error('❌ HARVY_WALLET_ADDRESS not configured in environment');
      return res.status(500).json({
        error: 'Harvy wallet not configured. Please contact support.'
      });
    }

    // Input validation for financial calculations
    if (!purchasePriceSats || purchasePriceSats <= 0 || purchasePriceSats > 100000000) {
      return res.status(400).json({
        error: 'Invalid purchase price: must be between 1 and 100,000,000 sats (1 BTC max)'
      });
    }

    if (currentPriceSats < 0) {
      return res.status(400).json({
        error: 'Invalid current price: cannot be negative'
      });
    }

    if (!btcPriceUSD || btcPriceUSD <= 0 || btcPriceUSD > 10000000) {
      return res.status(400).json({
        error: 'Invalid BTC price: must be between $1 and $10,000,000'
      });
    }

    // Additional safety checks
    const MAX_LOSS_SATS = 100000000; // 1 BTC max loss
    const preliminaryLoss = purchasePriceSats - (currentPriceSats || 0);

    if (preliminaryLoss < 0) {
      return res.status(400).json({
        error: 'This ordinal has a gain, not a loss. Harvy only buys ordinals at a loss for tax harvesting.'
      });
    }

    if (preliminaryLoss > MAX_LOSS_SATS) {
      return res.status(400).json({
        error: 'Loss amount exceeds maximum allowed (1 BTC). Please contact support for large transactions.'
      });
    }

    // Calculate tax loss and savings
    const taxLossSats = preliminaryLoss;
    const taxLossUSD = satsToUSD(taxLossSats, btcPriceUSD);

    // Use user-provided tax rate if available, otherwise use default
    const taxRate = userTaxRate !== undefined && userTaxRate !== null
      ? parseFloat(userTaxRate)
      : parseFloat(process.env.ASSUMED_TAX_RATE || 0.30);

    // Validate tax rate is reasonable
    if (taxRate < 0 || taxRate > 1) {
      return res.status(400).json({
        error: 'Invalid tax rate: must be between 0% and 100% (0.00 to 1.00 as decimal)'
      });
    }

    const taxSavingsUSD = taxLossUSD * taxRate;

    console.log(`💰 Tax calculation: Loss=${taxLossSats} sats ($${taxLossUSD}), Savings=$${taxSavingsUSD} (${taxRate * 100}% rate)`);

    // Calculate service fee based on tiered structure
    const feeInfo = calculateServiceFee(taxSavingsUSD);
    const serviceFeeSats = usdToSats(feeInfo.feeUSD, btcPriceUSD);

    console.log(`💵 Service fee: Tier ${feeInfo.tier} (${feeInfo.feePercent}%) = ${serviceFeeSats} sats ($${feeInfo.feeUSD})`);

    // Service fee cap (security limit - caps actual cash changing hands)
    const maxServiceFeeUSD = parseFloat(process.env.MAX_SERVICE_FEE_USD || 100);
    if (feeInfo.feeUSD > maxServiceFeeUSD) {
      return res.status(400).json({
        error: `Service fee ($${feeInfo.feeUSD.toFixed(2)}) exceeds maximum allowed ($${maxServiceFeeUSD}). Please contact support for larger transactions.`,
        details: 'This limit is in place for security during testnet/early launch.'
      });
    }

    // Harvy's offer (dust limit minimum)
    const minSats = parseInt(process.env.MIN_ORDINAL_PAYMENT_SATS || 600, 10);
    const offerSats = minSats;

    console.log(`🤝 Harvy offers: ${offerSats} sats for the ordinal`);

    // SECURITY CHECK: Ensure we have the private key before proceeding
    if (!process.env.HARVY_WALLET_PRIVATE_KEY) {
      console.error('❌ HARVY_WALLET_PRIVATE_KEY not configured');
      return res.status(500).json({
        error: 'Harvy wallet not fully configured. Please contact support.',
        details: 'Private key missing'
      });
    }

    // Create the PSBT
    console.log('🔨 Building PSBT transaction...');
    const psbtResult = await createOrdinalPurchasePSBT({
      inscriptionId,
      sellerAddress,
      sellerPaymentUTXOs,
      purchasePriceSats,
      offerSats,
      serviceFeeSats,
      btcPriceUSD,
    });

    console.log('✅ PSBT created successfully');
    console.log(`   Harvy inputs: ${psbtResult.details.harvyInputCount}`);
    console.log(`   Seller inputs: ${psbtResult.details.sellerInputCount}`);

    // Return PSBT for seller to sign
    return res.json({
      success: true,
      psbtBase64: psbtResult.psbtBase64,
      psbtHex: psbtResult.psbtHex,
      transaction: {
        inscriptionId,
        offerSats,
        serviceFeeSats,
        taxCalculation: {
          purchasePriceSats,
          currentPriceSats: currentPriceSats || 0,
          taxLossSats,
          taxLossUSD,
          taxSavingsUSD,
          taxRate,
        },
        serviceFee: {
          tier: feeInfo.tier,
          percent: feeInfo.feePercent,
          usd: feeInfo.feeUSD,
          sats: serviceFeeSats,
        },
        sellerNetCash: offerSats - serviceFeeSats, // What seller gets in cash
        sellerNetBenefit: taxSavingsUSD - feeInfo.feeUSD, // Tax savings minus fee
      },
      details: psbtResult.details,
      instructions: [
        'Review the transaction details carefully',
        'You will receive ' + offerSats + ' sats for the ordinal',
        'Service fee: ' + serviceFeeSats + ' sats ($' + feeInfo.feeUSD.toFixed(2) + ')',
        'Net cash: ' + (offerSats - serviceFeeSats) + ' sats',
        'Tax savings: $' + taxSavingsUSD.toFixed(2),
        'Net benefit: $' + (taxSavingsUSD - feeInfo.feeUSD).toFixed(2),
        'Sign with your wallet to complete the transaction',
      ],
    });

  } catch (e) {
    console.error('❌ PSBT creation error:', e.message);
    console.error(e.stack);
    return res.status(500).json({
      error: 'Failed to create PSBT offer',
      details: e.message
    });
  }
});

/**
 * POST /api/create-batch-psbt
 * Creates a SINGLE PSBT for buying MULTIPLE ordinals in one transaction
 * More efficient: one signature, lower fees, atomic execution
 * Body: {
 *   ordinals: [{ inscriptionId, purchasePriceSats, currentPriceSats }, ...],
 *   sellerAddress,
 *   btcPriceUSD,
 *   userTaxRate
 * }
 */
app.post('/api/create-batch-psbt', transactionLimiter, async (req, res) => {
  const {
    ordinals,
    sellerAddress,
    btcPriceUSD,
    userTaxRate
  } = req.body;

  console.log('📝 Creating BATCHED PSBT for:', {
    ordinalCount: ordinals?.length,
    sellerAddress: sellerAddress?.slice(0, 20) + '...',
    btcPriceUSD
  });

  // Validation
  if (!ordinals || !Array.isArray(ordinals) || ordinals.length === 0) {
    return res.status(400).json({
      error: 'Missing or invalid ordinals array'
    });
  }

  if (ordinals.length > 20) {
    return res.status(400).json({
      error: 'Maximum 20 ordinals per batch transaction'
    });
  }

  if (!sellerAddress || !btcPriceUSD) {
    return res.status(400).json({
      error: 'Missing required fields: sellerAddress, btcPriceUSD'
    });
  }

  if (!TAPROOT_RE.test(sellerAddress)) {
    return res.status(400).json({
      error: 'Invalid seller address: must be a Taproot (bc1p...) address'
    });
  }

  try {
    const harvyAddress = process.env.HARVY_WALLET_ADDRESS;
    if (!harvyAddress || !process.env.HARVY_WALLET_PRIVATE_KEY) {
      return res.status(500).json({
        error: 'Harvy wallet not configured. Please contact support.'
      });
    }

    // Validate each ordinal and calculate totals
    let totalPurchaseSats = 0;
    let totalCurrentSats = 0;

    for (const ord of ordinals) {
      if (!ord.inscriptionId || !ord.purchasePriceSats) {
        return res.status(400).json({
          error: `Missing inscriptionId or purchasePriceSats for ordinal`
        });
      }
      if (ord.purchasePriceSats <= 0 || ord.purchasePriceSats > 100000000) {
        return res.status(400).json({
          error: 'Invalid purchase price: must be between 1 and 100,000,000 sats'
        });
      }
      totalPurchaseSats += ord.purchasePriceSats;
      totalCurrentSats += ord.currentPriceSats || 0;
    }

    // Calculate total tax loss
    const totalLossSats = totalPurchaseSats - totalCurrentSats;
    if (totalLossSats <= 0) {
      return res.status(400).json({
        error: 'No tax loss to harvest. Total current value exceeds purchase cost.'
      });
    }

    const totalLossUSD = satsToUSD(totalLossSats, btcPriceUSD);
    const taxRate = userTaxRate !== undefined ? parseFloat(userTaxRate) : 0.30;
    const taxSavingsUSD = totalLossUSD * taxRate;

    // Calculate service fee on total
    const feeInfo = calculateServiceFee(taxSavingsUSD);
    const serviceFeeSats = usdToSats(feeInfo.feeUSD, btcPriceUSD);

    // Payment: 600 sats per ordinal
    const minSatsPerOrdinal = parseInt(process.env.MIN_ORDINAL_PAYMENT_SATS || 600, 10);
    const totalOfferSats = minSatsPerOrdinal * ordinals.length;

    console.log(`💰 Batch: ${ordinals.length} ordinals, Loss=$${totalLossUSD}, Savings=$${taxSavingsUSD}, Fee=$${feeInfo.feeUSD}`);

    // Create batched PSBT
    const psbtResult = await createBatchedOrdinalPurchasePSBT({
      ordinals,
      sellerAddress,
      totalOfferSats,
      totalServiceFeeSats: serviceFeeSats,
      btcPriceUSD,
    });

    console.log('✅ Batched PSBT created successfully');

    return res.json({
      success: true,
      psbtBase64: psbtResult.psbtBase64,
      psbtHex: psbtResult.psbtHex,
      transaction: {
        ordinalCount: ordinals.length,
        totalOfferSats,
        totalServiceFeeSats: serviceFeeSats,
        taxCalculation: {
          totalPurchaseSats,
          totalCurrentSats,
          totalLossSats,
          totalLossUSD,
          taxSavingsUSD,
          taxRate,
        },
        serviceFee: {
          tier: feeInfo.tier,
          percent: feeInfo.feePercent,
          usd: feeInfo.feeUSD,
          sats: serviceFeeSats,
        },
        sellerNetBenefit: taxSavingsUSD - feeInfo.feeUSD,
      },
      details: psbtResult.details,
    });

  } catch (e) {
    console.error('❌ Batch PSBT creation error:', e.message);
    return res.status(500).json({
      error: 'Failed to create batch PSBT',
      details: e.message
    });
  }
});

/**
 * POST /api/finalize-psbt
 * Finalizes and broadcasts a fully-signed PSBT
 * SECURITY: This should only be called after manual review in production
 * Body: { psbtBase64 }
 */
app.post('/api/finalize-psbt', transactionLimiter, async (req, res) => {
  const { psbtBase64 } = req.body;

  console.log('📡 Finalizing and broadcasting PSBT...');

  if (!psbtBase64) {
    return res.status(400).json({
      error: 'Missing required field: psbtBase64'
    });
  }

  try {
    // TODO: CRITICAL SECURITY - PROFESSIONAL AUDIT REQUIRED BEFORE MAINNET
    // This endpoint broadcasts transactions with ZERO validation!
    // Required before mainnet:
    // 1. Parse and validate the PSBT structure
    // 2. Verify all expected outputs are present and correct
    // 3. Verify no unexpected outputs exist
    // 4. Check that Harvy's wallet won't lose more than expected
    // 5. Implement transaction amount limits (e.g., max $1000/tx)
    // 6. Add manual approval queue for large transactions
    // 7. Rate limiting per user address (prevent rapid-fire attacks)
    // WITHOUT THESE CHECKS, THIS IS A CRITICAL VULNERABILITY
    // Estimated risk: CRITICAL - could drain entire wallet in seconds

    const txid = await broadcastPSBT(psbtBase64);

    console.log(`✅ Transaction broadcast successfully: ${txid}`);

    return res.json({
      success: true,
      txid,
      message: 'Transaction broadcast to the Bitcoin network',
      explorerUrl: process.env.BITCOIN_NETWORK === 'mainnet'
        ? `https://mempool.space/tx/${txid}`
        : `https://mempool.space/testnet/tx/${txid}`
    });

  } catch (e) {
    console.error('❌ Broadcast error:', e.message);
    return res.status(500).json({
      error: 'Failed to broadcast transaction',
      details: e.message
    });
  }
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
