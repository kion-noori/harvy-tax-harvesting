// psbt-utils.js
// Secure PSBT (Partially Signed Bitcoin Transaction) utilities for Harvy

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';

// Initialize ECC library
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

/**
 * Calculate service fee based on tax savings
 * @param {number} taxSavingsUSD - Tax savings in USD
 * @returns {object} - { feeUSD, feePercent, tier }
 */
export function calculateServiceFee(taxSavingsUSD) {
  const tiers = [
    { max: parseFloat(process.env.FEE_TIER_1_MAX || 100), percent: parseFloat(process.env.FEE_TIER_1_PERCENT || 5) },
    { max: parseFloat(process.env.FEE_TIER_2_MAX || 500), percent: parseFloat(process.env.FEE_TIER_2_PERCENT || 7) },
    { max: parseFloat(process.env.FEE_TIER_3_MAX || 2000), percent: parseFloat(process.env.FEE_TIER_3_PERCENT || 10) },
    { max: parseFloat(process.env.FEE_TIER_4_MAX || 10000), percent: parseFloat(process.env.FEE_TIER_4_PERCENT || 12) },
    { max: Infinity, percent: parseFloat(process.env.FEE_TIER_5_PERCENT || 15) },
  ];

  for (let i = 0; i < tiers.length; i++) {
    if (taxSavingsUSD <= tiers[i].max) {
      const feeUSD = taxSavingsUSD * (tiers[i].percent / 100);
      return {
        feeUSD: Math.round(feeUSD * 100) / 100, // Round to 2 decimals
        feePercent: tiers[i].percent,
        tier: i + 1,
        tierMax: tiers[i].max === Infinity ? 'Infinity' : tiers[i].max
      };
    }
  }

  // Fallback (shouldn't reach here)
  const defaultPercent = 10;
  return {
    feeUSD: Math.round(taxSavingsUSD * (defaultPercent / 100) * 100) / 100,
    feePercent: defaultPercent,
    tier: 3,
    tierMax: 2000
  };
}

/**
 * Convert USD to satoshis using current BTC price
 * @param {number} usd - Amount in USD
 * @param {number} btcPriceUSD - Current BTC price in USD
 * @returns {number} - Amount in satoshis
 */
export function usdToSats(usd, btcPriceUSD) {
  const btc = usd / btcPriceUSD;
  return Math.round(btc * 100000000); // Convert to sats
}

/**
 * Convert satoshis to USD
 * @param {number} sats - Amount in satoshis
 * @param {number} btcPriceUSD - Current BTC price in USD
 * @returns {number} - Amount in USD
 */
export function satsToUSD(sats, btcPriceUSD) {
  const btc = sats / 100000000;
  return Math.round(btc * btcPriceUSD * 100) / 100; // Round to 2 decimals
}

/**
 * Get Bitcoin network configuration
 * @returns {object} - Bitcoin network object (mainnet or testnet)
 */
export function getNetwork() {
  const networkName = process.env.BITCOIN_NETWORK || 'testnet';
  if (networkName === 'mainnet') {
    return bitcoin.networks.bitcoin;
  }
  return bitcoin.networks.testnet;
}

/**
 * SECURITY: Load Harvy's private key from environment
 * IMPORTANT: Never log or expose this key!
 *
 * TODO: SECURITY - PROFESSIONAL AUDIT REQUIRED BEFORE MAINNET
 * Private key security risks:
 * 1. Stored in plain text in .env file
 * 2. Could be exposed in error logs, crash dumps, or memory dumps
 * 3. No hardware wallet or HSM integration
 * 4. No key rotation mechanism
 * 5. If .env is ever committed to git, private key is permanently leaked
 * Recommendations for mainnet:
 * - Use hardware wallet (Ledger/Trezor) or HSM for signing
 * - Implement multi-sig (2-of-3) for high-value transactions
 * - Use separate hot/cold wallets (hot wallet for small amounts only)
 * - Monitor wallet balance and alert on unexpected changes
 * Estimated risk: CRITICAL - if key leaks, entire wallet is drained
 *
 * @returns {ECPairInterface} - Key pair for signing
 */
