import { useEffect, useRef, useState } from 'react';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, isConfigPlaceholder } from '../firebase';

export type CardStatus = 'learning' | 'struggling' | 'mastered';
export type CardUpdateRecord = Record<string, { status: CardStatus; consecutiveCorrect?: number; lastReviewed?: number }>;

export interface Card {
  id?: string;
  front: string;
  back: string;
  type?: 'flashcard' | 'mcq' | 'matching' | 'fill-in-the-blank' | 'multi-select' | 'sequencing';
  options?: string[];
  correctOptions?: string[];
  explanations?: Record<string, string>;
  pairs?: { id: string; left: string; rights: string[] }[];
  needsWork?: boolean;
  status?: CardStatus;
  consecutiveCorrect?: number;
  lastReviewed?: number;
  prevTierCardId?: string;
  tier?: number;
  hint?: string;
}

export interface Archipelago {
  id: string;
  name: string;
  isPublic?: boolean;
  publishedId?: string;
  isImported?: boolean;
  sharedWith?: string[];
}

export interface Island {
  id: string;
  name: string;
  archipelagoId?: string;
  color_score: number;
  cards: Card[];
  isPublic?: boolean;
  publishedId?: string;
  authorId?: string;
  authorName?: string;
  downloads?: number;
  createdAt?: number;
  approvalStatus?: 'draft' | 'pending' | 'approved' | 'rejected';
  isImported?: boolean;
  sharedWith?: string[];
}

export interface UserStats {
  dailyReviewed: number;
  dailyMastered: number;
  recordReviewed: number;
  recordMastered: number;
  lastStudyDate: string;
  totalStudySessions: number;
  totalCardsCreated: number;
  dailyStreak: number;
  longestDailyStreak: number;
  longestSessionStreak: number;
}

export interface UserSettings {
  learningStreakNeeded: number;
  masteryStreakNeeded: number;
  showOnGlobalLeaderboard: boolean;
}

export interface UserProgress {
  last_active: Timestamp;
  islands: Island[];
  archipelagos?: Archipelago[];
  stats?: UserStats;
  settings?: UserSettings;
}

interface UserDocumentData {
  uid?: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt?: Timestamp;
  last_active?: Timestamp;
  archipelagos?: Archipelago[];
  islands?: Island[];
  stats?: UserStats;
  settings?: UserSettings;
  dataModelVersion?: number;
}

interface IslandDocumentData {
  ownerId: string;
  ownerEmail?: string | null;
  name: string;
  archipelagoId?: string;
  color_score: number;
  isPublic?: boolean;
  publishedId?: string;
  authorId?: string;
  authorName?: string;
  downloads?: number;
  createdAt?: number;
  approvalStatus?: 'draft' | 'pending' | 'approved' | 'rejected';
  submittedAt?: Timestamp;
  isImported?: boolean;
  sharedWith?: string[];
}

interface CardDocumentData extends Card {
  islandId: string;
  ownerId: string;
  position: number;
  createdAt?: number;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  if (typeof window !== 'undefined') {
    alert(`Database Error (${operationType}): ${errMessage}. Please check the console or ensure your rules are correct.`);
  }
  throw new Error(JSON.stringify(errInfo));
}

const defaultStats: UserStats = {
  dailyReviewed: 0,
  dailyMastered: 0,
  recordReviewed: 0,
  recordMastered: 0,
  lastStudyDate: new Date().toISOString().split('T')[0],
  totalStudySessions: 0,
  totalCardsCreated: 0,
  dailyStreak: 0,
  longestDailyStreak: 0,
  longestSessionStreak: 0,
};

const defaultSettings: UserSettings = {
  learningStreakNeeded: 1,
  masteryStreakNeeded: 3,
  showOnGlobalLeaderboard: true,
};

function randomId() {
  return Math.random().toString(36).substring(2, 11);
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function omitUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => omitUndefined(item)) as T;
  }

  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, omitUndefined(entryValue)])
    ) as T;
  }

  return value;
}

function normalizeCard(card: Card, fallbackIndex: number): Card {
  return {
    ...card,
    id: card.id || `${Date.now()}-${fallbackIndex}-${randomId()}`,
    type: card.type || 'flashcard',
    options: card.options || [],
    correctOptions: card.correctOptions || [],
    explanations: card.explanations || {},
    pairs: card.pairs || [],
    hint: card.hint || '',
  };
}

function sanitizeCardForStorage(card: Card): Card {
  return omitUndefined({
    ...card,
    type: card.type || 'flashcard',
    options: card.options || [],
    correctOptions: card.correctOptions || [],
    explanations: card.explanations || {},
    pairs: card.pairs || [],
    hint: card.hint || '',
  });
}

function sanitizeCardForPublic(card: Card) {
  return {
    front: card.front,
    back: card.back,
    type: card.type || 'flashcard',
    options: card.options || [],
    correctOptions: card.correctOptions || [],
    explanations: card.explanations || {},
    pairs: card.pairs || [],
    hint: card.hint || '',
  };
}

