import { useState, useEffect } from 'react';
import { enqueueRequest } from '../utils/apiQueue';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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
    enqueueRequest(fetchValue);

    return () => { cancelled = true; };
  }, [inscriptionId]);

  return { value, loading, error };
}
