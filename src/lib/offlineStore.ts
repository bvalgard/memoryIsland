import type { Island, Card, CardUpdateRecord } from '../hooks/useUserProgress';
import type { SessionMeta } from '../achievements';

const DB_NAME = 'memory-island-offline';
const DB_VERSION = 1;
const PINNED_STORE = 'pinnedIslands';
const QUEUE_STORE = 'syncQueue';

export interface PinnedIslandRecord {
  islandId: string;
  island: Omit<Island, 'cards'>;
  cards: Card[];
  pinnedAt: number;
  lastSyncedAt: number;
}

export interface QueuedSession {
  queueId?: number;
  islandId: string;
  isArchipelago: boolean;
  cardUpdates: CardUpdateRecord;
  sessionMaxStreak: number;
  sessionMeta: SessionMeta;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PINNED_STORE)) {
        db.createObjectStore(PINNED_STORE, { keyPath: 'islandId' });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'queueId', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function pinIsland(island: Island): Promise<void> {
  const db = await openDB();
  const { cards, ...islandMeta } = island;
  const record: PinnedIslandRecord = {
    islandId: island.id,
    island: islandMeta,
    cards,
    pinnedAt: Date.now(),
    lastSyncedAt: Date.now(),
  };
  const tx = db.transaction(PINNED_STORE, 'readwrite');
  await idbRequest(tx.objectStore(PINNED_STORE).put(record));
  db.close();
}

export async function unpinIsland(islandId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(PINNED_STORE, 'readwrite');
  await idbRequest(tx.objectStore(PINNED_STORE).delete(islandId));
  db.close();
}

export async function getPinnedIsland(islandId: string): Promise<PinnedIslandRecord | null> {
  const db = await openDB();
  const tx = db.transaction(PINNED_STORE, 'readonly');
  const result = await idbRequest<PinnedIslandRecord | undefined>(tx.objectStore(PINNED_STORE).get(islandId));
  db.close();
  return result ?? null;
}

export async function getPinnedIslandIds(): Promise<string[]> {
  const db = await openDB();
  const tx = db.transaction(PINNED_STORE, 'readonly');
  const keys = await idbRequest<IDBValidKey[]>(tx.objectStore(PINNED_STORE).getAllKeys());
  db.close();
  return keys as string[];
}

export async function refreshPinnedIsland(island: Island): Promise<void> {
  const db = await openDB();
  const store = db.transaction(PINNED_STORE, 'readwrite').objectStore(PINNED_STORE);
  const existing = await idbRequest<PinnedIslandRecord | undefined>(store.get(island.id));
  if (!existing) { db.close(); return; }
  const { cards, ...islandMeta } = island;
  const tx2 = db.transaction(PINNED_STORE, 'readwrite');
  await idbRequest(tx2.objectStore(PINNED_STORE).put({
    ...existing,
    island: islandMeta,
    cards,
    lastSyncedAt: Date.now(),
  }));
  db.close();
}

export async function queueSession(session: Omit<QueuedSession, 'queueId'>): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  await idbRequest(tx.objectStore(QUEUE_STORE).add(session));
  db.close();
}

export async function getPendingQueue(): Promise<QueuedSession[]> {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, 'readonly');
  const results = await idbRequest<QueuedSession[]>(tx.objectStore(QUEUE_STORE).getAll());
  db.close();
  return results;
}

export async function clearQueueItem(queueId: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  await idbRequest(tx.objectStore(QUEUE_STORE).delete(queueId));
  db.close();
}
