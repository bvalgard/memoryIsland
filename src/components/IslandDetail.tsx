import { useState, useRef, useMemo } from 'react';
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Trash2, CreditCard, Play, Upload, Share2, Globe, Users, Lock, Check, Download, X, ArrowUp, Type, CheckSquare, ListOrdered, Move, Pencil, Eye, BookOpen, Shuffle } from 'lucide-react';
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
  currentUserId?: string;
  onAddCollaborator?: (uid: string) => Promise<void>;
  onRemoveCollaborator?: (uid: string) => Promise<void>;
}

export default function IslandDetail({ island, allIslands, archipelagos, onBack, onAddCard, onUpdateCard, onDeleteCard, onMoveCard, onDeleteIsland, onAddCards, onStartStudy, onShare, onUnshare, onUpdateIsland, progressTrackingMode = 'srs', friends = [], fetchProfilesByUids = async () => [], currentUserId, onAddCollaborator, onRemoveCollaborator }: IslandDetailProps) {
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
  const [showCollaboratorPanel, setShowCollaboratorPanel] = useState(false);
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<UserProfile[]>([]);
  const [friendProfilesForInvite, setFriendProfilesForInvite] = useState<UserProfile[]>([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);
  const [showCollabInvite, setShowCollabInvite] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [movingCardIndex, setMovingCardIndex] = useState<number | null>(null);
  const [cardType, setCardType] = useState<Card['type']>('flashcard');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [hint, setHint] = useState('');
  const [explanation, setExplanation] = useState('');
  const [matchingPairs, setMatchingPairs] = useState<{ id: string; left: string; rights: string }[]>([{ id: Date.now().toString(), left: '', rights: '' }]);
  // Unified MCQ options — one correct marker per option handles both single-answer (radio-like)
  // and multi-answer (checkbox-like) in one builder. The number of marked-correct options at
  // save time determines which study-session interaction the card gets.
  const [mcqInlineOptions, setMcqInlineOptions] = useState<{ id: string; text: string; isCorrect: boolean; explanation: string }[]>([
    { id: Date.now().toString() + '1', text: '', isCorrect: true, explanation: '' },
    { id: Date.now().toString() + '2', text: '', isCorrect: false, explanation: '' },
  ]);
  const [mcqLockOrder, setMcqLockOrder] = useState(false);
  const [expandedMcqExp, setExpandedMcqExp] = useState<Set<string>>(new Set());
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
  const [previewCardIndex, setPreviewCardIndex] = useState<number | null>(null);
  const [previewFlipped, setPreviewFlipped] = useState(false);
  const [previewSelectedOption, setPreviewSelectedOption] = useState<string | null>(null);
  const [previewSelectedOptions, setPreviewSelectedOptions] = useState<Set<string>>(new Set());
  const [previewMultiSubmitted, setPreviewMultiSubmitted] = useState(false);
  const [previewFibInput, setPreviewFibInput] = useState('');
  const [previewFibSubmitted, setPreviewFibSubmitted] = useState(false);
  const [previewShuffledOptions, setPreviewShuffledOptions] = useState<string[]>([]);
  const [previewSequenceOrder, setPreviewSequenceOrder] = useState<number[]>([]);
  const [previewSequenceSubmitted, setPreviewSequenceSubmitted] = useState(false);
  const [parentCardForProgression, setParentCardForProgression] = useState<Card | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScenarioMode, setIsScenarioMode] = useState(false);
  const [scenarioPassage, setScenarioPassage] = useState('');
  const [scenarioQuestions, setScenarioQuestions] = useState<Card[]>([]);
  const [scenarioSubFormOpen, setScenarioSubFormOpen] = useState(false);
  const islandPrivacyState = island.approvalStatus === 'pending'
    ? 'pending'
    : island.approvalStatus === 'approved' && island.isPublic
      ? 'public'
      : (island.sharedWith && island.sharedWith.length > 0)
        ? 'shared'
        : 'private';

  const isCollaborative = island.isCollaborative === true;
  const isCollabOwner = isCollaborative && island.ownerId === currentUserId;
  const isCollabMember = isCollaborative && !isCollabOwner;

  const openCollaboratorPanel = async () => {
    setShowCollaboratorPanel(true);
    const collabUids = island.collaborators || [];
    if (collabUids.length > 0) {
      setLoadingCollaborators(true);
      const profiles = await fetchProfilesByUids(collabUids);
      setCollaboratorProfiles(profiles);
      setLoadingCollaborators(false);
    }
  };

  const openCollabInvite = async () => {
    setShowCollabInvite(true);
    if (friends.length > 0 && friendProfilesForInvite.length === 0) {
      const profiles = await fetchProfilesByUids(friends);
      setFriendProfilesForInvite(profiles);
    }
  };
  
  const resetCardForm = () => {
    setEditingCardIndex(null);
    setParentCardForProgression(null);
    setFront('');
    setBack('');
    setHint('');
    setExplanation('');
    setImageUrl(undefined);
    setBackImageUrl(undefined);
    setImageCredit('');
    setBackImageCredit('');
    setMatchingPairs([{ id: Date.now().toString(), left: '', rights: '' }]);
    setMcqInlineOptions([
      { id: Date.now().toString() + '1', text: '', isCorrect: true, explanation: '' },
      { id: Date.now().toString() + '2', text: '', isCorrect: false, explanation: '' },
    ]);
    setMcqLockOrder(false);
    setExpandedMcqExp(new Set());
    setSequenceItems([
      { id: Date.now().toString() + '1', text: '' },
      { id: Date.now().toString() + '2', text: '' }
    ]);
    setIsScenarioMode(false);
    setScenarioPassage('');
    setScenarioQuestions([]);
    setScenarioSubFormOpen(false);
  };
  
  const handleAddScenarioQuestion = () => {
    if (!front.trim()) return;
    if (!['matching', 'sequencing', 'mcq'].includes(cardType || '') && !back.trim()) return;

    const q: Card = {
      id: Math.random().toString(36).substring(2, 11),
      front: front.trim(),
      back: back.trim(),
      type: cardType,
    };

    if (hint.trim()) q.hint = hint.trim();
    if (explanation.trim()) q.explanation = explanation.trim();
    if (imageUrl) q.imageUrl = imageUrl;
    if (backImageUrl) q.backImageUrl = backImageUrl;

    if (cardType === 'mcq') {
      const valid = mcqInlineOptions.filter(o => o.text.trim());
      if (valid.length < 2) { alert('MCQ needs at least 2 options.'); return; }
      const correctOpts = valid.filter(o => o.isCorrect);
      if (correctOpts.length === 0) { alert('MCQ requires at least one correct answer.'); return; }
      // Always write correctOptions so StudySession can distinguish single vs multi-answer.
      // Also write back = first correct answer for legacy compat.
      q.correctOptions = correctOpts.map(o => o.text.trim());
      q.back = correctOpts[0].text.trim();
      q.options = valid.map(o => o.text.trim());
      if (mcqLockOrder) q.lockOptionOrder = true;
      const exps: Record<string, string> = {};
      valid.forEach(o => { if (o.explanation.trim()) exps[o.text.trim()] = o.explanation.trim(); });
      if (Object.keys(exps).length) q.explanations = exps;
    } else if (cardType === 'matching') {
      const validPairs = matchingPairs.filter(p => p.left.trim() && p.rights.trim())
        .map(p => ({ id: p.id, left: p.left.trim(), rights: p.rights.split(',').map(r => r.trim()).filter(r => r) }));
      if (validPairs.length < 2) { alert('Matching requires at least 2 pairs.'); return; }
      q.pairs = validPairs;
      q.back = 'Matching Exercise';
    } else if (cardType === 'sequencing') {
      const valid = sequenceItems.filter(i => i.text.trim());
      if (valid.length < 2) { alert('Sequencing needs at least 2 items.'); return; }
      q.options = valid.map(i => i.text.trim());
      q.back = 'Sequencing Exercise';
    }

    setScenarioQuestions(prev => [...prev, q]);
    setFront('');
    setBack('');
    setHint('');
    setExplanation('');
    setImageUrl(undefined);
    setBackImageUrl(undefined);
    setMatchingPairs([{ id: Date.now().toString(), left: '', rights: '' }]);
    setMcqInlineOptions([
      { id: Date.now().toString() + '1', text: '', isCorrect: true, explanation: '' },
      { id: Date.now().toString() + '2', text: '', isCorrect: false, explanation: '' },
    ]);
    setMcqLockOrder(false);
    setExpandedMcqExp(new Set());
    setSequenceItems([
      { id: Date.now().toString() + '1', text: '' },
      { id: Date.now().toString() + '2', text: '' }
    ]);
    setScenarioSubFormOpen(false);
  };

  const handleScenarioSubmit = () => {
    if (!scenarioPassage.trim() || scenarioQuestions.length === 0) return;
    const sid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 11);
    const cards = scenarioQuestions.map((q, i) => ({
      ...q,
      scenarioId: sid,
      scenarioText: scenarioPassage.trim(),
      scenarioOrder: i + 1,
    }));
    onAddCards(cards);
    resetCardForm();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isScenarioMode) return;
    if (front.trim() && (back.trim() || ['matching', 'multi-select', 'sequencing', 'mcq'].includes(cardType))) {
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
        const valid = mcqInlineOptions.filter(o => o.text.trim());
        if (valid.length < 2) { alert('MCQ needs at least 2 options.'); return; }
        const correctOpts = valid.filter(o => o.isCorrect);
        if (correctOpts.length === 0) { alert('MCQ requires at least one correct answer.'); return; }
        // Always write correctOptions so StudySession can distinguish single vs multi-answer.
        // Also write back = first correct answer for legacy compat with old single-answer rendering.
        newCard.correctOptions = correctOpts.map(o => o.text.trim());
        newCard.back = correctOpts[0].text.trim();
        newCard.options = valid.map(o => o.text.trim());
        if (mcqLockOrder) newCard.lockOptionOrder = true;
        const exps: Record<string, string> = {};
        valid.forEach(o => { if (o.explanation.trim()) exps[o.text.trim()] = o.explanation.trim(); });
        if (Object.keys(exps).length) newCard.explanations = exps;
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
        newCard.back = 'Matching Exercise';
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
        const existingCard = island.cards[editingCardIndex];
        if (existingCard.scenarioId) {
          newCard.scenarioId = existingCard.scenarioId;
          newCard.scenarioOrder = existingCard.scenarioOrder;
          newCard.scenarioText = scenarioPassage.trim() || existingCard.scenarioText;
          if (scenarioPassage.trim() && scenarioPassage.trim() !== (existingCard.scenarioText || '')) {
            island.cards.forEach((c, i) => {
              if (i !== editingCardIndex && c.scenarioId === existingCard.scenarioId) {
                onUpdateCard!(i, { ...c, scenarioText: scenarioPassage.trim() });
              }
            });
          }
        }
        onUpdateCard(editingCardIndex, newCard);
      } else {
        onAddCard(newCard);
      }

      resetCardForm();
    }
  };

  const handleEditCard = (idx: number) => {
    const card = island.cards[idx];
    setIsScenarioMode(false);
    setScenarioQuestions([]);
    setScenarioSubFormOpen(false);
    setScenarioPassage(card.scenarioText || '');
    setEditingCardIndex(idx);
    setParentCardForProgression(null);
    // Treat legacy multi-select as unified mcq — editing it will re-save it as mcq type.
    setCardType(card.type === 'multi-select' ? 'mcq' : (card.type || 'flashcard'));
    setFront(card.front);
    setBack(card.back);
    setHint(card.hint || '');
    setExplanation(card.explanation || '');
    setImageUrl(card.imageUrl);
    setBackImageUrl(card.backImageUrl);
    setImageCredit(card.imageCredit || '');
    setBackImageCredit(card.backImageCredit || '');
    if ((card.type === 'mcq' || card.type === 'multi-select') && card.options) {
      const opts = card.options.map(opt => ({
        id: Date.now().toString() + Math.random(),
        text: opt,
        // Legacy MCQ: back holds the single correct answer (no correctOptions).
        // New MCQ and multi-select: use correctOptions array.
        isCorrect: card.correctOptions?.length
          ? card.correctOptions.includes(opt)
          : opt === card.back,
        explanation: card.explanations?.[opt] || '',
      }));
      setMcqInlineOptions(opts);
      setMcqLockOrder(card.lockOptionOrder || false);
      setExpandedMcqExp(new Set(opts.filter(o => o.explanation).map(o => o.id)));
    } else {
      setMcqInlineOptions([
        { id: Date.now().toString() + '1', text: '', isCorrect: true, explanation: '' },
        { id: Date.now().toString() + '2', text: '', isCorrect: false, explanation: '' },
      ]);
      setMcqLockOrder(false);
      setExpandedMcqExp(new Set());
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

  const switchCardType = (type: Card['type']) => {
    setCardType(type);
    if (isScenarioMode && !scenarioSubFormOpen) {
      setIsScenarioMode(false);
      setScenarioPassage('');
      setScenarioQuestions([]);
    }
  };

  const openCardPreview = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    const card = island.cards[idx];
    const opts = card.options || [];
    setPreviewShuffledOptions([...opts].sort(() => Math.random() - 0.5));
    setPreviewSequenceOrder(opts.map((_, i) => i).sort(() => Math.random() - 0.5));
    setPreviewCardIndex(idx);
    setPreviewFlipped(false);
    setPreviewSelectedOption(null);
    setPreviewSelectedOptions(new Set());
    setPreviewMultiSubmitted(false);
    setPreviewFibInput('');
    setPreviewFibSubmitted(false);
    setPreviewSequenceSubmitted(false);
  };

  const closeCardPreview = () => setPreviewCardIndex(null);

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
                
                {isCollaborative && (
                  <div className="relative">
                    <button
                      onClick={() => isCollabOwner ? openCollaboratorPanel() : setShowCollaboratorPanel(true)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30"
                      title={isCollabOwner ? "Manage collaborators" : "Collaborative island"}
                    >
                      <Users className="w-3 h-3" />
                      {isCollabOwner ? `Crew (${(island.collaborators || []).length})` : 'Crew'}
                    </button>

                    <AnimatePresence>
                      {showCollaboratorPanel && (
                        <>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
                            onClick={() => { setShowCollaboratorPanel(false); setShowCollabInvite(false); }}
                          />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            className="absolute top-full left-0 mt-3 w-72 glass p-5 rounded-[24px] border border-violet-500/20 shadow-2xl z-[70] bg-violet-500/5 backdrop-blur-xl"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <p className="text-xs font-bold text-white">Crew</p>
                              <button onClick={() => { setShowCollaboratorPanel(false); setShowCollabInvite(false); }} className="text-brand-muted hover:text-white">
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {isCollabMember && (
                              <p className="text-[10px] text-brand-muted mb-3">
                                This is a collaborative island. All crew members can add and edit cards.
                              </p>
                            )}

                            {loadingCollaborators ? (
                              <p className="text-[10px] text-brand-muted">Loading crew...</p>
                            ) : (
                              <div className="space-y-2 mb-4">
                                {/* Island owner */}
                                <div className="flex items-center justify-between py-1.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center">
                                      <Users className="w-3 h-3 text-violet-300" />
                                    </div>
                                    <span className="text-[11px] text-white font-medium">
                                      {island.authorName || 'Owner'}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-violet-300 font-black uppercase tracking-widest">Owner</span>
                                </div>
                                {/* Collaborators */}
                                {collaboratorProfiles.map((profile) => (
                                  <div key={profile.uid} className="flex items-center justify-between py-1.5">
                                    <div className="flex items-center gap-2">
                                      {profile.photoURL ? (
                                        <img src={profile.photoURL} className="w-6 h-6 rounded-full object-cover" />
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white">
                                          {profile.displayName?.[0]?.toUpperCase() || '?'}
                                        </div>
                                      )}
                                      <span className="text-[11px] text-white">{profile.displayName}</span>
                                    </div>
                                    {isCollabOwner && onRemoveCollaborator && (
                                      <button
                                        onClick={async () => {
                                          await onRemoveCollaborator(profile.uid);
                                          setCollaboratorProfiles(prev => prev.filter(p => p.uid !== profile.uid));
                                        }}
                                        className="text-brand-muted hover:text-red-400 transition-colors"
                                        title="Remove from crew"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                {(island.collaborators || []).length === 0 && (
                                  <p className="text-[10px] text-brand-muted">No crew members yet.</p>
                                )}
                              </div>
                            )}

                            {isCollabOwner && !showCollabInvite && (
                              <button
                                onClick={openCollabInvite}
                                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-violet-500/20 text-violet-300 text-[10px] font-black uppercase tracking-widest hover:bg-violet-500/30 transition-colors border border-violet-500/20"
                              >
                                <Plus className="w-3 h-3" />
                                Invite to crew
                              </button>
                            )}

                            {isCollabOwner && showCollabInvite && (
                              <div className="mt-2">
                                <p className="text-[10px] text-brand-muted mb-2">Select a friend to add:</p>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                  {friendProfilesForInvite
                                    .filter(p => !(island.collaborators || []).includes(p.uid))
                                    .map((profile) => (
                                      <button
                                        key={profile.uid}
                                        onClick={async () => {
                                          if (!onAddCollaborator) return;
                                          await onAddCollaborator(profile.uid);
                                          setCollaboratorProfiles(prev => [...prev, profile]);
                                          setShowCollabInvite(false);
                                        }}
                                        className="w-full flex items-center gap-2 py-1.5 px-2 rounded-xl hover:bg-white/5 text-left transition-colors"
                                      >
                                        {profile.photoURL ? (
                                          <img src={profile.photoURL} className="w-6 h-6 rounded-full object-cover shrink-0" />
                                        ) : (
                                          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                                            {profile.displayName?.[0]?.toUpperCase() || '?'}
                                          </div>
                                        )}
                                        <span className="text-[11px] text-white">{profile.displayName}</span>
                                      </button>
                                    ))}
                                  {friendProfilesForInvite.filter(p => !(island.collaborators || []).includes(p.uid)).length === 0 && (
                                    <p className="text-[10px] text-brand-muted">All friends are already in the crew.</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {onDeleteIsland && !isCollabMember && (
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
                            <p className="text-[10px] text-brand-muted leading-relaxed mb-2">
                              This will permanently sink <span className="font-bold text-white">{island.name}</span>. This action cannot be undone. Are you sure?
                            </p>
                            {isCollabOwner && (island.collaborators || []).length > 0 && (
                              <p className="text-[10px] text-amber-400/90 leading-relaxed mb-2">
                                This is a crew island — deleting it removes it for all {(island.collaborators || []).length} crew member{(island.collaborators || []).length !== 1 ? 's' : ''} too.
                              </p>
                            )}
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
                  onClick={() => switchCardType('flashcard')}
                  className={cn("flex-1 px-2 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors whitespace-nowrap", !isScenarioMode && cardType === 'flashcard' ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-white')}
                >
                  Flashcard
                </button>
                <button
                  type="button"
                  onClick={() => switchCardType('mcq')}
                  className={cn("flex-1 px-2 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors whitespace-nowrap", !isScenarioMode && cardType === 'mcq' ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-white')}
                >
                  MCQ
                </button>
                {/* Multi-Select merged into MCQ: mark multiple options correct in the MCQ builder */}
                <button
                  type="button"
                  onClick={() => {
                    switchCardType('matching');
                    if (matchingPairs.length < 2) {
                      setMatchingPairs([
                        { id: Date.now().toString() + '1', left: '', rights: '' },
                        { id: Date.now().toString() + '2', left: '', rights: '' }
                      ]);
                    }
                  }}
                  className={cn("flex-1 px-2 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors whitespace-nowrap", !isScenarioMode && cardType === 'matching' ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-white')}
                >
                  Matching
                </button>
                <button
                  type="button"
                  onClick={() => switchCardType('sequencing')}
                  className={cn("flex-1 px-2 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors whitespace-nowrap", !isScenarioMode && cardType === 'sequencing' ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-white')}
                >
                  Sequencing
                </button>
                <button
                  type="button"
                  onClick={() => switchCardType('fill-in-the-blank')}
                  className={cn("flex-1 px-2 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors whitespace-nowrap", !isScenarioMode && cardType === 'fill-in-the-blank' ? 'bg-brand-primary text-white' : 'text-brand-muted hover:text-white')}
                >
                  Fill in the Blank
                </button>
                <button
                  type="button"
                  onClick={() => { resetCardForm(); setIsScenarioMode(true); }}
                  className={cn("flex-1 px-2 py-2 text-[10px] sm:text-xs font-bold rounded-lg transition-colors whitespace-nowrap", isScenarioMode ? 'bg-sky-500 text-white' : 'text-brand-muted hover:text-white')}
                >
                  Scenario
                </button>
              </div>

              {/* Scenario creation mode */}
              {isScenarioMode && !scenarioSubFormOpen && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] text-sky-400 uppercase tracking-[0.2em] font-black mb-3">
                      Scenario / Passage
                    </label>
                    <textarea
                      value={scenarioPassage}
                      onChange={e => setScenarioPassage(e.target.value)}
                      placeholder="Describe the clinical scenario, vignette, or passage the questions will reference..."
                      rows={5}
                      className="w-full bg-sky-500/5 border border-sky-500/20 rounded-2xl px-5 py-4 text-white outline-none focus:border-sky-500/50 transition-colors resize-none custom-scrollbar"
                    />
                  </div>
                  {scenarioQuestions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium">Questions Added</p>
                      {scenarioQuestions.map((q, i) => (
                        <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                          <span className="text-[10px] font-black text-sky-400 uppercase shrink-0">Q{i + 1}</span>
                          <p className="text-sm text-white/70 flex-1 truncate">{q.front}</p>
                          <button type="button" onClick={() => setScenarioQuestions(prev => prev.filter((_, j) => j !== i))} className="text-brand-muted hover:text-red-400 transition-colors shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setScenarioSubFormOpen(true)}
                    className="w-full flex items-center justify-center gap-2 border border-dashed border-sky-500/30 hover:border-sky-500/60 text-sky-400/70 hover:text-sky-400 py-3 rounded-xl transition-all text-sm font-bold"
                  >
                    <Plus className="w-4 h-4" /> Add Question
                  </button>
                  <button
                    type="button"
                    onClick={handleScenarioSubmit}
                    disabled={!scenarioPassage.trim() || scenarioQuestions.length === 0}
                    className="btn-primary h-14 w-full disabled:opacity-50"
                  >
                    Save Scenario Group ({scenarioQuestions.length} question{scenarioQuestions.length !== 1 ? 's' : ''})
                  </button>
                </div>
              )}

              {/* Scenario sub-form header */}
              {isScenarioMode && scenarioSubFormOpen && (
                <div className="flex items-center justify-between px-4 py-3 bg-sky-500/10 rounded-xl border border-sky-500/20">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-sky-400" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-sky-400">
                      Question {scenarioQuestions.length + 1} for Scenario
                    </p>
                  </div>
                  <button type="button" onClick={() => setScenarioSubFormOpen(false)} className="text-brand-muted hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Editing scenario card: passage field */}
              {!isScenarioMode && editingCardIndex !== null && island.cards[editingCardIndex]?.scenarioId && (
                <div>
                  <label className="block text-[10px] text-sky-400 uppercase tracking-[0.2em] font-black mb-3">
                    Scenario Passage <span className="text-sky-400/50 normal-case tracking-normal font-normal">(updates all questions in this group)</span>
                  </label>
                  <textarea
                    value={scenarioPassage}
                    onChange={e => setScenarioPassage(e.target.value)}
                    rows={4}
                    className="w-full bg-sky-500/5 border border-sky-500/20 rounded-2xl px-5 py-4 text-white outline-none focus:border-sky-500/50 transition-colors resize-none custom-scrollbar"
                  />
                </div>
              )}

              {(!isScenarioMode || scenarioSubFormOpen) && (
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
              )}

              {(!isScenarioMode || scenarioSubFormOpen) && !['matching', 'sequencing', 'mcq'].includes(cardType) && (
                <div>
                  <label className="block text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-3">
                    Back Side (Answer)
                  </label>
                  <textarea
                    value={back}
                    onChange={(e) => setBack(e.target.value)}
                    placeholder="The detailed explanation..."
                    rows={3}
                    className="w-full bg-white/5 border border-brand-border rounded-2xl px-5 py-4 text-white outline-none focus:border-brand-primary/50 transition-colors resize-none custom-scrollbar"
                  />
                </div>
              )}

              {(!isScenarioMode || scenarioSubFormOpen) && (cardType === 'flashcard' || cardType === 'mcq' || cardType === 'fill-in-the-blank') && (
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

              {(!isScenarioMode || scenarioSubFormOpen) && cardType === 'matching' && (
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

              {(!isScenarioMode || scenarioSubFormOpen) && cardType === 'mcq' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <div className="flex items-center justify-between mb-1 mt-4">
                    <label className="block text-[10px] text-brand-primary uppercase tracking-[0.2em] font-black">
                      Options
                    </label>
                    <button
                      type="button"
                      onClick={() => setMcqLockOrder(!mcqLockOrder)}
                      className={cn("flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-lg transition-colors",
                        mcqLockOrder ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" : "bg-white/5 text-brand-muted hover:text-white border border-transparent")}
                    >
                      {mcqLockOrder ? <Lock className="w-3 h-3" /> : <Shuffle className="w-3 h-3" />}
                      {mcqLockOrder ? 'Order locked' : 'Shuffle on'}
                    </button>
                  </div>
                  <p className="text-[10px] text-brand-muted mb-4 font-bold border-l-2 border-brand-primary/50 pl-3 py-1 bg-brand-primary/5 rounded-r-lg">
                    Click the circle to mark correct answers. Mark one for single-answer, multiple for "select all that apply". Use <strong>exp</strong> to add per-option explanations.
                  </p>
                  <div className="space-y-2">
                    {mcqInlineOptions.map((opt, idx) => (
                      <div key={opt.id}>
                        <div className={cn("flex gap-2 items-center p-1", opt.isCorrect ? "bg-emerald-500/5 border border-emerald-500/20 rounded-xl" : "rounded-xl")}>
                          {/* Toggle correct: single click marks/unmarks. Multiple can be correct (becomes "select all that apply"). */}
                          <button
                            type="button"
                            onClick={() => setMcqInlineOptions(mcqInlineOptions.map((o, i) => i === idx ? { ...o, isCorrect: !o.isCorrect } : o))}
                            className={cn("w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full border-2 transition-colors",
                              opt.isCorrect ? "border-emerald-500 bg-emerald-500/20" : "border-white/20 bg-white/5 hover:border-white/40")}
                          >
                            {opt.isCorrect && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </button>
                          <input
                            value={opt.text}
                            onChange={(e) => {
                              const updated = [...mcqInlineOptions];
                              updated[idx] = { ...updated[idx], text: e.target.value };
                              setMcqInlineOptions(updated);
                            }}
                            placeholder={opt.isCorrect ? "Correct answer..." : `Distractor ${idx}...`}
                            className="flex-1 min-w-0 bg-white/5 border border-brand-border rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newSet = new Set(expandedMcqExp);
                              if (newSet.has(opt.id)) newSet.delete(opt.id); else newSet.add(opt.id);
                              setExpandedMcqExp(newSet);
                            }}
                            className={cn("w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors",
                              expandedMcqExp.has(opt.id) || opt.explanation ? "bg-brand-primary/10 text-brand-primary border border-brand-primary/30" : "bg-white/5 text-brand-muted hover:text-white border border-transparent")}
                          >
                            exp
                          </button>
                          <button
                            type="button"
                            disabled={mcqInlineOptions.length <= 2}
                            onClick={() => setMcqInlineOptions(mcqInlineOptions.filter((_, i) => i !== idx))}
                            className={cn("w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl transition-colors",
                              mcqInlineOptions.length <= 2 ? "opacity-30 cursor-not-allowed text-brand-muted" : "bg-white/5 text-brand-muted hover:bg-red-500/20 hover:text-red-400")}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {(expandedMcqExp.has(opt.id) || opt.explanation) && (
                          <textarea
                            value={opt.explanation}
                            onChange={(e) => {
                              const updated = [...mcqInlineOptions];
                              updated[idx] = { ...updated[idx], explanation: e.target.value };
                              setMcqInlineOptions(updated);
                            }}
                            placeholder="Explanation shown after answering..."
                            rows={2}
                            className="w-full mt-1 bg-white/5 border border-brand-border rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50 resize-none"
                          />
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setMcqInlineOptions([...mcqInlineOptions, { id: Date.now().toString(), text: '', isCorrect: false, explanation: '' }])}
                      className="text-xs mt-2 flex items-center justify-center border border-dashed border-white/20 hover:border-brand-primary/50 gap-2 text-brand-muted hover:text-brand-primary w-full py-3 rounded-xl transition-all"
                    >
                      <Plus className="w-4 h-4" /> Add Option
                    </button>
                  </div>
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

              {(!isScenarioMode || scenarioSubFormOpen) && cardType === 'sequencing' && (
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

              {(!isScenarioMode || scenarioSubFormOpen) && (
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
              )}

              <div className="flex gap-3">
                {isScenarioMode && scenarioSubFormOpen ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setScenarioSubFormOpen(false)}
                      className="w-1/3 glass hover:bg-white/5 border border-white/10 h-14 rounded-[16px] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddScenarioQuestion}
                      disabled={!front.trim() ||
                               (!['matching', 'sequencing', 'mcq'].includes(cardType) && !back.trim()) ||
                               (cardType === 'mcq' && (mcqInlineOptions.filter(o => o.text.trim()).length < 2 || !mcqInlineOptions.some(o => o.isCorrect))) ||
                               (cardType === 'matching' && matchingPairs.filter(p => p.left.trim() && p.rights.trim()).length < 2) ||
                               (cardType === 'sequencing' && sequenceItems.filter(i => i.text.trim()).length < 2)}
                      className="btn-primary h-14 w-2/3 disabled:opacity-50"
                    >
                      Save Question to Group
                    </button>
                  </>
                ) : !isScenarioMode && (
                  <>
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
                               (!['matching', 'sequencing', 'mcq'].includes(cardType) && !back.trim()) ||
                               (cardType === 'mcq' && (mcqInlineOptions.filter(o => o.text.trim()).length < 2 || !mcqInlineOptions.some(o => o.isCorrect))) ||
                               (cardType === 'matching' && matchingPairs.filter(p => p.left.trim() && p.rights.trim()).length < 2) ||
                               (cardType === 'sequencing' && sequenceItems.filter(i => i.text.trim()).length < 2)}
                      className={cn(
                        "btn-primary h-14 disabled:opacity-50",
                        editingCardIndex !== null ? "w-2/3" : "w-full"
                      )}
                    >
                      {editingCardIndex !== null ? 'Update Card' : 'Assemble Card'}
                    </button>
                  </>
                )}
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
              displayCards.map(({ card, originalIdx: idx }, displayIdx) => {
                const prevSid = displayIdx > 0 ? displayCards[displayIdx - 1].card.scenarioId : undefined;
                const isGroupStart = !!card.scenarioId && card.scenarioId !== prevSid;
                const isGroupMember = !!card.scenarioId && card.scenarioId === prevSid;
                const groupSize = card.scenarioId ? island.cards.filter(c => c.scenarioId === card.scenarioId).length : 0;
                return (
                <React.Fragment key={`frag-${idx}`}>
                  {isGroupStart && (
                    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-sky-500/5 border border-sky-500/15">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                        <p className="text-[10px] text-white/50 line-clamp-1 max-w-[220px]">
                          {card.scenarioText?.slice(0, 60)}{(card.scenarioText?.length ?? 0) > 60 ? '…' : ''}
                        </p>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-sky-400/70 shrink-0 ml-2">{groupSize} Qs</span>
                    </div>
                  )}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: displayIdx * 0.05 }}
                  key={idx}
                  onClick={() => handleEditCard(idx)}
                  style={{ marginLeft: card.tier && card.tier > 1 ? `${(card.tier - 1) * 24}px` : isGroupMember || isGroupStart ? '12px' : undefined }}
                  className={cn(
                    "glass rounded-2xl p-6 border-white/5 group relative cursor-pointer hover:border-brand-primary/30 transition-colors",
                    editingCardIndex === idx && "border-brand-primary bg-brand-primary/5",
                    card.scenarioId && "border-l-2 border-l-sky-500/20"
                  )}
                >
                  {card.tier && card.tier > 1 && (
                    <div className="absolute -left-4 top-1/2 -mt-4 w-4 h-8 border-l-2 border-b-2 border-white/20 rounded-bl-lg pointer-events-none" />
                  )}
                  {card.scenarioId && (
                    <div className="absolute top-2 left-2 text-[8px] font-black uppercase tracking-widest text-sky-400/50">
                      Q{card.scenarioOrder}
                    </div>
                  )}
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      {(card.type === 'mcq' || card.type === 'multi-select') ? (
                        // multi-select is the legacy type name; unified under mcq display
                        <div className={cn("text-[9px] uppercase font-black", card.needsWork ? "text-amber-400" : "text-brand-primary")}>MCQ</div>
                      ) : card.type === 'fill-in-the-blank' ? (
                        <Type className={cn("w-4 h-4", card.needsWork ? "text-amber-400" : "text-purple-400")} />
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
                              <button
                                onClick={(e) => openCardPreview(e, idx)}
                                className="text-brand-muted hover:text-white transition-colors opacity-40 group-hover:opacity-100 p-1"
                                title="Preview Card"
                              >
                                <Eye className="w-4 h-4" />
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
                </React.Fragment>
                );
              })
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

      {/* Card Preview Modal */}
      <AnimatePresence>
        {previewCardIndex !== null && (() => {
          const card = island.cards[previewCardIndex];
          const isFlashcard = !card.type || card.type === 'flashcard';
          // Treat legacy multi-select as MCQ in the preview — both use options + correctOptions
          const isMcq = card.type === 'mcq' || card.type === 'multi-select';
          const isFib = card.type === 'fill-in-the-blank';
          const isSeq = card.type === 'sequencing';
          const isMatching = card.type === 'matching';
          const typeLabel = isMcq ? 'Multiple Choice' : isFib ? 'Fill in the Blank' : isSeq ? 'Sequencing' : isMatching ? 'Matching' : 'Flashcard';

          return (
            <>
              <motion.div
                key="preview-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
                onClick={closeCardPreview}
              />
              <motion.div
                key="preview-modal"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-lg glass p-6 sm:p-8 rounded-[32px] border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.8)] z-[101] max-h-[85vh] overflow-y-auto custom-scrollbar"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-brand-primary/20 flex items-center justify-center">
                      <Eye className="w-4 h-4 text-brand-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-brand-muted font-medium">{typeLabel}</p>
                      <p className="text-xs text-white/40">Card Preview</p>
                    </div>
                  </div>
                  <button onClick={closeCardPreview} className="p-2 text-brand-muted hover:text-white rounded-xl bg-white/5 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Card Content */}
                {isFlashcard && (
                  <div>
                    {/* Front face */}
                    <div className="glass rounded-2xl p-6 border border-brand-primary/20 text-center mb-4 min-h-[120px] flex flex-col items-center justify-center gap-4">
                      <p className="text-[10px] uppercase tracking-widest text-brand-muted/60 font-medium">Front</p>
                      {card.imageUrl && <img src={card.imageUrl} alt="" className="max-h-32 rounded-xl object-contain" />}
                      <p className="text-lg font-bold leading-snug">{card.front}</p>
                    </div>
                    <AnimatePresence>
                      {!previewFlipped ? (
                        <motion.button
                          key="reveal-btn"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setPreviewFlipped(true)}
                          className="w-full py-3 rounded-xl bg-brand-primary/20 text-brand-primary font-bold text-sm hover:bg-brand-primary/30 transition-colors border border-brand-primary/30"
                        >
                          Reveal Answer
                        </motion.button>
                      ) : (
                        <motion.div
                          key="back-face"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <div className="glass rounded-2xl p-6 border border-emerald-500/20 text-center min-h-[100px] flex flex-col items-center justify-center gap-4 mb-4">
                            <p className="text-[10px] uppercase tracking-widest text-emerald-400/60 font-medium">Back</p>
                            {card.backImageUrl && <img src={card.backImageUrl} alt="" className="max-h-32 rounded-xl object-contain" />}
                            <p className="text-base font-medium leading-snug text-white/90">{card.back}</p>
                            {card.explanation && <p className="text-xs text-brand-muted mt-1 leading-relaxed">{card.explanation}</p>}
                          </div>
                          <button
                            onClick={() => setPreviewFlipped(false)}
                            className="w-full py-2.5 rounded-xl bg-white/5 text-brand-muted text-sm hover:text-white transition-colors"
                          >
                            Flip Back
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {isMcq && (
                  <div>
                    {/* Normalize correctness: new cards use correctOptions, legacy MCQ uses back */}
                    {(() => {
                      const correctSet = card.correctOptions?.length
                        ? new Set(card.correctOptions)
                        : new Set([card.back]);
                      const isMultiAnswer = correctSet.size > 1;
                      return (
                    <div>
                    <div className="glass rounded-2xl p-6 border border-brand-primary/20 text-center mb-6 min-h-[100px] flex flex-col items-center justify-center gap-3">
                      <p className="text-[10px] uppercase tracking-widest text-brand-muted/60 font-medium">{isMultiAnswer ? 'Select All That Apply' : 'Select the Correct Answer'}</p>
                      {card.imageUrl && <img src={card.imageUrl} alt="" className="max-h-28 rounded-xl object-contain" />}
                      <p className="text-lg font-bold leading-snug">{card.front}</p>
                    </div>
                    <div className="space-y-2">
                      {previewShuffledOptions.map((opt, i) => {
                        const isCorrect = correctSet.has(opt);
                        const isSelected = previewSelectedOption === opt;
                        const revealed = previewSelectedOption !== null;
                        let cls = "bg-white/5 border border-white/10 hover:bg-white/10 text-white/70";
                        if (revealed) {
                          if (isCorrect) cls = "bg-emerald-500/10 border-emerald-500/50 text-white";
                          else if (isSelected) cls = "bg-red-500/10 border-red-500/50 text-white";
                          else cls = "bg-white/5 border-transparent text-brand-muted/30 opacity-40";
                        }
                        const letter = String.fromCharCode(65 + i);
                        return (
                          <button
                            key={opt}
                            disabled={revealed}
                            onClick={() => setPreviewSelectedOption(opt)}
                            className={cn("w-full text-left px-4 py-3 rounded-xl transition-colors flex items-start gap-3 text-sm font-medium", cls)}
                          >
                            <span className="font-bold text-white/50 shrink-0">{letter}.</span>
                            <span className="flex-1">{opt}</span>
                            {revealed && isCorrect && <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                            {revealed && isSelected && !isCorrect && <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
                          </button>
                        );
                      })}
                    </div>
                    {previewSelectedOption && card.explanation && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-brand-muted mt-4 p-3 rounded-xl bg-white/5 leading-relaxed">
                        {card.explanation}
                      </motion.p>
                    )}
                    {previewSelectedOption && (
                      <button onClick={() => { setPreviewSelectedOption(null); setPreviewShuffledOptions(p => [...p].sort(() => Math.random() - 0.5)); }} className="w-full mt-3 py-2.5 rounded-xl bg-white/5 text-brand-muted text-sm hover:text-white transition-colors">
                        Try Again
                      </button>
                    )}
                    </div>
                      );
                    })()}
                  </div>
                )}

                {isFib && (
                  <div>
                    <div className="glass rounded-2xl p-6 border border-brand-primary/20 text-center mb-6 min-h-[100px] flex flex-col items-center justify-center gap-3">
                      <p className="text-[10px] uppercase tracking-widest text-brand-muted/60 font-medium">Fill in the Blank</p>
                      {card.imageUrl && <img src={card.imageUrl} alt="" className="max-h-28 rounded-xl object-contain" />}
                      <p className="text-lg font-bold leading-snug">{card.front}</p>
                    </div>
                    {!previewFibSubmitted ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={previewFibInput}
                          onChange={e => setPreviewFibInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && previewFibInput.trim() && setPreviewFibSubmitted(true)}
                          placeholder="Type your answer..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-brand-muted/40 focus:outline-none focus:border-brand-primary/50"
                          autoFocus
                        />
                        <button
                          onClick={() => previewFibInput.trim() && setPreviewFibSubmitted(true)}
                          disabled={!previewFibInput.trim()}
                          className="w-full py-3 rounded-xl bg-brand-primary/20 text-brand-primary font-bold text-sm hover:bg-brand-primary/30 transition-colors border border-brand-primary/30 disabled:opacity-40"
                        >
                          Check Answer
                        </button>
                      </div>
                    ) : (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] uppercase tracking-widest text-brand-muted/60">Your answer</p>
                          </div>
                          <p className="text-sm font-medium text-white/80">{previewFibInput}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                          <p className="text-[10px] uppercase tracking-widest text-emerald-400/60">Correct answer</p>
                          <p className="text-sm font-bold text-emerald-300">{card.back}</p>
                        </div>
                        {card.explanation && <p className="text-xs text-brand-muted p-3 rounded-xl bg-white/5 leading-relaxed">{card.explanation}</p>}
                        <button onClick={() => { setPreviewFibInput(''); setPreviewFibSubmitted(false); }} className="w-full py-2.5 rounded-xl bg-white/5 text-brand-muted text-sm hover:text-white transition-colors">
                          Try Again
                        </button>
                      </motion.div>
                    )}
                  </div>
                )}

                {isSeq && (
                  <div>
                    <div className="glass rounded-2xl p-6 border border-brand-primary/20 text-center mb-6 min-h-[100px] flex flex-col items-center justify-center gap-3">
                      <p className="text-[10px] uppercase tracking-widest text-brand-muted/60 font-medium">Put in the Correct Order</p>
                      <p className="text-lg font-bold leading-snug">{card.front}</p>
                    </div>
                    <div className="space-y-2 mb-4">
                      {previewSequenceOrder.map((origIdx, pos) => {
                        const opts = card.options || [];
                        const isCorrectPos = previewSequenceSubmitted && origIdx === pos;
                        const isWrongPos = previewSequenceSubmitted && origIdx !== pos;
                        return (
                          <div key={origIdx} className={cn("flex items-center gap-3 p-3 rounded-xl border transition-colors", previewSequenceSubmitted ? (isCorrectPos ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30") : "bg-white/5 border-white/10")}>
                            <span className="text-xs font-bold text-brand-muted/60 w-5 shrink-0">{pos + 1}.</span>
                            <span className="flex-1 text-sm font-medium">{opts[origIdx]}</span>
                            {!previewSequenceSubmitted && (
                              <div className="flex gap-1">
                                <button disabled={pos === 0} onClick={() => { const o = [...previewSequenceOrder]; [o[pos-1], o[pos]] = [o[pos], o[pos-1]]; setPreviewSequenceOrder(o); }} className="p-1 text-brand-muted hover:text-white disabled:opacity-20 transition-colors">
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button disabled={pos === previewSequenceOrder.length - 1} onClick={() => { const o = [...previewSequenceOrder]; [o[pos], o[pos+1]] = [o[pos+1], o[pos]]; setPreviewSequenceOrder(o); }} className="p-1 text-brand-muted hover:text-white disabled:opacity-20 transition-colors" style={{ transform: 'rotate(180deg)' }}>
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            {previewSequenceSubmitted && isCorrectPos && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                            {previewSequenceSubmitted && isWrongPos && <X className="w-4 h-4 text-red-400 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                    {!previewSequenceSubmitted ? (
                      <button onClick={() => setPreviewSequenceSubmitted(true)} className="w-full py-3 rounded-xl bg-brand-primary/20 text-brand-primary font-bold text-sm hover:bg-brand-primary/30 transition-colors border border-brand-primary/30">
                        Check Order
                      </button>
                    ) : (
                      <button onClick={() => { setPreviewSequenceOrder((card.options || []).map((_, i) => i).sort(() => Math.random() - 0.5)); setPreviewSequenceSubmitted(false); }} className="w-full py-2.5 rounded-xl bg-white/5 text-brand-muted text-sm hover:text-white transition-colors">
                        Try Again
                      </button>
                    )}
                  </div>
                )}

                {isMatching && (card.pairs || []).length > 0 && (
                  <div>
                    <div className="glass rounded-2xl p-6 border border-brand-primary/20 text-center mb-6 min-h-[100px] flex flex-col items-center justify-center gap-3">
                      <p className="text-[10px] uppercase tracking-widest text-brand-muted/60 font-medium">Match the Pairs</p>
                      <p className="text-lg font-bold leading-snug">{card.front}</p>
                    </div>
                    <div className="space-y-3">
                      {(card.pairs || []).map((pair, i) => (
                        <div key={pair.id} className="flex items-center gap-3">
                          <div className="flex-1 p-3 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-center">{pair.left}</div>
                          <div className="text-brand-muted/40 shrink-0">↔</div>
                          <div className="flex-1 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm font-medium text-center text-emerald-300">{pair.rights[0]}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hint */}
                {card.hint && (
                  <p className="text-xs text-brand-muted/60 mt-4 text-center italic">Hint: {card.hint}</p>
                )}
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
