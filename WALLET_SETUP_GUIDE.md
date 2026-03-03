# Harvy Wallet Setup Guide

## ⚠️ SECURITY FIRST

**ONLY do this on a secure, private network (NOT public WiFi)**

This guide will help you set up the Harvy wallet that will receive ordinals from users.

---

## Option 1: Xverse Wallet (Recommended)

### Step 1: Install Xverse
1. Go to https://www.xverse.app/
2. Install browser extension
3. Create new wallet (testnet mode)
4. **SAVE YOUR SEED PHRASE SECURELY**

### Step 2: Get Testnet BTC
1. Switch to Testnet in Xverse settings
2. Copy your Bitcoin testnet address
3. Get testnet BTC from faucet:
   - https://testnet-faucet.com/btc-testnet/
   - https://coinfaucet.eu/en/btc-testnet/
4. Wait for confirmation (~10 minutes)

### Step 3: Extract Credentials
Xverse stores keys securely, so you'll need to:

1. **Payment Address:** Copy from Xverse (starts with `tb1q...` or `tb1p...`)
2. **Ordinals Address:** Copy from Xverse Ordinals tab (starts with `tb1p...`)
3. **Private Key:**
   - Open Developer Tools (F12)
   - You'll need to use the wallet's built-in signing (Xverse handles keys internally)
   - For testnet MVP, you might need to use Unisat instead (easier key export)

---

## Option 2: Unisat Wallet (Easier for Testnet)

### Step 1: Install Unisat
1. Go to https://unisat.io/
2. Install browser extension
3. Create new wallet
4. **SAVE YOUR SEED PHRASE SECURELY**

### Step 2: Switch to Testnet
1. Click settings (gear icon)
2. Network → Switch to Testnet
3. Confirm switch

### Step 3: Get Testnet BTC
1. Copy your address from Unisat
2. Visit: https://testnet-faucet.com/btc-testnet/
3. Paste address and request testnet BTC
4. Wait for confirmation

### Step 4: Export Private Key (Testnet Only!)
1. Click on account name in Unisat
2. Account Settings
3. Export Private Key
4. Enter password
5. Copy the private key (WIF format, starts with `c...`)

**⚠️ NEVER export mainnet private keys to a server!** For mainnet, use PSBT signing only.

---

## Step 4: Update .env File

Once you have your wallet set up, add these to your `.env` file:

```bash
# Harvy Wallet (Testnet)
HARVY_PAYMENT_ADDRESS=tb1p... # Your payment receiving address
HARVY_ORDINALS_ADDRESS=tb1p... # Your ordinals receiving address
HARVY_PRIVATE_KEY_WIF=cT... # Your private key in WIF format (testnet only)

# Network
NETWORK=testnet
```

### Example .env file:
```bash
# Server
PORT=3001

# Network (testnet or mainnet)
NETWORK=testnet

# Harvy Wallet Credentials (TESTNET ONLY - NEVER COMMIT TO GIT)
HARVY_PAYMENT_ADDRESS=tb1pexampleaddresshere123456789
HARVY_ORDINALS_ADDRESS=tb1pexampleordinalsaddresshere123
HARVY_PRIVATE_KEY_WIF=cTEXAMPLEPRIVATEKEYHERE123456789

# API Keys (if needed)
# MAGIC_EDEN_API_KEY=your_key_here
```

---

## Step 5: Restart Server

After updating `.env`:

```bash
# Stop the server (Ctrl+C if running)
# Restart with:
npm start
# or
node server.js
```

The server will load the new environment variables.

---

## Step 6: Verify Setup

Test that the wallet is configured correctly:

```bash
# Check that env vars are loaded
node -e "console.log('Payment Address:', process.env.HARVY_PAYMENT_ADDRESS)"
node -e "console.log('Ordinals Address:', process.env.HARVY_ORDINALS_ADDRESS)"
node -e "console.log('Private Key exists:', !!process.env.HARVY_PRIVATE_KEY_WIF)"
```

You should see:
```
Payment Address: tb1p...
Ordinals Address: tb1p...
Private Key exists: true
```

---

## Security Best Practices

### For Testnet (Current)
- ✅ Testnet private keys can be stored in `.env` (no real value)
- ✅ Make sure `.env` is in `.gitignore`
- ✅ Use separate wallet for testnet vs mainnet

### For Mainnet (Future)
- ⚠️ **NEVER store mainnet private keys in `.env`**
- ✅ Use hardware wallet (Ledger, Trezor)
- ✅ Use PSBT signing only (wallet signs, never exposes key)
- ✅ Use environment variables for addresses only
- ✅ Implement proper key management (HSM, KMS, etc.)

---

## Troubleshooting

### "Private key not found" error
- Make sure `.env` file is in the root directory
- Make sure you restarted the server after editing `.env`
- Check that there are no quotes around the values in `.env`

### "Invalid address format" error
- Testnet addresses should start with `tb1p...` (Taproot)
- Make sure you're using testnet addresses, not mainnet (`bc1p...`)

### "Insufficient funds" error
- Make sure you have testnet BTC in your wallet
- Check balance: https://mempool.space/testnet/address/YOUR_ADDRESS
- Request more from faucet if needed

---

## Ready to Test?

Once your wallet is set up and funded:
1. Connect your personal wallet to the app
2. View your test ordinals
3. Try selling one to Harvy
4. Complete the PSBT signing
5. Check that the transaction broadcasts successfully

**Next:** Run through the [MVP_LAUNCH_CHECKLIST.md](./MVP_LAUNCH_CHECKLIST.md)
