import NetInfo from '@react-native-community/netinfo';
import { AppDispatch, RootState } from '../store/store';
import { supabaseClient, subscribeToTableChanges } from './supabaseClient';
import { offlineQueue } from './offlineQueue';
import { fetchCustomers, updateCustomer } from '../store/customerSlice';
import { fetchTasks } from '../store/taskSlice';
import { fetchLeaderboard } from '../store/leaderboardSlice';

interface SyncConfig {
  store: { getState: () => RootState };
  dispatch: AppDispatch;
}

interface ConflictResolutionResult {
  resolved: 'server' | 'client' | 'merged';
  data: any;
}

/**
 * SyncManager orchestrates offline-first data synchronization.
 *
 * Responsibilities:
 * - Monitor network connectivity via NetInfo
 * - Process queued offline operations when connectivity returns
 * - Subscribe to Supabase Realtime channels for live data updates
 * - Resolve conflicts between local and server state using timestamp comparison
 * - Refresh stale data after reconnection
 */
class SyncManager {
  private isOnline = false;
  private subscriptions: any[] = [];
  private netInfoUnsubscribe?: () => void;
  private config: SyncConfig | null = null;
  private syncInProgress = false;
  private lastSyncTimestamp: number = 0;
  private readonly STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

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

    // If online at launch, do an initial data refresh
    if (this.isOnline) {
      this.refreshData();
    }
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

