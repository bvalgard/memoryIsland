import { useState, useRef } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  increment,
  serverTimestamp,
  onSnapshot,
  deleteField,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Card } from './useUserProgress';

export interface Question {
  id: string;
  cardId: string;
  islandId: string;
  frontText: string;
  backText: string;
  cardType: string;
  askerId: string;
  askerName: string;
  status: 'open' | 'answered' | 'expired';
  acceptedAnswerId: string | null;
  answerCount: number;
  visibility: 'friends' | 'global';
  visibleTo: string[];
  isAnonymous?: boolean;
  aiHint?: string;
  aiHintGeneratedAt?: number;
  createdAt: Timestamp;
  lastActivityAt: Timestamp;
}

export interface Answer {
  id: string;
  questionId: string;
  helperId: string;
  helperName: string;
  bodyText: string;
  upvoterIds: Record<string, true>;
  voteCount: number;
  isAccepted: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Comment {
  id: string;
  answerId: string;
  authorId: string;
  authorName: string;
  bodyText: string;
  createdAt: Timestamp;
}

const QUESTION_STALE_DAYS = 14;

export function useQuestions() {
  const [feedQuestions, setFeedQuestions] = useState<Question[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [myQuestions, setMyQuestions] = useState<Question[]>([]);
  const [myQuestionsLoading, setMyQuestionsLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Answer[]>>({});
  const [answersLoading, setAnswersLoading] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});

  // Map of questionId → onSnapshot unsubscribe fn
  const answerListeners = useRef<Record<string, () => void>>({});

  const askQuestion = async (
    card: Card,
    islandId: string,
    visibility: 'friends' | 'global',
    friendUids: string[],
    askerName: string,
    isAnonymous = false
  ): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user || !card.id) return null;

    // Deduplicate: return existing open question for this card+asker
    const existing = await getDocs(
      query(
        collection(db, 'questions'),
        where('cardId', '==', card.id),
        where('askerId', '==', user.uid),
        where('status', '==', 'open'),
        limit(1)
      )
    );
    if (!existing.empty) return existing.docs[0].id;

