import { useState, useRef, useMemo } from 'react';
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Trash2, CreditCard, Play, Upload, Share2, Globe, Users, Lock, Check, Download, X, ArrowUp, Type, CheckSquare, ListOrdered, Move, Pencil } from 'lucide-react';
import { Island, Card } from '../hooks/useUserProgress';
import Papa from 'papaparse';
import { cn } from '../lib/utils';
import ShareModal from './ShareModal';
import ImageUpload from './ImageUpload';
import { UserProfile } from '../hooks/useSocial';

interface IslandDetailProps {
  island: Island;
  allIslands: Island[];
  archipelagos: { id: string; name: string }[];
  onBack: () => void;
  onAddCard: (card: Card) => void;
  onUpdateCard?: (cardIndex: number, card: Card) => void;
  onDeleteCard?: (cardIndex: number) => void;
  onMoveCard?: (cardIndex: number, targetIslandId: string) => void;
  onAddCards: (cards: Card[]) => void;
  onDeleteIsland?: () => void;
  onStartStudy: (mode: 'all' | 'struggling' | 'learning' | 'mastered' | 'due') => void;
  onShare?: (island: Island, targetUids?: string[]) => void;
  onUnshare?: (island: Island) => void;
  onUpdateIsland?: (updates: Partial<Island>) => void;
  progressTrackingMode?: 'srs' | 'status' | 'both';
  friends?: string[];
  fetchProfilesByUids?: (uids: string[]) => Promise<UserProfile[]>;
}

