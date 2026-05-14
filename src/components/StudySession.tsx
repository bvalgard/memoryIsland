import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { Sparkles, Brain, ArrowLeft, CheckCircle2, ChevronRight, Database, Zap, Library, XCircle, Check, X, Flame } from 'lucide-react';
import { Island, CardStatus, CardUpdateRecord, UserSettings, Card } from '../hooks/useUserProgress';
import { SessionMeta } from '../achievements';
import { cn } from '../lib/utils';
import LightboxImage from './LightboxImage';
import FlareModal from './FlareModal';
import { useFlares, type Flare } from '../hooks/useFlares';

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

// Extracts only the active card for each conceptual lineage
function getActiveTierCards(allCards: Card[]): Card[] {
  const cardsById = new Map<string, Card>();
  allCards.forEach(c => {
    if (c.id) cardsById.set(c.id, c);
  });

  const childrenMap = new Map<string, Card[]>();
  const roots: Card[] = [];

  allCards.forEach(c => {
    const hasParent = c.prevTierCardId && cardsById.has(c.prevTierCardId);
    if (!hasParent) {
      roots.push(c);
    } else {
      if (!childrenMap.has(c.prevTierCardId!)) {
        childrenMap.set(c.prevTierCardId!, []);
      }
      childrenMap.get(c.prevTierCardId!)!.push(c);
    }
  });

  const getActiveNodes = (node: Card): Card[] => {
    if (node.status !== 'mastered') {
      return [node];
    }
    
    const children = childrenMap.get(node.id!) || [];
    if (children.length === 0) {
      return [node];
    }

    return children.flatMap(child => getActiveNodes(child));
  };

  return roots.flatMap(root => getActiveNodes(root));
}

interface StudySessionProps {
  island: Island;
  mode?: 'all' | 'struggling' | 'learning' | 'mastered' | 'due';
  settings?: UserSettings;
  friends?: string[];
  islandId?: string;
  currentUserName?: string;
  onFinish: (scoreDelta: number, cardUpdates: CardUpdateRecord, maxStreak: number, sessionMeta: SessionMeta) => void;
  onManage: (scoreDelta: number, cardUpdates: CardUpdateRecord, maxStreak: number, sessionMeta: SessionMeta) => void;
  onBackToMap: (scoreDelta: number, cardUpdates: CardUpdateRecord, maxStreak: number, sessionMeta: SessionMeta) => void;
  onSwitchMode?: (newMode: 'all' | 'struggling' | 'learning' | 'mastered' | 'due', scoreDelta: number, cardUpdates: CardUpdateRecord, maxStreak: number, sessionMeta: SessionMeta) => void;
}

