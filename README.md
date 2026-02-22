# Harvy — Bitcoin Ordinals Tax Loss Harvesting

## The Problem

If you hold Bitcoin Ordinals that have dropped in value, you're sitting on unrealized losses. Those losses could offset your capital gains and reduce your tax bill — but there's no easy way to sell low-value or "underwater" Ordinals. Marketplace listings take time, buyers are scarce for losing positions, and the whole process is manual and fragmented.

Most crypto tax tools tell you *what* you owe. None of them help you *reduce* what you owe.

## The Solution

Harvy buys your underwater Ordinals directly — no listings, no waiting, no counterparty risk. You connect your wallet, see which Ordinals are at a loss, and sell them to Harvy in a single atomic transaction. You realize the capital loss instantly, and Harvy gives you a downloadable receipt you can use at tax time.

- **Instant liquidity** — Sell losing Ordinals in one click. No marketplace, no buyers needed.
- **You keep the savings** — Harvy charges a small fee (5-15%) on the tax benefit. You keep the rest.
- **Non-custodial** — Every transaction uses PSBTs (Partially Signed Bitcoin Transactions). Your private keys never leave your wallet.

## How It Works

1. **Connect your wallet** — Harvy supports Xverse, Unisat, and Leather. No signup, no account creation.
2. **Review your Ordinals** — See your portfolio with current values and unrealized gains/losses.
3. **Select and sell** — Pick the Ordinals you want to harvest losses on. Harvy handles the atomic swap and gives you a downloadable tax loss receipt.

## Running Locally

### Prerequisites
- Node.js 18+
- A Bitcoin wallet browser extension (Xverse, Unisat, or Leather)

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

## Architecture

| Layer | Tech |
|-------|------|
| Frontend | React (CRA + CRACO), plain CSS |
| Backend | Node.js, Express |
| Bitcoin | bitcoinjs-lib v7, PSBTs, Taproot |
| Wallet Integration | sats-connect (Xverse), Unisat API, Leather API |
| Ordinals Data | Hiro Ordinals API |
| UTXO Data | Mempool.space API |

## How Transactions Work

Harvy uses **atomic swaps via PSBT** so neither party needs to trust the other:

1. Harvy creates a PSBT with the seller's Ordinal input(s) and Harvy's funding UTXOs
2. Harvy signs its own inputs (Taproot key-path spend)
3. The seller's wallet signs the Ordinal input(s)
4. The fully-signed transaction is broadcast to the Bitcoin network
5. The seller receives payment, Harvy receives the Ordinal(s) — all in one atomic transaction

Inscription inputs are ordered first (before funding inputs) to preserve ordinal sat positions per the FIFO model.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ordinals?address={addr}` | GET | Fetch inscriptions for a Taproot address (with UTXO cross-check) |
| `/api/ordinal-meta/:id` | GET | Get inscription metadata |
| `/api/ordinal-bytes/:id` | GET | Stream inscription content |
| `/api/create-batch-psbt` | POST | Create a batched PSBT for multiple ordinal purchases |
| `/api/finalize-psbt` | POST | Finalize and broadcast a seller-signed PSBT |

## Status

This is an MVP under active development.

## License

Private — All Rights Reserved