function toIslandDocument(island: Island, ownerId: string, ownerEmail?: string | null): IslandDocumentData {
  return omitUndefined({
    ownerId,
    ownerEmail: ownerEmail || null,
    name: island.name,
    archipelagoId: island.archipelagoId,
    color_score: island.color_score,
    isPublic: island.isPublic || false,
    publishedId: island.publishedId,
    authorId: island.authorId,
    authorName: island.authorName,
    downloads: island.downloads || 0,
    createdAt: island.createdAt || Date.now(),
    approvalStatus: island.approvalStatus || (island.isPublic ? 'approved' : 'draft'),
    isImported: island.isImported || false,
    sharedWith: island.sharedWith || [],
  });
}

function toCardDocument(card: Card, islandId: string, ownerId: string, position: number): CardDocumentData {
  const normalized = normalizeCard(card, position);
  return {
    ...sanitizeCardForStorage(normalized),
    islandId,
    ownerId,
    position,
    createdAt: Date.now(),
  };
}

async function commitLegacyMigration(
  userId: string,
  ownerEmail: string | null | undefined,
  legacyIslands: Island[]
) {
  const operations: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  legacyIslands.forEach((legacyIsland) => {
    const islandId = legacyIsland.id || randomId();
    const migratedIsland: Island = {
      ...legacyIsland,
      id: islandId,
      createdAt: legacyIsland.createdAt || Date.now(),
      downloads: legacyIsland.downloads || 0,
      approvalStatus: legacyIsland.approvalStatus || (legacyIsland.isPublic ? 'approved' : 'draft'),
      cards: [],
    };

    operations.push((batch) => {
      batch.set(doc(db, 'islands', islandId), toIslandDocument(migratedIsland, userId, ownerEmail), { merge: true });
    });

    legacyIsland.cards.forEach((card, index) => {
      const normalized = normalizeCard(card, index);
      operations.push((batch) => {
        batch.set(doc(db, 'cards', normalized.id!), toCardDocument(normalized, islandId, userId, index), { merge: true });
      });
    });
  });

  for (const group of chunk(operations, 350)) {
    const batch = writeBatch(db);
    group.forEach((applyOperation) => applyOperation(batch));
    await batch.commit();
  }
}

