import { useState, useEffect } from 'react';
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Brain, ArrowLeft, CheckCircle2, ChevronRight, MousePointerClick, Database, Zap, Library, XCircle, AlertCircle, Check, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Island, CardStatus, CardUpdateRecord, UserSettings, Card } from '../hooks/useUserProgress';
import { cn } from '../lib/utils';

// Reliable Fisher-Yates shuffle to prevent duplicate/dropped card bugs caused by Math.random() in sort()
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
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
  mode?: 'all' | 'struggling' | 'learning' | 'mastered';
  settings?: UserSettings;
  onFinish: (scoreDelta: number, cardUpdates: CardUpdateRecord, maxStreak: number) => void;
  onManage: (scoreDelta: number, cardUpdates: CardUpdateRecord, maxStreak: number) => void;
  onBackToMap: (scoreDelta: number, cardUpdates: CardUpdateRecord, maxStreak: number) => void;
  onSwitchMode?: (newMode: 'all' | 'struggling' | 'learning' | 'mastered', scoreDelta: number, cardUpdates: CardUpdateRecord, maxStreak: number) => void;
}

export default function StudySession({ island, mode = 'all', settings, onFinish, onManage, onBackToMap, onSwitchMode }: StudySessionProps) {
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
    let targetCards = activeTierCards;
    if (mode === 'struggling') targetCards = activeTierCards.filter(c => c.status === 'struggling' || c.needsWork);
    else if (mode === 'learning') targetCards = activeTierCards.filter(c => (!c.status && !c.needsWork) || c.status === 'learning');
    else if (mode === 'mastered') targetCards = activeTierCards.filter(c => c.status === 'mastered');
    
    // Shuffle first to randomize among cards with the same lastReviewed
    const shuffled = shuffleArray(targetCards);
    // Then sort by lastReviewed ascending to ensure least recently reviewed cards come first 
    shuffled.sort((a, b) => (a.lastReviewed || 0) - (b.lastReviewed || 0));
    return shuffled;
  });

  const [sessionComplete, setSessionComplete] = useState(shuffledCards.length === 0);

  // Re-initialize the deck only on mount or when the user explicitly switches the study Mode, 
  // explicitly skipping island.cards so background db snapshots don't reset their deck mid-session.
  useEffect(() => {
    const activeTierCards = getActiveTierCards(island.cards);
    let targetCards = activeTierCards;
    if (mode === 'struggling') targetCards = activeTierCards.filter(c => c.status === 'struggling' || c.needsWork);
    else if (mode === 'learning') targetCards = activeTierCards.filter(c => (!c.status && !c.needsWork) || c.status === 'learning');
    else if (mode === 'mastered') targetCards = activeTierCards.filter(c => c.status === 'mastered');
    
    const shuffled = shuffleArray(targetCards);
    shuffled.sort((a, b) => (a.lastReviewed || 0) - (b.lastReviewed || 0));
    setShuffledCards(shuffled);
    setCurrentIndex(0);
    setSessionComplete(shuffled.length === 0);
  }, [mode]);

  const currentCard = shuffledCards[currentIndex];

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
    
    // Fill in the blank reset
    setFibInput('');
    setLastFibSubmitted(null);
    setIsFibCorrect(null);
    setCluesUsed(0);
    setRevealedIndices([]);

    // Multi-select reset
    setSelectedMultiOptions(new Set());
  }, [currentIndex, currentCard]);

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

      setCardUpdates(prev => ({ 
        ...prev, 
        [currentCard.front]: { status: newStatus, consecutiveCorrect: newConsecutive, lastReviewed: Date.now() } 
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
      setSessionStats(prev => ({ ...prev, [status]: prev[status as keyof typeof prev] + 1 }));

      setCardUpdates(prev => ({ 
        ...prev, 
        [currentCard.front]: { status, consecutiveCorrect, lastReviewed: Date.now() } 
      }));
      setDirection(-1);
    }
  };

  const handleMarkCard = (status: CardStatus, e?: React.MouseEvent) => {
    if (!currentCard) return;
    if (e && window.navigator?.vibrate && status === 'mastered') {
      window.navigator.vibrate(50);
    }
    if (e && status !== 'struggling') {
      triggerSparkle(e);
    }

    let points = 0;
    if (status === 'mastered') points = 3;
    else if (status === 'learning') points = 1;
    setScoreDelta(prev => prev + points);

    setSessionStats(prev => ({
      ...prev,
      [status]: prev[status as keyof typeof prev] + 1
    }));

    if (status !== 'struggling') {
      const newStreak = streak + 1;
      setStreak(newStreak);
      setMaxStreak(prev => Math.max(prev, newStreak));
    } else {
      setStreak(0);
    }

    setCardUpdates(prev => ({ 
      ...prev, 
      [currentCard.front]: { 
        status, 
        consecutiveCorrect: status === 'mastered' ? 0 : (status === 'learning' ? 1 : 0),
        lastReviewed: Date.now()
      } 
    }));
    setDirection(status !== 'struggling' ? 1 : -1);
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
    }

    const { status, consecutiveCorrect } = getNextStatusAndStreak(isCorrect, currentCard?.status, currentCard?.consecutiveCorrect);
    
    setSessionStats(prev => ({
      ...prev,
      [status]: prev[status as keyof typeof prev] + 1
    }));
    
    setCardUpdates(prev => ({ 
      ...prev, 
      [currentCard.front]: { status, consecutiveCorrect, lastReviewed: Date.now() } 
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
    
    setCardUpdates(prev => ({ 
      ...prev, 
      [currentCard.front]: { status, consecutiveCorrect, lastReviewed: Date.now() } 
    }));
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(shuffledSequence);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setShuffledSequence(items);
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

      setCardUpdates(prev => ({ 
        ...prev, 
        [currentCard.front]: { status, consecutiveCorrect, lastReviewed: Date.now() } 
      }));
    } else {
      setStreak(0);
      const { status, consecutiveCorrect } = getNextStatusAndStreak(false, currentCard?.status, currentCard?.consecutiveCorrect);
      
      setSessionStats(prev => ({
        ...prev,
        [status]: prev[status as keyof typeof prev] + 1
      }));
      
      setCardUpdates(prev => ({ 
        ...prev, 
        [currentCard.front]: { status, consecutiveCorrect, lastReviewed: Date.now() } 
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

            setCardUpdates(prev => ({ 
              ...prev, 
              [currentCard.front]: { status, consecutiveCorrect, lastReviewed: Date.now() } 
            }));
            setScoreDelta(prev => prev + 1); // 1 point for perfectly answering
            setDirection(1);
          } else {
            const { status, consecutiveCorrect } = getNextStatusAndStreak(false, currentCard?.status, currentCard?.consecutiveCorrect);
            
            setStreak(0);
            setSessionStats(prev => ({
              ...prev,
              [status]: prev[status as keyof typeof prev] + 1
            }));

            setCardUpdates(prev => ({ 
              ...prev, 
              [currentCard.front]: { status, consecutiveCorrect, lastReviewed: Date.now() } 
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
          onClick={() => onFinish(scoreDelta, cardUpdates, maxStreak)}
          className="w-full btn-primary h-16 text-lg"
        >
          Return to Map
        </button>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col items-center pb-48 md:pb-60">
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
            onClick={() => onBackToMap(scoreDelta, cardUpdates, maxStreak)} 
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
            onClick={() => onManage(scoreDelta, cardUpdates, maxStreak)} 
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
              onClick={() => onSwitchMode(mode === 'all' ? 'struggling' : 'all', scoreDelta, cardUpdates, maxStreak)}
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
                x: direction * 400,
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
                x: direction * -400,
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
            className={cn("w-full group", (!currentCard?.type || currentCard.type === 'flashcard') && "cursor-pointer")}
            onClick={() => {
              if (!currentCard?.type || currentCard.type === 'flashcard') {
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
                className="[grid-area:1/1] backface-hidden glass rounded-[40px] p-6 sm:p-8 md:p-12 flex flex-col items-center justify-center text-center border-brand-primary/20 shadow-2xl min-h-[50vh] sm:min-h-[500px]"
              >
                <p className="text-brand-muted uppercase tracking-[0.2em] font-medium text-[10px] sm:text-xs mb-4 sm:mb-6 shrink-0">
                  {currentCard?.type === 'mcq' ? 'Select the Correct Answer' : currentCard?.type === 'matching' ? 'Match the Objects' : currentCard?.type === 'fill-in-the-blank' ? 'Fill in the Blank' : currentCard?.type === 'multi-select' ? 'Select All That Apply' : currentCard?.type === 'sequencing' ? 'Put in the Correct Order' : 'Front Side'}
                  {tierInfo && (
                    <span className="ml-3 px-2.5 py-1 bg-white/10 rounded-full border border-white/20 text-white font-bold text-[10px] shadow-sm">
                      Tier {tierInfo.current} / {tierInfo.total}
                    </span>
                  )}
                </p>
                <h2 className={cn("font-bold leading-snug tracking-tight mb-6 sm:mb-8 whitespace-pre-wrap", currentCard?.type === 'mcq' ? "text-lg sm:text-xl md:text-2xl" : "text-xl sm:text-2xl md:text-3xl")}>
                  {currentCard?.front}
                </h2>
                
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
                              "bg-white/5 border border-white/10 hover:bg-white/10 text-white"
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
                              "bg-white/5 border border-white/10 hover:bg-white/10 text-white"
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
                        let btnClass = "bg-white/5 border border-white/10 text-brand-muted";
                        let icon = null;

                        if (!isFlipped) {
                          btnClass = isSelected ? "bg-brand-primary/20 border-brand-primary/50 text-white" : "bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-brand-muted";
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
                  </div>
                ) : currentCard?.type === 'sequencing' ? (
                  <div className="w-full flex-1 flex flex-col justify-center items-center gap-3 pb-4">
                    <form onSubmit={handleSequenceSubmit} className="w-full flex flex-col gap-3">
                      <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable droppableId="sequence-droppable">
                          {(provided) => (
                            <div 
                              {...provided.droppableProps} 
                              ref={provided.innerRef}
                              className="w-full space-y-2"
                            >
                              {shuffledSequence.map((item, idx) => {
                                let btnClass = "bg-white/5 border border-white/10 text-white";
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
                                  // @ts-expect-error - Draggable Props typings issue in React 18
                                  <Draggable key={item.id} draggableId={item.id} index={idx} isDragDisabled={isFlipped}>
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={cn(
                                          "w-full text-left px-4 py-3 sm:px-5 sm:py-4 rounded-xl transition-all font-medium text-xs sm:text-sm md:text-base leading-relaxed shrink-0 flex items-center gap-3",
                                          btnClass,
                                          snapshot.isDragging ? "shadow-[0_20px_40px_rgba(0,0,0,0.4)] border-brand-primary/50" : ""
                                        )}
                                      >
                                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                          {idx + 1}
                                        </div>
                                        <span className="flex-1">{item.text}</span>
                                        {icon && (
                                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                                            {icon}
                                          </motion.div>
                                        )}
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              })}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
                      {!isFlipped && (
                        <button type="submit" className="w-full mt-4 bg-brand-primary hover:bg-white text-black py-4 rounded-xl text-sm font-bold transition-colors">
                          Submit Sequence
                        </button>
                      )}
                    </form>
                  </div>
                ) : currentCard?.type === 'mcq' ? (
                  <div className="w-full flex-1 flex flex-col justify-center gap-3 pb-4">
                    {shuffledOptions.map((opt, idx) => {
                      let btnClass = "bg-white/5 border border-white/10 hover:bg-white/10 text-brand-muted hover:text-white";
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
                                <span className="font-bold opacity-50 shrink-0">{letter}.</span>
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
                  </div>
                ) : (
                  <div className="mt-auto pt-8 flex flex-col items-center gap-2 opacity-40 group-hover:opacity-100 transition-all duration-300">
                    <MousePointerClick className="w-5 h-5 text-brand-muted" />
                    <span className="text-[9px] uppercase tracking-[0.3em] font-black text-brand-muted">Tap to Flip</span>
                  </div>
                )}
              </div>

              {/* Back */}
              <div 
                style={{ transform: "rotateY(180deg)" }}
                className="[grid-area:1/1] backface-hidden glass rounded-[40px] p-8 sm:p-10 md:p-12 flex flex-col items-center justify-center text-center shadow-2xl overflow-hidden min-h-[50vh] sm:min-h-[500px]"
              >
                {/* Subtle Texture/Pattern for back side */}
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[size:24px_24px]" />
                </div>
                
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

                    {isFibCorrect && (
                       <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-emerald-400 text-xs font-bold uppercase tracking-[0.2em]"
                       >
                         Progress +1
                       </motion.div>
                    )}
                  </div>
                ) : (
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold leading-snug tracking-tight text-white relative z-10 whitespace-pre-wrap">{currentCard?.back}</h2>
                )}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {(!currentCard?.type || currentCard?.type === 'flashcard') && (
        <>
          {/* Controller - 3 Tiers */}
          <div className="w-full mt-8 sm:mt-12 grid grid-cols-3 gap-3">
            <button 
              onClick={(e) => { e.stopPropagation(); handleMarkCard('struggling'); }}
              className="bg-white/5 border border-white/5 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 text-brand-muted h-14 sm:h-16 rounded-2xl flex flex-col items-center justify-center gap-1 group transition-all"
            >
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-y-0.5 transition-transform" />
              <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Struggling</span>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleMarkCard('learning'); }}
              className="bg-white/5 border border-white/5 hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-400 text-white h-14 sm:h-16 rounded-2xl flex flex-col items-center justify-center gap-1 group transition-all"
            >
              <Check className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-y-0.5 transition-transform" />
              <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Got it</span>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleMarkCard('mastered', e); }}
              className="bg-white/5 border border-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 text-white h-14 sm:h-16 rounded-2xl flex flex-col items-center justify-center gap-1 group transition-all"
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-y-0.5 transition-transform" />
              <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Mastered</span>
            </button>
          </div>
          
          <p className="mt-8 text-center text-brand-muted/40 text-[10px] uppercase tracking-[0.2em] font-bold">
            Tap card to reveal response
          </p>
        </>
      )}
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
      <div className="fixed bottom-0 left-0 right-0 p-4 md:p-6 z-40 bg-gradient-to-t from-brand-bg/90 via-brand-bg/50 to-transparent pointer-events-none">
        <div className="max-w-2xl mx-auto flex gap-2 md:gap-4 pointer-events-auto">
          {/* Streak Counter */}
          <motion.div 
            animate={{ 
              scale: streak > 0 ? [1, 1.1, 1] : 1,
              backgroundColor: streak >= 3 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255, 255, 255, 0.05)'
            }}
            transition={{ duration: 0.3 }}
            className={cn(
              "flex-1 md:flex-initial md:min-w-[120px] rounded-2xl p-3 md:p-4 border border-white/5 shadow-2xl backdrop-blur-md flex flex-col items-center justify-center gap-1",
              streak >= 3 ? "border-amber-500/30" : "border-white/10"
            )}
          >
            <div className="flex items-center gap-1.5 md:gap-2">
              <Zap className={cn("w-3 h-3 md:w-4 md:h-4", streak >= 3 ? "text-amber-400 fill-amber-400" : "text-brand-muted")} />
              <span className="text-xs md:text-sm font-black text-white">{streak}</span>
            </div>
            <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-brand-muted">Streak</span>
          </motion.div>

          <div className="flex-1 grid grid-cols-3 gap-2 md:gap-4">
            {/* Mastered */}
            <div className="bg-emerald-500/10 rounded-2xl p-3 md:p-4 border border-emerald-500/20 backdrop-blur-md flex flex-col items-center justify-center gap-1">
              <motion.span 
                key={sessionStats.mastered}
                initial={{ scale: 1.5, color: '#10b981' }}
                animate={{ scale: 1, color: '#ffffff' }}
                className="text-xs md:text-sm font-black"
              >
                {sessionStats.mastered}
              </motion.span>
              <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-emerald-500/80">Mastered</span>
            </div>

            {/* Learning */}
            <div className="bg-brand-primary/10 rounded-2xl p-3 md:p-4 border border-brand-primary/20 backdrop-blur-md flex flex-col items-center justify-center gap-1">
              <motion.span 
                key={sessionStats.learning}
                initial={{ scale: 1.5, color: '#3b82f6' }}
                animate={{ scale: 1, color: '#ffffff' }}
                className="text-xs md:text-sm font-black"
              >
                {sessionStats.learning}
              </motion.span>
              <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-brand-primary/80">Learning</span>
            </div>

            {/* Struggling */}
            <div className="bg-red-500/10 rounded-2xl p-3 md:p-4 border border-red-500/20 backdrop-blur-md flex flex-col items-center justify-center gap-1">
              <motion.span 
                key={sessionStats.struggling}
                initial={{ scale: 1.5, color: '#ef4444' }}
                animate={{ scale: 1, color: '#ffffff' }}
                className="text-xs md:text-sm font-black"
              >
                {sessionStats.struggling}
              </motion.span>
              <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-red-500/80">Struggling</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
