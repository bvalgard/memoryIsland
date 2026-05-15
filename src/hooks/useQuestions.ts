import { useState, useRef } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
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
  status: 'open' | 'answered';
  acceptedAnswerId: string | null;
  answerCount: number;
  visibility: 'friends' | 'global';
  visibleTo: string[];
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
    askerName: string
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
      askerName: askerName || user.displayName || 'Explorer',
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
      setMyQuestions(sorted);
    } catch (err) {
      console.warn('[useQuestions] fetchMyQuestions error:', err);
    } finally {
      setMyQuestionsLoading(false);
    }
  };

  const fetchCardQuestion = async (cardId: string): Promise<Question | null> => {
    const snap = await getDocs(
      query(
        collection(db, 'questions'),
        where('cardId', '==', cardId),
        where('status', '==', 'open'),
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
      orderBy('isAccepted', 'desc'),
      orderBy('voteCount', 'desc'),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, snap => {
      const sorted = snap.docs.map(d => ({ id: d.id, ...d.data() } as Answer));
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
  };
}
