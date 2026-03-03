# MVP Launch Checklist for Harvy

## ✅ Completed

### Frontend
- [x] Security audit (no vulnerabilities found)
- [x] SellModal with loading states and transaction progress
- [x] Clean, professional homepage with accurate copy
- [x] Infinite scroll for ordinals (fixed and working)
- [x] Uniform ordinal card sizing
- [x] Subtle UI polish (hover effects, transitions)
- [x] Debug logging cleaned up
- [x] Multi-wallet support (Xverse, Unisat, Leather)
- [x] Responsive design
- [x] Error handling for network issues

### Backend
- [x] Ordinals fetching from Hiro API
- [x] Rate limiting (10 req/min strict)
- [x] Caching (10min TTL)
- [x] PSBT creation endpoint
- [x] PSBT finalization and broadcast endpoint
- [x] BRC-20 filtering
- [x] Transaction fee calculation

## 🔲 Critical Path to Launch (In Order)

### 1. Wallet Setup (REQUIRES SECURE NETWORK)
- [ ] Create Harvy testnet wallet (Xverse or Unisat)
- [ ] Fund wallet with testnet BTC
- [ ] Extract wallet credentials:
  - [ ] Payment address
  - [ ] Ordinals address
  - [ ] Private key (WIF format)
- [ ] Add to `.env`:
  ```bash
  HARVY_PAYMENT_ADDRESS=tb1p...
  HARVY_ORDINALS_ADDRESS=tb1p...
  HARVY_PRIVATE_KEY_WIF=cT...
  ```
- [ ] Restart server to load new env vars

### 2. End-to-End Testing
- [ ] Connect user wallet (testnet)
- [ ] View ordinals list
- [ ] Click "Sell to Harvy" on a test ordinal
- [ ] Verify purchase price, current value, loss calculation
- [ ] Verify offer amount and fee breakdown
- [ ] Complete PSBT signing
- [ ] Verify transaction broadcasts
- [ ] Check transaction on mempool.space/testnet
- [ ] Verify success modal shows correct details

### 3. Edge Case Testing
- [ ] Test with wallet that has NO ordinals
- [ ] Test with wallet that has 100+ ordinals
- [ ] Test disconnecting wallet mid-transaction
- [ ] Test with slow/failing API responses
- [ ] Test BRC-20 filtering toggle
- [ ] Test mobile responsiveness

### 4. Pre-Launch Polish
- [ ] Review all error messages (user-friendly?)
- [ ] Test on different browsers (Chrome, Firefox, Safari)
- [ ] Check console for any errors
- [ ] Verify no API keys exposed in frontend
- [ ] Test CORS for production domain

### 5. Mainnet Preparation (DO LAST)
- [ ] Review PSBT creation logic for mainnet compatibility
- [ ] Update environment variables for mainnet
- [ ] Test with small amount first
- [ ] Create mainnet Harvy wallet with real BTC
- [ ] Update `.env` with mainnet credentials
- [ ] Deploy to production

## 🚀 Launch Day

### Pre-Flight
- [ ] Backup database (if any)
- [ ] Have rollback plan ready
- [ ] Monitor server resources
- [ ] Test transaction flow one final time

### Go Live
- [ ] Switch to mainnet in `.env`
- [ ] Deploy frontend
- [ ] Deploy backend
- [ ] Test with small transaction
- [ ] Announce to users

### Post-Launch Monitoring
- [ ] Watch server logs for errors
- [ ] Monitor transaction success rate
- [ ] Check user feedback
- [ ] Have support ready for questions

## 📝 Known Limitations (Document for Users)

1. **Testnet Only** (initially) - clearly communicate this
2. **Manual Purchase Price Entry** - if Magic Eden doesn't have history
3. **Service Fee** - 5-15% of tax savings (clearly shown in UI)
4. **Supported Wallets** - Xverse, Unisat, Leather only
5. **Bitcoin Network** - transactions take 10+ minutes to confirm

## 🔧 Post-MVP Improvements (Future)

- [ ] Add transaction history page
- [ ] Email notifications for completed sales
- [ ] Bulk sell multiple ordinals at once
- [ ] Advanced tax reporting (CSV export)
- [ ] Portfolio analytics dashboard
- [ ] Mainnet/testnet toggle in UI
- [ ] Support for more wallets (Leather improvements, etc.)
- [ ] Automatic purchase price detection from blockchain
- [ ] Integration with tax software (TurboTax, etc.)

---

## Current Status: Ready for Wallet Setup

**Next Step:** Once you're on a secure network, set up the Harvy wallet and add credentials to `.env`, then we can test the complete transaction flow.

**Estimated Time to MVP:** 1-2 hours (mostly testing)
