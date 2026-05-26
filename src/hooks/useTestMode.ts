import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Card } from './useUserProgress';

export type CardType = 'flashcard' | 'mcq' | 'matching' | 'fill-in-the-blank' | 'multi-select' | 'sequencing';
export const ALL_CARD_TYPES: CardType[] = ['mcq', 'multi-select', 'sequencing', 'fill-in-the-blank', 'matching', 'flashcard'];

export interface TestConfig {
  islandIds: string[];
  questionLimit: number | 'all';
  questionTypes: CardType[];
  timeLimitMode: 'none' | 'per-question' | 'total';
  timeLimitSeconds?: number;
  totalTimeLimitSeconds?: number;
  questionOrder: 'shuffled' | 'sequential';
}

export interface TestDefinition {
  id?: string;
  uid: string;
  name: string;
  config: TestConfig;
  cardSnapshot: Card[];
  createdAt: number;
  lastAttemptAt: number;
  attemptCount: number;
  bestScore: number;
}

export interface TestQuestionResult {
  cardId: string;
  islandId: string;
  islandName: string;
  correct: boolean;
  timeMs: number;
  front: string;
  back: string;
  type: string;
}

export interface TestIslandBreakdown {
  islandName: string;
  correct: number;
  total: number;
}

export interface TestSessionDoc {
  id?: string;
  uid: string;
  testId?: string;
  config: TestConfig;
  startedAt: number;
  completedAt: number;
  totalCards: number;
  correctCards: number;
  scorePercent: number;
  avgTimeMs: number;
  islandBreakdown: Record<string, TestIslandBreakdown>;
  questions: TestQuestionResult[];
}

function stripUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined) as unknown as T;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v !== undefined) result[k] = stripUndefined(v);
  }
  return result as T;
}

export async function createTestDef(def: Omit<TestDefinition, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'tests'), stripUndefined(def));
  return ref.id;
}

export async function updateTestDef(testId: string, update: Partial<Omit<TestDefinition, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'tests', testId), update);
}

export async function getUserTestDefs(uid: string): Promise<TestDefinition[]> {
  const q = query(collection(db, 'tests'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as TestDefinition))
    .sort((a, b) => b.lastAttemptAt - a.lastAttemptAt);
}

export async function saveTestSession(session: Omit<TestSessionDoc, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'test-sessions'), {
    ...stripUndefined(session),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getTestHistory(uid: string, maxResults = 100): Promise<TestSessionDoc[]> {
  // No orderBy — avoids composite index requirement; sort client-side after fetch.
  const q = query(
    collection(db, 'test-sessions'),
    where('uid', '==', uid),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as TestSessionDoc))
    .sort((a, b) => b.completedAt - a.completedAt);
}

function shuffleArray<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildTestDeck(
  islandCards: { island: { id: string; name: string }; cards: Card[] }[],
  config: TestConfig
): Card[] {
  const filtered: Card[] = [];
  for (const { island, cards } of islandCards) {
    for (const card of cards) {
      const type = (card.type ?? 'flashcard') as CardType;
      if (!config.questionTypes.includes(type)) continue;
      filtered.push({ ...card, islandId: island.id, islandName: island.name });
    }
  }

  const groupMap = new Map<string, Card[]>();
  const standalones: Card[] = [];

  for (const card of filtered) {
    if (card.scenarioId) {
      const g = groupMap.get(card.scenarioId) ?? [];
      g.push(card);
      groupMap.set(card.scenarioId, g);
    } else {
      standalones.push(card);
    }
  }

  for (const g of groupMap.values()) {
    g.sort((a, b) => (a.scenarioOrder ?? 0) - (b.scenarioOrder ?? 0));
  }

  const units: Card[][] = [
    ...standalones.map(c => [c]),
    ...[...groupMap.values()],
  ];

  const ordered = config.questionOrder === 'sequential' ? units : shuffleArray(units);
  const flat = ordered.flat();

  if (config.questionLimit === 'all') return flat;
  return flat.slice(0, config.questionLimit);
}
