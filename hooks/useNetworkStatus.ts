import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export type NetworkQuality = 'wifi' | '4g' | '3g' | '2g' | 'offline';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('4g');

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected ?? true;
      setIsOnline(connected);

      if (!connected) {
        setNetworkQuality('offline');
        return;
      }

      const type = state.type;
      if (type === 'wifi' || type === 'ethernet') {
        setNetworkQuality('wifi');
      } else if (type === 'cellular') {
        const gen = (state.details as any)?.cellularGeneration;
        if (gen === '4g') setNetworkQuality('4g');
        else if (gen === '3g') setNetworkQuality('3g');
        else setNetworkQuality('2g');
      } else {
        setNetworkQuality('4g');
      }
    });
    return () => unsubscribe();
  }, []);

  return { isOnline, networkQuality };
}