    const ref = await addDoc(collection(db, 'questions'), {
      cardId: card.id,
      islandId,
      frontText: card.front,
      backText: card.back ?? '',
      cardType: card.type ?? 'flashcard',
      askerId: user.uid,
      askerName: isAnonymous ? 'Anonymous Explorer' : (askerName || user.displayName || 'Explorer'),
      isAnonymous,
      status: 'open',
      acceptedAnswerId: null,
      answerCount: 0,
      visibility,
      visibleTo: visibility === 'friends' ? friendUids : [],
      createdAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
    });
    return ref.id;
  };

  const postAnswer = async (questionId: string, bodyText: string): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user) return null;

    const questionRef = doc(db, 'questions', questionId);
    const answerRef = doc(collection(db, 'questions', questionId, 'answers'));

    const batch = writeBatch(db);
    batch.set(answerRef, {
      questionId,
      helperId: user.uid,
      helperName: user.displayName || 'Explorer',
      bodyText,
      upvoterIds: {},
      voteCount: 0,
      isAccepted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(questionRef, {
      answerCount: increment(1),
      lastActivityAt: serverTimestamp(),
    });
    // Reputation: totalAnswers++
    const repRef = doc(db, 'user_reputation', user.uid);
    batch.set(repRef, { totalAnswers: increment(1) }, { merge: true });

    await batch.commit();
    return answerRef.id;
  };

  const postComment = async (
    questionId: string,
    answerId: string,
    bodyText: string
  ): Promise<void> => {
    const user = auth.currentUser;
    if (!user) return;
    await addDoc(collection(db, 'questions', questionId, 'answers', answerId, 'comments'), {
      answerId,
      authorId: user.uid,
      authorName: user.displayName || 'Explorer',
      bodyText,
      createdAt: serverTimestamp(),
    });
  };

  const voteAnswer = async (
    questionId: string,
    answerId: string,
    currentUpvoterIds: Record<string, true>
  ): Promise<void> => {
    const user = auth.currentUser;
    if (!user) return;

    const answerRef = doc(db, 'questions', questionId, 'answers', answerId);
    const hasVoted = user.uid in currentUpvoterIds;
    const helperId = answers[questionId]?.find(a => a.id === answerId)?.helperId;

    const batch = writeBatch(db);
    if (hasVoted) {
      batch.update(answerRef, {
        [`upvoterIds.${user.uid}`]: deleteField(),
        voteCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
      if (helperId) {
        const repRef = doc(db, 'user_reputation', helperId);
        batch.set(repRef, { totalVotesReceived: increment(-1) }, { merge: true });
      }
    } else {
      batch.update(answerRef, {
        [`upvoterIds.${user.uid}`]: true,
        voteCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      if (helperId) {
        const repRef = doc(db, 'user_reputation', helperId);
        batch.set(repRef, { totalVotesReceived: increment(1) }, { merge: true });
      }
    }
    await batch.commit();
  };

  const acceptAnswer = async (
    question: Question,
    answerId: string,
    helperId: string
  ): Promise<void> => {
    const batch = writeBatch(db);

    batch.update(doc(db, 'questions', question.id), {
      acceptedAnswerId: answerId,
      status: 'answered',
    });
    batch.update(doc(db, 'questions', question.id, 'answers', answerId), {
      isAccepted: true,
      updatedAt: serverTimestamp(),
    });
    const repRef = doc(db, 'user_reputation', helperId);
    batch.set(repRef, { totalAccepted: increment(1) }, { merge: true });

    await batch.commit();

    // Optimistic local update
    setMyQuestions(prev =>
      prev.map(q => q.id === question.id ? { ...q, status: 'answered', acceptedAnswerId: answerId } : q)
    );
  };

  // One-shot fetch — avoids the Firestore WatchStream bug from simultaneous onSnapshot listeners
  const fetchFeed = async (currentUserId: string): Promise<void> => {
    if (!currentUserId) return;
    setFeedLoading(true);
    try {
      const merged = new Map<string, Question>();

      const [globalSnap, friendsSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'questions'),
            where('status', '==', 'open'),
            where('visibility', '==', 'global'),
            limit(50)
          )
        ),
        getDocs(
          query(
            collection(db, 'questions'),
            where('status', '==', 'open'),
            where('visibility', '==', 'friends'),
            where('visibleTo', 'array-contains', currentUserId),
            limit(50)
          )
        ),
      ]);

      globalSnap.docs.forEach(d => merged.set(d.id, { id: d.id, ...d.data() } as Question));
      friendsSnap.docs.forEach(d => merged.set(d.id, { id: d.id, ...d.data() } as Question));

      const sorted = [...merged.values()]
        .filter(q => q.askerId !== currentUserId)
        .sort((a, b) => (b.lastActivityAt?.seconds ?? 0) - (a.lastActivityAt?.seconds ?? 0));

      setFeedQuestions(sorted);
    } catch (err) {
      console.warn('[useQuestions] fetchFeed error:', err);
    } finally {
      setFeedLoading(false);
    }
  };

  const expireStaleQuestions = async (questions: Question[]): Promise<Set<string>> => {
    const cutoff = Date.now() - QUESTION_STALE_DAYS * 24 * 60 * 60 * 1000;
    const stale = questions.filter(
      q => q.status === 'open' &&
        (q.lastActivityAt?.seconds ?? 0) * 1000 < cutoff
    );
    if (stale.length === 0) return new Set();

    const batch = writeBatch(db);
    stale.forEach(q => {
      batch.update(doc(db, 'questions', q.id), { status: 'expired' });
    });
    await batch.commit().catch(err => console.warn('[expiry] batch failed:', err));
    return new Set(stale.map(q => q.id));
  };

  const fetchMyQuestions = async (userId: string): Promise<void> => {
    if (!userId) return;
    setMyQuestionsLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, 'questions'),
          where('askerId', '==', userId),
          limit(30)
        )
      );
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Question))
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));

      // Auto-expire stale open questions (asker is the current user, so security rules allow it)
      const expiredIds = await expireStaleQuestions(sorted.filter(q => q.status === 'open'));
      setMyQuestions(sorted.map(q =>
        expiredIds.has(q.id) ? { ...q, status: 'expired' as const } : q
      ));
    } catch (err) {
      console.warn('[useQuestions] fetchMyQuestions error:', err);
    } finally {
      setMyQuestionsLoading(false);
    }
  };

  const closeQuestionForCard = async (cardId: string): Promise<void> => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      const snap = await getDocs(query(
        collection(db, 'questions'),
        where('cardId', '==', cardId),
        where('askerId', '==', userId),
        where('status', '==', 'open'),
        limit(1)
      ));
      if (snap.empty) return;
      const qId = snap.docs[0].id;
      await updateDoc(doc(db, 'questions', qId), { status: 'expired' });
      setMyQuestions(prev =>
        prev.map(q => q.id === qId ? { ...q, status: 'expired' as const } : q)
      );
    } catch (err) {
      console.warn('[closeQuestionForCard] failed:', err);
    }
  };

  const fetchCardQuestion = async (cardId: string): Promise<Question | null> => {
    const userId = auth.currentUser?.uid;
    if (!userId) return null;
    const snap = await getDocs(
      query(
        collection(db, 'questions'),
        where('cardId', '==', cardId),
        where('askerId', '==', userId),
        limit(1)
      )
    );
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Question;
  };

  const loadAnswers = (questionId: string): void => {
    // Tear down any existing listener for this question
    if (answerListeners.current[questionId]) {
      answerListeners.current[questionId]();
    }

    setAnswersLoading(prev => ({ ...prev, [questionId]: true }));

    const q = query(
      collection(db, 'questions', questionId, 'answers'),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, snap => {
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() } as Answer));
      // Sort client-side: accepted first, then by voteCount desc, then createdAt asc
      const sorted = [...raw].sort((a, b) => {
        if (a.isAccepted !== b.isAccepted) return a.isAccepted ? -1 : 1;
        if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
        return (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0);
      });
      setAnswers(prev => ({ ...prev, [questionId]: sorted }));
      setAnswersLoading(prev => ({ ...prev, [questionId]: false }));
    }, err => {
      console.warn('[useQuestions] loadAnswers error:', err);
      setAnswersLoading(prev => ({ ...prev, [questionId]: false }));
    });

    answerListeners.current[questionId] = unsub;
  };

  const unsubscribeAnswers = (questionId: string): void => {
    if (answerListeners.current[questionId]) {
      answerListeners.current[questionId]();
      delete answerListeners.current[questionId];
    }
  };

  const loadComments = async (questionId: string, answerId: string): Promise<void> => {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'questions', questionId, 'answers', answerId, 'comments'),
          orderBy('createdAt', 'asc')
        )
      );
      const result = snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment));
      setComments(prev => ({ ...prev, [answerId]: result }));
    } catch (err) {
      console.warn('[useQuestions] loadComments error:', err);
    }
  };

  const updateVisibility = async (
    questionId: string,
    visibility: 'friends' | 'global',
    friendUids: string[] = []
  ): Promise<void> => {
    const visibleTo = visibility === 'friends' ? friendUids : [];
    await updateDoc(doc(db, 'questions', questionId), { visibility, visibleTo });
    setMyQuestions(prev =>
      prev.map(q => q.id === questionId ? { ...q, visibility, visibleTo } : q)
    );
  };

  const deleteQuestion = async (questionId: string): Promise<void> => {
    await deleteDoc(doc(db, 'questions', questionId));
    setMyQuestions(prev => prev.filter(q => q.id !== questionId));
  };

  const fetchMyReputation = async (): Promise<{
    totalAnswers: number;
    totalAccepted: number;
    totalVotesReceived: number;
  } | null> => {
    const user = auth.currentUser;
    if (!user) return null;
    try {
      const snap = await getDoc(doc(db, 'user_reputation', user.uid));
      if (!snap.exists()) return null;
      const d = snap.data();
      return {
        totalAnswers: d.totalAnswers ?? 0,
        totalAccepted: d.totalAccepted ?? 0,
        totalVotesReceived: d.totalVotesReceived ?? 0,
      };
    } catch {
      return null;
    }
  };

  const generateAIHintIfNeeded = async (question: Question): Promise<void> => {
    const now = Date.now();
    const ageMs = now - (question.createdAt?.seconds ?? 0) * 1000;
    if (question.answerCount > 0) return;
    if (ageMs < 24 * 60 * 60 * 1000) return;
    if (question.aiHint) return;

    const apiKey = (process.env as Record<string, string>).GEMINI_API_KEY;
    if (!apiKey) return;

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are a memory coach. Write a short, vivid memory hook (1-2 sentences) to help someone remember:\n\nConcept: ${question.frontText}\nAnswer: ${question.backText}\n\nRespond with only the memory hook.`;
      const result = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });
      const hint = result.text?.trim();
      if (!hint) return;

      await updateDoc(doc(db, 'questions', question.id), {
        aiHint: hint,
        aiHintGeneratedAt: now,
      });
      setFeedQuestions(prev =>
        prev.map(q => q.id === question.id ? { ...q, aiHint: hint, aiHintGeneratedAt: now } : q)
      );
    } catch (err) {
      console.warn('[AI hint] generation failed:', err);
    }
  };

  return {
    feedQuestions,
    feedLoading,
    myQuestions,
    myQuestionsLoading,
    answers,
    answersLoading,
    comments,
    askQuestion,
    postAnswer,
    postComment,
    voteAnswer,
    acceptAnswer,
    fetchFeed,
    fetchMyQuestions,
    fetchCardQuestion,
    loadAnswers,
    unsubscribeAnswers,
    loadComments,
    updateVisibility,
    deleteQuestion,
    closeQuestionForCard,
    fetchMyReputation,
    generateAIHintIfNeeded,
  };
}
