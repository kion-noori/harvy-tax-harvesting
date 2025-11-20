# Magic Eden API Integration Guide

## Overview

This document outlines the Magic Eden API endpoints required for Harvy's tax harvesting functionality and provides step-by-step integration instructions.

---

## Required Endpoints

### 1. **`GET /v2/ord/btc/activities`** ✅ IMPLEMENTED

**Status**: Already integrated in `server.js:294`

**Purpose**: Fetch transaction history to determine purchase prices

**Request Parameters**:
- `tokenId` (string, required) - The inscription ID

**Response Data**:
```json
{
  "activities": [
    {
      "kind": "buying_broadcasted", // or "sale", "list_sale"
      "price": 0.05,               // Price in BTC
      "listedPrice": 0.05,         // Listed price in BTC
      "createdAt": "2024-03-15T10:30:00Z"
    }
  ]
}
```

**Used For**:
- Displaying "Last Purchase Price" on each ordinal card
- Calculating tax basis for gain/loss calculations
- Transaction history display

**Backend Endpoint**: `GET /api/ordinal-activity/:id`

---

### 2. **`GET /v2/ord/btc/tokens`** ✅ IMPLEMENTED

**Status**: Newly added in `server.js:353`

**Purpose**: Get current listing/market price for individual ordinals

**Request Parameters**:
- `tokenId` (string, required) - The inscription ID

**Response Data**:
```json
{
  "tokens": [
    {
      "listedPrice": 0.03,          // Current listing price (if listed)
      "collection": {
        "id": "collection-slug",
        "floorPrice": 0.025         // Collection floor price
      }
    }
  ]
}
```

**Used For**:
- Calculating current market value
- Comparing purchase price vs current value
- Identifying unrealized gains/losses
- Visual indicators (red for losses, green for gains)

**Backend Endpoint**: `GET /api/ordinal-value/:id`

---

### 3. **`GET /v2/ord/btc/stat`** ⏳ OPTIONAL (Future Feature)

**Purpose**: Collection-level statistics and floor prices

**Request Parameters**:
- `collectionSymbol` (string, required) - Collection identifier

**Response Data**:
```json
{
  "floorPrice": 0.025,
  "volumeAll": 150.5,
  "listedCount": 342
}
```

**Used For**:
- Estimating value for unlisted ordinals (use collection floor)
- Market trend analysis
- Portfolio overview statistics

**Backend Endpoint**: Not yet implemented (future feature)

---

## Integration Steps

### Step 1: Request Magic Eden API Key

**Contact**: https://magiceden.io/developers

**Email Template**:
```
Subject: API Key Request for Bitcoin Ordinals Tax Harvesting Tool

Hi Magic Eden Team,

I'm building Harvy, a Bitcoin Ordinals tax harvesting platform to help users
identify unrealized losses for tax purposes before year-end 2025.

I need API access to the following endpoints:
- GET /v2/ord/btc/activities (transaction history)
- GET /v2/ord/btc/tokens (current pricing)

Expected Usage:
- Users: ~100-500 initial beta users
- Requests: ~50-100 per user session
- Purpose: Fetching purchase prices and current values for tax reporting

The tool displays purchase prices alongside current values to help users
identify which ordinals have unrealized losses that can be harvested for
tax benefits.

Please let me know what information you need to approve API access.

Thank you!
```

**Endpoints to Request**:
1. `/v2/ord/btc/activities` (purchase history)
2. `/v2/ord/btc/tokens` (current pricing)
3. `/v2/ord/btc/stat` (optional - collection stats)

---

### Step 2: Add API Key to Environment

Once you receive your API key from Magic Eden:

**Option A - Development (.env)**:
```bash
# Create or update .env file in project root
MAGICEDEN_API_KEY=your_api_key_here
```

**Option B - Production**:
```bash
# Set environment variable on your hosting platform
export MAGICEDEN_API_KEY=your_api_key_here
```

**Security Note**:
- ✅ API key is stored server-side only (not exposed to frontend)
- ✅ Never commit `.env` file to git (already in `.gitignore`)
- ✅ Use environment variables in production deployment

---

### Step 3: Verify Integration

The code is already prepared to use the API key automatically. Once you add it to `.env`, the server will:

