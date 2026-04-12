# Harvy — Bitcoin Ordinals Tax Loss Harvesting

## The Problem

If you hold Bitcoin Ordinals that have dropped in value, you're sitting on unrealized losses. Those losses could offset your capital gains and reduce your tax bill — but there's no easy way to sell low-value or "underwater" Ordinals. Marketplace listings take time, buyers are scarce for losing positions, and the whole process is manual and fragmented.

Most crypto tax tools tell you *what* you owe. None of them help you *reduce* what you owe.

## The Solution

Harvy buys your underwater Ordinals directly — no listings, no waiting, no counterparty risk. You connect your wallet, select the ordinals you want to sell, manually enter your cost basis, and sell them to Harvy in a single atomic transaction. Harvy records the on-chain sale and gives you a downloadable receipt you can use with your tax records.

- **Instant liquidity** — Sell losing Ordinals in one click. No marketplace, no buyers needed.
- **You keep the savings** — Harvy charges a flat fee on the estimated tax benefit. You keep the rest.
- **Non-custodial** — Every transaction uses PSBTs (Partially Signed Bitcoin Transactions). Your private keys never leave your wallet.

## How It Works

1. **Connect your wallet** — Harvy supports wallet connections without signup or account creation.
2. **Review your Ordinals** — Choose the ordinals you want to sell and enter your original purchase price manually.
3. **Select and sell** — Harvy handles the atomic swap and gives you a downloadable receipt documenting the sale proceeds.

## Running Locally

### Prerequisites
- Node.js 18+
- A Bitcoin wallet browser extension

### Setup

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Configure environment
cp .env.example .env
# Edit .env with your settings (see below)
```

### Start the App

```bash
# Terminal 1 — backend
node server.js

# Terminal 2 — frontend
cd frontend && npm start
```

The frontend runs on `http://localhost:3000`, backend on `http://localhost:3001`.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `BITCOIN_NETWORK` | `mainnet` or `testnet` |
| `MEMPOOL_API_URL` | Mempool.space API endpoint |
| `HARVY_WALLET_ADDRESS` | Harvy's Bitcoin wallet address (Taproot) |
| `HARVY_WALLET_PRIVATE_KEY` | Harvy's wallet private key (WIF format) |
| `FLAT_SERVICE_FEE_PERCENT` | Flat Harvy fee percentage on estimated tax savings |

Frontend environment:
- `REACT_APP_API_URL` — frontend API base URL
- `REACT_APP_BITCOIN_NETWORK` — `mainnet` or `testnet`

## Architecture

| Layer | Tech |
|-------|------|
| Frontend | React (CRA + CRACO), plain CSS |
| Backend | Node.js, Express |
| Bitcoin | bitcoinjs-lib v7, PSBTs, Taproot key-path |
| Wallet Integration | sats-connect (Xverse), Unisat API, Leather API |
| Ordinals Data | Magic Eden API (primary), Hiro fallback for inscription lookup |
| UTXO & Broadcast | Mempool.space API |
| Price | Server-side BTC/USD (CoinGecko), cached 60s |

**Error handling:** API errors return JSON with appropriate HTTP status; upstream failures (Magic Eden, Mempool) are caught and surfaced with clear messages. `/api/finalize-psbt` runs strict PSBT validation before broadcast (output shape, caps, single seller payout).

**UTXO selection:** Harvy’s funding UTXOs are chosen via smallest-first to minimize change; inscription UTXOs are resolved by inscription ID via Magic Eden (current `output` field), with Hiro as fallback.

**Fee estimation:** Batched PSBT uses a fixed fee rate (e.g. 5 sat/vB) and a vsize model (~180 vB/input, ~34 vB/output) to size the transaction; dynamic fee from Mempool is not yet used.

## How Transactions Work (PSBT Flow)

Harvy uses **atomic swaps via PSBT** so neither party needs to trust the other:

1. Backend looks up each inscription’s **current UTXO** (Magic Eden `output` or Hiro fallback) — inscription ID is reveal txid, not current location.
2. Backend builds a PSBT with **inputs**: seller’s inscription UTXOs first, then Harvy’s funding UTXOs. **Outputs**: each inscription → Harvy (value preserved or padded to dust), then seller payment (e.g. 600 sats × N), then service-fee and change to Harvy if above dust.
3. **Input/output order is FIFO-critical:** inscription inputs and inscription outputs come first so ordinal sat positions are preserved; otherwise inscription sats could be consumed as miner fee.
4. Backend signs Harvy’s inputs with **Taproot key-path** (tweaked key, SIGHASH_DEFAULT). Seller’s wallet signs inscription inputs (tapInternalKey from wallet or derived from address).
5. Frontend sends the fully-signed PSBT to `/api/finalize-psbt`. Backend **validates** the PSBT (single non-Harvy output, amount caps, Harvy inputs present) then finalizes and broadcasts via Mempool.space.

All outputs are standard (decodeable) and dust-padded (min 546 sats) where applicable. Max 20 ordinals per batch.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ordinals?address={addr}` | GET | Fetch inscriptions for a Taproot address (with UTXO cross-check) |
| `/api/ordinal-meta/:id` | GET | Get inscription metadata |
| `/api/ordinal-bytes/:id` | GET | Stream inscription content |
| `/api/create-batch-psbt` | POST | Create a batched PSBT for multiple ordinal purchases |
| `/api/finalize-psbt` | POST | Finalize and broadcast a seller-signed PSBT |

## Status

**Working:** Multi-wallet connect (Xverse, Unisat, Leather); Xverse-first batched PSBT create/sign/broadcast with FIFO ordering; server-side BTC price and fee/tax math; pre-broadcast PSBT validation; downloadable tax receipt; one confirmed mainnet tx in the wild.

**Next (technical roadmap):** Broader Xverse testing; Unisat/Leather sell-path hardening; dynamic fee rate from Mempool API; broader edge-case hardening.

## Tooling

This project was built with heavy assistance from the **Cursor IDE** as an AI pair programmer (for both frontend React work and backend PSBT / security logic).