export default function IslandDetail({ island, allIslands, archipelagos, onBack, onAddCard, onUpdateCard, onDeleteCard, onMoveCard, onDeleteIsland, onAddCards, onStartStudy, onShare, onUnshare, onUpdateIsland, progressTrackingMode = 'srs', friends = [], fetchProfilesByUids = async () => [] }: IslandDetailProps) {
  const [editingCardIndex, setEditingCardIndex] = useState<number | null>(null);
  const [studyMode, setStudyMode] = useState<'all' | 'struggling' | 'learning' | 'mastered' | 'due'>(() => {
    if (progressTrackingMode === 'srs') {
      const now = Date.now();
      const due = island.cards.filter(c => !c.srsNextReview || c.srsNextReview <= now).length;
      return due > 0 ? 'due' : 'all';
    }
    return 'all';
  });
  const [showShareConfirm, setShowShareConfirm] = useState(false);
  const [showUnshareConfirm, setShowUnshareConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [movingCardIndex, setMovingCardIndex] = useState<number | null>(null);
  const [cardType, setCardType] = useState<Card['type']>('flashcard');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [distractors, setDistractors] = useState('');
  const [distractorExplanations, setDistractorExplanations] = useState('');
  const [correctAnswerExplanation, setCorrectAnswerExplanation] = useState('');
  const [hint, setHint] = useState('');
  const [explanation, setExplanation] = useState('');
  const [matchingPairs, setMatchingPairs] = useState<{ id: string; left: string; rights: string }[]>([{ id: Date.now().toString(), left: '', rights: '' }]);
  const [multiSelectOptions, setMultiSelectOptions] = useState<{ id: string; text: string; isCorrect: boolean }[]>([
    { id: Date.now().toString() + '1', text: '', isCorrect: false },
    { id: Date.now().toString() + '2', text: '', isCorrect: false }
  ]);
  const [sequenceItems, setSequenceItems] = useState<{ id: string; text: string }[]>([
    { id: Date.now().toString() + '1', text: '' },
    { id: Date.now().toString() + '2', text: '' }
  ]);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [backImageUrl, setBackImageUrl] = useState<string | undefined>(undefined);
  const [imageCredit, setImageCredit] = useState('');
  const [backImageCredit, setBackImageCredit] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [deletingCardIndex, setDeletingCardIndex] = useState<number | null>(null);
  const [parentCardForProgression, setParentCardForProgression] = useState<Card | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const islandPrivacyState = island.approvalStatus === 'pending'
    ? 'pending'
    : island.approvalStatus === 'approved' && island.isPublic
      ? 'public'
      : (island.sharedWith && island.sharedWith.length > 0)
        ? 'shared'
        : 'private';
  
  const resetCardForm = () => {
    setEditingCardIndex(null);
    setParentCardForProgression(null);
    setCardType('flashcard');
    setFront('');
    setBack('');
    setDistractors('');
    setDistractorExplanations('');
    setCorrectAnswerExplanation('');
    setHint('');
    setExplanation('');
    setImageUrl(undefined);
    setBackImageUrl(undefined);
    setImageCredit('');
    setBackImageCredit('');
    setMatchingPairs([{ id: Date.now().toString(), left: '', rights: '' }]);
    setMultiSelectOptions([
      { id: Date.now().toString() + '1', text: '', isCorrect: false },
      { id: Date.now().toString() + '2', text: '', isCorrect: false }
    ]);
    setSequenceItems([
      { id: Date.now().toString() + '1', text: '' },
      { id: Date.now().toString() + '2', text: '' }
    ]);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (front.trim() && (back.trim() || ['matching', 'multi-select', 'sequencing'].includes(cardType))) {
      let newCard: Card = { 
        id: (editingCardIndex !== null && island.cards[editingCardIndex].id) ? island.cards[editingCardIndex].id : Math.random().toString(36).substring(2, 11),
        front: front.trim(), 
        back: back.trim(), 
        type: cardType 
      };
      
      // Keep needsWork status when updating, otherwise it defaults to false
      if (editingCardIndex !== null) {
        if (island.cards[editingCardIndex].needsWork) newCard.needsWork = true;
        if (island.cards[editingCardIndex].status) newCard.status = island.cards[editingCardIndex].status;
        if (island.cards[editingCardIndex].prevTierCardId) newCard.prevTierCardId = island.cards[editingCardIndex].prevTierCardId;
        if (island.cards[editingCardIndex].tier) newCard.tier = island.cards[editingCardIndex].tier;
      } else {
        if (parentCardForProgression) {
          newCard.prevTierCardId = parentCardForProgression.id;
          newCard.tier = (parentCardForProgression.tier || 1) + 1;
        } else {
          newCard.tier = 1;
        }
      }
      
      if (hint.trim()) {
        newCard.hint = hint.trim();
      }
      if (explanation.trim()) {
        newCard.explanation = explanation.trim();
      }

      if (imageUrl) newCard.imageUrl = imageUrl;
      if (backImageUrl) newCard.backImageUrl = backImageUrl;
      if (imageCredit.trim()) newCard.imageCredit = imageCredit.trim();
      if (backImageCredit.trim()) newCard.backImageCredit = backImageCredit.trim();

      if (cardType === 'mcq') {
        const optionLines = distractors.split('\n').map(l => l.trim()).filter(l => l);
        const explanationLines = distractorExplanations.split('\n').map(l => l.trim());
        newCard.options = [back.trim(), ...optionLines]; // correct answer is first before shuffling
        
        const explanations: Record<string, string> = {};
        
        // Correct answer explanation
        if (correctAnswerExplanation.trim()) {
          explanations[back.trim()] = correctAnswerExplanation.trim();
        }

        // Distractor explanations
        optionLines.forEach((opt, idx) => {
          if (explanationLines[idx]) {
            explanations[opt] = explanationLines[idx];
          }
        });
        
        if (Object.keys(explanations).length > 0) {
          newCard.explanations = explanations;
        }
      } else if (cardType === 'matching') {
        const validPairs = matchingPairs
          .filter(p => p.left.trim() && p.rights.trim())
          .map(p => ({
            id: p.id,
            left: p.left.trim(),
            rights: p.rights.split(',').map(r => r.trim()).filter(r => r)
          }));
        if (validPairs.length < 2) {
          alert('Matching cards require at least two pairs.');
          return;
        }
        newCard.pairs = validPairs;
        newCard.back = 'Matching Exercise'; // Dummy back
      } else if (cardType === 'multi-select') {
        const validOptions = multiSelectOptions.filter(o => o.text.trim());
        if (validOptions.length < 2) {
          alert('Multi-select requires at least two options.');
          return;
        }
        const hasCorrect = validOptions.some(o => o.isCorrect);
        if (!hasCorrect) {
          alert('Multi-select requires at least one correct option.');
          return;
        }
        newCard.options = validOptions.map(o => o.text.trim());
        newCard.correctOptions = validOptions.filter(o => o.isCorrect).map(o => o.text.trim());
        newCard.back = 'Multi-Select Exercise';
      } else if (cardType === 'sequencing') {
        const validItems = sequenceItems.filter(i => i.text.trim());
        if (validItems.length < 2) {
          alert('Sequencing requires at least two items.');
          return;
        }
        newCard.options = validItems.map(i => i.text.trim());
        newCard.back = 'Sequencing Exercise';
      }
      
      if (editingCardIndex !== null && onUpdateCard) {
        onUpdateCard(editingCardIndex, newCard);
      } else {
        onAddCard(newCard);
      }
      
      resetCardForm();
    }
  };

  const handleEditCard = (idx: number) => {
    const card = island.cards[idx];
    setEditingCardIndex(idx);
    setParentCardForProgression(null);
    setCardType(card.type || 'flashcard');
    setFront(card.front);
    setBack(card.back);
    setHint(card.hint || '');
    setExplanation(card.explanation || '');
    setImageUrl(card.imageUrl);
    setBackImageUrl(card.backImageUrl);
    setImageCredit(card.imageCredit || '');
    setBackImageCredit(card.backImageCredit || '');
    if (card.type === 'mcq' && card.options) {
      // Options format is [correctAnswer, ...distractors]
      const currentDistractors = card.options.filter(opt => opt !== card.back);
      setDistractors(currentDistractors.join('\n'));
      if (card.explanations) {
        setCorrectAnswerExplanation(card.explanations[card.back] || '');
        const explanationsArray = currentDistractors.map(opt => card.explanations![opt] || '');
        setDistractorExplanations(explanationsArray.join('\n'));
      } else {
        setCorrectAnswerExplanation('');
        setDistractorExplanations('');
      }
    } else {
      setCorrectAnswerExplanation('');
      setDistractors('');
      setDistractorExplanations('');
    }
    if (card.type === 'matching' && card.pairs) {
      setMatchingPairs(card.pairs.map(p => ({
        id: p.id,
        left: p.left,
        rights: p.rights.join(', ')
      })));
    } else {
      setMatchingPairs([{ id: Date.now().toString(), left: '', rights: '' }]);
    }
    if (card.type === 'multi-select' && card.options) {
      setMultiSelectOptions(card.options.map(o => ({
        id: Date.now().toString() + Math.random(),
        text: o,
        isCorrect: card.correctOptions?.includes(o) || false
      })));
    } else {
      setMultiSelectOptions([
        { id: Date.now().toString() + '1', text: '', isCorrect: false },
        { id: Date.now().toString() + '2', text: '', isCorrect: false }
      ]);
    }
    if (card.type === 'sequencing' && card.options) {
      setSequenceItems(card.options.map((o, idx) => ({
        id: Date.now().toString() + idx,
        text: o
      })));
    } else {
      setSequenceItems([
        { id: Date.now().toString() + '1', text: '' },
        { id: Date.now().toString() + '2', text: '' }
      ]);
    }
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleCancelEdit = () => {
    resetCardForm();
  };

  const handleAddProgression = (idx: number) => {
    const parentCard = { ...island.cards[idx] };
    if (!parentCard.id) {
      parentCard.id = Math.random().toString(36).substring(2, 11);
      if (onUpdateCard) onUpdateCard(idx, parentCard);
    }
    
    resetCardForm();
    setParentCardForProgression(parentCard);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelProgression = () => {
    setParentCardForProgression(null);
  };


  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCleanName = () => island.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

  const downloadFlashcards = () => {
    const flashcards = island.cards.filter(c => c.type === 'flashcard' || !c.type);
    if (!flashcards.length) return;
    const csvContent = Papa.unparse(flashcards.map(c => ({
      Front: c.front,
      Back: c.back
    })));
    downloadFile(csvContent, `${getCleanName()}_flashcards.csv`);
  };

  const downloadMcqs = () => {
    const mcqs = island.cards.filter(c => c.type === 'mcq');
    if (!mcqs.length) return;
    const csvContent = Papa.unparse(mcqs.map(c => ({
      Question: c.front,
      Correct_Answer: c.back,
      Option_1: c.options?.[0] || '',
      Option_2: c.options?.[1] || '',
      Option_3: c.options?.[2] || '',
      Option_4: c.options?.[3] || ''
    })));
    downloadFile(csvContent, `${getCleanName()}_mcqs.csv`);
  };

  const handleExport = () => {
    if (island.cards.length === 0) {
      alert('No cards to export!');
      return;
    }

    const hasFlashcards = island.cards.some(c => c.type === 'flashcard' || !c.type);
    const hasMcqs = island.cards.some(c => c.type === 'mcq');

    if (hasFlashcards && hasMcqs) {
      setShowExportModal(true);
    } else if (hasFlashcards) {
      downloadFlashcards();
    } else if (hasMcqs) {
      downloadMcqs();
    }
  };

  const parseCSV = (file: File) => {
    setIsUploading(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedCards: Card[] = [];
        
        results.data.forEach((row: any) => {
          // Robust checking: fallback matching if column headers use different casings
          let q = row.question || row.Question || row.front || row.Front;
          let a = row.answer || row.Answer || row.back || row.Back || row.Correct_Answer || row.correct_answer;

          // If no headers match exactly, try using the first two keys in the object
          if (!q || !a) {
            const keys = Object.keys(row);
            if (keys.length >= 2) {
              q = row[keys[0]];
              a = row[keys[1]];
            }
          }

          if (q && a && typeof q === 'string' && typeof a === 'string') {
            const newCard: Card = { front: q.trim(), back: a.trim() };
            
            // Check for options/distractors to identify MCQ
            const options: string[] = [];
            
            // Collect any headers that look like options or distractors
            Object.keys(row).forEach(key => {
              const lowerKey = key.toLowerCase();
              if ((lowerKey.includes('option') || lowerKey.includes('distractor')) && row[key]) {
                const optVal = String(row[key]).trim();
                if (optVal && optVal !== a.trim()) {
                  options.push(optVal);
                }
              }
            });

            if (options.length > 0) {
              newCard.type = 'mcq';
              // Standard behavior: first option is the correct one, then the others
              newCard.options = [a.trim(), ...options];
            } else {
              newCard.type = 'flashcard';
            }

            parsedCards.push(newCard);
          }
        });

        if (parsedCards.length > 0) {
          onAddCards(parsedCards);
          alert(`Success! Anchored ${parsedCards.length} new cards from your CSV.`);
        } else {
          alert('No valid cards found. Ensure your CSV has "question" and "answer" columns.');
        }

        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      error: (error) => {
        alert('File parsing failed: ' + error.message);
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseCSV(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
        parseCSV(file);
      } else if (!file.type.startsWith('image/')) {
        alert("Please drop a valid CSV file.");
      }
    }
  };
  const strugglingCount = island.cards.filter(c => c.status === 'struggling' || c.needsWork).length;
  const learningCount = island.cards.filter(c => !c.status || c.status === 'learning').length;
  const masteredCount = island.cards.filter(c => c.status === 'mastered').length;
  const dueCount = island.cards.filter(c => !c.srsNextReview || c.srsNextReview <= Date.now()).length;

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

  const displayCards = useMemo(() => {
    const roots: { card: Card, originalIdx: number }[] = [];
    const childrenMap = new Map<string, { card: Card, originalIdx: number }[]>();
    
    island.cards.forEach((card, originalIdx) => {
      // If parent exists in the array, it's a child.
      const hasParent = card.prevTierCardId && island.cards.some(c => c.id === card.prevTierCardId);
      if (!hasParent) {
        roots.push({ card, originalIdx });
      } else {
        const children = childrenMap.get(card.prevTierCardId!) || [];
        children.push({ card, originalIdx });
        childrenMap.set(card.prevTierCardId!, children);
      }
    });

    const flattened: { card: Card, originalIdx: number }[] = [];
    
    const traverse = (node: { card: Card, originalIdx: number }) => {
      flattened.push(node);
      const children = childrenMap.get(node.card.id || '') || [];
      children.forEach(traverse);
    };

    roots.forEach(traverse);
    return flattened;
  }, [island.cards]);

  return (
    <div 
      className="max-w-4xl mx-auto w-full relative"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-[-20px] sm:inset-[-40px] z-[100] bg-brand-background/90 backdrop-blur-sm border-2 border-dashed border-brand-primary rounded-3xl flex flex-col items-center justify-center text-white"
          >
            <div className="w-20 h-20 bg-brand-primary/20 rounded-full flex items-center justify-center mb-6">
              <Upload className="w-10 h-10 text-brand-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Drop CSV to Import</h3>
            <p className="text-brand-muted">Release to parse your flashcards instantly.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="mb-12 flex flex-col 2xl:flex-row 2xl:items-start justify-between gap-6 flex-wrap">
        <div className="flex items-start gap-4 sm:gap-6 min-w-0">
          <button 
            onClick={onBack}
            className="w-10 h-10 sm:w-12 sm:h-12 mt-1 rounded-2xl glass flex items-center justify-center text-brand-muted hover:text-white transition-all shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)] relative bg-black/40 flex items-center justify-center shrink-0 border-brand-border mt-1">
            <img 
              src={imageSrc} 
              alt={`${masteryLevel} island`} 
              className="w-[130%] h-[130%] object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (masteryLevel === 'struggling') target.src = 'https://images.unsplash.com/photo-1505672678657-cc7037095e60?auto=format&fit=crop&q=80&w=200&h=200';
                else if (masteryLevel === 'learning') target.src = 'https://images.unsplash.com/photo-1544550581-5f7ceaf7f992?auto=format&fit=crop&q=80&w=200&h=200';
                else target.src = 'https://images.unsplash.com/photo-1523363065056-11f8b449174b?auto=format&fit=crop&q=80&w=200&h=200';
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              {isEditingName ? (
                <input
                  autoFocus
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  onBlur={() => {
                    const trimmed = editNameValue.trim();
                    if (trimmed && trimmed !== island.name) onUpdateIsland?.({ name: trimmed });
                    setIsEditingName(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') { setIsEditingName(false); }
                  }}
                  className="text-2xl sm:text-[32px] font-bold tracking-tight bg-white/5 border border-white/20 rounded-xl px-3 py-1 text-white outline-none focus:border-brand-primary/60 min-w-0 w-full max-w-sm"
                />
              ) : (
                <button
                  onClick={() => { setEditNameValue(island.name); setIsEditingName(true); }}
                  className="group/name flex items-center gap-2 text-left"
                >
                  <h2 className="text-2xl sm:text-[32px] font-bold tracking-tight break-words">{island.name}</h2>
                  <Pencil className="w-4 h-4 text-brand-muted opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0" />
                </button>
              )}
              
              <div className="flex items-center gap-3 shrink-0">
                {onShare && (
                  <div className="relative">
                    <button 
                      onClick={() => {
                        if (islandPrivacyState === 'public') {
                          setShowUnshareConfirm(true);
                        } else {
                          // Allow re-opening share modal for private/shared to manage list
                          setShowShareConfirm(true);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                        islandPrivacyState === 'public'
                          ? "bg-brand-primary/20 text-brand-primary border border-brand-primary/30"
                          : islandPrivacyState === 'pending'
                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                            : islandPrivacyState === 'shared'
                              ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                              : "bg-white/5 text-brand-muted hover:text-white border border-white/5 hover:border-white/10"
                      )}
                    >
                      {islandPrivacyState === 'public' ? (
                        <Globe className="w-3 h-3" />
                      ) : (islandPrivacyState === 'shared' || islandPrivacyState === 'pending') ? (
                        <Users className="w-3 h-3" />
                      ) : (
                        <Lock className="w-3 h-3" />
                      )}
                      {islandPrivacyState === 'public' ? 'Public' : islandPrivacyState === 'pending' ? 'Pending' : islandPrivacyState === 'shared' ? `Shared (${island.sharedWith?.length})` : 'Private'}
                    </button>

                    {onShare && (
                      <ShareModal
                        isOpen={showShareConfirm}
                        onClose={() => setShowShareConfirm(false)}
                        title={islandPrivacyState === 'shared' ? "Update Sharing" : islandPrivacyState === 'public' ? "Update Community Island" : "Submit for review?"}
                        description={islandPrivacyState === 'shared'
                          ? "Select more friends to share this island with."
                          : islandPrivacyState === 'public'
                            ? "Resubmit your latest changes to update this island in the community discovery feed."
                            : "This island will be submitted to the moderation queue before it appears in community discovery."}
                        initialSelectedUids={island.sharedWith || []}
                        initialTab={islandPrivacyState === 'shared' ? 'targeted' : 'public'}
                        onSharePublic={() => {
                          onShare(island);
                        }}
                        onShareTargeted={(uids) => {
                          onShare(island, uids);
                        }}
                        friends={friends}
                        fetchProfilesByUids={fetchProfilesByUids}
                        sharedAtTimestamps={island.sharedAtTimestamps}
                      />
                    )}

                    <AnimatePresence>
                      {showUnshareConfirm && (
                        <>
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
                            onClick={() => setShowUnshareConfirm(false)}
                          />
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            className="absolute top-full left-0 mt-3 w-64 glass p-5 rounded-[24px] border border-white/10 shadow-2xl z-[70]"
                          >
                            <p className="text-xs font-bold text-white mb-2">
                              {islandPrivacyState === 'shared' ? 'Stop sharing?' : 'Remove from community?'}
                            </p>
                            <p className="text-[10px] text-brand-muted leading-relaxed mb-4">
                              {islandPrivacyState === 'shared' 
                                ? "Your friends will no longer be able to discover or import this island."
                                : "This island will no longer appear in community discovery for other explorers."}
                            </p>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  onUnshare?.(island);
                                  setShowUnshareConfirm(false);
                                }}
                                className="flex-1 bg-red-500/90 text-white text-[10px] font-black uppercase tracking-widest py-2 rounded-xl hover:bg-red-500 transition-colors"
                              >
                                Remove
                              </button>
                              <button 
                                onClick={() => setShowUnshareConfirm(false)}
                                className="flex-1 bg-white/5 text-brand-muted text-[10px] font-black uppercase tracking-widest py-2 rounded-xl hover:bg-white/10 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                
                {onDeleteIsland && (
                  <div className="relative">
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-brand-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete Island"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <AnimatePresence>
                      {showDeleteConfirm && (
                        <>
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
                            onClick={() => setShowDeleteConfirm(false)}
                          />
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9, x: -10 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9, x: -10 }}
                            className="absolute top-0 right-full mr-3 w-64 glass p-5 rounded-[24px] border border-red-500/20 shadow-2xl z-[70] bg-red-500/5 backdrop-blur-xl"
                          >
                            <p className="text-xs font-bold text-white mb-2 text-red-500">Delete Island?</p>
                            <p className="text-[10px] text-brand-muted leading-relaxed mb-4">
                              This will permanently sink <span className="font-bold text-white">{island.name}</span>. This action cannot be undone. Are you sure?
                            </p>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  onDeleteIsland();
                                  setShowDeleteConfirm(false);
                                }}
                                className="flex-1 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest py-2 rounded-xl hover:bg-red-600 transition-colors"
                              >
                                Delete
                              </button>
                              <button 
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 bg-white/5 text-brand-muted text-[10px] font-black uppercase tracking-widest py-2 rounded-xl hover:bg-white/10 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
            <p className="text-brand-muted font-normal text-sm sm:text-base mb-2">Manage your knowledge cards here.</p>
            {onUpdateIsland && archipelagos && archipelagos.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-brand-muted tracking-widest mt-0.5">Archipelago:</span>
                <select
                  value={island.archipelagoId || ''}
                  onChange={(e) => onUpdateIsland({ archipelagoId: e.target.value || undefined })}
                  className="bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white px-2 py-1 outline-none cursor-pointer hover:bg-white/10 transition-colors appearance-none"
                >
                  <option value="" className="bg-[#111] text-brand-muted">None (All Islands)</option>
                  {archipelagos.map(a => (
                    <option key={a.id} value={a.id} className="bg-[#111]">{a.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-4 shrink-0 overflow-x-auto custom-scrollbar pb-2 xl:pb-0">
          {island.cards.length > 0 && (
            <>
              <div className="flex flex-wrap bg-white/5 rounded-2xl p-1 border border-white/10 shadow-lg self-stretch sm:self-auto">
                <button
                  onClick={() => setStudyMode('all')}
                  className={cn(
                    "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all font-black text-[10px] tracking-wider uppercase whitespace-nowrap",
                    studyMode === 'all' ? "bg-white/10 text-white shadow-sm" : "text-brand-muted hover:text-white"
                  )}
                  title={`Study all ${island.cards.length} cards`}
                >
                  All ({island.cards.length})
                </button>

                {progressTrackingMode === 'both' && (
                  <div className="hidden sm:block w-px h-4 bg-white/10 mx-1 self-center" />
                )}

                {progressTrackingMode !== 'status' && (
                  <button
                    onClick={() => setStudyMode('due')}
                    disabled={dueCount === 0}
                    className={cn(
                      "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-colors font-bold text-[10px] tracking-widest uppercase whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed",
                      studyMode === 'due' ? "bg-sky-500/20 text-sky-400 border border-sky-500/30" : "text-brand-muted hover:text-sky-400"
                    )}
                    title={`${dueCount} cards due for review`}
                  >
                    Due ({dueCount})
                  </button>
                )}
                {progressTrackingMode !== 'srs' && (
                  <>
                    <button
                      onClick={() => setStudyMode('struggling')}
                      disabled={strugglingCount === 0}
                      className={cn(
                        "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-colors font-bold text-[10px] tracking-widest uppercase whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed",
                        studyMode === 'struggling' ? "bg-red-500/20 text-red-400 border border-red-500/30" : "text-brand-muted hover:text-red-400"
                      )}
                    >
                      Struggling ({strugglingCount})
                    </button>
                    <button
                      onClick={() => setStudyMode('learning')}
                      disabled={learningCount === 0}
                      className={cn(
                        "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-colors font-bold text-[10px] tracking-widest uppercase whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed",
                        studyMode === 'learning' ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-brand-muted hover:text-amber-400"
                      )}
                    >
                      Learning ({learningCount})
                    </button>
                    <button
                      onClick={() => setStudyMode('mastered')}
                      disabled={masteredCount === 0}
                      className={cn(
                        "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-colors font-bold text-[10px] tracking-widest uppercase whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed",
                        studyMode === 'mastered' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-brand-muted hover:text-emerald-400"
                      )}
                    >
                      Mastered ({masteredCount})
                    </button>
                  </>
                )}
              </div>

              <button 
                onClick={() => onStartStudy(studyMode)}
                className="btn-primary h-12 px-8 flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest shadow-[0_10px_20px_rgba(66,133,244,0.3)] animate-pulse hover:animate-none group"
              >
                <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                Launch Session
              </button>
            </>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Card Creator */}
        <section>
          <div className="glass rounded-[32px] p-8 border-brand-primary/10">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg sm:text-xl font-bold flex items-center gap-3">
                <Plus className="w-5 h-5 text-brand-primary" />
                {editingCardIndex !== null ? 'Edit Card' : (parentCardForProgression ? `Add Progression (Tier ${(parentCardForProgression.tier || 1) + 1})` : 'Creator Mode')}
              </h3>
              
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={handleExport}
                    className="text-xs flex items-center gap-2 bg-white/5 hover:bg-white/10 text-brand-muted hover:text-white px-3 py-1.5 rounded-lg border border-white/5 transition-all"
                  >
                    <Download className="w-3 h-3" />
                    Export CSV
                  </button>

                  <AnimatePresence>
                    {showExportModal && (
                      <>
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
                          onClick={() => setShowExportModal(false)}
                        />
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: 10 }}
                          className="absolute top-full right-0 mt-3 w-56 glass p-4 rounded-[20px] border border-white/10 shadow-2xl z-[70]"
                        >
                          <p className="text-[10px] font-bold text-white mb-3 uppercase tracking-widest text-center">Export Options</p>
                          <div className="flex flex-col gap-2">
                            <button 
                              onClick={() => {
                                downloadFlashcards();
                                setShowExportModal(false);
                              }}
                              className="w-full text-left bg-white/5 hover:bg-white/10 text-brand-muted hover:text-white text-[10px] uppercase tracking-widest font-bold py-2.5 px-3 rounded-xl transition-colors border border-white/5"
                            >
                              Download Flashcards
                            </button>
                            <button 
                              onClick={() => {
                                downloadMcqs();
                                setShowExportModal(false);
                              }}
                              className="w-full text-left bg-white/5 hover:bg-white/10 text-brand-muted hover:text-white text-[10px] uppercase tracking-widest font-bold py-2.5 px-3 rounded-xl transition-colors border border-white/5"
                            >
                              Download Multiple Choice
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                <input 
                  type="file" 
                  accept=".csv" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="text-xs flex items-center gap-2 bg-white/5 hover:bg-white/10 text-brand-muted hover:text-white px-3 py-1.5 rounded-lg border border-white/5 transition-all"
                >
                  <Upload className="w-3 h-3" />
                  {isUploading ? 'Parsing...' : 'Import CSV'}
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {parentCardForProgression && (
                <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-xl p-4 flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-brand-primary mb-1">Building on:</p>
                    <p className="text-sm text-white line-clamp-2">{parentCardForProgression.front}</p>
                  </div>
                  <button type="button" onClick={handleCancelProgression} className="text-brand-muted hover:text-white mt-1 shrink-0 ml-4">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex bg-white/5 p-1.5 rounded-xl flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCardType('flashcard')}
                  className={cn("flex-1 px-2 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors whitespace-nowrap", cardType === 'flashcard' ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-white')}
                >
                  Flashcard
                </button>
                <button
                  type="button"
                  onClick={() => setCardType('mcq')}
                  className={cn("flex-1 px-2 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors whitespace-nowrap", cardType === 'mcq' ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-white')}
                >
                  MCQ
                </button>
                <button
                  type="button"
                  onClick={() => setCardType('multi-select')}
                  className={cn("flex-1 px-2 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors whitespace-nowrap", cardType === 'multi-select' ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-white')}
                >
                  Multi-Select
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCardType('matching');
                    if (matchingPairs.length < 2) {
                      setMatchingPairs([
                        { id: Date.now().toString() + '1', left: '', rights: '' },
                        { id: Date.now().toString() + '2', left: '', rights: '' }
                      ]);
                    }
                  }}
                  className={cn("flex-1 px-2 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors whitespace-nowrap", cardType === 'matching' ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-white')}
                >
                  Matching
                </button>
                <button
                  type="button"
                  onClick={() => setCardType('sequencing')}
                  className={cn("flex-1 px-2 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors whitespace-nowrap", cardType === 'sequencing' ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-white')}
                >
                  Sequencing
                </button>
                <button
                  type="button"
                  onClick={() => setCardType('fill-in-the-blank')}
                  className={cn("flex-1 px-2 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors whitespace-nowrap", cardType === 'fill-in-the-blank' ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-white')}
                >
                  Fill in the Blank
                </button>
              </div>

              <div>
                <label className="block text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-3">
                  {['matching', 'sequencing'].includes(cardType) ? 'Title / Instructions' : 'Front Side (Question)'}
                </label>
                <textarea
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                  placeholder={['matching', 'sequencing'].includes(cardType) ? (cardType === 'matching' ? "Match the countries to their capitals" : "Put the following in the correct order") : "The concept to remember..."}
                  rows={2}
                  className="w-full bg-white/5 border border-brand-border rounded-2xl px-5 py-4 text-white outline-none focus:border-brand-primary/50 transition-colors resize-none custom-scrollbar"
                />
              </div>

              {!['matching', 'multi-select', 'sequencing'].includes(cardType) && (
                <div>
                  <label className="block text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-3">
                    {cardType === 'mcq' ? 'Correct Answer' : 'Back Side (Answer)'}
                  </label>
                  <textarea
                    value={back}
                    onChange={(e) => setBack(e.target.value)}
                    placeholder={cardType === 'mcq' ? "The unequivocally correct answer..." : "The detailed explanation..."}
                    rows={cardType === 'mcq' ? 2 : 3}
                    className="w-full bg-white/5 border border-brand-border rounded-2xl px-5 py-4 text-white outline-none focus:border-brand-primary/50 transition-colors resize-none custom-scrollbar"
                  />
                </div>
              )}

              {(cardType === 'flashcard' || cardType === 'mcq' || cardType === 'fill-in-the-blank') && (
                <div className="space-y-4">
                  <ImageUpload
                    label={cardType === 'flashcard' ? 'Front Image (optional)' : 'Question Image (optional)'}
                    value={imageUrl}
                    onChange={setImageUrl}
                  />
                  {imageUrl && (
                    <input
                      type="text"
                      value={imageCredit}
                      onChange={(e) => setImageCredit(e.target.value)}
                      placeholder="Image credit (optional)"
                      className="w-full bg-white/5 border border-brand-border rounded-2xl px-5 py-3 text-white text-sm outline-none focus:border-brand-primary/50 transition-colors placeholder:text-brand-muted/50"
                    />
                  )}
                  {cardType === 'flashcard' && (
                    <>
                      <ImageUpload
                        label="Back Image (optional)"
                        value={backImageUrl}
                        onChange={setBackImageUrl}
                      />
                      {backImageUrl && (
                        <input
                          type="text"
                          value={backImageCredit}
                          onChange={(e) => setBackImageCredit(e.target.value)}
                          placeholder="Back image credit (optional)"
                          className="w-full bg-white/5 border border-brand-border rounded-2xl px-5 py-3 text-white text-sm outline-none focus:border-brand-primary/50 transition-colors placeholder:text-brand-muted/50"
                        />
                      )}
                    </>
                  )}
                </div>
              )}

              {cardType === 'matching' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <label className="block text-[10px] text-brand-primary uppercase tracking-[0.2em] font-black mb-1 mt-4">
                    Pairs
                  </label>
                  <p className="text-[10px] text-brand-muted mb-4 font-bold border-l-2 border-brand-primary/50 pl-3 py-1 bg-brand-primary/5 rounded-r-lg">
                    Use commas in the "Matches" field to provide multiple correct answers for a term (One-to-Many).
                  </p>
                  <div className="space-y-3">
                    {matchingPairs.map((pair, idx) => (
                      <div key={pair.id} className="flex gap-2 items-center">
                        <input
                          value={pair.left}
                          onChange={(e) => {
                            const newPairs = [...matchingPairs];
                            newPairs[idx].left = e.target.value;
                            setMatchingPairs(newPairs);
                          }}
                          placeholder="Term"
                          className="flex-1 min-w-0 bg-white/5 border border-brand-border rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50"
                        />
                        <input
                          value={pair.rights}
                          onChange={(e) => {
                            const newPairs = [...matchingPairs];
                            newPairs[idx].rights = e.target.value;
                            setMatchingPairs(newPairs);
                          }}
                          placeholder="Matches (comma separated)"
                          className="flex-1 min-w-0 bg-white/5 border border-brand-border rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50"
                        />
                        <button 
                          type="button"
                          disabled={matchingPairs.length <= 2}
                          onClick={() => setMatchingPairs(matchingPairs.filter((_, i) => i !== idx))}
                          className={cn("w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl transition-colors", matchingPairs.length <= 2 ? "opacity-30 cursor-not-allowed text-brand-muted" : "bg-white/5 text-brand-muted hover:bg-red-500/20 hover:text-red-400")}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button 
                      type="button"
                      onClick={() => setMatchingPairs([...matchingPairs, { id: Date.now().toString(), left: '', rights: '' }])}
                      className="text-xs mt-2 flex items-center justify-center border border-dashed border-white/20 hover:border-brand-primary/50 gap-2 text-brand-muted hover:text-brand-primary w-full py-3 rounded-xl transition-all"
                    >
                      <Plus className="w-4 h-4" /> Add Pair
                    </button>
                  </div>
                </motion.div>
              )}

              {cardType === 'mcq' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <label className="block text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-3 mt-6">
                    Distractors (One per line)
                  </label>
                  <textarea
                    value={distractors}
                    onChange={(e) => setDistractors(e.target.value)}
                    placeholder="Wrong answer 1&#10;Wrong answer 2&#10;Wrong answer 3"
                    rows={3}
                    className="w-full bg-white/5 border border-brand-border rounded-2xl px-5 py-4 text-white outline-none focus:border-brand-primary/50 transition-colors resize-none custom-scrollbar uppercase-placeholder"
                  />
                  <label className="block text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-3 mt-6">
                    Distractor Explanations (One per line, matches above)
                  </label>
                  <textarea
                    value={distractorExplanations}
                    onChange={(e) => setDistractorExplanations(e.target.value)}
                    placeholder="Explanation for wrong answer 1&#10;Explanation for wrong answer 2&#10;Explanation for wrong answer 3"
                    rows={3}
                    className="w-full bg-white/5 border border-brand-border rounded-2xl px-5 py-4 text-white outline-none focus:border-brand-primary/50 transition-colors resize-none custom-scrollbar"
                  />
                  <label className="block text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-3 mt-6">
                    Correct Answer Explanation
                  </label>
                  <textarea
                    value={correctAnswerExplanation}
                    onChange={(e) => setCorrectAnswerExplanation(e.target.value)}
                    placeholder="Why is the right answer correct?"
                    rows={2}
                    className="w-full bg-emerald-500/5 border border-brand-border rounded-2xl px-5 py-4 text-white outline-none focus:border-brand-primary/50 transition-colors resize-none custom-scrollbar"
                  />
                  <label className="block text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-3 mt-6">
                    Optional Hint
                  </label>
                  <textarea
                    value={hint}
                    onChange={(e) => setHint(e.target.value)}
                    placeholder="Provide a hint if the user gets stuck..."
                    rows={2}
                    className="w-full bg-white/5 border border-brand-border rounded-2xl px-5 py-4 text-white outline-none focus:border-brand-primary/50 transition-colors resize-none custom-scrollbar"
                  />
                </motion.div>
              )}

              {cardType === 'multi-select' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <label className="block text-[10px] text-brand-primary uppercase tracking-[0.2em] font-black mb-1 mt-4">
                    Options
                  </label>
                  <p className="text-[10px] text-brand-muted mb-4 font-bold border-l-2 border-brand-primary/50 pl-3 py-1 bg-brand-primary/5 rounded-r-lg">
                    Check the boxes to mark the correct answers. You need at least one correct option.
                  </p>
                  <div className="space-y-3">
                    {multiSelectOptions.map((opt, idx) => (
                      <div key={opt.id} className="flex gap-2 items-center">
                        <label className="flex items-center gap-2 cursor-pointer bg-white/5 p-2 rounded-xl text-brand-muted hover:text-white">
                          <input 
                            type="checkbox" 
                            checked={opt.isCorrect} 
                            onChange={(e) => {
                              const newOpts = [...multiSelectOptions];
                              newOpts[idx].isCorrect = e.target.checked;
                              setMultiSelectOptions(newOpts);
                            }}
                            className="w-4 h-4 rounded appearance-none border border-white/20 checked:bg-brand-primary checked:border-transparent flex-shrink-0 relative after:content-[''] checked:after:absolute checked:after:inset-0 checked:after:bg-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22black%22%20stroke-width=%224%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22><polyline%20points=%2220%206%209%2017%204%2012%22></polyline></svg>')] checked:after:bg-no-repeat checked:after:bg-center checked:after:bg-[length:10px_10px]"
                          />
                        </label>
                        <input
                          value={opt.text}
                          onChange={(e) => {
                            const newOpts = [...multiSelectOptions];
                            newOpts[idx].text = e.target.value;
                            setMultiSelectOptions(newOpts);
                          }}
                          placeholder={`Option ${idx + 1}`}
                          className="flex-1 min-w-0 bg-white/5 border border-brand-border rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50"
                        />
                        <button 
                          type="button"
                          disabled={multiSelectOptions.length <= 2}
                          onClick={() => setMultiSelectOptions(multiSelectOptions.filter((_, i) => i !== idx))}
                          className={cn("w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl transition-colors", multiSelectOptions.length <= 2 ? "opacity-30 cursor-not-allowed text-brand-muted" : "bg-white/5 text-brand-muted hover:bg-red-500/20 hover:text-red-400")}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button 
                      type="button"
                      onClick={() => setMultiSelectOptions([...multiSelectOptions, { id: Date.now().toString(), text: '', isCorrect: false }])}
                      className="text-xs mt-2 flex items-center justify-center border border-dashed border-white/20 hover:border-brand-primary/50 gap-2 text-brand-muted hover:text-brand-primary w-full py-3 rounded-xl transition-all"
                    >
                      <Plus className="w-4 h-4" /> Add Option
                    </button>
                  </div>
                </motion.div>
              )}

              {cardType === 'sequencing' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <label className="block text-[10px] text-brand-primary uppercase tracking-[0.2em] font-black mb-1 mt-4">
                    Sequence Items
                  </label>
                  <p className="text-[10px] text-brand-muted mb-4 font-bold border-l-2 border-brand-primary/50 pl-3 py-1 bg-brand-primary/5 rounded-r-lg">
                    Add the items here in the EXACT correct order. They will be shuffled for the user.
                  </p>
                  <div className="space-y-3">
                    {sequenceItems.map((item, idx) => (
                      <div key={item.id} className="flex gap-2 items-center">
                        <div className="w-8 h-8 rounded-full bg-white/5 text-brand-muted flex items-center justify-center text-xs font-black shadow-sm shrink-0">
                          {idx + 1}
                        </div>
                        <input
                          value={item.text}
                          onChange={(e) => {
                            const newItems = [...sequenceItems];
                            newItems[idx].text = e.target.value;
                            setSequenceItems(newItems);
                          }}
                          placeholder={`Item ${idx + 1}`}
                          className="flex-1 min-w-0 bg-white/5 border border-brand-border rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50"
                        />
                        <button 
                          type="button"
                          disabled={sequenceItems.length <= 2}
                          onClick={() => setSequenceItems(sequenceItems.filter((_, i) => i !== idx))}
                          className={cn("w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl transition-colors", sequenceItems.length <= 2 ? "opacity-30 cursor-not-allowed text-brand-muted" : "bg-white/5 text-brand-muted hover:bg-red-500/20 hover:text-red-400")}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button 
                      type="button"
                      onClick={() => setSequenceItems([...sequenceItems, { id: Date.now().toString(), text: '' }])}
                      className="text-xs mt-2 flex items-center justify-center border border-dashed border-white/20 hover:border-brand-primary/50 gap-2 text-brand-muted hover:text-brand-primary w-full py-3 rounded-xl transition-all"
                    >
                      <Plus className="w-4 h-4" /> Add Item
                    </button>
                  </div>
                </motion.div>
              )}

              <div>
                <label className="block text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-3 mt-6">
                  Explanation <span className="text-brand-muted/40 normal-case tracking-normal">(shown after incorrect answers)</span>
                </label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Explain why the answer is correct..."
                  rows={2}
                  className="w-full bg-white/5 border border-brand-border rounded-2xl px-5 py-4 text-white outline-none focus:border-brand-primary/50 transition-colors resize-none custom-scrollbar"
                />
              </div>

              <div className="flex gap-3">
                {editingCardIndex !== null && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="w-1/3 glass hover:bg-white/5 border border-white/10 h-14 rounded-[16px] transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!front.trim() || 
                           (!['matching', 'multi-select', 'sequencing'].includes(cardType) && !back.trim()) || 
                           (cardType === 'mcq' && !distractors.trim()) || 
                           (cardType === 'matching' && matchingPairs.filter(p => p.left.trim() && p.rights.trim()).length < 2) ||
                           (cardType === 'multi-select' && (multiSelectOptions.filter(o => o.text.trim()).length < 2 || !multiSelectOptions.some(o => o.isCorrect))) ||
                           (cardType === 'sequencing' && sequenceItems.filter(i => i.text.trim()).length < 2)
                           }
                  className={cn(
                    "btn-primary h-14 disabled:opacity-50",
                    editingCardIndex !== null ? "w-2/3" : "w-full"
                  )}
                >
                  {editingCardIndex !== null ? 'Update Card' : 'Assemble Card'}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Card List */}
        <section>
          <h3 className="text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-6 flex items-center justify-between">
            Knowledge Matrix ({island.cards.length} cards)
          </h3>
          
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {island.cards.length === 0 ? (
              <div className="h-40 rounded-[32px] border border-dashed border-brand-border flex items-center justify-center text-brand-muted/20">
                <p>No cards created yet</p>
              </div>
            ) : (
              displayCards.map(({ card, originalIdx: idx }, displayIdx) => (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: displayIdx * 0.05 }}
                  key={idx}
                  onClick={() => handleEditCard(idx)}
                  style={{ marginLeft: card.tier && card.tier > 1 ? `${(card.tier - 1) * 24}px` : undefined }}
                  className={cn(
                    "glass rounded-2xl p-6 border-white/5 group relative cursor-pointer hover:border-brand-primary/30 transition-colors",
                    editingCardIndex === idx && "border-brand-primary bg-brand-primary/5"
                  )}
                >
                  {card.tier && card.tier > 1 && (
                    <div className="absolute -left-4 top-1/2 -mt-4 w-4 h-8 border-l-2 border-b-2 border-white/20 rounded-bl-lg pointer-events-none" />
                  )}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      {card.type === 'mcq' ? (
                        <div className={cn("text-[9px] uppercase font-black", card.needsWork ? "text-amber-400" : "text-brand-primary")}>MCQ</div>
                      ) : card.type === 'fill-in-the-blank' ? (
                        <Type className={cn("w-4 h-4", card.needsWork ? "text-amber-400" : "text-purple-400")} />
                      ) : card.type === 'multi-select' ? (
                        <CheckSquare className={cn("w-4 h-4", card.needsWork ? "text-amber-400" : "text-blue-400")} />
                      ) : card.type === 'sequencing' ? (
                        <ListOrdered className={cn("w-4 h-4", card.needsWork ? "text-amber-400" : "text-cyan-400")} />
                      ) : (
                        <CreditCard className={cn("w-4 h-4", card.needsWork ? "text-amber-400" : "text-brand-muted")} />
                      )}
                    </div>
                    {card.tier && card.tier > 1 && (
                      <div className="absolute top-2 right-2 text-[8px] font-black uppercase tracking-widest bg-white/10 px-1.5 py-0.5 rounded text-white/50">
                        T{card.tier}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <p className="font-bold text-sm mb-1 truncate">{card.front}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          {card.totalAnswers != null && card.totalAnswers > 0 && (
                            <span className={cn(
                              "text-[9px] font-bold tabular-nums",
                              (card.totalCorrect ?? 0) / card.totalAnswers < 0.4 ? "text-red-400/70" :
                              (card.totalCorrect ?? 0) / card.totalAnswers < 0.7 ? "text-amber-400/70" :
                              "text-emerald-400/70"
                            )}>
                              {Math.round((card.totalCorrect ?? 0) / card.totalAnswers * 100)}%
                            </span>
                          )}
                          {progressTrackingMode !== 'srs' && card.needsWork && (
                            <span className="text-[9px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 tracking-wider font-bold">STRUGGLING</span>
                          )}
                          {onDeleteCard && (
                            <div className="flex items-center">
                              <AnimatePresence mode="wait">
                                {deletingCardIndex === idx ? (
                                  <motion.div
                                    key="confirm"
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-xl px-2 py-1"
                                  >
                                    <span className="text-[9px] font-black text-red-500 uppercase tracking-tighter hidden sm:inline">Delete?</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteCard(idx);
                                        setDeletingCardIndex(null);
                                        if (editingCardIndex === idx) handleCancelEdit();
                                      }}
                                      className="text-red-500 hover:text-red-400 p-0.5"
                                      title="Confirm Delete"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeletingCardIndex(null);
                                      }}
                                      className="text-brand-muted hover:text-white p-0.5"
                                      title="Cancel"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </motion.div>
                                ) : (
                                  <motion.button
                                    key="delete"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeletingCardIndex(idx);
                                    }}
                                    className="text-brand-muted hover:text-red-400 transition-colors opacity-40 group-hover:opacity-100 p-1"
                                    title="Delete Card"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </motion.button>
                                )}
                              </AnimatePresence>
                              {onMoveCard && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMovingCardIndex(idx);
                                  }}
                                  className="text-brand-muted hover:text-white transition-colors opacity-40 group-hover:opacity-100 p-1"
                                  title="Move Card to Another Island"
                                >
                                  <Move className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddProgression(idx);
                                }}
                                className="text-brand-muted hover:text-brand-primary transition-colors opacity-40 group-hover:opacity-100 p-1"
                                title="Add Progression"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-brand-muted text-xs line-clamp-2">{card.back}</p>
                      {card.type === 'mcq' && card.options && (
                        <p className="text-[10px] text-brand-muted/50 mt-2 truncate">Options: {card.options.length}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Move Card Modal */}
      <AnimatePresence>
        {movingCardIndex !== null && onMoveCard && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
              onClick={() => setMovingCardIndex(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md glass p-8 rounded-[32px] border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.8)] z-[101]"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-3 text-white">
                  <Move className="w-5 h-5 text-brand-primary" />
                  Move Card
                </h3>
                <button onClick={() => setMovingCardIndex(null)} className="p-2 text-brand-muted hover:text-white rounded-xl bg-white/5 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-brand-muted mb-6 leading-relaxed">
                Choose the destination island for: <br />
                <span className="text-white font-bold italic line-clamp-1 mt-1">"{island.cards[movingCardIndex].front}"</span>
              </p>

              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {allIslands.filter(i => i.id !== island.id).length === 0 ? (
                  <p className="text-xs text-brand-muted text-center py-8">No other islands found. Create another island first!</p>
                ) : (
                  allIslands.filter(i => i.id !== island.id).map(targetIsland => (
                    <button
                      key={targetIsland.id}
                      onClick={() => {
                        onMoveCard(movingCardIndex, targetIsland.id);
                        setMovingCardIndex(null);
                      }}
                      className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-brand-primary/50 hover:bg-white/10 transition-all text-left group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white mb-0.5 truncate group-hover:text-brand-primary transition-colors">{targetIsland.name}</p>
                        <p className="text-[10px] text-brand-muted uppercase tracking-widest leading-none">
                          {targetIsland.cards.length} Cards
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-brand-muted group-hover:bg-brand-primary/20 group-hover:text-brand-primary transition-all">
                        <Check className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
