# Manual Test Checklist

Last updated: 2026-04-12

## Current Goal

Validate the hardened Xverse-first sell flow before expanding wallet support.

## Setup

- Confirm `BITCOIN_NETWORK` and `REACT_APP_BITCOIN_NETWORK` match.
- Confirm `HARVY_WALLET_ADDRESS` and `HARVY_WALLET_PRIVATE_KEY` are set.
- Start backend: `node server.js`
- Start frontend: `cd frontend && npm start`
- Keep [transaction-events.ndjson](/Users/kionnoori/my-nft-project/transaction-events.ndjson) open during testing.

## Xverse Test Matrix

### 1. Single Ordinal Sale

- Connect Xverse.
- Load ordinals successfully.
- Select one ordinal.
- Enter a valid purchase price above the fixed Harvy proceeds.
- Confirm the modal shows:
  - sale proceeds of `600 sats`
  - estimated tax loss based on your entered basis
  - fee and net benefit
- Sign in Xverse.
- Confirm success UI appears.
- Confirm explorer link opens the right network.
- Confirm a `create_batch_psbt_requested` and `finalize_psbt_succeeded` event are written.

### 2. Multi-Ordinal Sale

- Select 2-3 ordinals.
- Enter different purchase prices.
- Confirm total sale proceeds equal `600 sats × ordinal count`.
- Sign and submit.
- Confirm all selected ordinals are reflected in the transaction event log.

### 3. Duplicate Submit / Already Known

- Re-trigger finalize on the same signed PSBT if possible, or retry rapidly after the first broadcast.
- Confirm Harvy treats an "already known" mempool response as success rather than a user-facing failure.

### 4. Invalid Input Checks

- Enter a purchase price so low that sale proceeds exceed basis.
- Confirm the backend rejects the sale with a clear error.
- Enter an absurdly high tax rate if you can manipulate the request.
- Confirm the backend rejects it.

## Expected Non-Goals Right Now

- Unisat sell flow
- Leather sell flow
- Dynamic fee-rate behavior

Those are follow-up items, not blockers for the next Xverse validation pass.
