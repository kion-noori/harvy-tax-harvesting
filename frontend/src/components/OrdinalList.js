import React, { useEffect, useState, useCallback } from 'react';
import OrdinalPriceCard from './OrdinalPriceCard';
import SellModal from './SellModal';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Taproot addresses start with bc1p and are typically 62 chars but can vary
const isTaproot = (s) => {
  const trimmed = (s || '').trim();
  // Must start with bc1p, followed by valid bech32 characters (0-9 and a-z except b,i,o)
  // Length: 62-90 characters total
  return /^bc1p[0-9a-z]{58,86}$/i.test(trimmed);
};

export default function OrdinalList({ btcAddress: connectedAddress, walletType }) {
  const [address, setAddress] = useState(connectedAddress || '');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [displayCount, setDisplayCount] = useState(24); // Start with 24 items
  const [excludeBrc20, setExcludeBrc20] = useState(true); // Filter BRC-20 by default
  const [totalInscriptions, setTotalInscriptions] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 24;

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Sell modal state - now handles multiple ordinals
  const [showSellModal, setShowSellModal] = useState(false);

  // Handle ordinal selection toggle
  const handleSelectOrdinal = (inscriptionId) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(inscriptionId)) {
        newSet.delete(inscriptionId);
      } else {
        newSet.add(inscriptionId);
      }
      return newSet;
    });
  };

  // Clear all selections
  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Open sell modal with selected ordinals
  const handleSellSelected = () => {
    if (selectedIds.size > 0) {
      setShowSellModal(true);
    }
  };

  // Handle modal close
  const handleCloseModal = () => {
    setShowSellModal(false);
  };

  // Handle successful sale - remove sold items from selection
  const handleSaleComplete = (soldInscriptionIds) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      soldInscriptionIds.forEach(id => newSet.delete(id));
      return newSet;
    });
    setShowSellModal(false);
  };

  // Get selected ordinal items
  const getSelectedOrdinals = () => {
    return items
      .filter(item => selectedIds.has(item.id))
      .map(item => ({
        inscription: item,
      }));
  };

  // Keep in sync with wallet connection (no auto-load from storage)
  useEffect(() => {
    if (connectedAddress && connectedAddress !== address) {
      setAddress(connectedAddress);
      return;
    }
    // Do NOT auto-load from localStorage - require explicit wallet connection
  }, [connectedAddress, address]);

  const load = useCallback(async (offset = 0, append = false) => {
    const a = (address || '').trim();
    if (!a) {
      setErr('Please enter a Taproot owner address (starts with bc1p...)');
      return;
    }
    if (!isTaproot(a)) {
      setErr('Invalid address format. Taproot addresses must start with bc1p... and contain only valid characters.');
      return;
    }

    setLoading(true);
    setErr(null);
    if (!append) {
      setItems([]); // Clear previous results only on fresh load
      setCurrentOffset(0);
      setSelectedIds(new Set()); // Clear selections on new load
    }

    try {
      const url = `${API_BASE}/api/ordinals?address=${encodeURIComponent(a)}&offset=${offset}&excludeBrc20=${excludeBrc20}`;
      console.log('→ Fetching ordinals from:', url);

      const r = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!r.ok) {
        let msg = `HTTP ${r.status}`;
        try {
          const j = await r.json();
          if (j && j.error) {
            msg = j.error;
            // Include details for debugging if available
            if (j.details && process.env.NODE_ENV === 'development') {
              console.error('Error details:', j.details);
            }
          }
        } catch (parseErr) {
          console.error('Failed to parse error response:', parseErr);
        }
        throw new Error(msg);
      }

      const data = await r.json();

      // Handle new response format with items array
      const itemsArray = data.items || data;
      if (!Array.isArray(itemsArray)) {
        console.warn('Unexpected response format:', data);
        setItems([]);
        setErr('Received invalid data format from server');
        setLoading(false);
        return;
      }

      // Update items - use functional setState to avoid dependency issues
      setItems(prevItems => append ? [...prevItems, ...itemsArray] : itemsArray);
      setTotalInscriptions(data.total || 0);
      const newOffset = offset + itemsArray.length;
      setCurrentOffset(newOffset);
      const more = newOffset < (data.total || 0);
      setHasMore(more);

      if (!append) {
        setDisplayCount(ITEMS_PER_PAGE); // Reset to first page on fresh load
      }

      setLoading(false);
    } catch (e) {
      console.error('Ordinals fetch error:', e);

      // Better error messages for common issues
      if (e.name === 'AbortError' || e.message.includes('timeout')) {
        setErr('Request timed out. The server may be slow or unavailable. Please try again.');
      } else if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
        setErr('Network error. Please check your internet connection and try again.');
      } else {
        setErr(e.message || 'Failed to fetch ordinals');
      }
      if (!append) setItems([]);
      setLoading(false);
    }
  }, [address, excludeBrc20]);

  // Auto-load when address comes from wallet/connect or filter changes
  useEffect(() => {
    if (isTaproot(address)) load();
  }, [address, excludeBrc20, load]);

  // Infinite scroll: Load more when user scrolls near bottom
  useEffect(() => {
    const handleScroll = () => {
      const scrolledToBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 500;
      const hasMoreToDisplay = items.length > displayCount;
      const needsMoreData = hasMore && currentOffset < totalInscriptions;

      if (scrolledToBottom && !loading) {
        // Case 1: We have items loaded but not displayed yet - just increase display count
        if (hasMoreToDisplay) {
          setDisplayCount(prev => Math.min(prev + ITEMS_PER_PAGE, items.length));
        }
        // Case 2: We've displayed everything but need to fetch more from API
        else if (needsMoreData) {
          setDisplayCount(prev => prev + ITEMS_PER_PAGE);
          load(currentOffset, true);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, hasMore, currentOffset, load, items.length, displayCount, totalInscriptions]);

  // Get ordinals to display
  const itemsToDisplay = React.useMemo(() => {
    return items.slice(0, displayCount);
  }, [items, displayCount]);

  // Show message if no wallet connected
  if (!address || !isTaproot(address)) {
    return (
      <div style={{
        maxWidth: '600px',
        margin: '80px auto',
        padding: '40px',
        textAlign: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔌</div>
        <h2 style={{ color: '#fff', marginBottom: '12px', fontSize: '24px' }}>No Wallet Connected</h2>
        <p style={{ color: '#aaa', fontSize: '16px', lineHeight: '1.6' }}>
          Connect your Xverse wallet using the button in the top right to view your Ordinals portfolio.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '100%', padding: '0 20px' }}>
      {/* Selection info bar */}
      {selectedIds.size > 0 && (
        <div style={{
          marginBottom: 16,
          padding: '12px 16px',
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(22, 163, 74, 0.05))',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ color: '#22c55e', fontWeight: 600 }}>
            {selectedIds.size} ordinal{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleClearSelection}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#aaa',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* BRC-20 Filter Toggle */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#aaa' }}>
          <input
            type="checkbox"
            checked={excludeBrc20}
            onChange={(e) => setExcludeBrc20(e.target.checked)}
          />
          <span>Hide BRC-20 tokens (show only images/videos)</span>
        </label>
      </div>

      {/* How it works - onboarding section */}
      {!loading && items.length > 0 && selectedIds.size === 0 && (
        <div className="onboarding-section">
          <h3 className="onboarding-title">How to Harvest Tax Losses</h3>
          <div className="onboarding-steps">
            <div className="onboarding-step">
              <div className="step-number">1</div>
              <div className="step-content">
                <strong>Select ordinals</strong>
                <span>Click on any ordinal below to select it</span>
              </div>
            </div>
            <div className="onboarding-step">
              <div className="step-number">2</div>
              <div className="step-content">
                <strong>Enter purchase prices</strong>
                <span>Tell us what you paid for each one</span>
              </div>
            </div>
            <div className="onboarding-step">
              <div className="step-number">3</div>
              <div className="step-content">
                <strong>Sell to Harvy</strong>
                <span>We buy them, you get the tax write-off</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && items.length === 0 && (
        <div style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: '#aaa',
          fontSize: '14px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid rgba(247, 147, 26, 0.2)',
            borderTopColor: '#F7931A',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <div style={{ marginBottom: '10px', fontSize: '16px' }}>Loading your ordinals...</div>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>
            This may take a few moments
          </div>
        </div>
      )}

      {/* Loading more indicator (shows at bottom when scrolling) */}
      {loading && items.length > 0 && (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#F7931A',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            border: '3px solid rgba(247, 147, 26, 0.2)',
            borderTopColor: '#F7931A',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }}></div>
          <span>Loading more...</span>
        </div>
      )}

      {err && (
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          color: '#ff6b6b',
          marginBottom: '16px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>⚠️ Error</div>
          <div>{String(err)}</div>
        </div>
      )}

      {!loading && !err && isTaproot(address) && !items.length && (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#888',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>📭 No inscriptions found</div>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>
            This address doesn't have any Bitcoin Ordinals yet.
          </div>
        </div>
      )}

      {/* Render ordinals grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {itemsToDisplay.map((it) => (
          <OrdinalPriceCard
            key={it.id}
            inscription={it}
            isSelected={selectedIds.has(it.id)}
            onSelect={handleSelectOrdinal}
          />
        ))}
      </div>

      {/* End of results message */}
      {!loading && items.length > 0 && !hasMore && displayCount >= items.length && (
        <div style={{
          textAlign: 'center',
          marginTop: '32px',
          padding: '20px',
          color: '#888',
          fontSize: '14px',
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ marginBottom: '8px', fontSize: '16px' }}>✓ All ordinals loaded</div>
          <div>
            Showing all {totalInscriptions} inscriptions
          </div>
        </div>
      )}

      {/* Scroll for more hint */}
      {!loading && items.length > 0 && (items.length > displayCount || hasMore) && (
        <div style={{
          textAlign: 'center',
          marginTop: '24px',
          padding: '16px',
          color: '#888',
          fontSize: '13px',
          fontStyle: 'italic'
        }}>
          Scroll down to load more... (showing {displayCount} of {totalInscriptions})
        </div>
      )}

      {/* Floating Sell Selected Button */}
      {selectedIds.size > 0 && (
        <div className="sell-selected-container">
          <button className="sell-selected-btn" onClick={handleSellSelected}>
            <span>Sell Selected</span>
            <span className="sell-selected-count">{selectedIds.size}</span>
          </button>
        </div>
      )}

      {/* Sell Modal - now with multiple ordinals */}
      {showSellModal && (
        <SellModal
          selectedOrdinals={getSelectedOrdinals()}
          btcAddress={address}
          walletType={walletType}
          onClose={handleCloseModal}
          onSaleComplete={handleSaleComplete}
        />
      )}
    </div>
  );
}
