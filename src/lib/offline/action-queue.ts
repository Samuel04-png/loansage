/**
 * Offline Action Queue System
 * Queues mutations when offline and automatically retries when connection returns
 */

export interface QueuedAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  collection: string;
  data: any;
  timestamp: number;
  retries: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
}

const QUEUE_STORAGE_KEY = 'offline_action_queue';
const MAX_RETRIES = 3;

/**
 * Add an action to the queue
 */
export function queueAction(
  type: QueuedAction['type'],
  collection: string,
  data: any
): string {
  const action: QueuedAction = {
    id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    collection,
    data,
    timestamp: Date.now(),
    retries: 0,
    status: 'pending',
  };

  const queue = getQueuedActions();
  queue.push(action);
  saveQueue(queue);

  return action.id;
}

/**
 * Get all queued actions
 */
export function getQueuedActions(): QueuedAction[] {
  try {
    const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Get pending actions
 */
export function getPendingActions(): QueuedAction[] {
  return getQueuedActions().filter(a => a.status === 'pending');
}

/**
 * Save queue to localStorage
 */
function saveQueue(queue: QueuedAction[]): void {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.warn('Failed to save action queue:', error);
  }
}

/**
 * Mark action as syncing
 */
export function markActionSyncing(actionId: string): void {
  const queue = getQueuedActions();
  const action = queue.find(a => a.id === actionId);
  if (action) {
    action.status = 'syncing';
    saveQueue(queue);
  }
}

/**
 * Mark action as completed
 */
export function markActionCompleted(actionId: string): void {
  const queue = getQueuedActions();
  const filtered = queue.filter(a => a.id !== actionId);
  saveQueue(filtered);
}

/**
 * Mark action as failed (increment retries)
 */
export function markActionFailed(actionId: string): void {
  const queue = getQueuedActions();
  const action = queue.find(a => a.id === actionId);
  if (action) {
    action.retries++;
    if (action.retries >= MAX_RETRIES) {
      action.status = 'failed';
    } else {
      action.status = 'pending';
    }
    saveQueue(queue);
  }
}

/**
 * Clear all completed/failed actions older than 7 days
 */
export function cleanupOldActions(): void {
  const queue = getQueuedActions();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const filtered = queue.filter(
    a => a.status === 'completed' || 
         (a.status === 'failed' && a.timestamp < sevenDaysAgo) ||
         a.status === 'pending' ||
         a.status === 'syncing'
  );
  saveQueue(filtered);
}

/**
 * Clear all actions (for testing/debugging)
 */
export function clearQueue(): void {
  localStorage.removeItem(QUEUE_STORAGE_KEY);
}
