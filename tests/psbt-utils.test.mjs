import test from 'node:test';
import assert from 'node:assert/strict';
import * as bitcoin from 'bitcoinjs-lib';

import {
  calculateServiceFee,
  getNetwork,
  satsToUSD,
  usdToSats,
  validatePsbtForHarvySafety,
} from '../psbt-utils.js';

const originalEnv = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value;
  }
}

function createP2wpkhAddress(byte, network) {
  return bitcoin.payments.p2wpkh({
    hash: Buffer.alloc(20, byte),
    network,
  }).address;
}

function buildMockPsbt({
  network = bitcoin.networks.bitcoin,
  harvyAddress,
  sellerAddress,
  sellerValue = 600n,
  extraSellerOutput = false,
  harvyInput = true,
}) {
  const psbt = new bitcoin.Psbt({ network });
  const inputAddress = harvyInput ? harvyAddress : sellerAddress;
  const inputScript = bitcoin.address.toOutputScript(inputAddress, network);

  psbt.addInput({
    hash: '11'.repeat(32),
    index: 0,
    witnessUtxo: {
      script: inputScript,
      value: 12000n,
    },
  });

  psbt.addOutput({
    address: harvyAddress,
    value: 11000n,
  });
  psbt.addOutput({
    address: sellerAddress,
    value: sellerValue,
  });

  if (extraSellerOutput) {
    psbt.addOutput({
      address: createP2wpkhAddress(3, network),
      value: 700n,
    });
  }

  return psbt;
}

test.afterEach(() => {
  restoreEnv();
});

test('calculateServiceFee uses the flat configured percentage', () => {
  delete process.env.FLAT_SERVICE_FEE_PERCENT;
  assert.deepEqual(calculateServiceFee(100), {
    feeUSD: 10,
    feePercent: 10,
    model: 'flat',
  });

  process.env.FLAT_SERVICE_FEE_PERCENT = '7.5';
  assert.deepEqual(calculateServiceFee(200), {
    feeUSD: 15,
    feePercent: 7.5,
    model: 'flat',
  });
});

test('usdToSats and satsToUSD round consistently enough for UI math', () => {
  const btcPriceUSD = 100000;
  const sats = usdToSats(12.34, btcPriceUSD);
  assert.equal(sats, 12340);
  assert.equal(satsToUSD(sats, btcPriceUSD), 12.34);
});

test('getNetwork defaults to mainnet and respects explicit testnet', () => {
  delete process.env.BITCOIN_NETWORK;
  assert.equal(getNetwork(), bitcoin.networks.bitcoin);

  process.env.BITCOIN_NETWORK = 'testnet';
  assert.equal(getNetwork(), bitcoin.networks.testnet);
});

test('validatePsbtForHarvySafety accepts both base64 and hex PSBT encodings', () => {
  process.env.BITCOIN_NETWORK = 'mainnet';
  const network = bitcoin.networks.bitcoin;
  const harvyAddress = createP2wpkhAddress(1, network);
  const sellerAddress = createP2wpkhAddress(2, network);
  process.env.HARVY_WALLET_ADDRESS = harvyAddress;

  const psbt = buildMockPsbt({ network, harvyAddress, sellerAddress });

  assert.doesNotThrow(() => validatePsbtForHarvySafety(psbt.toBase64()));
  assert.doesNotThrow(() => validatePsbtForHarvySafety(psbt.toHex()));
});

test('validatePsbtForHarvySafety rejects multiple seller outputs', () => {
  process.env.BITCOIN_NETWORK = 'mainnet';
  const network = bitcoin.networks.bitcoin;
  const harvyAddress = createP2wpkhAddress(1, network);
  const sellerAddress = createP2wpkhAddress(2, network);
  process.env.HARVY_WALLET_ADDRESS = harvyAddress;

  const psbt = buildMockPsbt({
    network,
    harvyAddress,
    sellerAddress,
    extraSellerOutput: true,
  });

  assert.throws(
    () => validatePsbtForHarvySafety(psbt.toBase64()),
    /expected exactly 1 non-Harvy output/
  );
});

test('validatePsbtForHarvySafety rejects PSBTs without a Harvy funding input', () => {
  process.env.BITCOIN_NETWORK = 'mainnet';
  const network = bitcoin.networks.bitcoin;
  const harvyAddress = createP2wpkhAddress(1, network);
  const sellerAddress = createP2wpkhAddress(2, network);
  process.env.HARVY_WALLET_ADDRESS = harvyAddress;

  const psbt = buildMockPsbt({
    network,
    harvyAddress,
    sellerAddress,
    harvyInput: false,
  });

  assert.throws(
    () => validatePsbtForHarvySafety(psbt.toBase64()),
    /no inputs clearly belonging to Harvy/
  );
});

test('validatePsbtForHarvySafety rejects seller payouts below minimum', () => {
  process.env.BITCOIN_NETWORK = 'mainnet';
  process.env.MIN_ORDINAL_PAYMENT_SATS = '600';
  const network = bitcoin.networks.bitcoin;
  const harvyAddress = createP2wpkhAddress(1, network);
  const sellerAddress = createP2wpkhAddress(2, network);
  process.env.HARVY_WALLET_ADDRESS = harvyAddress;

  const psbt = buildMockPsbt({
    network,
    harvyAddress,
    sellerAddress,
    sellerValue: 599n,
  });

  assert.throws(
    () => validatePsbtForHarvySafety(psbt.toBase64()),
    /seller payment below minimum/
  );
});
