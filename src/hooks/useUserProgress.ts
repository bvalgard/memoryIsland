import { useEffect, useRef, useState } from 'react';
import {
  Timestamp,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, isConfigPlaceholder } from '../firebase';
import { SessionMeta } from '../achievements';

export type CardStatus = 'learning' | 'struggling' | 'mastered';
export type CardUpdateRecord = Record<string, {
  status: CardStatus;
  consecutiveCorrect?: number;
  lastReviewed?: number;
  wasDemoted?: boolean;
  demotionCount?: number;
  srsInterval?: number;
  srsEaseFactor?: number;
  srsNextReview?: number;
  srsRepetitions?: number;
  sessionAnswers?: number;
  sessionCorrect?: number;
}>;

export interface UserCardProgress {
  status?: CardStatus;
  consecutiveCorrect?: number;
  lastReviewed?: number;
  needsWork?: boolean;
  demotionCount?: number;
  srsInterval?: number;
  srsEaseFactor?: number;
  srsNextReview?: number;
  srsRepetitions?: number;
  totalAnswers?: number;
  totalCorrect?: number;
}

export interface Card {
  id?: string;
  front: string;
  back: string;
  type?: 'flashcard' | 'mcq' | 'matching' | 'fill-in-the-blank' | 'multi-select' | 'sequencing';
  options?: string[];
  correctOptions?: string[];
  explanations?: Record<string, string>;
  explanation?: string;
  pairs?: { id: string; left: string; rights: string[] }[];
  needsWork?: boolean;
  status?: CardStatus;
  consecutiveCorrect?: number;
  lastReviewed?: number;
  prevTierCardId?: string;
  tier?: number;
  hint?: string;
  demotionCount?: number;
  imageUrl?: string;
  backImageUrl?: string;
  imageCredit?: string;
  backImageCredit?: string;
  srsInterval?: number;
  srsEaseFactor?: number;
  srsNextReview?: number;
  srsRepetitions?: number;
  totalAnswers?: number;
  totalCorrect?: number;
  islandName?: string;
  userProgress?: Record<string, UserCardProgress>;
  scenarioId?: string;
  scenarioText?: string;
  scenarioOrder?: number;
}

export interface Archipelago {
  id: string;
  name: string;
  isPublic?: boolean;
  publishedId?: string;
  isImported?: boolean;
  sharedWith?: string[];
  sharedAtTimestamps?: Record<string, number>;
  isCollaborative?: boolean;
  collaborators?: string[];
  ownerId?: string;
  isTopLevel?: boolean;
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
  sharedAtTimestamps?: Record<string, number>;
  isCollaborative?: boolean;
  collaborators?: string[];
  ownerId?: string;
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
  calibrationCorrect?: number;
  calibrationTotal?: number;
  studyHourStats?: Record<string, { sessions: number; correct: number; total: number }>;
}

export interface UserSettings {
  learningStreakNeeded: number;
  masteryStreakNeeded: number;
  showOnGlobalLeaderboard: boolean;
  progressTrackingMode: 'srs' | 'status' | 'both';
  sessionDisplay: 'focused' | 'stats';
}

export interface UserProgress {
  last_active: Timestamp;
  islands: Island[];
  archipelagos?: Archipelago[];
  stats?: UserStats;
  settings?: UserSettings;
  achievements?: string[];
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
  achievements?: string[];
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
  sharedAtTimestamps?: Record<string, number>;
  isCollaborative?: boolean;
  collaborators?: string[];
}

interface ArchipelagoDocumentData {
  id: string;
  name: string;
  ownerId: string;
  collaborators: string[];
  isCollaborative: boolean;
  isPublic?: boolean;
  publishedId?: string;
  sharedWith?: string[];
  sharedAtTimestamps?: Record<string, number>;
  createdAt: number;
}

interface CardDocumentData extends Card {
  islandId: string;
  ownerId: string;
  position: number;
  createdAt?: number;
  userProgress?: Record<string, UserCardProgress>;
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
  progressTrackingMode: 'srs',
  sessionDisplay: 'stats',
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
    explanation: card.explanation || '',
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
    explanation: card.explanation || '',
    pairs: card.pairs || [],
    hint: card.hint || '',
  });
}

