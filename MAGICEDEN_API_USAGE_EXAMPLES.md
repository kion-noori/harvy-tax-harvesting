# Magic Eden API Usage in Harvy

## Overview
Harvy uses the Magic Eden API to fetch purchase history and current pricing data for Bitcoin Ordinals, enabling users to identify tax harvesting opportunities.

---

## Current Implementation

### 1. Fetching Purchase History (`/tokens/:token_mint/activities`)

**Backend Endpoint**: `GET /api/ordinal-activity/:id`

```javascript
// server.js (lines 281-340)
app.get('/api/ordinal-activity/:id', async (req, res) => {
  const { id } = req.params;

  // Cache results for 5 minutes to minimize API calls
  const cacheKey = `activity:${id}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    // Prepare headers with API key
    const headers = { Accept: 'application/json' };
    if (process.env.MAGICEDEN_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.MAGICEDEN_API_KEY}`;
    }

    // Fetch activity data from Magic Eden
    const r = await fetch(
      `https://api-mainnet.magiceden.dev/v2/ord/btc/activities?tokenId=${encodeURIComponent(id)}`,
      { headers }
    );

    const json = await r.json();
    const activities = json.activities || [];

    // Find the most recent purchase to determine cost basis
    const lastPurchase = activities.find(a =>
      a.kind === 'buying_broadcasted' ||
      a.kind === 'sale' ||
      a.kind === 'list_sale'
    );

    const result = {
      id,
      activities: activities.slice(0, 10),
      lastPurchasePrice: lastPurchase?.listedPrice || lastPurchase?.price || null,
      lastPurchaseDate: lastPurchase?.createdAt || null,
    };

    // Cache for 5 minutes
    cache.set(cacheKey, result, 300);
    return res.json(result);
  } catch (e) {
    // Graceful degradation on error
    return res.status(200).json({
      id,
      activities: [],
      lastPurchasePrice: null,
      lastPurchaseDate: null,
      error: 'Could not fetch activity data'
    });
  }
});
```

**Usage**: Determines the user's cost basis (purchase price) for each ordinal to calculate unrealized gains/losses.

---

### 2. Fetching Current Prices (`/tokens/:token_mint`)

**Backend Endpoint**: `GET /api/ordinal-value/:id`

```javascript
// server.js (lines 353-414)
app.get('/api/ordinal-value/:id', async (req, res) => {
  const { id } = req.params;

  const cacheKey = `value:${id}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const headers = { Accept: 'application/json' };
    if (process.env.MAGICEDEN_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.MAGICEDEN_API_KEY}`;
    }

    const r = await fetch(
      `https://api-mainnet.magiceden.dev/v2/ord/btc/tokens?tokenId=${encodeURIComponent(id)}`,
      { headers }
    );

    const json = await r.json();
    const tokens = json.tokens || [];
    const token = tokens[0];

    const result = {
      id,
      currentPrice: token?.listedPrice || null,
      floorPrice: token?.collection?.floorPrice || null,
      collectionId: token?.collection?.id || null,
      isListed: token?.listedPrice !== null,
    };

    cache.set(cacheKey, result, 300);
    return res.json(result);
  } catch (e) {
    return res.status(200).json({
      id,
      currentPrice: null,
      floorPrice: null,
      error: 'Could not fetch value data'
    });
  }
});
```

**Usage**: Determines current market value to compare against purchase price for gain/loss calculation.

---

### 3. Frontend Integration

**React Hook for Purchase Prices**:

```javascript
// frontend/src/hooks/useOrdinalActivity.js
export function useOrdinalActivity(inscriptionId) {
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!inscriptionId) return;

    async function fetchActivity() {
      try {
        const response = await fetch(
          `${API_BASE}/api/ordinal-activity/${encodeURIComponent(inscriptionId)}`
        );
        const data = await response.json();
        setActivity(data);
      } catch (err) {
        console.error('Failed to fetch activity:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchActivity();
  }, [inscriptionId]);

  return { activity, loading };
}
```

**Display Component**:

```javascript
// frontend/src/components/OrdinalPriceCard.jsx
export default function OrdinalPriceCard({ inscription }) {
  const { activity, loading } = useOrdinalActivity(inscription.id);
  const lastPrice = activity?.lastPurchasePrice;

  return (
    <div className="ordinal-card">
      {/* Ordinal image/content */}
      <OrdinalMedia id={inscription.id} contentType={inscription.content_type} />

      {/* Price display */}
      {loading ? (
        <div>Loading price...</div>
      ) : lastPrice ? (
        <div>
          <div>Last Purchase Price</div>
          <div>{lastPrice} BTC</div>
          {activity?.lastPurchaseDate && (
            <div>{new Date(activity.lastPurchaseDate).toLocaleDateString()}</div>
          )}
        </div>
      ) : (
        <div>No price data</div>
      )}
    </div>
  );
}
```

---

## Rate Limiting Strategy

To respect API rate limits and minimize requests:

1. **Aggressive Caching**: 5-minute cache for price data, 24-hour cache for metadata
2. **Request Queuing**: Limit to 3 concurrent requests with 500ms delays
3. **Graceful Degradation**: Return empty data instead of errors when API unavailable
4. **Cache Headers**: Use `Cache-Control` and `X-Cache` headers to track cache hits

```javascript
// Request queue implementation
let requestQueue = [];
let activeRequests = 0;
const MAX_CONCURRENT = 3;
const DELAY_BETWEEN_REQUESTS = 500;

function processQueue() {
  if (activeRequests >= MAX_CONCURRENT || requestQueue.length === 0) return;

  const nextRequest = requestQueue.shift();
  if (nextRequest) {
    activeRequests++;
    nextRequest().finally(() => {
      activeRequests--;
      setTimeout(processQueue, DELAY_BETWEEN_REQUESTS);
    });
  }
}
```

---

## Expected API Usage

**Per User Session**:
- Initial load: ~50 requests (fetch activity for each ordinal)
- Subsequent loads: ~10 requests (most data served from cache)
- Daily unique users: 100-500 (beta phase)

**Total Estimated**: 5,000-25,000 requests per day during beta

---

## Use Case

Harvy helps Bitcoin Ordinals holders:
1. View purchase history and cost basis for each ordinal
2. Compare purchase price vs current market value
3. Identify ordinals with unrealized losses (tax harvesting opportunities)
4. Export data for tax reporting

**Example**: User bought an ordinal for 0.05 BTC, current floor is 0.03 BTC = 0.02 BTC unrealized loss that can be harvested for tax benefits.

All API access is read-only - no trading/buying/selling functionality.
