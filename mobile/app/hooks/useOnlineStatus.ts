import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface OnlineStatus {
  isOnline: boolean;
  connectionType: string;
  lastOnlineAt: number;
}

export function useOnlineStatus(): OnlineStatus {
  const [status, setStatus] = useState<OnlineStatus>({
    isOnline: true,
    connectionType: 'unknown',
    lastOnlineAt: Date.now(),
  });

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initializeNetInfo = async () => {
      // Get initial state
      const state = await NetInfo.fetch();
      setStatus({
        isOnline: state.isConnected === true,
        connectionType: getConnectionType(state),
        lastOnlineAt: state.isConnected === true ? Date.now() : status.lastOnlineAt,
      });

      // Subscribe to changes
      unsubscribe = NetInfo.addEventListener((state) => {
        const isOnline = state.isConnected === true;

        setStatus((prevStatus) => ({
          isOnline,
          connectionType: getConnectionType(state),
          lastOnlineAt: isOnline ? Date.now() : prevStatus.lastOnlineAt,
        }));
      });
    };

    initializeNetInfo();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return status;
}

function getConnectionType(state: NetInfoState): string {
  if (state.type === 'wifi') {
    return 'WiFi';
  } else if (state.type === 'cellular') {
    return state.details?.cellularGeneration || 'Cellular';
  } else if (state.type === 'bluetooth') {
    return 'Bluetooth';
  } else if (state.type === 'ethernet') {
    return 'Ethernet';
  } else if (state.type === 'none') {
    return 'Offline';
  }

  return 'Unknown';
}