export function useUserProgress() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserDocumentData | null>(null);
  const [islandDocs, setIslandDocs] = useState<Array<{ id: string; data: IslandDocumentData }>>([]);
  const [cardDocs, setCardDocs] = useState<Array<{ id: string; data: CardDocumentData }>>([]);
  const [userLoaded, setUserLoaded] = useState(false);
  const [islandsLoaded, setIslandsLoaded] = useState(false);
  const [cardsLoaded, setCardsLoaded] = useState(false);
  const migrationInProgress = useRef(false);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user || isConfigPlaceholder) {
      setLoading(false);
      setProgress(null);
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    const path = `users/${user.uid}`;

    const unsubscribeUser = onSnapshot(
      userRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          const initialData = {
            uid: user.uid,
            email: user.email,
            ...(user.displayName && { displayName: user.displayName }),
            ...(user.photoURL && { photoURL: user.photoURL }),
            createdAt: Timestamp.now(),
            last_active: Timestamp.now(),
            archipelagos: [],
            stats: defaultStats,
            settings: defaultSettings,
            dataModelVersion: 2,
          };

          try {
            await setDoc(userRef, initialData);
            const profileRef = doc(db, 'profiles', user.uid);
            await setDoc(
              profileRef,
              {
                uid: user.uid,
                displayName: user.displayName || 'Explorer',
                displayNameLowercase: (user.displayName || 'Explorer').toLowerCase(),
                photoURL: user.photoURL || null,
                stats: defaultStats,
                lastActive: serverTimestamp(),
              },
              { merge: true }
            );
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, path);
          }

          return;
        }

        const data = snapshot.data() as UserDocumentData;

        if ((data.dataModelVersion || 0) < 2 && data.islands?.length && !migrationInProgress.current) {
          migrationInProgress.current = true;
          try {
            await commitLegacyMigration(user.uid, user.email, data.islands);
            await setDoc(
              userRef,
              {
                uid: data.uid || user.uid,
                email: data.email || user.email || null,
                displayName: data.displayName || user.displayName || null,
                photoURL: data.photoURL || user.photoURL || null,
                createdAt: data.createdAt || Timestamp.now(),
                last_active: data.last_active || Timestamp.now(),
                archipelagos: omitUndefined(data.archipelagos || []),
                stats: { ...defaultStats, ...(data.stats || {}) },
                settings: { ...defaultSettings, ...(data.settings || {}) },
                dataModelVersion: 2,
                migratedAt: serverTimestamp(),
              },
              { merge: true }
            );
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, path);
          } finally {
            migrationInProgress.current = false;
          }
          return;
        }

        const stats = { ...defaultStats, ...(data.stats || {}) };
        const settings = { ...defaultSettings, ...(data.settings || {}) };
        const lastActive = data.last_active || Timestamp.now();
        const todayDate = new Date().toISOString().split('T')[0];
        let needsStatsUpdate = false;

        const dailyStreak = stats.dailyStreak || 0;
        const longestDailyStreak = stats.longestDailyStreak || 0;
        const longestSessionStreak = stats.longestSessionStreak || 0;

        if (stats.lastStudyDate !== todayDate) {
          const lastDate = new Date(stats.lastStudyDate);
          const today = new Date(todayDate);
          const diffTime = Math.abs(today.getTime() - lastDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          let newDailyStreak = dailyStreak;
          if (diffDays > 1) {
            newDailyStreak = 0;
          }

          data.stats = {
            ...stats,
            dailyReviewed: 0,
            dailyMastered: 0,
            lastStudyDate: todayDate,
            dailyStreak: newDailyStreak,
            longestDailyStreak,
            longestSessionStreak,
          };
          needsStatsUpdate = true;
        } else {
          data.stats = stats;
        }

        data.settings = settings;
        data.last_active = lastActive;

        if (needsStatsUpdate) {
          try {
            await updateDoc(userRef, { stats: data.stats, last_active: Timestamp.now() });
          } catch (error) {
            handleFirestoreError(error, OperationType.UPDATE, path);
          }
        }

        // Sync displayName if it changed or was missing (fixes race condition in email signups)
        if (user.displayName && data.displayName !== user.displayName) {
          try {
            const profileRef = doc(db, 'profiles', user.uid);
            await Promise.all([
              updateDoc(userRef, { displayName: user.displayName }),
              setDoc(profileRef, { 
                displayName: user.displayName,
                displayNameLowercase: user.displayName.toLowerCase()
              }, { merge: true })
            ]);
          } catch (error) {
            console.warn('Silent sync of displayName failed:', error);
          }
        }

        setUserData(data);
        setUserLoaded(true);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    const islandsQuery = query(collection(db, 'islands'), where('ownerId', '==', user.uid));
    const unsubscribeIslands = onSnapshot(
      islandsQuery,
      (snapshot) => {
        setIslandDocs(snapshot.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() as IslandDocumentData })));
        setIslandsLoaded(true);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'islands');
      }
    );

    const cardsQuery = query(collection(db, 'cards'), where('ownerId', '==', user.uid));
    const unsubscribeCards = onSnapshot(
      cardsQuery,
      (snapshot) => {
        setCardDocs(snapshot.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() as CardDocumentData })));
        setCardsLoaded(true);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'cards');
      }
    );

    return () => {
      unsubscribeUser();
      unsubscribeIslands();
      unsubscribeCards();
    };
  }, [user]);

  useEffect(() => {
    if (!userLoaded || !islandsLoaded || !cardsLoaded || !userData) {
      setLoading(true);
      return;
    }

    const cardsByIsland = new Map<string, Card[]>();

    [...cardDocs]
      .sort((a, b) => a.data.position - b.data.position)
      .forEach(({ data, id }) => {
        const existing = cardsByIsland.get(data.islandId) || [];
        existing.push({
          id,
          front: data.front,
          back: data.back,
          type: data.type,
          options: data.options || [],
          correctOptions: data.correctOptions || [],
          explanations: data.explanations || {},
          pairs: data.pairs || [],
          needsWork: data.needsWork,
          status: data.status,
          consecutiveCorrect: data.consecutiveCorrect,
          lastReviewed: data.lastReviewed,
          prevTierCardId: data.prevTierCardId,
          tier: data.tier,
          hint: data.hint || '',
        });
        cardsByIsland.set(data.islandId, existing);
      });

    const assembledIslands: Island[] = [...islandDocs]
      .sort((a, b) => (a.data.createdAt || 0) - (b.data.createdAt || 0))
      .map(({ id, data }) => ({
        id,
        name: data.name,
        archipelagoId: data.archipelagoId,
        color_score: data.color_score,
        isPublic: data.isPublic,
        publishedId: data.publishedId,
        authorId: data.authorId,
        authorName: data.authorName,
        downloads: data.downloads,
        createdAt: data.createdAt,
        approvalStatus: data.approvalStatus,
        isImported: data.isImported || false,
        sharedWith: data.sharedWith || [],
        cards: cardsByIsland.get(id) || [],
      }));

    setProgress({
      last_active: userData.last_active || Timestamp.now(),
      archipelagos: userData.archipelagos || [],
      stats: { ...defaultStats, ...(userData.stats || {}) },
      settings: { ...defaultSettings, ...(userData.settings || {}) },
      islands: assembledIslands,
    });
    setLoading(false);
  }, [userLoaded, islandsLoaded, cardsLoaded, userData, islandDocs, cardDocs]);

  const updateStats = async (newStats: Partial<UserStats>) => {
    if (!user || isConfigPlaceholder || !progress?.stats) return;
    const mergedStats = { ...defaultStats, ...progress.stats, ...newStats };
    const userRef = doc(db, 'users', user.uid);
    try {
      await updateDoc(userRef, { stats: mergedStats });
      const profileRef = doc(db, 'profiles', user.uid);
      await setDoc(
        profileRef,
        {
          uid: user.uid,
          displayName: user.displayName || 'Explorer',
          displayNameLowercase: (user.displayName || 'Explorer').toLowerCase(),
          photoURL: user.photoURL || null,
          stats: mergedStats,
          showOnGlobalLeaderboard: progress.settings?.showOnGlobalLeaderboard ?? true,
          lastActive: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user || isConfigPlaceholder || !progress?.settings) return;
    const mergedSettings = { ...progress.settings, ...newSettings };
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        settings: mergedSettings,
        last_active: Timestamp.now(),
      });
      
      // Also sync to profile for leaderboard filtering
      const profileRef = doc(db, 'profiles', user.uid);
      await setDoc(
        profileRef,
        {
          showOnGlobalLeaderboard: mergedSettings.showOnGlobalLeaderboard,
          lastActive: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const updateArchipelagos = async (newArchipelagos: Archipelago[]) => {
    if (!user || isConfigPlaceholder) return;
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          archipelagos: omitUndefined(newArchipelagos),
          last_active: Timestamp.now(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const updateIslands = async (newIslands: Island[]) => {
    if (!user || isConfigPlaceholder || !progress) return;
    const existingMap = new Map<string, Island>(progress.islands.map((island) => [island.id, island] as const));
    const nextMap = new Map<string, Island>(newIslands.map((island) => [island.id, island] as const));

    try {
      for (const island of newIslands) {
        if (!existingMap.has(island.id)) {
          await setDoc(doc(db, 'islands', island.id), toIslandDocument(island, user.uid, user.email));
          const batch = writeBatch(db);
          island.cards.forEach((card, index) => {
            const normalized = normalizeCard(card, index);
            batch.set(doc(db, 'cards', normalized.id!), toCardDocument(normalized, island.id, user.uid, index));
          });
          await batch.commit();
          continue;
        }

        const existingIsland = existingMap.get(island.id)!;
        await updateIsland(island.id, {
          name: island.name,
          archipelagoId: island.archipelagoId,
          color_score: island.color_score,
          isPublic: island.isPublic,
          publishedId: island.publishedId,
          downloads: island.downloads,
          approvalStatus: island.approvalStatus,
        });

        const existingCards = existingIsland.cards.map((card) => card.id).filter(Boolean) as string[];
        const nextCards = island.cards.map((card, index) => normalizeCard(card, index));
        const nextCardIds = new Set(nextCards.map((card) => card.id!));
        const batch = writeBatch(db);

        nextCards.forEach((card, index) => {
          batch.set(doc(db, 'cards', card.id!), toCardDocument(card, island.id, user.uid, index), { merge: true });
        });

        existingCards
          .filter((cardId) => !nextCardIds.has(cardId))
          .forEach((cardId) => batch.delete(doc(db, 'cards', cardId)));

        await batch.commit();
      }

      for (const islandId of existingMap.keys()) {
        if (!nextMap.has(islandId)) {
          await removeIsland(islandId);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'islands');
    }
  };

  const addArchipelago = async (name: string) => {
    const newArchipelago: Archipelago = {
      id: randomId(),
      name,
    };
    await updateArchipelagos([...(progress?.archipelagos || []), newArchipelago]);
    return newArchipelago.id;
  };

  const removeArchipelago = async (archipelagoId: string) => {
    if (!user || !progress) return;
    const islandsToRemove = progress.islands.filter(i => i.archipelagoId === archipelagoId);

    try {
      const batch = writeBatch(db);
      for (const island of islandsToRemove) {
        island.cards.forEach(card => {
          if (card.id) batch.delete(doc(db, 'cards', card.id));
        });
        batch.delete(doc(db, 'islands', island.id));
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `archipelago/${archipelagoId}/islands`);
      return;
    }

    const updatedArchipelagos = (progress.archipelagos || []).filter(a => a.id !== archipelagoId);
    await updateArchipelagos(updatedArchipelagos);
  };

  const addIsland = async (name: string, archipelagoId?: string) => {
    if (!user) return;
    const islandId = randomId();
    try {
      await setDoc(doc(db, 'islands', islandId), toIslandDocument({
        id: islandId,
        name,
        archipelagoId,
        cards: [],
        color_score: 50,
        createdAt: Date.now(),
        isPublic: false,
        approvalStatus: 'draft',
      }, user.uid, user.email));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `islands/${islandId}`);
    }
  };

  const updateIsland = async (islandId: string, updates: Partial<Island>) => {
    if (!user) return;
    const payload: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.archipelagoId !== undefined) payload.archipelagoId = updates.archipelagoId;
    if (updates.color_score !== undefined) payload.color_score = updates.color_score;
    if (updates.isPublic !== undefined) payload.isPublic = updates.isPublic;
    if (updates.publishedId !== undefined) payload.publishedId = updates.publishedId;
    if (updates.authorId !== undefined) payload.authorId = updates.authorId;
    if (updates.authorName !== undefined) payload.authorName = updates.authorName;
    if (updates.downloads !== undefined) payload.downloads = updates.downloads;
    if (updates.createdAt !== undefined) payload.createdAt = updates.createdAt;
    if (updates.approvalStatus !== undefined) payload.approvalStatus = updates.approvalStatus;

    try {
      await updateDoc(doc(db, 'islands', islandId), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `islands/${islandId}`);
    }
  };

  const addCardToIsland = async (islandId: string, card: Card) => {
    if (!user || !progress) return;
    const island = progress.islands.find((entry) => entry.id === islandId);
    if (!island) return;

    const normalized = normalizeCard(card, island.cards.length);
    try {
      await setDoc(doc(db, 'cards', normalized.id!), toCardDocument(normalized, islandId, user.uid, island.cards.length));
      if (progress.stats) {
        await updateStats({ totalCardsCreated: progress.stats.totalCardsCreated + 1 });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `cards/${normalized.id}`);
    }
  };

  const addCardsToIsland = async (islandId: string, cards: Card[]) => {
    if (!user || !progress) return;
    const island = progress.islands.find((entry) => entry.id === islandId);
    if (!island) return;

    const batch = writeBatch(db);
    const normalizedCards = cards.map((card, index) => normalizeCard(card, island.cards.length + index));
    normalizedCards.forEach((card, index) => {
      batch.set(doc(db, 'cards', card.id!), toCardDocument(card, islandId, user.uid, island.cards.length + index));
    });

    try {
      await batch.commit();
      if (progress.stats) {
        await updateStats({ totalCardsCreated: progress.stats.totalCardsCreated + normalizedCards.length });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `cards/${islandId}`);
    }
  };

  const updateCardInIsland = async (islandId: string, cardIndex: number, updatedCard: Card) => {
    if (!progress) return;
    const island = progress.islands.find((entry) => entry.id === islandId);
    const currentCard = island?.cards[cardIndex];
    if (!currentCard?.id) return;

    try {
      await updateDoc(doc(db, 'cards', currentCard.id), {
        ...sanitizeCardForStorage({ ...updatedCard, id: currentCard.id }),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `cards/${currentCard.id}`);
    }
  };

  const removeIsland = async (islandId: string) => {
    if (!user || !progress) return;

    const cardsToDelete = progress.islands.find((island) => island.id === islandId)?.cards || [];
    const batch = writeBatch(db);
    cardsToDelete.forEach((card) => {
      if (card.id) {
        batch.delete(doc(db, 'cards', card.id));
      }
    });
    batch.delete(doc(db, 'islands', islandId));

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `islands/${islandId}`);
    }
  };

  const removeCardFromIsland = async (islandId: string, cardIndex: number) => {
    if (!progress) return;
    const island = progress.islands.find((entry) => entry.id === islandId);
    const targetCard = island?.cards[cardIndex];
    if (!island || !targetCard?.id) return;

    const remainingCards = island.cards.filter((_, index) => index !== cardIndex);
    const batch = writeBatch(db);
    batch.delete(doc(db, 'cards', targetCard.id));
    remainingCards.forEach((card, index) => {
      if (card.id) {
        batch.update(doc(db, 'cards', card.id), { position: index });
      }
    });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `cards/${targetCard.id}`);
    }
  };

  const handleStudyStatsUpdate = async (cardUpdates: CardUpdateRecord, sessionHighestStreak = 0) => {
    if (!progress?.stats) return;
    const reviewedCount = Object.keys(cardUpdates).length;
    const masteredCount = Object.values(cardUpdates).filter((entry) => entry.status === 'mastered').length;

    const newDailyReviewed = progress.stats.dailyReviewed + reviewedCount;
    const newDailyMastered = progress.stats.dailyMastered + masteredCount;
    const newTotalSessions = progress.stats.totalStudySessions + 1;

    let newDailyStreak = progress.stats.dailyStreak;
    const isFirstSessionToday = progress.stats.dailyReviewed === 0;
    if (isFirstSessionToday) {
      newDailyStreak += 1;
    }

    await updateStats({
      dailyReviewed: newDailyReviewed,
      dailyMastered: newDailyMastered,
      recordReviewed: Math.max(progress.stats.recordReviewed, newDailyReviewed),
      recordMastered: Math.max(progress.stats.recordMastered, newDailyMastered),
      totalStudySessions: newTotalSessions,
      dailyStreak: newDailyStreak,
      longestDailyStreak: Math.max(progress.stats.longestDailyStreak || 0, newDailyStreak),
      longestSessionStreak: Math.max(progress.stats.longestSessionStreak || 0, sessionHighestStreak),
    });
  };

  const processSessionResults = async (islandId: string, delta: number, cardUpdates: CardUpdateRecord, sessionHighestStreak = 0) => {
    if (!progress) return;
    const island = progress.islands.find((entry) => entry.id === islandId);
    if (!island) return;

    const batch = writeBatch(db);
    island.cards.forEach((card) => {
      const update = cardUpdates[card.front];
      if (update && card.id) {
        batch.update(doc(db, 'cards', card.id), {
          status: update.status,
          consecutiveCorrect: update.consecutiveCorrect ?? card.consecutiveCorrect ?? 0,
          needsWork: update.status === 'struggling',
          lastReviewed: update.lastReviewed ?? card.lastReviewed ?? Date.now(),
        });
      }
    });
    batch.update(doc(db, 'islands', islandId), {
      color_score: Math.min(100, Math.max(0, island.color_score + delta)),
    });

    try {
      await batch.commit();
      await handleStudyStatsUpdate(cardUpdates, sessionHighestStreak);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `islands/${islandId}`);
    }
  };

  const processArchipelagoResults = async (delta: number, cardUpdates: CardUpdateRecord, sessionHighestStreak = 0) => {
    if (!progress) return;

    const batch = writeBatch(db);
    progress.islands.forEach((island) => {
      let islandUpdated = false;
      island.cards.forEach((card) => {
        const update = cardUpdates[card.front];
        if (update && card.id) {
          islandUpdated = true;
          batch.update(doc(db, 'cards', card.id), {
            status: update.status,
            consecutiveCorrect: update.consecutiveCorrect ?? card.consecutiveCorrect ?? 0,
            needsWork: update.status === 'struggling',
            lastReviewed: update.lastReviewed ?? card.lastReviewed ?? Date.now(),
          });
        }
      });

      if (islandUpdated) {
        batch.update(doc(db, 'islands', island.id), {
          color_score: Math.min(100, Math.max(0, island.color_score + delta)),
        });
      }
    });

    try {
      await batch.commit();
      await handleStudyStatsUpdate(cardUpdates, sessionHighestStreak);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'archipelago-session');
    }
  };

  const shareIsland = async (island: Island, targetUids?: string[]) => {
    if (!user) return;

    const isTargeted = targetUids && targetUids.length > 0;
    const publishedId = island.publishedId || island.id;
    const publishedRef = doc(db, 'published_islands', publishedId);

    const publicData = {
      id: publishedId,
      name: island.name,
      cards: island.cards.map(card => sanitizeCardForPublic(card)),
      authorId: user.uid,
      authorName: user.displayName || 'Explorer',
      isPublic: !isTargeted,
      sharedWith: isTargeted ? targetUids : [],
      downloads: island.downloads || 0,
      publishedAt: serverTimestamp(),
    };

    try {
      // 1. Create/Update the community version
      await setDoc(publishedRef, publicData);
      
      // 2. Update the local document to reflect sharing state
      await updateDoc(doc(db, 'islands', island.id), {
        isPublic: !isTargeted,
        sharedWith: isTargeted ? targetUids : [],
        publishedId: publishedId,
        authorId: user.uid,
        authorName: user.displayName || 'Explorer',
        approvalStatus: isTargeted ? 'approved' : 'pending',
        submittedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `published_islands/${publishedId}`);
    }
  };

  const unshareIsland = async (island: Island) => {
    if (!user) return;

    let publishedIds = island.publishedId ? [island.publishedId] : [];
    if (!publishedIds.length) {
      try {
        const snapshot = await getDocs(query(collection(db, 'published_islands'), where('authorId', '==', user.uid), limit(100)));
        publishedIds = snapshot.docs.filter((docSnap) => (docSnap.data() as any).name === island.name).map((docSnap) => docSnap.id);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'published_islands');
      }
    }

    try {
      if (publishedIds.length > 0) {
        await Promise.all(publishedIds.map((id) => deleteDoc(doc(db, 'published_islands', id))));
      }
      await updateDoc(doc(db, 'islands', island.id), {
        isPublic: false,
        approvalStatus: 'draft',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `islands/${island.id}`);
    }
  };

  const shareArchipelago = async (archipelago: Archipelago, targetUids?: string[]) => {
    if (!user || !progress) return;

    const constituentIslands = progress.islands.filter((entry) => entry.archipelagoId === archipelago.id);
    const targetArchipelagoId = archipelago.publishedId || archipelago.id;
    const publishedArchipelagosRef = doc(db, 'published_archipelagos', targetArchipelagoId);

    const isTargeted = targetUids && targetUids.length > 0;

    const publicData = {
      id: targetArchipelagoId,
      name: archipelago.name,
      islandCount: constituentIslands.length,
      islands: constituentIslands.map((island) => ({
        name: island.name,
        cards: island.cards.map((card) => sanitizeCardForPublic(card)),
      })),
      authorId: user.uid,
      authorName: user.displayName || 'Explorer',
      isPublic: !isTargeted,
      sharedWith: isTargeted ? targetUids : [],
      downloads: 0,
      publishedAt: serverTimestamp(),
    };

    try {
      await setDoc(publishedArchipelagosRef, publicData);
      const updatedArchipelagos = (progress.archipelagos || []).map((entry) =>
        entry.id === archipelago.id 
          ? { 
              ...entry, 
              isPublic: !isTargeted, 
              sharedWith: isTargeted ? targetUids : [], 
              publishedId: targetArchipelagoId 
            } 
          : entry
      );
      await updateArchipelagos(updatedArchipelagos);
      return targetArchipelagoId;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `published_archipelagos/${targetArchipelagoId}`);
    }
  };

  const unshareArchipelago = async (archipelago: Archipelago) => {
    if (!user || !progress) return;

    let publishedIds = archipelago.publishedId ? [archipelago.publishedId] : [];
    if (!publishedIds.length) {
      try {
        const snapshot = await getDocs(query(collection(db, 'published_archipelagos'), where('authorId', '==', user.uid), limit(100)));
        publishedIds = snapshot.docs.filter((docSnap) => (docSnap.data() as any).name === archipelago.name).map((docSnap) => docSnap.id);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'published_archipelagos');
        return;
      }
    }

    try {
      await Promise.all(publishedIds.map((id) => deleteDoc(doc(db, 'published_archipelagos', id))));
      const updatedArchipelagos = (progress.archipelagos || []).map((entry) =>
        entry.id === archipelago.id ? { ...entry, isPublic: false, sharedWith: [], publishedId: undefined } : entry
      );
      await updateArchipelagos(updatedArchipelagos);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `published_archipelagos/${archipelago.id}`);
    }
  };

  const deletePublishedIsland = async (publishedId: string) => {
    try {
      await deleteDoc(doc(db, 'published_islands', publishedId));
      if (progress) {
        const localMatch = progress.islands.find(i => i.publishedId === publishedId || i.id === publishedId);
        if (localMatch) {
          await updateDoc(doc(db, 'islands', localMatch.id), {
            isPublic: false,
            approvalStatus: 'draft'
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `published_islands/${publishedId}`);
    }
  };

  const deletePublishedArchipelago = async (publishedId: string) => {
    try {
      await deleteDoc(doc(db, 'published_archipelagos', publishedId));
      if (progress) {
        const localMatch = progress.archipelagos?.find(a => a.publishedId === publishedId || a.id === publishedId);
        if (localMatch) {
          const updatedArchipelagos = (progress.archipelagos || []).map((entry) =>
            entry.id === localMatch.id ? { ...entry, isPublic: false, publishedId: undefined } : entry
          );
          await updateArchipelagos(updatedArchipelagos);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `published_archipelagos/${publishedId}`);
    }
  };

  const discoverArchipelagos = async (searchTerm?: string) => {
    try {
      const publicQuery = query(collection(db, 'published_archipelagos'), where('isPublic', '==', true), limit(100));
      const targetedQuery = user ? query(collection(db, 'published_archipelagos'), where('sharedWith', 'array-contains', user.uid), limit(100)) : null;

      const [publicSnap, targetedSnap] = await Promise.all([
        getDocs(publicQuery),
        targetedQuery ? getDocs(targetedQuery) : Promise.resolve({ docs: [] })
      ]);

      const mergedMap = new Map();
      publicSnap.docs.forEach(docSnap => mergedMap.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() as any) }));
      if (targetedSnap) {
        targetedSnap.docs.forEach(docSnap => mergedMap.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() as any) }));
      }
      
      let results = Array.from(mergedMap.values());

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        results = results.filter((entry) => entry.name.toLowerCase().includes(term));
      } else {
        results = results.sort((a, b) => {
          const timeA = a.publishedAt?.toMillis ? a.publishedAt.toMillis() : 0;
          const timeB = b.publishedAt?.toMillis ? b.publishedAt.toMillis() : 0;
          return timeB - timeA;
        });
      }

      return results.slice(0, 20);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'published_archipelagos');
      return [];
    }
  };

  const importArchipelago = async (sharedArchipelago: any) => {
    if (!progress || !user) return;

    const newArchipelagoId = randomId();
    const newArchipelago: Archipelago = {
      id: newArchipelagoId,
      name: sharedArchipelago.name,
    };

    const newIslands: Island[] = (sharedArchipelago.islands || []).map((island: any) => ({
      id: randomId(),
      name: island.name,
      archipelagoId: newArchipelagoId,
      color_score: 50,
      cards: (island.cards || []).map((card: Card, index: number) => normalizeCard(card, index)),
      createdAt: Date.now(),
      isPublic: false,
      approvalStatus: 'draft',
      isImported: true,
    }));

    try {
      const batch = writeBatch(db);
      newIslands.forEach((island) => {
        batch.set(doc(db, 'islands', island.id), toIslandDocument(island, user.uid, user.email));
        island.cards.forEach((card, index) => {
          batch.set(doc(db, 'cards', card.id!), toCardDocument(card, island.id, user.uid, index));
        });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'islands');
      return;
    }

    try {
      const sourceRef = doc(db, 'published_archipelagos', sharedArchipelago.id);
      const sourceDoc = await getDoc(sourceRef);
      if (sourceDoc.exists()) {
        await updateDoc(sourceRef, {
          downloads: (sourceDoc.data().downloads || 0) + 1,
        });
      }
    } catch (error) {
      console.warn('Could not increment download count.');
    }

    await updateArchipelagos([...(progress.archipelagos || []), { ...newArchipelago, isImported: true }]);
  };

  const discoverIslands = async (searchTerm?: string) => {
    try {
      const publicQuery = query(collection(db, 'published_islands'), where('isPublic', '==', true), limit(100));
      const targetedQuery = user ? query(collection(db, 'published_islands'), where('sharedWith', 'array-contains', user.uid), limit(100)) : null;

      const [publicSnap, targetedSnap] = await Promise.all([
        getDocs(publicQuery),
        targetedQuery ? getDocs(targetedQuery) : Promise.resolve({ docs: [] })
      ]);

      const mergedMap = new Map();
      publicSnap.docs.forEach(docSnap => mergedMap.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() as any) }));
      if (targetedSnap) {
        targetedSnap.docs.forEach(docSnap => mergedMap.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() as any) }));
      }

      let results = Array.from(mergedMap.values()) as Island[];

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        results = results.filter((entry) => entry.name.toLowerCase().includes(term));
      } else {
        results = results.sort((a, b) => {
          const timeA = (a as any).publishedAt?.toMillis ? (a as any).publishedAt.toMillis() : 0;
          const timeB = (b as any).publishedAt?.toMillis ? (b as any).publishedAt.toMillis() : 0;
          return timeB - timeA;
        });
      }

      return results.slice(0, 20);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'published_islands');
      return [];
    }
  };

  const importIsland = async (island: Island) => {
    if (!progress || !user) return;

    const newIslandId = randomId();
    const importedCards = (island.cards || []).map((card, index) => normalizeCard(card, index));
    const newIsland: Island = {
      ...island,
      id: newIslandId,
      cards: importedCards,
      color_score: 50,
      isPublic: false,
      approvalStatus: 'draft',
      downloads: (island.downloads || 0) + 1,
      createdAt: Date.now(),
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'islands', newIslandId), toIslandDocument(newIsland, user.uid, user.email));
      importedCards.forEach((card, index) => {
        batch.set(doc(db, 'cards', card.id!), toCardDocument(card, newIslandId, user.uid, index));
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `islands/${newIslandId}`);
      return;
    }

    try {
      const sourceRef = doc(db, 'published_islands', island.id);
      const sourceDoc = await getDoc(sourceRef);
      if (sourceDoc.exists()) {
        await updateDoc(sourceRef, {
          downloads: (sourceDoc.data().downloads || 0) + 1,
        });
      }
    } catch (error) {
      console.warn('Could not increment download count, but importing anyway.');
    }
  };

  const moveCardBetweenIslands = async (sourceIslandId: string, targetIslandId: string, cardIndex: number) => {
    if (!progress) return;

    const sourceIsland = progress.islands.find((island) => island.id === sourceIslandId);
    const targetIsland = progress.islands.find((island) => island.id === targetIslandId);
    const cardToMove = sourceIsland?.cards[cardIndex];
    if (!sourceIsland || !targetIsland || !cardToMove?.id) return;

    const sourceRemaining = sourceIsland.cards.filter((_, index) => index !== cardIndex);
    const batch = writeBatch(db);

    sourceRemaining.forEach((card, index) => {
      if (card.id) {
        batch.update(doc(db, 'cards', card.id), { position: index });
      }
    });

    targetIsland.cards.forEach((card, index) => {
      if (card.id) {
        batch.update(doc(db, 'cards', card.id), { position: index + 1 });
      }
    });

    batch.update(doc(db, 'cards', cardToMove.id), {
      islandId: targetIslandId,
      position: 0,
    });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `cards/${cardToMove.id}`);
    }
  };

  return {
    progress,
    loading,
    updateIslands,
    updateArchipelagos,
    updateSettings,
    addArchipelago,
    removeArchipelago,
    addIsland,
    updateIsland,
    removeIsland,
    addCardToIsland,
    addCardsToIsland,
    updateCardInIsland,
    removeCardFromIsland,
    moveCardBetweenIslands,
    processSessionResults,
    processArchipelagoResults,
    shareIsland,
    unshareIsland,
    shareArchipelago,
    unshareArchipelago,
    discoverIslands,
    discoverArchipelagos,
    importIsland,
    importArchipelago,
    deletePublishedIsland,
    deletePublishedArchipelago,
  };
}
