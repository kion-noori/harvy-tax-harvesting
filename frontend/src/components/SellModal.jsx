import React, { useState, useEffect } from 'react';
import { request } from 'sats-connect';
import '../styles/SellModal.css';

/**
 * Modal for confirming sale of multiple ordinals to Harvy
 * Shows each ordinal with editable purchase price, calculates totals
 */
export default function SellModal({ selectedOrdinals, onClose, onSaleComplete, btcAddress, walletType, btcPublicKey }) {
  const rawFeeSats = Number(process.env.REACT_APP_FLAT_SERVICE_FEE_SATS || 1000);
  const configuredFeeSats = Number.isFinite(rawFeeSats) ? rawFeeSats : 1000;
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [txResult, setTxResult] = useState(null);

  // Store purchase prices as STRINGS to preserve user input (allows "0.00" typing)
  const [purchasePrices, setPurchasePrices] = useState({});

  const [userTaxRate, setUserTaxRate] = useState(30);
  const [showTaxHelp, setShowTaxHelp] = useState(false);
  const [btcPriceUSD, setBtcPriceUSD] = useState(null);
  const [loadingPrice, setLoadingPrice] = useState(true);

  // Initialize purchase prices from localStorage or prior optional activity data
  useEffect(() => {
    const initialPrices = {};
    selectedOrdinals.forEach(ord => {
      const savedPrice = localStorage.getItem(`ordinal-price-${ord.inscription.id}`);
      if (savedPrice) {
        // Keep as string for display
        initialPrices[ord.inscription.id] = savedPrice;
      } else if (ord.activity?.lastPurchasePrice) {
        initialPrices[ord.inscription.id] = String(ord.activity.lastPurchasePrice);
      }
    });
    setPurchasePrices(initialPrices);
  }, [selectedOrdinals]);

  // Fetch BTC price on mount
  useEffect(() => {
    async function fetchBTCPrice() {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/btc-price`);
        const data = await response.json();
        if (response.ok && typeof data.priceUSD === 'number') {
          setBtcPriceUSD(data.priceUSD);
        } else {
          throw new Error(data.error || 'Invalid BTC price response');
        }
        setLoadingPrice(false);
      } catch (err) {
        console.error('Failed to fetch BTC price:', err);
        setBtcPriceUSD(100000);
        setLoadingPrice(false);
      }
    }
    fetchBTCPrice();
  }, []);

  // Handle price change for an ordinal - keep as string to allow typing "0.001"
  const handlePriceChange = (inscriptionId, value) => {
    // Store the raw string value for display
    setPurchasePrices(prev => ({
      ...prev,
      [inscriptionId]: value
    }));
    // Save to localStorage if it's a valid number
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      localStorage.setItem(`ordinal-price-${inscriptionId}`, value);
    } else if (value === '' || value === null) {
      localStorage.removeItem(`ordinal-price-${inscriptionId}`);
    }
  };

  // Helper to get numeric value from string price
  const getNumericPrice = (inscriptionId) => {
    const strValue = purchasePrices[inscriptionId];
    if (!strValue) return null;
    const num = parseFloat(strValue);
    return isNaN(num) ? null : num;
  };

  // Calculate totals
  const calculateTotals = () => {
    let totalPurchase = 0;
    let validCount = 0;

    selectedOrdinals.forEach(ord => {
      const purchasePrice = getNumericPrice(ord.inscription.id);

      if (purchasePrice && purchasePrice > 0) {
        totalPurchase += purchasePrice;
        validCount++;
      }
    });

    const saleProceedsBTC = (600 * validCount) / 100000000;
    const totalLoss = totalPurchase - saleProceedsBTC;
    const taxRate = userTaxRate / 100;
    const taxLossUSD = btcPriceUSD ? totalLoss * btcPriceUSD : 0;
    const taxSavingsUSD = taxLossUSD * taxRate;
    const feeUSD = btcPriceUSD ? (configuredFeeSats / 100000000) * btcPriceUSD : 0;
    const netBenefitUSD = taxSavingsUSD - feeUSD;
    const paymentSats = 600 * validCount; // 600 sats per ordinal
    const netCashSats = paymentSats - configuredFeeSats;

    return {
      totalPurchase,
      saleProceedsBTC,
      totalLoss,
      taxLossUSD,
      taxSavingsUSD,
      feeSats: configuredFeeSats,
      feeUSD,
      netBenefitUSD,
      validCount,
      paymentSats,
      netCashSats,
    };
  };

  const totals = btcPriceUSD ? calculateTotals() : null;

  // Check if all ordinals have purchase prices
  const allHavePrices = selectedOrdinals.every(ord => {
    const price = getNumericPrice(ord.inscription.id);
    return price && price > 0;
  });

  // Generate tax receipt for download
  const generateTaxReceipt = () => {
    if (!txResult) return;

    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString();

    let receipt = `
================================================================================
                         HARVY TAX LOSS HARVESTING RECEIPT
================================================================================

Date: ${date}
Time: ${time}
Transaction ID: ${txResult.txid}

--------------------------------------------------------------------------------
                              ORDINALS SOLD
--------------------------------------------------------------------------------
`;

    selectedOrdinals.forEach((ord, index) => {
      const purchasePrice = getNumericPrice(ord.inscription.id) || 0;
      const salePrice = 600 / 100000000;
      const loss = purchasePrice - salePrice;

      receipt += `
${index + 1}. Inscription #${ord.inscription.number || ord.inscription.id.slice(0, 16) + '...'}
   Inscription ID: ${ord.inscription.id}
   Cost Basis (Purchase Price): ${purchasePrice.toFixed(8)} BTC
   Sale Price (to Harvy):       ${salePrice.toFixed(8)} BTC (600 sats)
   Capital Loss:                ${loss.toFixed(8)} BTC
`;
    });

    receipt += `
--------------------------------------------------------------------------------
                                SUMMARY
--------------------------------------------------------------------------------

Total Ordinals Sold:        ${txResult.ordinalCount}
Total Cost Basis:           ${txResult.totals.totalPurchase.toFixed(8)} BTC
Total Sale Proceeds:        ${(600 * txResult.ordinalCount / 100000000).toFixed(8)} BTC
Harvy Service Fee:          ${txResult.totals.feeSats.toLocaleString()} sats
Total Capital Loss:         ${txResult.totals.totalLoss.toFixed(8)} BTC

USD Values (at time of sale):
  BTC Price:                $${btcPriceUSD?.toLocaleString() || 'N/A'}
  Total Loss (USD):         $${txResult.totals.taxLossUSD.toFixed(2)}
  Est. Tax Savings (${userTaxRate}%): $${txResult.totals.taxSavingsUSD.toFixed(2)}
  Harvy Fee (USD):          $${txResult.totals.feeUSD.toFixed(2)}

--------------------------------------------------------------------------------
                              VERIFICATION
--------------------------------------------------------------------------------

Blockchain Explorer: ${txResult.explorerUrl || 'N/A'}

This receipt documents the sale of digital assets (Bitcoin Ordinals) for tax
reporting purposes. The capital loss shown may be used to offset capital gains
on your tax return, subject to applicable tax laws and regulations.

DISCLAIMER: This is not tax advice. Consult a qualified tax professional for
guidance on reporting cryptocurrency transactions.

================================================================================
                      Generated by Harvy - harvy.tax
================================================================================
`;

    // Create and download the file
    const blob = new Blob([receipt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `harvy-tax-receipt-${date}-${txResult.txid?.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Early return if no ordinals selected
  if (!selectedOrdinals || selectedOrdinals.length === 0) {
    return null;
  }

  const handleConfirm = async () => {
    if (!allHavePrices || !btcPriceUSD || !totals) {
      alert('Please enter purchase prices for all ordinals.');
      return;
    }

    if (!walletType) {
      alert('Wallet not connected. Please reconnect your wallet.');
      return;
    }

    if (walletType !== 'xverse') {
      alert('Selling is currently supported in-app with Xverse only while we finish hardening the other wallet flows.');
      return;
    }

    setIsProcessing(true);
    setProcessingStep('Creating transaction...');

    try {
      // Build ordinals array for batch endpoint
      const ordinalsData = selectedOrdinals.map(ord => ({
        inscriptionId: ord.inscription.id,
        purchasePriceSats: Math.round(getNumericPrice(ord.inscription.id) * 100000000),
      }));

      // Debug: log the public key being sent
      console.log('SellModal: btcPublicKey being sent to backend:', btcPublicKey, 'length:', btcPublicKey?.length);

      // Create SINGLE batched PSBT for all ordinals
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/create-batch-psbt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ordinals: ordinalsData,
          sellerAddress: btcAddress,
          sellerPublicKey: btcPublicKey,
          btcPriceUSD,
          userTaxRate: userTaxRate / 100,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const detail = data.details ? `: ${data.details}` : '';
        throw new Error((data.error || 'Failed to create batch transaction') + detail);
      }

      // Sign PSBT (single signature for all ordinals!)
      setProcessingStep('Waiting for signature...');
      let signedPsbtBase64;

      if (walletType === 'xverse') {
        // Xverse signPsbt uses signInputs: Record<address, inputIndexes[]>
        const signResponse = await request('signPsbt', {
          psbt: data.psbtBase64,
          broadcast: false,
          signInputs: {
            [btcAddress]: data.details.sellerInputIndices,
          },
        });

        if (signResponse.status !== 'success') {
          throw new Error('User cancelled signing or signing failed');
        }
        signedPsbtBase64 = signResponse.result.psbt;
        console.log('Xverse signed PSBT (first 200 chars):', signedPsbtBase64?.slice(0, 200));

      } else if (walletType === 'unisat') {
        signedPsbtBase64 = await window.unisat.signPsbt(data.psbtHex, {
          autoFinalized: false,
        });

      } else if (walletType === 'leather') {
        const signResponse = await window.LeatherProvider.request('signPsbt', {
          hex: data.psbtHex,
          broadcast: false,
        });

        if (!signResponse || !signResponse.result) {
          throw new Error('User cancelled signing or signing failed');
        }
        signedPsbtBase64 = signResponse.result.hex;

      } else {
        throw new Error(`Unsupported wallet type: ${walletType}`);
      }

      // Broadcast single transaction
      setProcessingStep('Broadcasting...');
      const broadcastResponse = await fetch(`${apiUrl}/api/finalize-psbt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          psbtBase64: signedPsbtBase64,
        }),
      });

      const broadcastData = await broadcastResponse.json();

      if (!broadcastResponse.ok || !broadcastData.success) {
        const detail = broadcastData.details ? `: ${broadcastData.details}` : '';
        throw new Error((broadcastData.error || 'Failed to broadcast transaction') + detail);
      }

      // Success - single transaction for all ordinals
      setProcessingStep('success');
      setIsProcessing(false);
      setTxResult({
        txid: broadcastData.txid,
        explorerUrl: broadcastData.explorerUrl,
        ordinalCount: selectedOrdinals.length,
        totals,
      });
      // NOTE: Don't call onSaleComplete here — let the user see the success
      // screen and download their receipt first. It's called when they click "Done".

    } catch (err) {
      console.error('Sale failed:', err);
      alert('Sale failed: ' + err.message);
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content multi-ordinal-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <h2 className="modal-title">Sell to Harvy</h2>
        <p className="modal-subtitle">{selectedOrdinals.length} ordinal{selectedOrdinals.length !== 1 ? 's' : ''} selected</p>

        <div className="sale-mechanics-banner">
          <div className="sale-mechanics-line">
            Harvy pays 600 sats per ordinal and charges a flat {configuredFeeSats.toLocaleString()} sat service fee per batch.
          </div>
          <div className="sale-mechanics-subline">
            You enter basis manually, Harvy records the on-chain sale, and Harvy currently covers the miner fee for this batched transaction.
          </div>
        </div>

        {/* Ordinals List with Price Inputs */}
        <div className="ordinals-price-list">
          {selectedOrdinals.map((ord, index) => (
            <div key={ord.inscription.id} className="ordinal-price-item">
              <div className="ordinal-item-info">
                <span className="ordinal-item-number">
                  {typeof ord.inscription.number === 'number'
                    ? `#${ord.inscription.number}`
                    : ord.inscription.id.slice(0, 12) + '...'}
                </span>
                <span className="ordinal-item-current">
                  Sale Price: 600 sats
                </span>
              </div>
              <div className="ordinal-item-input">
                <input
                  type="number"
                  step="0.00000001"
                  value={purchasePrices[ord.inscription.id] || ''}
                  onChange={(e) => handlePriceChange(ord.inscription.id, e.target.value)}
                  placeholder="Purchase price"
                  className="price-input-small"
                />
                <span className="price-unit-small">BTC</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tax Rate Input */}
        <div className="modal-section tax-rate-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <label className="price-label" style={{ fontWeight: '600', margin: 0 }}>
              Your Tax Rate
            </label>
            <button
              onClick={() => setShowTaxHelp(!showTaxHelp)}
              className="help-button"
              title="Help"
            >
              ?
            </button>
          </div>

          {showTaxHelp && (
            <div className="tax-help-tooltip">
              <div style={{ fontWeight: '600', color: '#F7931A', marginBottom: '8px' }}>
                What belongs here?
              </div>
              <div>Enter your estimated combined tax rate. Harvy records sale proceeds only. Your basis and reporting treatment are your responsibility.</div>
            </div>
          )}

          <div className="price-input-group">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={userTaxRate}
              onChange={(e) => setUserTaxRate(parseFloat(e.target.value) || 0)}
              className="price-input"
            />
            <span className="price-unit">%</span>
          </div>
        </div>

        {/* BTC Price Display */}
        {loadingPrice ? (
          <div className="modal-section">
            <div className="loading-text">Loading BTC price...</div>
          </div>
        ) : btcPriceUSD && (
          <div className="modal-section">
            <div className="btc-price-display">
              Current BTC Price: ${btcPriceUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
        )}

        {/* Summary Totals */}
        {totals && totals.validCount > 0 && (
          <>
            <div className="modal-section summary-section">
              <h3 className="summary-title">Summary ({totals.validCount} ordinals)</h3>

              <div className="summary-row">
                <span>Total Purchase Cost</span>
                <span>{totals.totalPurchase.toFixed(8)} BTC</span>
              </div>

              <div className="summary-row">
                <span>Total Sale Proceeds</span>
                <span>{totals.saleProceedsBTC.toFixed(8)} BTC</span>
              </div>

              <div className="summary-row loss">
                <span>Total Tax Loss</span>
                <span>{totals.totalLoss.toFixed(8)} BTC (${totals.taxLossUSD.toFixed(2)})</span>
              </div>
            </div>

            <div className="modal-section benefit-section">
              <div className="benefit-row highlight">
                <span>Estimated Tax Savings ({userTaxRate}%)</span>
                <span className="benefit-value">${totals.taxSavingsUSD.toFixed(2)}</span>
              </div>

              <div className="benefit-row">
                <span>Service Fee</span>
                <span>{totals.feeSats.toLocaleString()} sats (${totals.feeUSD.toFixed(2)})</span>
              </div>

              <div className="benefit-row">
                <span>Miner Fee</span>
                <span>Covered by Harvy in the current batch flow</span>
              </div>

              <div className="benefit-row">
                <span>Harvy Pays You</span>
                <span>{totals.paymentSats.toLocaleString()} sats</span>
              </div>

              <div className="benefit-row">
                <span>Net Sats After Harvy Fee</span>
                <span>{totals.netCashSats >= 0 ? '' : '-'}{Math.abs(totals.netCashSats).toLocaleString()} sats</span>
              </div>

              <div className="benefit-row total">
                <span>Your Net Benefit</span>
                <span className="benefit-total">${totals.netBenefitUSD.toFixed(2)}</span>
              </div>
              <div className="benefit-row" style={{ fontSize: '12px', color: '#a0a4b8', marginTop: '8px' }}>
                <span>In plain English</span>
                <span>
                  You&apos;ll sell for {totals.paymentSats.toLocaleString()} sats, pay Harvy&apos;s {totals.feeSats.toLocaleString()} sat service fee, and keep an estimated net tax benefit of ${totals.netBenefitUSD.toFixed(2)} after the fee.
                </span>
              </div>
              <div className="benefit-row" style={{ fontSize: '12px', color: '#a0a4b8', marginTop: '8px' }}>
                <span>Basis Source</span>
                <span>You entered the purchase prices above. Harvy does not verify them.</span>
              </div>
            </div>
          </>
        )}

        {/* Warning */}
        <div className="modal-warning">
          <strong>Note:</strong> This sale is final. Once you sign the transaction{selectedOrdinals.length > 1 ? 's' : ''},
          the ordinal{selectedOrdinals.length !== 1 ? 's' : ''} will be transferred to Harvy.
          <br />
          <br />
          <strong>Important:</strong> Harvy does not provide tax, legal, or accounting advice. We generate on-chain
          transactions and a detailed receipt, but you are responsible for how you report these transactions. Always
          consult a qualified tax professional for advice specific to your situation.
        </div>

        {/* Processing Overlay */}
        {isProcessing && processingStep !== 'success' && (
          <div className="processing-overlay">
            <div className="processing-content">
              <div className="spinner"></div>
              <div className="processing-text">{processingStep}</div>
            </div>
          </div>
        )}

        {/* Success State */}
        {processingStep === 'success' && txResult && (
          <div className="success-overlay">
            <div className="success-content">
              <div className="success-icon">✓</div>
              <h3 className="success-title">Sale Complete!</h3>
              <div className="success-details">
                <div className="success-row">
                  <span>Ordinals Sold:</span>
                  <span>{txResult.ordinalCount}</span>
                </div>
                <div className="success-row">
                  <span>Transaction:</span>
                  <span className="success-txid">{txResult.txid?.slice(0, 12)}...</span>
                </div>
                <div className="success-row">
                  <span>Total Tax Savings:</span>
                  <span className="success-value-big">${txResult.totals.taxSavingsUSD.toFixed(2)}</span>
                </div>
                <div className="success-row">
                  <span>Net Benefit:</span>
                  <span className="success-value-big">${txResult.totals.netBenefitUSD.toFixed(2)}</span>
                </div>
              </div>
              <button className="btn-download-receipt" onClick={generateTaxReceipt}>
                Download Tax Receipt
              </button>
              <div className="success-actions">
                {txResult.explorerUrl && (
                  <a
                    href={txResult.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-explorer"
                  >
                    View on Explorer
                  </a>
                )}
                <button className="btn-done" onClick={() => {
                  if (onSaleComplete) {
                    onSaleComplete(selectedOrdinals.map(o => o.inscription.id));
                  }
                  onClose();
                }}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!isProcessing && (
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleConfirm}
              disabled={!allHavePrices || !totals || totals.validCount === 0}
            >
              Confirm Sale ({selectedOrdinals.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
