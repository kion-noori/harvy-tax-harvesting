import React, { useEffect, useState, useCallback } from 'react';
import OrdinalPriceCard from './OrdinalPriceCard';
import TaxReportSummary from './TaxReportSummary';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Taproot addresses start with bc1p and are typically 62 chars but can vary
const isTaproot = (s) => {
  const trimmed = (s || '').trim();
  // Must start with bc1p, followed by valid bech32 characters (0-9 and a-z except b,i,o)
  // Length: 62-90 characters total
  return /^bc1p[0-9a-z]{58,86}$/i.test(trimmed);
};

export default function OrdinalList({ btcAddress: connectedAddress }) {
  const [address, setAddress] = useState(connectedAddress || '');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [displayCount, setDisplayCount] = useState(12); // Start with 12 items
  const [excludeBrc20, setExcludeBrc20] = useState(true); // Filter BRC-20 by default
  const [totalInscriptions, setTotalInscriptions] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 12;
  const API_PAGE_SIZE = 60;

  // Track activity and value data for tax reporting
  const [activityData, setActivityData] = useState({});
  const [valueData, setValueData] = useState({});
  const [showTaxReport, setShowTaxReport] = useState(false);

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
        return;
      }

      // Update items - append if loading more, replace if fresh load
      setItems(prev => append ? [...prev, ...itemsArray] : itemsArray);
      setTotalInscriptions(data.total || 0);
      setCurrentOffset(offset + itemsArray.length);
      setHasMore(offset + API_PAGE_SIZE < (data.total || 0));

      if (!append) {
        setDisplayCount(ITEMS_PER_PAGE); // Reset to first page on fresh load
      }

      // Show helpful message if no results
      if (itemsArray.length === 0 && !append) {
        console.log('No ordinals found for address:', a);
      } else {
        console.log(`✅ Loaded ${itemsArray.length} ordinals (total: ${data.total || itemsArray.length})`);
        if (excludeBrc20 && itemsArray.length === 0) {
          console.log('ℹ️ No image/video ordinals found in this batch. Try loading more pages.');
        }
      }
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
    } finally {
      setLoading(false);
    }
  }, [address, excludeBrc20]);

  // Auto-load when address comes from wallet/connect or filter changes
  useEffect(() => {
    if (isTaproot(address)) load();
  }, [address, excludeBrc20, load]);

  return (
    <div style={{ maxWidth: 880 }}>
      <form
        onSubmit={(e) => { e.preventDefault(); load(); }}
        style={{ display: 'flex', gap: 8, marginBottom: 12 }}
      >
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="bc1p… (owner address)"
          style={{ flex: 1, padding: 10, borderRadius: 8 }}
        />
        <button
          type="submit"
          style={{
            padding: '12px 24px',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #F7931A 0%, #FF6B35 100%)',
            border: 'none',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(247, 147, 26, 0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(247, 147, 26, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(247, 147, 26, 0.3)';
          }}
        >
          Load Ordinals
        </button>
      </form>

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

      {loading && (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#aaa',
          fontSize: '14px'
        }}>
          <div style={{ marginBottom: '10px' }}>⏳ Loading ordinals...</div>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>This may take a few moments</div>
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

      {/* Tax Report Summary - Show when items are loaded */}
      {!loading && items.length > 0 && showTaxReport && (
        <TaxReportSummary
          ordinals={items}
          activityData={activityData}
          valueData={valueData}
        />
      )}

      {/* Tax Report Toggle Button */}
      {!loading && items.length > 0 && (
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <button
            onClick={() => setShowTaxReport(!showTaxReport)}
            style={{
              padding: '14px 32px',
              borderRadius: '8px',
              background: showTaxReport
                ? 'rgba(247, 147, 26, 0.15)'
                : 'linear-gradient(135deg, #F7931A 0%, #FF6B35 100%)',
              border: showTaxReport ? '2px solid rgba(247, 147, 26, 0.4)' : 'none',
              color: showTaxReport ? '#F7931A' : 'white',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: showTaxReport
                ? 'none'
                : '0 4px 12px rgba(247, 147, 26, 0.3)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!showTaxReport) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(247, 147, 26, 0.4)';
              } else {
                e.currentTarget.style.background = 'rgba(247, 147, 26, 0.25)';
                e.currentTarget.style.borderColor = '#F7931A';
              }
            }}
            onMouseLeave={(e) => {
              if (!showTaxReport) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(247, 147, 26, 0.3)';
              } else {
                e.currentTarget.style.background = 'rgba(247, 147, 26, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(247, 147, 26, 0.4)';
              }
            }}
          >
            {showTaxReport ? '📊 Hide Tax Report' : '📊 View Tax Loss Report'}
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {items.slice(0, displayCount).map((it) => (
          <OrdinalPriceCard
            key={it.id}
            inscription={it}
            onActivityData={(data) => {
              setActivityData(prev => ({ ...prev, [it.id]: data }));
            }}
            onValueData={(data) => {
              setValueData(prev => ({ ...prev, [it.id]: data }));
            }}
          />
        ))}
      </div>

      {/* Load More Display button */}
      {!loading && items.length > displayCount && (
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button
            onClick={() => setDisplayCount(prev => prev + ITEMS_PER_PAGE)}
            style={{
              padding: '12px 32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #F7931A 0%, #FF6B35 100%)',
              border: 'none',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(247, 147, 26, 0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(247, 147, 26, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(247, 147, 26, 0.3)';
            }}
          >
            Show More ({items.length - displayCount} loaded)
          </button>
        </div>
      )}

      {/* Load More from API button */}
      {!loading && hasMore && items.length > 0 && displayCount >= items.length && (
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            onClick={() => load(currentOffset, true)}
            style={{
              padding: '12px 32px',
              borderRadius: '8px',
              background: 'rgba(247, 147, 26, 0.15)',
              border: '2px solid rgba(247, 147, 26, 0.4)',
              color: '#F7931A',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(247, 147, 26, 0.25)';
              e.currentTarget.style.borderColor = '#F7931A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(247, 147, 26, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(247, 147, 26, 0.4)';
            }}
          >
            Fetch Next Page from API
          </button>
        </div>
      )}

      {/* No results message for filtered searches */}
      {!loading && items.length === 0 && excludeBrc20 && hasMore && (
        <div style={{
          textAlign: 'center',
          marginTop: '16px',
          padding: '16px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          color: '#aaa'
        }}>
          <div style={{ marginBottom: '8px' }}>No image/video ordinals found in the first page.</div>
          <div style={{ fontSize: '13px', opacity: 0.8 }}>
            Your actual ordinals might be in later pages. Try fetching more:
          </div>
          <button
            onClick={() => load(currentOffset, true)}
            style={{
              marginTop: '12px',
              padding: '12px 28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #F7931A 0%, #FF6B35 100%)',
              border: 'none',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(247, 147, 26, 0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(247, 147, 26, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(247, 147, 26, 0.3)';
            }}
          >
            Fetch Next Page
          </button>
        </div>
      )}

      {/* Show total count */}
      {!loading && items.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '16px', color: '#888', fontSize: '14px' }}>
          Showing {Math.min(displayCount, items.length)} of {items.length} loaded
          {totalInscriptions > 0 && ` (${totalInscriptions} total inscriptions)`}
        </div>
      )}
    </div>
  );
}
