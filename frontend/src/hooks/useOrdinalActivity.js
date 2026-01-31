import { useState, useEffect } from 'react';
import { enqueueRequest } from '../utils/apiQueue';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

/**
 * Hook to fetch activity/transaction history for an ordinal inscription
 * Returns the last purchase price and activity history
 * Uses a queue system to prevent rate limiting
 */
export function useOrdinalActivity(inscriptionId) {
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!inscriptionId) return;

    let cancelled = false;
    setLoading(true);

    async function fetchActivity() {
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE}/api/ordinal-activity/${encodeURIComponent(inscriptionId)}`,
          { headers: { Accept: 'application/json' } }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch activity: ${response.status}`);
        }

        const data = await response.json();

        if (!cancelled) {
          setActivity(data);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn(`Could not fetch activity for ${inscriptionId}:`, err.message);
          setError(err.message);
          // Set empty activity on error (graceful degradation)
          setActivity({
            id: inscriptionId,
            activities: [],
            lastPurchasePrice: null,
            lastPurchaseDate: null,
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    // Add to queue instead of fetching immediately
    enqueueRequest(fetchActivity);

    return () => {
      cancelled = true;
    };
  }, [inscriptionId]);

  return { activity, loading, error };
}