1. **Load the key** on startup (via `process.env.MAGICEDEN_API_KEY`)
2. **Add Authorization header** to all Magic Eden requests:
   ```javascript
   headers: {
     Accept: 'application/json',
     Authorization: `Bearer ${process.env.MAGICEDEN_API_KEY}`
   }
   ```
3. **Lift rate limits** - requests should no longer return HTTP 429

**Test Commands**:

```bash
# 1. Restart the server to load new env variable
yarn dev

# 2. Check server logs - should see no rate limit errors
# Look for: "✅ Server running on http://localhost:3001"
# Should NOT see: "Magic Eden API returned 429"

# 3. Test in browser:
# - Connect wallet
# - View ordinals
# - Check that purchase prices load successfully
# - Browser console should show no 429 errors
```

---

### Step 4: Monitor API Usage

After integration, monitor your API usage to ensure you stay within limits:

**Check Backend Logs** for:
- ✅ Successful requests: `Cache MISS for activity:...`
- ❌ Rate limit errors: `Magic Eden API returned 429` (should be gone)
- ✅ Cache hits: `Cache HIT for activity:...` (reduces API calls)

**Caching Strategy** (Already Implemented):
- Purchase history: Cached 5 minutes
- Current prices: Cached 5 minutes
- Metadata: Cached 24 hours

This reduces API calls by ~80% for repeat visits.

---

## API Rate Limits

### Free Tier (Current - No API Key)
- **Limit**: 30 requests per minute (QPM)
- **Problem**: Loading 46 ordinals = 46 requests = instant rate limit
- **Result**: HTTP 429 errors, no price data displayed

### Paid/Partner Tier (With API Key)
- **Limit**: TBD (Magic Eden will specify)
- **Expected**: 100-300+ QPM
- **Result**: All ordinals load successfully with price data

---

## Testing Checklist

Once you have the API key configured:

- [ ] API key added to `.env` file
- [ ] Server restarted (`yarn dev`)
- [ ] No rate limit errors in backend logs
- [ ] Purchase prices display on ordinal cards
- [ ] Current/floor prices display (once frontend integrated)
- [ ] No HTTP 429 errors in browser console
- [ ] Caching working (check `X-Cache: HIT` in network tab)

---

## Next Steps After Integration

Once the API key is working and rate limits are lifted, we can build:

### 1. **Enhanced Price Display**
- Show purchase price + current price side-by-side
- Calculate gain/loss percentage
- Visual indicators (green for gains, red for losses)

### 2. **Filtering & Sorting**
- Filter: "Show only losses"
- Filter: "Show only gains"
- Sort by: Loss amount (biggest losses first)
- Sort by: Gain amount
- Sort by: Purchase date

### 3. **Tax Harvesting Dashboard**
- Total unrealized losses
- Total unrealized gains
- Potential tax savings estimate
- Export CSV for tax reporting

### 4. **Bulk Actions** (Optional)
- Select multiple ordinals with losses
- Send to another address (realizes loss)
- Generate tax documentation

---

## Current Implementation Summary

**Backend (server.js)**:
- ✅ `/api/ordinal-activity/:id` - Fetches purchase history
- ✅ `/api/ordinal-value/:id` - Fetches current pricing
- ✅ API key integration ready (auto-detects env variable)
- ✅ Graceful degradation (returns empty data on error)
- ✅ Aggressive caching to minimize API calls

**Frontend**:
- ✅ `useOrdinalActivity` hook - Fetches purchase prices
- ✅ `OrdinalPriceCard` component - Displays purchase prices
- ⏳ `useOrdinalValue` hook - Not yet created (for current prices)
- ⏳ Gain/loss calculation - Not yet implemented
- ⏳ Filtering/sorting - Not yet implemented

**Blockers**:
- 🔴 Magic Eden API rate limiting (HTTP 429)
- ✅ Will be resolved once API key is obtained and configured

---

## Questions?

If you encounter any issues during integration:

1. **Check `.env` file** - Ensure `MAGICEDEN_API_KEY` is set
2. **Restart server** - Environment variables only load on startup
3. **Check logs** - Look for authorization errors or 401/403 responses
4. **Test endpoint directly** - Use Postman/curl to test API key

**Example curl test**:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Accept: application/json" \
     "https://api-mainnet.magiceden.dev/v2/ord/btc/activities?tokenId=INSCRIPTION_ID"
```

If successful, you should get JSON response with activity data (not a 429 error).
