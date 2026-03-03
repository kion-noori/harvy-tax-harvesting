# Security Audit Requirements Before Mainnet Launch

**Status:** ⚠️ **NOT READY FOR MAINNET** - Professional security audit required

This document outlines critical security issues that MUST be addressed before launching on Bitcoin mainnet with real funds.

---

## 🚨 CRITICAL VULNERABILITIES (Must Fix Before Mainnet)

### 1. **PSBT Validation Missing** - `psbt-utils.js:392-425`
**Risk Level:** 🔴 **CRITICAL** - Could drain entire wallet

**Current State:**
- `broadcastPSBT()` function broadcasts transactions with ZERO validation
- No verification that user actually signed their inputs
- No verification that outputs match expected values
- No protection against PSBT malleability attacks

**What Could Go Wrong:**
- Malicious user crafts a PSBT that sends YOUR Bitcoin to their address
- User manipulates output amounts to pay themselves more than expected
- PSBT malleability allows double-spend or other attacks

**Required Fixes:**
1. Parse PSBT and validate structure before finalizing
2. Verify all seller inputs are properly signed
3. Verify output amounts match expected values (offer amount, service fee, inscription transfer)
4. Verify no unexpected outputs were added
5. Check for known PSBT attack patterns
6. Implement transaction amount limits (e.g., max $1000/tx initially)

**Estimated Fix Time:** 2-4 hours with Bitcoin expert
**Testing Required:** Attempt to craft malicious PSBTs and verify they're rejected

---

### 2. **Private Key Storage** - `psbt-utils.js:87-101`
**Risk Level:** 🔴 **CRITICAL** - If leaked, wallet is permanently compromised

**Current State:**
- Private key stored in plain text `.env` file
- No hardware wallet or HSM integration
- No key rotation mechanism
- Single point of failure

**What Could Go Wrong:**
- `.env` file accidentally committed to git → private key exposed forever
- Server compromise → attacker gets private key from environment variables
- Error logs, crash dumps, or debugging → private key leaked in logs
- Malicious npm package reads environment variables

**Required Fixes for Mainnet:**
1. **Option A (Recommended):** Hardware wallet integration (Ledger/Trezor)
   - Keep private key on hardware device
   - Server requests signatures, never has access to key
2. **Option B:** HSM (Hardware Security Module) like AWS CloudHSM
3. **Option C:** Multi-sig setup (2-of-3 or 3-of-5)
4. **Minimum:** Hot/cold wallet separation
   - Cold wallet holds majority of funds
   - Hot wallet only holds small float (e.g., $1000 max)
   - Auto-refill from cold wallet as needed

**Additional Security:**
- Monitor wallet balance 24/7
- Alert on unexpected transactions
- Daily balance reconciliation
- Key rotation plan (how to migrate funds if compromise suspected)

**Estimated Fix Time:** 1-2 weeks for hardware wallet integration
**Testing Required:** Simulate key compromise and verify funds remain safe

---

### 3. **No Transaction Validation** - `server.js:714-740`
**Risk Level:** 🔴 **CRITICAL** - Direct path to wallet drainage

**Current State:**
- `/api/finalize-psbt` endpoint broadcasts with no validation
- No rate limiting per user address
- No transaction amount limits
- No manual approval queue

**What Could Go Wrong:**
- Attacker sends 1000 malicious PSBTs in rapid succession
- Each transaction drains a small amount
- By the time you notice, wallet is empty