export default function StudySession({ island, mode = 'all', settings, friends = [], islandId = '', currentUserName = 'Explorer', onFinish, onManage, onBackToMap, onSwitchMode }: StudySessionProps) {
  const sessionStartTime = useRef<number>(Date.now());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [direction, setDirection] = useState(0); // 1 for right, -1 for left
  const [scoreDelta, setScoreDelta] = useState(0);
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number }[]>([]);
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [cardUpdates, setCardUpdates] = useState<CardUpdateRecord>({});
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [sessionStats, setSessionStats] = useState({
    mastered: 0,
    learning: 0,
    struggling: 0
  });

  // Confidence calibration state
  const [pendingConfidence, setPendingConfidence] = useState<number | null>(null);
  const [sessionCalibration, setSessionCalibration] = useState({ correct: 0, total: 0 });

  // Matching Game State
  const [matchingLefts, setMatchingLefts] = useState<{ id: string, text: string }[]>([]);
  const [matchingRights, setMatchingRights] = useState<{ id: string, text: string, matchId: string }[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matchedLeftIds, setMatchedLeftIds] = useState<Set<string>>(new Set());
  const [matchedRightIds, setMatchedRightIds] = useState<Set<string>>(new Set());
  const [matchingErrors, setMatchingErrors] = useState<Set<string>>(new Set());
  const [matchingMistakesCount, setMatchingMistakesCount] = useState(0);

  // Fill in the Blank State
  const [fibInput, setFibInput] = useState('');
  const [lastFibSubmitted, setLastFibSubmitted] = useState<string | null>(null);
  const [isFibCorrect, setIsFibCorrect] = useState<boolean | null>(null);
  const [cluesUsed, setCluesUsed] = useState(0);
  const [revealedIndices, setRevealedIndices] = useState<number[]>([]);

  // Multi-Select State
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<Set<string>>(new Set());

  // Sequencing State
  const [shuffledSequence, setShuffledSequence] = useState<{ id: string, text: string }[]>([]);

  // SOS Flare state
  const [showFlareButton, setShowFlareButton] = useState(false);
  const [flareModalOpen, setFlareModalOpen] = useState(false);
  const [flareJustSent, setFlareJustSent] = useState(false);
  const [isSendingFlare, setIsSendingFlare] = useState(false);
  const [cardFlares, setCardFlares] = useState<Flare[]>([]);

  const { sendFlare, fetchCardFlares, resolveFlare } = useFlares();

  // Helper for responsive nav buttons
  const NavAction = ({ icon: Icon, label, onClick, variant = 'muted' }: { icon: any, label: string, onClick: () => void, variant?: 'muted' | 'primary' }) => (
    <div className="relative group">
      <button 
        onClick={onClick} 
        className={cn(
          "flex items-center gap-2 transition-all border border-transparent px-3 py-2 rounded-xl",
          variant === 'muted' 
            ? "text-brand-muted hover:text-white hover:border-white/10" 
            : "text-brand-primary hover:bg-brand-primary/10 hover:border-brand-primary/20 bg-brand-primary/5 border-brand-primary/10"
        )}
      >
        <Icon className="w-5 h-5 md:w-4 md:h-4 group-hover:scale-110 transition-transform" />
        <span className="text-sm font-medium hidden md:inline">{label}</span>
      </button>
      {/* Tooltip for mobile/tablets where text is hidden */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-brand-bg/95 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 md:group-hover:opacity-0 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-2xl backdrop-blur-md">
        {label}
      </div>
    </div>
  );
  
  const [shuffledCards, setShuffledCards] = useState(() => {
    const activeTierCards = getActiveTierCards(island.cards);
    const now = Date.now();
    let targetCards = activeTierCards;
    if (mode === 'struggling') targetCards = activeTierCards.filter(c => c.status === 'struggling' || c.needsWork);
    else if (mode === 'learning') targetCards = activeTierCards.filter(c => (!c.status && !c.needsWork) || c.status === 'learning');
    else if (mode === 'mastered') targetCards = activeTierCards.filter(c => c.status === 'mastered');
    else if (mode === 'due') targetCards = activeTierCards.filter(c => !c.srsNextReview || c.srsNextReview <= now);

    const shuffled = shuffleArray(targetCards);
    if (mode === 'due') {
      shuffled.sort((a, b) => (a.srsNextReview || 0) - (b.srsNextReview || 0));
    } else {
      shuffled.sort((a, b) => (a.lastReviewed || 0) - (b.lastReviewed || 0));
    }
    return shuffled;
  });

  const [sessionComplete, setSessionComplete] = useState(shuffledCards.length === 0);

  // Re-initialize the deck only on mount or when the user explicitly switches the study Mode,
  // explicitly skipping island.cards so background db snapshots don't reset their deck mid-session.
  useEffect(() => {
    const activeTierCards = getActiveTierCards(island.cards);
    const now = Date.now();
    let targetCards = activeTierCards;
    if (mode === 'struggling') targetCards = activeTierCards.filter(c => c.status === 'struggling' || c.needsWork);
    else if (mode === 'learning') targetCards = activeTierCards.filter(c => (!c.status && !c.needsWork) || c.status === 'learning');
    else if (mode === 'mastered') targetCards = activeTierCards.filter(c => c.status === 'mastered');
    else if (mode === 'due') targetCards = activeTierCards.filter(c => !c.srsNextReview || c.srsNextReview <= now);

    const shuffled = shuffleArray(targetCards);
    if (mode === 'due') {
      shuffled.sort((a, b) => (a.srsNextReview || 0) - (b.srsNextReview || 0));
    } else {
      shuffled.sort((a, b) => (a.lastReviewed || 0) - (b.lastReviewed || 0));
    }
    setShuffledCards(shuffled);
    setCurrentIndex(0);
    setSessionComplete(shuffled.length === 0);
  }, [mode]);

  const currentCard = shuffledCards[currentIndex];

  const buildMeta = (): SessionMeta => ({
    sessionDurationMs: Date.now() - sessionStartTime.current,
    cardCount: shuffledCards.length,
    correctCount: Object.values<{ status: CardStatus }>(cardUpdates as any).filter(c => c.status !== 'struggling').length,
    sessionStartHour: new Date(sessionStartTime.current).getHours(),
    calibrationCorrect: sessionCalibration.correct,
    calibrationTotal: sessionCalibration.total,
  });

  const strugglingCount = island.cards.filter(c => c.status === 'struggling' || c.needsWork).length;
  const masteredCount = island.cards.filter(c => c.status === 'mastered').length;

  let masteryLevel: 'struggling' | 'learning' | 'mastered' = 'learning';
  if (strugglingCount > 0) {
    masteryLevel = 'struggling';
  } else if (island.cards.length > 0 && masteredCount === island.cards.length) {
    masteryLevel = 'mastered';
  } else {
    masteryLevel = 'learning';
  }

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  const imageSrc = masteryLevel === 'struggling' ? `${basePath}/struggling.jpeg` : masteryLevel === 'learning' ? `${basePath}/learning.jpeg` : `${basePath}/mastered.jpeg`;

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
      // Shuffle options reliably on card switch
      const shuffled = shuffleArray(currentCard.options);
      setShuffledOptions(shuffled);
    } else {
      setShuffledOptions([]);
    }

    if (currentCard?.type === 'sequencing' && currentCard.options) {
      const items = currentCard.options.map((opt, i) => ({ id: `${Date.now()}-${i}`, text: opt }));
      setShuffledSequence(shuffleArray(items));
    } else {
      setShuffledSequence([]);
    }

    if (currentCard?.type === 'matching' && currentCard.pairs) {
      const lefts = currentCard.pairs.map(p => ({ id: p.id, text: p.left }));
      const rights: { id: string, text: string, matchId: string }[] = [];
      currentCard.pairs.forEach(p => {
        p.rights.forEach((rightText, rIdx) => {
          rights.push({ id: `${p.id}-r-${rIdx}`, text: rightText, matchId: p.id });
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

    // Reset state for new card
    setSelectedOption(null);
    setShowHint(false);
    setIsFlipped(false);
    setPendingConfidence(null);
    
    // Fill in the blank reset
    setFibInput('');
    setLastFibSubmitted(null);
    setIsFibCorrect(null);
    setCluesUsed(0);
    setRevealedIndices([]);

    // Multi-select reset
    setSelectedMultiOptions(new Set());

    // SOS flare reset
    setShowFlareButton(false);
    setFlareModalOpen(false);
    setFlareJustSent(false);
    setCardFlares([]);
  }, [currentIndex, currentCard]);

  useEffect(() => {
    if (!isFlipped || !currentCard?.id) {
      setCardFlares([]);
      return;
    }
    fetchCardFlares(currentCard.id).then(setCardFlares);
  }, [isFlipped, currentCard?.id]);

  const triggerSparkle = (e: React.MouseEvent) => {
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

  const handleFibSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCard) return;

    const normalizeText = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');
    const answer = normalizeText(currentCard.back);
    const input = normalizeText(fibInput);

    setLastFibSubmitted(fibInput);
    const correct = input === answer;
    setIsFibCorrect(correct);

    if (correct) {
      setIsFlipped(true); // show the correct answer
      
      const usedClues = cluesUsed > 0;
      let newStatus = currentCard.status || 'learning';
      let newConsecutive = currentCard.consecutiveCorrect || 0;
      let points = 0;

      if (!usedClues) {
        // Normal progression
        const res = getNextStatusAndStreak(true, currentCard.status, currentCard.consecutiveCorrect);
        newStatus = res.status;
        newConsecutive = res.consecutiveCorrect;
        points = 1;
        setStreak(prev => {
          const s = prev + 1;
          setMaxStreak(m => Math.max(m, s));
          return s;
        });
      } else {
        // Did not move up or down because clues were used
        // Streak is broken though? The prompt says "progress counter should not move up... doesn't count toward moving down". I'll leave streak as is.
      }

      setScoreDelta(prev => prev + points);
      setSessionStats(prev => ({ ...prev, [newStatus]: prev[newStatus as keyof typeof prev] + 1 }));

      const srsFib = computeSM2(
        usedClues ? 3 : 4,
        currentCard.srsRepetitions ?? 0,
        currentCard.srsInterval ?? 1,
        currentCard.srsEaseFactor ?? 2.5
      );

      setCardUpdates(prev => ({
        ...prev,
        [currentCard.front]: {
          status: newStatus,
          consecutiveCorrect: newConsecutive,
          lastReviewed: Date.now(),
          srsInterval: srsFib.interval,
          srsEaseFactor: srsFib.easeFactor,
          srsNextReview: srsFib.nextReview,
          srsRepetitions: srsFib.repetitions,
          sessionAnswers: (prev[currentCard.front]?.sessionAnswers ?? 0) + 1,
          sessionCorrect: (prev[currentCard.front]?.sessionCorrect ?? 0) + 1,
        },
      }));

      // Trigger sparkle and next card using markcard logic slightly modified
      if (window.navigator?.vibrate && newStatus === 'mastered') window.navigator.vibrate(50);
      triggerSparkle(e as any);
      setDirection(1);
      setTimeout(() => nextCard(), 1500); // 1.5s delay to see correct answer
    } else {
      // Incorrect progression
      setIsFlipped(true);
      const { status, consecutiveCorrect } = getNextStatusAndStreak(false, currentCard.status, currentCard.consecutiveCorrect);
      setStreak(0);
      setShowFlareButton(true);
      setSessionStats(prev => ({ ...prev, [status]: prev[status as keyof typeof prev] + 1 }));

      const isBeingDemotedFib =
        status === 'struggling' &&
        (currentCard.status === 'learning' || currentCard.status === 'mastered');

      const srsFibWrong = computeSM2(0, currentCard.srsRepetitions ?? 0, currentCard.srsInterval ?? 1, currentCard.srsEaseFactor ?? 2.5);

      setCardUpdates(prev => ({
        ...prev,
        [currentCard.front]: {
          status,
          consecutiveCorrect,
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
        },
      }));
      setDirection(-1);
    }
  };

  const handleFlashcardGrade = (isCorrect: boolean, e: React.MouseEvent) => {
    if (!currentCard) return;
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

    const { status, consecutiveCorrect } = getNextStatusAndStreak(isCorrect, currentCard.status, currentCard.consecutiveCorrect);

    if (isCorrect) {
      setScoreDelta(prev => prev + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      setMaxStreak(prev => Math.max(prev, newStreak));
    } else {
      setStreak(0);
    }

    setSessionStats(prev => ({
      ...prev,
      [status]: prev[status as keyof typeof prev] + 1
    }));

    const isBeingDemoted =
      status === 'struggling' &&
      (currentCard.status === 'learning' || currentCard.status === 'mastered');

    const srs = computeSM2(
      isCorrect ? 4 : 0,
      currentCard.srsRepetitions ?? 0,
      currentCard.srsInterval ?? 1,
      currentCard.srsEaseFactor ?? 2.5
    );

    setCardUpdates(prev => ({
      ...prev,
      [currentCard.front]: {
        status,
        consecutiveCorrect,
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
      },
    }));
    setDirection(isCorrect ? 1 : -1);
    nextCard();
  };

  const nextCard = () => {
    if (currentIndex < shuffledCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setSessionComplete(true);
    }
  };

  const getNextStatusAndStreak = (isCorrect: boolean, currentStatus: CardStatus = 'struggling', currentStreak: number = 0) => {
    if (!isCorrect) {
      return { status: 'struggling' as CardStatus, consecutiveCorrect: 0 };
    }
    
    let nextStreak = currentStreak + 1;
    let nextStatus = currentStatus;
    
    const learningNeeded = settings?.learningStreakNeeded || 1;
    const masteryNeeded = settings?.masteryStreakNeeded || 3;

    if (currentStatus === 'struggling') {
      if (nextStreak >= learningNeeded) {
        nextStatus = 'learning';
        nextStreak = 0; // reset streak for the next level
      }
    } else if (currentStatus === 'learning') {
      if (nextStreak >= masteryNeeded) {
        nextStatus = 'mastered';
        nextStreak = 0; // mastered is the final state
      }
    } else {
      // already mastered, keep it there or maybe reset? keeping it
      nextStreak = 0;
    }
    
    return { status: nextStatus, consecutiveCorrect: nextStreak };
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
    if (!currentCard || !currentCard.correctOptions) return;

    setIsFlipped(true);
    const correctOptionsSet = new Set(currentCard.correctOptions);
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

    if (isCorrect) {
      setScoreDelta(prev => prev + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      setMaxStreak(prev => Math.max(prev, newStreak));
    } else {
      setStreak(0);
      setShowFlareButton(true);
    }

    const { status, consecutiveCorrect } = getNextStatusAndStreak(isCorrect, currentCard?.status, currentCard?.consecutiveCorrect);

    setSessionStats(prev => ({
      ...prev,
      [status]: prev[status as keyof typeof prev] + 1
    }));

    const isBeingDemotedMs =
      status === 'struggling' &&
      (currentCard.status === 'learning' || currentCard.status === 'mastered');

    const srsMs = computeSM2(isCorrect ? 4 : 0, currentCard.srsRepetitions ?? 0, currentCard.srsInterval ?? 1, currentCard.srsEaseFactor ?? 2.5);

    setCardUpdates(prev => ({
      ...prev,
      [currentCard.front]: {
        status,
        consecutiveCorrect,
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
      },
    }));
  };

  const handleSequenceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCard || !currentCard.options) return;

    setIsFlipped(true);
    const isCorrect = shuffledSequence.every((item, idx) => item.text === currentCard.options![idx]);

    if (isCorrect) {
      setScoreDelta(prev => prev + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      setMaxStreak(prev => Math.max(prev, newStreak));
    } else {
      setStreak(0);
    }

    const { status, consecutiveCorrect } = getNextStatusAndStreak(isCorrect, currentCard?.status, currentCard?.consecutiveCorrect);

    setSessionStats(prev => ({
      ...prev,
      [status]: prev[status as keyof typeof prev] + 1
    }));

    const isBeingDemotedSeq =
      status === 'struggling' &&
      (currentCard.status === 'learning' || currentCard.status === 'mastered');

    const srsSeq = computeSM2(isCorrect ? 4 : 0, currentCard.srsRepetitions ?? 0, currentCard.srsInterval ?? 1, currentCard.srsEaseFactor ?? 2.5);

    setCardUpdates(prev => ({
      ...prev,
      [currentCard.front]: {
        status,
        consecutiveCorrect,
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
      },
    }));
  };

  const handleOptionSelect = (option: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentCard || selectedOption !== null) return; // Prevent multiple clicks
    
    setSelectedOption(option);
    
    const isCorrect = option === currentCard?.back;
    if (isCorrect) {
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(50);
      }
      triggerSparkle(e);
      setScoreDelta(prev => prev + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      setMaxStreak(prev => Math.max(prev, newStreak));
      
      const { status, consecutiveCorrect } = getNextStatusAndStreak(true, currentCard?.status, currentCard?.consecutiveCorrect);

      setSessionStats(prev => ({
        ...prev,
        [status]: prev[status as keyof typeof prev] + 1
      }));

      const srsMcqCorrect = computeSM2(4, currentCard.srsRepetitions ?? 0, currentCard.srsInterval ?? 1, currentCard.srsEaseFactor ?? 2.5);
      setCardUpdates(prev => ({
        ...prev,
        [currentCard.front]: {
          status,
          consecutiveCorrect,
          lastReviewed: Date.now(),
          srsInterval: srsMcqCorrect.interval,
          srsEaseFactor: srsMcqCorrect.easeFactor,
          srsNextReview: srsMcqCorrect.nextReview,
          srsRepetitions: srsMcqCorrect.repetitions,
          sessionAnswers: (prev[currentCard.front]?.sessionAnswers ?? 0) + 1,
          sessionCorrect: (prev[currentCard.front]?.sessionCorrect ?? 0) + 1,
        },
      }));
    } else {
      setStreak(0);
      setShowFlareButton(true);
      const { status, consecutiveCorrect } = getNextStatusAndStreak(false, currentCard?.status, currentCard?.consecutiveCorrect);

      setSessionStats(prev => ({
        ...prev,
        [status]: prev[status as keyof typeof prev] + 1
      }));

      const isBeingDemotedMcq =
        status === 'struggling' &&
        (currentCard.status === 'learning' || currentCard.status === 'mastered');

      const srsMcqWrong = computeSM2(0, currentCard.srsRepetitions ?? 0, currentCard.srsInterval ?? 1, currentCard.srsEaseFactor ?? 2.5);

      setCardUpdates(prev => ({
        ...prev,
        [currentCard.front]: {
          status,
          consecutiveCorrect,
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
        },
      }));
    }
  };

  const handleNextComplex = () => {
    // For Fill-in-the-blank, it already calculates progress in handleFibSubmit
    if (currentCard?.type === 'fill-in-the-blank') {
      nextCard();
      return;
    }

    // For Multi-Select
    if (currentCard?.type === 'multi-select') {
      const correctOptionsSet = new Set(currentCard.correctOptions);
      let isCorrect = selectedMultiOptions.size === correctOptionsSet.size;
      if (isCorrect) {
        for (const opt of selectedMultiOptions) {
          if (!correctOptionsSet.has(opt)) {
            isCorrect = false; break;
          }
        }
      }
      setDirection(isCorrect ? 1 : -1);
      nextCard();
    }
    // For Sequencing
    else if (currentCard?.type === 'sequencing') {
      const isCorrect = shuffledSequence.every((item, idx) => item.text === currentCard.options![idx]);
      setDirection(isCorrect ? 1 : -1);
      nextCard();
    }
  };

  const handleNextMCQ = () => {
    // Only determine direction when actually advancing
    const isCorrect = selectedOption === currentCard?.back;
    setDirection(isCorrect ? 1 : -1);
    nextCard();
  };

  const handleSendFlare = async (visibility: 'friends' | 'global') => {
    if (!currentCard) return;
    setIsSendingFlare(true);
    await sendFlare(currentCard, islandId || island.id || '', visibility, friends, currentUserName);
    setFlareJustSent(true);
    setFlareModalOpen(false);
    setIsSendingFlare(false);
  };

  const handleThisSavedMe = async (flare: Flare, preserverIndex: number) => {
    await resolveFlare(flare, preserverIndex);
    setCardFlares([]);
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
          // Finished card
          if (matchingMistakesCount === 0) {
            const { status, consecutiveCorrect } = getNextStatusAndStreak(true, currentCard?.status, currentCard?.consecutiveCorrect);
            
            const newStreak = streak + 1;
            setStreak(newStreak);
            setMaxStreak(prev => Math.max(prev, newStreak));

            setSessionStats(prev => ({
              ...prev,
              [status]: prev[status as keyof typeof prev] + 1
            }));

            const srsMatchCorrect = computeSM2(5, currentCard.srsRepetitions ?? 0, currentCard.srsInterval ?? 1, currentCard.srsEaseFactor ?? 2.5);
            setCardUpdates(prev => ({
              ...prev,
              [currentCard.front]: {
                status,
                consecutiveCorrect,
                lastReviewed: Date.now(),
                srsInterval: srsMatchCorrect.interval,
                srsEaseFactor: srsMatchCorrect.easeFactor,
                srsNextReview: srsMatchCorrect.nextReview,
                srsRepetitions: srsMatchCorrect.repetitions,
                sessionAnswers: (prev[currentCard.front]?.sessionAnswers ?? 0) + 1,
                sessionCorrect: (prev[currentCard.front]?.sessionCorrect ?? 0) + 1,
              },
            }));
            setScoreDelta(prev => prev + 1);
            setDirection(1);
          } else {
            const { status, consecutiveCorrect } = getNextStatusAndStreak(false, currentCard?.status, currentCard?.consecutiveCorrect);

            setStreak(0);
            setSessionStats(prev => ({
              ...prev,
              [status]: prev[status as keyof typeof prev] + 1
            }));

            const isBeingDemotedMatch =
              status === 'struggling' &&
              (currentCard.status === 'learning' || currentCard.status === 'mastered');

            const srsMatchWrong = computeSM2(0, currentCard.srsRepetitions ?? 0, currentCard.srsInterval ?? 1, currentCard.srsEaseFactor ?? 2.5);

            setCardUpdates(prev => ({
              ...prev,
              [currentCard.front]: {
                status,
                consecutiveCorrect,
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
              },
            }));
            setDirection(-1);
          }
          setTimeout(() => {
            nextCard();
          }, 1000);
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

  if (sessionComplete) {
    const cardsReviewed = shuffledCards.length;
    const correctAnswers = Object.values<{status: string}>(cardUpdates as any).filter(c => c.status === 'learning' || c.status === 'mastered').length;
    const incorrectAnswers = Object.values<{status: string}>(cardUpdates as any).filter(c => c.status === 'struggling').length;

    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto w-full text-center"
      >
        <div className="w-24 h-24 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-8 relative">
          <div className="absolute inset-0 bg-brand-primary/20 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
          <CheckCircle2 className="w-12 h-12 text-brand-primary relative z-10" />
        </div>
        <h2 className="text-4xl font-bold mb-4 leading-tight">Sync Complete</h2>
        <p className="text-brand-muted mb-8 text-lg">
          Retention strengthened for <span className="text-white font-medium">{island.name}</span>.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-12">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 border-b-2 border-b-white/20">
            <div className="text-3xl font-black text-white mb-1">{cardsReviewed}</div>
            <div className="text-[10px] font-bold tracking-widest uppercase text-brand-muted">Cards Reviewed</div>
          </div>
          <div className="bg-brand-primary/5 rounded-2xl p-4 border border-brand-primary/20 border-b-2 border-b-brand-primary/40">
            <div className="text-3xl font-black text-brand-primary mb-1">+{scoreDelta}</div>
            <div className="text-[10px] font-bold tracking-widest uppercase text-brand-primary/80">Score Gained</div>
          </div>
          <div className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/20 border-b-2 border-b-emerald-500/40">
            <div className="text-3xl font-black text-emerald-400 mb-1">{correctAnswers}</div>
            <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-500/80">Correct</div>
          </div>
          <div className="bg-red-500/5 rounded-2xl p-4 border border-red-500/20 border-b-2 border-b-red-500/40">
            <div className="text-3xl font-black text-red-400 mb-1">{incorrectAnswers}</div>
            <div className="text-[10px] font-bold tracking-widest uppercase text-red-500/80">Struggling</div>
          </div>
        </div>

        <button 
          onClick={() => onFinish(scoreDelta, cardUpdates, maxStreak, buildMeta())}
          className="w-full btn-primary h-16 text-lg"
        >
          Return to Map
        </button>
      </motion.div>
    );
  }

  return (
    <>
    <div className="max-w-2xl mx-auto w-full flex flex-col items-center pb-12">
      {/* Sparkles Layer */}
      <AnimatePresence>
        {sparkles.map(s => (
          <motion.div
            key={s.id}
            initial={{ opacity: 1, scale: 0, x: s.x, y: s.y }}
            animate={{ 
              opacity: 0, 
              scale: 2, 
              x: s.x + (Math.random() - 0.5) * 200, 
              y: s.y + (Math.random() - 0.5) * 200 
            }}
            exit={{ opacity: 0 }}
            className="fixed pointer-events-none z-[100] text-amber-400"
          >
            <Sparkles className="w-6 h-6 fill-current" />
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="w-full flex justify-between items-center mb-8 sm:mb-12">
        <div className="flex items-center gap-1 sm:gap-2">
          <NavAction 
            icon={ArrowLeft} 
            label="To Map" 
            onClick={() => onBackToMap(scoreDelta, cardUpdates, maxStreak, buildMeta())}
          />
          
          <div className="hidden sm:flex items-center gap-3 glass px-4 py-2 rounded-full border-white/5 shadow-lg ml-2">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10 shrink-0">
               <img 
                src={imageSrc} 
                alt={`${masteryLevel} island`} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (masteryLevel === 'struggling') target.src = 'https://images.unsplash.com/photo-1505672678657-cc7037095e60?auto=format&fit=crop&q=80&w=200&h=200';
                  else if (masteryLevel === 'learning') target.src = 'https://images.unsplash.com/photo-1544550581-5f7ceaf7f992?auto=format&fit=crop&q=80&w=200&h=200';
                  else target.src = 'https://images.unsplash.com/photo-1523363065056-11f8b449174b?auto=format&fit=crop&q=80&w=200&h=200';
                }}
              />
            </div>
            <span className="text-xs font-bold text-white truncate max-w-[120px]">{island.name}</span>
          </div>

          <NavAction 
            icon={Database} 
            label="Manage Cards" 
            onClick={() => onManage(scoreDelta, cardUpdates, maxStreak, buildMeta())}
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
              label={mode === 'all' ? 'Struggling' : 'All Cards'}
              variant="primary"
              onClick={() => onSwitchMode(mode === 'all' ? 'struggling' : 'all', scoreDelta, cardUpdates, maxStreak, buildMeta())}
            />
          )}
          <div className="flex items-center gap-2 glass px-3 md:px-4 py-2 rounded-full border-white/5 shadow-lg group relative">
            <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary group-hover:scale-110 transition-transform" />
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">
              <span className="hidden sm:inline">Card </span>
              {currentIndex + 1} / {shuffledCards.length}
            </span>
          </div>
        </div>
      </div>

      {/* Card Arena */}
      <div className="w-full perspective-1000 relative">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={currentIndex}
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
            onClick={() => {
              // For flashcards, confidence buttons or Skip handle the flip — tap does nothing
              if (currentCard?.type && currentCard.type !== 'flashcard') {
                setIsFlipped(!isFlipped);
              }
            }}
          >
            <motion.div
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 260, 
                damping: 20, 
                mass: 1 
              }}
              style={{ transformStyle: "preserve-3d" }}
              className="w-full relative grid"
            >
              {/* Front */}
              <div
                className={cn(
                  "[grid-area:1/1] backface-hidden glass rounded-[40px] p-6 sm:p-8 md:p-12 flex flex-col items-center text-center border-brand-primary/20 shadow-2xl min-h-[50vh] sm:min-h-[500px] relative",
                  (!currentCard?.type || currentCard.type === 'flashcard') && !isFlipped ? "justify-between" : "justify-center"
                )}
              >
                <span className="absolute top-4 right-5 text-[10px] text-white/40 font-medium tabular-nums select-none">
                  {currentCard?.consecutiveCorrect ?? 0}✓
                </span>
                <p className="text-brand-muted uppercase tracking-[0.2em] font-medium text-[10px] sm:text-xs mb-4 sm:mb-6 shrink-0">
                  {currentCard?.type === 'mcq' ? 'Select the Correct Answer' : currentCard?.type === 'matching' ? 'Match the Objects' : currentCard?.type === 'fill-in-the-blank' ? 'Fill in the Blank' : currentCard?.type === 'multi-select' ? 'Select All That Apply' : currentCard?.type === 'sequencing' ? 'Put in the Correct Order' : 'Front Side'}
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
                      <div className="mb-4">
                        <LightboxImage src={currentCard.imageUrl} className="w-full max-h-48 object-contain rounded-xl" />
                        {currentCard.imageCredit && (
                          <p className="text-[10px] text-brand-muted/70 italic mt-1 text-center">{currentCard.imageCredit}</p>
                        )}
                      </div>
                    )}
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-bold leading-snug tracking-tight whitespace-pre-wrap">
                      {currentCard?.front}
                    </h2>
                  </div>
                ) : (
                  <>
                    {currentCard?.imageUrl && (
                      <div className="mb-4">
                        <LightboxImage
                          src={currentCard.imageUrl}
                          className="w-full max-h-48 object-contain rounded-xl"
                        />
                        {currentCard.imageCredit && (
                          <p className="text-[10px] text-brand-muted/70 italic mt-1 text-center">
                            {currentCard.imageCredit}
                          </p>
                        )}
                      </div>
                    )}
                    <h2 className={cn("font-bold leading-snug tracking-tight mb-6 sm:mb-8 whitespace-pre-wrap", currentCard?.type === 'mcq' ? "text-lg sm:text-xl md:text-2xl" : "text-xl sm:text-2xl md:text-3xl")}>
                      {currentCard?.front}
                    </h2>
                  </>
                )}

                {/* Confidence rating — inside card front, flashcard only, pre-flip */}
                {(!currentCard?.type || currentCard.type === 'flashcard') && !isFlipped && (
                  <div className="w-full mt-4 pt-5 border-t border-white/5" onClick={e => e.stopPropagation()}>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-brand-muted/50 font-bold mb-3">
                      Rate confidence to flip
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { level: 1, label: 'Not Confident',      active: 'bg-red-500/15 border-red-500/30 text-red-400',     hover: 'hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400' },
                        { level: 2, label: 'Somewhat Confident', active: 'bg-amber-500/15 border-amber-500/30 text-amber-400', hover: 'hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-400' },
                        { level: 3, label: 'Confident',          active: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400', hover: 'hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400' },
                      ] as const).map(({ level, label, active, hover }) => (
                        <button
                          key={level}
                          onClick={(e) => { e.stopPropagation(); setPendingConfidence(level); setIsFlipped(true); }}
                          className={cn(
                            "border h-12 rounded-xl flex items-center justify-center transition-all",
                            pendingConfidence === level
                              ? active
                              : cn("bg-white/5 border-white/5 text-brand-muted", hover)
                          )}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-widest leading-none">{label}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsFlipped(true); }}
                      className="mt-3 w-full text-center text-brand-muted/25 hover:text-brand-muted/50 text-[9px] uppercase tracking-[0.2em] transition-colors"
                    >
                      Skip →
                    </button>
                  </div>
                )}
                
                {currentCard?.type === 'matching' ? (
                  <div className="w-full flex-1 flex flex-col md:flex-row gap-4 mt-2 sm:mt-6 pb-4">
                    <div className="flex-1 flex flex-col gap-2 relative">
                      <h3 className="text-[10px] uppercase font-bold text-brand-muted tracking-widest mb-1 text-left hidden md:block">Terms</h3>
                      {matchingLefts.map((left) => {
                        const isMatched = matchedLeftIds.has(left.id);
                        const isSelected = selectedLeft === left.id;
                        const isError = matchingErrors.has(left.id);
                        return (
                          <motion.button
                            key={left.id}
                            layout="position"
                            disabled={isMatched}
                            onClick={(e) => handleMatchingSelect('left', left.id, e)}
                            className={cn(
                              "text-left px-4 py-3 rounded-xl transition-all font-medium text-xs sm:text-sm",
                              isMatched ? "bg-emerald-500/10 text-emerald-500/60 border border-emerald-500/20" :
                              isSelected ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-[1.02]" :
                              isError ? "bg-red-500/20 text-red-500 border border-red-500/50" :
                              "bg-white/5 border border-white/10 hover:bg-white/10 text-white/80"
                            )}
                          >
                            <span className={cn(isMatched && "line-through decoration-emerald-500/30")}>{left.text}</span>
                          </motion.button>
                        )
                      })}
                    </div>
                    <div className="flex-1 flex flex-col gap-2 relative mt-4 md:mt-0">
                      <h3 className="text-[10px] uppercase font-bold text-brand-muted tracking-widest mb-1 text-left hidden md:block">Matches</h3>
                      {matchingRights.map((right) => {
                        const isMatched = matchedRightIds.has(right.id);
                        const isSelected = selectedRight === right.id;
                        const isError = matchingErrors.has(right.id);
                        return (
                          <motion.button
                            key={right.id}
                            layout="position"
                            disabled={isMatched}
                            onClick={(e) => handleMatchingSelect('right', right.id, e)}
                            className={cn(
                              "text-left px-4 py-3 rounded-xl transition-all font-medium text-xs sm:text-sm",
                              isMatched ? "bg-emerald-500/10 text-emerald-500/60 border border-emerald-500/20" :
                              isSelected ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-[1.02]" :
                              isError ? "bg-red-500/20 text-red-500 border border-red-500/50" :
                              "bg-white/5 border border-white/10 hover:bg-white/10 text-white/80"
                            )}
                          >
                            <span className={cn(isMatched && "line-through decoration-emerald-500/30")}>{right.text}</span>
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>
                ) : currentCard?.type === 'fill-in-the-blank' ? (
                  <div className="w-full flex-1 flex flex-col justify-center items-center gap-6 pb-4 cursor-default" onClick={e => e.stopPropagation()}>
                    <form onSubmit={handleFibSubmit} className="w-full max-w-sm flex flex-col gap-4">
                      {cluesUsed > 0 && currentCard?.back && (
                        <div className="flex flex-wrap justify-center gap-x-4 gap-y-3 mb-4 text-xl md:text-2xl font-mono text-brand-primary">
                          {currentCard.back.split(' ').map((word, wordIndex, wordsArray) => {
                            const startIndex = wordsArray.slice(0, wordIndex).join(' ').length + (wordIndex > 0 ? 1 : 0);
                            return (
                              <div key={wordIndex} className="flex gap-[2px] whitespace-nowrap">
                                {word.split('').map((char, charOffset) => {
                                  const globalIndex = startIndex + charOffset;
                                  return (
                                    <span key={charOffset} className="border-b-2 border-brand-primary pb-1 font-bold min-w-[14px] md:min-w-[18px] text-center inline-block">
                                      {revealedIndices.includes(globalIndex) ? char : '\u00A0'}
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <input 
                        type="text" 
                        value={fibInput}
                        onChange={e => setFibInput(e.target.value)}
                        placeholder="Type your answer..."
                        className="w-full bg-white/5 border border-white/20 focus:border-brand-primary rounded-xl px-4 py-3 text-white text-center text-lg outline-none transition-colors"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={handleGetClue} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl text-sm font-bold transition-colors">
                          Get Clue
                        </button>
                        <button type="submit" className="flex-1 bg-brand-primary hover:bg-white text-black py-3 rounded-xl text-sm font-bold transition-colors">
                          Submit
                        </button>
                      </div>
                    </form>
                  </div>
                ) : currentCard?.type === 'multi-select' ? (
                  <div className="w-full flex-1 flex flex-col justify-center items-center gap-3 pb-4">
                    <form onSubmit={handleMultiSelectSubmit} className="w-full flex flex-col gap-3">
                      {shuffledOptions.map((opt, idx) => {
                        const isSelected = selectedMultiOptions.has(opt);
                        let btnClass = "bg-white/5 border border-white/10 text-white/70";
                        let icon = null;

                        if (!isFlipped) {
                          btnClass = isSelected ? "bg-brand-primary/20 border-brand-primary/50 text-white" : "bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-white/70";
                        } else {
                          const isCorrectOpt = currentCard.correctOptions?.includes(opt);
                          if (isCorrectOpt) {
                            btnClass = "bg-emerald-500/20 border-emerald-500/50 text-emerald-400";
                            if (isSelected) {
                              icon = <CheckCircle2 className="w-5 h-5" />;
                            }
                          } else if (isSelected && !isCorrectOpt) {
                            btnClass = "bg-red-500/20 border-red-500/50 text-red-500";
                            icon = <XCircle className="w-5 h-5" />;
                          } else {
                            btnClass = "bg-white/5 border-transparent text-brand-muted/30 opacity-30";
                          }
                        }

                        return (
                          <div 
                            key={idx}
                            onClick={() => toggleMultiSelectOption(opt)}
                            className={cn(
                              "w-full text-left px-4 py-3 sm:px-5 sm:py-4 rounded-xl transition-all font-medium text-xs sm:text-sm md:text-base leading-relaxed shrink-0 flex justify-between items-center cursor-pointer",
                              btnClass
                            )}
                          >
                            <span>{opt}</span>
                            {icon && (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                                {icon}
                              </motion.div>
                            )}
                          </div>
                        );
                      })}
                      {!isFlipped && (
                        <button type="submit" disabled={selectedMultiOptions.size === 0} className="w-full mt-4 bg-brand-primary hover:bg-white text-black py-4 rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
                          Submit Answer
                        </button>
                      )}
                    </form>
                    {isFlipped && currentCard?.explanation &&
                      !(selectedMultiOptions.size === (currentCard.correctOptions?.length ?? 0) &&
                        Array.from(selectedMultiOptions).every(o => currentCard.correctOptions?.includes(o))) && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 p-4 rounded-2xl bg-white/5 border border-white/10 text-left w-full"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted block mb-1.5">Why</span>
                        <p className="text-sm text-white/70 leading-relaxed">{currentCard.explanation}</p>
                      </motion.div>
                    )}
                    {/* Life preservers — multi-select wrong answer */}
                    {showFlareButton && cardFlares.flatMap(f => f.lifePreservers).length > 0 && (
                      <div className="flex flex-col gap-2 w-full mt-2">
                        {cardFlares.flatMap((f, fi) => f.lifePreservers.map((lp, li) => ({ f, lp, fi, li }))).map(({ f, lp, fi, li }) => (
                          <motion.div
                            key={`${fi}-${li}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: li * 0.08 }}
                            className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 text-left"
                          >
                            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400 block mb-1">Crew tip from {lp.helperName}</span>
                            <p className="text-sm text-white/70">{lp.hintText}</p>
                            {!lp.isHelpful && (
                              <button
                                onClick={() => handleThisSavedMe(f, li)}
                                className="mt-2 text-[10px] uppercase tracking-widest font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                              >
                                This Saved Me!
                              </button>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    )}
                    {showFlareButton && !flareJustSent && (
                      <motion.button
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={(e) => { e.stopPropagation(); setFlareModalOpen(true); }}
                        className="w-full mt-2 flex items-center justify-center gap-2 border border-orange-500/25 bg-orange-500/8 text-orange-400 hover:bg-orange-500/15 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                      >
                        <Flame className="w-3.5 h-3.5" /> Send SOS Flare
                      </motion.button>
                    )}
                    {flareJustSent && (
                      <p className="text-center text-[10px] text-orange-400/60 font-bold uppercase tracking-widest mt-2">🔥 Flare launched!</p>
                    )}
                  </div>
                ) : currentCard?.type === 'sequencing' ? (
                  <div className="w-full flex-1 flex flex-col justify-center items-center gap-3 pb-4">
                    <form onSubmit={handleSequenceSubmit} className="w-full flex flex-col gap-3">
                      <Reorder.Group 
                        axis="y" 
                        values={shuffledSequence} 
                        onReorder={setShuffledSequence}
                        className="w-full space-y-2"
                      >
                        {shuffledSequence.map((item, idx) => {
                          let btnClass = "bg-white/5 border border-white/10 text-white/80";
                          let icon = null;

                          if (isFlipped) {
                            const correctOpt = currentCard.options![idx];
                            if (item.text === correctOpt) {
                              btnClass = "bg-emerald-500/20 border-emerald-500/50 text-emerald-400";
                              icon = <CheckCircle2 className="w-5 h-5" />;
                            } else {
                              btnClass = "bg-red-500/20 border-red-500/50 text-red-500";
                              icon = <XCircle className="w-5 h-5" />;
                            }
                          }

                          return (
                            <Reorder.Item 
                              key={item.id} 
                              value={item}
                              dragListener={!isFlipped}
                              className={cn(
                                "w-full text-left px-4 py-3 sm:px-5 sm:py-4 rounded-xl transition-all font-medium text-xs sm:text-sm md:text-base leading-relaxed shrink-0 flex items-center gap-3",
                                btnClass,
                                !isFlipped && "cursor-grab active:cursor-grabbing hover:bg-white/10"
                              )}
                            >
                              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0 pointer-events-none">
                                {idx + 1}
                              </div>
                              <span className="flex-1 pointer-events-none">{item.text}</span>
                              {icon && (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                                  {icon}
                                </motion.div>
                              )}
                            </Reorder.Item>
                          );
                        })}
                      </Reorder.Group>
                      {!isFlipped && (
                        <button type="submit" className="w-full mt-4 bg-brand-primary hover:bg-white text-black py-4 rounded-xl text-sm font-bold transition-colors">
                          Submit Sequence
                        </button>
                      )}
                    </form>
                    {isFlipped && currentCard?.explanation &&
                      !shuffledSequence.every((item, idx) => item.text === currentCard.options![idx]) && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 p-4 rounded-2xl bg-white/5 border border-white/10 text-left w-full"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted block mb-1.5">Why</span>
                        <p className="text-sm text-white/70 leading-relaxed">{currentCard.explanation}</p>
                      </motion.div>
                    )}
                  </div>
                ) : currentCard?.type === 'mcq' ? (
                  <div className="w-full flex-1 flex flex-col justify-center gap-3 pb-4">
                    {shuffledOptions.map((opt, idx) => {
                      let btnClass = "bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white";
                      let statusText = null;

                      if (selectedOption) {
                        if (opt === currentCard?.back) {
                          btnClass = "bg-emerald-500/10 border-emerald-500/50 text-white";
                          statusText = "Correct answer";
                        } else if (opt === selectedOption) {
                          btnClass = "bg-red-500/10 border-red-500/50 text-white";
                          statusText = "Not quite";
                        } else {
                          btnClass = "bg-white/5 border-transparent text-brand-muted/30 opacity-40";
                        }
                      }

                      const letter = String.fromCharCode(65 + idx);

                      return (
                        <div key={idx} className="flex flex-col w-full">
                          <motion.button 
                            layout
                            whileHover={!selectedOption ? { scale: 1.02 } : {}}
                            whileTap={!selectedOption ? { scale: 0.98 } : {}}
                            onClick={(e: any) => handleOptionSelect(opt, e)}
                            disabled={selectedOption !== null}
                            className={cn(
                              "w-full text-left px-4 py-3 sm:px-5 sm:py-4 rounded-xl transition-all flex flex-col group",
                              btnClass
                            )}
                          >
                            <div className="flex justify-between items-start gap-4">
                              <div className="flex items-start gap-3 flex-1">
                                <span className="font-bold text-white/70 shrink-0">{letter}.</span>
                                <span className={cn(
                                  "font-medium text-xs sm:text-sm md:text-base leading-relaxed flex-1",
                                  !selectedOption && "group-hover:translate-x-1 transition-transform"
                                )}>
                                  {opt}
                                </span>
                              </div>
                            </div>
                            
                            <AnimatePresence>
                              {selectedOption && (opt === currentCard?.back || opt === selectedOption) && (
                                <motion.div 
                                  initial={{ opacity: 0, height: 0 }} 
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-2 pl-8 sm:pl-9 overflow-hidden"
                                >
                                  <div className="flex items-center gap-2 mb-1.5 mt-1">
                                    <div className={cn(
                                      "w-4 h-4 flex items-center justify-center rounded-full",
                                      opt === currentCard?.back ? "bg-emerald-500/20" : "bg-red-500/20"
                                    )}>
                                      {opt === currentCard?.back ? 
                                        <Check className="w-2.5 h-2.5 text-emerald-500" /> : 
                                        <X className="w-2.5 h-2.5 text-red-500" />
                                      }
                                    </div>
                                    <span className={cn(
                                      "text-[11px] sm:text-xs font-bold uppercase tracking-wider",
                                      opt === currentCard?.back ? "text-emerald-500" : "text-red-400"
                                    )}>
                                      {statusText}
                                    </span>
                                  </div>
                                  {currentCard?.explanations?.[opt] && (
                                    <div className="text-[13px] sm:text-[14px] text-white/70 leading-relaxed mb-2 pr-4">
                                      {currentCard.explanations[opt]}
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.button>
                        </div>
                      );
                    })}
                    {currentCard?.hint && (
                      <div className="w-full mt-2 flex flex-col items-center">
                        {!showHint ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowHint(true); }}
                            className="text-[10px] sm:text-xs text-brand-muted hover:text-white transition-colors uppercase tracking-[0.2em] font-bold px-4 py-2 border border-brand-muted/20 rounded-lg hover:bg-white/5"
                          >
                            Show Hint
                          </button>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs sm:text-sm text-amber-200 bg-amber-500/10 p-4 rounded-xl border border-amber-500/20 text-left w-full mx-auto shadow-inner"
                          >
                            <span className="font-bold uppercase tracking-widest text-[10px] mb-1.5 block text-amber-500">Hint</span>
                            {currentCard.hint}
                          </motion.div>
                        )}
                      </div>
                    )}
                    {selectedOption && selectedOption !== currentCard?.back && currentCard?.explanation && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 p-4 rounded-2xl bg-white/5 border border-white/10 text-left w-full"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted block mb-1.5">Why</span>
                        <p className="text-sm text-white/70 leading-relaxed">{currentCard.explanation}</p>
                      </motion.div>
                    )}
                    {/* Life preservers from crew */}
                    {showFlareButton && cardFlares.flatMap(f => f.lifePreservers).length > 0 && (
                      <div className="flex flex-col gap-2 w-full mt-2">
                        {cardFlares.flatMap((f, fi) => f.lifePreservers.map((lp, li) => ({ f, lp, fi, li }))).map(({ f, lp, fi, li }) => (
                          <motion.div
                            key={`${fi}-${li}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: li * 0.08 }}
                            className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 text-left"
                          >
                            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400 block mb-1">Crew tip from {lp.helperName}</span>
                            <p className="text-sm text-white/70">{lp.hintText}</p>
                            {!lp.isHelpful && (
                              <button
                                onClick={() => handleThisSavedMe(f, li)}
                                className="mt-2 text-[10px] uppercase tracking-widest font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                              >
                                This Saved Me!
                              </button>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    )}
                    {/* SOS Flare button — MCQ wrong answer */}
                    {showFlareButton && !flareJustSent && (
                      <motion.button
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={(e) => { e.stopPropagation(); setFlareModalOpen(true); }}
                        className="w-full mt-2 flex items-center justify-center gap-2 border border-orange-500/25 bg-orange-500/8 text-orange-400 hover:bg-orange-500/15 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                      >
                        <Flame className="w-3.5 h-3.5" /> Send SOS Flare
                      </motion.button>
                    )}
                    {flareJustSent && (
                      <p className="text-center text-[10px] text-orange-400/60 font-bold uppercase tracking-widest mt-2">🔥 Flare launched!</p>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Back */}
              <div
                style={{ transform: "rotateY(180deg)" }}
                className={cn(
                  "[grid-area:1/1] backface-hidden glass rounded-[40px] p-6 sm:p-8 md:p-12 flex flex-col items-center text-center shadow-2xl overflow-hidden min-h-[50vh] sm:min-h-[500px]",
                  (!currentCard?.type || currentCard?.type === 'flashcard') ? "justify-between" : "justify-center"
                )}
              >
                {/* Subtle Texture/Pattern for back side */}
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[size:24px_24px]" />
                </div>

                {/* Answer content */}
                <div className="flex-1 flex flex-col items-center justify-center w-full">
                  <p className="text-brand-primary uppercase tracking-[0.2em] font-medium text-[10px] sm:text-xs mb-6 sm:mb-8 relative z-10">
                    {currentCard?.type === 'fill-in-the-blank' && isFibCorrect !== null ? (isFibCorrect ? 'Excellent Work' : 'Correction Analysis') : 'Anchored Response'}
                  </p>
                  {currentCard?.type === 'fill-in-the-blank' && isFibCorrect !== null ? (
                    <div className="flex flex-col gap-6 relative z-10 w-full max-w-sm">
                      {isFibCorrect === false && (
                        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                          <div className="flex items-center gap-2 mb-1">
                            <X className="w-4 h-4 text-red-500" />
                            <span className="text-[10px] uppercase tracking-widest font-bold text-red-500">Not quite</span>
                          </div>
                          <p className="text-lg font-medium text-white line-through opacity-70 mb-1">{lastFibSubmitted}</p>
                        </div>
                      )}

                      <div className={cn(
                        "flex flex-col gap-2 p-5 rounded-2xl border",
                        isFibCorrect ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-500/5 border-emerald-500/30"
                      )}>
                        <div className="flex items-center gap-2 mb-1">
                          <Check className="w-4 h-4 text-emerald-500" />
                          <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-500">
                            {isFibCorrect ? 'Perfectly Answered' : 'Correct Answer'}
                          </span>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold text-white tracking-tight">{currentCard?.back}</p>
                      </div>

                      {isFibCorrect === false && currentCard?.explanation && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left"
                        >
                          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted block mb-1.5">Why</span>
                          <p className="text-sm text-white/70 leading-relaxed">{currentCard.explanation}</p>
                        </motion.div>
                      )}
                      {isFibCorrect && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-emerald-400 text-xs font-bold uppercase tracking-[0.2em]"
                        >
                          Progress +1
                        </motion.div>
                      )}
                      {/* Life preservers from crew — FIB wrong answer */}
                      {isFibCorrect === false && cardFlares.flatMap(f => f.lifePreservers).length > 0 && (
                        <div className="flex flex-col gap-2">
                          {cardFlares.flatMap((f, fi) => f.lifePreservers.map((lp, li) => ({ f, lp, fi, li }))).map(({ f, lp, fi, li }) => (
                            <motion.div
                              key={`${fi}-${li}`}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: li * 0.08 }}
                              className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 text-left"
                            >
                              <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400 block mb-1">Crew tip from {lp.helperName}</span>
                              <p className="text-sm text-white/70">{lp.hintText}</p>
                              {!lp.isHelpful && (
                                <button
                                  onClick={() => handleThisSavedMe(f, li)}
                                  className="mt-2 text-[10px] uppercase tracking-widest font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                                >
                                  This Saved Me!
                                </button>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      )}
                      {isFibCorrect === false && !flareJustSent && (
                        <motion.button
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => setFlareModalOpen(true)}
                          className="w-full flex items-center justify-center gap-2 border border-orange-500/25 bg-orange-500/8 text-orange-400 hover:bg-orange-500/15 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                        >
                          <Flame className="w-3.5 h-3.5" /> Send SOS Flare
                        </motion.button>
                      )}
                      {isFibCorrect === false && flareJustSent && (
                        <p className="text-center text-[10px] text-orange-400/60 font-bold uppercase tracking-widest">🔥 Flare launched!</p>
                      )}
                    </div>
                  ) : (
                    <>
                      {currentCard?.backImageUrl && (
                        <div className="mb-4">
                          <LightboxImage
                            src={currentCard.backImageUrl}
                            className="w-full max-h-48 object-contain rounded-xl"
                          />
                          {currentCard.backImageCredit && (
                            <p className="text-[10px] text-brand-muted/70 italic mt-1 text-center">
                              {currentCard.backImageCredit}
                            </p>
                          )}
                        </div>
                      )}
                      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold leading-snug tracking-tight text-white relative z-10 whitespace-pre-wrap">{currentCard?.back}</h2>
                      {currentCard?.explanation && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 }}
                          className="mt-4 w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-left"
                        >
                          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted block mb-1.5">Why</span>
                          <p className="text-sm text-white/70 leading-relaxed">{currentCard.explanation}</p>
                        </motion.div>
                      )}
                    </>
                  )}
                </div>

                {/* Life preservers from crew — flashcard */}
                {(!currentCard?.type || currentCard?.type === 'flashcard') && cardFlares.flatMap(f => f.lifePreservers).length > 0 && (
                  <div className="w-full flex flex-col gap-2 mb-3" onClick={e => e.stopPropagation()}>
                    {cardFlares.flatMap((f, fi) => f.lifePreservers.map((lp, li) => ({ f, lp, fi, li }))).map(({ f, lp, fi, li }) => (
                      <motion.div
                        key={`${fi}-${li}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: li * 0.08 }}
                        className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 text-left"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400 block mb-1">Crew tip from {lp.helperName}</span>
                        <p className="text-sm text-white/70">{lp.hintText}</p>
                        {!lp.isHelpful && (
                          <button
                            onClick={() => handleThisSavedMe(f, li)}
                            className="mt-2 text-[10px] uppercase tracking-widest font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                          >
                            This Saved Me!
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Yes/No grading — inside card back, flashcard only */}
                {(!currentCard?.type || currentCard?.type === 'flashcard') && (
                  <div className="w-full mt-4 pt-5 border-t border-white/5" onClick={e => e.stopPropagation()}>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-brand-muted/50 font-bold mb-3">
                      Did you get it correct?
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleFlashcardGrade(false, e); }}
                        className="bg-white/5 border border-white/5 hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400 text-brand-muted h-12 rounded-xl flex items-center justify-center gap-2 transition-all"
                      >
                        <X className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">No</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleFlashcardGrade(true, e); }}
                        className="bg-white/5 border border-white/5 hover:bg-emerald-500/15 hover:border-emerald-500/30 hover:text-emerald-400 text-white h-12 rounded-xl flex items-center justify-center gap-2 transition-all"
                      >
                        <Check className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Yes</span>
                      </button>
                    </div>
                    {/* SOS Flare button — flashcard back face */}
                    {!flareJustSent ? (
                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        onClick={() => setFlareModalOpen(true)}
                        className="w-full mt-3 flex items-center justify-center gap-2 text-orange-400/50 hover:text-orange-400 transition-colors text-[10px] font-bold uppercase tracking-widest py-2"
                      >
                        <Flame className="w-3 h-3" /> Send SOS Flare
                      </motion.button>
                    ) : (
                      <p className="text-center text-[10px] text-orange-400/50 font-bold uppercase tracking-widest mt-3">🔥 Flare launched!</p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {(currentCard?.type === 'mcq' || currentCard?.type === 'multi-select' || currentCard?.type === 'sequencing' || currentCard?.type === 'fill-in-the-blank') && (
        <div className="w-full mt-8 sm:mt-12 flex justify-center min-h-[64px] relative z-[60]">
          <AnimatePresence>
            {(selectedOption !== null || (isFlipped && (currentCard.type === 'multi-select' || currentCard.type === 'sequencing' || currentCard.type === 'fill-in-the-blank'))) && (
              <div className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-xl px-4 sm:px-0">
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  onClick={currentCard.type === 'mcq' ? handleNextMCQ : handleNextComplex}
                  className="btn-primary h-14 sm:h-16 px-12 flex items-center justify-center gap-2 group text-sm sm:text-base shadow-[0_20px_40px_rgba(255,255,255,0.1)] relative overflow-hidden w-full sm:flex-1"
                >
                  <span>Continue</span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
      {currentCard?.type === 'matching' && (
         <p className="mt-8 text-center text-brand-muted/80 text-xs sm:text-sm font-bold">
            Score: <span className="text-white">{matchedRightIds.size} / {matchingRights.length}</span>
            {matchingMistakesCount > 0 && <span className="ml-2 text-red-400">({matchingMistakesCount} errors)</span>}
         </p>
      )}

      {/* Live Session Tracker */}
      <div className="w-full mt-12 px-4 md:px-0">
        <div className="max-w-2xl mx-auto grid grid-cols-4 gap-2 md:gap-4 pointer-events-auto">
          {/* Streak Counter */}
          <motion.div 
            animate={{ 
              scale: streak > 0 ? [1, 1.1, 1] : 1,
              backgroundColor: streak >= 3 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255, 255, 255, 0.05)'
            }}
            transition={{ duration: 0.3 }}
            className={cn(
              "rounded-2xl p-2 md:p-4 border border-white/5 shadow-2xl backdrop-blur-md flex flex-col items-center justify-center gap-1",
              streak >= 3 ? "border-amber-500/30" : "border-white/10"
            )}
          >
            <div className="flex items-center gap-1.5 md:gap-2">
              <Zap className={cn("w-3 h-3 md:w-4 md:h-4", streak >= 3 ? "text-amber-400 fill-amber-400" : "text-brand-muted")} />
              <span className="text-xs md:text-sm font-black text-white">{streak}</span>
            </div>
            <span className="text-[7px] md:text-[10px] font-bold uppercase tracking-widest text-brand-muted text-center leading-none">Streak</span>
          </motion.div>

          {/* Mastered */}
          <div className="bg-emerald-500/10 rounded-2xl p-2 md:p-4 border border-emerald-500/20 backdrop-blur-md flex flex-col items-center justify-center gap-1">
            <motion.span 
              key={sessionStats.mastered}
              initial={{ scale: 1.5, color: '#10b981' }}
              animate={{ scale: 1, color: '#ffffff' }}
              className="text-xs md:text-sm font-black"
            >
              {sessionStats.mastered}
            </motion.span>
            <span className="text-[7px] md:text-[10px] font-bold uppercase tracking-widest text-emerald-500/80 text-center leading-none">Mastered</span>
          </div>

          {/* Learning */}
          <div className="bg-brand-primary/10 rounded-2xl p-2 md:p-4 border border-brand-primary/20 backdrop-blur-md flex flex-col items-center justify-center gap-1">
            <motion.span 
              key={sessionStats.learning}
              initial={{ scale: 1.5, color: '#3b82f6' }}
              animate={{ scale: 1, color: '#ffffff' }}
              className="text-xs md:text-sm font-black"
            >
              {sessionStats.learning}
            </motion.span>
            <span className="text-[7px] md:text-[10px] font-bold uppercase tracking-widest text-brand-primary/80 text-center leading-none">Learning</span>
          </div>

          {/* Struggling */}
          <div className="bg-red-500/10 rounded-2xl p-2 md:p-4 border border-red-500/20 backdrop-blur-md flex flex-col items-center justify-center gap-1">
            <motion.span 
              key={sessionStats.struggling}
              initial={{ scale: 1.5, color: '#ef4444' }}
              animate={{ scale: 1, color: '#ffffff' }}
              className="text-xs md:text-sm font-black"
            >
              {sessionStats.struggling}
            </motion.span>
            <span className="text-[7px] md:text-[10px] font-bold uppercase tracking-widest text-red-500/80 text-center leading-none">Struggling</span>
          </div>
        </div>
      </div>
    </div>

    <FlareModal
      isOpen={flareModalOpen}
      friendCount={friends.length}
      isSending={isSendingFlare}
      onClose={() => setFlareModalOpen(false)}
      onSend={handleSendFlare}
    />
    </>
  );
}