function sanitizeCardForPublic(card: Card) {
  return {
    // id is included so importers can reconstruct the prevTierCardId chain
    ...(card.id ? { id: card.id } : {}),
    front: card.front,
    back: card.back,
    type: card.type || 'flashcard',
    options: card.options || [],
    correctOptions: card.correctOptions || [],
    explanations: card.explanations || {},
    ...(card.explanation ? { explanation: card.explanation } : {}),
    pairs: card.pairs || [],
    hint: card.hint || '',
    ...(card.imageUrl ? { imageUrl: card.imageUrl } : {}),
    ...(card.backImageUrl ? { backImageUrl: card.backImageUrl } : {}),
    ...(card.imageCredit ? { imageCredit: card.imageCredit } : {}),
    ...(card.backImageCredit ? { backImageCredit: card.backImageCredit } : {}),
    ...(card.tier ? { tier: card.tier } : {}),
    ...(card.prevTierCardId ? { prevTierCardId: card.prevTierCardId } : {}),
    ...(card.scenarioId ? { scenarioId: card.scenarioId } : {}),
    ...(card.scenarioText ? { scenarioText: card.scenarioText } : {}),
    ...(card.scenarioOrder !== undefined ? { scenarioOrder: card.scenarioOrder } : {}),
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
    sharedAtTimestamps: island.sharedAtTimestamps || {},
    isCollaborative: island.isCollaborative || false,
    collaborators: island.collaborators || [],
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
  const [collabIslandDocs, setCollabIslandDocs] = useState<Array<{ id: string; data: IslandDocumentData }>>([]);
  const [collabCardDocs, setCollabCardDocs] = useState<Array<{ id: string; data: CardDocumentData }>>([]);
  const [topLevelArchipelagoDocs, setTopLevelArchipelagoDocs] = useState<Array<{ id: string; data: ArchipelagoDocumentData }>>([]);
  const [userLoaded, setUserLoaded] = useState(false);
  const [islandsLoaded, setIslandsLoaded] = useState(false);
  const [cardsLoaded, setCardsLoaded] = useState(false);
  const [collabIslandsLoaded, setCollabIslandsLoaded] = useState(false);
  const [collabCardsLoaded, setCollabCardsLoaded] = useState(false);
  const [topLevelArchipelagosLoaded, setTopLevelArchipelagosLoaded] = useState(false);
  const migrationInProgress = useRef(false);
  const archipelagoHealingDone = useRef(false);
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

        if ((data.dataModelVersion || 0) < 3 && !migrationInProgress.current) {
          migrationInProgress.current = true;
          try {
            const islandsRef = collection(db, 'islands');
            const q = query(islandsRef, where('ownerId', '==', user.uid), where('isImported', '==', true));
            const badIslands = await getDocs(q);
            const needsArchipelagoFix = (data.archipelagos || []).some((a: any) => a.isImported);
            const batch = writeBatch(db);
            badIslands.docs.forEach(islandDoc => {
              batch.update(islandDoc.ref, { isImported: false });
            });
            const userUpdate: Record<string, unknown> = { dataModelVersion: 3 };
            if (needsArchipelagoFix) {
              userUpdate.archipelagos = (data.archipelagos || []).map((a: any) => ({ ...a, isImported: false }));
            }
            batch.update(userRef, userUpdate);
            await batch.commit();
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

    // Collaborative islands where this user is a collaborator (not the owner)
    const collabIslandsQuery = query(collection(db, 'islands'), where('collaborators', 'array-contains', user.uid));
    const unsubscribeCollabIslands = onSnapshot(
      collabIslandsQuery,
      (snapshot) => {
        setCollabIslandDocs(snapshot.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() as IslandDocumentData })));
        setCollabIslandsLoaded(true);
      },
      (error) => {
        console.warn('Could not load collaborative islands:', error);
        setCollabIslandsLoaded(true);
      }
    );

    // Top-level collaborative archipelagos (owned or collaborated)
    const ownedArchipelagosQuery = query(collection(db, 'archipelagos'), where('ownerId', '==', user.uid));
    const collabArchipelagosQuery = query(collection(db, 'archipelagos'), where('collaborators', 'array-contains', user.uid));
    let ownedArchipelagoDocs: Array<{ id: string; data: ArchipelagoDocumentData }> = [];
    let collabArchipelagosFromQuery: Array<{ id: string; data: ArchipelagoDocumentData }> = [];
    let ownedLoaded = false;
    let collabLoaded = false;

    const mergeAndSetTopLevel = () => {
      if (!ownedLoaded || !collabLoaded) return;
      const seen = new Set<string>();
      const merged: Array<{ id: string; data: ArchipelagoDocumentData }> = [];
      for (const entry of [...ownedArchipelagoDocs, ...collabArchipelagosFromQuery]) {
        if (!seen.has(entry.id)) {
          seen.add(entry.id);
          merged.push(entry);
        }
      }
      setTopLevelArchipelagoDocs(merged);
      setTopLevelArchipelagosLoaded(true);
    };

    const unsubscribeOwnedArchipelagos = onSnapshot(
      ownedArchipelagosQuery,
      (snapshot) => {
        ownedArchipelagoDocs = snapshot.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() as ArchipelagoDocumentData }));
        ownedLoaded = true;
        mergeAndSetTopLevel();
      },
      (error) => {
        console.warn('Could not load owned top-level archipelagos:', error);
        ownedLoaded = true;
        mergeAndSetTopLevel();
      }
    );

    const unsubscribeCollabArchipelagos = onSnapshot(
      collabArchipelagosQuery,
      (snapshot) => {
        collabArchipelagosFromQuery = snapshot.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() as ArchipelagoDocumentData }));
        collabLoaded = true;
        mergeAndSetTopLevel();
      },
      (error) => {
        console.warn('Could not load collaborative archipelagos:', error);
        collabLoaded = true;
        mergeAndSetTopLevel();
      }
    );

    return () => {
      unsubscribeUser();
      unsubscribeIslands();
      unsubscribeCards();
      unsubscribeCollabIslands();
      unsubscribeOwnedArchipelagos();
      unsubscribeCollabArchipelagos();
    };
  }, [user]);

  // Real-time listener for cards in collaborative islands
  useEffect(() => {
    if (!user || collabIslandDocs.length === 0) {
      setCollabCardDocs([]);
      setCollabCardsLoaded(true);
      return;
    }

    const collabIslandIds = collabIslandDocs.map((d) => d.id);
    const chunks = chunk(collabIslandIds, 30);

    // One Map per chunk; rebuilt into collabCardDocs whenever any chunk fires
    const chunkMaps: Map<string, CardDocumentData>[] = chunks.map(() => new Map());
    const chunkLoaded: boolean[] = chunks.map(() => false);
    let active = true;

    const rebuild = () => {
      if (!active || !chunkLoaded.every(Boolean)) return;
      const merged: Array<{ id: string; data: CardDocumentData }> = [];
      chunkMaps.forEach(m => m.forEach((data, id) => merged.push({ id, data })));
      setCollabCardDocs(merged);
      setCollabCardsLoaded(true);
    };

    const unsubscribers = chunks.map((ids, i) =>
      onSnapshot(
        query(collection(db, 'cards'), where('islandId', 'in', ids)),
        (snapshot) => {
          const m = new Map<string, CardDocumentData>();
          snapshot.docs.forEach(d => m.set(d.id, d.data() as CardDocumentData));
          chunkMaps[i] = m;
          chunkLoaded[i] = true;
          rebuild();
        },
        (error) => {
          console.warn('Could not load collaborative island cards:', error);
          chunkLoaded[i] = true;
          rebuild();
        }
      )
    );

    return () => {
      active = false;
      unsubscribers.forEach(u => u());
    };
  }, [collabIslandDocs, user]);

  useEffect(() => {
    if (!userLoaded || !islandsLoaded || !cardsLoaded || !collabIslandsLoaded || !collabCardsLoaded || !topLevelArchipelagosLoaded || !userData) {
      setLoading(true);
      return;
    }

    const uid = user?.uid;
    const collabIslandIds = new Set(collabIslandDocs.map((d) => d.id));

    const cardsByIsland = new Map<string, Card[]>();

    const assembleCard = (id: string, data: CardDocumentData, isCollab: boolean): Card => {
      const userProg = isCollab && uid ? data.userProgress?.[uid] : undefined;
      return {
        id,
        front: data.front,
        back: data.back,
        type: data.type,
        options: data.options || [],
        correctOptions: data.correctOptions || [],
        explanations: data.explanations || {},
        explanation: data.explanation || '',
        pairs: data.pairs || [],
        hint: data.hint || '',
        prevTierCardId: data.prevTierCardId,
        tier: data.tier,
        imageUrl: data.imageUrl,
        backImageUrl: data.backImageUrl,
        imageCredit: data.imageCredit,
        backImageCredit: data.backImageCredit,
        // Per-user progress: read from userProgress map for collab cards, fall back to top-level
        needsWork: userProg?.needsWork ?? data.needsWork,
        status: userProg?.status ?? data.status,
        consecutiveCorrect: userProg?.consecutiveCorrect ?? data.consecutiveCorrect,
        lastReviewed: userProg?.lastReviewed ?? data.lastReviewed,
        demotionCount: userProg?.demotionCount ?? data.demotionCount,
        srsInterval: userProg?.srsInterval ?? data.srsInterval,
        srsEaseFactor: userProg?.srsEaseFactor ?? data.srsEaseFactor,
        srsNextReview: userProg?.srsNextReview ?? data.srsNextReview,
        srsRepetitions: userProg?.srsRepetitions ?? data.srsRepetitions,
        totalAnswers: userProg?.totalAnswers ?? data.totalAnswers,
        totalCorrect: userProg?.totalCorrect ?? data.totalCorrect,
        userProgress: isCollab ? data.userProgress : undefined,
        scenarioId: data.scenarioId,
        scenarioText: data.scenarioText,
        scenarioOrder: data.scenarioOrder,
      };
    };

    // Merge owned cards and collab cards, deduplicating by id
    const seenCardIds = new Set<string>();
    [...cardDocs, ...collabCardDocs]
      .sort((a, b) => a.data.position - b.data.position)
      .forEach(({ data, id }) => {
        if (seenCardIds.has(id)) return;
        seenCardIds.add(id);
        const isCollab = collabIslandIds.has(data.islandId);
        const existing = cardsByIsland.get(data.islandId) || [];
        existing.push(assembleCard(id, data, isCollab));
        cardsByIsland.set(data.islandId, existing);
      });

    // Merge owned islands and collab islands, deduplicating by id
    const seenIslandIds = new Set<string>();
    const allIslandDocs = [...islandDocs, ...collabIslandDocs]
      .sort((a, b) => (a.data.createdAt || 0) - (b.data.createdAt || 0));

    const assembledIslands: Island[] = allIslandDocs
      .filter(({ id }) => {
        if (seenIslandIds.has(id)) return false;
        seenIslandIds.add(id);
        return true;
      })
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
        sharedAtTimestamps: data.sharedAtTimestamps || {},
        isCollaborative: data.isCollaborative || false,
        collaborators: data.collaborators || [],
        ownerId: data.ownerId,
        cards: cardsByIsland.get(id) || [],
      }));

    // Merge legacy embedded archipelagos with top-level collaborative ones.
    // Deduplicate by ID — arrayUnion race conditions can create duplicate entries for the
    // same archipelago ID (one with the user's renamed name, one with "Recovered Archipelago N").
    // Keeping the first occurrence preserves the user's intended name since the rename write
    // arrives at Firestore before the healing arrayUnion in the common race condition order.
    const seenLegacyIds = new Set<string>();
    const legacyArchipelagos: Archipelago[] = (userData.archipelagos || [])
      .filter((a: any) => {
        if (!a.id || seenLegacyIds.has(a.id)) return false;
        seenLegacyIds.add(a.id);
        return true;
      })
      .map((a) => ({
        ...a,
        isTopLevel: false,
      }));
    const topLevelArchipelagos: Archipelago[] = topLevelArchipelagoDocs.map(({ id, data }) => ({
      id,
      name: data.name,
      isPublic: data.isPublic,
      publishedId: data.publishedId,
      sharedWith: data.sharedWith || [],
      sharedAtTimestamps: data.sharedAtTimestamps || {},
      isCollaborative: data.isCollaborative,
      collaborators: data.collaborators,
      ownerId: data.ownerId,
      isTopLevel: true,
    }));
    const allArchipelagos = [...legacyArchipelagos, ...topLevelArchipelagos];

    // Recover archipelago entries lost from the user doc due to past concurrent writes.
    // Islands still carry their archipelagoId; synthesize a placeholder entry so the
    // grouping remains visible and the user can rename it to heal the data.
    const knownArchipelagoIds = new Set(allArchipelagos.map((a) => a.id));
    let orphanCounter = 1;
    const orphanedEntries: Archipelago[] = [];
    for (const island of assembledIslands) {
      if (island.archipelagoId && !island.isImported && !knownArchipelagoIds.has(island.archipelagoId)) {
        knownArchipelagoIds.add(island.archipelagoId);
        orphanedEntries.push({ id: island.archipelagoId, name: `Recovered Archipelago ${orphanCounter++}`, isTopLevel: false });
      }
    }
    const finalArchipelagos = orphanedEntries.length > 0 ? [...allArchipelagos, ...orphanedEntries] : allArchipelagos;

    setProgress({
      last_active: userData.last_active || Timestamp.now(),
      archipelagos: finalArchipelagos,
      stats: { ...defaultStats, ...(userData.stats || {}) },
      settings: { ...defaultSettings, ...(userData.settings || {}) },
      islands: assembledIslands,
      achievements: userData.achievements || [],
    });
    setLoading(false);
  }, [userLoaded, islandsLoaded, cardsLoaded, collabIslandsLoaded, collabCardsLoaded, topLevelArchipelagosLoaded, userData, islandDocs, cardDocs, collabIslandDocs, collabCardDocs, topLevelArchipelagoDocs, user]);

  // One-shot per session: write recovered orphan archipelago entries back to Firestore
  // so they survive as real entries and can be renamed by the user.
  useEffect(() => {
    if (!user || isConfigPlaceholder || !userData || archipelagoHealingDone.current) return;
    const knownIds = new Set([
      ...(userData.archipelagos || []).map((a: any) => a.id),
      ...topLevelArchipelagoDocs.map((d) => d.id),
    ]);
    const orphanedIds = new Set<string>();
    for (const { data } of islandDocs) {
      if (data.archipelagoId && !data.isImported && !knownIds.has(data.archipelagoId)) {
        orphanedIds.add(data.archipelagoId);
      }
    }
    if (orphanedIds.size === 0) return;
    archipelagoHealingDone.current = true;
    let counter = 1;
    const toRestore = Array.from(orphanedIds).map((id) =>
      omitUndefined({ id, name: `Recovered Archipelago ${counter++}` })
    );
    setDoc(
      doc(db, 'users', user.uid),
      { archipelagos: arrayUnion(...toRestore), last_active: Timestamp.now() },
      { merge: true }
    ).catch(() => { archipelagoHealingDone.current = false; });
  }, [user, userData, islandDocs, topLevelArchipelagoDocs]);

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
    // Only persist legacy embedded archipelagos to the user doc — top-level ones have their own collection.
    // Deduplicate by ID to clean up any duplicate entries that may have been created by race conditions.
    const seenIds = new Set<string>();
    const embeddedOnly = newArchipelagos.filter((a) => {
      if (a.isTopLevel) return false;
      if (!a.id || seenIds.has(a.id)) return false;
      seenIds.add(a.id);
      return true;
    });
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          archipelagos: omitUndefined(embeddedOnly),
          last_active: Timestamp.now(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  // Rename an embedded archipelago using a transaction so it reads the server's authoritative
  // state rather than potentially-stale local state. This prevents the race condition where a
  // healing arrayUnion write arrives at Firestore after the rename, creating a duplicate entry
  // that reverts the visible name back to "Recovered Archipelago N".
  const renameArchipelago = async (id: string, newName: string) => {
    if (!user || isConfigPlaceholder) return;
    const userRef = doc(db, 'users', user.uid);
    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        const current: any[] = userDoc.data()?.archipelagos || [];
        // Deduplicate by ID and rename the target entry atomically
        const seenTxIds = new Set<string>();
        const updated = current
          .filter((a: any) => {
            if (!a.id || seenTxIds.has(a.id)) return false;
            seenTxIds.add(a.id);
            return true;
          })
          .map((a: any) => (a.id === id ? { ...a, name: newName } : a));
        transaction.set(
          userRef,
          { archipelagos: omitUndefined(updated), last_active: Timestamp.now() },
          { merge: true }
        );
      });
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
    if (!user || isConfigPlaceholder) return;
    const newArchipelago: Archipelago = {
      id: randomId(),
      name,
    };
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        { archipelagos: arrayUnion(omitUndefined(newArchipelago)), last_active: Timestamp.now() },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
    return newArchipelago.id;
  };

  const removeArchipelago = async (archipelagoId: string) => {
    if (!user || !progress) return;
    const archipelago = (progress.archipelagos || []).find(a => a.id === archipelagoId);
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

    if (archipelago?.isTopLevel) {
      // Top-level doc — delete from archipelagos collection
      try {
        await deleteDoc(doc(db, 'archipelagos', archipelagoId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `archipelagos/${archipelagoId}`);
      }
    } else {
      // Legacy embedded — update user doc
      const updatedArchipelagos = (progress.archipelagos || []).filter(a => a.id !== archipelagoId);
      await updateArchipelagos(updatedArchipelagos);
    }
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

    // For collaborative islands, use the island owner's uid so the owner's card query returns this card
    const cardOwnerId = island.isCollaborative ? (island.ownerId ?? user.uid) : user.uid;
    const normalized = normalizeCard(card, island.cards.length);
    try {
      await setDoc(doc(db, 'cards', normalized.id!), toCardDocument(normalized, islandId, cardOwnerId, island.cards.length));
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

    const cardOwnerId = island.isCollaborative ? (island.ownerId ?? user.uid) : user.uid;
    const batch = writeBatch(db);
    const normalizedCards = cards.map((card, index) => normalizeCard(card, island.cards.length + index));
    normalizedCards.forEach((card, index) => {
      batch.set(doc(db, 'cards', card.id!), toCardDocument(card, islandId, cardOwnerId, island.cards.length + index));
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

    const island = progress.islands.find((i) => i.id === islandId);
    if (island?.isCollaborative && island.ownerId !== user.uid) {
      throw new Error('Only the island owner can delete a collaborative island.');
    }

    const cardsToDelete = island?.cards || [];
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

  const handleStudyStatsUpdate = async (cardUpdates: CardUpdateRecord, sessionHighestStreak = 0, sessionMeta?: SessionMeta) => {
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

    const hourlyUpdate: UserStats['studyHourStats'] = { ...(progress.stats.studyHourStats || {}) };
    if (sessionMeta?.sessionStartHour !== undefined && sessionMeta.cardCount > 0) {
      const h = String(sessionMeta.sessionStartHour);
      const prev = hourlyUpdate[h] || { sessions: 0, correct: 0, total: 0 };
      hourlyUpdate[h] = {
        sessions: prev.sessions + 1,
        correct: prev.correct + (sessionMeta.correctCount || 0),
        total: prev.total + sessionMeta.cardCount,
      };
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
      ...(sessionMeta?.calibrationTotal ? {
        calibrationCorrect: (progress.stats.calibrationCorrect || 0) + (sessionMeta.calibrationCorrect || 0),
        calibrationTotal: (progress.stats.calibrationTotal || 0) + sessionMeta.calibrationTotal,
      } : {}),
      studyHourStats: hourlyUpdate,
    });
  };

  const buildCardPayload = (card: Card, update: CardUpdateRecord[string], isCollab: boolean, uid: string): Record<string, unknown> => {
    if (isCollab) {
      const prefix = `userProgress.${uid}`;
      const payload: Record<string, unknown> = {
        [`${prefix}.status`]: update.status,
        [`${prefix}.consecutiveCorrect`]: update.consecutiveCorrect ?? card.consecutiveCorrect ?? 0,
        [`${prefix}.needsWork`]: update.status === 'struggling',
        [`${prefix}.lastReviewed`]: update.lastReviewed ?? card.lastReviewed ?? Date.now(),
        [`${prefix}.totalAnswers`]: increment((update.sessionAnswers || 1)),
        [`${prefix}.totalCorrect`]: increment((update.sessionCorrect || 0)),
      };
      if (update.wasDemoted) {
        payload[`${prefix}.demotionCount`] = increment(1);
      }
      if (update.srsInterval !== undefined) {
        payload[`${prefix}.srsInterval`] = update.srsInterval;
        payload[`${prefix}.srsEaseFactor`] = update.srsEaseFactor;
        payload[`${prefix}.srsNextReview`] = update.srsNextReview;
        payload[`${prefix}.srsRepetitions`] = update.srsRepetitions;
      }
      return payload;
    }

    const payload: Record<string, unknown> = {
      status: update.status,
      consecutiveCorrect: update.consecutiveCorrect ?? card.consecutiveCorrect ?? 0,
      needsWork: update.status === 'struggling',
      lastReviewed: update.lastReviewed ?? card.lastReviewed ?? Date.now(),
      totalAnswers: (card.totalAnswers || 0) + (update.sessionAnswers || 1),
      totalCorrect: (card.totalCorrect || 0) + (update.sessionCorrect || 0),
    };
    if (update.wasDemoted) {
      payload.demotionCount = (card.demotionCount || 0) + 1;
    }
    if (update.srsInterval !== undefined) {
      payload.srsInterval = update.srsInterval;
      payload.srsEaseFactor = update.srsEaseFactor;
      payload.srsNextReview = update.srsNextReview;
      payload.srsRepetitions = update.srsRepetitions;
    }
    return payload;
  };

  const processSessionResults = async (islandId: string, delta: number, cardUpdates: CardUpdateRecord, sessionHighestStreak = 0, sessionMeta?: SessionMeta) => {
    if (!progress || !user) return;
    const island = progress.islands.find((entry) => entry.id === islandId);
    if (!island) return;

    const isCollab = island.isCollaborative === true;
    const uid = user.uid;

    const batch = writeBatch(db);
    island.cards.forEach((card) => {
      const update = cardUpdates[card.front];
      if (update && card.id) {
        batch.update(doc(db, 'cards', card.id), buildCardPayload(card, update, isCollab, uid));
      }
    });
    try {
      await batch.commit();
      await handleStudyStatsUpdate(cardUpdates, sessionHighestStreak, sessionMeta);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `islands/${islandId}`);
    }
  };

  const processArchipelagoResults = async (delta: number, cardUpdates: CardUpdateRecord, sessionHighestStreak = 0, sessionMeta?: SessionMeta) => {
    if (!progress || !user) return;

    const uid = user.uid;
    const batch = writeBatch(db);
    progress.islands.forEach((island) => {
      const isCollab = island.isCollaborative === true;
      island.cards.forEach((card) => {
        const update = cardUpdates[card.front];
        if (update && card.id) {
          batch.update(doc(db, 'cards', card.id), buildCardPayload(card, update, isCollab, uid));
        }
      });
    });

    try {
      await batch.commit();
      await handleStudyStatsUpdate(cardUpdates, sessionHighestStreak, sessionMeta);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'archipelago-session');
    }
  };

  const shareIsland = async (island: Island, targetUids?: string[]) => {
    if (!user) return;

    const isTargeted = targetUids && targetUids.length > 0;
    const publishedId = island.publishedId || island.id;
    const publishedRef = doc(db, 'published_islands', publishedId);

    let existingDownloads = island.downloads || 0;
    try {
      const existingSnap = await getDoc(publishedRef);
      if (existingSnap.exists()) existingDownloads = existingSnap.data().downloads || 0;
    } catch {
      // non-fatal: proceed with cached value
    }

    const publicData = {
      id: publishedId,
      name: island.name,
      cards: island.cards.map(card => sanitizeCardForPublic(card)),
      authorId: user.uid,
      authorName: user.displayName || 'Explorer',
      isPublic: !isTargeted,
      sharedWith: isTargeted ? targetUids : [],
      downloads: existingDownloads,
      publishedAt: serverTimestamp(),
    };

    const now = Date.now();
    const updatedTimestamps: Record<string, number> = { ...(island.sharedAtTimestamps || {}) };
    if (isTargeted) {
      targetUids!.forEach(uid => { updatedTimestamps[uid] = now; });
    }

    try {
      const batch = writeBatch(db);
      batch.set(publishedRef, publicData);
      batch.update(doc(db, 'islands', island.id), {
        isPublic: !isTargeted,
        sharedWith: isTargeted ? targetUids : [],
        sharedAtTimestamps: updatedTimestamps,
        publishedId: publishedId,
        authorId: user.uid,
        authorName: user.displayName || 'Explorer',
        approvalStatus: isTargeted ? 'approved' : 'pending',
        submittedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `published_islands/${publishedId}`);
    }
  };

  const unshareIsland = async (island: Island) => {
    if (!user) return;

    let publishedIds = island.publishedId ? [island.publishedId] : [];
    if (!publishedIds.length) {
      // shareIsland always uses island.id as the publishedId for previously-unpublished islands,
      // so island.id is the correct fallback when publishedId wasn't saved on older records.
      publishedIds = [island.id];
    }

    try {
      if (publishedIds.length > 0) {
        await Promise.all(publishedIds.map((id) => deleteDoc(doc(db, 'published_islands', id))));
      }
      await updateDoc(doc(db, 'islands', island.id), {
        isPublic: false,
        approvalStatus: 'draft',
        sharedWith: [],
        sharedAtTimestamps: {},
        publishedId: deleteField(),
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

    try {
      const existingSnap = await getDoc(publishedArchipelagosRef);
      const existingDownloads = existingSnap.exists() ? (existingSnap.data().downloads || 0) : 0;

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
        downloads: existingDownloads,
        publishedAt: serverTimestamp(),
      };

      const now = Date.now();
      const updatedTimestamps: Record<string, number> = { ...(archipelago.sharedAtTimestamps || {}) };
      if (isTargeted) {
        targetUids!.forEach(uid => { updatedTimestamps[uid] = now; });
      }
      const updatedArchipelagos = (progress.archipelagos || []).map((entry) =>
        entry.id === archipelago.id
          ? {
              ...entry,
              isPublic: !isTargeted,
              sharedWith: isTargeted ? targetUids : [],
              sharedAtTimestamps: updatedTimestamps,
              publishedId: targetArchipelagoId
            }
          : entry
      );

      const batch = writeBatch(db);
      batch.set(publishedArchipelagosRef, publicData);
      batch.set(
        doc(db, 'users', user.uid),
        { archipelagos: omitUndefined(updatedArchipelagos), last_active: Timestamp.now() },
        { merge: true }
      );
      await batch.commit();
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
        entry.id === archipelago.id ? { ...entry, isPublic: false, sharedWith: [], sharedAtTimestamps: {}, publishedId: undefined } : entry
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
      if (targetedQuery) {
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

    const newIslands: Island[] = (sharedArchipelago.islands || []).map((island: any) => {
      const sourceCards: Card[] = island.cards || [];

      // Strip the published id so normalizeCard generates a fresh one, but capture
      // the original→new mapping so prevTierCardId links can be remapped.
      const idMap = new Map<string, string>();
      const normalizedCards = sourceCards.map((card, index) => {
        const normalized = normalizeCard({ ...card, id: undefined }, index);
        if (card.id) idMap.set(card.id, normalized.id!);
        return normalized;
      });
      normalizedCards.forEach(card => {
        if (card.prevTierCardId) {
          card.prevTierCardId = idMap.get(card.prevTierCardId) ?? card.prevTierCardId;
        }
      });

      return {
        id: randomId(),
        name: island.name,
        archipelagoId: newArchipelagoId,
        color_score: 50,
        cards: normalizedCards,
        createdAt: Date.now(),
        isPublic: false,
        approvalStatus: 'draft',
      };
    });

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
      await updateDoc(sourceRef, { downloads: increment(1) });
    } catch (error) {
      console.warn('Could not increment download count.');
    }

    await updateArchipelagos([...(progress.archipelagos || []), newArchipelago]);
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
      if (targetedQuery) {
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
    const sourceCards = island.cards || [];

    // Strip the published id so normalizeCard generates a fresh one, but capture
    // the original→new mapping so prevTierCardId links can be remapped.
    const idMap = new Map<string, string>();
    const importedCards = sourceCards.map((card, index) => {
      const normalized = normalizeCard({ ...card, id: undefined }, index);
      if (card.id) idMap.set(card.id, normalized.id!);
      return normalized;
    });
    importedCards.forEach(card => {
      if (card.prevTierCardId) {
        card.prevTierCardId = idMap.get(card.prevTierCardId) ?? card.prevTierCardId;
      }
    });

    const newIsland: Island = {
      id: newIslandId,
      name: island.name,
      cards: importedCards,
      color_score: 50,
      isPublic: false,
      approvalStatus: 'draft',
      authorId: island.authorId,
      authorName: island.authorName,
      downloads: 0,
      createdAt: Date.now(),
      isImported: false,
      sharedWith: [],
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
      await updateDoc(sourceRef, { downloads: increment(1) });
    } catch (error) {
      console.warn('Could not increment download count, but importing anyway.');
    }
  };

  const dismissShare = async (collection_name: 'published_islands' | 'published_archipelagos', docId: string) => {
    if (!user) throw new Error('Not signed in');
    await updateDoc(doc(db, collection_name, docId), {
      sharedWith: arrayRemove(user.uid),
    });
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

  const createCollaborativeIsland = async (name: string, collaboratorUids: string[], archipelagoId?: string): Promise<string | undefined> => {
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
        isCollaborative: true,
        collaborators: collaboratorUids,
      }, user.uid, user.email));
      return islandId;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `islands/${islandId}`);
    }
  };

  const addCollaborator = async (islandId: string, uid: string) => {
    if (!user || !progress) return;
    const island = progress.islands.find((i) => i.id === islandId);
    if (!island || island.ownerId !== user.uid) {
      throw new Error('Only the island owner can add collaborators.');
    }
    try {
      await updateDoc(doc(db, 'islands', islandId), { collaborators: arrayUnion(uid) });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `islands/${islandId}`);
    }
  };

  const removeCollaborator = async (islandId: string, uid: string) => {
    if (!user || !progress) return;
    const island = progress.islands.find((i) => i.id === islandId);
    if (!island || island.ownerId !== user.uid) {
      throw new Error('Only the island owner can remove collaborators.');
    }
    try {
      await updateDoc(doc(db, 'islands', islandId), { collaborators: arrayRemove(uid) });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `islands/${islandId}`);
    }
  };

  const createCollaborativeArchipelago = async (name: string, collaboratorUids: string[]): Promise<string | undefined> => {
    if (!user) return;
    const archipelagoId = randomId();
    const docData: ArchipelagoDocumentData = {
      id: archipelagoId,
      name,
      ownerId: user.uid,
      collaborators: collaboratorUids,
      isCollaborative: true,
      isPublic: false,
      sharedWith: [],
      sharedAtTimestamps: {},
      createdAt: Date.now(),
    };
    try {
      await setDoc(doc(db, 'archipelagos', archipelagoId), docData);
      return archipelagoId;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `archipelagos/${archipelagoId}`);
    }
  };

  const addArchipelagoCollaborator = async (archipelagoId: string, uid: string) => {
    if (!user || !progress) return;
    const archipelago = (progress.archipelagos || []).find((a) => a.id === archipelagoId);
    if (!archipelago?.isTopLevel || archipelago.ownerId !== user.uid) {
      throw new Error('Only the archipelago owner can add collaborators.');
    }
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'archipelagos', archipelagoId), { collaborators: arrayUnion(uid) });
      // Cascade: add the new collaborator to every island inside this archipelago
      progress.islands
        .filter(i => i.archipelagoId === archipelagoId)
        .forEach(island => {
          batch.update(doc(db, 'islands', island.id), {
            collaborators: arrayUnion(uid),
            isCollaborative: true,
          });
        });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `archipelagos/${archipelagoId}`);
    }
  };

  const removeArchipelagoCollaborator = async (archipelagoId: string, uid: string) => {
    if (!user || !progress) return;
    const archipelago = (progress.archipelagos || []).find((a) => a.id === archipelagoId);
    if (!archipelago?.isTopLevel || archipelago.ownerId !== user.uid) {
      throw new Error('Only the archipelago owner can remove collaborators.');
    }
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'archipelagos', archipelagoId), { collaborators: arrayRemove(uid) });
      // Cascade: remove the collaborator from every island they don't own inside this archipelago
      progress.islands
        .filter(i => i.archipelagoId === archipelagoId && i.ownerId !== uid)
        .forEach(island => {
          batch.update(doc(db, 'islands', island.id), { collaborators: arrayRemove(uid) });
        });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `archipelagos/${archipelagoId}`);
    }
  };

  return {
    progress,
    loading,
    updateIslands,
    updateArchipelagos,
    renameArchipelago,
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
    dismissShare,
    createCollaborativeIsland,
    addCollaborator,
    removeCollaborator,
    createCollaborativeArchipelago,
    addArchipelagoCollaborator,
    removeArchipelagoCollaborator,
  };
}

export const saveUnlockedAchievements = async (uid: string, newIds: string[]) => {
  if (!newIds.length) return;
  await updateDoc(doc(db, 'users', uid), {
    achievements: arrayUnion(...newIds),
  });
};
