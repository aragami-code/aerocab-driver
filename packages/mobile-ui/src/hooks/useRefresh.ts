import { useState, useCallback } from 'react';

/**
 * Pull-to-refresh hook — provides refreshing state and onRefresh handler.
 * Usage: const { refreshing, onRefresh } = useRefresh(loadData);
 *        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
 */
export function useRefresh(refetchFn: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchFn();
    } catch {
      // Error handled by caller
    } finally {
      setRefreshing(false);
    }
  }, [refetchFn]);

  return { refreshing, onRefresh };
}
