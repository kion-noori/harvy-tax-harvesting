import React, { useState, useEffect } from 'react';
import { request } from 'sats-connect';
import '../styles/SellModal.css';

/**
 * Modal for confirming sale of multiple ordinals to Harvy
 * Shows each ordinal with editable purchase price, calculates totals
 */
export default function SellModal({ selectedOrdinals, onClose, onSaleComplete, btcAddress, walletType }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [txResult, setTxResult] = useState(null);

  // Store purchase prices for each ordinal (keyed by inscription id)
  const [purchasePrices, setPurchasePrices] = useState({});

  const [userTaxRate, setUserTaxRate] = useState(30);
  const [showTaxHelp, setShowTaxHelp] = useState(false);
  const [btcPriceUSD, setBtcPriceUSD] = useState(null);
  const [loadingPrice, setLoadingPrice] = useState(true);

  // Initialize purchase prices from localStorage or activity data
  useEffect(() => {
    const initialPrices = {};
    selectedOrdinals.forEach(ord => {
      const savedPrice = localStorage.getItem(`ordinal-price-${ord.inscription.id}`);
      if (savedPrice) {
        initialPrices[ord.inscription.id] = parseFloat(savedPrice);
      } else if (ord.activity?.lastPurchasePrice) {
        initialPrices[ord.inscription.id] = ord.activity.lastPurchasePrice;
      }
    });
    setPurchasePrices(initialPrices);
  }, [selectedOrdinals]);

  // Fetch BTC price on mount
  useEffect(() => {
    async function fetchBTCPrice() {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const data = await response.json();
        setBtcPriceUSD(data.bitcoin.usd);
        setLoadingPrice(false);
      } catch (err) {
        console.error('Failed to fetch BTC price:', err);
        setBtcPriceUSD(100000);
        setLoadingPrice(false);
      }
    }
    fetchBTCPrice();
  }, []);

  // Handle price change for an ordinal
  const handlePriceChange = (inscriptionId, value) => {
    const numValue = parseFloat(value) || null;
    setPurchasePrices(prev => ({
      ...prev,
      [inscriptionId]: numValue
    }));
    // Also save to localStorage
    if (numValue) {
      localStorage.setItem(`ordinal-price-${inscriptionId}`, value);
    } else {
      localStorage.removeItem(`ordinal-price-${inscriptionId}`);
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    let totalPurchase = 0;
    let totalCurrent = 0;
    let validCount = 0;

    selectedOrdinals.forEach(ord => {
      const purchasePrice = purchasePrices[ord.inscription.id];
      const currentPrice = ord.currentPrice;

      if (purchasePrice && purchasePrice > 0) {
        totalPurchase += purchasePrice;
        totalCurrent += currentPrice || 0;
        validCount++;
      }
    });

    const totalLoss = totalPurchase - totalCurrent;
    const taxRate = userTaxRate / 100;
    const taxLossUSD = btcPriceUSD ? totalLoss * btcPriceUSD : 0;
    const taxSavingsUSD = taxLossUSD * taxRate;

    // Fee calculation
    const tiers = [
      { max: 100, percent: 5 },
      { max: 500, percent: 7 },
      { max: 2000, percent: 10 },
      { max: 10000, percent: 12 },
      { max: Infinity, percent: 15 },
    ];

    let feePercent = 5;
    for (const tier of tiers) {
      if (taxSavingsUSD <= tier.max) {
        feePercent = tier.percent;
        break;
      }
    }

    const feeUSD = taxSavingsUSD * (feePercent / 100);
    const netBenefitUSD = taxSavingsUSD - feeUSD;
    const paymentSats = 600 * validCount; // 600 sats per ordinal

    return {
      totalPurchase,
      totalCurrent,
      totalLoss,
      taxLossUSD,
      taxSavingsUSD,
      feePercent,
      feeUSD,
      netBenefitUSD,
      validCount,
      paymentSats
    };
  };

  const totals = btcPriceUSD ? calculateTotals() : null;

  // Check if all ordinals have purchase prices
  const allHavePrices = selectedOrdinals.every(ord => {
    const price = purchasePrices[ord.inscription.id];
    return price && price > 0;
  });

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

    setIsProcessing(true);
    setProcessingStep('Creating transaction...');

    try {
      // Build ordinals array for batch endpoint
      const ordinalsData = selectedOrdinals.map(ord => ({
        inscriptionId: ord.inscription.id,
        purchasePriceSats: Math.round(purchasePrices[ord.inscription.id] * 100000000),
        currentPriceSats: Math.round((ord.currentPrice || 0) * 100000000),
      }));

      // Create SINGLE batched PSBT for all ordinals
      const response = await fetch('http://localhost:3001/api/create-batch-psbt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ordinals: ordinalsData,
          sellerAddress: btcAddress,
          btcPriceUSD,
          userTaxRate: userTaxRate / 100,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create batch transaction');
      }

      // Sign PSBT (single signature for all ordinals!)
      setProcessingStep('Waiting for signature...');
      let signedPsbtBase64;

      if (walletType === 'xverse') {
        const signResponse = await request('signPsbt', {
          psbt: data.psbtBase64,
          broadcast: false,
          inputsToSign: [
            {
              address: btcAddress,
              signingIndexes: data.details.sellerInputIndices,
            },
          ],
        });

        if (signResponse.status !== 'success') {
          throw new Error('User cancelled signing or signing failed');
        }
        signedPsbtBase64 = signResponse.result.psbt;

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
      const broadcastResponse = await fetch('http://localhost:3001/api/finalize-psbt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          psbtBase64: signedPsbtBase64,
        }),
      });

      const broadcastData = await broadcastResponse.json();

      if (!broadcastResponse.ok || !broadcastData.success) {
        throw new Error(broadcastData.error || 'Failed to broadcast transaction');
      }

      // Success - single transaction for all ordinals
      setProcessingStep('success');
      setTxResult({
        txid: broadcastData.txid,
        explorerUrl: broadcastData.explorerUrl,
        ordinalCount: selectedOrdinals.length,
        totals,
      });

      // Call parent handler with all inscription IDs
      if (onSaleComplete) {
        onSaleComplete(selectedOrdinals.map(o => o.inscription.id));
      }

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
                  Est: {ord.currentPrice ? ord.currentPrice.toFixed(6) : 'N/A'} BTC
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
                What is my capital gains tax rate?
              </div>
              <div>Federal (0-20%) + State (0-13%) for US. Check your country's crypto capital gains rate internationally.</div>
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
                <span>Total Current Value</span>
                <span>{totals.totalCurrent.toFixed(8)} BTC</span>
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
                <span>Service Fee ({totals.feePercent}%)</span>
                <span>-${totals.feeUSD.toFixed(2)}</span>
              </div>

              <div className="benefit-row">
                <span>Harvy Pays You</span>
                <span>{totals.paymentSats.toLocaleString()} sats</span>
              </div>

              <div className="benefit-row total">
                <span>Your Net Benefit</span>
                <span className="benefit-total">${totals.netBenefitUSD.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}

        {/* Warning */}
        <div className="modal-warning">
          <strong>Note:</strong> This sale is final. Once you sign the transaction{selectedOrdinals.length > 1 ? 's' : ''},
          the ordinal{selectedOrdinals.length !== 1 ? 's' : ''} will be transferred to Harvy.
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
                <button className="btn-done" onClick={onClose}>
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
