import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiOptions {
  /** Skip the initial fetch (manual trigger only) */
  skip?: boolean;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Generic API hook — eliminates the repeated useState(loading)/try-catch/finally pattern.
 *
 * Usage:
 * const { data: drivers, loading, error, refetch } = useApi(() => api.get('/drivers/nearby'));
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  options: UseApiOptions = {},
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!options.skip);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mountedRef.current) {
        setData(result);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err?.message || 'Une erreur est survenue');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetcher]);

  useEffect(() => {
    mountedRef.current = true;
    if (!options.skip) {
      execute();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [execute, options.skip]);

  return { data, loading, error, refetch: execute };
}