**Required Fixes:**
1. Parse PSBT and validate before broadcasting (same as #1 above)
2. Rate limiting per seller address (e.g., max 5 transactions per hour)
3. Transaction amount limits:
   - Start with max $100/transaction
   - Gradually increase as confidence grows
4. Manual approval queue for transactions > $500
5. Circuit breaker: auto-pause if wallet balance drops > 10% in 1 hour
6. Transaction logging to database (for audit trail)

**Estimated Fix Time:** 4-6 hours
**Testing Required:** Load testing with rapid-fire transactions

---

## ⚠️ HIGH-RISK ISSUES (Should Fix Before Mainnet)

### 4. **Financial Calculation Vulnerabilities** - `server.js:606-617`
**Risk Level:** 🟠 **HIGH** - Could result in incorrect fees or exploits

**Current State:**
- No validation that `purchasePriceSats` is positive/reasonable
- No validation that `currentPriceSats` isn't negative (could create huge fake losses)
- No overflow/underflow checks on satoshi math
- No validation that `btcPriceUSD` is reasonable

**What Could Go Wrong:**
- User passes negative `currentPriceSats` → artificially large tax loss → massive service fee charged
- Integer overflow in satoshi calculations → incorrect amounts
- `btcPriceUSD` set to 0 or negative → division by zero or negative fees

**Required Fixes:**
1. Input validation:
   ```javascript
   if (purchasePriceSats <= 0 || purchasePriceSats > 100000000) {
     throw new Error('Invalid purchase price');
   }
   if (currentPriceSats < 0) {
     throw new Error('Current price cannot be negative');
   }
   if (btcPriceUSD <= 0 || btcPriceUSD > 1000000) {
     throw new Error('Invalid BTC price');
   }
   ```
2. Safe math library for satoshi calculations (to prevent overflow)
3. Sanity checks on calculated values
4. Unit tests for edge cases (max values, zero, negative, etc.)

**Estimated Fix Time:** 2-3 hours
**Testing Required:** Fuzz testing with extreme values

---

### 5. **UTXO Selection Logic** - `psbt-utils.js:167-191`
**Risk Level:** 🟠 **HIGH** - Could select wrong UTXOs or fail unexpectedly

**Current State:**
- Simple "smallest first" selection
- No handling of dust UTXOs
- No fee estimation based on transaction size
- Could select too many inputs → high fees

**What Could Go Wrong:**
- Select 100 tiny UTXOs → transaction too large → high fees
- Don't account for fee in UTXO selection → transaction rejected
- Select wrong UTXOs → change output too small → funds lost

**Required Fixes:**
1. Better UTXO selection algorithm (e.g., Branch and Bound)
2. Dynamic fee estimation based on transaction size
3. Avoid dust UTXOs when possible
4. Test with various UTXO set configurations

**Estimated Fix Time:** 3-4 hours
**Testing Required:** Test with wallets containing many small UTXOs

---

## 📋 MAINNET LAUNCH CHECKLIST

### Before Any Mainnet Testing:
- [ ] Professional security audit completed ($5k-50k depending on auditor)
- [ ] All CRITICAL issues fixed and verified
- [ ] All HIGH issues fixed and verified
- [ ] Hardware wallet or HSM integrated for key storage
- [ ] Rate limiting implemented and tested
- [ ] Transaction amount limits configured (start LOW)
- [ ] Monitoring and alerting set up
- [ ] Circuit breaker tested and working
- [ ] Bug bounty program launched (even small $1k-5k total)

### Initial Mainnet Launch (Soft Launch):
- [ ] Start with very small wallet balance (e.g., $500 max)
- [ ] Transaction limits: Max $50 per transaction
- [ ] Manual approval for ALL transactions (first 100 transactions)
- [ ] Monitor every transaction closely
- [ ] Have kill switch ready (ability to pause all transactions immediately)
- [ ] Daily balance reconciliation
- [ ] Incident response plan documented

### Scale-Up (After 100+ Successful Transactions):
- [ ] Gradually increase transaction limits
- [ ] Gradually increase wallet balance
- [ ] Reduce manual approval threshold
- [ ] Continue monitoring closely

---

## 💰 RECOMMENDED BUDGET

### Minimum (Budget Option):
- **Security Audit:** $5,000 (freelance Bitcoin security researcher)
- **Bug Bounty:** $2,000 (total pot for hackers who find bugs)
- **Total:** $7,000

### Recommended (Professional):
- **Security Audit:** $15,000-30,000 (reputable firm like Trail of Bits)
- **Bug Bounty:** $5,000-10,000
- **Penetration Testing:** $5,000
- **Total:** $25,000-45,000

### Insurance Policy:
- Consider crypto insurance for wallet (if available)
- Expected cost: 1-3% of wallet balance annually

---

## 🔗 RESOURCES

### Security Audit Firms:
- **Trail of Bits** - https://www.trailofbits.com/ (top-tier, expensive)
- **Quantstamp** - https://quantstamp.com/ (blockchain-focused)
- **Halborn** - https://halborn.com/ (crypto-focused)

### Bug Bounty Platforms:
- **Immunefi** - https://immunefi.com/ (crypto-specific)
- **HackerOne** - https://www.hackerone.com/
- **Code4rena** - https://code4rena.com/

### Bitcoin Security Best Practices:
- Bitcoin Core Developer Guide: https://bitcoin.org/en/developer-guide
- Mastering Bitcoin by Andreas Antonopoulos: https://github.com/bitcoinbook/bitcoinbook
- Bitcoin Optech: https://bitcoinops.org/

---

## ⏰ TIMELINE ESTIMATE

**From current state to mainnet-ready:**
- Security fixes: 1-2 weeks
- Professional audit: 2-4 weeks
- Remediation of audit findings: 1-2 weeks
- Testing and validation: 1-2 weeks
- **Total: 5-10 weeks minimum**

**Don't rush this.** One vulnerability could cost more than the entire audit budget.

---

## 📝 NOTES

- All critical security TODOs have been added to the codebase with `TODO: CRITICAL SECURITY` comments
- Search for "TODO: CRITICAL SECURITY" to find all marked locations
- This is a FINANCIAL APPLICATION - treat security accordingly
- When in doubt, err on the side of more security, not less
- Test on testnet for at least 2-4 weeks before mainnet
- Start with small amounts even on mainnet ($500 wallet max initially)

**Remember:** You're not just handling your money, you're handling users' money. Act accordingly.
