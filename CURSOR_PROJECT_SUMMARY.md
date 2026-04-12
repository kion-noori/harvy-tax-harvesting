# Harvy — Bitcoin Ordinals Tax Loss Harvesting Platform

Superseded for current operational state by [PROJECT_STATUS.md](/Users/kionnoori/my-nft-project/PROJECT_STATUS.md). Use this file as historical/architectural context and verify details against the live code.

## Resume Here

- Primary handoff file: [PROJECT_STATUS.md](/Users/kionnoori/my-nft-project/PROJECT_STATUS.md)
- Current live fee model: `600 sats` paid per ordinal and a flat `1,000 sat` Harvy service fee per batch transaction
- Current in-app sell path: Xverse-first only
- Current testing precondition: seller needs at least one ordinary BTC UTXO on the same Taproot address, not just inscription UTXOs
- Next priority: real Xverse end-to-end testing of the new flat-fee batch flow

## What This Is

Harvy is a web app that lets Bitcoin Ordinal holders sell their underwater (at-a-loss) inscriptions to Harvy's wallet via atomic swaps (PSBTs). Users realize capital losses for tax purposes. Harvy currently pays `600 sats` per ordinal and charges a flat `1,000 sat` service fee per batch transaction.

**One confirmed mainnet transaction already:** `9478c6fb8da8f2c0f766a5e981a68ce4eea374d81b18cb34033baac630694b54` (block 937,777). The core PSBT engine works.

---

## Architecture

```
├── server.js              # Express backend (ESM, port 3001)
├── psbt-utils.js          # PSBT creation, signing, broadcasting, fee calculations
├── package.json           # Backend deps (bitcoinjs-lib, express, node-cache, etc.)
├── .env                   # Secrets (private key, API keys) — NEVER commit
├── frontend/
│   ├── src/
│   │   ├── App.js                    # Main app — tabs (Home, Ordinals), wallet state
│   │   ├── components/
│   │   │   ├── BitcoinWalletButton.js  # Multi-wallet connector (Xverse, Unisat, Leather)
│   │   │   ├── OrdinalList.js          # Ordinals gallery with pagination/dedup
│   │   │   ├── OrdinalPriceCard.jsx    # Individual ordinal card
│   │   │   ├── OrdinalMedia.jsx        # Content renderer (images, HTML, video, SVG, 3D, text, JSON)
│   │   │   ├── SellModal.jsx           # Sell flow — price entry, tax calc, PSBT sign, broadcast
│   │   │   ├── Footer.jsx
│   │   │   └── TaxReportSummary.jsx    # Tax report component
│   │   ├── hooks/
│   │   │   ├── useOrdinalActivity.js   # Fetches purchase history from Magic Eden
│   │   │   └── useOrdinalValue.js      # Fetches current market value from Magic Eden
│   │   ├── pages/
│   │   │   ├── TermsOfService.jsx
│   │   │   └── PrivacyPolicy.jsx
│   │   ├── styles.css                  # Main stylesheet
│   │   └── styles/SellModal.css        # Sell modal styles
│   ├── .env                            # REACT_APP_API_URL=http://localhost:3001
│   └── package.json                    # Frontend deps (react 19, sats-connect, model-viewer)
```

## How To Run

```bash
# Install everything
yarn install-all

# Run both frontend + backend
yarn dev
# This uses concurrently: backend on :3001, frontend on :3000

# IMPORTANT: Backend does NOT hot-reload. If you change server.js or psbt-utils.js,
# you must kill and restart. The frontend hot-reloads automatically.
# ctrl+c only kills the frontend. To kill backend:
# lsof -ti :3001 | xargs kill -9
```

## Environment Variables (.env)