export function loadHarvyKeyPair() {
  const privateKeyWIF = process.env.HARVY_WALLET_PRIVATE_KEY;

  if (!privateKeyWIF) {
    throw new Error('HARVY_WALLET_PRIVATE_KEY not configured in environment');
  }

  try {
    const network = getNetwork();
    const keyPair = ECPair.fromWIF(privateKeyWIF, network);
    return keyPair;
  } catch (e) {
    throw new Error(`Invalid private key format: ${e.message}`);
  }
}

/**
 * Fetch UTXOs for a given address from Mempool API
 * @param {string} address - Bitcoin address
 * @returns {Promise<Array>} - Array of UTXO objects
 */
export async function fetchUTXOs(address) {
  const mempoolAPI = process.env.MEMPOOL_API_URL || 'https://mempool.space/testnet/api';
  const url = `${mempoolAPI}/address/${address}/utxo`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Mempool API error: ${response.status} ${response.statusText}`);
    }

    const utxos = await response.json();
    return utxos;
  } catch (e) {
    throw new Error(`Failed to fetch UTXOs for ${address}: ${e.message}`);
  }
}

/**
 * Find UTXO containing a specific inscription
 * @param {string} address - Address to search
 * @param {string} inscriptionId - Inscription ID to find
 * @returns {Promise<object|null>} - UTXO containing the inscription, or null
 */
export async function findInscriptionUTXO(address, inscriptionId) {
  // Inscription ID format: <txid>i<index>
  // We need to find the UTXO with matching txid and vout
  const parts = inscriptionId.split('i');
  if (parts.length !== 2) {
    throw new Error(`Invalid inscription ID format: ${inscriptionId}`);
  }

  const [txid, voutStr] = parts;
  const vout = parseInt(voutStr, 10);

  if (isNaN(vout)) {
    throw new Error(`Invalid vout in inscription ID: ${inscriptionId}`);
  }

  const utxos = await fetchUTXOs(address);

  // Find the UTXO matching the inscription's txid and vout
  const inscriptionUTXO = utxos.find(u => u.txid === txid && u.vout === vout);

  if (!inscriptionUTXO) {
    console.warn(`Inscription UTXO not found: ${inscriptionId} in address ${address}`);
    return null;
  }

  return inscriptionUTXO;
}

/**
 * Select UTXOs to fund a transaction
 * Simple algorithm: select smallest UTXOs first (minimize change)
 * @param {Array} utxos - Available UTXOs
 * @param {number} targetSats - Amount needed in satoshis
 * @param {number} feeEstimate - Estimated fee in satoshis
 * @returns {object} - { selected: Array, total: number, change: number }
 */
export function selectUTXOs(utxos, targetSats, feeEstimate = 1000) {
  // Sort by value ascending (smallest first)
  const sorted = [...utxos].sort((a, b) => a.value - b.value);

  const selected = [];
  let total = 0;
  const needed = targetSats + feeEstimate;

  for (const utxo of sorted) {
    selected.push(utxo);
    total += utxo.value;

    if (total >= needed) {
      break;
    }
  }

  if (total < needed) {
    throw new Error(`Insufficient funds: have ${total} sats, need ${needed} sats`);
  }

  const change = total - targetSats - feeEstimate;

  return { selected, total, change };
}

/**
 * Create transaction hex for a given txid (needed for PSBT)
 * @param {string} txid - Transaction ID
 * @returns {Promise<string>} - Raw transaction hex
 */
export async function fetchTransactionHex(txid) {
  const mempoolAPI = process.env.MEMPOOL_API_URL || 'https://mempool.space/testnet/api';
  const url = `${mempoolAPI}/tx/${txid}/hex`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Mempool API error: ${response.status} ${response.statusText}`);
    }

    const hex = await response.text();
    return hex;
  } catch (e) {
    throw new Error(`Failed to fetch transaction hex for ${txid}: ${e.message}`);
  }
}

/**
 * SECURITY NOTE: This function should only be called after manual review
 * Create and partially sign a PSBT for buying an ordinal
 *
 * Transaction structure:
 * INPUTS:
 *   1. Harvy's UTXO (pays for ordinal + service fee)
 *   2. Seller's UTXO containing the inscription
 *   3. Seller's UTXO (pays for service fee)
 *
 * OUTPUTS:
 *   1. Ordinal payment → Seller (e.g., 600 sats)
 *   2. Inscription → Harvy's address
 *   3. Service fee → Harvy's address
 *   4. Change → Seller (if any)
 *   5. Change → Harvy (if any)
 *
 * @param {object} params - Transaction parameters
 * @returns {Promise<object>} - { psbtBase64, psbtHex, details }
 */
