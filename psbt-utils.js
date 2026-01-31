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

  // Add Harvy's inputs (we will sign these)
  for (const utxo of harvySelected) {
    const txHex = await fetchTransactionHex(utxo.txid);
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      nonWitnessUtxo: Buffer.from(txHex, 'hex'),
    });
  }

  // Add seller's inscription input (seller will sign this)
  const inscriptionTxHex = await fetchTransactionHex(inscriptionUTXO.txid);
  psbt.addInput({
    hash: inscriptionUTXO.txid,
    index: inscriptionUTXO.vout,
    nonWitnessUtxo: Buffer.from(inscriptionTxHex, 'hex'),
  });

  // Add seller's payment UTXOs for service fee (seller will sign these)
  for (const utxo of sellerPaymentUTXOs) {
    const txHex = await fetchTransactionHex(utxo.txid);
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      nonWitnessUtxo: Buffer.from(txHex, 'hex'),
    });
  }

  // OUTPUT 1: Payment to seller (offerSats)
  psbt.addOutput({
    address: sellerAddress,
    value: offerSats,
  });

  // OUTPUT 2: Inscription to Harvy
  psbt.addOutput({
    address: harvyAddress,
    value: inscriptionUTXO.value, // Preserve the UTXO value (usually 546 or 600 sats)
  });

  // OUTPUT 3: Service fee to Harvy
  if (serviceFeeSats > 0) {
    psbt.addOutput({
      address: harvyAddress,
      value: serviceFeeSats,
    });
  }

  // OUTPUT 4: Change back to Harvy (if any)
  if (harvyChange > 546) { // Only create change output if above dust limit
    psbt.addOutput({
      address: harvyAddress,
      value: harvyChange,
    });
  }

  // TODO: Calculate and add seller's change output if needed
  // (This requires knowing the total of sellerPaymentUTXOs and subtracting serviceFeeSats)

  // SECURITY: Sign Harvy's inputs only (not the seller's)
  // We sign indices 0 to (harvySelected.length - 1)
  const harvyKeyPair = loadHarvyKeyPair();

  for (let i = 0; i < harvySelected.length; i++) {
    psbt.signInput(i, harvyKeyPair);
  }

  // Validate Harvy's signatures
  for (let i = 0; i < harvySelected.length; i++) {
    if (!psbt.validateSignaturesOfInput(i, () => true)) {
      throw new Error(`Invalid signature on Harvy's input ${i}`);
    }
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

  // Calculate total inscription value (we need to preserve these values in outputs)
  const totalInscriptionValue = inscriptionUTXOs.reduce((sum, u) => sum + u.value, 0);

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
    totalOfferSats + totalInscriptionValue, // Need to cover payment + inscription preservation
    estimatedFee
  );

  // Create PSBT
  const psbt = new bitcoin.Psbt({ network });

  // Add Harvy's inputs first (we will sign these)
  for (const utxo of harvySelected) {
    const txHex = await fetchTransactionHex(utxo.txid);
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      nonWitnessUtxo: Buffer.from(txHex, 'hex'),
    });
  }

  // Add seller's inscription inputs (seller will sign these)
  // CRITICAL: These must be added in order, and we track the indices for signing
  const sellerInputIndices = [];
  for (const utxo of inscriptionUTXOs) {
    const txHex = await fetchTransactionHex(utxo.txid);
    const inputIndex = psbt.inputCount;
    sellerInputIndices.push(inputIndex);
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      nonWitnessUtxo: Buffer.from(txHex, 'hex'),
    });
  }

  // OUTPUT 1: Payment to seller (totalOfferSats = 600 × ordinal count)
  psbt.addOutput({
    address: sellerAddress,
    value: totalOfferSats,
  });

  // OUTPUTS 2-N: Each inscription to Harvy (preserve UTXO values)
  for (const utxo of inscriptionUTXOs) {
    psbt.addOutput({
      address: harvyAddress,
      value: utxo.value, // Preserve the inscription UTXO value
    });
  }

  // OUTPUT N+1: Service fee to Harvy (combined)
  if (totalServiceFeeSats > 0) {
    psbt.addOutput({
      address: harvyAddress,
      value: totalServiceFeeSats,
    });
  }

  // OUTPUT N+2: Change back to Harvy (if any)
  if (harvyChange > 546) {
    psbt.addOutput({
      address: harvyAddress,
      value: harvyChange,
    });
  }

  // Sign Harvy's inputs only (indices 0 to harvySelected.length - 1)
  const harvyKeyPair = loadHarvyKeyPair();

  for (let i = 0; i < harvySelected.length; i++) {
    psbt.signInput(i, harvyKeyPair);
  }

  // Validate Harvy's signatures
  for (let i = 0; i < harvySelected.length; i++) {
    if (!psbt.validateSignaturesOfInput(i, () => true)) {
      throw new Error(`Invalid signature on Harvy's input ${i}`);
    }
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
  const MAX_TOTAL_OUTPUT_SATS = 1000000000; // 10 BTC max (way more than we'd ever pay)
  const totalOutputValue = psbt.txOutputs.reduce((sum, output) => sum + output.value, 0);

  if (totalOutputValue > MAX_TOTAL_OUTPUT_SATS) {
    throw new Error(`Invalid PSBT: Total output value (${totalOutputValue} sats) exceeds maximum allowed`);
  }

  // Log transaction details for monitoring
  console.log(`📋 PSBT Details: ${inputCount} inputs, ${outputCount} outputs, total: ${totalOutputValue} sats`);

  // Finalize all inputs
  psbt.finalizeAllInputs();

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