```
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
MAGICEDEN_API_KEY=<your-uuid-key>      # Required — prevents rate limiting
HARVY_WALLET_ADDRESS=<bc1p-address>    # Harvy's Taproot receiving address
HARVY_WALLET_PRIVATE_KEY=<WIF-key>     # WIF-encoded mainnet private key (CRITICAL SECRET)
BITCOIN_NETWORK=mainnet
MEMPOOL_API_URL=https://mempool.space/api
FLAT_SERVICE_FEE_SATS=1000            # Flat Harvy service fee per batch transaction
MIN_ORDINAL_PAYMENT_SATS=600           # Dust-limit payment per ordinal
ASSUMED_TAX_RATE=0.30
```

Frontend `.env`:
```
PORT=3000
REACT_APP_API_URL=http://localhost:3001
```

---

## Core Transaction Flow (How PSBTs Work)

1. User selects ordinals and enters purchase prices in the SellModal
2. Frontend sends `POST /api/create-batch-psbt` with ordinals array, seller address, BTC price
3. Backend:
   - Looks up each inscription's current UTXO via Magic Eden API (Hiro as fallback)
   - Fetches Harvy's UTXOs from mempool.space
   - Fetches seller ordinary BTC UTXOs to fund the flat fee
   - Builds a PSBT with FIFO ordering (inscription inputs FIRST, then seller fee-paying BTC inputs, then Harvy's funding inputs)
   - Signs Harvy's inputs with the tweaked Taproot key
   - Returns partially-signed PSBT + seller's input indices
4. Frontend asks the user's wallet (Xverse/Unisat/Leather) to sign the seller's inputs
5. Frontend sends the fully-signed PSBT to `POST /api/finalize-psbt`
6. Backend finalizes all inputs and broadcasts via mempool.space
7. User sees success screen with tx link and downloadable tax receipt

### PSBT Structure (Batched)
```
INPUTS (FIFO ORDER — inscription inputs first!):
  [0..N-1]  Seller's inscription UTXOs (seller signs)
  [N..K]    Seller's ordinary BTC UTXOs for the flat service fee (seller signs)
  [K..M]    Harvy's funding UTXOs (Harvy signs server-side)

OUTPUTS (inscription outputs first!):
  [0..N-1]  Each inscription → Harvy's address (preserving UTXO value)
  [N]       Payment to seller (Harvy proceeds plus any seller-side fee-change refund)
  [N+1]     Flat service fee → Harvy
  [N+2]     Change → Harvy (if above dust limit)
```

**Why FIFO ordering matters:** Ordinal theory uses first-in-first-out sat tracking. If Harvy's large funding UTXO comes first in inputs, the inscription's sats get pushed to a high offset and can be lost as miner fee. Inscription inputs must come before funding inputs.

---

## API Endpoints

### `GET /api/ordinals?address=<bc1p...>&offset=0`
Lists inscriptions owned by a Taproot address via Magic Eden API.
- Uses in-memory cache (10 min TTL)
- Returns: `{ items: [...], total, limit, offset }`
- Each item: `{ id, number, content_type, content_uri, preview_uri, offchain_image, collection_name, display_name, output }`
- `content_uri` and `preview_uri` point to `ord-mirror.magiceden.dev` (reliable content mirror)
- `offchain_image` is from `meta.high_res_img_url` (IPFS images for collections like The Royals)

### `GET /api/ordinal-meta/:id`
Returns `{ id, number, content_type }` — tries Magic Eden, falls back to ordinals.com HEAD probe.

### `GET /api/ordinal-activity/:id`
Fetches transaction history from Magic Eden (sale, purchase, listing events). Returns `lastPurchasePrice` in BTC.

### `GET /api/ordinal-value/:id`
Fetches current listing/floor price from Magic Eden. Returns `currentPrice`, `floorPrice`, `collectionName`.

### `GET /api/ordinal-bytes/:id`
Streams raw inscription content. Uses ordinals.com with retry/backoff.

### `POST /api/create-batch-psbt`
Creates a batched PSBT for multiple ordinals. Body: `{ ordinals, sellerAddress, sellerPublicKey, btcPriceUSD, userTaxRate }`

### `POST /api/finalize-psbt`
Finalizes and broadcasts a fully-signed PSBT. Body: `{ psbtBase64 }`

### `POST /api/create-psbt-offer`
Single-ordinal PSBT (legacy, still functional). Body: `{ inscriptionId, sellerAddress, purchasePriceSats, btcPriceUSD }`

---

## Key Technical Details

### Magic Eden API
- Base URL: `https://api-mainnet.magiceden.dev/v2/ord/btc/`
- Auth: `Authorization: Bearer <MAGICEDEN_API_KEY>`
- Limit must be multiple of 20 (min 20, max 100)
- Content mirror: `https://ord-mirror.magiceden.dev/content/<id>` and `/preview/<id>`
- Field names are camelCase: `contentType`, `inscriptionNumber`, `contentURI`, `contentPreviewURI`
- Returns `output` field with current UTXO location (critical for PSBT creation)
- `meta.high_res_img_url` contains offchain images for collection inscriptions

### Inscription ID vs Current UTXO
The inscription ID format is `<reveal_txid>i<vout>` — this is the REVEAL transaction, NOT the current location. If the ordinal has been transferred, the current UTXO has a completely different txid:vout. Must query Magic Eden/Hiro for the `output` field to get the real UTXO.

### Content Rendering (OrdinalMedia.jsx)
- Images: `<img>` tag with fallback chain (Magic Eden mirror → ordinals.com → Hiro)
- HTML/JS: Sandboxed `<iframe>` with `allow-scripts allow-same-origin`
- SVG: `<object>` tag for interactive SVG
- Video: `<video>` with controls
- 3D models: `<model-viewer>` web component
- JSON/text/plain: Shows offchain image if available (from `meta.high_res_img_url`), otherwise shows text content
- Audio: `<audio>` player
- Each type has fallback: tries Magic Eden mirror first, then ordinals.com, then Hiro

### Wallet Integration (BitcoinWalletButton.js)
- Uses `sats-connect` v3.2.0 for Xverse
- `window.unisat` for Unisat
- `window.LeatherProvider` for Leather
- Requests `ordinals` purpose address (Taproot/bc1p)
- 30-second timeout on Xverse connection (hangs if extension is unresponsive)
- Cancel/outside-click resets `isConnecting` state

### Caching
- `node-cache` with 10 min default TTL
- Ordinals list: 10 min
- Metadata: 24 hours
- Activity/value: 24 hours (was 5 min, changed to 24h for dead market)
- Cache cleared on server startup
- Cache cleared after successful transaction broadcast

---

## Known Security Issues (Prioritized)

### CRITICAL — Must fix before public launch
1. **Private key in plaintext `.env`** — if server is compromised, wallet is instantly drained.
   - **Beta mitigation:** Keep wallet funded with minimal BTC only.
   - **Production fix:** HSM, multi-sig, or hardware wallet signing.

2. **The new flat-fee batch path needs live wallet confirmation** — code is updated, but Xverse still needs real-world testing with both inscription inputs and ordinary BTC fee-paying inputs.
   - **Next validation:** single ordinal, multi-ordinal, and duplicate-submit cases with a wallet that has ordinary BTC on the same Taproot address.

### HIGH
3. **No authentication** — any HTTP request to the API works. No session verification that the caller is the wallet owner.
   - **Beta mitigation:** Acceptable with rate limiting for trusted friends.

4. **`purchasePriceSats` is self-reported** — users can lie about purchase price to inflate tax receipts.
   - **Business risk, not security.** Receipt has disclaimer. Could cross-reference with on-chain activity data.

### MEDIUM
6. **Rate limiting per-IP** — bypassable with VPN/proxy. Transaction limiter uses client-provided `sellerAddress`.
7. **No HTTPS** — runs plain HTTP. Must use HTTPS in production (reverse proxy with nginx/Caddy).
8. **Error messages can leak internals** — partially fixed (details hidden when `NODE_ENV !== development`).

### LOW
9. **Ordinals cache not per-user** — cleared globally after any broadcast.
10. **Fee rate hardcoded at 5 sat/vbyte** — should fetch dynamic fee rate from mempool.space.

---

## What's Working

- Wallet connection (Xverse confirmed working, Unisat/Leather coded but untested)
- Ordinals gallery with all content types rendering via Magic Eden mirror
- Offchain images for collection inscriptions (The Royals, etc.)
- PSBT creation with correct FIFO ordering for ordinal theory
- Taproot key-path signing (Harvy server-side, seller via wallet extension)
- Batched transactions (multiple ordinals in one PSBT)
- Transaction broadcasting to mainnet via mempool.space
- Tax receipt generation and download
- Success screen with explorer link
- Flat fee calculation (`1,000 sats` per batch)
- Rate limiting on all endpoints
- CSP security headers
- Cache management

---

## What Needs Building / Fixing

### Before Beta (friends testing)
- [ ] Keep Harvy wallet funded with small amount only (spending cap safety net)
- [ ] Test the new flat-fee Xverse batch flow end-to-end
- [ ] Confirm seller wallet behavior when it must sign both inscription inputs and ordinary BTC fee inputs
- [ ] Record demo video for README

### Before Public Launch
- [ ] **PSBT validation in `/api/finalize-psbt`** (CRITICAL)
- [ ] Server-side BTC price fetching (don't trust client)
- [ ] HTTPS via reverse proxy (nginx/Caddy with Let's Encrypt)
- [ ] Dynamic fee rate from mempool.space API
- [ ] Deploy to production (VPS, Railway, or similar)
- [ ] Update `REACT_APP_API_URL` and `ALLOWED_ORIGINS` for production domain
- [ ] Professional security audit of PSBT handling

### Nice-to-Have / Roadmap
- [ ] Portfolio analytics dashboard (total losses available, historical tracking)
- [ ] Multi-wallet testing (Unisat, Leather)
- [ ] Mobile responsive design improvements
- [ ] Transaction history page (past sales, receipts)
- [ ] Wash sale detection/warning (IRS 30-day rule for securities, crypto unclear)
- [ ] Multi-sig for Harvy's wallet
- [ ] Webhook notifications (email receipt after successful sale)
- [ ] Admin dashboard (monitor Harvy's wallet balance, transaction log)

---

## Dependencies

### Backend (root package.json)
- `bitcoinjs-lib` v7 — PSBT construction and signing
- `tiny-secp256k1` + `ecpair` — Elliptic curve operations, key management
- `express` v4 — HTTP server
- `helmet` — Security headers
- `express-rate-limit` — Rate limiting
- `node-cache` — In-memory caching
- `node-fetch` v3 — HTTP client (ESM)
- `cors` — CORS middleware
- `dotenv` — Environment variable loading
- `concurrently` — Run frontend + backend together
- `sats-connect` v3.2.0 — Wallet communication protocol

### Frontend (frontend/package.json)
- `react` v19 — UI framework
- `sats-connect` — Xverse wallet integration
- `@google/model-viewer` — 3D model rendering for GLTF inscriptions
- `@craco/craco` — CRA config override (for webpack polyfills)

---

## Git Status

Branch: `main`
Modified but uncommitted:
- `server.js` — Major changes (Magic Eden API, security fixes, cache clearing)
- `psbt-utils.js` — Magic Eden UTXO lookup, Hiro fallback
- `frontend/src/components/BitcoinWalletButton.js` — Timeout, cancel reset
- `frontend/src/components/OrdinalList.js` — Dedup, pagination, display count
- `frontend/src/components/OrdinalMedia.jsx` — Magic Eden mirror, offchain images, content types
- `frontend/src/components/OrdinalPriceCard.jsx` — Pass content/image URIs
- `frontend/src/components/SellModal.jsx` — Error details, modal close fix, env var URLs
- `README.md` — License section removed

Recent commits:
```
5b06031 feat: Homepage redesign + PSBT fixes + README rewrite
0e2d387 fix: Remove slow Magic Eden price fetching from ordinal cards
07adb41 feat: Replace Tax Report with downloadable receipt
6dd78c0 fix: Price input zeros + add onboarding UX
57c18d1 feat: Multi-select ordinals with batched transaction support
```