export async function createOrdinalPurchasePSBT(params) {
  const {
    inscriptionId,
    sellerAddress,
    sellerPaymentUTXOs,  // UTXOs seller will use to pay service fee
    purchasePriceSats,   // Original purchase price (for tax calculation)
    offerSats,           // What Harvy will pay (e.g., 600 sats minimum)
    serviceFeeSats,      // Service fee amount
    btcPriceUSD,         // Current BTC price for calculations
  } = params;

  console.log('Creating PSBT with params:', {
    inscriptionId: inscriptionId.slice(0, 20) + '...',
    sellerAddress: sellerAddress.slice(0, 20) + '...',
    offerSats,
    serviceFeeSats,
  });

  // Validation
  if (offerSats < 600) {
    throw new Error('Offer amount below dust limit (600 sats)');
  }

  const network = getNetwork();
  const harvyAddress = process.env.HARVY_WALLET_ADDRESS;

  if (!harvyAddress) {
    throw new Error('HARVY_WALLET_ADDRESS not configured');
  }

  // Fetch the inscription UTXO from seller's address
  const inscriptionUTXO = await findInscriptionUTXO(sellerAddress, inscriptionId);
  if (!inscriptionUTXO) {
    throw new Error(`Cannot find inscription ${inscriptionId} in seller's wallet`);
  }

  // Fetch Harvy's UTXOs to fund the purchase
  const harvyUTXOs = await fetchUTXOs(harvyAddress);
  if (harvyUTXOs.length === 0) {
    throw new Error('Harvy wallet has no UTXOs. Please fund the wallet first.');
  }

  // Select UTXOs for Harvy to pay offerSats (estimate 1500 sats for fees)
  const { selected: harvySelected, change: harvyChange } = selectUTXOs(
    harvyUTXOs,
    offerSats,
    1500
  );

  // Create PSBT
  const psbt = new bitcoin.Psbt({ network });

  // Load Harvy's key pair for Taproot input setup
  const harvyKeyPair = loadHarvyKeyPair();
  const harvyInternalPubkey = harvyKeyPair.publicKey.subarray(1, 33); // x-only pubkey
  const harvyP2tr = bitcoin.payments.p2tr({ internalPubkey: harvyInternalPubkey, network });

  // Add Harvy's inputs (we will sign these)
  // For Taproot (P2TR) key-path spends, omit sighashType to use SIGHASH_DEFAULT (0x00)
  for (const utxo of harvySelected) {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: harvyP2tr.output,
        value: BigInt(utxo.value),
      },
      tapInternalKey: harvyInternalPubkey,
    });
  }

  // Add seller's inscription input (seller will sign this)
  // tapInternalKey must be the ACTUAL internal public key, not the tweaked output key
  // For now this function doesn't receive sellerPublicKey - fall back to address extraction
  // TODO: Pass sellerPublicKey through this path too
  const sellerDecoded = bitcoin.address.fromBech32(sellerAddress);
  const sellerInternalPubkey = sellerDecoded.data;

  const inscriptionTxHex = await fetchTransactionHex(inscriptionUTXO.txid);
  const inscriptionPrevTx = bitcoin.Transaction.fromHex(inscriptionTxHex);
  const inscriptionPrevOutput = inscriptionPrevTx.outs[inscriptionUTXO.vout];
  psbt.addInput({
    hash: inscriptionUTXO.txid,
    index: inscriptionUTXO.vout,
    witnessUtxo: {
      script: inscriptionPrevOutput.script,
      value: BigInt(inscriptionUTXO.value),
    },
    tapInternalKey: sellerInternalPubkey,
  });

  // Add seller's payment UTXOs for service fee (seller will sign these)
  for (const utxo of sellerPaymentUTXOs) {
    const txHex = await fetchTransactionHex(utxo.txid);
    const prevTx = bitcoin.Transaction.fromHex(txHex);
    const prevOutput = prevTx.outs[utxo.vout];
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: prevOutput.script,
        value: BigInt(utxo.value),
      },
      tapInternalKey: sellerInternalPubkey,
    });
  }

  // OUTPUT 1: Payment to seller (offerSats)
  // Note: bitcoinjs-lib v7 requires BigInt for output values
  psbt.addOutput({
    address: sellerAddress,
    value: BigInt(offerSats),
  });

  // OUTPUT 2: Inscription to Harvy (pad to dust limit if needed)
  const MIN_OUTPUT_VALUE = 546;
  psbt.addOutput({
    address: harvyAddress,
    value: BigInt(Math.max(inscriptionUTXO.value, MIN_OUTPUT_VALUE)),
  });

  // OUTPUT 3: Service fee to Harvy (only if above dust limit)
  if (serviceFeeSats >= MIN_OUTPUT_VALUE) {
    psbt.addOutput({
      address: harvyAddress,
      value: BigInt(serviceFeeSats),
    });
  }

  // OUTPUT 4: Change back to Harvy (if any)
  if (harvyChange > 546) { // Only create change output if above dust limit
    psbt.addOutput({
      address: harvyAddress,
      value: BigInt(harvyChange),
    });
  }

  // TODO: Calculate and add seller's change output if needed
  // (This requires knowing the total of sellerPaymentUTXOs and subtracting serviceFeeSats)

  // SECURITY: Sign Harvy's inputs only (not the seller's)
  // For Taproot key-path spends, use the tweaked signer with SIGHASH_DEFAULT
  const tweakedSigner = harvyKeyPair.tweak(
    bitcoin.crypto.taggedHash('TapTweak', harvyInternalPubkey)
  );

  for (let i = 0; i < harvySelected.length; i++) {
    psbt.signInput(i, tweakedSigner);
  }

  // Return partially signed PSBT (seller still needs to sign their inputs)
  const psbtBase64 = psbt.toBase64();
  const psbtHex = psbt.toHex();

  return {
    psbtBase64,
    psbtHex,
    details: {
      harvyInputCount: harvySelected.length,
      sellerInputCount: 1 + sellerPaymentUTXOs.length,
      inscriptionUTXO: {
        txid: inscriptionUTXO.txid,
        vout: inscriptionUTXO.vout,
        value: inscriptionUTXO.value,
      },
      outputs: {
        sellerPayment: offerSats,
        inscriptionValue: inscriptionUTXO.value,
        serviceFee: serviceFeeSats,
        harvyChange,
      },
    },
  };
}

