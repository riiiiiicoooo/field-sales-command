import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { syncManager } from './services/syncManager';
import { notificationService } from './services/notificationService';
import RootNavigator from './navigation/RootNavigator';

export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize notification service
        await notificationService.registerForPushNotifications();

        // Initialize sync manager
        await syncManager.initialize({
          store: null,
          dispatch,
        });

        // Schedule daily task reminder at 9 AM
        await notificationService.scheduleDailyReminder(0, 9, 0);
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };

    initializeApp();

    return () => {
      syncManager.cleanup();
    };
  }, [dispatch]);

  return <RootNavigator />;
}
