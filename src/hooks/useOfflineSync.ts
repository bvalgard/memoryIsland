import { useCallback, useEffect, useRef, useState } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import {
  pinIsland as dbPin,
  unpinIsland as dbUnpin,
  getPinnedIslandIds,
  refreshPinnedIsland,
  queueSession as dbQueue,
  getPendingQueue,
  clearQueueItem,
  type QueuedSession,
} from '../lib/offlineStore';
import type { Island, CardUpdateRecord, CardStatus, UserProgress } from './useUserProgress';
import type { SessionMeta } from '../achievements';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

const STATUS_RANK: Record<CardStatus, number> = { mastered: 2, learning: 1, struggling: 0 };

function worseStatus(a: CardStatus | undefined, b: CardStatus | undefined): CardStatus {
  const ra = STATUS_RANK[a ?? 'learning'] ?? 1;
  const rb = STATUS_RANK[b ?? 'learning'] ?? 1;
  return ra <= rb ? (a ?? 'learning') : (b ?? 'learning');
}

function resolveConflicts(
  queuedUpdates: CardUpdateRecord,
  allCards: Array<{ front: string; status?: CardStatus; lastReviewed?: number }>,
  offlineTimestamp: number,
): CardUpdateRecord {
  const cardMap = new Map(allCards.map(c => [c.front, c]));
  const resolved: CardUpdateRecord = {};

  for (const [front, update] of Object.entries(queuedUpdates)) {
    const current = cardMap.get(front);
    const currentLastReviewed = current?.lastReviewed ?? 0;
    const keepCurrentSRS = currentLastReviewed > offlineTimestamp;

    resolved[front] = {
      status: worseStatus(current?.status, update.status),
      consecutiveCorrect: update.consecutiveCorrect,
      lastReviewed: Math.max(currentLastReviewed, offlineTimestamp),
      sessionAnswers: update.sessionAnswers,
      sessionCorrect: update.sessionCorrect,
      wasDemoted: update.wasDemoted,
      demotionCount: update.demotionCount,
      ...(keepCurrentSRS ? {} : {
        srsInterval: update.srsInterval,
        srsEaseFactor: update.srsEaseFactor,
        srsNextReview: update.srsNextReview,
        srsRepetitions: update.srsRepetitions,
      }),
    };
  }

  return resolved;
}

interface UseOfflineSyncOptions {
  progress: UserProgress | null;
  syncOfflineResults: (
    islandId: string,
    delta: number,
    cardUpdates: CardUpdateRecord,
    sessionMaxStreak?: number,
    sessionMeta?: SessionMeta,
  ) => Promise<void>;
  syncOfflineArchipelagoResults: (
    delta: number,
    cardUpdates: CardUpdateRecord,
    sessionMaxStreak?: number,
    sessionMeta?: SessionMeta,
  ) => Promise<void>;
}

export function useOfflineSync({
  progress,
  syncOfflineResults,
  syncOfflineArchipelagoResults,
}: UseOfflineSyncOptions) {
  const isOnline = useOnlineStatus();
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const syncingRef = useRef(false);

  // Load pinned IDs from IndexedDB on mount
  useEffect(() => {
    getPinnedIslandIds().then(ids => setPinnedIds(new Set(ids))).catch(() => {});
    getPendingQueue().then(q => setPendingCount(q.length)).catch(() => {});
  }, []);

  // Auto-refresh cached data for pinned islands whenever progress updates while online
  useEffect(() => {
    if (!isOnline || !progress || pinnedIds.size === 0) return;
    for (const island of progress.islands) {
      if (pinnedIds.has(island.id)) {
        refreshPinnedIsland(island).catch(() => {});
      }
    }
  }, [isOnline, progress, pinnedIds]);

  // Sync queue whenever we are online, progress is loaded, and there are pending sessions.
  // This handles both the "came back online" case and the "opened app while online with
  // queued sessions from a previous offline session" case.
  useEffect(() => {
    if (!isOnline || !progress || pendingCount === 0 || syncingRef.current) return;

    syncingRef.current = true;
    setSyncStatus('syncing');

    (async () => {
      try {
        const queue = await getPendingQueue();
        if (queue.length === 0) { setSyncStatus('idle'); return; }

        for (const session of queue) {
          const allCards = session.isArchipelago
            ? progress.islands.flatMap(i => i.cards)
            : (progress.islands.find(i => i.id === session.islandId)?.cards ?? []);

          const merged = resolveConflicts(session.cardUpdates, allCards, session.timestamp);

          if (session.isArchipelago) {
            await syncOfflineArchipelagoResults(0, merged, session.sessionMaxStreak, session.sessionMeta);
          } else {
            await syncOfflineResults(session.islandId, 0, merged, session.sessionMaxStreak, session.sessionMeta);
          }

          if (session.queueId !== undefined) await clearQueueItem(session.queueId);
        }

        setPendingCount(0);
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 4000);
      } catch {
        setSyncStatus('error');
      } finally {
        syncingRef.current = false;
      }
    })();
  }, [isOnline, progress, pendingCount]);

  const pin = useCallback(async (island: Island) => {
    await dbPin(island);
    setPinnedIds(prev => new Set([...prev, island.id]));
  }, []);

  const unpin = useCallback(async (islandId: string) => {
    await dbUnpin(islandId);
    setPinnedIds(prev => { const next = new Set(prev); next.delete(islandId); return next; });
  }, []);

  const queueSession = useCallback(async (session: Omit<QueuedSession, 'queueId'>) => {
    await dbQueue(session);
    setPendingCount(prev => prev + 1);
  }, []);

  const isPinned = useCallback((islandId: string) => pinnedIds.has(islandId), [pinnedIds]);

  return { isOnline, pinnedIds, syncStatus, pendingCount, pin, unpin, queueSession, isPinned };
}
