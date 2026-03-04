import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  trigger: any;
}

class NotificationService {
  private registeredToken: string | null = null;
  private scheduledNotifications: ScheduledNotification[] = [];

  async registerForPushNotifications(): Promise<string | null> {
    try {
      // Check if device has the necessary permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Failed to get notification permissions');
        return null;
      }

      // Get the push token
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      this.registeredToken = token;

      // Cache the token
      await AsyncStorage.setItem('expoPushToken', token);

      // Set notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      return token;
    } catch (error) {
      console.error('Error registering for notifications:', error);
      return null;
    }
  }

  async scheduleDailyReminder(taskCount: number, hour: number = 9, minute: number = 0): Promise<string | null> {
    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Daily Task Reminder',
          body: `You have ${taskCount} tasks scheduled for today`,
          sound: 'default',
          badge: taskCount,
        },
        trigger: {
          hour,
          minute,
          repeats: true,
        },
      });

      const notification: ScheduledNotification = {
        id: notificationId,
        title: 'Daily Task Reminder',
        body: `You have ${taskCount} tasks scheduled for today`,
        trigger: { hour, minute, repeats: true },
      };

      this.scheduledNotifications.push(notification);
      await this.cacheNotifications();

      return notificationId;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  async handleLeaderboardChange(newRank: number, previousRank: number): Promise<void> {
    try {
      let message = '';
      let title = '';

      if (newRank < previousRank) {
        const improvement = previousRank - newRank;
        title = 'You moved up!';
        message = `You climbed ${improvement} position${improvement > 1 ? 's' : ''} on the leaderboard!`;
      } else if (newRank > previousRank) {
        const drop = newRank - previousRank;
        title = 'Leaderboard Update';
        message = `You dropped ${drop} position${drop > 1 ? 's' : ''} on the leaderboard`;
      } else {
        return; // No rank change
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body: message,
          sound: 'default',
        },
        trigger: { seconds: 2 },
      });
    } catch (error) {
      console.error('Error handling leaderboard notification:', error);
    }
  }

  async handleManagerMessage(
    managerName: string,
    message: string
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Message from ${managerName}`,
          body: message.substring(0, 100),
          sound: 'default',
        },
        trigger: { seconds: 1 },
      });
    } catch (error) {
      console.error('Error handling manager notification:', error);
    }
  }

  async scheduleLowBatteryWarning(): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Low Battery Warning',
          body: 'GPS tracking is consuming battery. Consider charging your device soon.',
          sound: 'default',
        },
        trigger: { seconds: 5 },
      });
    } catch (error) {
      console.error('Error scheduling battery warning:', error);
    }
  }

  async scheduleVisitReminder(
    customerName: string,
    visitTime: string
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Upcoming Visit',
          body: `Visit to ${customerName} at ${visitTime}`,
          sound: 'default',
        },
        trigger: { seconds: 10 },
      });
    } catch (error) {
      console.error('Error scheduling visit reminder:', error);
    }
  }

  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);

      this.scheduledNotifications = this.scheduledNotifications.filter(
        (n) => n.id !== notificationId
      );
      await this.cacheNotifications();
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      this.scheduledNotifications = [];
      await AsyncStorage.removeItem('scheduledNotifications');
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  }

  async getRegisteredToken(): Promise<string | null> {
    if (this.registeredToken) {
      return this.registeredToken;
    }

    try {
      const cached = await AsyncStorage.getItem('expoPushToken');
      if (cached) {
        this.registeredToken = cached;
      }
    } catch (error) {
      console.error('Error retrieving cached token:', error);
    }

    return this.registeredToken;
  }

  private async cacheNotifications(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        'scheduledNotifications',
        JSON.stringify(this.scheduledNotifications)
      );
    } catch (error) {
      console.error('Error caching notifications:', error);
    }
  }
}

export const notificationService = new NotificationService();
