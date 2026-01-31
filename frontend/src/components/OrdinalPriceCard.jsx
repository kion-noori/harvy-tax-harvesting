import React, { useEffect } from 'react';
import OrdinalMedia from './OrdinalMedia';
import { useOrdinalActivity } from '../hooks/useOrdinalActivity';
import { useOrdinalValue } from '../hooks/useOrdinalValue';

/**
 * Card component that displays an ordinal in a gallery view
 * Shows media, inscription number, and current value estimate
 * Click to select for bulk selling
 */
export default function OrdinalPriceCard({ inscription, onActivityData, onValueData, isSelected, onSelect }) {
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

  // Use listed price if available, otherwise use collection floor price as estimate
  const currentPrice = value?.currentPrice || value?.floorPrice;
  const hasCurrentPrice = currentPrice !== null && currentPrice !== undefined;

  // Handle card click for selection
  const handleClick = () => {
    if (onSelect) {
      onSelect(inscription.id);
    }
  };

  return (
    <div
      className={`ordinal-price-card ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="selection-indicator">
          <span className="selection-check">✓</span>
        </div>
      )}

      {/* Inscription number */}
      <div className="ordinal-card-header">
        {typeof inscription.number === 'number'
          ? `Inscription #${inscription.number}`
          : inscription.id.slice(0, 12) + '...'}
      </div>

      {/* Ordinal media */}
      <div className="ordinal-media-container">
        <OrdinalMedia id={inscription.id} contentType={inscription.content_type} />
      </div>

      {/* Simplified price info - just current value */}
      <div className="ordinal-card-footer">
        {loadingValue ? (
          <div className="price-value-loading">
            <span className="mini-spinner"></span>
            <span>Loading...</span>
          </div>
        ) : hasCurrentPrice ? (
          <div className="price-value-simple">
            {value?.isListed ? 'Listed: ' : 'Est: '}
            {currentPrice.toFixed(6)} BTC
          </div>
        ) : (
          <div className="price-value-unknown">Value unknown</div>
        )}
      </div>
    </div>
  );
}