/**
 * Create a batched PSBT for buying multiple ordinals in a single transaction
 *
 * Transaction structure:
 * INPUTS:
 *   1-N. Harvy's UTXOs (pays for all ordinals + fees)
 *   N+1 to M. Seller's UTXOs containing inscriptions (one per ordinal)
 *
 * OUTPUTS:
 *   1. Payment to seller (600 sats × number of ordinals)
 *   2-N. Each inscription → Harvy's address (preserving UTXO value)
 *   N+1. Change → Harvy (if any)
 *
 * @param {object} params - Transaction parameters
 * @returns {Promise<object>} - { psbtBase64, psbtHex, details }
 */
export async function createBatchedOrdinalPurchasePSBT(params) {
  const {
    ordinals,          // Array of { inscriptionId, purchasePriceSats, currentPriceSats }
    sellerAddress,
    sellerPublicKey,   // Seller's actual internal public key (hex string from wallet)
    totalOfferSats,    // Total payment (600 × ordinals.length)
    totalServiceFeeSats,
    btcPriceUSD,
  } = params;

  console.log('Creating BATCHED PSBT with params:', {
    ordinalCount: ordinals.length,
    sellerAddress: sellerAddress.slice(0, 20) + '...',
    totalOfferSats,
    totalServiceFeeSats,
  });

  if (ordinals.length === 0) {
    throw new Error('No ordinals provided for batch transaction');
  }

  if (ordinals.length > 20) {
    throw new Error('Maximum 20 ordinals per batch transaction');
  }

  const network = getNetwork();
  const harvyAddress = process.env.HARVY_WALLET_ADDRESS;

  if (!harvyAddress) {
    throw new Error('HARVY_WALLET_ADDRESS not configured');
  }

  // Fetch all inscription UTXOs from seller's address
  const inscriptionUTXOs = [];
  for (const ord of ordinals) {
    const utxo = await findInscriptionUTXO(sellerAddress, ord.inscriptionId);
    if (!utxo) {
      throw new Error(`Cannot find inscription ${ord.inscriptionId} in seller's wallet`);
    }
    inscriptionUTXOs.push({
      ...utxo,
      inscriptionId: ord.inscriptionId,
    });
  }

  // Calculate total inscription output value (padded to dust limit if needed)
  const MIN_OUTPUT_VALUE = 546;
  const totalInscriptionOutputValue = inscriptionUTXOs.reduce(
    (sum, u) => sum + Math.max(u.value, MIN_OUTPUT_VALUE),
    0
  );

  // Fetch Harvy's UTXOs to fund the purchase
  const harvyUTXOs = await fetchUTXOs(harvyAddress);
  if (harvyUTXOs.length === 0) {
    throw new Error('Harvy wallet has no UTXOs. Please fund the wallet first.');
  }

  // Estimate fees: ~180 bytes per input + ~34 bytes per output + 10 bytes overhead
  // Inputs: harvySelected + inscriptionUTXOs
  // Outputs: payment + inscriptions + change (potentially 2 change outputs)
  const estimatedVsize = 10 + (180 * (1 + inscriptionUTXOs.length)) + (34 * (2 + inscriptionUTXOs.length));
  const feeRate = 5; // sats/vbyte (conservative for testnet)
  const estimatedFee = Math.ceil(estimatedVsize * feeRate);

  console.log(`Estimated fee: ${estimatedFee} sats (${estimatedVsize} vbytes @ ${feeRate} sat/vb)`);

  // Select UTXOs for Harvy to pay totalOfferSats + fees
  const { selected: harvySelected, change: harvyChange } = selectUTXOs(
    harvyUTXOs,
    totalOfferSats + totalInscriptionOutputValue, // Need to cover payment + inscription outputs (padded)
    estimatedFee
  );

  // Create PSBT
  const psbt = new bitcoin.Psbt({ network });

  // Load Harvy's key pair for Taproot input setup
  const harvyKeyPair = loadHarvyKeyPair();
  const harvyInternalPubkey = harvyKeyPair.publicKey.subarray(1, 33); // x-only pubkey
  const harvyP2tr = bitcoin.payments.p2tr({ internalPubkey: harvyInternalPubkey, network });

  // Resolve seller's internal public key for tapInternalKey
  let sellerInternalPubkey;
  if (sellerPublicKey) {
    const pubkeyBuf = Buffer.from(sellerPublicKey, 'hex');
    sellerInternalPubkey = pubkeyBuf.length === 33 ? pubkeyBuf.subarray(1, 33) : pubkeyBuf;
    console.log(`Seller pubkey from wallet: ${sellerPublicKey} (${pubkeyBuf.length} bytes)`);
    console.log(`Seller x-only internal pubkey: ${sellerInternalPubkey.toString('hex')}`);

    const derivedP2tr = bitcoin.payments.p2tr({ internalPubkey: sellerInternalPubkey, network });
    console.log(`Derived address from pubkey: ${derivedP2tr.address}`);
    console.log(`Actual seller address:       ${sellerAddress}`);
    console.log(`Address match: ${derivedP2tr.address === sellerAddress}`);

    if (derivedP2tr.address !== sellerAddress) {
      console.warn('⚠️  Public key does NOT derive to seller address!');
      const sellerDecoded = bitcoin.address.fromBech32(sellerAddress);
      console.log(`Tweaked output key from address: ${sellerDecoded.data.toString('hex')}`);
    }
  } else {
    console.warn('⚠️  No sellerPublicKey provided, falling back to tweaked key from address');
    const sellerDecoded = bitcoin.address.fromBech32(sellerAddress);
    sellerInternalPubkey = sellerDecoded.data;
  }

  // ============================================================
  // INPUT ORDERING: Inscription inputs FIRST, then Harvy's funding inputs.
  //
  // CRITICAL for ordinal theory: Sats flow through a transaction using
  // first-in-first-out (FIFO) ordering. If Harvy's large funding UTXO
  // comes first, the inscription's sats end up at a high offset and
  // get consumed as miner fee instead of flowing to an output.
  //
  // By placing inscription inputs first, their sats are at offset 0+
  // and flow directly into the first outputs (the inscription outputs).
  // ============================================================

  // INPUTS 0 to N-1: Seller's inscription inputs (seller will sign these)
  const sellerInputIndices = [];
  for (const utxo of inscriptionUTXOs) {
    const txHex = await fetchTransactionHex(utxo.txid);
    const prevTx = bitcoin.Transaction.fromHex(txHex);
    const prevOutput = prevTx.outs[utxo.vout];
    const inputIndex = psbt.inputCount;
    sellerInputIndices.push(inputIndex);
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: prevOutput.script,
        value: BigInt(utxo.value),
      },
      tapInternalKey: sellerInternalPubkey,
    });
  }

  // INPUTS N to M: Harvy's funding inputs
  const harvyInputStartIndex = psbt.inputCount;
  for (const utxo of harvySelected) {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: harvyP2tr.output,
        value: BigInt(utxo.value),
      },
      tapInternalKey: harvyInternalPubkey,
    });
  }

  // ============================================================
  // OUTPUT ORDERING: Inscription outputs FIRST, then payment/change.
  //
  // Ordinal FIFO: inscription sats from inputs 0..N-1 must flow into
  // the first outputs so the inscriptions land at Harvy's address.
  // ============================================================

  // OUTPUTS 0 to N-1: Each inscription to Harvy (MUST come first for ordinal FIFO)
  for (const utxo of inscriptionUTXOs) {
    const outputValue = Math.max(utxo.value, MIN_OUTPUT_VALUE);
    psbt.addOutput({
      address: harvyAddress,
      value: BigInt(outputValue),
    });
  }

  // OUTPUT N: Payment to seller
  psbt.addOutput({
    address: sellerAddress,
    value: BigInt(totalOfferSats),
  });

  // OUTPUT N+1: Service fee to Harvy (only if above dust limit)
  if (totalServiceFeeSats >= MIN_OUTPUT_VALUE) {
    psbt.addOutput({
      address: harvyAddress,
      value: BigInt(totalServiceFeeSats),
    });
  }

  // OUTPUT N+2: Change back to Harvy (if any)
  if (harvyChange > 546) {
    psbt.addOutput({
      address: harvyAddress,
      value: BigInt(harvyChange),
    });
  } else {
    console.log('Skipping change output (below dust or zero)');
  }

  // Sign Harvy's inputs only (starting at harvyInputStartIndex)
  const tweakedSigner = harvyKeyPair.tweak(
    bitcoin.crypto.taggedHash('TapTweak', harvyInternalPubkey)
  );

  for (let i = harvyInputStartIndex; i < harvyInputStartIndex + harvySelected.length; i++) {
    psbt.signInput(i, tweakedSigner);
  }

  // Return partially signed PSBT
  const psbtBase64 = psbt.toBase64();
  const psbtHex = psbt.toHex();

  return {
    psbtBase64,
    psbtHex,
    details: {
      harvyInputCount: harvySelected.length,
      sellerInputCount: inscriptionUTXOs.length,
      sellerInputIndices, // Indices the seller needs to sign
      inscriptionUTXOs: inscriptionUTXOs.map(u => ({
        inscriptionId: u.inscriptionId,
        txid: u.txid,
        vout: u.vout,
        value: u.value,
      })),
      outputs: {
        sellerPayment: totalOfferSats,
        inscriptionValues: inscriptionUTXOs.map(u => u.value),
        serviceFee: totalServiceFeeSats,
        harvyChange,
      },
      estimatedFee,
    },
  };
}

