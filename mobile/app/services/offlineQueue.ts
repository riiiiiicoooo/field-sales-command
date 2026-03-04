import AsyncStorage from '@react-native-async-storage/async-storage';

interface QueueOperation {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  clientId: string;
  retries: number;
  lastRetry?: number;
  synced: boolean;
}

const QUEUE_STORAGE_KEY = 'offline_queue';
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;
const MAX_QUEUE_SIZE = 100;

class OfflineQueueManager {
  private queue: QueueOperation[] = [];
  private processing = false;

  constructor() {
    this.loadQueue();
  }

  async loadQueue() {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      this.queue = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load queue:', error);
      this.queue = [];
    }
  }

  async addOperation(type: string, payload: any): Promise<string> {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      throw new Error('Queue is full');
    }

    const operation: QueueOperation = {
      id: `${Date.now()}_${Math.random()}`,
      type,
      payload,
      timestamp: Date.now(),
      clientId: payload.client_id || `client_${Date.now()}`,
      retries: 0,
      synced: false,
    };

    this.queue.push(operation);
    await this.saveQueue();

    return operation.id;
  }

  async processQueue(
    onOperation: (operation: QueueOperation) => Promise<boolean>
  ): Promise<number> {
    if (this.processing || this.queue.length === 0) {
      return 0;
    }

    this.processing = true;
    let processedCount = 0;

    try {
      for (let i = 0; i < this.queue.length; i++) {
        const operation = this.queue[i];

        if (operation.synced) {
          continue;
        }

        // Check if we should retry based on backoff
        if (operation.lastRetry) {
          const backoff = this.getExponentialBackoff(operation.retries);
          const timeSinceLastRetry = Date.now() - operation.lastRetry;
          if (timeSinceLastRetry < backoff) {
            continue;
          }
        }

        try {
          const success = await onOperation(operation);

          if (success) {
            operation.synced = true;
            processedCount++;
          } else {
            operation.retries++;
            operation.lastRetry = Date.now();

            if (operation.retries >= MAX_RETRIES) {
              console.warn(`Operation ${operation.id} exceeded max retries`);
              operation.synced = false;
            }
          }
        } catch (error) {
          operation.retries++;
          operation.lastRetry = Date.now();

          if (operation.retries >= MAX_RETRIES) {
            console.error(`Operation ${operation.id} failed:`, error);
            operation.synced = false;
          }
        }
      }

      // Remove synced operations
      this.queue = this.queue.filter((op) => !op.synced);
      await this.saveQueue();
    } finally {
      this.processing = false;
    }

    return processedCount;
  }

  private getExponentialBackoff(retries: number): number {
    return INITIAL_BACKOFF_MS * Math.pow(2, retries);
  }

  async deduplicateQueue(): Promise<void> {
    const seen = new Map<string, QueueOperation>();

    for (const operation of this.queue) {
      const key = `${operation.clientId}_${operation.type}`;

      if (seen.has(key)) {
        const existing = seen.get(key)!;
        if (operation.timestamp > existing.timestamp) {
          seen.set(key, operation);
        }
      } else {
        seen.set(key, operation);
      }
    }

    this.queue = Array.from(seen.values());
    await this.saveQueue();
  }

  async getQueueSize(): Promise<number> {
    return this.queue.length;
  }

  async clearQueue(): Promise<void> {
    this.queue = [];
    await this.saveQueue();
  }

  async getOperation(id: string): Promise<QueueOperation | undefined> {
    return this.queue.find((op) => op.id === id);
  }

  async markAsSynced(id: string): Promise<void> {
    const operation = this.queue.find((op) => op.id === id);
    if (operation) {
      operation.synced = true;
      await this.saveQueue();
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save queue:', error);
    }
  }
}

export const offlineQueue = new OfflineQueueManager();
