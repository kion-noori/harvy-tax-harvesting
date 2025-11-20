import React, { useEffect } from 'react';
import OrdinalMedia from './OrdinalMedia';
import { useOrdinalActivity } from '../hooks/useOrdinalActivity';
import { useOrdinalValue } from '../hooks/useOrdinalValue';

/**
 * Card component that displays an ordinal with purchase price, current value, and gain/loss
 */
export default function OrdinalPriceCard({ inscription, onActivityData, onValueData }) {
  const { activity, loading: loadingActivity } = useOrdinalActivity(inscription.id);
  const { value, loading: loadingValue } = useOrdinalValue(inscription.id);

  // Notify parent component when data is loaded (for tax reporting)
  useEffect(() => {
    if (activity && !loadingActivity && typeof onActivityData === 'function') {
      onActivityData(activity);
    }
  }, [activity, loadingActivity, onActivityData]);

  useEffect(() => {
    if (value && !loadingValue && typeof onValueData === 'function') {
      onValueData(value);
    }
  }, [value, loadingValue, onValueData]);

  const purchasePrice = activity?.lastPurchasePrice;
  const hasPurchasePrice = purchasePrice !== null && purchasePrice !== undefined;

  // Use listed price if available, otherwise use collection floor price as estimate
  const currentPrice = value?.currentPrice || value?.floorPrice;
  const hasCurrentPrice = currentPrice !== null && currentPrice !== undefined;

  // Calculate gain/loss
  const hasGainLoss = hasPurchasePrice && hasCurrentPrice;
  const gainLoss = hasGainLoss ? currentPrice - purchasePrice : null;
  const gainLossPercent = hasGainLoss ? ((gainLoss / purchasePrice) * 100) : null;
  const isLoss = gainLoss !== null && gainLoss < 0;
  const isGain = gainLoss !== null && gainLoss > 0;

  const loading = loadingActivity || loadingValue;

  return (
    <div className="ordinal-price-card">
      {/* Inscription number */}
      <div className="ordinal-card-header">
        {typeof inscription.number === 'number'
          ? `Inscription #${inscription.number}`
          : inscription.id.slice(0, 12) + '...'}
      </div>

      {/* Ordinal media */}
      <OrdinalMedia id={inscription.id} contentType={inscription.content_type} />

      {/* Price information section */}
      <div className="ordinal-card-prices">
        {loading ? (
          <div className="ordinal-card-loading">
            <div className="loading-spinner"></div>
            <span>Loading price data...</span>
          </div>
        ) : (
          <>
            {/* Purchase Price */}
            {hasPurchasePrice && (
              <div className="price-row">
                <div className="price-label">Purchase Price</div>
                <div className="price-value">{purchasePrice.toFixed(8)} BTC</div>
                {activity?.lastPurchaseDate && (
                  <div className="price-date">
                    {new Date(activity.lastPurchaseDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}

            {/* Current Value */}
            {hasCurrentPrice && (
              <div className="price-row">
                <div className="price-label">
                  {value?.isListed ? 'Listed Price' : 'Est. Value (Floor)'}
                </div>
                <div className="price-value">{currentPrice.toFixed(8)} BTC</div>
              </div>
            )}

            {/* Gain/Loss Display */}
            {hasGainLoss && (
              <div className={`gain-loss-row ${isLoss ? 'loss' : isGain ? 'gain' : 'neutral'}`}>
                <div className="gain-loss-label">
                  {isLoss ? 'Unrealized Loss' : isGain ? 'Unrealized Gain' : 'Break Even'}
                </div>
                <div className="gain-loss-value">
                  <span className="gain-loss-amount">
                    {gainLoss >= 0 ? '+' : ''}{gainLoss.toFixed(8)} BTC
                  </span>
                  <span className="gain-loss-percent">
                    ({gainLossPercent >= 0 ? '+' : ''}{gainLossPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>
            )}

            {/* No data state */}
            {!hasPurchasePrice && !hasCurrentPrice && (
              <div className="ordinal-card-no-data">
                No price data available
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
