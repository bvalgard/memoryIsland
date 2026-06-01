import { useState, useRef, useMemo, useEffect } from 'react';
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Trash2, CreditCard, Play, Upload, Share2, Globe, Users, Lock, Check, Download, X, ArrowUp, Type, CheckSquare, ListOrdered, Move, Pencil, Eye, BookOpen, Shuffle, Repeat2, Copy, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Menu, Search, ChevronDown, RotateCcw, ImageIcon, Sparkles, Archive, Target, ScanLine } from 'lucide-react';
import { Island, Card, HotspotZone } from '../hooks/useUserProgress';
import { HotspotEditor } from './HotspotEditor';
import Papa from 'papaparse';
import { generateCardsFromNotes, getRemainingGenerations } from '../lib/generateCards';
import { cn, formatTimeUntil, getActiveTierCards } from '../lib/utils';
import { findDuplicatesForCard, DuplicateMatch } from '../lib/duplicateDetection';
import DuplicateScanModal from './DuplicateScanModal';
import ShareModal from './ShareModal';
import ConfirmDialog from './ConfirmDialog';
import ImageUpload from './ImageUpload';
import { UserProfile } from '../hooks/useSocial';
import FormatToolbar, { wrapSelection } from './island-detail/FormatToolbar';
import HomeViewStats from './island-detail/HomeViewStats';
import CardPreviewModal from './island-detail/CardPreviewModal';
import ChartingCardsModal from './island-detail/StrugglingCardsModal';
import AIGenerationModal from './island-detail/AIGenerationModal';

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
  onStartStudy: (mode: 'all' | 'charting' | 'sailing' | 'mastered' | 'due') => void;
  onShare?: (island: Island, targetUids?: string[]) => void;
  onUnshare?: (island: Island) => void;
  onUpdateIsland?: (updates: Partial<Island>) => void;
  progressTrackingMode?: 'srs' | 'status' | 'both';
  graceWindowMinutes?: number;
  friends?: string[];
  fetchProfilesByUids?: (uids: string[]) => Promise<UserProfile[]>;
  currentUserId?: string;
  onAddCollaborator?: (uid: string) => Promise<void>;
  onRemoveCollaborator?: (uid: string) => Promise<void>;
  onResetIsland?: (islandId: string) => Promise<void>;
  onArchiveIsland?: () => void;
  onDeleteCardById?: (cardId: string, islandId: string) => void;
}

type AiPreviewCard = Card & { _isDuplicate?: boolean; _duplicateLocation?: string };


