import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Network connectivity hook — monitors online/offline status.
 * Used by OfflineBanner and any component that needs to know connectivity.
 */
export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? true);
    });
    return () => unsubscribe();
  }, []);

  return { isConnected };
}
