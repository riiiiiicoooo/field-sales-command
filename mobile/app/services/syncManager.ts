import NetInfo from '@react-native-community/netinfo';
import { AppDispatch, RootState } from '../store/store';
import { supabaseClient, subscribeToTableChanges } from './supabaseClient';
import { offlineQueue } from './offlineQueue';

interface SyncConfig {
  store: any;
  dispatch: AppDispatch;
}

class SyncManager {
  private isOnline = false;
  private subscriptions: any[] = [];
  private netInfoUnsubscribe?: () => void;
  private config: SyncConfig | null = null;

  async initialize(config: SyncConfig) {
    this.config = config;

    // Listen for network changes
    this.netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected === true;

      if (!wasOnline && this.isOnline) {
        this.onOnline();
      } else if (wasOnline && !this.isOnline) {
        this.onOffline();
      }
    });

    // Set initial online state
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected === true;

    // Subscribe to realtime changes
    this.subscribeToRealtimeChanges();
  }

  private subscribeToRealtimeChanges() {
    if (!this.config) return;

    // Subscribe to customer changes
    const customerSub = subscribeToTableChanges(
      'customers',
      (payload) => this.handleCustomerInsert(payload),
      (payload) => this.handleCustomerUpdate(payload),
      (payload) => this.handleCustomerDelete(payload)
    );
    this.subscriptions.push(customerSub);

    // Subscribe to leaderboard changes
    const leaderboardSub = subscribeToTableChanges(
      'leaderboard',
      undefined,
      (payload) => this.handleLeaderboardUpdate(payload)
    );
    this.subscriptions.push(leaderboardSub);
  }

  private async onOnline() {
    console.log('Device is online');

    if (!this.config) return;

    // Process offline queue
    await this.processOfflineQueue();

    // Refresh critical data
    this.refreshData();
  }

  private onOffline() {
    console.log('Device is offline');
  }

  private async processOfflineQueue() {
    if (!this.config) return;

    const processed = await offlineQueue.processQueue(async (operation) => {
      try {
        switch (operation.type) {
          case 'create_visit':
            await supabaseClient.from('visits').insert([operation.payload]);
            return true;

          case 'update_customer':
            await supabaseClient
              .from('customers')
              .update(operation.payload.updates)
              .eq('id', operation.payload.customerId);
            return true;

          case 'complete_task':
            await supabaseClient
              .from('tasks')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                completion_notes: operation.payload.notes,
              })
              .eq('id', operation.payload.taskId);
            return true;

          default:
            return false;
        }
      } catch (error) {
        console.error('Error processing operation:', error);
        return false;
      }
    });

    console.log(`Processed ${processed} offline operations`);
  }

  private refreshData() {
    if (!this.config) return;

    // Refresh customers
    // dispatch(fetchCustomers());

    // Refresh tasks
    // dispatch(fetchTasks());

    // Refresh leaderboard
    // dispatch(fetchLeaderboard());
  }

  private handleCustomerInsert(payload: any) {
    // Handle new customer
    console.log('Customer inserted:', payload);
  }

  private handleCustomerUpdate(payload: any) {
    // Handle customer update
    console.log('Customer updated:', payload);
  }

  private handleCustomerDelete(payload: any) {
    // Handle customer deletion
    console.log('Customer deleted:', payload);
  }

  private handleLeaderboardUpdate(payload: any) {
    if (!this.config) return;

    // Update leaderboard state
    // dispatch(updateLeaderboard(payload));
    console.log('Leaderboard updated:', payload);
  }

  async resolveConflict(serverData: any, localData: any): Promise<any> {
    // Server wins strategy
    return serverData;
  }

  async cleanup() {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
    }

    for (const subscription of this.subscriptions) {
      if (subscription) {
        supabaseClient.removeChannel(subscription);
      }
    }

    this.subscriptions = [];
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  async getQueueStats() {
    const size = await offlineQueue.getQueueSize();
    return { queueSize: size, isOnline: this.isOnline };
  }
}

export const syncManager = new SyncManager();
