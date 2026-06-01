import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Brain, ArrowLeft, CheckCircle2, ChevronRight, ChevronLeft, Database, Zap, Library, XCircle, Check, X, Flame, TrendingDown, ZoomIn, SkipForward, Target } from 'lucide-react';
import TestModeNavigator from './TestModeNavigator';
import { Island, CardStatus, CardUpdateRecord, UserSettings, Card, HotspotZone } from '../hooks/useUserProgress';
import { SessionMeta } from '../achievements';
import { cn, getActiveTierCards } from '../lib/utils';
import LightboxImage from './LightboxImage';
import AskQuestionModal from './AskQuestionModal';
import { RichText, RichTextInline } from './RichText';
import { useQuestions, type Question, type Answer } from '../hooks/useQuestions';
import OfflineImageNotice from './study/OfflineImageNotice';
import NavAction from './study/NavAction';
import SparkleLayer from './study/SparkleLayer';
import SessionComplete from './study/SessionComplete';
import SessionHistoryNav from './study/SessionHistoryNav';
import SessionStatsBar from './study/SessionStatsBar';
import MatchingCardRenderer from './study/card-types/MatchingCardRenderer';
import SequencingCardRenderer from './study/card-types/SequencingCardRenderer';
import HotspotCardRenderer from './study/card-types/HotspotCardRenderer';
import FIBCardRenderer from './study/card-types/FIBCardRenderer';
import MCQMultiCardRenderer from './study/card-types/MCQMultiCardRenderer';
import MCQSingleCardRenderer from './study/card-types/MCQSingleCardRenderer';
import FlashcardPreFlip from './study/card-types/FlashcardPreFlip';
import FlashcardPostFlip from './study/card-types/FlashcardPostFlip';

// Reliable Fisher-Yates shuffle to prevent duplicate/dropped card bugs caused by Math.random() in sort()
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function computeSM2(
  quality: number,
  prevRepetitions: number,
  prevInterval: number,
  prevEaseFactor: number
): { interval: number; repetitions: number; easeFactor: number; nextReview: number } {
  const MIN_EF = 1.3;
  let reps = prevRepetitions;
  let interval = prevInterval;
  let ef = prevEaseFactor;

  if (quality >= 3) {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.round(prevInterval * ef);
    reps += 1;
  } else {
    reps = 0;
    interval = 1;
  }
  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ef < MIN_EF) ef = MIN_EF;

  return {
    interval,
    repetitions: reps,
    easeFactor: ef,
    nextReview: Date.now() + interval * 24 * 60 * 60 * 1000,
  };
}

const SRS_THRESHOLDS = { mastered: 14, sailing: 3 };

function intervalToStatus(intervalDays: number): CardStatus {
  if (intervalDays >= SRS_THRESHOLDS.mastered) return 'mastered';
  if (intervalDays >= SRS_THRESHOLDS.sailing) return 'sailing';
  return 'charting';
}

function computeSM2Easy(prevReps: number, prevInterval: number, prevEF: number) {
  const result = computeSM2(5, prevReps, prevInterval, prevEF);
  result.interval = Math.max(result.interval, 7);
  result.nextReview = Date.now() + result.interval * 24 * 60 * 60 * 1000;
  return result;
}

function computeSM2Hard(prevReps: number, prevInterval: number, prevEF: number) {
  return computeSM2(2, prevReps, prevInterval, prevEF);
}

// Extracts only the active card for each conceptual lineage

// If any card from a scenario group is selected, pull in ALL cards from that
// scenario (from the full unfiltered pool) so the group is always complete and
// presented in order. Scenarios depend on earlier questions for context.
function expandScenarioGroups(filteredCards: Card[], allCards: Card[]): Card[] {
  const scenarioIds = new Set(
    filteredCards.filter(c => c.scenarioId).map(c => c.scenarioId!)
  );
  if (scenarioIds.size === 0) return filteredCards;
  const nonScenario = filteredCards.filter(c => !c.scenarioId);
  const allScenario = allCards.filter(c => c.scenarioId && scenarioIds.has(c.scenarioId));
  return [...nonScenario, ...allScenario];
}