export default function IslandDetail({ island, allIslands, archipelagos, onBack, onAddCard, onUpdateCard, onDeleteCard, onMoveCard, onDeleteIsland, onAddCards, onStartStudy, onShare, onUnshare, onUpdateIsland, progressTrackingMode = 'srs', graceWindowMinutes = 0, friends = [], fetchProfilesByUids = async () => [], currentUserId, onAddCollaborator, onRemoveCollaborator, onResetIsland, onArchiveIsland, onDeleteCardById }: IslandDetailProps) {
  const [view, setView] = useState<'home' | 'editor'>('home');
  const [editingCardIndex, setEditingCardIndex] = useState<number | null>(null);
  const [studyMode, setStudyMode] = useState<'all' | 'charting' | 'sailing' | 'mastered' | 'due'>(() => {
    if (progressTrackingMode === 'srs') {
      const now = Date.now();
      const graceMs = graceWindowMinutes * 60_000;
      const due = getActiveTierCards(island.cards).filter(c => !c.srsNextReview || c.srsNextReview <= now + graceMs).length;
      return due > 0 ? 'due' : 'all';
    }
    return 'all';
  });
  const [showChartingCards, setShowChartingCards] = useState(false);
  const [showShareConfirm, setShowShareConfirm] = useState(false);
  const [showUnshareConfirm, setShowUnshareConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showCollaboratorPanel, setShowCollaboratorPanel] = useState(false);
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<UserProfile[]>([]);
  const [friendProfilesForInvite, setFriendProfilesForInvite] = useState<UserProfile[]>([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);
  const [showCollabInvite, setShowCollabInvite] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showIslandImageModal, setShowIslandImageModal] = useState(false);
  const [movingCardIndex, setMovingCardIndex] = useState<number | null>(null);
  const [cardType, setCardType] = useState<Card['type']>('flashcard');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [hint, setHint] = useState('');
  const [explanation, setExplanation] = useState('');
  const [matchingPairs, setMatchingPairs] = useState<{
    id: string;
    left: string;
    leftImage?: string;
    rights: { id: string; text: string; image?: string }[];
  }[]>([{ id: Date.now().toString(), left: '', leftImage: undefined, rights: [{ id: Date.now().toString() + 'r0', text: '', image: undefined }] }]);
  // Unified MCQ options — one correct marker per option handles both single-answer (radio-like)
  // and multi-answer (checkbox-like) in one builder. The number of marked-correct options at
  // save time determines which study-session interaction the card gets.
  const [mcqInlineOptions, setMcqInlineOptions] = useState<{
    id: string; text: string; isCorrect: boolean; explanation: string; imageUrl?: string;
  }[]>([
    { id: Date.now().toString() + '1', text: '', isCorrect: true, explanation: '' },
    { id: Date.now().toString() + '2', text: '', isCorrect: false, explanation: '' },
    { id: Date.now().toString() + '3', text: '', isCorrect: false, explanation: '' },
    { id: Date.now().toString() + '4', text: '', isCorrect: false, explanation: '' },
  ]);
  const [mcqLockOrder, setMcqLockOrder] = useState(false);
  const [expandedMcqExp, setExpandedMcqExp] = useState<Set<string>>(new Set());
  const [expandedMcqImg, setExpandedMcqImg] = useState<Set<string>>(new Set());
  const [sequenceItems, setSequenceItems] = useState<{ id: string; text: string }[]>([
    { id: Date.now().toString() + '1', text: '' },
    { id: Date.now().toString() + '2', text: '' }
  ]);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [backImageUrl, setBackImageUrl] = useState<string | undefined>(undefined);
  const [imageCredit, setImageCredit] = useState('');
  const [backImageCredit, setBackImageCredit] = useState('');
  const [hotspotZone, setHotspotZone] = useState<HotspotZone | null>(null);
  const [hotspotQuestions, setHotspotQuestions] = useState<
    Array<{ id: string; zone: HotspotZone; front: string; back: string }>
  >([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiNotes, setAiNotes] = useState('');
  const [aiCardCount, setAiCardCount] = useState(10);
  const [aiSelectedTypes, setAiSelectedTypes] = useState<string[]>(['mcq', 'multi-select', 'sequencing', 'fill-in-the-blank', 'flashcard']);
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPreviewCards, setAiPreviewCards] = useState<AiPreviewCard[]>([]);
  const [aiRemaining, setAiRemaining] = useState<number | null>(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [duplicateWarnings, setDuplicateWarnings] = useState<DuplicateMatch[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [deletingCardIndex, setDeletingCardIndex] = useState<number | null>(null);
  const [previewCardIndex, setPreviewCardIndex] = useState<number | null>(null);
  const [parentCardForProgression, setParentCardForProgression] = useState<Card | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frontRef = useRef<HTMLTextAreaElement>(null);
  const backRef = useRef<HTMLTextAreaElement>(null);
  const hintRef = useRef<HTMLTextAreaElement>(null);
  const explanationRef = useRef<HTMLTextAreaElement>(null);
  const scenarioPassageRef = useRef<HTMLTextAreaElement>(null);
  const mcqOptionRefs = useRef<(HTMLInputElement | null)[]>([]);
  const canvasPaneRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const t = setTimeout(() => frontRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [cardType, editingCardIndex]);

  // Keyboard shortcuts — ref keeps handler fresh without stale closures
  const islandKeyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  islandKeyHandlerRef.current = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;

    if (e.key === 'Escape' && editingCardIndex !== null) { handleCancelEdit(); return; }

    // Cmd/Ctrl+S — save or update card
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (!isScenarioMode && front.trim() && (back.trim() || ['matching', 'multi-select', 'sequencing', 'mcq'].includes(cardType))) {
        handleSubmit({ preventDefault: () => {} } as React.FormEvent);
      }
      return;
    }

    // N — start a new card (only when not typing and not already editing)
    if ((e.key === 'n' || e.key === 'N') && !isTyping && !e.metaKey && !e.ctrlKey && editingCardIndex === null) {
      e.preventDefault();
      resetCardForm();
      setTimeout(() => frontRef.current?.focus(), 50);
    }
  };
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => islandKeyHandlerRef.current(e);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!front.trim()) { setDuplicateWarnings([]); return; }
    const timer = setTimeout(() => {
      const excludeId = editingCardIndex !== null ? island.cards[editingCardIndex]?.id : undefined;
      setDuplicateWarnings(findDuplicatesForCard({ front, type: cardType }, allIslands, excludeId));
    }, 300);
    return () => clearTimeout(timer);
  }, [front, cardType, editingCardIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = editingCardIndex !== null
    ? (() => {
        const orig = island.cards[editingCardIndex];
        return (
          front !== orig.front ||
          back !== (orig.back || '') ||
          hint !== (orig.hint || '') ||
          explanation !== (orig.explanation || '') ||
          ((orig.type === 'mcq' || orig.type === 'multi-select') &&
            mcqInlineOptions.length !== (orig.options?.length ?? 4))
        );
      })()
    : (
        front.trim().length > 0 ||
        back.trim().length > 0 ||
        hint.trim().length > 0 ||
        explanation.trim().length > 0 ||
        mcqInlineOptions.length !== 4 ||
        mcqInlineOptions.some(o => o.text.trim().length > 0) ||
        matchingPairs.some(p => p.left.trim().length > 0 || p.rights.some(r => r.text.trim().length > 0)) ||
        sequenceItems.some(s => s.text.trim().length > 0)
      );

  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const pendingNavRef = useRef<(() => void) | null>(null);

  function guardedNav(action: () => void) {
    if (view === 'editor' && isDirty) {
      pendingNavRef.current = action;
      setShowUnsavedWarning(true);
    } else {
      action();
    }
  }

  const [leftPaneOpen, setLeftPaneOpen] = useState(() => window.innerWidth >= 1024);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [cardSearch, setCardSearch] = useState('');
  const [showHintField, setShowHintField] = useState(false);
  const [showExplanationField, setShowExplanationField] = useState(false);
  const [showImageField, setShowImageField] = useState(false);
  const stickyFields = useRef({ hint: false, explanation: false, image: false });

  const setShowHintFieldSticky = (v: boolean) => { stickyFields.current.hint = v; setShowHintField(v); };
  const setShowExplanationFieldSticky = (v: boolean) => { stickyFields.current.explanation = v; setShowExplanationField(v); };
  const setShowImageFieldSticky = (v: boolean) => { stickyFields.current.image = v; setShowImageField(v); };

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
    // Always reload so newly accepted friends appear immediately
    if (friends.length > 0) {
      const profiles = await fetchProfilesByUids(friends);
      setFriendProfilesForInvite(profiles);
    } else {
      setFriendProfilesForInvite([]);
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
    setHotspotZone(null);
    setHotspotQuestions([]);
    setMatchingPairs([{ id: Date.now().toString(), left: '', leftImage: undefined, rights: [{ id: Date.now().toString() + 'r0', text: '', image: undefined }] }]);
    setMcqInlineOptions([
      { id: Date.now().toString() + '1', text: '', isCorrect: true, explanation: '' },
      { id: Date.now().toString() + '2', text: '', isCorrect: false, explanation: '' },
      { id: Date.now().toString() + '3', text: '', isCorrect: false, explanation: '' },
      { id: Date.now().toString() + '4', text: '', isCorrect: false, explanation: '' },
    ]);
    setMcqLockOrder(false);
    setExpandedMcqExp(new Set());
    setExpandedMcqImg(new Set());
    setSequenceItems([
      { id: Date.now().toString() + '1', text: '' },
      { id: Date.now().toString() + '2', text: '' }
    ]);
    setIsScenarioMode(false);
    setScenarioPassage('');
    setScenarioQuestions([]);
    setScenarioSubFormOpen(false);
    setShowHintField(stickyFields.current.hint);
    setShowExplanationField(stickyFields.current.explanation);
    setShowImageField(stickyFields.current.image);
  };

  /** Locks in the current hotspot question into the set and clears the form for the next one. */
  const handleAddToHotspotSet = () => {
    if (!imageUrl || !hotspotZone || !front.trim()) return;
    setHotspotQuestions(prev => [
      ...prev,
      { id: crypto.randomUUID(), zone: hotspotZone, front: front.trim(), back: back.trim() },
    ]);
    setFront('');
    setBack('');
    setHotspotZone(null);
    // imageUrl is intentionally kept so the creator can place the next zone
  };

  const handleAddScenarioQuestion = () => {
    if (!front.trim()) return;
    if (!['matching', 'sequencing', 'mcq', 'hotspot'].includes(cardType || '') && !back.trim()) return;

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
      const valid = mcqInlineOptions.filter(o => o.text.trim() || o.imageUrl);
      if (valid.length < 2) { alert('MCQ needs at least 2 options.'); return; }
      const correctOpts = valid.filter(o => o.isCorrect);
      if (correctOpts.length === 0) { alert('MCQ requires at least one correct answer.'); return; }
      const optTexts = valid.map(o => o.text.trim() || `__img_${o.id}__`);
      q.correctOptions = correctOpts.map(o => o.text.trim() || `__img_${o.id}__`);
      q.back = q.correctOptions[0];
      q.options = optTexts;
      if (mcqLockOrder) q.lockOptionOrder = true;
      const exps: Record<string, string> = {};
      valid.forEach((o, i) => { if (o.explanation.trim()) exps[optTexts[i]] = o.explanation.trim(); });
      if (Object.keys(exps).length) q.explanations = exps;
      const imgs = valid.map(o => o.imageUrl || null);
      if (imgs.some(Boolean)) q.optionImages = imgs;
    } else if (cardType === 'matching') {
      const validPairs = matchingPairs
        .filter(p => (p.left.trim() || p.leftImage) && p.rights.some(r => r.text.trim() || r.image))
        .map(p => ({
          id: p.id,
          left: p.left.trim() || `__img_${p.id}__`,
          rights: p.rights
            .filter(r => r.text.trim() || r.image)
            .map(r => r.text.trim() || `__img_${r.id}__`),
        }));
      if (validPairs.length < 2) { alert('Matching requires at least 2 pairs.'); return; }
      q.pairs = validPairs;
      q.back = 'Matching Exercise';
      const pairImgsArr = matchingPairs
        .filter(p => (p.left.trim() || p.leftImage) && p.rights.some(r => r.text.trim() || r.image))
        .map(p => ({
          leftImage: p.leftImage || undefined,
          rightImages: p.rights.filter(r => r.text.trim() || r.image).map(r => r.image || null),
        }));
      if (pairImgsArr.some(pi => pi.leftImage || pi.rightImages.some(Boolean))) q.pairImages = pairImgsArr;
    } else if (cardType === 'sequencing') {
      const valid = sequenceItems.filter(i => i.text.trim());
      if (valid.length < 2) { alert('Sequencing needs at least 2 items.'); return; }
      q.options = valid.map(i => i.text.trim());
      q.back = 'Sequencing Exercise';
    } else if (cardType === 'hotspot') {
      if (!imageUrl) { alert('Hotspot cards require an image.'); return; }
      if (!hotspotZone) { alert('Click on the image to place the hotspot zone.'); return; }
      q.hotspots = [hotspotZone];
    }

    setScenarioQuestions(prev => [...prev, q]);
    setFront('');
    setBack('');
    setHint('');
    setExplanation('');
    // For hotspot scenario questions keep the same image so the creator can mark
    // a different zone on the next question without re-uploading.
    if (cardType !== 'hotspot') {
      setImageUrl(undefined);
      setBackImageUrl(undefined);
    }
    // Reset zone placement for the next hotspot question in the scenario
    setHotspotZone(null);
    setMatchingPairs([{ id: Date.now().toString(), left: '', leftImage: undefined, rights: [{ id: Date.now().toString() + 'r0', text: '', image: undefined }] }]);
    setMcqInlineOptions([
      { id: Date.now().toString() + '1', text: '', isCorrect: true, explanation: '' },
      { id: Date.now().toString() + '2', text: '', isCorrect: false, explanation: '' },
      { id: Date.now().toString() + '3', text: '', isCorrect: false, explanation: '' },
      { id: Date.now().toString() + '4', text: '', isCorrect: false, explanation: '' },
    ]);
    setMcqLockOrder(false);
    setExpandedMcqExp(new Set());
    setExpandedMcqImg(new Set());
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
    if (front.trim() && (back.trim() || ['matching', 'multi-select', 'sequencing', 'mcq', 'hotspot'].includes(cardType))) {
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
        const valid = mcqInlineOptions.filter(o => o.text.trim() || o.imageUrl);
        if (valid.length < 2) { alert('MCQ needs at least 2 options.'); return; }
        const correctOpts = valid.filter(o => o.isCorrect);
        if (correctOpts.length === 0) { alert('MCQ requires at least one correct answer.'); return; }
        const optTexts = valid.map(o => o.text.trim() || `__img_${o.id}__`);
        newCard.correctOptions = correctOpts.map(o => o.text.trim() || `__img_${o.id}__`);
        newCard.back = newCard.correctOptions[0];
        newCard.options = optTexts;
        if (mcqLockOrder) newCard.lockOptionOrder = true;
        const exps: Record<string, string> = {};
        valid.forEach((o, i) => { if (o.explanation.trim()) exps[optTexts[i]] = o.explanation.trim(); });
        if (Object.keys(exps).length) newCard.explanations = exps;
        const imgs = valid.map(o => o.imageUrl || null);
        if (imgs.some(Boolean)) newCard.optionImages = imgs;
      } else if (cardType === 'matching') {
        const validPairs = matchingPairs
          .filter(p => (p.left.trim() || p.leftImage) && p.rights.some(r => r.text.trim() || r.image))
          .map(p => ({
            id: p.id,
            left: p.left.trim() || `__img_${p.id}__`,
            rights: p.rights
              .filter(r => r.text.trim() || r.image)
              .map(r => r.text.trim() || `__img_${r.id}__`),
          }));
        if (validPairs.length < 2) {
          alert('Matching cards require at least two pairs.');
          return;
        }
        newCard.pairs = validPairs;
        newCard.back = 'Matching Exercise';
        const pairImgsArr = matchingPairs
          .filter(p => (p.left.trim() || p.leftImage) && p.rights.some(r => r.text.trim() || r.image))
          .map(p => ({
            leftImage: p.leftImage || undefined,
            rightImages: p.rights.filter(r => r.text.trim() || r.image).map(r => r.image || null),
          }));
        if (pairImgsArr.some(pi => pi.leftImage || pi.rightImages.some(Boolean))) newCard.pairImages = pairImgsArr;
      } else if (cardType === 'sequencing') {
        const validItems = sequenceItems.filter(i => i.text.trim());
        if (validItems.length < 2) {
          alert('Sequencing requires at least two items.');
          return;
        }
        newCard.options = validItems.map(i => i.text.trim());
        newCard.back = 'Sequencing Exercise';
      } else if (cardType === 'hotspot') {
        // Gather everything: already-committed set questions + the current pending question
        const pendingQ =
          imageUrl && hotspotZone && front.trim()
            ? [{ id: crypto.randomUUID(), zone: hotspotZone, front: front.trim(), back: back.trim() }]
            : [];
        const allQs = [...hotspotQuestions, ...pendingQ];

        if (allQs.length === 0) { alert('Add at least one question with a zone placed.'); return; }

        if (allQs.length >= 2) {
          // Multi-question set → save as a scenario group
          const sid = crypto.randomUUID();
          const setCards: Card[] = allQs.map((q, i) => ({
            id: Math.random().toString(36).substring(2, 11),
            front: q.front,
            back: q.back || '',
            type: 'hotspot' as const,
            imageUrl: imageUrl!,
            hotspots: [q.zone],
            scenarioId: sid,
            scenarioText: '',
            scenarioOrder: i + 1,
            tier: 1,
          }));
          onAddCards(setCards);
          resetCardForm();
          setTimeout(() => frontRef.current?.focus(), 50);
          return; // skip normal save path
        }

        // Single question — normal single-card save
        if (!imageUrl) { alert('Hotspot cards require an image.'); return; }
        newCard.hotspots = [allQs[0].zone];
        newCard.front = allQs[0].front;
        newCard.back = allQs[0].back || '';
        newCard.imageUrl = imageUrl;
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
      setTimeout(() => frontRef.current?.focus(), 50);
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
    setShowHintField(!!(card.hint));
    setShowExplanationField(!!(card.explanation));
    setShowImageField(!!(card.imageUrl || card.backImageUrl));
    // Restore hotspot zone when editing a hotspot card; always clear the set (can't edit sets yet)
    setHotspotZone(card.type === 'hotspot' ? (card.hotspots?.[0] ?? null) : null);
    setHotspotQuestions([]);
    if ((card.type === 'mcq' || card.type === 'multi-select') && card.options) {
      const opts = card.options.map((opt, i) => {
        const isImgPlaceholder = opt.startsWith('__img_') && opt.endsWith('__');
        return {
          id: Date.now().toString() + Math.random(),
          text: isImgPlaceholder ? '' : opt,
          isCorrect: card.correctOptions?.length
            ? card.correctOptions.includes(opt)
            : opt === card.back,
          explanation: card.explanations?.[opt] || '',
          imageUrl: card.optionImages?.[i] || undefined,
        };
      });
      setMcqInlineOptions(opts);
      setMcqLockOrder(card.lockOptionOrder || false);
      setExpandedMcqExp(new Set(opts.filter(o => o.explanation).map(o => o.id)));
      setExpandedMcqImg(new Set(opts.filter(o => o.imageUrl).map(o => o.id)));
    } else {
      setMcqInlineOptions([
        { id: Date.now().toString() + '1', text: '', isCorrect: true, explanation: '' },
        { id: Date.now().toString() + '2', text: '', isCorrect: false, explanation: '' },
        { id: Date.now().toString() + '3', text: '', isCorrect: false, explanation: '' },
        { id: Date.now().toString() + '4', text: '', isCorrect: false, explanation: '' },
      ]);
      setMcqLockOrder(false);
      setExpandedMcqExp(new Set());
      setExpandedMcqImg(new Set());
    }
    if (card.type === 'matching' && card.pairs) {
      setMatchingPairs(card.pairs.map((p, pi) => ({
        id: p.id,
        left: p.left.startsWith('__img_') && p.left.endsWith('__') ? '' : p.left,
        leftImage: card.pairImages?.[pi]?.leftImage || undefined,
        rights: p.rights.map((r, ri) => ({
          id: `${p.id}-r-${ri}`,
          text: r.startsWith('__img_') && r.endsWith('__') ? '' : r,
          image: card.pairImages?.[pi]?.rightImages?.[ri] || undefined,
        })),
      })));
    } else {
      setMatchingPairs([{ id: Date.now().toString(), left: '', leftImage: undefined, rights: [{ id: Date.now().toString() + 'r0', text: '', image: undefined }] }]);
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
    canvasPaneRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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
    canvasPaneRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelProgression = () => {
    setParentCardForProgression(null);
  };

  const switchCardType = (type: Card['type']) => {
    setCardType(type);
    if (!scenarioSubFormOpen) setIsScenarioMode(false);
    if (type === 'matching' && matchingPairs.length < 2) {
      setMatchingPairs([
        { id: Date.now().toString() + '1', left: '', leftImage: undefined, rights: [{ id: Date.now().toString() + 'r1', text: '', image: undefined }] },
        { id: Date.now().toString() + '2', left: '', leftImage: undefined, rights: [{ id: Date.now().toString() + 'r2', text: '', image: undefined }] },
      ]);
    }
  };

  const openCardPreview = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    setPreviewCardIndex(idx);
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

  const openAiModal = async () => {
    setAiNotes('');
    setAiInstructions('');
    setAiError(null);
    setAiPreviewCards([]);
    setAiModalOpen(true);
    if (currentUserId) {
      const remaining = await getRemainingGenerations(currentUserId).catch(() => null);
      setAiRemaining(remaining);
    }
  };

  const handleAiGenerate = async () => {
    if (!currentUserId || !aiNotes.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const cards = await generateCardsFromNotes(aiNotes.trim(), aiCardCount, currentUserId, aiSelectedTypes, aiInstructions.trim() || undefined);
      const marked: AiPreviewCard[] = cards.map(card => {
        const matches = findDuplicatesForCard(card, allIslands);
        if (matches.length === 0) return card;
        const loc = matches[0];
        const locationStr = loc.islandId === island.id ? `${loc.islandName} (this island)` : loc.islandName;
        return { ...card, _isDuplicate: true, _duplicateLocation: locationStr };
      });
      setAiPreviewCards(marked);
      setAiRemaining(prev => (prev !== null ? Math.max(0, prev - 1) : null));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Generation failed. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiSave = () => {
    if (aiSaving) return;
    setAiSaving(true);
    const cards = aiPreviewCards.filter(c => c.front.trim() && c.back.trim() && !c._isDuplicate);
    if (cards.length > 0) onAddCards(cards);
    setAiModalOpen(false);
    setAiPreviewCards([]);
    setAiNotes('');
    setAiSaving(false);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    // Don't show CSV overlay when dragging image files — let ImageUpload handle those
    const items = Array.from<DataTransferItem>(e.dataTransfer.items);
    const hasImage = items.some(item => item.kind === 'file' && item.type.startsWith('image/'));
    if (!hasImage) {
      setIsDragOver(true);
    }
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
  const chartingIndices = island.cards.reduce<number[]>((acc, c, i) => {
    if (c.status === 'charting' || c.needsWork) acc.push(i);
    return acc;
  }, []);
  const chartingCount = chartingIndices.length;
  const sailingCount = island.cards.filter(c => !c.status || c.status === 'sailing').length;
  const masteredCount = island.cards.filter(c => c.status === 'mastered').length;
  const graceMs = graceWindowMinutes * 60_000;
  const dueCount = getActiveTierCards(island.cards).filter(c => !c.srsNextReview || c.srsNextReview <= Date.now() + graceMs).length;
  const totalCards = island.cards.length;
  const progressPct = totalCards > 0 ? Math.round(masteredCount / totalCards * 100) : 0;
  const islandTotalAnswers = island.cards.reduce((s, c) => s + (c.totalAnswers || 0), 0);
  const islandTotalCorrect = island.cards.reduce((s, c) => s + (c.totalCorrect || 0), 0);
  const accuracyStat = islandTotalAnswers > 0 ? Math.round(islandTotalCorrect / islandTotalAnswers * 100) : null;
  const lastStudiedTs = totalCards > 0 ? Math.max(...island.cards.map(c => c.lastReviewed || 0)) : 0;
  const nextDueTs = island.cards.reduce((min, c) => {
    if (c.srsNextReview && c.srsNextReview > Date.now() + graceMs) return Math.min(min, c.srsNextReview);
    return min;
  }, Infinity);

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
      className="max-w-7xl mx-auto w-full relative"
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
            onClick={() => guardedNav(onBack)}
            className="w-10 h-10 sm:w-12 sm:h-12 mt-1 rounded-2xl glass flex items-center justify-center text-brand-muted hover:text-white transition-all shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setShowIslandImageModal(true)}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)] relative bg-black/40 flex items-center justify-center shrink-0 border-brand-border mt-1 cursor-pointer hover:border-white/30 hover:scale-105 transition-all"
            title="View full image"
          >
            <img
              src={imageSrc}
              alt={`${masteryLevel} island`}
              className="w-[130%] h-[130%] object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (masteryLevel === 'charting') target.src = 'https://images.unsplash.com/photo-1505672678657-cc7037095e60?auto=format&fit=crop&q=80&w=200&h=200';
                else if (masteryLevel === 'sailing') target.src = 'https://images.unsplash.com/photo-1544550581-5f7ceaf7f992?auto=format&fit=crop&q=80&w=200&h=200';
                else target.src = 'https://images.unsplash.com/photo-1523363065056-11f8b449174b?auto=format&fit=crop&q=80&w=200&h=200';
              }}
            />
          </button>

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

                <button
                  onClick={() => setScanModalOpen(true)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-brand-muted hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                  title="Scan for Duplicate Cards"
                >
                  <ScanLine className="w-4 h-4" />
                </button>

                {onResetIsland && (
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-brand-muted hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                    title="Reset Progress"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}

                {onArchiveIsland && !isCollabMember && (
                  <div className="relative">
                    <button
                      onClick={() => setShowArchiveConfirm(true)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-brand-muted hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                      title="Archive Island"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                    <AnimatePresence>
                      {showArchiveConfirm && (
                        <>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
                            onClick={() => setShowArchiveConfirm(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, x: -10 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9, x: -10 }}
                            className="absolute top-0 right-full mr-3 w-64 glass p-5 rounded-[24px] border border-amber-500/20 shadow-2xl z-[70] bg-amber-500/5 backdrop-blur-xl"
                          >
                            <p className="text-xs font-bold text-amber-400 mb-2">Archive Island?</p>
                            <p className="text-[10px] text-brand-muted leading-relaxed mb-4">
                              <span className="font-bold text-white">{island.name}</span> will be hidden from your main view. You can restore it any time from the Archive.
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  onArchiveIsland();
                                  setShowArchiveConfirm(false);
                                }}
                                className="flex-1 bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest py-2 rounded-xl hover:bg-amber-500/30 transition-colors"
                              >
                                Archive
                              </button>
                              <button
                                onClick={() => setShowArchiveConfirm(false)}
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
            {view === 'editor' ? (
              <button
                onClick={() => guardedNav(() => setView('home'))}
                className="flex items-center gap-1.5 text-sm font-semibold text-brand-muted hover:text-white transition-colors mb-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Island
              </button>
            ) : (
              <p className="text-brand-muted font-normal text-sm sm:text-base mb-2">Your sailing island.</p>
            )}
            {onUpdateIsland && archipelagos && archipelagos.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-brand-muted tracking-widest">Move to:</span>
                <div className="relative">
                  <select
                    value={island.archipelagoId || ''}
                    onChange={(e) => onUpdateIsland({ archipelagoId: e.target.value || undefined })}
                    className="bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white pl-2 pr-6 py-1 outline-none cursor-pointer hover:bg-white/10 transition-colors appearance-none"
                  >
                    <option value="" className="bg-[#111] text-brand-muted">None (standalone)</option>
                    {archipelagos.map(a => (
                      <option key={a.id} value={a.id} className="bg-[#111]">{a.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-brand-muted pointer-events-none" />
                </div>
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
                      onClick={() => setStudyMode('charting')}
                      disabled={chartingCount === 0}
                      className={cn(
                        "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-colors font-bold text-[10px] tracking-widest uppercase whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed",
                        studyMode === 'charting' ? "bg-red-500/20 text-red-400 border border-red-500/30" : "text-brand-muted hover:text-red-400"
                      )}
                    >
                      Charting ({chartingCount})
                    </button>
                    <button
                      onClick={() => setStudyMode('sailing')}
                      disabled={sailingCount === 0}
                      className={cn(
                        "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-colors font-bold text-[10px] tracking-widest uppercase whitespace-nowrap disabled:opacity-30 disabled:cursor-not-allowed",
                        studyMode === 'sailing' ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-brand-muted hover:text-amber-400"
                      )}
                    >
                      Sailing ({sailingCount})
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
                onClick={() => guardedNav(() => onStartStudy(studyMode))}
                className="btn-primary h-12 px-8 flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest shadow-[0_10px_20px_rgba(66,133,244,0.3)] animate-pulse hover:animate-none group"
              >
                <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                Launch Session
              </button>
            </>
          )}
        </div>
      </header>

      {view === 'home' && (
        <HomeViewStats
          totalCards={totalCards}
          progressPct={progressPct}
          chartingCount={chartingCount}
          sailingCount={sailingCount}
          masteredCount={masteredCount}
          progressTrackingMode={progressTrackingMode}
          accuracyStat={accuracyStat}
          islandTotalCorrect={islandTotalCorrect}
          islandTotalAnswers={islandTotalAnswers}
          lastStudiedTs={lastStudiedTs}
          dueCount={dueCount}
          nextDueTs={nextDueTs}
          onShowCharting={() => setShowChartingCards(true)}
          onNavigateToEditor={() => setView('editor')}
        />
      )}

      {view === 'editor' && (
        <>
        {/* Three-Pane Workspace */}
        {/* Mobile drawer backdrop */}
      <AnimatePresence>
        {leftDrawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setLeftDrawerOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:max-h-[calc(100vh-200px)] md:overflow-hidden rounded-[32px] border border-brand-border bg-brand-card">

        {/* ── LEFT PANE: Knowledge Matrix ── */}
        {/* Mobile: fixed slide-out drawer; Desktop: inline collapsible sidebar */}
        <div className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-brand-card border-r border-brand-border overflow-hidden transition-transform duration-300",
          leftDrawerOpen ? "translate-x-0" : "-translate-x-full",
          "md:relative md:inset-auto md:z-auto md:translate-x-0 md:transition-all md:duration-300 md:shrink-0",
          leftPaneOpen ? "md:w-64" : "md:w-0"
        )}>
          <div className="h-12 flex items-center justify-between px-4 border-b border-brand-border shrink-0">
            <span className="text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium truncate">
              Knowledge Matrix <span className="text-white/30">({island.cards.length})</span>
            </span>
            <button
              onClick={() => setLeftDrawerOpen(false)}
              className="md:hidden text-brand-muted hover:text-white transition-colors shrink-0 ml-2"
              aria-label="Close card list"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {island.cards.length > 0 && (
            <div className="px-3 py-2 border-b border-brand-border shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-brand-muted pointer-events-none" />
                <input
                  type="text"
                  value={cardSearch}
                  onChange={e => setCardSearch(e.target.value)}
                  placeholder="Search cards…"
                  className="w-full bg-white/5 border border-white/5 rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-white placeholder-brand-muted/50 focus:outline-none focus:border-brand-primary/40 transition-colors"
                />
                {cardSearch && (
                  <button
                    onClick={() => setCardSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
            {island.cards.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-brand-border p-6 flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-brand-muted/40" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white/40 mb-1">No cards yet</p>
                  <p className="text-[10px] text-brand-muted/40">Build your first card on the canvas</p>
                </div>
                <div className="flex gap-2">
                  {currentUserId && (
                    <button
                      type="button"
                      onClick={openAiModal}
                      className="flex items-center gap-1.5 text-[10px] text-brand-primary px-3 py-1.5 rounded-xl bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/20 transition-all"
                    >
                      <Sparkles className="w-3 h-3" />
                      Generate with AI
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-[10px] text-brand-muted hover:text-white px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
                  >
                    <Upload className="w-3 h-3" />
                    Import CSV
                  </button>
                </div>
              </div>
            ) : (() => {
              const filteredCards = cardSearch.trim()
                ? displayCards.filter(({ card }) => {
                    const q = cardSearch.toLowerCase();
                    return (
                      card.front?.toLowerCase().includes(q) ||
                      card.back?.toLowerCase().includes(q) ||
                      card.scenarioText?.toLowerCase().includes(q)
                    );
                  })
                : displayCards;
              if (filteredCards.length === 0) return (
                <p className="text-[10px] text-brand-muted/50 text-center py-4">No cards match "{cardSearch}"</p>
              );
              return filteredCards.map(({ card, originalIdx: idx }, displayIdx) => {
                const prevSid = displayIdx > 0 ? filteredCards[displayIdx - 1].card.scenarioId : undefined;
                const isGroupStart = !!card.scenarioId && card.scenarioId !== prevSid;
                const isGroupMember = !!card.scenarioId && card.scenarioId === prevSid;
                const groupSize = card.scenarioId ? island.cards.filter(c => c.scenarioId === card.scenarioId).length : 0;
                return (
                <React.Fragment key={`frag-${idx}`}>
                  {isGroupStart && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-sky-500/5 border border-sky-500/15">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-3 h-3 text-sky-400 shrink-0" />
                        <p className="text-[9px] text-white/50 line-clamp-1">
                          {card.scenarioText?.slice(0, 40)}{(card.scenarioText?.length ?? 0) > 40 ? '…' : ''}
                        </p>
                      </div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-sky-400/70 shrink-0 ml-1">{groupSize}Q</span>
                    </div>
                  )}
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: displayIdx * 0.03 }}
                  key={idx}
                  onClick={() => handleEditCard(idx)}
                  style={{ marginLeft: card.tier && card.tier > 1 ? `${(card.tier - 1) * 16}px` : isGroupMember || isGroupStart ? '8px' : undefined }}
                  className={cn(
                    "glass rounded-xl p-3 border-white/5 group relative cursor-pointer hover:border-brand-primary/30 transition-colors",
                    editingCardIndex === idx && "border-brand-primary bg-brand-primary/5",
                    card.scenarioId && "border-l-2 border-l-sky-500/20"
                  )}
                >
                  {card.tier && card.tier > 1 && (
                    <div className="absolute -left-3 top-1/2 -mt-3 w-3 h-6 border-l-2 border-b-2 border-white/20 rounded-bl-lg pointer-events-none" />
                  )}
                  {card.scenarioId && (
                    <div className="absolute top-1.5 left-1.5 text-[7px] font-black uppercase tracking-widest text-sky-400/50">
                      Q{card.scenarioOrder}
                    </div>
                  )}
                  <div className="relative flex items-center justify-center min-h-[24px]">
                    <div className="absolute left-0 w-6 h-6 rounded-md bg-white/5 flex items-center justify-center shrink-0">
                      {(card.type === 'mcq' || card.type === 'multi-select') ? (
                        <div className={cn("text-[7px] uppercase font-black", card.needsWork ? "text-amber-400" : "text-brand-primary")}>MCQ</div>
                      ) : card.type === 'fill-in-the-blank' ? (
                        <Type className={cn("w-3 h-3", card.needsWork ? "text-amber-400" : "text-purple-400")} />
                      ) : card.type === 'sequencing' ? (
                        <ListOrdered className={cn("w-3 h-3", card.needsWork ? "text-amber-400" : "text-cyan-400")} />
                      ) : (
                        <CreditCard className={cn("w-3 h-3", card.needsWork ? "text-amber-400" : "text-brand-muted")} />
                      )}
                    </div>
                    <p className="font-bold text-xs truncate leading-tight text-center w-full px-8">{card.front}</p>
                    <div className="absolute right-0 flex items-center gap-1 shrink-0">
                      {card.totalAnswers != null && card.totalAnswers > 0 && (
                        <span className={cn(
                          "text-[8px] font-bold tabular-nums",
                          (card.totalCorrect ?? 0) / card.totalAnswers < 0.4 ? "text-red-400/70" :
                          (card.totalCorrect ?? 0) / card.totalAnswers < 0.7 ? "text-amber-400/70" :
                          "text-emerald-400/70"
                        )}>
                          {Math.round((card.totalCorrect ?? 0) / card.totalAnswers * 100)}%
                        </span>
                      )}
                      {card.tier && card.tier > 1 && (
                        <span className="text-[7px] font-black uppercase bg-white/10 px-1 py-0.5 rounded text-white/50">T{card.tier}</span>
                      )}
                    </div>
                  </div>
                </motion.div>
                </React.Fragment>
                );
              });
            })()}
          </div>
        </div>

        {/* ── COLLAPSE TOGGLE (desktop only) ── */}
        <div className="hidden md:flex relative shrink-0 items-center">
          <button
            onClick={() => setLeftPaneOpen(!leftPaneOpen)}
            className="absolute left-0 z-10 w-5 h-10 flex items-center justify-center bg-brand-card border border-brand-border rounded-r-xl text-brand-muted hover:text-white transition-colors"
            title={leftPaneOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {leftPaneOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        </div>

        {/* ── CENTER PANE: Live Canvas ── */}
        <div ref={canvasPaneRef} className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-[#080818] min-w-0">

          {/* Canvas header bar */}
          <div className="h-12 flex items-center justify-between px-4 sm:px-6 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLeftDrawerOpen(true)}
                className="md:hidden flex items-center gap-1.5 text-[10px] bg-white/5 hover:bg-white/10 text-brand-muted hover:text-white px-2.5 py-1.5 rounded-lg border border-white/5 transition-all"
                aria-label="View cards"
              >
                <Menu className="w-3 h-3" />
                Cards
              </button>
              <span className="text-[10px] text-white/30 uppercase tracking-widest font-medium flex items-center gap-2">
                {editingCardIndex !== null ? 'Editing Card' : parentCardForProgression ? `Progression — Tier ${(parentCardForProgression.tier || 1) + 1}` : 'New Card'}
                {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={handleExport}
                  className="text-[10px] flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-brand-muted hover:text-white px-2.5 py-1.5 rounded-lg border border-white/5 transition-all"
                >
                  <Download className="w-3 h-3" />
                  Export
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
                            onClick={() => { downloadFlashcards(); setShowExportModal(false); }}
                            className="w-full text-left bg-white/5 hover:bg-white/10 text-brand-muted hover:text-white text-[10px] uppercase tracking-widest font-bold py-2.5 px-3 rounded-xl transition-colors border border-white/5"
                          >
                            Download Flashcards
                          </button>
                          <button
                            onClick={() => { downloadMcqs(); setShowExportModal(false); }}
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
              <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              {currentUserId && (
                <button
                  onClick={openAiModal}
                  className="text-[10px] flex items-center gap-1.5 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary px-2.5 py-1.5 rounded-lg border border-brand-primary/20 transition-all"
                >
                  <Sparkles className="w-3 h-3" />
                  AI
                </button>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="text-[10px] flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-brand-muted hover:text-white px-2.5 py-1.5 rounded-lg border border-white/5 transition-all"
              >
                <Upload className="w-3 h-3" />
                {isUploading ? 'Parsing…' : 'Import'}
              </button>
            </div>
          </div>

          {/* Canvas form body */}
          <form
            id="card-builder-form"
            onSubmit={handleSubmit}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLFormElement).requestSubmit(); } }}
            className="flex-1 flex flex-col px-4 sm:px-8 md:px-12 py-6 md:py-10 gap-6"
          >
            {parentCardForProgression && (
              <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-xl p-4 flex items-start justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-brand-primary mb-1">Charting on:</p>
                  <p className="text-sm text-white line-clamp-2">{parentCardForProgression.front}</p>
                </div>
                <button type="button" onClick={handleCancelProgression} className="text-brand-muted hover:text-white mt-1 shrink-0 ml-4">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Scenario creation mode */}
            {isScenarioMode && !scenarioSubFormOpen && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
                  <span className={cn("px-2.5 py-1 rounded-full transition-colors", scenarioPassage.trim() ? "bg-sky-500/20 text-sky-400" : "bg-sky-500 text-white")}>1 · Passage</span>
                  <span className="text-white/20">›</span>
                  <span className={cn("px-2.5 py-1 rounded-full transition-colors", scenarioQuestions.length > 0 ? "bg-sky-500/20 text-sky-400" : scenarioPassage.trim() ? "bg-sky-500 text-white" : "text-white/20")}>2 · Questions</span>
                  <span className="text-white/20">›</span>
                  <span className={cn("px-2.5 py-1 rounded-full transition-colors", scenarioQuestions.length > 0 ? "bg-sky-500 text-white" : "text-white/20")}>3 · Save</span>
                </div>
                <div>
                  <label className="block text-[10px] text-sky-400 uppercase tracking-[0.2em] font-black mb-3">
                    Scenario / Passage
                  </label>
                  <FormatToolbar taRef={scenarioPassageRef} setter={setScenarioPassage} />
                  <textarea
                    ref={scenarioPassageRef}
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
                <FormatToolbar taRef={scenarioPassageRef} setter={setScenarioPassage} />
                <textarea
                  ref={scenarioPassageRef}
                  value={scenarioPassage}
                  onChange={e => setScenarioPassage(e.target.value)}
                  rows={4}
                  className="w-full bg-sky-500/5 border border-sky-500/20 rounded-2xl px-5 py-4 text-white outline-none focus:border-sky-500/50 transition-colors resize-none custom-scrollbar"
                />
              </div>
            )}

            {/* FRONT — canvas style */}
            {(!isScenarioMode || scenarioSubFormOpen) && (
              <div className="flex flex-col gap-2">
                <FormatToolbar taRef={frontRef} setter={setFront} />
                <textarea
                  ref={frontRef}
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab' && !['matching', 'sequencing', 'mcq'].includes(cardType)) {
                      e.preventDefault();
                      backRef.current?.focus();
                    }
                  }}
                  placeholder={['matching', 'sequencing'].includes(cardType) ? (cardType === 'matching' ? "Match the countries to their capitals…" : "Put the following in the correct order…") : "The concept to remember…"}
                  rows={3}
                  className="bg-transparent border-none outline-none resize-none w-full text-center text-2xl font-bold text-white placeholder:text-white/15 focus:ring-0 leading-relaxed"
                />
                {duplicateWarnings.length > 0 && (
                  <p className="text-[10px] text-amber-400/80 text-center leading-relaxed">
                    ⚠ Duplicate already in: {duplicateWarnings.map(d => d.islandName).join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Front/Back divider */}
            {(!isScenarioMode || scenarioSubFormOpen) && !['matching', 'sequencing', 'mcq'].includes(cardType) && (
              <div className="flex items-center gap-4 px-8">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] text-white/20 uppercase tracking-widest">Answer</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            )}

            {/* BACK — canvas style */}
            {(!isScenarioMode || scenarioSubFormOpen) && !['matching', 'sequencing', 'mcq'].includes(cardType) && (
              <div className="flex flex-col gap-2">
                <FormatToolbar taRef={backRef} setter={setBack} />
                <textarea
                  ref={backRef}
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                  placeholder="The detailed explanation…"
                  rows={3}
                  className="bg-transparent border-none outline-none resize-none w-full text-center text-xl text-white/80 placeholder:text-white/15 focus:ring-0 leading-relaxed"
                />
              </div>
            )}

            {/* Matching pairs */}
            {(!isScenarioMode || scenarioSubFormOpen) && cardType === 'matching' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <label className="block text-[10px] text-brand-primary uppercase tracking-[0.2em] font-black mb-1 mt-4">
                  Pairs
                </label>
                <div className="space-y-4">
                  {matchingPairs.map((pair, idx) => (
                    <div key={pair.id} className="rounded-xl border border-brand-border bg-white/3 p-3 space-y-2">
                      <div className="flex gap-2 items-start">
                        <div className="flex-1 space-y-1">
                          <span className="text-[9px] uppercase tracking-widest text-brand-muted font-bold">Term</span>
                          <input
                            value={pair.left}
                            onChange={(e) => {
                              const newPairs = [...matchingPairs];
                              newPairs[idx] = { ...newPairs[idx], left: e.target.value };
                              setMatchingPairs(newPairs);
                            }}
                            placeholder={pair.leftImage ? "Caption (optional)" : "Term text..."}
                            className="w-full bg-white/5 border border-brand-border rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50"
                          />
                          {pair.leftImage !== undefined && (
                            <ImageUpload
                              compact
                              value={pair.leftImage}
                              onChange={(url) => {
                                const newPairs = [...matchingPairs];
                                newPairs[idx] = { ...newPairs[idx], leftImage: url };
                                setMatchingPairs(newPairs);
                              }}
                            />
                          )}
                        </div>
                        <div className="flex flex-col gap-1 pt-5">
                          <button
                            type="button"
                            title="Add image to term"
                            onClick={() => {
                              const newPairs = [...matchingPairs];
                              newPairs[idx] = { ...newPairs[idx], leftImage: newPairs[idx].leftImage !== undefined ? undefined : '' };
                              setMatchingPairs(newPairs);
                            }}
                            className={cn("w-8 h-8 flex items-center justify-center rounded-lg transition-colors",
                              pair.leftImage !== undefined ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30" : "bg-white/5 text-brand-muted hover:text-white")}
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={matchingPairs.length <= 2}
                            onClick={() => setMatchingPairs(matchingPairs.filter((_, i) => i !== idx))}
                            className={cn("w-8 h-8 flex items-center justify-center rounded-lg transition-colors", matchingPairs.length <= 2 ? "opacity-30 cursor-not-allowed text-brand-muted" : "bg-white/5 text-brand-muted hover:bg-red-500/20 hover:text-red-400")}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5 pl-2 border-l-2 border-brand-primary/20">
                        <span className="text-[9px] uppercase tracking-widest text-brand-muted font-bold">Matches</span>
                        {pair.rights.map((right, rIdx) => (
                          <div key={right.id} className="space-y-1">
                            <div className="flex gap-2 items-center">
                              <input
                                value={right.text}
                                onChange={(e) => {
                                  const newPairs = [...matchingPairs];
                                  const newRights = [...newPairs[idx].rights];
                                  newRights[rIdx] = { ...newRights[rIdx], text: e.target.value };
                                  newPairs[idx] = { ...newPairs[idx], rights: newRights };
                                  setMatchingPairs(newPairs);
                                }}
                                placeholder={right.image ? "Caption (optional)" : "Match text..."}
                                className="flex-1 bg-white/5 border border-brand-border rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-brand-primary/50"
                              />
                              <button
                                type="button"
                                title="Add image to this match"
                                onClick={() => {
                                  const newPairs = [...matchingPairs];
                                  const newRights = [...newPairs[idx].rights];
                                  newRights[rIdx] = { ...newRights[rIdx], image: newRights[rIdx].image !== undefined ? undefined : '' };
                                  newPairs[idx] = { ...newPairs[idx], rights: newRights };
                                  setMatchingPairs(newPairs);
                                }}
                                className={cn("w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg transition-colors",
                                  right.image !== undefined ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30" : "bg-white/5 text-brand-muted hover:text-white")}
                              >
                                <ImageIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={pair.rights.length <= 1}
                                onClick={() => {
                                  const newPairs = [...matchingPairs];
                                  newPairs[idx] = { ...newPairs[idx], rights: newPairs[idx].rights.filter((_, i) => i !== rIdx) };
                                  setMatchingPairs(newPairs);
                                }}
                                className={cn("w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg transition-colors",
                                  pair.rights.length <= 1 ? "opacity-30 cursor-not-allowed text-brand-muted" : "bg-white/5 text-brand-muted hover:bg-red-500/20 hover:text-red-400")}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {right.image !== undefined && (
                              <ImageUpload
                                compact
                                value={right.image || undefined}
                                onChange={(url) => {
                                  const newPairs = [...matchingPairs];
                                  const newRights = [...newPairs[idx].rights];
                                  newRights[rIdx] = { ...newRights[rIdx], image: url };
                                  newPairs[idx] = { ...newPairs[idx], rights: newRights };
                                  setMatchingPairs(newPairs);
                                }}
                              />
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const newPairs = [...matchingPairs];
                            newPairs[idx] = {
                              ...newPairs[idx],
                              rights: [...newPairs[idx].rights, { id: Date.now().toString(), text: '', image: undefined }],
                            };
                            setMatchingPairs(newPairs);
                          }}
                          className="text-xs flex items-center gap-1.5 text-brand-muted hover:text-brand-primary transition-colors py-1"
                        >
                          <Plus className="w-3 h-3" /> Add match
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setMatchingPairs([...matchingPairs, { id: Date.now().toString(), left: '', leftImage: undefined, rights: [{ id: Date.now().toString() + 'r0', text: '', image: undefined }] }])}
                    className="text-xs mt-2 flex items-center justify-center border border-dashed border-white/20 hover:border-brand-primary/50 gap-2 text-brand-muted hover:text-brand-primary w-full py-3 rounded-xl transition-all"
                  >
                    <Plus className="w-4 h-4" /> Add Pair
                  </button>
                </div>
              </motion.div>
            )}

            {/* MCQ options */}
            {(!isScenarioMode || scenarioSubFormOpen) && cardType === 'mcq' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <div className="flex items-center justify-between mb-1 mt-4">
                  <label className="block text-[10px] text-brand-primary uppercase tracking-[0.2em] font-black">
                    Options
                  </label>
                  <button
                    type="button"
                    title={mcqLockOrder ? "Options will appear in the order you set them" : "Options will be shuffled into a random order each time the card is studied"}
                    onClick={() => setMcqLockOrder(!mcqLockOrder)}
                    className={cn("flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-lg transition-colors",
                      mcqLockOrder ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" : "bg-white/5 text-brand-muted hover:text-white border border-transparent")}
                  >
                    {mcqLockOrder ? <Lock className="w-3 h-3" /> : <Shuffle className="w-3 h-3" />}
                    {mcqLockOrder ? 'Order locked' : 'Shuffle on'}
                  </button>
                </div>
                <div className="space-y-2">
                  {mcqInlineOptions.map((opt, idx) => (
                    <div key={opt.id}>
                      <div className={cn("flex gap-2 items-center p-1 rounded-xl border", opt.isCorrect ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/15")}>
                        <button
                          type="button"
                          title={opt.isCorrect ? "Correct answer — click to make distractor" : "Distractor (incorrect) — click to make correct"}
                          onClick={() => {
                            setMcqInlineOptions(mcqInlineOptions.map((o, i) => i === idx ? { ...o, isCorrect: !o.isCorrect } : o));
                            setTimeout(() => mcqOptionRefs.current[idx]?.focus(), 0);
                          }}
                          className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full transition-colors hover:scale-110"
                        >
                          {opt.isCorrect
                            ? <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                            : <XCircle className="w-6 h-6 text-red-400/60 hover:text-red-400" />}
                        </button>
                        <input
                          ref={(el) => { mcqOptionRefs.current[idx] = el; }}
                          value={opt.text}
                          onChange={(e) => {
                            const updated = [...mcqInlineOptions];
                            updated[idx] = { ...updated[idx], text: e.target.value };
                            setMcqInlineOptions(updated);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Tab' && !e.shiftKey) {
                              const next = mcqOptionRefs.current[idx + 1];
                              if (next) { e.preventDefault(); next.focus(); }
                            }
                          }}
                          placeholder={opt.imageUrl ? "Caption (optional)" : opt.isCorrect ? "Correct answer..." : `Distractor ${idx}...`}
                          className="flex-1 min-w-0 bg-white/5 border border-brand-border rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-brand-primary/50"
                        />
                        <button
                          type="button"
                          title="Add image to this option"
                          onClick={() => {
                            const newSet = new Set(expandedMcqImg);
                            if (newSet.has(opt.id)) newSet.delete(opt.id); else newSet.add(opt.id);
                            setExpandedMcqImg(newSet);
                          }}
                          className={cn("w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl transition-colors",
                            expandedMcqImg.has(opt.id) || opt.imageUrl ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30" : "bg-white/5 text-brand-muted hover:text-white border border-transparent")}
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Add explanation for this option (shown after answering)"
                          onClick={() => {
                            const newSet = new Set(expandedMcqExp);
                            if (newSet.has(opt.id)) newSet.delete(opt.id); else newSet.add(opt.id);
                            setExpandedMcqExp(newSet);
                          }}
                          className={cn("w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl transition-colors",
                            expandedMcqExp.has(opt.id) || opt.explanation ? "bg-brand-primary/10 text-brand-primary border border-brand-primary/30" : "bg-white/5 text-brand-muted hover:text-white border border-transparent")}
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Remove this option"
                          disabled={mcqInlineOptions.length <= 2}
                          onClick={() => setMcqInlineOptions(mcqInlineOptions.filter((_, i) => i !== idx))}
                          className={cn("w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl transition-colors",
                            mcqInlineOptions.length <= 2 ? "opacity-30 cursor-not-allowed text-brand-muted" : "bg-white/5 text-brand-muted hover:bg-red-500/20 hover:text-red-400")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {(expandedMcqImg.has(opt.id) || opt.imageUrl) && (
                        <div className="mt-1 px-1">
                          <ImageUpload
                            compact
                            value={opt.imageUrl}
                            onChange={(url) => {
                              const updated = [...mcqInlineOptions];
                              updated[idx] = { ...updated[idx], imageUrl: url };
                              setMcqInlineOptions(updated);
                            }}
                          />
                        </div>
                      )}
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
              </motion.div>
            )}

            {/* Sequencing items */}
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

            {/* Hotspot Image editor — always visible for hotspot card type */}
            {(!isScenarioMode || scenarioSubFormOpen) && cardType === 'hotspot' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <label className="block text-[10px] text-brand-primary uppercase tracking-[0.2em] font-black mb-1 mt-4">
                  Hotspot Image
                </label>
                <p className="text-[10px] text-brand-muted mb-4 font-bold border-l-2 border-brand-primary/50 pl-3 py-1 bg-brand-primary/5 rounded-r-lg">
                  Upload an image, click to place the answer zone, then type the question. Use "Add to Set" to add multiple questions on the same image.
                </p>
                <div className="space-y-4">
                  <ImageUpload
                    label="Hotspot Image (required)"
                    value={imageUrl}
                    onChange={(url) => { setImageUrl(url); if (!url) { setHotspotZone(null); setHotspotQuestions([]); } }}
                  />
                  {imageUrl && (
                    <HotspotEditor
                      imageUrl={imageUrl}
                      zone={hotspotZone}
                      onZoneChange={setHotspotZone}
                      existingZones={hotspotQuestions.map((q, i) => ({ zone: q.zone, index: i }))}
                    />
                  )}

                  {/* Questions already locked into the set */}
                  {hotspotQuestions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium">
                        Questions in set
                      </p>
                      {hotspotQuestions.map((q, i) => (
                        <div key={q.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
                          <span className="text-[10px] font-black text-white shrink-0 w-5 h-5 rounded-full bg-indigo-500/70 flex items-center justify-center">
                            {i + 1}
                          </span>
                          <p className="text-sm text-white/70 flex-1 truncate">{q.front}</p>
                          <button
                            type="button"
                            onClick={() => setHotspotQuestions(prev => prev.filter((_, j) => j !== i))}
                            className="text-brand-muted hover:text-red-400 transition-colors shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* "Add to Set" — locks in the current question and starts the next */}
                  {imageUrl && hotspotZone && front.trim() && (!isScenarioMode || scenarioSubFormOpen) && (
                    <button
                      type="button"
                      onClick={handleAddToHotspotSet}
                      className="w-full flex items-center justify-center gap-2 border border-dashed border-brand-primary/40 hover:border-brand-primary/80 text-brand-primary/70 hover:text-brand-primary py-3 rounded-xl text-xs font-bold transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Add to Set
                      {hotspotQuestions.length > 0 && (
                        <span className="ml-1 text-brand-muted">({hotspotQuestions.length} so far)</span>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Image upload — controlled by right-pane toggle */}
            {showImageField && (!isScenarioMode || scenarioSubFormOpen) && (cardType === 'flashcard' || cardType === 'mcq' || cardType === 'fill-in-the-blank') && (
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
                    <ImageUpload label="Back Image (optional)" value={backImageUrl} onChange={setBackImageUrl} />
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

            {/* Hint — controlled by right-pane toggle */}
            {showHintField && (!isScenarioMode || scenarioSubFormOpen) && (
              <div>
                <label className="block text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-3">Hint</label>
                <FormatToolbar taRef={hintRef} setter={setHint} />
                <textarea
                  ref={hintRef}
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="Provide a hint if the user gets stuck…"
                  rows={2}
                  className="w-full bg-white/5 border border-brand-border rounded-2xl px-5 py-4 text-white outline-none focus:border-brand-primary/50 transition-colors resize-none custom-scrollbar"
                />
              </div>
            )}

            {/* Explanation — controlled by right-pane toggle */}
            {showExplanationField && (!isScenarioMode || scenarioSubFormOpen) && (
              <div>
                <label className="block text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-3">
                  Explanation <span className="text-brand-muted/40 normal-case tracking-normal">(shown after incorrect answers)</span>
                </label>
                <FormatToolbar taRef={explanationRef} setter={setExplanation} />
                <textarea
                  ref={explanationRef}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Explain why the answer is correct…"
                  rows={2}
                  className="w-full bg-white/5 border border-brand-border rounded-2xl px-5 py-4 text-white outline-none focus:border-brand-primary/50 transition-colors resize-none custom-scrollbar"
                />
              </div>
            )}

            <div className="flex-1" />
          </form>
        </div>

        {/* ── RIGHT PANE: Settings Inspector ── */}
        <div className="w-full md:w-[280px] shrink-0 flex flex-col border-t border-l-0 md:border-t-0 md:border-l border-brand-border overflow-visible md:overflow-y-auto custom-scrollbar">

          {/* Section 1 — Card Type */}
          <div className="p-4 border-b border-brand-border">
            <p className="text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-3">Card Type</p>
            <div className="flex flex-col gap-1.5">
              {([
                { type: 'flashcard' as const, label: 'Flashcard', Icon: CreditCard },
                { type: 'mcq' as const, label: 'Multiple Choice', Icon: CheckSquare },
                { type: 'matching' as const, label: 'Match', Icon: Repeat2 },
                { type: 'sequencing' as const, label: 'Order', Icon: ListOrdered },
                { type: 'fill-in-the-blank' as const, label: 'Fill in the Blank', Icon: Type },
                { type: 'hotspot' as const, label: 'Hotspot Image', Icon: Target },
              ] as const).map(({ type, label, Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => switchCardType(type)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors text-left",
                    !isScenarioMode && cardType === type ? "bg-brand-primary text-white" : "bg-white/5 text-brand-muted hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsScenarioMode(true)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors text-left",
                  isScenarioMode ? "bg-sky-500 text-white" : "bg-white/5 text-brand-muted hover:bg-white/10 hover:text-white"
                )}
              >
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                Scenario / Vignette
              </button>
            </div>
          </div>

          {/* Section 2 — Card Features */}
          <div className={cn("p-4 border-b border-brand-border transition-opacity", isScenarioMode && !scenarioSubFormOpen && "opacity-40 pointer-events-none")}>
            <p className="text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-3">Card Features</p>
            <div className="flex flex-col gap-3">
              {([
                { label: 'Hint', value: showHintField, setter: setShowHintFieldSticky },
                { label: 'Explanation', value: showExplanationField, setter: setShowExplanationFieldSticky },
                ...(['flashcard', 'mcq', 'fill-in-the-blank'].includes(cardType)
                  ? [{ label: 'Image', value: showImageField, setter: setShowImageFieldSticky }]
                  : []),
                // Hotspot cards always show their image editor; no toggle needed
              ] as { label: string; value: boolean; setter: (v: boolean) => void }[]).map(({ label, value, setter }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-white/70 font-medium">{label}</span>
                  <button
                    type="button"
                    onClick={() => setter(!value)}
                    aria-label={`Toggle ${label}`}
                    className={cn("relative w-10 h-5 rounded-full transition-colors", value ? "bg-brand-primary" : "bg-white/20")}
                  >
                    <span className={cn(
                      "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                      value ? "translate-x-5" : "translate-x-0"
                    )} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3 — Card Actions */}
          <div className={cn("p-4 border-b border-brand-border", editingCardIndex === null && "opacity-40 pointer-events-none")}>
            <p className="text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-3">Card Actions</p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={(e) => editingCardIndex !== null && openCardPreview(e as React.MouseEvent, editingCardIndex)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors text-left bg-white/5 text-brand-muted hover:bg-white/10 hover:text-white"
              >
                <Eye className="w-3.5 h-3.5 shrink-0" />
                View Card
              </button>
              <button
                type="button"
                onClick={() => editingCardIndex !== null && handleAddProgression(editingCardIndex)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors text-left bg-white/5 text-brand-muted hover:bg-white/10 hover:text-white"
              >
                <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                Add Progression Tier
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editingCardIndex === null) return;
                  const src = island.cards[editingCardIndex];
                  onAddCard({ ...src, id: Math.random().toString(36).substring(2, 11), status: undefined, consecutiveCorrect: 0, lastReviewed: undefined, needsWork: false });
                }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors text-left bg-white/5 text-brand-muted hover:bg-white/10 hover:text-white"
              >
                <Copy className="w-3.5 h-3.5 shrink-0" />
                Duplicate Card
              </button>
              {onMoveCard && (
                <button
                  type="button"
                  onClick={() => editingCardIndex !== null && setMovingCardIndex(editingCardIndex)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors text-left bg-white/5 text-brand-muted hover:bg-white/10 hover:text-white"
                >
                  <Move className="w-3.5 h-3.5 shrink-0" />
                  Move to Island
                </button>
              )}
              {onDeleteCard && (
                <AnimatePresence mode="wait">
                  {deletingCardIndex !== null ? (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20"
                    >
                      <span className="text-xs text-red-400 font-bold">Delete this card?</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDeletingCardIndex(null)}
                          className="text-brand-muted hover:text-white transition-colors text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (editingCardIndex === null) return;
                            onDeleteCard(editingCardIndex);
                            setDeletingCardIndex(null);
                            handleCancelEdit();
                          }}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="delete"
                      type="button"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => editingCardIndex !== null && setDeletingCardIndex(editingCardIndex)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors text-left bg-white/5 text-red-400/60 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      Delete Card
                    </motion.button>
                  )}
                </AnimatePresence>
              )}
            </div>
          </div>

          <div className="flex-1" />

          {/* Section 4 — Sticky Save CTA */}
          <div className="p-4 border-t border-brand-border shrink-0 sticky bottom-0 bg-brand-card md:static md:bg-transparent">
            {isScenarioMode && !scenarioSubFormOpen && (
              <button
                type="button"
                onClick={handleScenarioSubmit}
                disabled={!scenarioPassage.trim() || scenarioQuestions.length === 0}
                className="btn-primary w-full h-12 disabled:opacity-50 text-sm"
              >
                Save Scenario ({scenarioQuestions.length} Qs)
              </button>
            )}
            {isScenarioMode && scenarioSubFormOpen && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScenarioSubFormOpen(false)}
                  className="w-1/3 h-12 rounded-[14px] bg-white/5 border border-brand-border text-brand-muted hover:text-white text-sm transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleAddScenarioQuestion}
                  disabled={!front.trim() || (!['matching', 'sequencing', 'mcq'].includes(cardType) && !back.trim())}
                  className="btn-primary h-12 w-2/3 disabled:opacity-50 text-sm"
                >
                  Add to Group
                </button>
              </div>
            )}
            {!isScenarioMode && (
              <div className="flex gap-2">
                {editingCardIndex !== null && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="w-1/3 h-12 rounded-[14px] bg-white/5 border border-brand-border text-brand-muted hover:text-white text-sm transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  form="card-builder-form"
                  type="submit"
                  disabled={
                    !front.trim() ||
                    (!['matching', 'sequencing', 'mcq', 'hotspot'].includes(cardType) && !back.trim()) ||
                    (cardType === 'mcq' && (mcqInlineOptions.filter(o => o.text.trim() || o.imageUrl).length < 2 || !mcqInlineOptions.some(o => o.isCorrect))) ||
                    (cardType === 'matching' && matchingPairs.filter(p => (p.left.trim() || p.leftImage) && p.rights.some(r => r.text.trim() || r.image)).length < 2) ||
                    (cardType === 'sequencing' && sequenceItems.filter(i => i.text.trim()).length < 2) ||
                    // Hotspot: disabled when nothing is ready to save
                    (cardType === 'hotspot' && (
                      !imageUrl ||
                      // No set built yet AND current pending question is incomplete
                      (hotspotQuestions.length === 0 && (!hotspotZone || !front.trim()))
                    ))
                  }
                  className={cn("btn-primary h-12 disabled:opacity-50 text-sm", editingCardIndex !== null ? "w-2/3" : "w-full")}
                >
                  {editingCardIndex !== null
                    ? 'Update Card'
                    : cardType === 'hotspot' && hotspotQuestions.length > 0
                      ? `Save Set (${hotspotQuestions.length + (hotspotZone && front.trim() ? 1 : 0)})`
                      : 'Save Card'}
                </button>
              </div>
            )}
          </div>

        </div>
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
        {previewCardIndex !== null && (
          <CardPreviewModal
            card={island.cards[previewCardIndex]}
            onClose={closeCardPreview}
          />
        )}
      </AnimatePresence>
        </>
      )}

      {/* Charting Cards Modal */}
      <ChartingCardsModal
        isOpen={showChartingCards}
        onClose={() => setShowChartingCards(false)}
        island={island}
        chartingIndices={chartingIndices}
        chartingCount={chartingCount}
      />

      <ConfirmDialog
        open={showUnsavedWarning}
        title="Unsaved changes"
        message="You have unsaved content in the card editor. Leaving will discard it."
        confirmLabel="Discard & Leave"
        cancelLabel="Stay"
        danger={true}
        onConfirm={() => {
          setShowUnsavedWarning(false);
          pendingNavRef.current?.();
          pendingNavRef.current = null;
        }}
        onCancel={() => {
          setShowUnsavedWarning(false);
          pendingNavRef.current = null;
        }}
      />

      <ConfirmDialog
        open={showResetConfirm}
        title="Reset island progress?"
        message="All mastery data for this island will be cleared. Your cards and content are kept."
        confirmLabel="Reset"
        danger={true}
        onConfirm={async () => {
          setShowResetConfirm(false);
          if (onResetIsland) await onResetIsland(island.id);
        }}
        onCancel={() => setShowResetConfirm(false)}
      />

      {showIslandImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowIslandImageModal(false)}
        >
          <div
            className="relative max-w-2xl w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageSrc}
              alt={`${masteryLevel} island`}
              className="w-full h-auto rounded-2xl shadow-2xl"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (masteryLevel === 'charting') target.src = 'https://images.unsplash.com/photo-1505672678657-cc7037095e60?auto=format&fit=crop&q=80&w=800';
                else if (masteryLevel === 'sailing') target.src = 'https://images.unsplash.com/photo-1544550581-5f7ceaf7f992?auto=format&fit=crop&q=80&w=800';
                else target.src = 'https://images.unsplash.com/photo-1523363065056-11f8b449174b?auto=format&fit=crop&q=80&w=800';
              }}
            />
            <button
              onClick={() => setShowIslandImageModal(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* AI Card Generation Modal */}
      <AIGenerationModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        aiNotes={aiNotes}
        setAiNotes={setAiNotes}
        aiInstructions={aiInstructions}
        setAiInstructions={setAiInstructions}
        aiCardCount={aiCardCount}
        setAiCardCount={setAiCardCount}
        aiSelectedTypes={aiSelectedTypes}
        setAiSelectedTypes={setAiSelectedTypes}
        aiLoading={aiLoading}
        aiError={aiError}
        aiRemaining={aiRemaining}
        aiPreviewCards={aiPreviewCards}
        setAiPreviewCards={setAiPreviewCards}
        aiSaving={aiSaving}
        onGenerate={handleAiGenerate}
        onSave={handleAiSave}
      />

      {/* Duplicate Scanner Modal */}
      {scanModalOpen && (
        <DuplicateScanModal
          islands={(() => {
            const archipelagoId = island.archipelagoId;
            if (archipelagoId) {
              return allIslands.filter(i => i.archipelagoId === archipelagoId);
            }
            return [island];
          })()}
          scope={island.archipelagoId ? 'archipelago' : 'island'}
          onClose={() => setScanModalOpen(false)}
          onDeleteCard={(cardId, islandId) => {
            if (onDeleteCardById) {
              onDeleteCardById(cardId, islandId);
            } else if (islandId === island.id && onDeleteCard) {
              const idx = island.cards.findIndex(c => c.id === cardId);
              if (idx !== -1) onDeleteCard(idx);
            }
          }}
        />
      )}
    </div>
  );
}
