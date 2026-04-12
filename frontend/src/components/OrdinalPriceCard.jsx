import React from 'react';
import OrdinalMedia from './OrdinalMedia';

/**
 * Card component that displays an ordinal in a gallery view
 * Shows media and inscription number
 * Click to select for bulk selling
 */
export default function OrdinalPriceCard({ inscription, isSelected, onSelect }) {
  const title = inscription.display_name || inscription.collection_name || 'Untitled inscription';
  const collection = inscription.collection_name || 'Uncategorized';

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

      <div className="ordinal-card-meta">
        <div className="ordinal-card-title" title={title}>
          {title}
        </div>
        <div className="ordinal-card-collection" title={collection}>
          {collection}
        </div>
      </div>

      {/* Ordinal media */}
      <div className="ordinal-media-container">
        <OrdinalMedia id={inscription.id} contentType={inscription.content_type} contentUri={inscription.content_uri} previewUri={inscription.preview_uri} offchainImage={inscription.offchain_image} collectionName={inscription.collection_name} />
      </div>

      {/* Click to select hint */}
      <div className="ordinal-card-footer">
        <div className="card-select-hint">
          {isSelected ? 'Selected' : 'Click to select'}
        </div>
      </div>
    </div>
  );
}