function buildStudyDeck(cards: Card[], sortBy: 'lastReviewed' | 'srsNextReview'): Card[] {
  const groupMap = new Map<string, Card[]>();
  const standalones: Card[] = [];

  for (const card of cards) {
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

  const roundToHour = (t: number) => Math.round(t / 3_600_000) * 3_600_000;
  const shuffledUnits = shuffleArray(units);
  shuffledUnits.sort((a, b) => {
    const aTime = roundToHour(Math.min(...a.map(c => c[sortBy] ?? 0)));
    const bTime = roundToHour(Math.min(...b.map(c => c[sortBy] ?? 0)));
    return aTime - bTime;
  });

  return shuffledUnits.flat();
}


interface StudySessionProps {
  island: Island;
  mode?: 'all' | 'charting' | 'sailing' | 'mastered' | 'due';
  settings?: UserSettings;
  allTimeBestStreak?: number;
  friends?: string[];
  islandId?: string;
  archipelagoName?: string;
  currentUserName?: string;
  isOnline?: boolean;
  isTestMode?: boolean;
  timeoutPerCardSec?: number;
  totalTimeLimitSec?: number;
  onFinish: (cardUpdates: CardUpdateRecord, maxStreak: number, sessionMeta: SessionMeta) => void;
  onManage: (cardUpdates: CardUpdateRecord, maxStreak: number, sessionMeta: SessionMeta) => void;
  onBackToMap: (cardUpdates: CardUpdateRecord, maxStreak: number, sessionMeta: SessionMeta) => void;
  onSwitchMode?: (newMode: 'all' | 'charting' | 'sailing' | 'mastered' | 'due', cardUpdates: CardUpdateRecord, maxStreak: number, sessionMeta: SessionMeta) => void;
  onViewQuestion?: (question: Question) => void;
  onProgressUpdate?: (cardUpdates: CardUpdateRecord, sessionMaxStreak: number) => void;
}

export default function StudySession({ island, mode = 'all', settings, allTimeBestStreak = 0, friends = [], islandId = '', archipelagoName, currentUserName = 'Explorer', isOnline = true, isTestMode = false, timeoutPerCardSec, totalTimeLimitSec, onFinish, onManage, onBackToMap, onSwitchMode, onViewQuestion, onProgressUpdate }: StudySessionProps) {
  // Grace window in milliseconds — used to shift srsNextReview so studied cards
  // always land OUTSIDE the due window and immediately leave the due count.
  // Formula: srsNextReview = SM2.nextReview + graceMs
  // The stored srsInterval is unchanged so SM2 state stays correct.
  const graceMs = (settings?.graceWindowMinutes ?? 0) * 60_000;

  // Bumps a computed SRS result past the grace window. Without this, when
  // graceWindowMinutes >= srsInterval * 1440, a just-answered card's new
  // srsNextReview falls inside the grace window and the due count never drops.
  const withGrace = (srs: { interval: number; repetitions: number; easeFactor: number; nextReview: number }) =>
    graceMs > 0 ? { ...srs, nextReview: srs.nextReview + graceMs } : srs;

  const sessionStartTime = useRef<number>(Date.now());
  const cardStartTime = useRef<number>(Date.now());
  const firstAttemptRecorded = useRef<Set<string>>(new Set());
  const testModeFinishFired = useRef(false);
  const cardIslandRef = useRef<Record<string, string>>({});
  const lastAnsweredIndexRef = useRef(-1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewIndex, setViewIndex] = useState(0);
  const [historyResults, setHistoryResults] = useState<(boolean | null)[]>([]);
  const viewIndexRef = useRef(0);
  const currentIndexRef = useRef(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [direction, setDirection] = useState(0); // 1 for right, -1 for left
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number }[]>([]);
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);
  const [shuffledOptionImages, setShuffledOptionImages] = useState<(string | null)[]>([]);
  const [mcqZoomSrc, setMcqZoomSrc] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [cardUpdates, setCardUpdates] = useState<CardUpdateRecord>({});
  const [streak, setStreak] = useState(0);
  const [liveCorrect, setLiveCorrect] = useState(0);
  const [liveIncorrect, setLiveIncorrect] = useState(0);
  const [maxStreak, setMaxStreak] = useState(allTimeBestStreak);
  const [sessionMaxStreak, setSessionMaxStreak] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const newRecordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateStreakWithRecord = (newStreak: number) => {
    setSessionMaxStreak(prev => Math.max(prev, newStreak));
    setMaxStreak(prev => {
      if (newStreak > prev) {
        if (newRecordTimerRef.current) clearTimeout(newRecordTimerRef.current);
        setIsNewRecord(true);
        newRecordTimerRef.current = setTimeout(() => setIsNewRecord(false), 1500);
      }
      return Math.max(prev, newStreak);
    });
  };

  const [sessionStats, setSessionStats] = useState({
    mastered: 0,
    sailing: 0,
    charting: 0
  });

  // Confidence calibration state
  const [pendingConfidence, setPendingConfidence] = useState<number | null>(null);
  const [sessionCalibration, setSessionCalibration] = useState({ correct: 0, total: 0 });

  // Matching Game State
  const [matchingLefts, setMatchingLefts] = useState<{ id: string; text: string; image?: string | null }[]>([]);
  const [matchingRights, setMatchingRights] = useState<{ id: string; text: string; matchId: string; image?: string | null }[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matchedLeftIds, setMatchedLeftIds] = useState<Set<string>>(new Set());
  const [matchedRightIds, setMatchedRightIds] = useState<Set<string>>(new Set());
  const [matchingErrors, setMatchingErrors] = useState<Set<string>>(new Set());
  const [matchingMistakesCount, setMatchingMistakesCount] = useState(0);
  const [matchingComplete, setMatchingComplete] = useState(false);

  // Fill in the Blank State
  const [writtenRecallText, setWrittenRecallText] = useState('');

  const [fibInput, setFibInput] = useState('');
  const [lastFibSubmitted, setLastFibSubmitted] = useState<string | null>(null);
  const [isFibCorrect, setIsFibCorrect] = useState<boolean | null>(null);
  const [cluesUsed, setCluesUsed] = useState(0);
  const [revealedIndices, setRevealedIndices] = useState<number[]>([]);

  // Multi-Select / Multi-Answer MCQ State
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<Set<string>>(new Set());
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);

  // Normalizes correct answers across card types:
  //   - Legacy MCQ cards:       back field holds the single correct answer (no correctOptions)
  //   - New unified MCQ cards:  correctOptions array holds all correct answers
  //   - Legacy multi-select:    correctOptions array (unchanged; type kept for Firestore compat)
  // Returns a string[] so all downstream logic can treat single and multi-answer identically.
  const getMcqCorrectOpts = (card: typeof currentCard): string[] => {
    if (!card) return [];
    if (card.type === 'multi-select') return card.correctOptions ?? [];
    if (card.type === 'mcq') return card.correctOptions?.length ? card.correctOptions : [card.back];
    return [];
  };

  // Sequencing State
  const [shuffledSequence, setShuffledSequence] = useState<{ id: string, text: string }[]>([]);
  const [seqDragIdx, setSeqDragIdx] = useState<number | null>(null);
  const [seqOverIdx, setSeqOverIdx] = useState<number | null>(null);

  // Hotspot card state
  const [hotspotTap, setHotspotTap] = useState<{ x: number; y: number } | null>(null);
  const [hotspotCorrect, setHotspotCorrect] = useState<boolean | null>(null);
  const hotspotImgRef = useRef<HTMLImageElement>(null);

  // Community Q&A state
  const [showAskButton, setShowAskButton] = useState(false);
  const [askModalOpen, setAskModalOpen] = useState(false);
  const [questionJustAsked, setQuestionJustAsked] = useState(false);
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const [cardQuestion, setCardQuestion] = useState<Question | null>(null);
  const [cardAnswers, setCardAnswers] = useState<Answer[]>([]);
  const [selectingAnswerForCard, setSelectingAnswerForCard] = useState(false);

  const { askQuestion, fetchCardQuestion, loadAnswers, unsubscribeAnswers, acceptAnswer, answers } = useQuestions();

  // Tracks the active question across renders for unmount cleanup
  const cardQuestionRef = useRef<Question | null>(null);
  useEffect(() => { cardQuestionRef.current = cardQuestion; }, [cardQuestion]);
  useEffect(() => {
    if (!mcqZoomSrc) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMcqZoomSrc(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mcqZoomSrc]);

  // Keyboard shortcuts for study session — ref keeps handler always fresh
  const studyKeyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  studyKeyHandlerRef.current = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
    if (!currentCard || sessionComplete) return;

    const isFlashcard = !currentCard.type || currentCard.type === 'flashcard';
    const isFib = currentCard.type === 'fill-in-the-blank';
    const isMcq = currentCard.type === 'mcq';
    const isSingleMcq = isMcq && getMcqCorrectOpts(currentCard).length <= 1;

    const continueBtnVisible =
      selectedOption !== null ||
      (isFlipped && (
        currentCard.type === 'multi-select' ||
        (isMcq && getMcqCorrectOpts(currentCard).length > 1) ||
        currentCard.type === 'sequencing' ||
        isFib
      ));

    // Space — flip flashcard or click Continue
    if (e.key === ' ') {
      if (isFlashcard && !isFlipped) {
        e.preventDefault();
        setIsFlipped(true);
        return;
      }
      if (continueBtnVisible) {
        e.preventDefault();
        isSingleMcq ? handleNextMCQ() : handleNextComplex();
        return;
      }
      if (currentCard.type === 'matching' && matchingComplete) {
        e.preventDefault();
        recordHistory(matchingMistakesCount === 0);
        nextCard();
        return;
      }
    }

    // Enter — same as Space for Continue (FIB form handles its own Enter via the input)
    if (e.key === 'Enter' && !isFib) {
      if (continueBtnVisible) {
        e.preventDefault();
        isSingleMcq ? handleNextMCQ() : handleNextComplex();
        return;
      }
      if (currentCard.type === 'matching' && matchingComplete) {
        e.preventDefault();
        recordHistory(matchingMistakesCount === 0);
        nextCard();
        return;
      }
    }

    // ← / → — history navigation (arrow keys no longer grade; use G/B for that)
    if (e.key === 'ArrowLeft') {
      if (viewIndex > 0) {
        e.preventDefault();
        if (isTestMode) { jumpToCard(viewIndex - 1); } else { setDirection(-1); setViewIndex(prev => prev - 1); }
      }
      return;
    }
    if (e.key === 'ArrowRight') {
      if (isTestMode ? viewIndex < shuffledCards.length - 1 : viewIndex < currentIndex) {
        e.preventDefault();
        if (isTestMode) { jumpToCard(viewIndex + 1); } else { setDirection(1); setViewIndex(prev => prev + 1); }
      }
      return;
    }

    // G — mark correct; B — mark wrong (flashcard after flip)
    if (isFlashcard && isFlipped) {
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        handleFlashcardGrade(true, { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 } as React.MouseEvent);
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        handleFlashcardGrade(false, { clientX: 0, clientY: 0 } as React.MouseEvent);
      }
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => studyKeyHandlerRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    return () => {
      if (cardQuestionRef.current) unsubscribeAnswers(cardQuestionRef.current.id);
    };
  }, []);

  // Per-card consecutive answer counts for tier progression logic
  const sessionConsecutiveRef = useRef<Map<string, { correct: number; incorrect: number }>>(new Map());
  const [tierUnlockNotif, setTierUnlockNotif] = useState<number | null>(null);
  const [reactivationNotif, setReactivationNotif] = useState<number | null>(null);

  // Tracks the pending nav timer so it can be cancelled on unmount
  const pendingNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (pendingNavTimerRef.current !== null) clearTimeout(pendingNavTimerRef.current);
    };
  }, []);


  // Front-text set of cards that were actually "due" at session start.
  // Used on the completion screen so the user knows exactly which of their studied
  // cards contributed to reducing the global due count (studying non-due cards in
  // 'all' mode never reduces the count, which confuses users who expect it to drop).
  const [dueCardFrontsAtStart] = useState<Set<string>>(() => {
    const activeTierCards = getActiveTierCards(island.cards);
    const now = Date.now();
    const graceMs = (settings?.graceWindowMinutes ?? 0) * 60_000;
    return new Set(
      activeTierCards
        .filter(c => !c.srsNextReview || c.srsNextReview <= now + graceMs)
        .map(c => c.front)
    );
  });

  const [shuffledCards, setShuffledCards] = useState(() => {
    const activeTierCards = getActiveTierCards(island.cards);
    const now = Date.now();
    const graceMs = (settings?.graceWindowMinutes ?? 0) * 60_000;
    let targetCards = activeTierCards;
    if (mode === 'charting') targetCards = activeTierCards.filter(c => c.status === 'charting' || c.needsWork);
    else if (mode === 'sailing') targetCards = activeTierCards.filter(c => (!c.status && !c.needsWork) || c.status === 'sailing');
    else if (mode === 'mastered') targetCards = activeTierCards.filter(c => c.status === 'mastered');
    else if (mode === 'due') targetCards = activeTierCards.filter(c => !c.srsNextReview || c.srsNextReview <= now + graceMs);
    targetCards = expandScenarioGroups(targetCards, activeTierCards);

    const shuffled = buildStudyDeck(targetCards, mode === 'due' ? 'srsNextReview' : 'lastReviewed');
    return shuffled;
  });

  const [sessionComplete, setSessionComplete] = useState(shuffledCards.length === 0);

  // Re-initialize the deck only on mount or when the user explicitly switches the study Mode,
  // explicitly skipping island.cards so background db snapshots don't reset their deck mid-session.
  useEffect(() => {
    const activeTierCards = getActiveTierCards(island.cards);
    const now = Date.now();
    const graceMs = (settings?.graceWindowMinutes ?? 0) * 60_000;
    let targetCards = activeTierCards;
    if (mode === 'charting') targetCards = activeTierCards.filter(c => c.status === 'charting' || c.needsWork);
    else if (mode === 'sailing') targetCards = activeTierCards.filter(c => (!c.status && !c.needsWork) || c.status === 'sailing');
    else if (mode === 'mastered') targetCards = activeTierCards.filter(c => c.status === 'mastered');
    else if (mode === 'due') targetCards = activeTierCards.filter(c => !c.srsNextReview || c.srsNextReview <= now + graceMs);
    targetCards = expandScenarioGroups(targetCards, activeTierCards);

    const shuffled = buildStudyDeck(targetCards, mode === 'due' ? 'srsNextReview' : 'lastReviewed');
    setShuffledCards(shuffled);
    setCurrentIndex(0);
    setViewIndex(0);
    setHistoryResults([]);
    setSessionComplete(shuffled.length === 0);
  }, [mode]);

  const currentCard = shuffledCards[currentIndex];
  const viewedCard = shuffledCards[viewIndex];
  const isViewingHistory = viewIndex < currentIndex;

  useEffect(() => { viewIndexRef.current = viewIndex; }, [viewIndex]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  const activeScenario = currentCard?.scenarioId ? (() => {
    const scenarioCardsInDeck = shuffledCards.filter(c => c.scenarioId === currentCard.scenarioId);
    const questionNumber = scenarioCardsInDeck.findIndex(c => c.id === currentCard.id) + 1;
    return {
      id: currentCard.scenarioId,
      text: currentCard.scenarioText ?? '',
      questionNumber: questionNumber > 0 ? questionNumber : 1,
      groupSize: scenarioCardsInDeck.length,
    };
  })() : null;

  useEffect(() => {
    cardStartTime.current = Date.now();
  }, [currentIndex]);

  useEffect(() => {
    if (currentCard?.front && currentCard.islandName) {
      cardIslandRef.current[currentCard.front] = currentCard.islandName;
    }
  }, [currentCard]);

  // Per-question countdown timer for test mode
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!timeoutPerCardSec || sessionComplete) { setTimeLeft(null); return; }
    setTimeLeft(timeoutPerCardSec);
    const interval = setInterval(() => {
      if (viewIndexRef.current < currentIndexRef.current) return; // paused while reviewing history
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentIndex, timeoutPerCardSec, sessionComplete]);

  useEffect(() => {
    if (timeLeft !== 0 || !currentCard || viewIndexRef.current < currentIndexRef.current) return;
    // Time expired — record current card as wrong and advance
    const responseTimeMs = captureResponseTime(currentCard.front);
    setStreak(0);
    setLiveIncorrect(prev => prev + 1);
    setCardUpdates(prev => ({
      ...prev,
      [currentCard.front]: {
        ...prev[currentCard.front],
        status: currentCard.status ?? 'charting',
        sessionAnswers: (prev[currentCard.front]?.sessionAnswers ?? 0) + 1,
        sessionCorrect: prev[currentCard.front]?.sessionCorrect ?? 0,
        ...(responseTimeMs !== undefined && { responseTimeMs, responseTimeIsCorrect: false }),
      },
    }));
    recordHistory(false);
    setDirection(-1);
    nextCard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // Total session countdown timer for test mode
  const [totalTimeLeft, setTotalTimeLeft] = useState<number | null>(
    totalTimeLimitSec ?? null
  );
  useEffect(() => {
    if (!totalTimeLimitSec || sessionComplete) return;
    const interval = setInterval(() => {
      setTotalTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setSessionComplete(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalTimeLimitSec, sessionComplete]);

  const attachCardIdentities = (updates: CardUpdateRecord): CardUpdateRecord => {
    const cardsByFront = new Map<string, Card>();
    [...shuffledCards, ...island.cards].forEach(card => {
      if (!cardsByFront.has(card.front)) cardsByFront.set(card.front, card);
    });

    return Object.fromEntries(
      Object.entries(updates).map(([front, update]) => {
        const card = cardsByFront.get(front);
        return [
          front,
          {
            ...update,
            cardId: update.cardId ?? card?.id,
            islandId: update.islandId ?? card?.islandId,
          },
        ];
      })
    );
  };

  useEffect(() => {
    if (Object.keys(cardUpdates).length > 0) {
      onProgressUpdate?.(attachCardIdentities(cardUpdates), sessionMaxStreak);
    }
  }, [cardUpdates, sessionMaxStreak]);

  // Test mode: fire onFinish after render (not during) when session completes
  useEffect(() => {
    if (!isTestMode || !sessionComplete || testModeFinishFired.current) return;
    testModeFinishFired.current = true;
    const meta: import('../achievements').SessionMeta = {
      sessionDurationMs: Date.now() - sessionStartTime.current,
      cardCount: Object.keys(cardUpdates).length,
      correctCount: Object.values<{ sessionCorrect?: number }>(cardUpdates as any).filter(c => (c.sessionCorrect ?? 0) > 0).length,
      sessionStartHour: new Date(sessionStartTime.current).getHours(),
      studyMode: mode,
    };
    onFinish(attachCardIdentities(cardUpdates), sessionMaxStreak, meta);
  // Only re-run when sessionComplete flips — other deps are stable refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionComplete]);

  const captureResponseTime = (cardFront: string): number | undefined => {
    if (firstAttemptRecorded.current.has(cardFront)) return undefined;
    firstAttemptRecorded.current.add(cardFront);
    return Date.now() - cardStartTime.current;
  };

  const buildMeta = (): SessionMeta => ({
    sessionDurationMs: Date.now() - sessionStartTime.current,
    cardCount: Object.keys(cardUpdates).length,
    correctCount: Object.values<{ sessionCorrect?: number }>(cardUpdates as any).filter(c => (c.sessionCorrect ?? 0) > 0).length,
    sessionStartHour: new Date(sessionStartTime.current).getHours(),
    calibrationCorrect: sessionCalibration.correct,
    calibrationTotal: sessionCalibration.total,
    studyMode: mode,
  });

  const chartingCount = island.cards.filter(c => c.status === 'charting' || c.needsWork).length;
  const masteredCount = island.cards.filter(c => c.status === 'mastered').length;

  let masteryLevel: 'charting' | 'sailing' | 'mastered' = 'sailing';
  if (chartingCount > 0) {
    masteryLevel = 'charting';
  } else if (island.cards.length > 0 && masteredCount === island.cards.length) {
    masteryLevel = 'mastered';
  } else {
    masteryLevel = 'sailing';
  }

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  const imageSrc = masteryLevel === 'charting' ? `${basePath}/struggling.jpeg` : masteryLevel === 'sailing' ? `${basePath}/learning.jpeg` : `${basePath}/mastered.jpeg`;

  const getTierInfo = (card: Card | undefined) => {
    if (!card) return null;

    const currentTier = card.tier || 1;

    // Build maps for lineage exploration
    const cardsById = new Map<string, Card>();
    island.cards.forEach(c => { if (c.id) cardsById.set(c.id, c); });

    // Build children map
    const childrenMap = new Map<string, Card[]>();
    island.cards.forEach(c => {
      if (c.prevTierCardId) {
        const children = childrenMap.get(c.prevTierCardId) || [];
        children.push(c);
        childrenMap.set(c.prevTierCardId, children);
      }
    });

    // Find root
    let root = card;
    let iterations = 0;
    while (root.prevTierCardId && cardsById.has(root.prevTierCardId) && iterations < 10) {
      root = cardsById.get(root.prevTierCardId)!;
      iterations++;
    }

    const getMaxDepth = (node: Card, depth: number): number => {
      if (!node.id) return depth;
      const children = childrenMap.get(node.id) || [];
      if (children.length === 0) return depth;
      return Math.max(...children.map(child => getMaxDepth(child, depth + 1)));
    };

    const totalTiers = getMaxDepth(root, 1);

    // Show indicator if it's part of a tiered structure (total > 1) or current tier > 1
    if (totalTiers > 1 || currentTier > 1) {
      return { current: currentTier, total: Math.max(totalTiers, currentTier) };
    }
    return null;
  };

  const tierInfo = getTierInfo(currentCard);

  useEffect(() => {
    if ((currentCard?.type === 'mcq' || currentCard?.type === 'multi-select') && currentCard.options) {
      const paired = currentCard.options.map((opt, i) => ({
        text: opt,
        image: currentCard.optionImages?.[i] ?? null,
      }));
      const shuffledPaired = currentCard.lockOptionOrder ? paired : shuffleArray(paired);
      setShuffledOptions(shuffledPaired.map(p => p.text));
      setShuffledOptionImages(shuffledPaired.map(p => p.image));
    } else {
      setShuffledOptions([]);
      setShuffledOptionImages([]);
    }

    if (currentCard?.type === 'sequencing' && currentCard.options) {
      const items = currentCard.options.map((opt, i) => ({ id: `${Date.now()}-${i}`, text: opt }));
      setShuffledSequence(shuffleArray(items));
    } else {
      setShuffledSequence([]);
    }

    if (currentCard?.type === 'matching' && currentCard.pairs) {
      const lefts = currentCard.pairs.map((p, pi) => ({
        id: p.id,
        text: p.left.startsWith('__img_') && p.left.endsWith('__') ? '' : p.left,
        image: currentCard.pairImages?.[pi]?.leftImage ?? null,
      }));
      const rights: { id: string; text: string; matchId: string; image?: string | null }[] = [];
      currentCard.pairs.forEach((p, pi) => {
        p.rights.forEach((rightText, rIdx) => {
          rights.push({
            id: `${p.id}-r-${rIdx}`,
            text: rightText.startsWith('__img_') && rightText.endsWith('__') ? '' : rightText,
            matchId: p.id,
            image: currentCard.pairImages?.[pi]?.rightImages?.[rIdx] ?? null,
          });
        });
      });
      setMatchingLefts(shuffleArray(lefts));
      setMatchingRights(shuffleArray(rights));
    } else {
      setMatchingLefts([]);
      setMatchingRights([]);
    }

    setSelectedLeft(null);
    setSelectedRight(null);
    setMatchedLeftIds(new Set());
    setMatchedRightIds(new Set());
    setMatchingErrors(new Set());
    setMatchingMistakesCount(0);
    setMatchingComplete(false);

    // Reset state for new card
    setSelectedOption(null);
    setShowHint(false);
    setIsFlipped(false);
    setPendingConfidence(null);
    setWrittenRecallText('');

    // Fill in the blank reset
    setFibInput('');
    setLastFibSubmitted(null);
    setIsFibCorrect(null);
    setCluesUsed(0);
    setRevealedIndices([]);

    // Multi-select reset
    setSelectedMultiOptions(new Set());

    // Hotspot reset
    setHotspotTap(null);
    setHotspotCorrect(null);

    // Community Q&A reset
    setShowAskButton(false);
    setAskModalOpen(false);
    setQuestionJustAsked(false);
    setCardQuestion(null);
    setCardAnswers([]);
    setSelectingAnswerForCard(false);
    if (cardQuestionRef.current) unsubscribeAnswers(cardQuestionRef.current.id);
  }, [currentIndex, currentCard]);

  useEffect(() => {
    let cancelled = false;
    if (!isFlipped || !currentCard?.id) {
      setCardAnswers([]);
      return;
    }
    fetchCardQuestion(currentCard.id).then(q => {
      if (cancelled) return;
      setCardQuestion(q);
      if (q) loadAnswers(q.id);
    });
    return () => { cancelled = true; };
  }, [isFlipped, currentCard?.id]);

  // Sync live answers from onSnapshot into local cardAnswers state
  useEffect(() => {
    if (cardQuestion) {
      setCardAnswers(answers[cardQuestion.id] ?? []);
    }
  }, [answers, cardQuestion?.id]);

  const triggerSparkle = (e: React.MouseEvent) => {
    if (isTestMode) return;
    const newSparkle = {
      id: Date.now(),
      x: e.clientX,
      y: e.clientY
    };
    setSparkles(prev => [...prev, newSparkle]);
    setTimeout(() => {
      setSparkles(prev => prev.filter(s => s.id !== newSparkle.id));
    }, 1000);
  };

  const handleGetClue = () => {
    if (!currentCard) return;

    // First clue just shows the underlines, subsequent clues reveal a random letter
    if (cluesUsed > 0) {
      const answer = currentCard.back.trim();
      const unrevealedIndices = [];
      for (let i = 0; i < answer.length; i++) {
        if (answer[i] !== ' ' && !revealedIndices.includes(i)) {
          unrevealedIndices.push(i);
        }
      }

      if (unrevealedIndices.length > 0) {
        const randomIndex = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
        setRevealedIndices(prev => [...prev, randomIndex]);
      }
    }
    setCluesUsed(prev => prev + 1);
  };

  const applyAnswerResult = (card: Card, isCorrect: boolean): {
    consecutiveCorrect: number;
    consecutiveIncorrect: number;
    extraCurrentCardFields: Partial<CardUpdateRecord[string]>;
    parentReactivation?: { front: string; update: CardUpdateRecord[string] };
  } => {
    const id = card.id ?? card.front;
    const prev = sessionConsecutiveRef.current.get(id) ?? {
      correct: card.consecutiveCorrect ?? 0,
      incorrect: card.consecutiveIncorrect ?? 0,
    };

    const newCorrect = isCorrect ? prev.correct + 1 : 0;
    const newIncorrect = isCorrect ? 0 : prev.incorrect + 1;
    let stored = { correct: newCorrect, incorrect: newIncorrect };

    const extraCurrentCardFields: Partial<CardUpdateRecord[string]> = {};
    let parentReactivation: { front: string; update: CardUpdateRecord[string] } | undefined;

    if (isCorrect && newCorrect >= 2 && !card.nextTierUnlocked) {
      const hasChildren = island.cards.some(c => c.prevTierCardId === card.id);
      if (hasChildren) {
        extraCurrentCardFields.nextTierUnlocked = true;
        const unlockTier = card.tier ?? 1;
        setTierUnlockNotif(unlockTier);
        setTimeout(() => setTierUnlockNotif(null), 3000);
      }
    }

    if (!isCorrect && newIncorrect >= 3 && card.prevTierCardId) {
      const parent = island.cards.find(c => c.id === card.prevTierCardId);
      if (parent) {
        stored = { correct: 0, incorrect: 0 };
        parentReactivation = {
          front: parent.front,
          update: {
            status: 'charting',
            consecutiveCorrect: 0,
            consecutiveIncorrect: 0,
            srsInterval: 1,
            srsEaseFactor: 2.5,
            srsNextReview: Date.now(),
            srsRepetitions: 0,
            lastReviewed: Date.now(),
          },
        };
        setShuffledCards(prevDeck => {
          if (prevDeck.some(c => c.id === parent.id)) return prevDeck;
          const insertAt = Math.min(currentIndex + 2, prevDeck.length);
          return [...prevDeck.slice(0, insertAt), parent, ...prevDeck.slice(insertAt)];
        });
        const reactivateTier = parent.tier ?? 1;
        setReactivationNotif(reactivateTier);
        setTimeout(() => setReactivationNotif(null), 3500);
      }
    }

    sessionConsecutiveRef.current.set(id, stored);
    return {
      consecutiveCorrect: stored.correct,
      consecutiveIncorrect: stored.incorrect,
      extraCurrentCardFields,
      parentReactivation,
    };
  };

  const handleFibSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCard) return;

    const normalizeText = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');
    const answer = normalizeText(currentCard.back);
    const input = normalizeText(fibInput);

    setLastFibSubmitted(fibInput);
    const correct = input === answer;
    setIsFibCorrect(correct);
    const fibResponseTimeMs = captureResponseTime(currentCard.front);

    if (correct) {
      setIsFlipped(true); // show the correct answer
      setLastAnswerCorrect(true);

      const usedClues = cluesUsed > 0;

      setLiveCorrect(prev => prev + 1);
      if (!usedClues) {
        setStreak(prev => {
          const s = prev + 1;
          updateStreakWithRecord(s);
          return s;
        });
      }

      const srsFib = withGrace(computeSM2(
        usedClues ? 3 : 4,
        currentCard.srsRepetitions ?? 0,
        currentCard.srsInterval ?? 1,
        currentCard.srsEaseFactor ?? 2.5
      ));
      const newStatus = intervalToStatus(srsFib.interval);

      setSessionStats(prev => ({ ...prev, [newStatus]: prev[newStatus as keyof typeof prev] + 1 }));

      const { consecutiveCorrect: fibCC, consecutiveIncorrect: fibCI, extraCurrentCardFields: fibExtra, parentReactivation: fibParent } = applyAnswerResult(currentCard, true);

      setCardUpdates(prev => ({
        ...prev,
        [currentCard.front]: {
          status: newStatus,
          lastReviewed: Date.now(),
          srsInterval: srsFib.interval,
          srsEaseFactor: srsFib.easeFactor,
          srsNextReview: srsFib.nextReview,
          srsRepetitions: srsFib.repetitions,
          sessionAnswers: (prev[currentCard.front]?.sessionAnswers ?? 0) + 1,
          sessionCorrect: (prev[currentCard.front]?.sessionCorrect ?? 0) + 1,
          consecutiveCorrect: fibCC,
          consecutiveIncorrect: fibCI,
          ...fibExtra,
          ...(fibResponseTimeMs !== undefined && { responseTimeMs: fibResponseTimeMs, responseTimeIsCorrect: true }),
        },
        ...(fibParent && { [fibParent.front]: fibParent.update }),
      }));

      if (window.navigator?.vibrate && newStatus === 'mastered') window.navigator.vibrate(50);
      triggerSparkle(e as any);
      recordHistory(true);
      setDirection(1);
      pendingNavTimerRef.current = setTimeout(() => nextCard(), 1500); // 1.5s delay to see correct answer
    } else {
      // Incorrect
      setIsFlipped(true);
      setLastAnswerCorrect(false);
      setStreak(0);
      setLiveIncorrect(prev => prev + 1);
      setShowAskButton(true);

      const srsFibWrong = withGrace(computeSM2(0, currentCard.srsRepetitions ?? 0, currentCard.srsInterval ?? 1, currentCard.srsEaseFactor ?? 2.5));
      const status = intervalToStatus(srsFibWrong.interval);

      setSessionStats(prev => ({ ...prev, [status]: prev[status as keyof typeof prev] + 1 }));

      const isBeingDemotedFib =
        status === 'charting' &&
        (currentCard.status === 'sailing' || currentCard.status === 'mastered');

      const { consecutiveCorrect: fibCC2, consecutiveIncorrect: fibCI2, extraCurrentCardFields: fibExtra2, parentReactivation: fibParent2 } = applyAnswerResult(currentCard, false);

      setCardUpdates(prev => ({
        ...prev,
        [currentCard.front]: {
          status,
          lastReviewed: Date.now(),
          ...(isBeingDemotedFib && {
            wasDemoted: true,
            demotionCount: currentCard.demotionCount || 0,
          }),
          srsInterval: srsFibWrong.interval,
          srsEaseFactor: srsFibWrong.easeFactor,
          srsNextReview: srsFibWrong.nextReview,
          srsRepetitions: srsFibWrong.repetitions,
          sessionAnswers: (prev[currentCard.front]?.sessionAnswers ?? 0) + 1,
          sessionCorrect: prev[currentCard.front]?.sessionCorrect ?? 0,
          consecutiveCorrect: fibCC2,
          consecutiveIncorrect: fibCI2,
          ...fibExtra2,
          ...(fibResponseTimeMs !== undefined && { responseTimeMs: fibResponseTimeMs, responseTimeIsCorrect: false }),
        },
        ...(fibParent2 && { [fibParent2.front]: fibParent2.update }),
      }));
      setDirection(-1);
    }
  };

  // ─── Hotspot answer handler ───────────────────────────────────────────────
  const handleHotspotPointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    if (isFlipped || !currentCard?.hotspots?.length) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    const tapX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const tapY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const zone: HotspotZone = currentCard.hotspots[0];

    // ── Rotated-ellipse hit detection in pixel space ──────────────────────
    // Both zone.radius (rx) and zone.radiusY (ry) are stored as fractions of
    // image width, so converting to pixels is just multiplying by rect.width.
    const W = rect.width;
    const H = rect.height;
    const rx_px = zone.radius * W;
    const ry_px = (zone.radiusY ?? zone.radius) * W;
    const θ = ((zone.rotation ?? 0) * Math.PI) / 180;

    // Delta in pixel space
    const dx_px = (tapX - zone.x) * W;
    const dy_px = (tapY - zone.y) * H;

    // Rotate the tap point by –θ to align with the ellipse's local axes
    const cosθ = Math.cos(-θ);
    const sinθ = Math.sin(-θ);
    const dx_rot = dx_px * cosθ - dy_px * sinθ;
    const dy_rot = dx_px * sinθ + dy_px * cosθ;

    // Enforce 44 px minimum touch target on each axis
    const effectiveRx = Math.max(rx_px, 22);
    const effectiveRy = Math.max(ry_px, 22);
    const isCorrect = (dx_rot / effectiveRx) ** 2 + (dy_rot / effectiveRy) ** 2 <= 1;

    const hsResponseTimeMs = captureResponseTime(currentCard.front);

    setHotspotTap({ x: tapX, y: tapY });
    setHotspotCorrect(isCorrect);
    setIsFlipped(true);
    setLastAnswerCorrect(isCorrect);

    if (isCorrect) {
      setStreak(prev => {
        const s = prev + 1;
        updateStreakWithRecord(s);
        return s;
      });
      setLiveCorrect(prev => prev + 1);
      if (window.navigator?.vibrate) window.navigator.vibrate(50);
      triggerSparkle({ clientX: e.clientX, clientY: e.clientY } as React.MouseEvent);
    } else {
      setStreak(0);
      setLiveIncorrect(prev => prev + 1);
      setShowAskButton(true);
    }

    const srsHs = withGrace(computeSM2(
      isCorrect ? 4 : 0,
      currentCard.srsRepetitions ?? 0,
      currentCard.srsInterval ?? 1,
      currentCard.srsEaseFactor ?? 2.5
    ));
    const hsStatus = intervalToStatus(srsHs.interval);
    const isBeingDemotedHs =
      hsStatus === 'charting' &&
      (currentCard.status === 'sailing' || currentCard.status === 'mastered');

    setSessionStats(prev => ({ ...prev, [hsStatus]: prev[hsStatus as keyof typeof prev] + 1 }));

    const { consecutiveCorrect: hsCC, consecutiveIncorrect: hsCI, extraCurrentCardFields: hsExtra, parentReactivation: hsParent } = applyAnswerResult(currentCard, isCorrect);

    setCardUpdates(prev => ({
      ...prev,
      [currentCard.front]: {
        status: hsStatus,
        lastReviewed: Date.now(),
        ...(isBeingDemotedHs && { wasDemoted: true, demotionCount: currentCard.demotionCount || 0 }),
        srsInterval: srsHs.interval,
        srsEaseFactor: srsHs.easeFactor,
        srsNextReview: srsHs.nextReview,
        srsRepetitions: srsHs.repetitions,
        sessionAnswers: (prev[currentCard.front]?.sessionAnswers ?? 0) + 1,
        sessionCorrect: (prev[currentCard.front]?.sessionCorrect ?? 0) + (isCorrect ? 1 : 0),
        consecutiveCorrect: hsCC,
        consecutiveIncorrect: hsCI,
        ...hsExtra,
        ...(hsResponseTimeMs !== undefined && { responseTimeMs: hsResponseTimeMs, responseTimeIsCorrect: isCorrect }),
      },
      ...(hsParent && { [hsParent.front]: hsParent.update }),
    }));

    recordHistory(isCorrect);
    setDirection(isCorrect ? 1 : -1);
  };

  const handleFlashcardGrade = (isCorrect: boolean, e: React.MouseEvent) => {
    if (!currentCard) return;
    const gradeResponseTimeMs = captureResponseTime(currentCard.front);
    if (isCorrect && window.navigator?.vibrate) window.navigator.vibrate(50);
    if (isCorrect) triggerSparkle(e);

    if (pendingConfidence !== null) {
      const predictedCorrect = pendingConfidence >= 3;
      setSessionCalibration(prev => ({
        correct: prev.correct + (predictedCorrect === isCorrect ? 1 : 0),
        total: prev.total + 1,
      }));
      setPendingConfidence(null);
    }

    if (isCorrect) {

      const newStreak = streak + 1;
      setStreak(newStreak);
      updateStreakWithRecord(newStreak);
      setLiveCorrect(prev => prev + 1);
    } else {
      setStreak(0);
      setLiveIncorrect(prev => prev + 1);
    }

    const srs = withGrace(computeSM2(
      isCorrect ? 4 : 0,
      currentCard.srsRepetitions ?? 0,
      currentCard.srsInterval ?? 1,
      currentCard.srsEaseFactor ?? 2.5
    ));
    const status = intervalToStatus(srs.interval);

    setSessionStats(prev => ({
      ...prev,
      [status]: prev[status as keyof typeof prev] + 1
    }));

    const isBeingDemoted =
      status === 'charting' &&
      (currentCard.status === 'sailing' || currentCard.status === 'mastered');

    const { consecutiveCorrect: gradeCC, consecutiveIncorrect: gradeCI, extraCurrentCardFields: gradeExtra, parentReactivation: gradeParent } = applyAnswerResult(currentCard, isCorrect);

    setCardUpdates(prev => ({
      ...prev,
      [currentCard.front]: {
        status,
        lastReviewed: Date.now(),
        ...(isBeingDemoted && {
          wasDemoted: true,
          demotionCount: currentCard.demotionCount || 0,
        }),
        srsInterval: srs.interval,
        srsEaseFactor: srs.easeFactor,
        srsNextReview: srs.nextReview,
        srsRepetitions: srs.repetitions,
        sessionAnswers: (prev[currentCard.front]?.sessionAnswers ?? 0) + 1,
        sessionCorrect: (prev[currentCard.front]?.sessionCorrect ?? 0) + (isCorrect ? 1 : 0),
        consecutiveCorrect: gradeCC,
        consecutiveIncorrect: gradeCI,
        ...gradeExtra,
        ...(gradeResponseTimeMs !== undefined && { responseTimeMs: gradeResponseTimeMs, responseTimeIsCorrect: isCorrect }),
      },
      ...(gradeParent && { [gradeParent.front]: gradeParent.update }),
    }));
    recordHistory(isCorrect);
    setDirection(isCorrect ? 1 : -1);
    nextCard();
  };

  const handleFlashcardEasy = (e: React.MouseEvent) => {
    if (!currentCard) return;
    const easyResponseTimeMs = captureResponseTime(currentCard.front);
    if (window.navigator?.vibrate) window.navigator.vibrate(50);
    triggerSparkle(e);

    if (pendingConfidence !== null) {
      setSessionCalibration(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }));
      setPendingConfidence(null);
    }

    const newStreak = streak + 1;
    setStreak(newStreak);
    updateStreakWithRecord(newStreak);
    setLiveCorrect(prev => prev + 1);

    const srs = withGrace(computeSM2Easy(
      currentCard.srsRepetitions ?? 0,
      currentCard.srsInterval ?? 1,
      currentCard.srsEaseFactor ?? 2.5
    ));
    const status = intervalToStatus(srs.interval);

    setSessionStats(prev => ({ ...prev, [status]: prev[status as keyof typeof prev] + 1 }));

    const { consecutiveCorrect: easyCC, consecutiveIncorrect: easyCI, extraCurrentCardFields: easyExtra, parentReactivation: easyParent } = applyAnswerResult(currentCard, true);

    setCardUpdates(prev => ({
      ...prev,
      [currentCard.front]: {
        status,
        lastReviewed: Date.now(),
        srsInterval: srs.interval,
        srsEaseFactor: srs.easeFactor,
        srsNextReview: srs.nextReview,
        srsRepetitions: srs.repetitions,
        sessionAnswers: (prev[currentCard.front]?.sessionAnswers ?? 0) + 1,
        sessionCorrect: (prev[currentCard.front]?.sessionCorrect ?? 0) + 1,
        consecutiveCorrect: easyCC,
        consecutiveIncorrect: easyCI,
        ...easyExtra,
        ...(easyResponseTimeMs !== undefined && { responseTimeMs: easyResponseTimeMs, responseTimeIsCorrect: true }),
      },
      ...(easyParent && { [easyParent.front]: easyParent.update }),
    }));
    recordHistory(true);
    setDirection(1);
    nextCard();
  };

  const handleFlashcardHard = () => {
    if (!currentCard) return;
    const hardResponseTimeMs = captureResponseTime(currentCard.front);
    if (window.navigator?.vibrate) window.navigator.vibrate(30);

    if (pendingConfidence !== null) {
      const predictedCorrect = pendingConfidence >= 3;
      setSessionCalibration(prev => ({
        correct: prev.correct + (predictedCorrect ? 1 : 0),
        total: prev.total + 1,
      }));
      setPendingConfidence(null);
    }

    const newStreak = streak + 1;
    setStreak(newStreak);
    updateStreakWithRecord(newStreak);
    setLiveCorrect(prev => prev + 1);

    const srs = withGrace(computeSM2Hard(
      currentCard.srsRepetitions ?? 0,
      currentCard.srsInterval ?? 1,
      currentCard.srsEaseFactor ?? 2.5
    ));
    const status = intervalToStatus(srs.interval);

    setSessionStats(prev => ({ ...prev, [status]: prev[status as keyof typeof prev] + 1 }));

    const { consecutiveCorrect: hardCC, consecutiveIncorrect: hardCI, extraCurrentCardFields: hardExtra, parentReactivation: hardParent } = applyAnswerResult(currentCard, true);

    setCardUpdates(prev => ({
      ...prev,
      [currentCard.front]: {
        status,
        lastReviewed: Date.now(),
        srsInterval: srs.interval,
        srsEaseFactor: srs.easeFactor,
        srsNextReview: srs.nextReview,
        srsRepetitions: srs.repetitions,
        sessionAnswers: (prev[currentCard.front]?.sessionAnswers ?? 0) + 1,
        sessionCorrect: (prev[currentCard.front]?.sessionCorrect ?? 0) + 1,
        consecutiveCorrect: hardCC,
        consecutiveIncorrect: hardCI,
        ...hardExtra,
        ...(hardResponseTimeMs !== undefined && { responseTimeMs: hardResponseTimeMs, responseTimeIsCorrect: true }),
      },
      ...(hardParent && { [hardParent.front]: hardParent.update }),
    }));
    recordHistory(true);
    setDirection(1);
    nextCard();
  };

  const handleEasyAfterCorrect = (e: React.MouseEvent) => {
    if (!currentCard) return;
    if (window.navigator?.vibrate) window.navigator.vibrate(50);
    triggerSparkle(e);

    const srs = withGrace(computeSM2Easy(
      currentCard.srsRepetitions ?? 0,
      currentCard.srsInterval ?? 1,
      currentCard.srsEaseFactor ?? 2.5
    ));
    const status = intervalToStatus(srs.interval);

    setCardUpdates(prev => ({
      ...prev,
      [currentCard.front]: {
        ...prev[currentCard.front],
        status,
        lastReviewed: Date.now(),
        srsInterval: srs.interval,
        srsEaseFactor: srs.easeFactor,
        srsNextReview: srs.nextReview,
        srsRepetitions: srs.repetitions,
      },
    }));
    recordHistory(true);
    setDirection(1);
    nextCard();
  };

  const handleHardAfterCorrect = () => {
    if (!currentCard) return;
    if (window.navigator?.vibrate) window.navigator.vibrate(30);

    const srs = withGrace(computeSM2Hard(
      currentCard.srsRepetitions ?? 0,
      currentCard.srsInterval ?? 1,
      currentCard.srsEaseFactor ?? 2.5
    ));
    const status = intervalToStatus(srs.interval);

    setCardUpdates(prev => ({
      ...prev,
      [currentCard.front]: {
        ...prev[currentCard.front],
        status,
        lastReviewed: Date.now(),
        srsInterval: srs.interval,
        srsEaseFactor: srs.easeFactor,
        srsNextReview: srs.nextReview,
        srsRepetitions: srs.repetitions,
      },
    }));
    recordHistory(true);
    setDirection(1);
    nextCard();
  };

  const recordHistory = (wasCorrect: boolean | null) => {
    const idx = currentIndex;
    lastAnsweredIndexRef.current = idx;
    setHistoryResults(prev => {
      const next = [...prev];
      next[idx] = wasCorrect;
      return next;
    });
  };

  const nextCard = () => {
    setLastAnswerCorrect(null);
    if (isTestMode) {
      const answered = lastAnsweredIndexRef.current;
      const total = shuffledCards.length;
      // Find next unanswered card (null or undefined), skipping the just-answered index
      let next = -1;
      for (let i = answered + 1; i < total; i++) {
        if (historyResults[i] == null) { next = i; break; }
      }
      if (next === -1) {
        for (let i = 0; i < answered; i++) {
          if (historyResults[i] == null) { next = i; break; }
        }
      }
      if (next !== -1) {
        setCurrentIndex(next);
        setViewIndex(next);
      } else {
        setSessionComplete(true);
      }
      return;
    }
    if (currentIndex < shuffledCards.length - 1) {
      const next = currentIndex + 1;
      setCurrentIndex(next);
      setViewIndex(next);
    } else {
      setSessionComplete(true);
    }
  };

  const jumpToCard = (n: number) => {
    if (n < 0 || n >= shuffledCards.length || n === viewIndex) return;
    const result = historyResults[n];
    setDirection(n > viewIndex ? 1 : -1);
    if (result === true || result === false) {
      // Answered card: review-only
      setViewIndex(n);
    } else {
      // Unanswered/skipped: make it the active card
      setCurrentIndex(n);
      setViewIndex(n);
      lastAnsweredIndexRef.current = -1;
    }
  };

  const skipCard = () => {
    // Skipped cards intentionally get NO entry in cardUpdates — the user explicitly
    // wants skipped cards to remain "due" on the dashboard so they're surfaced again
    // next session. Do not write any SRS update for them.
    recordHistory(null);
    setDirection(1);
    nextCard();
  };

  const toggleMultiSelectOption = (option: string) => {
    if (isFlipped) return;
    const newSelection = new Set(selectedMultiOptions);
    if (newSelection.has(option)) {
      newSelection.delete(option);
    } else {
      newSelection.add(option);
    }
    setSelectedMultiOptions(newSelection);
  };

  const handleMultiSelectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCard) return;
    const msResponseTimeMs = captureResponseTime(currentCard.front);

    setIsFlipped(true);
    // Use getMcqCorrectOpts so this handler works for both legacy multi-select and multi-answer MCQ cards
    const correctOptionsSet = new Set(getMcqCorrectOpts(currentCard));
    let isCorrect = true;

    if (selectedMultiOptions.size !== correctOptionsSet.size) {
      isCorrect = false;
    } else {
      for (const opt of selectedMultiOptions) {
        if (!correctOptionsSet.has(opt)) {
          isCorrect = false;
          break;
        }
      }
    }

    setLastAnswerCorrect(isCorrect);

    if (isCorrect) {

      const newStreak = streak + 1;
      setStreak(newStreak);
      updateStreakWithRecord(newStreak);
      setLiveCorrect(prev => prev + 1);
    } else {
      setStreak(0);
      setLiveIncorrect(prev => prev + 1);
      setShowAskButton(true);
    }

    const srsMs = withGrace(computeSM2(isCorrect ? 4 : 0, currentCard.srsRepetitions ?? 0, currentCard.srsInterval ?? 1, currentCard.srsEaseFactor ?? 2.5));
    const status = intervalToStatus(srsMs.interval);

    setSessionStats(prev => ({
      ...prev,
      [status]: prev[status as keyof typeof prev] + 1
    }));

    const isBeingDemotedMs =
      status === 'charting' &&
      (currentCard.status === 'sailing' || currentCard.status === 'mastered');

    const { consecutiveCorrect: msCC, consecutiveIncorrect: msCI, extraCurrentCardFields: msExtra, parentReactivation: msParent } = applyAnswerResult(currentCard, isCorrect);

    setCardUpdates(prev => ({
      ...prev,
      [currentCard.front]: {
        status,
        lastReviewed: Date.now(),
        ...(isBeingDemotedMs && {
          wasDemoted: true,
          demotionCount: currentCard.demotionCount || 0,
        }),
        srsInterval: srsMs.interval,
        srsEaseFactor: srsMs.easeFactor,
        srsNextReview: srsMs.nextReview,
        srsRepetitions: srsMs.repetitions,
        sessionAnswers: (prev[currentCard.front]?.sessionAnswers ?? 0) + 1,
        sessionCorrect: (prev[currentCard.front]?.sessionCorrect ?? 0) + (isCorrect ? 1 : 0),
        consecutiveCorrect: msCC,
        consecutiveIncorrect: msCI,
        ...msExtra,
        ...(msResponseTimeMs !== undefined && { responseTimeMs: msResponseTimeMs, responseTimeIsCorrect: isCorrect }),
      },
      ...(msParent && { [msParent.front]: msParent.update }),
    }));
  };

  const handleSequenceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCard || !currentCard.options) return;
    const seqResponseTimeMs = captureResponseTime(currentCard.front);

    setIsFlipped(true);
    const isCorrect = shuffledSequence.every((item, idx) => item.text === currentCard.options![idx]);

    setLastAnswerCorrect(isCorrect);

    if (isCorrect) {

      const newStreak = streak + 1;
      setStreak(newStreak);
      updateStreakWithRecord(newStreak);
      setLiveCorrect(prev => prev + 1);
    } else {
      setStreak(0);
      setLiveIncorrect(prev => prev + 1);
    }

    const srsSeq = withGrace(computeSM2(isCorrect ? 4 : 0, currentCard.srsRepetitions ?? 0, currentCard.srsInterval ?? 1, currentCard.srsEaseFactor ?? 2.5));
    const status = intervalToStatus(srsSeq.interval);

    setSessionStats(prev => ({
      ...prev,
      [status]: prev[status as keyof typeof prev] + 1
    }));

    const isBeingDemotedSeq =
      status === 'charting' &&
      (currentCard.status === 'sailing' || currentCard.status === 'mastered');

    const { consecutiveCorrect: seqCC, consecutiveIncorrect: seqCI, extraCurrentCardFields: seqExtra, parentReactivation: seqParent } = applyAnswerResult(currentCard, isCorrect);

    setCardUpdates(prev => ({
      ...prev,
      [currentCard.front]: {
        status,
        lastReviewed: Date.now(),
        ...(isBeingDemotedSeq && {
          wasDemoted: true,
          demotionCount: currentCard.demotionCount || 0,
        }),
        srsInterval: srsSeq.interval,
        srsEaseFactor: srsSeq.easeFactor,
        srsNextReview: srsSeq.nextReview,
        srsRepetitions: srsSeq.repetitions,
        sessionAnswers: (prev[currentCard.front]?.sessionAnswers ?? 0) + 1,
        sessionCorrect: (prev[currentCard.front]?.sessionCorrect ?? 0) + (isCorrect ? 1 : 0),
        consecutiveCorrect: seqCC,
        consecutiveIncorrect: seqCI,
        ...seqExtra,
        ...(seqResponseTimeMs !== undefined && { responseTimeMs: seqResponseTimeMs, responseTimeIsCorrect: isCorrect }),
      },
      ...(seqParent && { [seqParent.front]: seqParent.update }),
    }));
  };

  const handleOptionSelect = (option: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentCard || selectedOption !== null) return; // Prevent multiple clicks
    const mcqResponseTimeMs = captureResponseTime(currentCard.front);
    setSelectedOption(option);

    const isCorrect = option === currentCard?.back;
    setLastAnswerCorrect(isCorrect);
    if (isCorrect) {
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(50);
      }
      triggerSparkle(e);

      const newStreak = streak + 1;
      setStreak(newStreak);
      updateStreakWithRecord(newStreak);
      setLiveCorrect(prev => prev + 1);

      const srsMcqCorrect = withGrace(computeSM2(4, currentCard.srsRepetitions ?? 0, currentCard.srsInterval ?? 1, currentCard.srsEaseFactor ?? 2.5));
      const status = intervalToStatus(srsMcqCorrect.interval);

      setSessionStats(prev => ({
        ...prev,
        [status]: prev[status as keyof typeof prev] + 1
      }));

      const { consecutiveCorrect: mcqCC, consecutiveIncorrect: mcqCI, extraCurrentCardFields: mcqExtra, parentReactivation: mcqParent } = applyAnswerResult(currentCard, true);

      setCardUpdates(prev => ({
        ...prev,
        [currentCard.front]: {
          status,
          lastReviewed: Date.now(),
          srsInterval: srsMcqCorrect.interval,
          srsEaseFactor: srsMcqCorrect.easeFactor,
          srsNextReview: srsMcqCorrect.nextReview,
          srsRepetitions: srsMcqCorrect.repetitions,
          sessionAnswers: (prev[currentCard.front]?.sessionAnswers ?? 0) + 1,
          sessionCorrect: (prev[currentCard.front]?.sessionCorrect ?? 0) + 1,
          consecutiveCorrect: mcqCC,
          consecutiveIncorrect: mcqCI,
          ...mcqExtra,
          ...(mcqResponseTimeMs !== undefined && { responseTimeMs: mcqResponseTimeMs, responseTimeIsCorrect: true }),
        },
        ...(mcqParent && { [mcqParent.front]: mcqParent.update }),
      }));
    } else {
      setStreak(0);
      setLiveIncorrect(prev => prev + 1);
      setShowAskButton(true);

      const srsMcqWrong = withGrace(computeSM2(0, currentCard.srsRepetitions ?? 0, currentCard.srsInterval ?? 1, currentCard.srsEaseFactor ?? 2.5));
      const status = intervalToStatus(srsMcqWrong.interval);

      setSessionStats(prev => ({
        ...prev,
        [status]: prev[status as keyof typeof prev] + 1
      }));

      const isBeingDemotedMcq =
        status === 'charting' &&
        (currentCard.status === 'sailing' || currentCard.status === 'mastered');

      const { consecutiveCorrect: mcqWCC, consecutiveIncorrect: mcqWCI, extraCurrentCardFields: mcqWExtra, parentReactivation: mcqWParent } = applyAnswerResult(currentCard, false);

      setCardUpdates(prev => ({
        ...prev,
        [currentCard.front]: {
          status,
          lastReviewed: Date.now(),
          ...(isBeingDemotedMcq && {
            wasDemoted: true,
            demotionCount: currentCard.demotionCount || 0,
          }),
          srsInterval: srsMcqWrong.interval,
          srsEaseFactor: srsMcqWrong.easeFactor,
          srsNextReview: srsMcqWrong.nextReview,
          srsRepetitions: srsMcqWrong.repetitions,
          sessionAnswers: (prev[currentCard.front]?.sessionAnswers ?? 0) + 1,
          sessionCorrect: prev[currentCard.front]?.sessionCorrect ?? 0,
          consecutiveCorrect: mcqWCC,
          consecutiveIncorrect: mcqWCI,
          ...mcqWExtra,
          ...(mcqResponseTimeMs !== undefined && { responseTimeMs: mcqResponseTimeMs, responseTimeIsCorrect: false }),
        },
        ...(mcqWParent && { [mcqWParent.front]: mcqWParent.update }),
      }));
    }
  };

  const handleNextComplex = () => {
    // For Fill-in-the-blank, it already calculates progress in handleFibSubmit
    if (currentCard?.type === 'fill-in-the-blank') {
      recordHistory(isFibCorrect);
      nextCard();
      return;
    }

    // Multi-answer MCQ cards (≥2 correct options) use the same submit flow as legacy multi-select
    if (currentCard?.type === 'multi-select' || (currentCard?.type === 'mcq' && getMcqCorrectOpts(currentCard).length > 1)) {
      const correctOptionsSet = new Set(getMcqCorrectOpts(currentCard));
      let isCorrect = selectedMultiOptions.size === correctOptionsSet.size;
      if (isCorrect) {
        for (const opt of selectedMultiOptions) {
          if (!correctOptionsSet.has(opt)) {
            isCorrect = false; break;
          }
        }
      }
      recordHistory(isCorrect);
      setDirection(isCorrect ? 1 : -1);
      nextCard();
    }
    // For Sequencing
    else if (currentCard?.type === 'sequencing') {
      const isCorrect = shuffledSequence.every((item, idx) => item.text === currentCard.options![idx]);
      recordHistory(isCorrect);
      setDirection(isCorrect ? 1 : -1);
      nextCard();
    }
    // For Hotspot — result already recorded in handleHotspotPointerDown
    else if (currentCard?.type === 'hotspot') {
      nextCard();
    }
  };

  const handleNextMCQ = () => {
    // Only determine direction when actually advancing
    const isCorrect = selectedOption === currentCard?.back;
    recordHistory(lastAnswerCorrect);
    setDirection(isCorrect ? 1 : -1);
    nextCard();
  };

  const handleAskQuestion = async (visibility: 'friends' | 'global', isAnonymous = false, note = '') => {
    if (!currentCard) return;
    try {
      setIsAskingQuestion(true);
      await askQuestion(currentCard, islandId || island.id || '', visibility, friends, currentUserName, isAnonymous, note);
      setQuestionJustAsked(true);
      setAskModalOpen(false);
    } catch (err) {
      console.error('Failed to post question:', err);
    } finally {
      setIsAskingQuestion(false);
    }
  };

  const renderAcceptPrompt = () => {
    if (!cardQuestion || cardQuestion.status !== 'open' || cardAnswers.length === 0) return null;
    if (selectingAnswerForCard) {
      return (
        <div className="mt-2 w-full" onClick={e => e.stopPropagation()}>
          <p className="text-[9px] uppercase tracking-widest font-bold text-emerald-400 mb-1.5 text-center">Which answer helped?</p>
          <div className="flex flex-col gap-1.5">
            {cardAnswers.map(answer => (
              <button
                key={answer.id}
                onClick={() => { handleAcceptAnswer(answer); setSelectingAnswerForCard(false); }}
                className="w-full text-left p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all"
              >
                <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/60 block mb-0.5">{answer.helperName}</span>
                <p className="text-[11px] text-white/60 line-clamp-2">{answer.bodyText}</p>
              </button>
            ))}
          </div>
          <button
            onClick={() => setSelectingAnswerForCard(false)}
            className="mt-1 w-full text-center text-[9px] text-white/25 uppercase tracking-widest py-1"
          >
            Cancel
          </button>
        </div>
      );
    }
    return (
      <button
        onClick={e => { e.stopPropagation(); setSelectingAnswerForCard(true); }}
        className="mt-2 w-full text-[10px] uppercase tracking-widest font-bold text-emerald-400/60 hover:text-emerald-300 transition-colors text-center"
      >
        Did any of these help? →
      </button>
    );
  };

  const handleAcceptAnswer = async (answer: Answer) => {
    if (!cardQuestion || cardQuestion.status === 'answered') return;
    // Build updated object first so both the optimistic state and the Firestore write use the same value
    const updatedQuestion = { ...cardQuestion, status: 'answered' as const, acceptedAnswerId: answer.id };
    setCardQuestion(updatedQuestion);
    await acceptAnswer(updatedQuestion, answer.id, answer.helperId);
    // Re-queue card so learner gets a second attempt with new context
    if (currentCard) {
      setShuffledCards(prev => [
        ...prev.slice(0, currentIndex + 1),
        currentCard,
        ...prev.slice(currentIndex + 1),
      ]);
    }
    setCardAnswers([]);
  };

  const handleMatchingSelect = (side: 'left' | 'right', id: string, e: React.MouseEvent) => {
    if (!currentCard) return;
    e.stopPropagation();

    let newLeft = selectedLeft;
    let newRight = selectedRight;

    if (side === 'left') {
      if (selectedLeft === id) newLeft = null;
      else newLeft = id;
    } else {
      if (selectedRight === id) newRight = null;
      else newRight = id;
    }

    setSelectedLeft(newLeft);
    setSelectedRight(newRight);

    if (newLeft && newRight) {
      // Check match
      const rightItem = matchingRights.find(r => r.id === newRight);
      if (rightItem && rightItem.matchId === newLeft) {
        // Match found!
        if (window.navigator?.vibrate) window.navigator.vibrate(50);
        triggerSparkle(e);

        const nextMatchedRights = new Set(matchedRightIds).add(newRight);
        setMatchedRightIds(nextMatchedRights);

        // Check if all rights for this left are found
        const totalRightsForLeft = matchingRights.filter(r => r.matchId === newLeft).length;
        const matchedRightsForLeft = matchingRights.filter(r => r.matchId === newLeft && nextMatchedRights.has(r.id)).length;

        if (matchedRightsForLeft === totalRightsForLeft) {
          setMatchedLeftIds(new Set(matchedLeftIds).add(newLeft));
        }

        setSelectedLeft(null);
        setSelectedRight(null);
        setMatchingErrors(new Set()); // clear errors

        // Check if completely done
        if (nextMatchedRights.size === matchingRights.length) {
          const matchResponseTimeMs = captureResponseTime(currentCard.front);
          // Finished card
          if (matchingMistakesCount === 0) {
            const newStreak = streak + 1;
            setStreak(newStreak);
            updateStreakWithRecord(newStreak);
      
            setLiveCorrect(prev => prev + 1);

            const srsMatchCorrect = withGrace(computeSM2(5, currentCard.srsRepetitions ?? 0, currentCard.srsInterval ?? 1, currentCard.srsEaseFactor ?? 2.5));
            const status = intervalToStatus(srsMatchCorrect.interval);

            setSessionStats(prev => ({
              ...prev,
              [status]: prev[status as keyof typeof prev] + 1
            }));

            const { consecutiveCorrect: matchCC, consecutiveIncorrect: matchCI, extraCurrentCardFields: matchExtra, parentReactivation: matchParent } = applyAnswerResult(currentCard, true);

            setCardUpdates(prev => ({
              ...prev,
              [currentCard.front]: {
                status,
                lastReviewed: Date.now(),
                srsInterval: srsMatchCorrect.interval,
                srsEaseFactor: srsMatchCorrect.easeFactor,
                srsNextReview: srsMatchCorrect.nextReview,
                srsRepetitions: srsMatchCorrect.repetitions,
                sessionAnswers: (prev[currentCard.front]?.sessionAnswers ?? 0) + 1,
                sessionCorrect: (prev[currentCard.front]?.sessionCorrect ?? 0) + 1,
                consecutiveCorrect: matchCC,
                consecutiveIncorrect: matchCI,
                ...matchExtra,
                ...(matchResponseTimeMs !== undefined && { responseTimeMs: matchResponseTimeMs, responseTimeIsCorrect: true }),
              },
              ...(matchParent && { [matchParent.front]: matchParent.update }),
            }));
            setDirection(1);
          } else {
            setStreak(0);
            setLiveIncorrect(prev => prev + 1);

            const srsMatchWrong = withGrace(computeSM2(0, currentCard.srsRepetitions ?? 0, currentCard.srsInterval ?? 1, currentCard.srsEaseFactor ?? 2.5));
            const status = intervalToStatus(srsMatchWrong.interval);

            setSessionStats(prev => ({
              ...prev,
              [status]: prev[status as keyof typeof prev] + 1
            }));

            const isBeingDemotedMatch =
              status === 'charting' &&
              (currentCard.status === 'sailing' || currentCard.status === 'mastered');

            const { consecutiveCorrect: matchWCC, consecutiveIncorrect: matchWCI, extraCurrentCardFields: matchWExtra, parentReactivation: matchWParent } = applyAnswerResult(currentCard, false);

            setCardUpdates(prev => ({
              ...prev,
              [currentCard.front]: {
                status,
                lastReviewed: Date.now(),
                ...(isBeingDemotedMatch && {
                  wasDemoted: true,
                  demotionCount: currentCard.demotionCount || 0,
                }),
                srsInterval: srsMatchWrong.interval,
                srsEaseFactor: srsMatchWrong.easeFactor,
                srsNextReview: srsMatchWrong.nextReview,
                srsRepetitions: srsMatchWrong.repetitions,
                sessionAnswers: (prev[currentCard.front]?.sessionAnswers ?? 0) + 1,
                sessionCorrect: prev[currentCard.front]?.sessionCorrect ?? 0,
                consecutiveCorrect: matchWCC,
                consecutiveIncorrect: matchWCI,
                ...matchWExtra,
                ...(matchResponseTimeMs !== undefined && { responseTimeMs: matchResponseTimeMs, responseTimeIsCorrect: false }),
              },
              ...(matchWParent && { [matchWParent.front]: matchWParent.update }),
            }));
            setDirection(-1);
          }
          setMatchingComplete(true);
          setLastAnswerCorrect(matchingMistakesCount === 0);
        }
      } else {
        // Mismatch
        if (window.navigator?.vibrate) window.navigator.vibrate([50, 100, 50]);
        setMatchingErrors(new Set([newLeft, newRight]));
        setMatchingMistakesCount(prev => prev + 1);
        setSelectedLeft(null);
        setSelectedRight(null);

        // Clear error after a short delay
        setTimeout(() => {
          setMatchingErrors(new Set());
        }, 600);
      }
    }
  };

  // Merges the reel-in backup into cardUpdates before a navigation callback fires.
  // Cards that were deleted when the reel-in started and never re-answered (no new
  // cardUpdates entry yet) are restored from the backup so they still get written to
  // Firestore with their original wrong-answer SRS values.
  const mergeReelInBackup = (updates: CardUpdateRecord): CardUpdateRecord => {
    const backup = reelInBackupRef.current;
    if (Object.keys(backup).length === 0) return updates;
    const merged = { ...updates };
    Object.entries(backup).forEach(([front, update]) => {
      if (!merged[front]) merged[front] = update;
    });
    return merged;
  };

  // Backup of wrong-card updates from before the reel-in drill started.
  // If the user starts the reel-in but leaves mid-drill without re-answering any
  // wrong cards, the original wrong-answer SRS data is restored on navigation so
  // those cards still get saved (preventing them from staying permanently "due").
  const reelInBackupRef = useRef<CardUpdateRecord>({});

  const startWrongAnswerDrill = () => {
    const wrongCards = shuffledCards.filter(card =>
      cardUpdates[card.front] !== undefined &&
      (cardUpdates[card.front]?.sessionCorrect ?? 0) === 0
    );
    if (wrongCards.length === 0) return;
    const wrongCardFronts = new Set(wrongCards.map(c => c.front));

    // Save the wrong cards' current updates before removing them, so they can be
    // restored if the user abandons the reel-in without answering any cards.
    const backup: CardUpdateRecord = {};
    wrongCardFronts.forEach(front => {
      if (cardUpdates[front]) backup[front] = cardUpdates[front];
    });
    reelInBackupRef.current = backup;

    setShuffledCards(shuffleArray(wrongCards));
    setCurrentIndex(0);
    setSessionComplete(false);
    // Only clear wrong cards so correct answers from round 1 are preserved and saved
    setCardUpdates(prev => {
      const next = { ...prev };
      wrongCardFronts.forEach(front => delete next[front]);
      return next;
    });
    setStreak(0);
    setLiveCorrect(0);
    setLiveIncorrect(0);
    setSessionMaxStreak(0);
    setSessionStats({ mastered: 0, sailing: 0, charting: 0 });
    sessionConsecutiveRef.current = new Map();
    firstAttemptRecorded.current = new Set();
    sessionStartTime.current = Date.now();
  };

  if (sessionComplete) {
    const cardsReviewed = Object.keys(cardUpdates).length;
    const correctAnswers = Object.values<{ sessionCorrect?: number }>(cardUpdates as any).filter(c => (c.sessionCorrect ?? 0) > 0).length;
    const incorrectAnswers = Object.values<{ sessionCorrect?: number }>(cardUpdates as any).filter(c => (c.sessionCorrect ?? 0) === 0).length;
    const accuracyPct = cardsReviewed > 0 ? Math.round((correctAnswers / cardsReviewed) * 100) : 0;
    const dueCardsCleared = Object.keys(cardUpdates).filter(front => dueCardFrontsAtStart.has(front)).length;
    const meta = buildMeta();
    if (isTestMode) return null;
    const chartingCards = Object.entries(cardUpdates)
      .filter(([, u]) => (u as any).sessionCorrect === 0)
      .map(([front]) => ({ name: front, islandName: cardIslandRef.current[front] }));

    return (
      <SessionComplete
        accuracyPct={accuracyPct}
        cardsReviewed={cardsReviewed}
        correctAnswers={correctAnswers}
        incorrectAnswers={incorrectAnswers}

        sessionMaxStreak={sessionMaxStreak}
        isNewRecord={isNewRecord}
        dueCardsCleared={dueCardsCleared}
        dueCardFrontsAtStartSize={dueCardFrontsAtStart.size}
        mode={mode || 'all'}
        islandName={island.name}
        archipelagoName={archipelagoName}
        chartingCards={chartingCards}
        cardUpdates={attachCardIdentities(cardUpdates)}
        maxStreak={maxStreak}
        meta={meta}
        onFinish={onFinish}
        onStartWrongDrill={startWrongAnswerDrill}
      />
    );
  }

  return (
    <>
      <div className="max-w-2xl mx-auto w-full flex flex-col items-center pb-12">
        {/* Sparkles Layer */}
        <SparkleLayer sparkles={sparkles} />

        {/* Tier progression notifications */}
        <AnimatePresence>
          {tierUnlockNotif !== null && (
            <motion.div
              key="tier-unlock"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-emerald-500/90 text-white text-sm font-semibold shadow-lg backdrop-blur-sm pointer-events-none"
            >
              Tier {tierUnlockNotif + 1} unlocked — new challenge added!
            </motion.div>
          )}
          {reactivationNotif !== null && (
            <motion.div
              key="reactivation"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-amber-500/90 text-white text-sm font-semibold shadow-lg backdrop-blur-sm pointer-events-none"
            >
              Tier {reactivationNotif} returned for extra practice
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-full flex justify-between items-center mb-8 sm:mb-12">
          <div className="flex items-center gap-1 sm:gap-2">
            <NavAction
              icon={ArrowLeft}
              label="To Map"
              onClick={() => onBackToMap(attachCardIdentities(mergeReelInBackup(cardUpdates)), maxStreak, buildMeta())}
            />

            <div className="hidden sm:flex items-center gap-3 glass px-4 py-2 rounded-full border-white/5 shadow-lg ml-2">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 shrink-0">
                <img
                  src={imageSrc}
                  alt={`${masteryLevel} island`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (masteryLevel === 'charting') target.src = 'https://images.unsplash.com/photo-1505672678657-cc7037095e60?auto=format&fit=crop&q=80&w=200&h=200';
                    else if (masteryLevel === 'sailing') target.src = 'https://images.unsplash.com/photo-1544550581-5f7ceaf7f992?auto=format&fit=crop&q=80&w=200&h=200';
                    else target.src = 'https://images.unsplash.com/photo-1523363065056-11f8b449174b?auto=format&fit=crop&q=80&w=200&h=200';
                  }}
                />
              </div>
              <span className="text-xs font-bold text-white truncate max-w-[120px]">{island.name}</span>
            </div>

            <NavAction
              icon={Database}
              label="Manage Cards"
              onClick={() => onManage(attachCardIdentities(mergeReelInBackup(cardUpdates)), maxStreak, buildMeta())}
            />

            <NavAction
              icon={CheckCircle2}
              label="End Early"
              onClick={() => setSessionComplete(true)}
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {onSwitchMode && (
              <NavAction
                icon={mode === 'all' ? Zap : Library}
                label={mode === 'all' ? 'Charting' : 'All Cards'}
                variant="primary"
                onClick={() => onSwitchMode(mode === 'all' ? 'charting' : 'all', attachCardIdentities(mergeReelInBackup(cardUpdates)), maxStreak, buildMeta())}
              />
            )}
            <div className="flex items-center gap-2 glass px-3 md:px-4 py-2 rounded-full border-white/5 shadow-lg group relative">
              <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary group-hover:scale-110 transition-transform" />
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">
                <span className="hidden sm:inline">Card </span>
                {viewIndex + 1} / {shuffledCards.length}
                {isViewingHistory && <span className="text-amber-400 ml-1">↩</span>}
              </span>
            </div>
            {timeoutPerCardSec && timeLeft !== null && (
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest border transition-colors ${
                timeLeft <= 10
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : timeLeft <= 20
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'glass border-white/5 text-brand-muted'
              }`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" d="M12 7v5l3 3" />
                </svg>
                {timeLeft}s / Q
              </div>
            )}
            {totalTimeLimitSec && totalTimeLeft !== null && (
              <div className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest border transition-colors ${
                totalTimeLeft <= 60
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : totalTimeLeft <= 300
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'glass border-white/5 text-brand-muted'
              }`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" d="M12 7v5l3 3" />
                </svg>
                {Math.floor(totalTimeLeft / 60)}:{String(totalTimeLeft % 60).padStart(2, '0')}
              </div>
            )}
          </div>
        </div>

        {/* Scenario passage panel — stays mounted while all cards in the group are active */}
        <AnimatePresence>
          {activeScenario && (
            <motion.div
              key={activeScenario.id}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="w-full mb-6 p-5 rounded-2xl bg-sky-500/5 border border-sky-500/20"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-widest font-bold text-sky-400">
                  Scenario
                </span>
                <span className="text-[10px] uppercase tracking-widest font-bold text-sky-400/60">
                  Question {activeScenario.questionNumber} of {activeScenario.groupSize}
                </span>
              </div>
              <div className="text-sm text-white/80 leading-relaxed">
                <RichText>{activeScenario.text}</RichText>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card Arena */}
        <div className="w-full perspective-1000 relative">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={viewIndex}
              custom={direction}
              variants={{
                enter: (direction: number) => ({
                  x: direction > 0 ? '110%' : '-110%',
                  opacity: 0,
                  scale: 0.8,
                  rotate: direction * 10
                }),
                center: {
                  zIndex: 50,
                  x: 0,
                  opacity: 1,
                  scale: 1,
                  rotate: 0
                },
                exit: (direction: number) => ({
                  zIndex: 10,
                  x: direction > 0 ? '-110%' : '110%',
                  opacity: 0,
                  scale: 0.8,
                  rotate: direction * -10
                })
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
              className="w-full group"
            >
              <div className="w-full relative">
                {/* History review card — shown when navigating back through answered cards */}
                {isViewingHistory && (
                  <div className={cn(
                    "glass rounded-[40px] p-6 sm:p-8 md:p-12 flex flex-col border-brand-primary/20 shadow-2xl min-h-[50vh] sm:min-h-[500px]",
                    !isTestMode && historyResults[viewIndex] === true ? "border-emerald-500/20 bg-emerald-950/10" :
                    !isTestMode && historyResults[viewIndex] === false ? "border-red-500/20 bg-red-950/10" : "border-white/10"
                  )}>
                    <div className="flex items-center justify-between mb-6 shrink-0">
                      <span className="text-[9px] uppercase tracking-widest font-bold text-brand-muted/50">Card {viewIndex + 1}</span>
                      {isTestMode ? (
                        <span className="text-[9px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full border text-brand-muted/60 bg-white/5 border-white/10">
                          {historyResults[viewIndex] == null ? '– Unanswered' : 'Answered'}
                        </span>
                      ) : (
                        <span className={cn(
                          "text-[9px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full border",
                          historyResults[viewIndex] === true ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                          historyResults[viewIndex] === false ? "text-red-400 bg-red-500/10 border-red-500/20" :
                          "text-brand-muted/60 bg-white/5 border-white/10"
                        )}>
                          {historyResults[viewIndex] === true ? '✓ Correct' : historyResults[viewIndex] === false ? '✗ Incorrect' : '– Skipped'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-brand-muted/40 mb-4">Question</p>
                      {viewedCard?.imageUrl && isOnline && (
                        <div className="mb-4 w-full"><LightboxImage src={viewedCard.imageUrl} className="w-full max-h-48 object-contain rounded-xl" /></div>
                      )}
                      <h2 className="text-xl sm:text-2xl font-normal leading-snug tracking-tight text-white">
                        <RichText>{viewedCard?.front}</RichText>
                      </h2>
                    </div>
                    <div className="border-t border-white/10 my-6 shrink-0" />
                    <div className="text-center shrink-0">
                      <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-brand-muted/40 mb-4">Answer</p>
                      {viewedCard?.backImageUrl && isOnline && (
                        <div className="mb-3 w-full"><LightboxImage src={viewedCard.backImageUrl} className="w-full max-h-40 object-contain rounded-xl" /></div>
                      )}
                      <div className={cn(
                        "text-base sm:text-lg leading-relaxed",
                        !isTestMode && historyResults[viewIndex] === true ? "text-emerald-300" :
                        !isTestMode && historyResults[viewIndex] === false ? "text-red-300" : "text-white/60"
                      )}>
                        {viewedCard?.type === 'sequencing' && viewedCard.options ? (
                          <ol className="text-left list-decimal list-inside space-y-1 text-sm">
                            {viewedCard.options.map((opt, i) => <li key={i}><RichText>{opt}</RichText></li>)}
                          </ol>
                        ) : (
                          <RichText>{viewedCard?.back}</RichText>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {/* Card */}
                <div
                  className={cn(
                    "glass rounded-[40px] p-6 sm:p-8 md:p-12 flex flex-col items-center text-center border-brand-primary/20 shadow-2xl min-h-[50vh] sm:min-h-[500px] relative",
                    (!currentCard?.type || currentCard.type === 'flashcard') && !isFlipped ? "justify-between" : "justify-center",
                    isViewingHistory && "hidden"
                  )}
                >

                  <p className="text-brand-muted uppercase tracking-[0.2em] font-medium text-[10px] sm:text-xs mb-4 sm:mb-6 shrink-0">
                    {currentCard?.type === 'mcq' ? (getMcqCorrectOpts(currentCard).length > 1 ? 'Select All That Apply' : 'Select the Correct Answer') : currentCard?.type === 'matching' ? 'Match the Objects' : currentCard?.type === 'fill-in-the-blank' ? (isFlipped && isFibCorrect !== null ? (isFibCorrect ? 'Excellent Work' : 'Correction Analysis') : 'Fill in the Blank') : currentCard?.type === 'multi-select' ? 'Select All That Apply' : currentCard?.type === 'sequencing' ? 'Put in the Correct Order' : currentCard?.type === 'hotspot' ? (isFlipped ? (hotspotCorrect ? 'Correct Region!' : 'Missed It') : 'Click the Image') : isFlipped ? 'Anchored Response' : 'Front Side'}
                    {tierInfo && (
                      <span className="ml-3 px-2.5 py-1 bg-white/10 rounded-full border border-white/20 text-white font-bold text-[10px] shadow-sm">
                        Tier {tierInfo.current} / {tierInfo.total}
                      </span>
                    )}
                  </p>

                  {/* For flashcards: wrap question in flex-1 so confidence section anchors to bottom */}
                  {(!currentCard?.type || currentCard.type === 'flashcard') ? (
                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                      {currentCard?.imageUrl && (
                        <div className="mb-4 w-full">
                          {isOnline ? (
                            <>
                              <LightboxImage src={currentCard.imageUrl} className="w-full max-h-48 object-contain rounded-xl" />
                              {currentCard.imageCredit && (
                                <p className="text-[10px] text-brand-muted/70 italic mt-1 text-center">{currentCard.imageCredit}</p>
                              )}
                            </>
                          ) : (
                            <OfflineImageNotice />
                          )}
                        </div>
                      )}
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-normal leading-snug tracking-tight">
                        <RichText>{currentCard?.front}</RichText>
                      </h2>
                    </div>
                  ) : (
                    <>
                      {/* Hotspot cards render their own interactive image below — skip the generic LightboxImage here */}
                      {currentCard?.imageUrl && currentCard?.type !== 'hotspot' && (
                        <div className="mb-4 w-full">
                          {isOnline ? (
                            <>
                              <LightboxImage
                                src={currentCard.imageUrl}
                                className="w-full max-h-48 object-contain rounded-xl"
                              />
                              {currentCard.imageCredit && (
                                <p className="text-[10px] text-brand-muted/70 italic mt-1 text-center">
                                  {currentCard.imageCredit}
                                </p>
                              )}
                            </>
                          ) : (
                            <OfflineImageNotice />
                          )}
                        </div>
                      )}
                      <h2 className={cn("font-normal leading-snug tracking-tight mb-6 sm:mb-8", currentCard?.type === 'mcq' ? "text-lg sm:text-xl md:text-2xl" : "text-xl sm:text-2xl md:text-3xl")}>
                        <RichText>{currentCard?.front}</RichText>
                      </h2>
                    </>
                  )}

                  {/* Confidence rating / written recall — flashcard only, pre-flip */}
                  {(!currentCard?.type || currentCard.type === 'flashcard') && !isFlipped && (
                    <FlashcardPreFlip
                      settings={settings}
                      isTestMode={!!isTestMode}
                      writtenRecallText={writtenRecallText}
                      setWrittenRecallText={setWrittenRecallText}
                      pendingConfidence={pendingConfidence}
                      onReveal={(e) => { e.stopPropagation(); setIsFlipped(true); }}
                      onSetConfidence={(level, e) => { e.stopPropagation(); setPendingConfidence(level); setIsFlipped(true); }}
                    />
                  )}

                  {currentCard?.type === 'matching' ? (
                    <MatchingCardRenderer
                      matchingLefts={matchingLefts}
                      matchingRights={matchingRights}
                      matchedLeftIds={matchedLeftIds}
                      matchedRightIds={matchedRightIds}
                      matchingErrors={matchingErrors}
                      selectedLeft={selectedLeft}
                      selectedRight={selectedRight}
                      onSelect={handleMatchingSelect}
                    />
                  ) : currentCard?.type === 'fill-in-the-blank' ? (
                    <FIBCardRenderer
                      isFlipped={isFlipped}
                      isTestMode={!!isTestMode}
                      currentCard={currentCard}
                      cluesUsed={cluesUsed}
                      revealedIndices={revealedIndices}
                      fibInput={fibInput}
                      setFibInput={setFibInput}
                      isFibCorrect={isFibCorrect}
                      lastFibSubmitted={lastFibSubmitted}
                      cardAnswers={cardAnswers}
                      cardQuestion={cardQuestion}
                      questionJustAsked={questionJustAsked}
                      onSubmit={handleFibSubmit}
                      onGetClue={handleGetClue}
                      onViewQuestion={cardQuestion && onViewQuestion ? () => onViewQuestion(cardQuestion) : undefined}
                      onAskQuestion={() => setAskModalOpen(true)}
                      renderAcceptPrompt={renderAcceptPrompt}
                    />
                  ) : (currentCard?.type === 'multi-select' || (currentCard?.type === 'mcq' && getMcqCorrectOpts(currentCard).length > 1)) ? (
                    <MCQMultiCardRenderer
                      isFlipped={isFlipped}
                      isTestMode={!!isTestMode}
                      currentCard={currentCard}
                      shuffledOptions={shuffledOptions}
                      shuffledOptionImages={shuffledOptionImages}
                      selectedMultiOptions={selectedMultiOptions}
                      mcqZoomSrc={mcqZoomSrc}
                      showAskButton={showAskButton}
                      cardAnswers={cardAnswers}
                      cardQuestion={cardQuestion}
                      questionJustAsked={questionJustAsked}
                      onToggleOption={toggleMultiSelectOption}
                      onSubmit={handleMultiSelectSubmit}
                      onSetMcqZoomSrc={setMcqZoomSrc}
                      getMcqCorrectOpts={getMcqCorrectOpts}
                      onViewQuestion={cardQuestion && onViewQuestion ? () => onViewQuestion(cardQuestion) : undefined}
                      onAskQuestion={() => setAskModalOpen(true)}
                      renderAcceptPrompt={renderAcceptPrompt}
                    />
                  ) : currentCard?.type === 'sequencing' ? (
                    <SequencingCardRenderer
                      isFlipped={isFlipped}
                      isTestMode={!!isTestMode}
                      currentCard={currentCard}
                      shuffledSequence={shuffledSequence}
                      seqDragIdx={seqDragIdx}
                      seqOverIdx={seqOverIdx}
                      setShuffledSequence={setShuffledSequence}
                      setSeqDragIdx={setSeqDragIdx}
                      setSeqOverIdx={setSeqOverIdx}
                      onSubmit={handleSequenceSubmit}
                    />
                  ) : currentCard?.type === 'hotspot' ? (
                    <HotspotCardRenderer
                      isFlipped={isFlipped}
                      isTestMode={!!isTestMode}
                      isOnline={!!isOnline}
                      currentCard={currentCard}
                      hotspotTap={hotspotTap}
                      hotspotCorrect={hotspotCorrect}
                      hotspotImgRef={hotspotImgRef}
                      onPointerDown={handleHotspotPointerDown}
                    />
                  ) : currentCard?.type === 'mcq' ? (
                    <MCQSingleCardRenderer
                      isFlipped={isFlipped}
                      isTestMode={!!isTestMode}
                      currentCard={currentCard}
                      shuffledOptions={shuffledOptions}
                      shuffledOptionImages={shuffledOptionImages}
                      selectedOption={selectedOption}
                      mcqZoomSrc={mcqZoomSrc}
                      showHint={showHint}
                      showAskButton={showAskButton}
                      cardAnswers={cardAnswers}
                      cardQuestion={cardQuestion}
                      questionJustAsked={questionJustAsked}
                      onOptionSelect={handleOptionSelect}
                      onSetMcqZoomSrc={setMcqZoomSrc}
                      onSetShowHint={setShowHint}
                      onViewQuestion={cardQuestion && onViewQuestion ? () => onViewQuestion(cardQuestion) : undefined}
                      onAskQuestion={() => setAskModalOpen(true)}
                      renderAcceptPrompt={renderAcceptPrompt}
                    />
                  ) : null}

                  {/* Post-reveal answer section — flashcard */}
                  {(!currentCard?.type || currentCard?.type === 'flashcard') && isFlipped && (
                    <FlashcardPostFlip
                      currentCard={currentCard}
                      isTestMode={!!isTestMode}
                      isOnline={!!isOnline}
                      settings={settings}
                      writtenRecallText={writtenRecallText}
                      cardAnswers={cardAnswers}
                      cardQuestion={cardQuestion}
                      questionJustAsked={questionJustAsked}
                      onGrade={handleFlashcardGrade}
                      onEasy={handleFlashcardEasy}
                      onHard={handleFlashcardHard}
                      onViewQuestion={cardQuestion && onViewQuestion ? () => onViewQuestion(cardQuestion) : undefined}
                      onAskQuestion={() => setAskModalOpen(true)}
                      renderAcceptPrompt={renderAcceptPrompt}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* History navigation bar */}
        {(currentIndex > 0 || isViewingHistory || isTestMode) && (
          <SessionHistoryNav
            viewIndex={viewIndex}
            currentIndex={currentIndex}
            isViewingHistory={isViewingHistory}
            isTestMode={!!isTestMode}
            shuffledCardsLength={shuffledCards.length}
            onPrev={() => {
              if (isTestMode) { jumpToCard(viewIndex - 1); }
              else { setDirection(-1); setViewIndex(prev => Math.max(0, prev - 1)); }
            }}
            onNext={() => {
              if (isTestMode) {
                if (viewIndex === currentIndex) { skipCard(); }
                else { jumpToCard(viewIndex + 1); }
              } else {
                setDirection(1); setViewIndex(prev => Math.min(currentIndex, prev + 1));
              }
            }}
            onSkip={skipCard}
            onBackToCurrent={() => { setDirection(1); setViewIndex(currentIndex); }}
          />
        )}

        {(currentCard?.type === 'mcq' || currentCard?.type === 'multi-select' || currentCard?.type === 'sequencing' || currentCard?.type === 'fill-in-the-blank' || currentCard?.type === 'hotspot') && !isViewingHistory && (
          <div className="w-full mt-8 sm:mt-12 flex justify-center min-h-[64px] relative z-[60]">
            <AnimatePresence>
              {(selectedOption !== null || (isFlipped && (currentCard.type === 'multi-select' || (currentCard.type === 'mcq' && getMcqCorrectOpts(currentCard).length > 1) || currentCard.type === 'sequencing' || currentCard.type === 'fill-in-the-blank' || currentCard.type === 'hotspot'))) && (
                <div className="flex flex-col sm:flex-row gap-3 w-full justify-center max-w-xl px-4 sm:px-0">
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    onClick={(currentCard.type === 'mcq' && getMcqCorrectOpts(currentCard).length <= 1) ? handleNextMCQ : handleNextComplex}
                    className="btn-primary order-1 sm:order-2 h-14 sm:h-16 px-12 flex items-center justify-center gap-2 group text-sm sm:text-base shadow-[0_20px_40px_rgba(255,255,255,0.1)] relative overflow-hidden w-full sm:flex-1"
                  >
                    <span>Continue</span>
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                  {lastAnswerCorrect && !isTestMode && (
                    <div className="order-2 sm:order-1 flex flex-col gap-1.5 w-full sm:w-auto">
                      <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        onClick={(e) => { e.stopPropagation(); handleEasyAfterCorrect(e); }}
                        className="h-10 sm:h-12 px-5 bg-white/5 border border-white/5 hover:bg-yellow-500/15 hover:border-yellow-500/30 hover:text-yellow-400 text-brand-muted rounded-xl flex items-center justify-center gap-2 transition-all w-full"
                        title="I already knew this — boost interval to mastered"
                      >
                        <Zap className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Easy</span>
                      </motion.button>
                      <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        onClick={(e) => { e.stopPropagation(); handleHardAfterCorrect(); }}
                        className="h-10 px-5 bg-white/5 border border-white/5 hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400 text-brand-muted rounded-xl flex items-center justify-center gap-2 transition-all w-full"
                        title="This was tough — show me sooner"
                      >
                        <TrendingDown className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Hard</span>
                      </motion.button>
                    </div>
                  )}
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
        {currentCard?.type === 'matching' && !isViewingHistory && (
          <div className="w-full mt-8 sm:mt-12 flex flex-col items-center gap-4">
            <p className="text-center text-brand-muted/80 text-xs sm:text-sm font-bold">
              Score: <span className="text-white">{matchedRightIds.size} / {matchingRights.length}</span>
              {!isTestMode && matchingMistakesCount > 0 && <span className="ml-2 text-red-400">({matchingMistakesCount} errors)</span>}
            </p>
            <AnimatePresence>
              {matchingComplete && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  className="w-full max-w-xl px-4 sm:px-0 flex flex-col gap-3"
                >
                  {!isTestMode && currentCard.explanation && (
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-brand-muted mb-2">Explanation</p>
                      <div className="text-sm text-white/70 leading-relaxed"><RichText>{currentCard.explanation}</RichText></div>
                    </div>
                  )}
                  <button
                    onClick={() => { recordHistory(matchingMistakesCount === 0); nextCard(); }}
                    className="btn-primary h-14 sm:h-16 px-12 flex items-center justify-center gap-2 group text-sm sm:text-base shadow-[0_20px_40px_rgba(255,255,255,0.1)] relative overflow-hidden w-full"
                  >
                    <span>Continue</span>
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Question navigator — test mode only */}
        {isTestMode && (
          <TestModeNavigator
            totalCards={shuffledCards.length}
            currentViewIndex={viewIndex}
            historyResults={historyResults}
            onJump={jumpToCard}
          />
        )}

        {/* Live Session Tracker */}
        {!isTestMode && (settings?.sessionDisplay ?? 'stats') !== 'focused' && (
          <SessionStatsBar
            streak={streak}
            liveCorrect={liveCorrect}
            liveIncorrect={liveIncorrect}
            isNewRecord={isNewRecord}
            sessionStats={sessionStats}
          />
        )}
      </div>

      <AskQuestionModal
        isOpen={askModalOpen}
        friendCount={friends.length}
        isSending={isAskingQuestion}
        onClose={() => setAskModalOpen(false)}
        onSend={handleAskQuestion}
      />
    </>
  );
}
