import { useState, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Global queue to prevent too many simultaneous requests to Magic Eden API
let requestQueue = [];
let activeRequests = 0;
const MAX_CONCURRENT = 3; // Only 3 concurrent requests at a time
const DELAY_BETWEEN_REQUESTS = 500; // 500ms delay between batches

function processQueue() {
  if (activeRequests >= MAX_CONCURRENT || requestQueue.length === 0) {
    return;
  }
  const nextRequest = requestQueue.shift();
  if (nextRequest) {
    activeRequests++;
    nextRequest().finally(() => {
      activeRequests--;
      setTimeout(processQueue, DELAY_BETWEEN_REQUESTS);
    });
  }
}

/**
 * Hook to fetch current market value for an ordinal
 * Returns current listing price and collection floor price
 */
export function useOrdinalValue(inscriptionId) {
  const [value, setValue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!inscriptionId) return;
    let cancelled = false;
    setLoading(true);

    async function fetchValue() {
      setError(null);
      try {
        const response = await fetch(
          `${API_BASE}/api/ordinal-value/${encodeURIComponent(inscriptionId)}`,
          { headers: { Accept: 'application/json' } }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!cancelled) setValue(data);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setValue({
            id: inscriptionId,
            currentPrice: null,
            floorPrice: null,
            collectionId: null,
            isListed: false,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Add to queue instead of fetching immediately
    requestQueue.push(fetchValue);
    processQueue();

    return () => { cancelled = true; };
  }, [inscriptionId]);

  return { value, loading, error };
}
