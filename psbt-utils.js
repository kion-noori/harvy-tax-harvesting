// psbt-utils.js
// Secure PSBT (Partially Signed Bitcoin Transaction) utilities for Harvy

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';

// Initialize ECC library
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

/**
 * Return Harvy's flat service fee in sats for a single transaction.
 * @returns {number}
 */
export function getFlatServiceFeeSats() {
  const raw = parseInt(process.env.FLAT_SERVICE_FEE_SATS || '1000', 10);
  if (!Number.isFinite(raw) || raw < 0) {
    throw new Error('Invalid FLAT_SERVICE_FEE_SATS configuration');
  }
  return raw;
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
  const networkName = process.env.BITCOIN_NETWORK || 'mainnet';
  if (networkName === 'mainnet') {
    return bitcoin.networks.bitcoin;
  }
  return bitcoin.networks.testnet;
}

function parsePsbt(psbtString, network) {
  const trimmed = (psbtString || '').trim();

  if (!trimmed) {
    throw new Error('Missing PSBT');
  }

  try {
    return bitcoin.Psbt.fromBase64(trimmed, { network });
  } catch {}

  if (/^[0-9a-f]+$/i.test(trimmed)) {
    try {
      return bitcoin.Psbt.fromHex(trimmed, { network });
    } catch {}
  }

  throw new Error('Invalid PSBT encoding: expected base64 or hex PSBT');
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
  const mempoolAPI = process.env.MEMPOOL_API_URL || 'https://mempool.space/api';
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
  // The inscription ID contains the REVEAL tx, but the ordinal may have been
  // transferred since then. We need the CURRENT UTXO location.
  // Use Magic Eden (fast indexing) with Hiro as fallback.

  let currentTxid, currentVout;

  // Try Magic Eden first (faster indexing than Hiro)
  try {
    const meHeaders = { Accept: 'application/json' };
    if (process.env.MAGICEDEN_API_KEY) {
      meHeaders['Authorization'] = `Bearer ${process.env.MAGICEDEN_API_KEY}`;
    }
    const meResp = await fetch(
      `https://api-mainnet.magiceden.dev/v2/ord/btc/tokens?tokenIds=${encodeURIComponent(inscriptionId)}`,
      { headers: meHeaders }
    );
    if (meResp.ok) {
      const meData = await meResp.json();
      const token = Array.isArray(meData) ? meData[0] : (meData.tokens || [])[0];
      if (token && token.output) {
        const [outTxid, outVout] = token.output.split(':');
        currentTxid = outTxid;
        currentVout = parseInt(outVout, 10);
        console.log(`Inscription ${inscriptionId} current UTXO: ${currentTxid}:${currentVout} (from Magic Eden)`);
      }
    }
  } catch (e) {
    console.warn(`Magic Eden lookup failed: ${e.message}`);
  }

  // Fallback to Hiro if Magic Eden didn't return data
  if (!currentTxid) {
    try {
      const hiroResp = await fetch(
        `https://api.hiro.so/ordinals/v1/inscriptions/${inscriptionId}`,
        { headers: { Accept: 'application/json' } }
      );
      if (hiroResp.ok) {
        const hiroData = await hiroResp.json();
        if (hiroData.output) {
          const [outTxid, outVout] = hiroData.output.split(':');
          currentTxid = outTxid;
          currentVout = parseInt(outVout, 10);
          console.log(`Inscription ${inscriptionId} current UTXO: ${currentTxid}:${currentVout} (from Hiro fallback)`);
        }
      }
    } catch (e) {
      console.warn(`Hiro fallback failed: ${e.message}`);
    }
  }

  // Last resort: parse from inscription ID (works only if never transferred)
  if (!currentTxid) {
    const lastI = inscriptionId.lastIndexOf('i');
    if (lastI <= 0) {
      throw new Error(`Invalid inscription ID format: ${inscriptionId}`);
    }
    currentTxid = inscriptionId.substring(0, lastI);
    currentVout = parseInt(inscriptionId.substring(lastI + 1), 10);
    console.log(`Inscription ${inscriptionId} using reveal tx as UTXO (last resort): ${currentTxid}:${currentVout}`);
  }

  if (isNaN(currentVout)) {
    throw new Error(`Invalid vout for inscription: ${inscriptionId}`);
  }

  // Now find this UTXO in the seller's UTXO set
  const utxos = await fetchUTXOs(address);
  const inscriptionUTXO = utxos.find(u => u.txid === currentTxid && u.vout === currentVout);

  if (!inscriptionUTXO) {
    console.warn(`Inscription UTXO not found: ${inscriptionId} (looking for ${currentTxid}:${currentVout}) in address ${address}`);
    console.warn(`Available UTXOs (first 10): ${utxos.slice(0, 10).map(u => `${u.txid.slice(0,8)}...:${u.vout}`).join(', ')}`);
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
  const mempoolAPI = process.env.MEMPOOL_API_URL || 'https://mempool.space/api';
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
 *   1-N. Seller's UTXOs containing inscriptions (one per ordinal)
 *   N+1 to K. Seller's ordinary BTC UTXOs (pay the flat service fee)
 *   K+1 to M. Harvy's UTXOs (fund the ordinal purchase and miner fee)
 *
 * OUTPUTS:
 *   1-N. Each inscription → Harvy's address (preserving UTXO value)
 *   N+1. Seller payout (Harvy offer plus any seller-side fee change refund)
 *   N+2. Flat service fee → Harvy
 *   N+3. Change → Harvy (if any)
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

  // Fetch seller UTXOs to fund the flat service fee.
  const sellerAllUtxos = await fetchUTXOs(sellerAddress);
  const inscriptionKeys = new Set(inscriptionUTXOs.map((utxo) => `${utxo.txid}:${utxo.vout}`));
  const sellerSpendableUtxos = sellerAllUtxos.filter(
    (utxo) => !inscriptionKeys.has(`${utxo.txid}:${utxo.vout}`)
  );

  if (totalServiceFeeSats > 0 && sellerSpendableUtxos.length === 0) {
    throw new Error('Seller has no spendable BTC UTXOs available to fund the flat service fee');
  }

  const sellerFeeSelection = totalServiceFeeSats > 0
    ? selectUTXOs(sellerSpendableUtxos, totalServiceFeeSats, 0)
    : { selected: [], change: 0 };
  const sellerFeeSelected = sellerFeeSelection.selected;
  const sellerFeeChange = sellerFeeSelection.change;

  // Fetch Harvy's UTXOs to fund the purchase
  const harvyUTXOs = await fetchUTXOs(harvyAddress);
  if (harvyUTXOs.length === 0) {
    throw new Error('Harvy wallet has no UTXOs. Please fund the wallet first.');
  }

  // Estimate fees: ~180 bytes per input + ~34 bytes per output + 10 bytes overhead
  // Inputs: inscriptionUTXOs + sellerFeeSelected + harvySelected
  // Outputs: inscription transfers + seller payout + service fee + Harvy change
  const estimatedVsize = 10 + (180 * (1 + inscriptionUTXOs.length + sellerFeeSelected.length)) + (34 * (3 + inscriptionUTXOs.length));
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

  // INPUTS N to K: Seller's ordinary BTC inputs to pay Harvy's flat service fee
  for (const utxo of sellerFeeSelected) {
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

  // INPUTS K to M: Harvy's funding inputs
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

  // Refund any seller-side overage back into the same payout output so the
  // transaction still has a single non-Harvy recipient output.
  const sellerPayoutSats = totalOfferSats + sellerFeeChange;

  // OUTPUT N: Payment to seller
  psbt.addOutput({
    address: sellerAddress,
    value: BigInt(sellerPayoutSats),
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
      sellerInputCount: inscriptionUTXOs.length + sellerFeeSelected.length,
      sellerInputIndices, // Indices the seller needs to sign
      inscriptionUTXOs: inscriptionUTXOs.map(u => ({
        inscriptionId: u.inscriptionId,
        txid: u.txid,
        vout: u.vout,
        value: u.value,
      })),
      outputs: {
        sellerPayment: sellerPayoutSats,
        inscriptionValues: inscriptionUTXOs.map(u => u.value),
        serviceFee: totalServiceFeeSats,
        harvyChange,
        sellerFeeInputTotal: sellerFeeSelected.reduce((sum, utxo) => sum + utxo.value, 0),
        sellerFeeChange,
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
  const psbt = parsePsbt(psbtBase64, network);

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
  const txid = tx.getId();

  // Broadcast to mempool
  const mempoolAPI = process.env.MEMPOOL_API_URL || 'https://mempool.space/api';
  const url = `${mempoolAPI}/tx`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: txHex,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const normalized = errorText.toLowerCase();
      if (
        normalized.includes('txn-already-known') ||
        normalized.includes('already in block chain') ||
        normalized.includes('already known')
      ) {
        console.warn(`Transaction ${txid} was already broadcast`);
        return txid;
      }
      throw new Error(`Broadcast failed: ${response.status} ${errorText}`);
    }

    const responseTxid = await response.text();
    console.log(`Transaction broadcast successfully: ${responseTxid}`);
    return responseTxid || txid;
  } catch (e) {
    throw new Error(`Failed to broadcast transaction: ${e.message}`);
  }
}

/**
 * Validate a fully-signed PSBT before broadcast to protect Harvy's wallet.
 * This enforces conservative, opinionated rules based on Harvy's own PSBT
 * construction patterns:
 *
 * - At least one input must clearly belong to Harvy (funding input)
 * - All outputs must decode to standard addresses for the active network
 * - Exactly ONE non-Harvy output is allowed (the seller's payment)
 * - The seller payment amount must be within a sane range
 * - Total output value must be capped
 *
 * These checks significantly reduce the risk that an attacker can craft a
 * malicious PSBT that drains Harvy's wallet, even if they bypass the
 * normal PSBT creation endpoints.
 *
 * @param {string} psbtBase64 - Fully or partially signed PSBT in base64
 * @throws {Error} if validation fails
 */
export function validatePsbtForHarvySafety(psbtBase64) {
  const network = getNetwork();
  const harvyAddress = process.env.HARVY_WALLET_ADDRESS;

  if (!harvyAddress) {
    throw new Error('HARVY_WALLET_ADDRESS not configured');
  }

  let psbt;
  try {
    psbt = parsePsbt(psbtBase64, network);
  } catch (e) {
    throw new Error(e.message);
  }

  const inputCount = psbt.data.inputs.length;
  const outputs = psbt.txOutputs;

  if (inputCount < 1) {
    throw new Error('Invalid PSBT: no inputs');
  }
  if (outputs.length < 2) {
    throw new Error('Invalid PSBT: must have at least 2 outputs');
  }

  // Derive Harvy and non-Harvy outputs
  const harvyOutputs = [];
  const nonHarvyOutputs = [];

  for (let i = 0; i < outputs.length; i++) {
    const out = outputs[i];
    let address;
    try {
      address = bitcoin.address.fromOutputScript(out.script, network);
    } catch (e) {
      // Reject any output we can't decode to a standard address
      throw new Error(`Output ${i} uses unsupported script type`);
    }

    if (address === harvyAddress) {
      harvyOutputs.push({ index: i, value: out.value, address });
    } else {
      nonHarvyOutputs.push({ index: i, value: out.value, address });
    }
  }

  if (harvyOutputs.length === 0) {
    throw new Error('Invalid PSBT: no outputs paying Harvy');
  }

  // Only allow ONE non-Harvy recipient (the seller)
  if (nonHarvyOutputs.length !== 1) {
    throw new Error(`Invalid PSBT: expected exactly 1 non-Harvy output, found ${nonHarvyOutputs.length}`);
  }

  const sellerOutput = nonHarvyOutputs[0];

  // Value guards (sats)
  const MIN_PAYMENT_SATS = BigInt(parseInt(process.env.MIN_ORDINAL_PAYMENT_SATS || '600', 10));
  const MAX_SELLER_PAYOUT_SATS = BigInt(parseInt(process.env.MAX_SELLER_PAYOUT_SATS || '10000000', 10)); // default: 0.1 BTC

  if (sellerOutput.value < MIN_PAYMENT_SATS) {
    throw new Error(
      `Invalid PSBT: seller payment below minimum (${sellerOutput.value} < ${MIN_PAYMENT_SATS} sats)`
    );
  }

  if (sellerOutput.value > MAX_SELLER_PAYOUT_SATS) {
    throw new Error(
      `Invalid PSBT: seller payment exceeds max allowed (${sellerOutput.value} > ${MAX_SELLER_PAYOUT_SATS} sats)`
    );
  }

  // Require at least one clear Harvy funding input
  let harvyInputCount = 0;
  for (let i = 0; i < inputCount; i++) {
    const input = psbt.data.inputs[i];
    const witnessUtxo = input.witnessUtxo;
    if (!witnessUtxo || !witnessUtxo.script) {
      continue;
    }
    try {
      const addr = bitcoin.address.fromOutputScript(witnessUtxo.script, network);
      if (addr === harvyAddress) {
        harvyInputCount++;
      }
    } catch {
      // Ignore inputs we can't decode; we only care about Harvy's
    }
  }

  if (harvyInputCount === 0) {
    throw new Error('Invalid PSBT: no inputs clearly belonging to Harvy');
  }

  // Cap total outputs to a conservative maximum
  const MAX_TOTAL_OUTPUT_SATS = BigInt(parseInt(process.env.MAX_TOTAL_OUTPUT_SATS || '1000000000', 10)); // 10 BTC
  const totalOutputValue = outputs.reduce(
    (sum, out) => sum + out.value,
    BigInt(0)
  );

  if (totalOutputValue > MAX_TOTAL_OUTPUT_SATS) {
    throw new Error(
      `Invalid PSBT: total output value (${totalOutputValue} sats) exceeds maximum allowed`
    );
  }

  // If we reach here, PSBT passes conservative safety checks.
}