    // Subscribe to task changes
    const taskSub = subscribeToTableChanges(
      'tasks',
      (payload) => this.handleTaskInsert(payload),
      (payload) => this.handleTaskUpdate(payload)
    );
    this.subscriptions.push(taskSub);
  }

  private async onOnline() {
    console.log('[SyncManager] Device is online — starting sync cycle');

    if (!this.config) return;

    // Process offline queue first (local changes take priority)
    await this.processOfflineQueue();

    // Then refresh data from server if stale
    const timeSinceLastSync = Date.now() - this.lastSyncTimestamp;
    if (timeSinceLastSync > this.STALE_THRESHOLD_MS) {
      await this.refreshData();
    }

    this.lastSyncTimestamp = Date.now();
  }

  private onOffline() {
    console.log('[SyncManager] Device is offline — queuing operations locally');
  }

  private async processOfflineQueue() {
    if (!this.config || this.syncInProgress) return;

    this.syncInProgress = true;

    try {
      // Deduplicate before processing (e.g., multiple updates to same customer)
      await offlineQueue.deduplicateQueue();

      const processed = await offlineQueue.processQueue(async (operation) => {
        try {
          switch (operation.type) {
            case 'create_visit': {
              const { data, error } = await supabaseClient
                .from('visits')
                .insert([operation.payload])
                .select();

              if (error) throw error;

              // After successful visit sync, update local state
              console.log(`[SyncManager] Synced visit: ${data?.[0]?.id}`);
              return true;
            }

            case 'update_customer': {
              // Check for conflicts before applying
              const { data: serverData } = await supabaseClient
                .from('customers')
                .select('*')
                .eq('id', operation.payload.customerId)
                .single();

              if (serverData) {
                const resolution = await this.resolveConflict(
                  serverData,
                  operation.payload.updates,
                  operation.timestamp
                );

                if (resolution.resolved === 'server') {
                  // Server data is newer — skip this update, refresh local
                  console.log(`[SyncManager] Conflict resolved: server wins for customer ${operation.payload.customerId}`);
                  return true; // Mark as processed (server already has newer data)
                }

                // Client or merged data should be applied
                const { error } = await supabaseClient
                  .from('customers')
                  .update(resolution.data)
                  .eq('id', operation.payload.customerId);

                if (error) throw error;
              }

              return true;
            }

            case 'complete_task': {
              const { error } = await supabaseClient
                .from('tasks')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                  completion_notes: operation.payload.notes,
                })
                .eq('id', operation.payload.taskId);

              if (error) throw error;
              return true;
            }

            case 'update_visit': {
              const { error } = await supabaseClient
                .from('visits')
                .update(operation.payload.updates)
                .eq('id', operation.payload.visitId);

              if (error) throw error;
              return true;
            }

            default:
              console.warn(`[SyncManager] Unknown operation type: ${operation.type}`);
              return false;
          }
        } catch (error) {
          console.error(`[SyncManager] Error processing ${operation.type}:`, error);
          return false;
        }
      });

      console.log(`[SyncManager] Processed ${processed} offline operations`);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Refresh all critical data from server.
   * Called after reconnection or when data is stale.
   */
  private async refreshData() {
    if (!this.config) return;
    const { dispatch, store } = this.config;

    try {
      const state = store.getState();
      const currentDivision = state.auth?.user?.division || '';

      // Refresh customers for current division
      if (currentDivision) {
        dispatch(fetchCustomers({ division: currentDivision }));
      }

      // Refresh today's tasks
      dispatch(fetchTasks());

      // Refresh leaderboard with current selection
      const leaderboardState = state.leaderboard;
      dispatch(
        fetchLeaderboard({
          period: leaderboardState?.selectedPeriod || 'week',
          metric: leaderboardState?.selectedMetric || 'visits',
        })
      );

      console.log('[SyncManager] Data refresh dispatched');
    } catch (error) {
      console.error('[SyncManager] Data refresh failed:', error);
    }
  }

  // ── Realtime Event Handlers ──

  private handleCustomerInsert(payload: any) {
    if (!this.config) return;
    const { dispatch, store } = this.config;

    const newCustomer = payload.new;
    if (!newCustomer) return;

    // Refresh customer list for the affected division
    const currentDivision = store.getState().auth?.user?.division;
    if (newCustomer.division === currentDivision) {
      dispatch(fetchCustomers({ division: currentDivision }));
    }

    console.log(`[SyncManager] Customer inserted: ${newCustomer.id}`);
  }

  private handleCustomerUpdate(payload: any) {
    if (!this.config) return;
    const { dispatch, store } = this.config;

    const updatedCustomer = payload.new;
    if (!updatedCustomer) return;

    // Optimistically update the customer in the store
    dispatch(
      updateCustomer({
        customerId: updatedCustomer.id,
        updates: updatedCustomer,
      })
    );

    console.log(`[SyncManager] Customer updated: ${updatedCustomer.id}`);
  }

  private handleCustomerDelete(payload: any) {
    if (!this.config) return;
    const { dispatch, store } = this.config;

    const deletedCustomer = payload.old;
    if (!deletedCustomer) return;

    // Refresh the customer list to remove the deleted customer
    const currentDivision = store.getState().auth?.user?.division;
    if (currentDivision) {
      dispatch(fetchCustomers({ division: currentDivision }));
    }

    console.log(`[SyncManager] Customer deleted: ${deletedCustomer.id}`);
  }

  private handleLeaderboardUpdate(payload: any) {
    if (!this.config) return;
    const { dispatch, store } = this.config;

    // Re-fetch leaderboard with current filters when server pushes an update
    const leaderboardState = store.getState().leaderboard;
    dispatch(
      fetchLeaderboard({
        period: leaderboardState?.selectedPeriod || 'week',
        metric: leaderboardState?.selectedMetric || 'visits',
      })
    );

    console.log('[SyncManager] Leaderboard updated via Realtime');
  }

  private handleTaskInsert(payload: any) {
    if (!this.config) return;
    const { dispatch } = this.config;

    // New task assigned — refresh task list
    dispatch(fetchTasks());
    console.log(`[SyncManager] New task received: ${payload.new?.id}`);
  }

  private handleTaskUpdate(payload: any) {
    if (!this.config) return;
    const { dispatch } = this.config;

    // Task status changed — refresh task list
    dispatch(fetchTasks());
    console.log(`[SyncManager] Task updated: ${payload.new?.id}`);
  }

  // ── Conflict Resolution ──

  /**
   * Resolve conflicts between server and client data using last-write-wins
   * with field-level merging for non-conflicting changes.
   *
   * Strategy:
   * 1. If server updated_at > client operation timestamp → server wins
   * 2. If client operation timestamp > server updated_at → client wins
   * 3. If timestamps are close (within 1s), attempt field-level merge
   */
  async resolveConflict(
    serverData: any,
    clientData: any,
    clientTimestamp?: number
  ): Promise<ConflictResolutionResult> {
    const serverUpdatedAt = serverData.updated_at
      ? new Date(serverData.updated_at).getTime()
      : 0;
    const clientUpdatedAt = clientTimestamp || Date.now();

    // Threshold for "close enough" timestamps (1 second)
    const MERGE_THRESHOLD_MS = 1000;
    const timeDiff = Math.abs(serverUpdatedAt - clientUpdatedAt);

    if (timeDiff < MERGE_THRESHOLD_MS) {
      // Timestamps are close — attempt field-level merge
      const merged = { ...serverData };
      for (const [key, value] of Object.entries(clientData)) {
        if (key === 'id' || key === 'created_at' || key === 'updated_at') continue;

        // Only apply client changes for fields that differ
        if (serverData[key] !== value && value !== undefined) {
          merged[key] = value;
        }
      }
      merged.updated_at = new Date().toISOString();

      return { resolved: 'merged', data: merged };
    }

    if (serverUpdatedAt > clientUpdatedAt) {
      // Server data is newer
      return { resolved: 'server', data: serverData };
    }

    // Client data is newer
    return {
      resolved: 'client',
      data: { ...clientData, updated_at: new Date().toISOString() },
    };
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

  isSyncing(): boolean {
    return this.syncInProgress;
  }

  async getQueueStats() {
    const size = await offlineQueue.getQueueSize();
    return {
      queueSize: size,
      isOnline: this.isOnline,
      isSyncing: this.syncInProgress,
      lastSyncTimestamp: this.lastSyncTimestamp,
    };
  }

  /**
   * Force a full data refresh regardless of staleness.
   * Useful for pull-to-refresh gestures.
   */
  async forceRefresh() {
    if (!this.isOnline) {
      console.log('[SyncManager] Cannot force refresh while offline');
      return;
    }

    await this.refreshData();
    this.lastSyncTimestamp = Date.now();
  }
}

export const syncManager = new SyncManager();
