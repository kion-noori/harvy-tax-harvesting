# Project Status

Last updated: 2026-04-12
Primary reference file for future sessions. Update this document at the end of each meaningful pass.

## Current Product State

- Harvy is a Bitcoin Ordinals tax-loss harvesting tool where Harvy buys low-value ordinals for a fixed dust payment.
- Users manually enter their own cost basis. Harvy records sale proceeds, not verified purchase history.
- Wallet connection exists for Xverse, Unisat, and Leather.
- The in-app sell flow is currently hardened for Xverse first.

## Current Technical State

- Backend: Express + `bitcoinjs-lib` PSBT flow in [server.js](/Users/kionnoori/my-nft-project/server.js) and [psbt-utils.js](/Users/kionnoori/my-nft-project/psbt-utils.js).
- Frontend: React app in [frontend/src](/Users/kionnoori/my-nft-project/frontend/src).
- Network default is now mainnet unless `BITCOIN_NETWORK=testnet` is explicitly set.
- `/api/finalize-psbt` now accepts either base64 or hex PSBT payloads.
- Broadcast handling treats "already known" mempool responses as success and returns the txid.
- Transaction event logging now appends to [transaction-events.ndjson](/Users/kionnoori/my-nft-project/transaction-events.ndjson).

## Most Recent Pass

Date: 2026-04-12

Completed:
- Reworked the ordinals browser around collection-first discovery, with a collection dropdown, text filter, faster summary toolbar, and clearer selection state.
- Updated ordinal cards to show display name and collection metadata for quicker scanning.
- Shifted media rendering toward preview-first loading for image/video/model/audio content when safe, which improves perceived grid speed.
- Added clearer sell-modal mechanics copy and surfaced network-fee handling more explicitly in the UI.
- Fixed frontend fee-display consistency so the modal uses the configured flat fee percentage instead of a stale hardcoded value.
- Simplified Harvy pricing from tiered service fees to a flat service-fee percentage.
- Added backend unit tests in [tests/psbt-utils.test.mjs](/Users/kionnoori/my-nft-project/tests/psbt-utils.test.mjs) using Node's built-in test runner.
- Added root script `npm run test:backend`.
- Added [MANUAL_TEST_CHECKLIST.md](/Users/kionnoori/my-nft-project/MANUAL_TEST_CHECKLIST.md) for the next Xverse testing round.
- Updated legal/privacy copy to match the actual transaction-capable product.
- Added `transaction-events.ndjson` to `.gitignore`.
- Added frontend network env documentation to the README.
- Marked older project-summary documentation as secondary to this file.
- Reworked sell-flow math to use fixed Harvy sale proceeds rather than missing market-value data.
- Restricted in-app selling to Xverse while other wallet sell paths remain unverified.
- Hardened batch tax-rate validation and service-fee caps.
- Made PSBT parsing tolerant of both base64 and hex.
- Added transaction event logging for batch creation and finalize success/failure.
- Fixed network-default consistency and explorer-link selection.
- Reduced stale activity/value cache behavior to 5 minutes.
- Updated UI copy to clarify that users enter basis manually and Harvy is not tax advice.
- Cleaned up stale frontend test scaffolding so the local smoke test passes.

Verification completed:
- `npm run test:backend`
- `node --check server.js`
- `node --check psbt-utils.js`
- `cd frontend && npm test -- --watchAll=false`
- `cd frontend && npm run build`

## Open Priorities

1. End-to-end Xverse sell testing on real/manual scenarios.
2. Unisat sell-path hardening.
3. Leather sell-path hardening.
4. Expand backend tests beyond utility-level coverage into endpoint-level cases.
5. Optional dynamic fee-rate support from mempool.
6. Decide whether to suppress or ignore the third-party `jsontokens` build source-map warnings.

## Operational Notes

- Keep Harvy wallet balances conservative until more production testing is done.
- Check [transaction-events.ndjson](/Users/kionnoori/my-nft-project/transaction-events.ndjson) after manual tests for a durable audit trail.
- Older summary docs in the repo may contain stale assumptions; prefer this file first.

## Next Recommended Pass

- Run a deliberate Xverse test matrix:
  - single ordinal sale
  - multi-ordinal sale
  - duplicate submit / already-broadcast case
  - invalid tax-rate and invalid purchase-price checks
- After that, decide whether to harden Unisat or Leather next.
