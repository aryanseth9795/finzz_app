import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "@finzz_sync_queue";

export interface QueuedAction {
  id: string; // UUID for deduplication
  type: "add" | "edit" | "delete";
  endpoint: string;
  payload: any;
  tempId?: string; // Local temp ID to replace on success
  createdAt: number;
}

class SyncQueue {
  private queue: QueuedAction[] = [];
  private isProcessing = false;

  /**
   * Load queue from AsyncStorage on initialization
   */
  async init() {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error("Failed to load sync queue:", error);
    }
  }

  /**
   * Add an action to the queue
   */
  async enqueue(action: QueuedAction) {
    this.queue.push(action);
    await this.persist();
  }

  /**
   * Get all queued actions
   */
  getAll(): QueuedAction[] {
    return this.queue;
  }

  /**
   * Get queue length
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * Remove an action from the queue
   */
  async removeFromQueue(id: string) {
    this.queue = this.queue.filter((action) => action.id !== id);
    await this.persist();
  }

  /**
   * Persist queue to AsyncStorage
   */
  private async persist() {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error("Failed to persist sync queue:", error);
    }
  }

  /**
   * Process all queued actions (called on app foreground or connectivity change)
   * This should be implemented in the component/service that uses this queue
   */
  async processQueue(
    handler: (action: QueuedAction) => Promise<void>,
  ): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    const actionsToProcess = [...this.queue];

    for (const action of actionsToProcess) {
      try {
        await handler(action);
        // If successful, remove from queue
        await this.removeFromQueue(action.id);
      } catch (error) {
        console.error(`Failed to process queued action ${action.id}:`, error);
        // Keep in queue for next retry
      }
    }

    this.isProcessing = false;
  }

  /**
   * Clear all queued actions
   */
  async clear() {
    this.queue = [];
    await this.persist();
  }
}

export const syncQueue = new SyncQueue();