/**
 * Finalize and broadcast a fully-signed PSBT
 * SECURITY: Only call this after verifying all inputs are signed correctly
 * @param {string} psbtBase64 - Fully signed PSBT in base64
 * @returns {Promise<string>} - Transaction ID
 */
export async function broadcastPSBT(psbtBase64) {
  const network = getNetwork();
  const psbt = bitcoin.Psbt.fromBase64(psbtBase64, { network });

  // TODO: CRITICAL SECURITY - PROFESSIONAL AUDIT REQUIRED BEFORE MAINNET
  // Basic sanity checks added below, but deep PSBT validation still needed
  // Still required: signature verification, malleability checks, economic attack prevention

  // Basic sanity checks
  const inputCount = psbt.data.inputs.length;
  const outputCount = psbt.txOutputs.length;

  // Sanity check: Should have at least 1 input and 2 outputs (payment + inscription transfer)
  if (inputCount < 1) {
    throw new Error('Invalid PSBT: No inputs found');
  }

  if (outputCount < 2) {
    throw new Error('Invalid PSBT: Need at least 2 outputs (payment + inscription)');
  }

  // Sanity check: Total output value shouldn't be absurdly high
  const MAX_TOTAL_OUTPUT_SATS = BigInt(1000000000); // 10 BTC max
  const totalOutputValue = psbt.txOutputs.reduce((sum, output) => sum + output.value, BigInt(0));

  if (totalOutputValue > MAX_TOTAL_OUTPUT_SATS) {
    throw new Error(`Invalid PSBT: Total output value (${totalOutputValue} sats) exceeds maximum allowed`);
  }

  // Log transaction details for monitoring
  console.log(`📋 PSBT Details: ${inputCount} inputs, ${outputCount} outputs, total: ${totalOutputValue.toString()} sats`);
  console.log(`📋 Raw PSBT base64 (first 200 chars): ${psbtBase64.slice(0, 200)}...`);

  // Debug: log each input's signing status
  for (let i = 0; i < inputCount; i++) {
    const input = psbt.data.inputs[i];
    const hasFinalWitness = !!input.finalScriptWitness;
    const hasFinalScript = !!input.finalScriptSig;
    console.log(`  Input ${i}: tapKeySig=${!!input.tapKeySig}, tapInternalKey=${input.tapInternalKey ? input.tapInternalKey.toString('hex').slice(0, 16) + '...' : 'none'}, partialSig=${!!input.partialSig}, sighashType=${input.sighashType}, finalWitness=${hasFinalWitness}, finalScript=${hasFinalScript}`);
    if (input.tapKeySig) {
      console.log(`    tapKeySig (${input.tapKeySig.length} bytes): ${input.tapKeySig.toString('hex').slice(0, 40)}...`);
    }
    if (hasFinalWitness) {
      console.log(`    finalScriptWitness (${input.finalScriptWitness.length} bytes): ${input.finalScriptWitness.toString('hex').slice(0, 40)}...`);
    }
  }

  // Finalize all inputs
  for (let i = 0; i < inputCount; i++) {
    const input = psbt.data.inputs[i];

    // Skip already-finalized inputs (wallet may have already finalized them)
    if (input.finalScriptWitness || input.finalScriptSig) {
      console.log(`  ✅ Input ${i} already finalized, skipping`);
      continue;
    }

    // Use bitcoinjs-lib's built-in Taproot finalizer for inputs with tapKeySig
    if (input.tapKeySig) {
      try {
        psbt.finalizeTaprootInput(i);
        console.log(`  ✅ Finalized input ${i} (taproot built-in)`);
      } catch (e) {
        console.error(`  ❌ Taproot finalization failed for input ${i}: ${e.message}`);
        throw e;
      }
    } else {
      try {
        psbt.finalizeInput(i);
        console.log(`  ✅ Finalized input ${i} (standard)`);
      } catch (e) {
        throw new Error(`Cannot finalize input ${i}: ${e.message}. Has tapKeySig: ${!!input.tapKeySig}, has partialSig: ${!!input.partialSig}`);
      }
    }
  }

  // Extract the final transaction
  const tx = psbt.extractTransaction();
  const txHex = tx.toHex();

  // Broadcast to mempool
  const mempoolAPI = process.env.MEMPOOL_API_URL || 'https://mempool.space/testnet/api';
  const url = `${mempoolAPI}/tx`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: txHex,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Broadcast failed: ${response.status} ${errorText}`);
    }

    const txid = await response.text();
    console.log(`Transaction broadcast successfully: ${txid}`);
    return txid;
  } catch (e) {
    throw new Error(`Failed to broadcast transaction: ${e.message}`);
  }
}
