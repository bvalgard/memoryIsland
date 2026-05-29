import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import SocialLeaderboard from './SocialLeaderboard';
import { LayoutDashboard, Users, Settings, LogOut, Search, Bell, Plus, AlertCircle, X, Globe, Download, Check, Map, Play, BarChart2, Zap, Activity, Trophy, Award, Trash2, Calendar, RefreshCw, Compass, Pencil, Radio, CloudDownload, CloudOff, RotateCcw, GraduationCap, Upload, Navigation2, Archive, MoreHorizontal } from 'lucide-react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { useUserProgress, Island, CardStatus, CardUpdateRecord, Card } from '../hooks/useUserProgress';
import { useAchievements } from '../hooks/useAchievements';
import { Achievement, SessionMeta } from '../achievements';
import { cn, getActiveTierCards, formatTimeUntil } from '../lib/utils';
import AchievementToast from './AchievementToast';
import TrophyRoom from './TrophyRoom';
import NewIslandModal from './NewIslandModal';
import NewArchipelagoModal from './NewArchipelagoModal';
import IslandDetail from './IslandDetail';
import StudySession from './StudySession';
import TestSession from './TestSession';
import TestModeConfig from './TestModeConfig';
import TestModeHub from './TestModeHub';
import TestReport from './TestReport';
import ShareModal from './ShareModal';
import LightboxImage from './LightboxImage';
import { useSocial } from '../hooks/useSocial';
import ConfirmDialog from './ConfirmDialog';
import QuestionsBoard from './QuestionsBoard';
import { useQuestions } from '../hooks/useQuestions';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useLongPress } from '../hooks/useLongPress';
import { TestConfig, TestSessionDoc, TestDefinition, getTestHistory, saveTestSession, createTestDef, updateTestDef, getUserTestDefs } from '../hooks/useTestMode';
import AnkiImportModal from './AnkiImportModal';
import DuplicateScanModal from './DuplicateScanModal';
import { ScanLine } from 'lucide-react';

export default function Dashboard() {
  const user = auth.currentUser;
  const {
    progress,
    loading,
    addIsland,
    addArchipelago,
    addCardToIsland,
    updateIsland,
    removeIsland,
    updateSettings,
    addCardsToIsland,
    updateCardInIsland,
    removeCardFromIsland,
    moveCardBetweenIslands,
    processSessionResults,
    processArchipelagoResults,
    syncOfflineResults,
    syncOfflineArchipelagoResults,
    shareIsland,
    unshareIsland,
    shareArchipelago,
    unshareArchipelago,
    discoverIslands,
    discoverArchipelagos,
    importIsland,
    importArchipelago,
    importAnkiDecks,
    deletePublishedIsland,
    deletePublishedArchipelago,
    dismissShare,
    removeArchipelago,
    updateArchipelagos,
    renameArchipelago,
    createCollaborativeIsland,
    addCollaborator,
    removeCollaborator,
    createCollaborativeArchipelago,
    addArchipelagoCollaborator,
    removeArchipelagoCollaborator,
    resetIslandProgress,
    resetArchipelagoProgress,
    flagCardsForTomorrow,
    archiveArchipelago,
    unarchiveArchipelago,
    archiveIsland,
    unarchiveIsland,
  } = useUserProgress();
  const [selectedIslandId, setSelectedIslandId] = useState<string | null>(null);
  const [selectedArchipelagoId, setSelectedArchipelagoId] = useState<string | null>(() => {
    return localStorage.getItem('selectedArchipelagoId') || null;
  });
  const [isStudying, setIsStudying] = useState(false);
  const [studyMode, setStudyMode] = useState<'all' | 'struggling' | 'learning' | 'mastered' | 'due'>('all');
  const [studySelection, setStudySelection] = useState<Set<string> | null>(null);
  const [frozenStudySelection, setFrozenStudySelection] = useState<Set<string> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isArchipelagoModalOpen, setIsArchipelagoModalOpen] = useState(false);
  const [moveIslandId, setMoveIslandId] = useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'users' | 'settings' | 'stats' | 'leaderboard' | 'trophies' | 'distress' | 'discover' | 'testMode' | 'ankiImport' | 'archive' | 'duplicateScan' | null>(null);

  // Test Mode state
  const [isTestStudying, setIsTestStudying] = useState(false);
  const [testStudyCards, setTestStudyCards] = useState<Card[]>([]);
  const [testStudyConfig, setTestStudyConfig] = useState<TestConfig | null>(null);
  const [userTests, setUserTests] = useState<TestDefinition[]>([]);
  const [testSessions, setTestSessions] = useState<TestSessionDoc[]>([]);
  const [testLoading, setTestLoading] = useState(false);
  const [showTestConfig, setShowTestConfig] = useState(false);
  const [activeTestReport, setActiveTestReport] = useState<TestSessionDoc | null>(null);
  const [activeRunningTestId, setActiveRunningTestId] = useState<string | null>(null);
  const [distressInitialTab, setDistressInitialTab] = useState<'all' | 'mine'>('all');
  const [distressInitialQuestion, setDistressInitialQuestion] = useState<import('../hooks/useQuestions').Question | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const appLoadCheckDone = useRef(false);
  const defaultStudyModeApplied = useRef(false);

  // Offline sync
  const { isOnline, syncStatus, pendingCount, pin, unpin, queueSession, isPinned } = useOfflineSync({
    progress,
    syncOfflineResults,
    syncOfflineArchipelagoResults,
  });
  const [offlineQueuedToast, setOfflineQueuedToast] = useState(false);

  // Achievement system
  const { checkAndAwardAchievements } = useAchievements();
  const [toastQueue, setToastQueue] = useState<Achievement[]>([]);
  const [currentToast, setCurrentToast] = useState<Achievement | null>(null);

  const enqueueToasts = (achievements: Achievement[]) => {
    setToastQueue(prev => [...prev, ...achievements]);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Advance toast queue
  useEffect(() => {
    if (!currentToast && toastQueue.length > 0) {
      const [next, ...rest] = toastQueue;
      setCurrentToast(next);
      setToastQueue(rest);
    }
  }, [currentToast, toastQueue]);

  // Load test data when test mode panel opens
  useEffect(() => {
    if (activeModal !== 'testMode' || !user?.uid) return;
    setTestLoading(true);
    Promise.all([getUserTestDefs(user.uid), getTestHistory(user.uid)])
      .then(([defs, sessions]) => {
        setUserTests(defs);
        setTestSessions(sessions);
        setTestLoading(false);
      })
      .catch(() => setTestLoading(false));
  }, [activeModal, user?.uid]);

  // One-shot achievement check on first data load
  useEffect(() => {
    if (progress && !appLoadCheckDone.current) {
      appLoadCheckDone.current = true;
      checkAndAwardAchievements({ progress, trigger: 'app-load' })
        .then(unlocked => { if (unlocked.length) enqueueToasts(unlocked); });
    }
  }, [progress]);

  // Default study mode to "due" when SRS is active and cards are due
  useEffect(() => {
    if (defaultStudyModeApplied.current || !progress?.settings) return;
    defaultStudyModeApplied.current = true;
    if (progress.settings.progressTrackingMode === 'srs') {
      const now = Date.now();
      const effectGraceMs = (progress.settings.graceWindowMinutes ?? 0) * 60_000;
      const due = (progress.islands || []).flatMap(i => getActiveTierCards(i.cards)).filter(c => !c.srsNextReview || c.srsNextReview <= now + effectGraceMs).length;
      setStudyMode(due > 0 ? 'due' : 'all');
    }
  }, [progress?.settings]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'alpha-asc' | 'alpha-desc' | 'creation' | 'next-due' | 'most-struggling'>(() => {
    return (localStorage.getItem('islandSortOrder') as 'alpha-asc' | 'alpha-desc' | 'creation' | 'next-due' | 'most-struggling') || 'alpha-asc';
  });

  useEffect(() => {
    localStorage.setItem('islandSortOrder', sortOrder);
  }, [sortOrder]);

  // Detect when a collaborative island/archipelago is deleted by its owner while we're viewing it
  useEffect(() => {
    if (loading || !progress) return;
    if (selectedIslandId && selectedIslandId !== 'archipelago' && selectedIslandId !== 'multi-select') {
      const stillExists = (progress.islands || []).some(i => i.id === selectedIslandId);
      if (!stillExists) {
        setSelectedIslandId(null);
        setIsStudying(false);
        setDeletedCollabMessage('This island was deleted by its owner.');
      }
    }
  }, [progress?.islands, selectedIslandId, loading]);

  useEffect(() => {
    if (loading || !progress) return;
    if (selectedArchipelagoId) {
      const found = (progress.archipelagos || []).find(a => a.id === selectedArchipelagoId);
      if (!found) {
        setSelectedArchipelagoId(null);
        setIsStudying(false);
        setDeletedCollabMessage('This archipelago was deleted by its owner.');
      } else if (found.isArchived) {
        setSelectedArchipelagoId(null);
        setIsStudying(false);
      }
    }
  }, [progress?.archipelagos, selectedArchipelagoId, loading]);

  useEffect(() => {
    if (selectedArchipelagoId) {
      localStorage.setItem('selectedArchipelagoId', selectedArchipelagoId);
    } else {
      localStorage.removeItem('selectedArchipelagoId');
    }
  }, [selectedArchipelagoId]);

  // Questions — fetch my questions once on mount for bell notifications, plus reputation
  const { fetchMyQuestions, myQuestions, fetchMyReputation, closeQuestionForCard } = useQuestions();
  const [myReputation, setMyReputation] = useState<{ totalAnswers: number; totalAccepted: number; totalVotesReceived: number } | null>(null);
  useEffect(() => {
    if (user?.uid) fetchMyQuestions(user.uid);
  }, [user?.uid]);
  useEffect(() => {
    if (user?.uid) fetchMyReputation().then(rep => { if (rep) setMyReputation(rep); });
  }, [user?.uid]);

  // Discovery State
  const { searchUsers, sendFriendRequest, acceptFriendRequest, removeFriend, friends, sentRequests, friendRequests, error: socialError, fetchProfilesByUids, profiles: socialProfiles, loading: socialLoading, loadLeaderboard } = useSocial();
  const [discoverySearch, setDiscoverySearch] = useState('');
  const [discoveryTab, setDiscoveryTab] = useState<'islands' | 'archipelagos' | 'explorers'>('islands');
  const [discoveryExplorers, setDiscoveryExplorers] = useState<any[]>([]);
  const [discoveryInboundRequests, setDiscoveryInboundRequests] = useState<any[]>([]);
  const [discoveryFriends, setDiscoveryFriends] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [publicIslands, setPublicIslands] = useState<Island[]>([]);
  const [publicArchipelagos, setPublicArchipelagos] = useState<any[]>([]);
  const [inboundSharedIslands, setInboundSharedIslands] = useState<any[]>([]);
  const [inboundSharedArchipelagos, setInboundSharedArchipelagos] = useState<any[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [collabOwnerProfiles, setCollabOwnerProfiles] = useState<Record<string, string>>({});
  const [importingIslandId, setImportingIslandId] = useState<string | null>(null);
  const [importingArchipelagoId, setImportingArchipelagoId] = useState<string | null>(null);
  const [showShareArchipelagoConfirm, setShowShareArchipelagoConfirm] = useState(false);
  const [showUnshareArchipelagoConfirm, setShowUnshareArchipelagoConfirm] = useState(false);
  const [showDeleteArchipelagoConfirm, setShowDeleteArchipelagoConfirm] = useState(false);
  const [showResetArchipelagoConfirm, setShowResetArchipelagoConfirm] = useState(false);
  const [showArchiveArchipelagoConfirm, setShowArchiveArchipelagoConfirm] = useState(false);
  const [blindSpotOpen, setBlindSpotOpen] = useState(false);
  const [knowledgeGapOpen, setKnowledgeGapOpen] = useState(false);
  const [deletedCollabMessage, setDeletedCollabMessage] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  // Session draft — persists partial study sessions to localStorage so crashes / navigations don't lose progress
  interface SessionDraft {
    islandId: string;
    islandName: string;
    cardUpdates: CardUpdateRecord;
    scoreDelta: number;
    sessionMaxStreak: number;
    timestamp: number;
    isArchipelago: boolean;
  }
  const draftKey = user ? `mi_draft_${user.uid}` : null;
  const [sessionDraft, setSessionDraft] = useState<SessionDraft | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft: SessionDraft = JSON.parse(raw);
      if (Date.now() - draft.timestamp > 48 * 60 * 60 * 1000) {
        localStorage.removeItem(draftKey);
        return;
      }
      setSessionDraft(draft);
    } catch {
      // corrupt data — ignore
    }
  }, [draftKey]);
  const saveDraft = (
    islandId: string, islandName: string, cardUpdates: CardUpdateRecord,
    scoreDelta: number, sessionMaxStreak: number, isArchipelago: boolean,
  ) => {
    if (!draftKey) return;
    localStorage.setItem(draftKey, JSON.stringify({
      islandId, islandName, cardUpdates, scoreDelta, sessionMaxStreak,
      timestamp: Date.now(), isArchipelago,
    }));
  };
  const clearDraft = () => {
    if (!draftKey) return;
    localStorage.removeItem(draftKey);
    setSessionDraft(null);
  };
  const flushDraftToFirestore = async () => {
    if (!sessionDraft) return;
    setIsSavingDraft(true);
    try {
      if (sessionDraft.isArchipelago) {
        await processArchipelagoResults(sessionDraft.scoreDelta, sessionDraft.cardUpdates, sessionDraft.sessionMaxStreak);
      } else {
        await processSessionResults(sessionDraft.islandId, sessionDraft.scoreDelta, sessionDraft.cardUpdates, sessionDraft.sessionMaxStreak);
      }
      clearDraft();
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Persistence for "Read" state of badges (user-specific, loaded synchronously to avoid race)
  const uid = user?.uid ?? 'guest';
  const [seenNotificationIds, setSeenNotificationIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(`seen_notifs_${uid}`);
    return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
  });
  const [seenSocialIds, setSeenSocialIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(`seen_social_${uid}`);
    return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
  });
  const [seenDiscoverIds, setSeenDiscoverIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(`seen_discover_${uid}`);
    return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
  });
  const [isRenamingArchipelago, setIsRenamingArchipelago] = useState(false);
  const [renameArchipelagoValue, setRenameArchipelagoValue] = useState('');

  // Persist seen IDs to localStorage
  useEffect(() => {
    localStorage.setItem(`seen_notifs_${uid}`, JSON.stringify(Array.from(seenNotificationIds)));
  }, [seenNotificationIds, uid]);
  useEffect(() => {
    localStorage.setItem(`seen_social_${uid}`, JSON.stringify(Array.from(seenSocialIds)));
  }, [seenSocialIds, uid]);
  useEffect(() => {
    localStorage.setItem(`seen_discover_${uid}`, JSON.stringify(Array.from(seenDiscoverIds)));
  }, [seenDiscoverIds, uid]);

  useEffect(() => {
    // Load inbound requests profiles (for notifications)
    const loadRequests = async () => {
      if (friendRequests.length > 0) {
        const profiles = await fetchProfilesByUids(friendRequests);
        setDiscoveryInboundRequests(profiles);
      } else {
        setDiscoveryInboundRequests([]);
      }
    };
    loadRequests();
  }, [friendRequests]);

  useEffect(() => {
    // Load current friends profiles
    const loadFriends = async () => {
      if (friends.length > 0) {
        setIsLoadingFriends(true);
        const profiles = await fetchProfilesByUids(friends);
        setDiscoveryFriends(profiles);
        setIsLoadingFriends(false);
      } else {
        setDiscoveryFriends([]);
      }
    };
    if (activeModal === 'users') {
      loadFriends();
    }
  // friends.join(',') prevents re-runs when snapshot fires with the same UIDs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModal, friends.join(',')]);

  useEffect(() => {
    const collabIslandOwnerUids = (progress?.islands || [])
      .filter(i => i.isCollaborative && i.ownerId && i.ownerId !== user?.uid)
      .map(i => i.ownerId as string);
    const collabArchOwnerUids = (progress?.archipelagos || [])
      .filter(a => a.isCollaborative && a.ownerId && a.ownerId !== user?.uid)
      .map(a => a.ownerId as string);
    const ownerUids = [...new Set([...collabIslandOwnerUids, ...collabArchOwnerUids])];
    if (ownerUids.length === 0) return;
    fetchProfilesByUids(ownerUids).then(profiles => {
      const map: Record<string, string> = {};
      profiles.forEach(p => { map[p.uid] = p.displayName || 'A friend'; });
      setCollabOwnerProfiles(map);
    });
  }, [progress?.islands, progress?.archipelagos, user?.uid, fetchProfilesByUids]);

  useEffect(() => {
    if (activeModal === 'users') {
      if (discoveryTab !== 'explorers' && discoveryTab !== 'archipelagos' && discoveryTab !== 'islands') {
        setDiscoveryTab('explorers');
      }
      // Mark social items as seen when modal is open
      const newSeen = new Set(seenSocialIds);
      friendRequests.forEach(uid => newSeen.add(uid));
      if (newSeen.size !== seenSocialIds.size) setSeenSocialIds(newSeen);
    } else if (activeModal === 'discover') {
      if (discoveryTab !== 'islands' && discoveryTab !== 'archipelagos') {
        setDiscoveryTab('islands');
      }
      // Mark discovery items as seen
      const newSeen = new Set(seenDiscoverIds);
      inboundSharedIslands.forEach(i => newSeen.add(i.id));
      inboundSharedArchipelagos.forEach(a => newSeen.add(a.id));
      if (newSeen.size !== seenDiscoverIds.size) setSeenDiscoverIds(newSeen);
    }
  }, [activeModal, friendRequests, inboundSharedIslands, inboundSharedArchipelagos]);



  // Listener for shared content
  useEffect(() => {
    if (!user) return;

    const islandQuery = query(
      collection(db, 'published_islands'), 
      where('sharedWith', 'array-contains', user.uid),
      limit(20)
    );
    const archQuery = query(
      collection(db, 'published_archipelagos'), 
      where('sharedWith', 'array-contains', user.uid),
      limit(20)
    );

    const unsubIslands = onSnapshot(islandQuery, (snap) => {
      setInboundSharedIslands(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });
    const unsubArchs = onSnapshot(archQuery, (snap) => {
      setInboundSharedArchipelagos(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    return () => {
      unsubIslands();
      unsubArchs();
    };
  }, [user]);

  useEffect(() => {
    if (activeModal === 'discover' || activeModal === 'users') {
      if (discoveryTab === 'islands') {
        loadPublicIslands();
      } else if (discoveryTab === 'archipelagos') {
        loadPublicArchipelagos();
      } else if (discoveryTab === 'explorers') {
        const loadExplorers = async () => {
          if (discoverySearch.length < 2) {
            setDiscoveryExplorers([]);
            return;
          }
          setIsDiscovering(true);
          try {
            const explorers = await searchUsers(discoverySearch);
            setDiscoveryExplorers(explorers);
          } finally {
            setIsDiscovering(false);
          }
        };
        const timeoutId = setTimeout(loadExplorers, 500);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [activeModal, discoverySearch, discoveryTab]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Recently';
    const date = timestamp.toMillis ? new Date(timestamp.toMillis()) : new Date(timestamp);
    if (isNaN(date.getTime())) return 'Recently';
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const loadPublicIslands = async () => {
    setIsDiscovering(true);
    try {
      const islands = await discoverIslands(discoverySearch);
      const seen = new Set<string>();
      setPublicIslands(islands.filter(i => {
        if (seen.has(i.id)) return false;
        seen.add(i.id);
        return true;
      }));
    } finally {
      setIsDiscovering(false);
    }
  };

  const loadPublicArchipelagos = async () => {
    setIsDiscovering(true);
    try {
      const archipelagos = await discoverArchipelagos(discoverySearch);
      const seen = new Set<string>();
      setPublicArchipelagos(archipelagos.filter(a => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      }));
    } finally {
      setIsDiscovering(false);
    }
  };

  // Exclude imported (anchored from community) and archived islands from the main view and study
  const currentIslands = (progress?.islands || []).filter(i => !i.isImported && !i.isArchived);
  const islandsInArchipelago = selectedArchipelagoId 
    ? currentIslands.filter(island => island.archipelagoId === selectedArchipelagoId)
    : currentIslands;

  const filteredIslands = islandsInArchipelago
    .filter(island => island.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === 'alpha-asc') return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      if (sortOrder === 'alpha-desc') return b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' });
      if (sortOrder === 'creation') return (b.createdAt || 0) - (a.createdAt || 0);
      if (sortOrder === 'next-due') {
        const now = Date.now();
        const sortGraceMs = (progress?.settings?.graceWindowMinutes ?? 0) * 60_000;
        const getDueTime = (island: typeof a) => {
          const active = getActiveTierCards(island.cards);
          const due = active.filter(c => !c.srsNextReview || c.srsNextReview <= now + sortGraceMs);
          if (due.length > 0) return 0;
          const upcoming = active.map(c => c.srsNextReview ?? Infinity).filter(t => t > now + sortGraceMs);
          return upcoming.length > 0 ? Math.min(...upcoming) : Infinity;
        };
        return getDueTime(a) - getDueTime(b);
      }
      if (sortOrder === 'most-struggling') {
        const countStruggling = (island: typeof a) =>
          island.cards.filter(c => c.status === 'struggling' || c.needsWork).length;
        return countStruggling(b) - countStruggling(a);
      }
      return 0;
    });

  // Only show non-imported, non-archived archipelagos in the main view
  const ownedArchipelagos = (progress?.archipelagos || []).filter(a => !a.isImported && !a.isArchived);

  // True while the user has never completed a study session and has no islands yet.
  // Drives progressive disclosure: simplified nav + single-CTA header + actionable empty state.
  const isNewUser = !loading
    && (progress?.stats?.totalStudySessions ?? 0) === 0
    && currentIslands.length === 0;

  // Archived items for the Archive modal
  const archivedArchipelagos = (progress?.archipelagos || []).filter(a => !a.isImported && !!a.isArchived);
  const archivedIslands = (progress?.islands || []).filter(i => !i.isImported && !!i.isArchived);
  const allNonImportedIslands = (progress?.islands || []).filter(i => !i.isImported);

  const selectedArchipelago = ownedArchipelagos.find(a => a.id === selectedArchipelagoId);
  const archipelagoName = selectedArchipelago ? selectedArchipelago.name : 'The Archipelago';

  // Combine all cards for Archipelago Study (imported islands excluded)
  const allCards = islandsInArchipelago.flatMap(i => i.cards.map(c => ({ ...c, islandId: i.id, islandName: i.name }))) || [];
  const archipelagoIsland: Island = {
    id: 'archipelago',
    name: archipelagoName,
    color_score: islandsInArchipelago.reduce((acc, i) => acc + i.color_score, 0) || 0,
    cards: allCards
  };

  // Virtual island for cross-archipelago multi-select study
  // Uses frozenStudySelection so the island stays populated while studying
  const activeSelection = frozenStudySelection ?? studySelection;
  const multiSelectIslands = activeSelection
    ? currentIslands.filter(i => activeSelection.has(i.id))
    : [];
  const multiSelectIsland: Island = {
    id: 'multi-select',
    name: `${multiSelectIslands.length} Islands`,
    color_score: multiSelectIslands.reduce((acc, i) => acc + i.color_score, 0),
    cards: multiSelectIslands.flatMap(i => i.cards.map(c => ({ ...c, islandId: i.id, islandName: i.name }))),
  };

  // Adjusted counts for Archipelago
  const graceMs = (progress?.settings?.graceWindowMinutes ?? 0) * 60_000;
  const globalStrugglingCount = allCards.filter(c => c.status === 'struggling' || c.needsWork).length;
  const globalLearningCount = allCards.filter(c => (!c.status && !c.needsWork) || c.status === 'learning').length;
  const globalMasteredCount = allCards.filter(c => c.status === 'mastered').length;
  const globalDueCount = getActiveTierCards(allCards).filter(c => !c.srsNextReview || c.srsNextReview <= Date.now() + graceMs).length;

  // Learning insights computations
  const weakSpotCards = [...allCards]
    .filter(c => (c.demotionCount ?? 0) >= 2 || c.needsWork)
    .sort((a, b) => (b.demotionCount ?? 0) - (a.demotionCount ?? 0))
    .slice(0, 5);

  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  const forgettingCount = allCards.filter(c =>
    c.srsNextReview && c.srsNextReview > Date.now() && c.srsNextReview <= Date.now() + threeDaysMs
  ).length;

  const bestStudyHour = (() => {
    const hourStats = progress?.stats?.studyHourStats as Record<string, { sessions: number; correct: number; total: number }> | undefined;
    if (!hourStats) return null;
    let best: { hour: number; accuracy: number; sessions: number } | null = null;
    for (const [h, data] of Object.entries(hourStats)) {
      if (data.sessions < 3 || data.total === 0) continue;
      const accuracy = data.correct / data.total;
      if (!best || accuracy > best.accuracy) best = { hour: Number(h), accuracy, sessions: data.sessions };
    }
    return best;
  })();

  const trackingMode = progress?.settings?.progressTrackingMode ?? 'srs';

  // Blind Spot Matrix computation
  const blindSpotData = (() => {
    const classified = allCards.filter(c => (c.responseTimeSamples ?? 0) >= 1 && (c.totalAnswers ?? 0) > 0);
    if (classified.length === 0) return null;

    const byType: Record<string, number[]> = {};
    classified.forEach(c => {
      const t = c.type ?? 'flashcard';
      if (!byType[t]) byType[t] = [];
      if (c.avgNormalizedResponseMs) byType[t].push(c.avgNormalizedResponseMs);
    });
    const getMedian = (arr: number[]) => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    };
    const typeMedians: Record<string, number> = {};
    Object.entries(byType).forEach(([t, times]) => { typeMedians[t] = getMedian(times); });

    const ACCURACY_THRESHOLD = 0.8;
    const quadrants = {
      fastCorrect: [] as typeof classified,
      slowCorrect: [] as typeof classified,
      fastIncorrect: [] as typeof classified,
      slowIncorrect: [] as typeof classified,
    };
    classified.forEach(c => {
      const median = typeMedians[c.type ?? 'flashcard'] ?? 0;
      const isFast = (c.avgNormalizedResponseMs ?? Infinity) <= median;
      const accuracy = (c.totalCorrect ?? 0) / (c.totalAnswers ?? 1);
      if (isFast && accuracy >= ACCURACY_THRESHOLD) quadrants.fastCorrect.push(c);
      else if (!isFast && accuracy >= ACCURACY_THRESHOLD) quadrants.slowCorrect.push(c);
      else if (isFast && accuracy < ACCURACY_THRESHOLD) quadrants.fastIncorrect.push(c);
      else quadrants.slowIncorrect.push(c);
    });

    const pendingCount = allCards.filter(c => (c.responseTimeSamples ?? 0) === 0).length;
    return { quadrants, classifiedCount: classified.length, pendingCount };
  })();

  const formatStudyHour = (h: number) => {
    if (h >= 5 && h < 12) return `${h === 5 ? '5' : h}am`;
    if (h === 12) return '12pm';
    if (h > 12 && h < 17) return `${h - 12}pm`;
    if (h >= 17 && h < 21) return `${h - 12}pm`;
    return `${h > 12 ? h - 12 : h}${h >= 12 ? 'pm' : 'am'}`;
  };

  const friendRequestNotifications = (discoveryInboundRequests || []).map(profile => ({
    id: `friend_req_${profile.uid}`,
    islandId: 'social', // Special key to trigger social modal
    title: "Friend Request",
    message: `${profile.displayName} wants to be your explorer friend.`,
    type: 'info' as const,
    timestamp: Date.now() // Profiles don't have request timestamp, but this ensures they appear near top
  }));

  const islandShareNotifications = inboundSharedIslands.map(island => ({
    id: `share_island_${island.id}`,
    islandId: `share_island:${island.name}`,
    title: "Island Shared",
    message: `${island.authorName} shared the island "${island.name}" with you.`,
    type: 'info' as const,
    timestamp: island.publishedAt?.toMillis ? island.publishedAt.toMillis() : (island.createdAt || Date.now())
  }));

  const archipelagoShareNotifications = inboundSharedArchipelagos.map(arch => ({
    id: `share_arch_${arch.id}`,
    islandId: `share_arch:${arch.name}`,
    title: "Archipelago Shared",
    message: `${arch.authorName} shared the archipelago "${arch.name}" with you.`,
    type: 'info' as const,
    timestamp: arch.publishedAt?.toMillis ? arch.publishedAt.toMillis() : (arch.createdAt || Date.now())
  }));

  const questionResponseNotifications = myQuestions
    .filter(q => q.status === 'open' && q.answerCount > 0)
    .map(q => ({
      id: `question_response_${q.id}_${q.lastActivityAt?.seconds ?? 0}`,
      islandId: 'distress',
      title: 'Question Answered',
      message: `Someone answered your question about: "${q.frontText.slice(0, 60)}${q.frontText.length > 60 ? '…' : ''}"`,
      type: 'info' as const,
      timestamp: q.lastActivityAt?.seconds ? q.lastActivityAt.seconds * 1000 : Date.now(),
    }));

  const pendingAnswerBanner = myQuestions.find(
    q => q.status === 'open' && q.answerCount > 0 &&
      !seenNotificationIds.has(`question_response_${q.id}_${q.lastActivityAt?.seconds ?? 0}`)
  ) ?? null;

  const collabIslandInviteNotifications = (progress?.islands || [])
    .filter(i => i.isCollaborative && i.ownerId && i.ownerId !== user?.uid)
    .map(island => ({
      id: `collab_island_${island.id}`,
      islandId: `collab_island:${island.id}`,
      title: 'Crew Invite',
      message: `${collabOwnerProfiles[island.ownerId!] || 'A friend'} invited you to co-create "${island.name}"`,
      type: 'info' as const,
      timestamp: island.createdAt || Date.now(),
    }));

  const collabArchipelagoInviteNotifications = (progress?.archipelagos || [])
    .filter(a => a.isCollaborative && a.ownerId && a.ownerId !== user?.uid && a.isTopLevel)
    .map(arch => ({
      id: `collab_arch_${arch.id}`,
      islandId: `collab_arch:${arch.id}`,
      title: 'Crew Invite',
      message: `${collabOwnerProfiles[arch.ownerId!] || 'A friend'} invited you to co-create "${arch.name}"`,
      type: 'info' as const,
      timestamp: Date.now(),
    }));

  const notifications = [
    ...friendRequestNotifications,
    ...islandShareNotifications,
    ...archipelagoShareNotifications,
    ...questionResponseNotifications,
    ...collabIslandInviteNotifications,
    ...collabArchipelagoInviteNotifications,
  ].sort((a, b) => b.timestamp - a.timestamp);
  const unreadCount = notifications.filter(n => !seenNotificationIds.has(n.id)).length;
  const unreadSocialCount = friendRequests.filter(uid => !seenSocialIds.has(uid)).length;
  const unreadDiscoverCount = [
    ...inboundSharedIslands.map(i => i.id),
    ...inboundSharedArchipelagos.map(a => a.id)
  ].filter(id => !seenDiscoverIds.has(id)).length;

  const handleNotificationClick = (islandId: string) => {
    if (islandId === 'distress') {
      setDistressInitialTab('mine');
      setActiveModal('distress');
    } else if (islandId === 'social') {
      setActiveModal('users');
      setDiscoveryTab('islands');
    } else if (islandId.startsWith('share_island:')) {
      const name = islandId.split(':')[1];
      setActiveModal('discover');
      setDiscoveryTab('islands');
      setDiscoverySearch(name);
    } else if (islandId.startsWith('share_arch:')) {
      const name = islandId.split(':')[1];
      setActiveModal('discover');
      setDiscoveryTab('archipelagos');
      setDiscoverySearch(name);
    } else if (islandId.startsWith('collab_island:')) {
      const collabId = islandId.split(':')[1];
      setSelectedArchipelagoId(null);
      setSelectedIslandId(collabId);
    } else if (islandId.startsWith('collab_arch:')) {
      const archId = islandId.split(':')[1];
      setSelectedArchipelagoId(archId);
      setSelectedIslandId(null);
    } else {
      setSelectedIslandId(islandId);
    }
    setIsNotificationsOpen(false);
  };

  // Mark notifications as seen when bell is opened
  useEffect(() => {
    if (isNotificationsOpen && notifications.length > 0) {
      const newSeen = new Set(seenNotificationIds);
      notifications.forEach(n => newSeen.add(n.id));
      if (newSeen.size !== seenNotificationIds.size) setSeenNotificationIds(newSeen);
    }
  }, [isNotificationsOpen, notifications]);

  const handleSignOut = () => signOut(auth);

  const handleViewQuestion = (question: import('../hooks/useQuestions').Question) => {
    setDistressInitialQuestion(question);
    setDistressInitialTab('mine');
    setActiveModal('distress');
  };

  const selectedIsland =
    selectedIslandId === 'archipelago' ? archipelagoIsland :
    selectedIslandId === 'multi-select' ? multiSelectIsland :
    currentIslands.find(i => i.id === selectedIslandId);

  const handleFinishStudy = async (delta: number, cardUpdates: CardUpdateRecord, maxStreak: number = 0, sessionMeta?: SessionMeta) => {
    if (!isOnline) {
      // Queue results for sync when back online
      await queueSession({
        islandId: selectedIslandId ?? '',
        isArchipelago: selectedIslandId === 'archipelago' || selectedIslandId === 'multi-select',
        cardUpdates,
        sessionMaxStreak: maxStreak,
        sessionMeta: sessionMeta ?? { sessionDurationMs: 0, cardCount: 0, correctCount: 0, sessionStartHour: 0 },
        timestamp: Date.now(),
      });
      setOfflineQueuedToast(true);
      setTimeout(() => setOfflineQueuedToast(false), 5000);
      clearDraft();
      setIsStudying(false);
      setSelectedIslandId(null);
      setFrozenStudySelection(null);
      return;
    }

    if (selectedIslandId === 'archipelago' || selectedIslandId === 'multi-select') {
      await processArchipelagoResults(delta, cardUpdates, maxStreak, sessionMeta);
    } else if (selectedIslandId) {
      await processSessionResults(selectedIslandId, delta, cardUpdates, maxStreak, sessionMeta);
    }
    if (progress && sessionMeta) {
      const unlocked = await checkAndAwardAchievements({
        progress,
        cardUpdates,
        sessionMeta,
        trigger: 'session-complete',
        islandId: selectedIslandId || undefined,
      });
      if (unlocked.length) enqueueToasts(unlocked);
    }
    // Close open questions for any cards the learner just mastered
    const islandCards = selectedIsland?.cards ?? [];
    Object.entries(cardUpdates).forEach(([front, update]) => {
      if (update.status === 'mastered') {
        const card = islandCards.find(c => c.front === front);
        if (card?.id) closeQuestionForCard(card.id);
      }
    });
    clearDraft();
    setIsStudying(false);
    setSelectedIslandId(null);
    setFrozenStudySelection(null);
  };

  // Test Mode handlers
  const handleTestStart = useCallback(async (config: TestConfig, cards: Card[], name: string) => {
    const uid = user?.uid;
    if (!uid) return;

    let resolvedTestId: string | undefined;
    try {
      resolvedTestId = await createTestDef({
        uid,
        name,
        config,
        cardSnapshot: cards,
        createdAt: Date.now(),
        lastAttemptAt: Date.now(),
        attemptCount: 0,
        bestScore: 0,
      });
      setUserTests(prev => [{
        id: resolvedTestId,
        uid,
        name,
        config,
        cardSnapshot: cards,
        createdAt: Date.now(),
        lastAttemptAt: Date.now(),
        attemptCount: 0,
        bestScore: 0,
      }, ...prev]);
    } catch {
      // proceed without linking to a named test
    }

    setActiveRunningTestId(resolvedTestId ?? null);
    setTestStudyConfig(config);
    setTestStudyCards(cards);
    setShowTestConfig(false);
    setActiveModal(null);
    setIsTestStudying(true);
  }, [user?.uid]);

  const handleTestFinish = useCallback(async (report: Omit<TestSessionDoc, 'id'>) => {
    setIsTestStudying(false);
    if (!user?.uid) return;
    const testId = activeRunningTestId;
    const reportWithTestId = testId ? { ...report, testId } : report;
    const id = await saveTestSession(reportWithTestId);
    const fullReport = { ...reportWithTestId, id };

    if (testId) {
      setUserTests(prev => prev.map(t => {
        if (t.id !== testId) return t;
        const newCount = t.attemptCount + 1;
        const newBest = Math.max(t.bestScore, report.scorePercent);
        updateTestDef(testId, { lastAttemptAt: report.completedAt, attemptCount: newCount, bestScore: newBest });
        return { ...t, lastAttemptAt: report.completedAt, attemptCount: newCount, bestScore: newBest };
      }));
    }

    setTestSessions(prev => [fullReport, ...prev]);
    setActiveTestReport(fullReport);
    setActiveRunningTestId(null);
    setActiveModal('testMode');
  }, [user?.uid, activeRunningTestId]);

  const handleTakeAgain = useCallback((test: TestDefinition) => {
    if (!test.cardSnapshot?.length) return;
    setActiveTestReport(null);
    setActiveRunningTestId(test.id ?? null);
    setTestStudyConfig(test.config);
    setTestStudyCards(test.cardSnapshot);
    setActiveModal(null);
    setIsTestStudying(true);
  }, []);

  const handleRetakeFromReport = useCallback(() => {
    const testId = activeTestReport?.testId;
    const testDef = testId ? userTests.find(t => t.id === testId) : undefined;
    setActiveTestReport(null);
    if (testDef?.cardSnapshot?.length) {
      setActiveRunningTestId(testDef.id ?? null);
      setTestStudyConfig(testDef.config);
      setTestStudyCards(testDef.cardSnapshot);
      setActiveModal(null);
      setIsTestStudying(true);
    } else {
      setActiveModal('testMode');
    }
  }, [activeTestReport, userTests]);

  const handleTestRestudy = useCallback((cardIds: string[]) => {
    const restudyCards = testStudyCards.filter(c => cardIds.includes(c.id ?? c.front));
    if (!restudyCards.length) return;
    setActiveTestReport(null);
    setActiveModal(null);
    setTestStudyCards(restudyCards);
    setTestStudyConfig(prev => prev ? { ...prev, questionLimit: 'all' } : null);
    setIsTestStudying(true);
  }, [testStudyCards]);

  const deleteCardById = useCallback((cardId: string, islandId: string) => {
    const island = progress?.islands.find(i => i.id === islandId);
    if (!island) return;
    const idx = island.cards.findIndex(c => c.id === cardId);
    if (idx !== -1) removeCardFromIsland(islandId, idx);
  }, [progress?.islands, removeCardFromIsland]);

  return (
    <div className="h-screen max-w-full bg-brand-bg flex flex-col md:flex-row text-white relative overflow-hidden">
      {/* Offline sync status toasts */}
      <AnimatePresence>
        {syncStatus === 'syncing' && (
          <motion.div
            key="syncing"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#111] border border-white/10 rounded-2xl px-5 py-3 shadow-2xl"
          >
            <div className="w-3.5 h-3.5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-sm text-white/80">Syncing {pendingCount} offline {pendingCount === 1 ? 'session' : 'sessions'}…</span>
          </motion.div>
        )}
        {syncStatus === 'synced' && (
          <motion.div
            key="synced"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#111] border border-emerald-500/30 rounded-2xl px-5 py-3 shadow-2xl"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-sm text-white/80">Offline sessions synced</span>
          </motion.div>
        )}
        {offlineQueuedToast && (
          <motion.div
            key="offline-queued"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#111] border border-amber-500/30 rounded-2xl px-5 py-3 shadow-2xl"
          >
            <CloudOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-sm text-white/80">Session saved — will sync when you're back online</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sessionDraft && !isStudying && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#111] border border-white/10 rounded-2xl px-5 py-3 shadow-2xl"
          >
            <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="text-sm text-white/80">
              Unsaved session on <span className="text-white font-semibold">"{sessionDraft.islandName}"</span>
            </span>
            <button
              onClick={flushDraftToFirestore}
              disabled={isSavingDraft}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-brand-primary/20 text-brand-primary border border-brand-primary/30 hover:bg-brand-primary/30 transition-colors disabled:opacity-50"
            >
              {isSavingDraft ? 'Saving…' : 'Save Progress'}
            </button>
            <button
              onClick={clearDraft}
              className="text-xs text-brand-muted hover:text-white transition-colors"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Study selection floating action bar */}
      <AnimatePresence>
        {studySelection !== null && (
          <motion.div
            key="study-selection-bar"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-gray-900/95 border border-white/10 shadow-2xl backdrop-blur"
          >
            <span className="text-sm text-brand-muted">
              {studySelection.size} island{studySelection.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setStudySelection(null)}
              className="text-xs text-brand-muted hover:text-white px-3 py-1.5 rounded-xl hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            {(['all', 'due'] as const).map(mode => (
              <button
                key={mode}
                disabled={studySelection.size === 0}
                onClick={() => {
                  setFrozenStudySelection(studySelection);
                  setSelectedIslandId('multi-select');
                  setStudyMode(mode);
                  setIsStudying(true);
                  setStudySelection(null);
                }}
                className={mode === 'all'
                  ? "btn-primary !h-auto text-sm px-4 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  : "text-sm px-4 py-1.5 rounded-xl border border-sky-500/40 text-sky-400 hover:bg-sky-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                }
              >
                {mode === 'all' ? 'Study All' : 'Due Only'}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <NewIslandModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={addIsland}
        onSubmitCollaborative={async (name, collaboratorUids, archipelagoId) => {
          let finalCollaborators = collaboratorUids;
          if (archipelagoId) {
            // When creating inside a collaborative archipelago the modal passes only
            // arch.collaborators — which excludes the arch owner.  Build the full
            // crew (owner + collaborators) then remove the current user (who becomes
            // the island's ownerId and doesn't need to be in collaborators).
            const arch = (progress?.archipelagos || []).find(a => a.id === archipelagoId);
            if (arch?.isCollaborative && arch.ownerId) {
              const fullCrew = [...new Set([arch.ownerId, ...(arch.collaborators || [])])];
              finalCollaborators = fullCrew.filter(uid => uid !== user?.uid);
            }
          }
          await createCollaborativeIsland(name, finalCollaborators, archipelagoId ?? undefined);
        }}
        archipelagos={(progress?.archipelagos || []).map(a => ({
          id: a.id,
          name: a.name,
          isCollaborative: a.isCollaborative,
          collaborators: a.collaborators,
        }))}
        defaultArchipelagoId={selectedArchipelagoId}
        friends={friends}
        fetchProfilesByUids={fetchProfilesByUids}
      />

      <NewArchipelagoModal
        isOpen={isArchipelagoModalOpen}
        onClose={() => setIsArchipelagoModalOpen(false)}
        onSubmit={async (name) => {
          const newId = await addArchipelago(name);
          if (newId) setSelectedArchipelagoId(newId);
        }}
        onSubmitCollaborative={async (name, collaboratorUids) => {
          const newId = await createCollaborativeArchipelago(name, collaboratorUids);
          if (newId) setSelectedArchipelagoId(newId);
        }}
        friends={friends}
        fetchProfilesByUids={fetchProfilesByUids}
      />

      <AnkiImportModal
        isOpen={activeModal === 'ankiImport'}
        onClose={() => setActiveModal(null)}
        archipelagos={(progress?.archipelagos || []).map(a => ({ id: a.id, name: a.name }))}
        onImport={importAnkiDecks}
      />

      {/* Community / Social Modal (Users) */}
      <AnimatePresence>
        {activeModal === 'users' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setActiveModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[#111] border border-white/10 rounded-[32px] p-8 shadow-2xl flex flex-col max-h-[85vh]"
            >
              <button 
                onClick={() => setActiveModal(null)}
                className="absolute top-6 right-6 text-brand-muted hover:text-white transition-colors z-10"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-brand-primary/20 rounded-[18px] flex items-center justify-center">
                  <Users className="w-6 h-6 text-brand-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Social & Friends</h2>
                  <p className="text-brand-muted text-sm">Manage your connections and find new explorers.</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => setDiscoveryTab('explorers')}
                    className={cn(
                      "text-[10px] uppercase tracking-widest font-black transition-all",
                      discoveryTab === 'explorers' ? "text-brand-primary" : "text-brand-muted hover:text-white"
                    )}
                  >
                    Find Explorers
                  </button>
                  <button 
                    onClick={() => setDiscoveryTab('archipelagos')}
                    className={cn(
                      "text-[10px] uppercase tracking-widest font-black transition-all",
                      discoveryTab === 'archipelagos' ? "text-brand-primary" : "text-brand-muted hover:text-white"
                    )}
                  >
                    My Friends
                  </button>
                  <button 
                    onClick={() => setDiscoveryTab('islands')}
                    className={cn(
                      "text-[10px] uppercase tracking-widest font-black transition-all relative",
                      discoveryTab === 'islands' ? "text-brand-primary" : "text-brand-muted hover:text-white"
                    )}
                  >
                    Requests
                    {friendRequests.length > 0 && (
                      <span className="absolute -top-1 -right-2 w-1.5 h-1.5 bg-brand-primary rounded-full" />
                    )}
                  </button>
                </div>
              </div>

              {discoveryTab === 'explorers' && (
                <div className="relative mb-6 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-primary transition-colors" />
                  <input 
                    type="text"
                    value={discoverySearch}
                    onChange={(e) => setDiscoverySearch(e.target.value)}
                    placeholder="Search for explorers by name..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-brand-primary/50 transition-all font-medium"
                  />
                </div>
              )}

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                {socialError && (
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {socialError}
                  </div>
                )}
                
                {discoveryTab === 'explorers' ? (
                  isDiscovering ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-brand-muted font-bold tracking-widest uppercase">Searching...</p>
                    </div>
                  ) : discoveryExplorers.length > 0 ? (
                    discoveryExplorers.map(profile => {
                      const isFriend = friends.includes(profile.uid);
                      const isSent = sentRequests.includes(profile.uid);
                      const isReceived = friendRequests.includes(profile.uid);
                      const isSelf = profile.uid === user?.uid;
                      
                      return (
                        <div key={profile.uid} className="glass p-5 rounded-[24px] border-white/5 flex items-center justify-between gap-4 group">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-[#222] border border-white/10 flex items-center justify-center shrink-0">
                               {profile.photoURL ? (
                                 <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                               ) : (
                                 <Users className="w-5 h-5 text-brand-muted" />
                               )}
                            </div>
                            <div>
                              <h4 className="font-bold text-lg">{profile.displayName}</h4>
                              <div className="flex items-center gap-3 text-[10px] text-brand-muted uppercase tracking-widest font-black">
                                <span>{profile.stats?.dailyReviewed || 0} Studied</span>
                                <span className="w-1 h-1 bg-white/20 rounded-full" />
                                <span>{profile.stats?.dailyStreak || 0} Streak</span>
                              </div>
                            </div>
                          </div>
                          {!isSelf && (
                            <button
                              disabled={isFriend || isSent || isReceived}
                              onClick={() => sendFriendRequest(profile.uid)}
                              className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all",
                                isFriend || isSent || isReceived
                                  ? "bg-white/5 text-brand-muted cursor-default"
                                  : "bg-brand-primary text-white hover:bg-brand-primary/90 shadow-lg active:scale-95"
                              )}
                            >
                              {isFriend ? 'Friends' : isSent ? 'Request Sent' : isReceived ? 'Review Request' : 'Add Friend'}
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-20 text-center opacity-40">
                      <p className="text-sm font-bold tracking-widest uppercase">
                        {discoverySearch.length < 2 ? "Type a name to search for explorers." : "No explorers found matching that name."}
                      </p>
                    </div>
                  )
                ) : discoveryTab === 'islands' ? (
                  // Pending Requests View
                  isLoadingRequests ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-brand-muted font-bold tracking-widest uppercase">Loading requests...</p>
                    </div>
                  ) : discoveryInboundRequests.length > 0 ? (
                    discoveryInboundRequests.map(profile => (
                      <div key={profile.uid} className="glass p-5 rounded-[24px] border-white/5 flex items-center justify-between gap-4 group">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-[#222] border border-white/10 flex items-center justify-center shrink-0">
                             {profile.photoURL ? (
                               <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                             ) : (
                               <Users className="w-5 h-5 text-brand-muted" />
                             )}
                          </div>
                          <div>
                            <h4 className="font-bold text-lg">{profile.displayName}</h4>
                            <p className="text-[10px] text-brand-primary uppercase tracking-widest font-black mt-0.5">Wants to be your friend</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => acceptFriendRequest(profile.uid)}
                            className="w-10 h-10 rounded-xl bg-brand-primary/20 text-brand-primary hover:bg-brand-primary hover:text-white transition-all flex items-center justify-center"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => removeFriend(profile.uid)}
                            className="w-10 h-10 rounded-xl bg-white/5 text-brand-muted hover:bg-red-500/20 hover:text-red-400 transition-all flex items-center justify-center"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center opacity-40">
                      <p className="text-sm font-bold tracking-widest uppercase">No pending friend requests.</p>
                    </div>
                  )
                ) : (
                  // Friends View
                  isLoadingFriends ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-brand-muted font-bold tracking-widest uppercase">Loading friends...</p>
                    </div>
                  ) : discoveryFriends.length > 0 ? (
                    discoveryFriends.map(profile => (
                      <div key={profile.uid} className="glass p-5 rounded-[24px] border-white/5 flex items-center justify-between gap-4 group">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-[#222] border border-white/10 flex items-center justify-center shrink-0">
                             {profile.photoURL ? (
                               <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                             ) : (
                               <Users className="w-5 h-5 text-brand-muted" />
                             )}
                          </div>
                          <div>
                            <h4 className="font-bold text-lg">{profile.displayName}</h4>
                            <div className="flex items-center gap-3 text-[10px] text-brand-muted uppercase tracking-widest font-black">
                              <span>{profile.stats?.dailyReviewed || 0} Studied</span>
                              <span className="w-1 h-1 bg-white/20 rounded-full" />
                              <span>{profile.stats?.dailyStreak || 0} Streak</span>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            if (confirm(`Remove ${profile.displayName} from friends?`)) {
                              removeFriend(profile.uid);
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-white/5 text-brand-muted hover:bg-red-500/20 hover:text-red-400 font-bold text-xs transition-all"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center opacity-40">
                      <p className="text-sm font-bold tracking-widest uppercase">You haven't added any friends yet.</p>
                    </div>
                  )
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Discover Modal (Compass) */}
      <AnimatePresence>
        {activeModal === 'discover' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setActiveModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[#111] border border-white/10 rounded-[32px] p-8 shadow-2xl flex flex-col max-h-[85vh]"
            >
              <button 
                onClick={() => setActiveModal(null)}
                className="absolute top-6 right-6 text-brand-muted hover:text-white transition-colors z-10"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-brand-primary/20 rounded-[18px] flex items-center justify-center">
                  <Compass className="w-6 h-6 text-brand-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Community Discovery</h2>
                  <p className="text-brand-muted text-sm">Explore islands and archipelagos shared by others.</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => setDiscoveryTab('islands')}
                    className={cn(
                      "text-[10px] uppercase tracking-widest font-black transition-all",
                      discoveryTab === 'islands' ? "text-brand-primary" : "text-brand-muted hover:text-white"
                    )}
                  >
                    Islands
                  </button>
                  <button 
                    onClick={() => setDiscoveryTab('archipelagos')}
                    className={cn(
                      "text-[10px] uppercase tracking-widest font-black transition-all",
                      discoveryTab === 'archipelagos' ? "text-brand-primary" : "text-brand-muted hover:text-white"
                    )}
                  >
                    Archipelagos
                  </button>
                </div>
              </div>

              <div className="relative mb-6 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted group-focus-within:text-brand-primary transition-colors" />
                <input 
                  type="text"
                  value={discoverySearch}
                  onChange={(e) => setDiscoverySearch(e.target.value)}
                  placeholder={discoveryTab === 'islands' ? "Search public islands..." : "Search public archipelagos..."}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-brand-primary/50 transition-all font-medium"
                />
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                {isDiscovering ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-brand-muted font-bold tracking-widest uppercase">Charting the seas...</p>
                  </div>
                ) : discoveryTab === 'islands' ? (
                  publicIslands.length > 0 ? (
                    publicIslands.map(island => {
                      const isAlreadyImported = progress?.islands.some(i => i.name === island.name);
                      return (
                        <div key={island.id} className="glass p-5 rounded-[24px] border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h4 className="font-bold text-lg text-white">{island.name}</h4>
                              <span className="text-[10px] bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full font-bold">
                                {island.cards?.length || 0} Cards
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                              <div className="flex items-center gap-2 text-[11px] text-brand-muted">
                                <Users className="w-3.5 h-3.5" />
                                <span>{island.authorName || 'Explorer'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-brand-muted">
                                <Download className="w-3.5 h-3.5" />
                                <span>{island.downloads || 0} Imports</span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-brand-muted">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{formatDate(island.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            {island.authorId === user?.uid && (
                              <>
                                <button
                                  onClick={async () => {
                                    const localVersion = progress?.islands.find(i => i.publishedId === island.id || i.id === island.id);
                                    if (localVersion) {
                                      await shareIsland(localVersion);
                                      loadPublicIslands();
                                      if (progress) {
                                        const unlocked = await checkAndAwardAchievements({ progress, trigger: 'island-shared' });
                                        if (unlocked.length) enqueueToasts(unlocked);
                                      }
                                    } else {
                                      alert("Could not find the local version of this island to update.");
                                    }
                                  }}
                                  className="flex items-center justify-center px-4 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 font-bold transition-all shadow-lg active:scale-95 gap-2"
                                  title="Update Community Version"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span className="text-xs uppercase tracking-widest hidden sm:inline">Update</span>
                                </button>
                                <button
                                  onClick={() => setConfirmDialog({
                                    open: true,
                                    title: 'Delete from Community?',
                                    message: `This will permanently remove "${island.name}" from the discovery feed. People who already imported it will keep their copies.`,
                                    confirmLabel: 'Delete',
                                    danger: true,
                                    onConfirm: () => {
                                      setConfirmDialog(d => ({ ...d, open: false }));
                                      deletePublishedIsland(island.id);
                                      setPublicIslands(prev => prev.filter(i => i.id !== island.id));
                                    },
                                  })}
                                  className="flex items-center justify-center px-4 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 font-bold transition-all shadow-lg active:scale-95"
                                  title="Delete from Community"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            {(island as any).sharedWith?.includes(user?.uid) && !isAlreadyImported && (
                              <button
                                onClick={() => setConfirmDialog({
                                  open: true,
                                  title: 'Dismiss shared island?',
                                  message: `This will permanently remove "${island.name}" from your shared list. You won't be able to access it again unless the sender shares it with you again.`,
                                  confirmLabel: 'Remove',
                                  danger: true,
                                  onConfirm: async () => {
                                    setConfirmDialog(d => ({ ...d, open: false }));
                                    try {
                                      await dismissShare('published_islands', island.id!);
                                      setPublicIslands(prev => prev.filter(i => i.id !== island.id));
                                    } catch {
                                      alert('Could not dismiss this share. Please try again.');
                                    }
                                  },
                                })}
                                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 text-brand-muted hover:bg-red-500/10 hover:text-red-400 font-bold transition-all active:scale-95"
                                title="Dismiss"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                setImportingIslandId(island.id!);
                                try {
                                  await importIsland(island);
                                } catch {
                                  // Error already surfaced via alert in importIsland
                                } finally {
                                  setImportingIslandId(null);
                                  setActiveModal(null);
                                }
                              }}
                              disabled={(isAlreadyImported && island.authorId !== user?.uid) || importingIslandId === island.id}
                              className={cn(
                                "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all",
                                isAlreadyImported
                                  ? "bg-white/5 text-brand-muted cursor-default"
                                  : "bg-white text-black hover:bg-white/90 shadow-lg active:scale-95"
                              )}
                            >
                              {isAlreadyImported ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  Anchored
                                </>
                              ) : importingIslandId === island.id ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                  Importing...
                                </>
                              ) : (
                                <>
                                  <Download className="w-3.5 h-3.5" />
                                  Import
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-20 text-center opacity-40">
                      <p className="text-sm font-bold tracking-widest uppercase">No islands discovered in these waters.</p>
                    </div>
                  )
                ) : (
                  publicArchipelagos.length > 0 ? (
                    publicArchipelagos.map(arch => {
                      const isAlreadyImported = progress?.archipelagos?.some(a => a.name === arch.name);
                      return (
                        <div key={arch.id} className="glass p-5 rounded-[24px] border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h4 className="font-bold text-lg text-white">{arch.name}</h4>
                              <span className="text-[10px] bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full font-bold">
                                {arch.islands?.length || 0} Islands
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                              <div className="flex items-center gap-2 text-[11px] text-brand-muted">
                                <Users className="w-3.5 h-3.5" />
                                <span>{arch.authorName || 'Explorer'}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-brand-muted">
                                <Download className="w-3.5 h-3.5" />
                                <span>{arch.downloads || 0} Imports</span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-brand-muted">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{formatDate(arch.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            {arch.authorId === user?.uid && (
                              <>
                                <button
                                  onClick={async () => {
                                    const localVersion = progress?.archipelagos?.find(a => a.publishedId === arch.id || a.id === arch.id);
                                    if (localVersion) {
                                      await shareArchipelago(localVersion);
                                      loadPublicArchipelagos();
                                    } else {
                                      alert("Could not find the local version of this archipelago to update.");
                                    }
                                  }}
                                  className="flex items-center justify-center px-4 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 font-bold transition-all shadow-lg active:scale-95 gap-2"
                                  title="Update Community Version"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span className="text-xs uppercase tracking-widest hidden sm:inline">Update</span>
                                </button>
                                <button
                                  onClick={() => setConfirmDialog({
                                    open: true,
                                    title: 'Delete from Community?',
                                    message: `This will permanently remove "${arch.name}" from the discovery feed. People who already imported it will keep their copies.`,
                                    confirmLabel: 'Delete',
                                    danger: true,
                                    onConfirm: () => {
                                      setConfirmDialog(d => ({ ...d, open: false }));
                                      deletePublishedArchipelago(arch.id);
                                      setPublicArchipelagos(prev => prev.filter(a => a.id !== arch.id));
                                    },
                                  })}
                                  className="flex items-center justify-center px-4 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 font-bold transition-all shadow-lg active:scale-95"
                                  title="Delete from Community"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            {arch.sharedWith?.includes(user?.uid) && !isAlreadyImported && (
                              <button
                                onClick={() => setConfirmDialog({
                                  open: true,
                                  title: 'Dismiss shared archipelago?',
                                  message: `This will permanently remove "${arch.name}" from your shared list. You won't be able to access it again unless the sender shares it with you again.`,
                                  confirmLabel: 'Remove',
                                  danger: true,
                                  onConfirm: async () => {
                                    setConfirmDialog(d => ({ ...d, open: false }));
                                    try {
                                      await dismissShare('published_archipelagos', arch.id);
                                      setPublicArchipelagos(prev => prev.filter(a => a.id !== arch.id));
                                    } catch {
                                      alert('Could not dismiss this share. Please try again.');
                                    }
                                  },
                                })}
                                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 text-brand-muted hover:bg-red-500/10 hover:text-red-400 font-bold transition-all active:scale-95"
                                title="Dismiss"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                setImportingArchipelagoId(arch.id);
                                try {
                                  await importArchipelago(arch);
                                } catch {
                                  // Error already surfaced via alert in importArchipelago
                                } finally {
                                  setImportingArchipelagoId(null);
                                  setActiveModal(null);
                                }
                              }}
                              disabled={(isAlreadyImported && arch.authorId !== user?.uid) || importingArchipelagoId === arch.id}
                              className={cn(
                                "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all",
                                isAlreadyImported
                                  ? "bg-white/5 text-brand-muted cursor-default"
                                  : "bg-white text-black hover:bg-white/90 shadow-lg active:scale-95"
                              )}
                            >
                              {isAlreadyImported ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  Imported
                                </>
                              ) : importingArchipelagoId === arch.id ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                  Importing...
                                </>
                              ) : (
                                <>
                                  <Download className="w-3.5 h-3.5" />
                                  Import All
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-20 text-center opacity-40">
                      <p className="text-sm font-bold tracking-widest uppercase">No archipelagos discovered yet.</p>
                    </div>
                  )
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {activeModal === 'settings' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setActiveModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#111] border border-white/10 rounded-[32px] p-8 shadow-2xl"
            >
              <button 
                onClick={() => setActiveModal(null)}
                className="absolute top-6 right-6 text-brand-muted hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Settings</h2>
              <p className="text-brand-muted text-sm leading-relaxed mb-8">
                Configure your learning environment and account preferences.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div>
                    <p className="text-sm font-bold text-white mb-1">Island Sorting</p>
                    <p className="text-xs text-brand-muted">Choose how your islands are ordered.</p>
                  </div>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'alpha-asc' | 'alpha-desc' | 'creation' | 'next-due' | 'most-struggling')}
                    className="bg-[#222] border border-white/10 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-brand-primary"
                  >
                    <option value="alpha-asc">A to Z</option>
                    <option value="alpha-desc">Z to A</option>
                    <option value="creation">Creation Date</option>
                    <option value="next-due">Next Due</option>
                    <option value="most-struggling">Most Struggling</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div>
                    <p className="text-sm font-bold text-white mb-1">Public Ranking</p>
                    <p className="text-xs text-brand-muted">Show up on the global leaderboard.</p>
                  </div>
                  <button
                    onClick={() => updateSettings({ showOnGlobalLeaderboard: !(progress?.settings?.showOnGlobalLeaderboard ?? true) })}
                    className={cn(
                      "w-10 h-6 rounded-full relative transition-colors",
                      (progress?.settings?.showOnGlobalLeaderboard ?? true) ? "bg-brand-primary" : "bg-white/10"
                    )}
                  >
                    <motion.div 
                      animate={{ x: (progress?.settings?.showOnGlobalLeaderboard ?? true) ? 16 : 4 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" 
                    />
                  </button>
                </div>

                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="mb-3">
                    <p className="text-sm font-bold text-white mb-1">Progress Tracking</p>
                    <p className="text-xs text-brand-muted">Choose which system shows in the UI. Both always track silently.</p>
                  </div>
                  <div className="flex bg-black/30 rounded-xl p-1 border border-white/10 gap-1">
                    {(['srs', 'status', 'both'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => updateSettings({ progressTrackingMode: mode })}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors",
                          trackingMode === mode
                            ? "bg-brand-primary text-white shadow-sm"
                            : "text-brand-muted hover:text-white"
                        )}
                      >
                        {mode === 'srs' ? 'Spaced Rep' : mode === 'status' ? 'Mastery' : 'Both'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="mb-3">
                    <p className="text-sm font-bold text-white mb-1">Session Display</p>
                    <p className="text-xs text-brand-muted">Focused hides all stats. Stats shows streak, correct, and incorrect.</p>
                  </div>
                  <div className="flex bg-black/30 rounded-xl p-1 border border-white/10 gap-1">
                    {(['focused', 'stats'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => updateSettings({ sessionDisplay: mode })}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors",
                          (progress?.settings?.sessionDisplay ?? 'stats') === mode
                            ? "bg-brand-primary text-white shadow-sm"
                            : "text-brand-muted hover:text-white"
                        )}
                      >
                        {mode === 'focused' ? 'Focused' : 'Stats'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div>
                    <p className="text-sm font-bold text-white mb-1">Written Recall</p>
                    <p className="text-xs text-brand-muted">Type your answer before flipping flashcards.</p>
                  </div>
                  <button
                    onClick={() => updateSettings({ writtenRecallMode: !(progress?.settings?.writtenRecallMode ?? false) })}
                    className={cn(
                      "w-10 h-6 rounded-full relative transition-colors",
                      (progress?.settings?.writtenRecallMode ?? false) ? "bg-brand-primary" : "bg-white/10"
                    )}
                  >
                    <motion.div
                      animate={{ x: (progress?.settings?.writtenRecallMode ?? false) ? 16 : 4 }}
                      className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>

                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="mb-3">
                    <p className="text-sm font-bold text-white mb-1">Study Grace Window</p>
                    <p className="text-xs text-brand-muted">Cards due within this window will be included in your session.</p>
                  </div>
                  <div className="flex bg-black/30 rounded-xl p-1 border border-white/10 gap-1">
                    {([0, 15, 30, 60, 120] as const).map((mins) => (
                      <button
                        key={mins}
                        onClick={() => updateSettings({ graceWindowMinutes: mins })}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors",
                          (progress?.settings?.graceWindowMinutes ?? 0) === mins
                            ? "bg-brand-primary text-white shadow-sm"
                            : "text-brand-muted hover:text-white"
                        )}
                      >
                        {mins === 0 ? 'Off' : mins < 60 ? `${mins}m` : `${mins / 60}h`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div>
                    <p className="text-sm font-bold text-white mb-1">Dark Mode</p>
                    <p className="text-xs text-brand-muted">The only acceptable mode.</p>
                  </div>
                  <div className="w-10 h-6 bg-brand-primary rounded-full relative">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 opacity-50 pointer-events-none">
                  <div>
                    <p className="text-sm font-bold text-white mb-1">Data Export</p>
                    <p className="text-xs text-brand-muted">Coming soon</p>
                  </div>
                  <button className="text-xs uppercase tracking-wider font-bold text-brand-muted">Export</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeModal === 'leaderboard' && (
          <SocialLeaderboard
            onClose={() => setActiveModal(null)}
            profiles={socialProfiles}
            friends={friends}
            friendRequests={friendRequests}
            sentRequests={sentRequests}
            loading={socialLoading}
            error={socialError}
            loadLeaderboard={loadLeaderboard}
            fetchProfilesByUids={fetchProfilesByUids}
            sendFriendRequest={sendFriendRequest}
            acceptFriendRequest={acceptFriendRequest}
            removeFriend={removeFriend}
            myReputation={myReputation}
            userStats={progress?.stats}
          />
        )}
      </AnimatePresence>

      {/* Trophy Room Modal */}
      <AnimatePresence>
        {activeModal === 'trophies' && (
          <TrophyRoom
            onClose={() => setActiveModal(null)}
            unlockedIds={progress?.achievements || []}
          />
        )}
      </AnimatePresence>

      {/* Distress Signals Modal */}
      <AnimatePresence>
        {activeModal === 'distress' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setActiveModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[#111] border border-white/10 rounded-[32px] p-8 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            >
              <QuestionsBoard
                onClose={() => { setActiveModal(null); setDistressInitialQuestion(null); }}
                currentUserId={user?.uid || ''}
                ownedIslandIds={progress?.islands.map(i => i.id).filter(Boolean) as string[] || []}
                friends={friends}
                initialTab={distressInitialTab}
                initialQuestion={distressInitialQuestion ?? undefined}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Achievement Toast */}
      <AnimatePresence>
        {currentToast && (
          <AchievementToast
            achievement={currentToast}
            onDismiss={() => setCurrentToast(null)}
          />
        )}
      </AnimatePresence>

      {/* Collaborative deletion notice */}
      <AnimatePresence>
        {deletedCollabMessage && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 bg-[#1a1a2e]/95 border border-white/10 backdrop-blur-xl rounded-2xl px-5 py-3 shadow-2xl max-w-sm w-full"
          >
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-sm text-white/80 flex-1">{deletedCollabMessage}</span>
            <button
              onClick={() => setDeletedCollabMessage(null)}
              className="text-brand-muted hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Test Mode Hub */}
      <AnimatePresence>
        {activeModal === 'testMode' && !showTestConfig && !activeTestReport && (
          <TestModeHub
            userTests={userTests}
            allSessions={testSessions}
            loading={testLoading}
            onClose={() => setActiveModal(null)}
            onNewTest={() => { setShowTestConfig(true); setActiveModal(null); }}
            onTakeAgain={handleTakeAgain}
            onViewReport={(s) => setActiveTestReport(s)}
          />
        )}
      </AnimatePresence>

      {/* Test Mode Config */}
      <AnimatePresence>
        {showTestConfig && (
          <TestModeConfig
            islands={progress?.islands ?? []}
            archipelagos={progress?.archipelagos ?? []}
            existingTestNames={userTests.map(t => t.name)}
            onStart={handleTestStart}
            onClose={() => { setShowTestConfig(false); setActiveModal('testMode'); }}
          />
        )}
      </AnimatePresence>

      {/* Test Report */}
      <AnimatePresence>
        {activeTestReport && (
          <TestReport
            session={activeTestReport}
            onClose={() => { setActiveTestReport(null); setActiveModal('testMode'); }}
            onRetake={handleRetakeFromReport}
            onRestudy={(cardIds) => { setActiveTestReport(null); handleTestRestudy(cardIds); }}
            onFlagForTomorrow={flagCardsForTomorrow}
            friends={friends}
            currentUserName={user?.displayName || 'Explorer'}
          />
        )}
      </AnimatePresence>

      {/* Stats Modal */}
      <AnimatePresence>
        {activeModal === 'stats' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setActiveModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-[#111] border border-white/10 rounded-[32px] p-8 shadow-2xl flex flex-col max-h-[85vh]"
            >
              <button 
                onClick={() => setActiveModal(null)}
                className="absolute top-6 right-6 text-brand-muted hover:text-white transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="shrink-0">
                <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <BarChart2 className="w-6 h-6 text-brand-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Learning Statistics</h2>
                <p className="text-brand-muted text-sm leading-relaxed mb-8">
                  Track your mastery across the entire archipelago.
                </p>
              </div>
              
              <div className="overflow-y-auto custom-scrollbar flex-1 pr-4 -mr-4">
                {/* Global Stats */}
                <div className="mb-12">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Map className="w-5 h-5 text-brand-primary" />
                    Archipelago Total
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10 border-b-2 border-b-white/20">
                      <div className="text-3xl font-black text-white mb-1">{allCards.length}</div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-brand-muted">Total Cards</div>
                    </div>
                    <div className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/20 border-b-2 border-b-emerald-500/40">
                      <div className="text-3xl font-black text-emerald-400 mb-1">{globalMasteredCount}</div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-500/80">Mastered</div>
                    </div>
                    <div className="bg-amber-500/5 rounded-2xl p-4 border border-amber-500/20 border-b-2 border-b-amber-500/40">
                      <div className="text-3xl font-black text-amber-400 mb-1">{globalLearningCount}</div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-amber-500/80">Learning</div>
                    </div>
                    <div className="bg-red-500/5 rounded-2xl p-4 border border-red-500/20 border-b-2 border-b-red-500/40">
                      <div className="text-3xl font-black text-red-400 mb-1">{globalStrugglingCount}</div>
                      <div className="text-[10px] font-bold tracking-widest uppercase text-red-500/80">Struggling</div>
                    </div>
                  </div>
                </div>

                {/* Activity & Records */}
                {progress?.stats && (
                  <div className="mb-12">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-brand-primary" />
                      Activity & Records
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {/* Daily Reviewed */}
                      <div className="bg-white/5 rounded-2xl p-4 border border-brand-primary/20 border-b-2 border-b-brand-primary/40 relative overflow-hidden group">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><Zap className="w-24 h-24" /></div>
                        <div className="text-3xl font-black text-white mb-1 relative z-10">{progress.stats.dailyReviewed}</div>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-brand-muted relative z-10">Today's Review</div>
                      </div>
                      {/* Daily Mastered */}
                      <div className="bg-white/5 rounded-2xl p-4 border border-emerald-500/20 border-b-2 border-b-emerald-500/40 relative overflow-hidden group">
                         <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><Activity className="w-24 h-24" /></div>
                         <div className="text-3xl font-black text-emerald-400 mb-1 relative z-10">{progress.stats.dailyMastered}</div>
                         <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-500/80 relative z-10">Today Mastered</div>
                      </div>
                      
                      {/* Record Reviewed */}
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/10 relative overflow-hidden group">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><Trophy className="w-24 h-24" /></div>
                        <div className="text-3xl font-black text-white mb-1 relative z-10">{progress.stats.recordReviewed}</div>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-brand-muted relative z-10">Most Reviewed</div>
                      </div>
                      {/* Record Mastered */}
                      <div className="bg-white/5 rounded-2xl p-4 border border-emerald-500/10 relative overflow-hidden group">
                         <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform"><Award className="w-24 h-24" /></div>
                         <div className="text-3xl font-black text-emerald-400/80 mb-1 relative z-10">{progress.stats.recordMastered}</div>
                         <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-500/60 relative z-10">Most Mastered</div>
                      </div>
                      
                      {/* Total Sessions */}
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/10 relative overflow-hidden group">
                        <div className="text-3xl font-black text-white mb-1 relative z-10">{progress.stats.totalStudySessions}</div>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-brand-muted relative z-10">Total Sessions</div>
                      </div>
                      {/* Total Cards Created */}
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/10 relative overflow-hidden group">
                        <div className="text-3xl font-black text-white mb-1 relative z-10">{progress.stats.totalCardsCreated}</div>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-brand-muted relative z-10">Cards Authored</div>
                      </div>

                      {/* Calibration Score */}
                      {(progress.stats.calibrationTotal ?? 0) > 0 && (
                        <div className="bg-violet-500/5 rounded-2xl p-4 border border-violet-500/20 border-b-2 border-b-violet-500/40 relative overflow-hidden group col-span-2 sm:col-span-1">
                          <div className="text-3xl font-black text-violet-400 mb-1 relative z-10">
                            {Math.round((progress.stats.calibrationCorrect ?? 0) / (progress.stats.calibrationTotal ?? 1) * 100)}%
                          </div>
                          <div className="text-[10px] font-bold tracking-widest uppercase text-violet-500/80 relative z-10">Calibration</div>
                          <div className="text-[10px] text-brand-muted/60 relative z-10 mt-0.5">
                            {progress.stats.calibrationCorrect ?? 0} / {progress.stats.calibrationTotal ?? 0} predictions
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )}

                {/* Streak Records */}
                {progress?.stats && (
                  <div className="mb-12">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-amber-500">
                      <Zap className="w-5 h-5 fill-current" />
                      Streak Achievements
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-amber-500/5 rounded-2xl p-6 border border-amber-500/20 border-b-2 border-b-amber-500/40 relative overflow-hidden group">
                        <div className="absolute -right-4 -bottom-4 opacity-10 text-amber-500 group-hover:scale-110 transition-transform"><Zap className="w-24 h-24 fill-current" /></div>
                        <div className="text-4xl font-black text-amber-400 mb-1 relative z-10">{progress.stats.dailyStreak || 0}</div>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-amber-500/80 relative z-10">Daily Streak (Days)</div>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-6 border border-white/10 border-b-2 border-b-white/20 relative overflow-hidden group">
                        <div className="text-4xl font-black text-white mb-1 relative z-10">{progress.stats.longestDailyStreak || 0}</div>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-brand-muted relative z-10">Record Daily Streak</div>
                      </div>
                      <div className="bg-brand-primary/5 rounded-2xl p-6 border border-brand-primary/20 border-b-2 border-b-brand-primary/40 relative overflow-hidden group">
                        <div className="text-4xl font-black text-brand-primary mb-1 relative z-10">{progress.stats.longestSessionStreak || 0}</div>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-brand-primary/80 relative z-10">Best Card Streak</div>
                      </div>
                      <div className="bg-sky-500/5 rounded-2xl p-6 border border-sky-500/20 border-b-2 border-b-sky-500/40 relative overflow-hidden group">
                        <div className="text-4xl font-black text-sky-400 mb-1 relative z-10">{progress.stats.recordReviewed || 0}</div>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-sky-500/80 relative z-10">Record Daily Reviewed</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Learning Insights */}
                {((trackingMode !== 'status' && (forgettingCount > 0 || bestStudyHour != null)) ||
                  (trackingMode !== 'srs' && weakSpotCards.length > 0)) && (
                  <div className="mb-12">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-brand-primary" />
                      Learning Insights
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      {trackingMode !== 'status' && forgettingCount > 0 && (
                        <div className="bg-sky-500/5 rounded-2xl p-5 border border-sky-500/20">
                          <div className="text-2xl font-black text-sky-400 mb-1">{forgettingCount}</div>
                          <div className="text-[10px] font-bold tracking-widest uppercase text-sky-500/80">Cards due in 3 days</div>
                          <div className="text-xs text-brand-muted mt-1">Review soon to avoid forgetting</div>
                        </div>
                      )}
                      {trackingMode !== 'status' && bestStudyHour && (
                        <div className="bg-emerald-500/5 rounded-2xl p-5 border border-emerald-500/20">
                          <div className="text-2xl font-black text-emerald-400 mb-1">{formatStudyHour(bestStudyHour.hour)}</div>
                          <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-500/80">Peak retention hour</div>
                          <div className="text-xs text-brand-muted mt-1">
                            {Math.round(bestStudyHour.accuracy * 100)}% accuracy over {bestStudyHour.sessions} sessions
                          </div>
                        </div>
                      )}
                    </div>
                    {trackingMode !== 'srs' && weakSpotCards.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-brand-muted mb-3 flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                          Persistent Weak Spots
                        </div>
                        <div className="space-y-2">
                          {weakSpotCards.map(card => {
                            const accuracy = card.totalAnswers ? Math.round((card.totalCorrect ?? 0) / card.totalAnswers * 100) : null;
                            return (
                              <div key={card.id} className="flex items-center justify-between bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3 gap-4">
                                <p className="text-sm text-white/80 truncate flex-1">{card.front}</p>
                                <div className="flex items-center gap-3 shrink-0">
                                  {accuracy !== null && (
                                    <span className={cn(
                                      "text-[10px] font-bold",
                                      accuracy < 40 ? "text-red-400" : accuracy < 70 ? "text-amber-400" : "text-emerald-400"
                                    )}>
                                      {accuracy}%
                                    </span>
                                  )}
                                  {(card.demotionCount ?? 0) >= 2 && (
                                    <span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded border border-red-500/20 font-bold whitespace-nowrap">
                                      {card.demotionCount}× demoted
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Blind Spot Matrix */}
                {blindSpotData && (
                  <div className="mb-12">
                    <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-400" />
                      Blind Spot Matrix
                    </h3>
                    <p className="text-xs text-brand-muted mb-5">Speed vs. accuracy across {blindSpotData.classifiedCount} cards with enough data</p>
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                        <div className="text-2xl font-black text-emerald-400">{blindSpotData.quadrants.fastCorrect.length}</div>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-400/80 mt-0.5">Fluency</div>
                        <div className="text-[10px] text-brand-muted mt-1">Fast &amp; Correct</div>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                        <div className="text-2xl font-black text-amber-400">{blindSpotData.quadrants.slowCorrect.length}</div>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-amber-400/80 mt-0.5">Consolidating</div>
                        <div className="text-[10px] text-brand-muted mt-1">Slow &amp; Correct</div>
                      </div>
                      <div className={cn(
                        "border rounded-2xl p-4",
                        blindSpotData.quadrants.fastIncorrect.length > 0
                          ? "bg-red-500/10 border-red-500/30"
                          : "bg-white/5 border-white/10"
                      )}>
                        <div className={cn(
                          "text-2xl font-black",
                          blindSpotData.quadrants.fastIncorrect.length > 0 ? "text-red-400" : "text-white/40"
                        )}>{blindSpotData.quadrants.fastIncorrect.length}</div>
                        <div className={cn(
                          "text-[10px] font-bold tracking-widest uppercase mt-0.5",
                          blindSpotData.quadrants.fastIncorrect.length > 0 ? "text-red-400/80" : "text-brand-muted"
                        )}>Blind Spot ⚠</div>
                        <div className="text-[10px] text-brand-muted mt-1">Fast &amp; Incorrect</div>
                      </div>
                      <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4">
                        <div className="text-2xl font-black text-orange-400">{blindSpotData.quadrants.slowIncorrect.length}</div>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-orange-400/80 mt-0.5">Knowledge Gap</div>
                        <div className="text-[10px] text-brand-muted mt-1">Slow &amp; Incorrect</div>
                      </div>
                    </div>
                    {/* SCATTER PLOT — kept for future use, disabled for now
                    {(() => {
                      const dots = [
                        ...blindSpotData.quadrants.fastCorrect.map(c => ({ card: c, color: '#10b981' as const })),
                        ...blindSpotData.quadrants.slowCorrect.map(c => ({ card: c, color: '#f59e0b' as const })),
                        ...blindSpotData.quadrants.fastIncorrect.map(c => ({ card: c, color: '#ef4444' as const })),
                        ...blindSpotData.quadrants.slowIncorrect.map(c => ({ card: c, color: '#f97316' as const })),
                      ].filter(d => (d.card.avgNormalizedResponseMs ?? 0) > 0);
                      if (dots.length < 2) return null;
                      const times = dots.map(d => d.card.avgNormalizedResponseMs!);
                      const minT = Math.min(...times), maxT = Math.max(...times);
                      const pad = (maxT - minT) * 0.08 || 1;
                      const xMin = minT - pad, xMax = maxT + pad;
                      const W = 560, H = 230;
                      const ml = 34, mr = 10, mt = 14, mb = 26;
                      const pw = W - ml - mr, ph = H - mt - mb;
                      const sorted = [...times].sort((a, b) => a - b);
                      const speedMedian = sorted[Math.floor(sorted.length / 2)];
                      const xP = (t: number) => ml + (1 - (t - xMin) / (xMax - xMin)) * pw;
                      const yP = (acc: number) => mt + (1 - acc) * ph;
                      const xLine = xP(speedMedian);
                      const yLine = yP(0.8);
                      return (
                        <div className="mb-6 rounded-2xl overflow-hidden border border-white/5 bg-white/[0.02]">
                          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
                            <rect x={xLine} y={mt} width={ml + pw - xLine} height={yLine - mt} fill="rgba(16,185,129,0.05)" />
                            <rect x={ml} y={mt} width={xLine - ml} height={yLine - mt} fill="rgba(245,158,11,0.04)" />
                            <rect x={xLine} y={yLine} width={ml + pw - xLine} height={mt + ph - yLine} fill="rgba(239,68,68,0.08)" />
                            <rect x={ml} y={yLine} width={xLine - ml} height={mt + ph - yLine} fill="rgba(249,115,22,0.04)" />
                            <line x1={ml} y1={mt + ph} x2={ml + pw} y2={mt + ph} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                            <line x1={ml} y1={mt} x2={ml} y2={mt + ph} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                            <line x1={xLine} y1={mt} x2={xLine} y2={mt + ph} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 3" />
                            <line x1={ml} y1={yLine} x2={ml + pw} y2={yLine} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 3" />
                            <text x={ml - 5} y={mt} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.3)" dominantBaseline="hanging">100%</text>
                            <text x={ml - 5} y={yLine} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.3)" dominantBaseline="middle">80%</text>
                            <text x={ml - 5} y={mt + ph} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.3)">0%</text>
                            <text x={ml} y={mt + ph + 5} fontSize="9" fill="rgba(255,255,255,0.3)" dominantBaseline="hanging">Slow</text>
                            <text x={ml + pw} y={mt + ph + 5} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.3)" dominantBaseline="hanging">Fast</text>
                            <text x={ml + pw - 4} y={mt + 4} textAnchor="end" fontSize="8" fill="rgba(16,185,129,0.5)" dominantBaseline="hanging">Fluency</text>
                            <text x={ml + 4} y={mt + 4} fontSize="8" fill="rgba(245,158,11,0.5)" dominantBaseline="hanging">Consolidating</text>
                            <text x={ml + pw - 4} y={mt + ph - 5} textAnchor="end" fontSize="8" fill="rgba(239,68,68,0.5)">Blind Spot</text>
                            <text x={ml + 4} y={mt + ph - 5} fontSize="8" fill="rgba(249,115,22,0.5)">Gap</text>
                            {dots.map(({ card, color }, i) => {
                              const acc = (card.totalCorrect ?? 0) / (card.totalAnswers ?? 1);
                              return (
                                <circle key={card.id ?? i} cx={xP(card.avgNormalizedResponseMs!)} cy={yP(acc)} r={4.5} fill={color} fillOpacity={0.75}>
                                  <title>{`${card.front?.slice(0, 60)}  |  ${Math.round(acc * 100)}% accuracy`}</title>
                                </circle>
                              );
                            })}
                          </svg>
                        </div>
                      );
                    })()}
                    */}
                    {blindSpotData.quadrants.fastIncorrect.length > 0 && (
                      <div>
                        <button
                          onClick={() => setBlindSpotOpen(o => !o)}
                          className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-red-400 mb-3 hover:text-red-300 transition-colors"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          {blindSpotData.quadrants.fastIncorrect.length} blind spot card{blindSpotData.quadrants.fastIncorrect.length !== 1 ? 's' : ''} — answered quickly but incorrectly
                        </button>
                        {blindSpotOpen && (
                          <div className="space-y-2 mb-4">
                            {blindSpotData.quadrants.fastIncorrect.map(card => {
                              const accuracy = Math.round((card.totalCorrect ?? 0) / (card.totalAnswers ?? 1) * 100);
                              const times = card.lastThreeNormalizedTimes ?? [];
                              const trend = times.length >= 2
                                ? times[times.length - 1] < times[0] * 0.9 ? '↑' : times[times.length - 1] > times[0] * 1.1 ? '↓' : ''
                                : '';
                              return (
                                <div key={card.id} className="flex items-center justify-between bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3 gap-4">
                                  <p className="text-sm text-white/80 truncate flex-1">{card.front}</p>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {trend && (
                                      <span className={cn("text-xs font-bold", trend === '↑' ? 'text-emerald-400' : 'text-red-400')}>{trend}</span>
                                    )}
                                    <span className="text-[10px] font-bold text-red-400">{accuracy}%</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {blindSpotData.quadrants.slowIncorrect.length > 0 && (
                      <div className="mt-2">
                        <button
                          onClick={() => setKnowledgeGapOpen(o => !o)}
                          className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-orange-400 mb-3 hover:text-orange-300 transition-colors"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          {blindSpotData.quadrants.slowIncorrect.length} knowledge gap card{blindSpotData.quadrants.slowIncorrect.length !== 1 ? 's' : ''} — slow and incorrect
                        </button>
                        {knowledgeGapOpen && (
                          <div className="space-y-2 mb-4">
                            {blindSpotData.quadrants.slowIncorrect.map(card => {
                              const accuracy = Math.round((card.totalCorrect ?? 0) / (card.totalAnswers ?? 1) * 100);
                              return (
                                <div key={card.id} className="flex items-center justify-between bg-orange-500/5 border border-orange-500/10 rounded-xl px-4 py-3 gap-4">
                                  <p className="text-sm text-white/80 truncate flex-1">{card.front}</p>
                                  <span className="text-[10px] font-bold text-orange-400 shrink-0">{accuracy}%</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {blindSpotData.pendingCount > 0 && (
                      <p className="text-[10px] text-brand-muted/60">
                        {blindSpotData.pendingCount} card{blindSpotData.pendingCount !== 1 ? 's' : ''} not yet studied with timing data
                      </p>
                    )}
                  </div>
                )}

                {/* Individual Islands */}
                <h3 className="text-lg font-bold mb-4">Island Breakdown</h3>
                <div className="space-y-4">
                  {(progress?.islands || []).map(island => {
                    const mst = island.cards.filter(c => c.status === 'mastered').length;
                    const lrn = island.cards.filter(c => (!c.status && !c.needsWork) || c.status === 'learning').length;
                    const str = island.cards.filter(c => c.status === 'struggling' || c.needsWork).length;
                    
                    return (
                      <div key={island.id} className="bg-black/40 rounded-2xl p-5 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div className="flex-1">
                          <h4 className="text-base font-bold mb-1">{island.name}</h4>
                          {trackingMode !== 'srs' && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden flex">
                                {island.cards.length > 0 && (
                                  <>
                                    <div style={{ width: `${(mst / island.cards.length) * 100}%` }} className="h-full bg-emerald-500" />
                                    <div style={{ width: `${(lrn / island.cards.length) * 100}%` }} className="h-full bg-amber-500" />
                                    <div style={{ width: `${(str / island.cards.length) * 100}%` }} className="h-full bg-red-500" />
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        {trackingMode !== 'srs' && (
                          <div className="flex gap-4 shrink-0">
                            <div className="text-center">
                              <div className="text-sm font-bold text-emerald-400">{mst}</div>
                              <div className="text-[9px] font-bold tracking-widest uppercase text-emerald-500/60">Mast</div>
                            </div>
                            <div className="text-center">
                              <div className="text-sm font-bold text-amber-400">{lrn}</div>
                              <div className="text-[9px] font-bold tracking-widest uppercase text-amber-500/60">Lrn</div>
                            </div>
                            <div className="text-center">
                              <div className="text-sm font-bold text-red-400">{str}</div>
                              <div className="text-[9px] font-bold tracking-widest uppercase text-red-500/60">Strg</div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Archive Modal */}
      <AnimatePresence>
        {activeModal === 'duplicateScan' && (
          <DuplicateScanModal
            islands={progress?.islands || []}
            scope="global"
            onClose={() => setActiveModal(null)}
            onDeleteCard={deleteCardById}
          />
        )}

        {activeModal === 'archive' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setActiveModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-[#111] border border-white/10 rounded-[32px] p-8 shadow-2xl flex flex-col max-h-[85vh]"
            >
              <button
                onClick={() => setActiveModal(null)}
                className="absolute top-6 right-6 text-brand-muted hover:text-white transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 border border-amber-500/20">
                <Archive className="w-6 h-6 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Archive</h2>
              <p className="text-brand-muted text-sm leading-relaxed mb-8">
                Archived items are hidden from your main view but never deleted.
              </p>
              <div className="overflow-y-auto custom-scrollbar flex-1 space-y-8">
                {archivedArchipelagos.length > 0 && (
                  <section>
                    <h3 className="text-[10px] uppercase tracking-widest font-black text-brand-muted mb-3">
                      Archipelagos ({archivedArchipelagos.length})
                    </h3>
                    <div className="space-y-2">
                      {archivedArchipelagos.map(arch => (
                        <div key={arch.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                          <div>
                            <p className="text-sm font-bold text-white">{arch.name}</p>
                            <p className="text-[10px] text-brand-muted uppercase tracking-widest mt-0.5">
                              {allNonImportedIslands.filter(i => i.archipelagoId === arch.id).length} Islands
                            </p>
                          </div>
                          <button
                            onClick={() => unarchiveArchipelago(arch.id)}
                            className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-colors flex items-center gap-1.5 shrink-0 ml-4"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {archivedIslands.length > 0 && (
                  <section>
                    <h3 className="text-[10px] uppercase tracking-widest font-black text-brand-muted mb-3">
                      Islands ({archivedIslands.length})
                    </h3>
                    <div className="space-y-2">
                      {archivedIslands.map(island => (
                        <div key={island.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                          <div>
                            <p className="text-sm font-bold text-white">{island.name}</p>
                            <p className="text-[10px] text-brand-muted uppercase tracking-widest mt-0.5">
                              {island.cards.length} Cards
                            </p>
                          </div>
                          <button
                            onClick={() => unarchiveIsland(island.id)}
                            className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-colors flex items-center gap-1.5 shrink-0 ml-4"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                {archivedArchipelagos.length === 0 && archivedIslands.length === 0 && (
                  <div className="py-16 text-center">
                    <Archive className="w-10 h-10 text-brand-muted/20 mx-auto mb-4" />
                    <p className="text-brand-muted/40 text-sm uppercase tracking-[0.2em]">Nothing archived yet</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar - Desktop Only */}
      <aside className="w-20 hidden md:flex flex-col items-center py-6 border-r border-brand-border bg-brand-card z-50 shrink-0">
        <div className="relative mb-8" ref={profileRef}>
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-10 h-10 rounded-xl overflow-hidden border border-brand-border shadow-lg transition-transform active:scale-95 group focus:outline-none"
          >
            <img 
              src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'D')}&background=4285F4&color=fff`} 
              alt="Profile" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </button>

          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95, x: 10 }}
                className="absolute left-full ml-4 top-0 w-64 glass p-5 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 border border-white/10"
              >
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/5">
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10">
                    <img src={user?.photoURL || ''} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{user?.displayName || 'User'}</p>
                    <p className="text-[10px] text-brand-muted uppercase tracking-widest leading-none mt-1">
                      {user ? 'Verified Explorer' : 'Guest'}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <button 
                    onClick={() => { setActiveModal('settings'); setIsProfileOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-brand-muted hover:text-white hover:bg-white/5 transition-colors text-xs font-bold uppercase tracking-wider"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                  <button 
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-400/70 hover:text-red-400 hover:bg-red-400/5 transition-colors text-xs font-bold uppercase tracking-wider"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative mb-10">
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={cn(
              "relative text-brand-muted hover:text-white transition-all p-2 rounded-xl border border-transparent hover:border-white/5 hover:bg-white/5",
              isNotificationsOpen && "text-white bg-white/5 border-white/10"
            )}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-primary rounded-full border-2 border-brand-card shadow-[0_0_10px_rgba(66,133,244,0.5)]" />
            )}
          </button>

          <AnimatePresence>
            {isNotificationsOpen && (
              <NotificationsPanel 
                notifications={notifications} 
                onClose={() => setIsNotificationsOpen(false)}
                onSelect={handleNotificationClick}
              />
            )}
          </AnimatePresence>
        </div>
        
        <nav className="flex flex-col gap-8 flex-1">
          <button
            onClick={() => setSelectedIslandId(null)}
            className={cn("relative group transition-all flex items-center justify-center", selectedIslandId ? "text-brand-muted hover:text-white" : "text-white")}
          >
            <LayoutDashboard className="w-6 h-6" />
            <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
              Knowledge Map
            </div>
          </button>
          <button
            onClick={() => setActiveModal('discover')}
            className={cn(
              "relative group transition-all flex items-center justify-center",
              activeModal === 'discover' ? "text-brand-primary" : "text-brand-muted hover:text-white"
            )}
          >
            <Compass className="w-6 h-6" />
            {unreadDiscoverCount > 0 && (
              <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-brand-primary border border-[#111]" />
            )}
            <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
              Discover
            </div>
          </button>

          {/* Advanced nav items — hidden for brand-new users, revealed automatically after first study session */}
          {!isNewUser && (
            <>
              <button
                onClick={() => setActiveModal('users')}
                className="relative group text-brand-muted hover:text-white transition-all flex items-center justify-center"
              >
                <Users className="w-6 h-6" />
                {unreadSocialCount > 0 && (
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-brand-primary border border-[#111]" />
                )}
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                  Social
                </div>
              </button>
              <button
                onClick={() => setActiveModal('stats')}
                className="relative group text-brand-muted hover:text-white transition-all flex items-center justify-center"
              >
                <BarChart2 className="w-6 h-6" />
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                  Statistics
                </div>
              </button>
              <button
                onClick={() => setActiveModal('leaderboard')}
                className="relative group text-brand-muted hover:text-white transition-all flex items-center justify-center"
              >
                <Trophy className="w-6 h-6" />
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                  Competitions
                </div>
              </button>
              <button
                onClick={() => setActiveModal('trophies')}
                className="relative group text-brand-muted hover:text-white transition-all flex items-center justify-center"
              >
                <Award className="w-6 h-6" />
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                  Captain's Quarters
                </div>
              </button>
              <button
                onClick={() => setActiveModal('duplicateScan')}
                className={cn("relative group transition-all flex items-center justify-center", activeModal === 'duplicateScan' ? "text-amber-400" : "text-brand-muted hover:text-amber-400")}
              >
                <ScanLine className="w-6 h-6" />
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                  Duplicate Scanner
                </div>
              </button>
              <button
                onClick={() => { setDistressInitialTab('all'); setActiveModal('distress'); }}
                className="relative group text-orange-400/50 hover:text-orange-400 transition-all flex items-center justify-center"
              >
                <Radio className="w-6 h-6" />
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                  Distress Signals
                </div>
              </button>
              <button
                onClick={() => setActiveModal('testMode')}
                className={cn(
                  "relative group transition-all flex items-center justify-center",
                  activeModal === 'testMode' ? "text-brand-primary" : "text-brand-muted hover:text-white"
                )}
              >
                <GraduationCap className="w-6 h-6" />
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                  Test Mode
                </div>
              </button>
              <button
                onClick={() => setActiveModal('archive')}
                className={cn(
                  "relative group transition-all flex items-center justify-center",
                  activeModal === 'archive' ? "text-amber-400" : "text-brand-muted hover:text-amber-400"
                )}
              >
                <Archive className="w-6 h-6" />
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                  Archive
                </div>
              </button>
            </>
          )}

          {/* "More features await" hint for new users */}
          {isNewUser && (
            <div className="relative group flex items-center justify-center text-brand-muted/20">
              <MoreHorizontal className="w-5 h-5" />
              <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white/70 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                More features unlock as you study
              </div>
            </div>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className={cn("flex-1 flex flex-col min-w-0 overflow-y-auto md:pb-0", !isStudying && !isTestStudying && "pb-20")}>
        {/* Header */}
        <header className="h-14 border-b border-brand-border flex items-center justify-start px-6 md:px-12 bg-brand-bg/50 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-4 text-brand-muted group flex-1 max-w-sm">
            <Search className="w-4 h-4 group-focus-within:text-brand-primary transition-colors" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search islands..." 
              className="bg-transparent border-none outline-none text-white font-light placeholder:text-brand-muted/30 text-sm w-full"
            />
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6 md:p-12 max-w-7xl mx-auto w-full overflow-x-hidden">
          {/* Pending answer banner — shown when learner has new crew answers they haven't seen */}
          <AnimatePresence>
            {pendingAnswerBanner && !isStudying && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4 p-3 rounded-2xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-between gap-3 cursor-pointer"
                onClick={() => {
                  const notifId = `question_response_${pendingAnswerBanner.id}_${pendingAnswerBanner.lastActivityAt?.seconds ?? 0}`;
                  setSeenNotificationIds(prev => new Set([...prev, notifId]));
                  setDistressInitialTab('mine');
                  setActiveModal('distress');
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Radio className="w-4 h-4 text-orange-400 shrink-0 animate-pulse" />
                  <p className="text-xs text-white/80 truncate">
                    New answer for: <span className="font-semibold text-orange-300">"{pendingAnswerBanner.frontText.slice(0, 50)}{pendingAnswerBanner.frontText.length > 50 ? '…' : ''}"</span>
                  </p>
                </div>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-orange-400 border border-orange-500/30 px-2 py-1 rounded-lg">
                  View
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            {isStudying && selectedIsland ? (
              <motion.div
                key="study"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center justify-center min-h-[60vh]"
              >
                <StudySession
                  island={selectedIsland}
                  mode={studyMode}
                  settings={progress?.settings}
                  allTimeBestStreak={progress?.stats?.longestSessionStreak ?? 0}
                  friends={friends}
                  islandId={selectedIslandId || selectedIsland.id}
                  archipelagoName={selectedIslandId !== 'archipelago' ? selectedArchipelago?.name : undefined}
                  currentUserName={user?.displayName || 'Explorer'}
                  isOnline={isOnline}
                  onViewQuestion={handleViewQuestion}
                  onFinish={handleFinishStudy}
                  onProgressUpdate={(cu, sd, sms) => {
                    if (selectedIslandId && selectedIsland) {
                      saveDraft(selectedIslandId, selectedIsland.name, cu, sd, sms, selectedIslandId === 'archipelago' || selectedIslandId === 'multi-select');
                    }
                  }}
                  onManage={async (delta, cardUpdates, maxStreak, sessionMeta) => {
                    if (!isOnline) {
                      await queueSession({ islandId: selectedIslandId ?? '', isArchipelago: selectedIslandId === 'archipelago' || selectedIslandId === 'multi-select', cardUpdates, sessionMaxStreak: maxStreak, sessionMeta: sessionMeta ?? { sessionDurationMs: 0, cardCount: 0, correctCount: 0, sessionStartHour: 0 }, timestamp: Date.now() });
                      setOfflineQueuedToast(true);
                      setTimeout(() => setOfflineQueuedToast(false), 5000);
                    } else {
                      if (selectedIslandId === 'archipelago' || selectedIslandId === 'multi-select') await processArchipelagoResults(delta, cardUpdates, maxStreak, sessionMeta);
                      else if (selectedIslandId) await processSessionResults(selectedIslandId, delta, cardUpdates, maxStreak, sessionMeta);
                      if (progress && sessionMeta) {
                        const unlocked = await checkAndAwardAchievements({ progress, cardUpdates, sessionMeta, trigger: 'session-abandon', islandId: selectedIslandId || undefined });
                        if (unlocked.length) enqueueToasts(unlocked);
                      }
                    }
                    clearDraft();
                    setIsStudying(false);
                    setFrozenStudySelection(null);
                  }}
                  onBackToMap={async (delta, cardUpdates, maxStreak, sessionMeta) => {
                    if (!isOnline) {
                      await queueSession({ islandId: selectedIslandId ?? '', isArchipelago: selectedIslandId === 'archipelago' || selectedIslandId === 'multi-select', cardUpdates, sessionMaxStreak: maxStreak, sessionMeta: sessionMeta ?? { sessionDurationMs: 0, cardCount: 0, correctCount: 0, sessionStartHour: 0 }, timestamp: Date.now() });
                      setOfflineQueuedToast(true);
                      setTimeout(() => setOfflineQueuedToast(false), 5000);
                    } else {
                      if (selectedIslandId === 'archipelago' || selectedIslandId === 'multi-select') await processArchipelagoResults(delta, cardUpdates, maxStreak, sessionMeta);
                      else if (selectedIslandId) await processSessionResults(selectedIslandId, delta, cardUpdates, maxStreak, sessionMeta);
                      if (progress && sessionMeta) {
                        const unlocked = await checkAndAwardAchievements({ progress, cardUpdates, sessionMeta, trigger: 'session-abandon', islandId: selectedIslandId || undefined });
                        if (unlocked.length) enqueueToasts(unlocked);
                      }
                    }
                    clearDraft();
                    setIsStudying(false);
                    setSelectedIslandId(null);
                    setFrozenStudySelection(null);
                  }}
                  onSwitchMode={async (newMode, delta, cardUpdates, maxStreak, sessionMeta) => {
                    if (!isOnline) {
                      await queueSession({ islandId: selectedIslandId ?? '', isArchipelago: selectedIslandId === 'archipelago' || selectedIslandId === 'multi-select', cardUpdates, sessionMaxStreak: maxStreak, sessionMeta: sessionMeta ?? { sessionDurationMs: 0, cardCount: 0, correctCount: 0, sessionStartHour: 0 }, timestamp: Date.now() });
                      setOfflineQueuedToast(true);
                      setTimeout(() => setOfflineQueuedToast(false), 5000);
                    } else {
                      if (selectedIslandId === 'archipelago' || selectedIslandId === 'multi-select') await processArchipelagoResults(delta, cardUpdates, maxStreak, sessionMeta);
                      else if (selectedIslandId) await processSessionResults(selectedIslandId, delta, cardUpdates, maxStreak, sessionMeta);
                      if (progress && sessionMeta) {
                        const unlocked = await checkAndAwardAchievements({ progress, cardUpdates, sessionMeta, trigger: 'session-complete', islandId: selectedIslandId || undefined });
                        if (unlocked.length) enqueueToasts(unlocked);
                      }
                    }
                    clearDraft();
                    setStudyMode(newMode);
                  }}
                />
              </motion.div>
            ) : isTestStudying && testStudyConfig ? (
              <motion.div
                key="test-study"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center justify-center min-h-[60vh]"
              >
                <TestSession
                  cards={testStudyCards}
                  config={testStudyConfig}
                  settings={progress?.settings}
                  friends={friends}
                  currentUserName={user?.displayName || 'Explorer'}
                  isOnline={isOnline}
                  uid={user?.uid ?? ''}
                  onTestFinish={handleTestFinish}
                  onBack={() => setIsTestStudying(false)}
                />
              </motion.div>
            ) : !selectedIsland ? (
              <motion.div
                key="map"
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.01 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-8 sm:mb-12 gap-4 sm:gap-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h2 className="text-2xl sm:text-[32px] font-bold tracking-tight">Memory Islands</h2>
                      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-1">
                        {isRenamingArchipelago && selectedArchipelagoId ? (
                          <input
                            autoFocus
                            value={renameArchipelagoValue}
                            onChange={(e) => setRenameArchipelagoValue(e.target.value)}
                            onBlur={() => {
                              const trimmed = renameArchipelagoValue.trim();
                              if (trimmed && selectedArchipelago && trimmed !== selectedArchipelago.name && selectedArchipelagoId) {
                                renameArchipelago(selectedArchipelagoId, trimmed);
                              }
                              setIsRenamingArchipelago(false);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              if (e.key === 'Escape') setIsRenamingArchipelago(false);
                            }}
                            className="bg-transparent text-white font-bold text-sm px-3 py-1 outline-none border-b border-white/30 focus:border-brand-primary/60 w-32"
                          />
                        ) : (
                          <select
                            value={selectedArchipelagoId || ''}
                            onChange={(e) => setSelectedArchipelagoId(e.target.value || null)}
                            className="bg-transparent text-white font-bold text-sm px-3 py-1 outline-none appearance-none cursor-pointer"
                          >
                            <option value="" className="bg-[#111]">All Archipelagos</option>
                            {ownedArchipelagos.map(a => (
                              <option key={a.id} value={a.id} className="bg-[#111]">{a.name}</option>
                            ))}
                          </select>
                        )}
                        {selectedArchipelagoId && !isRenamingArchipelago && islandsInArchipelago.length > 0 && (
                          <>
                            <span className="text-brand-muted/40 text-xs">/</span>
                            <select
                              value=""
                              onChange={(e) => { if (e.target.value) setSelectedIslandId(e.target.value); }}
                              className="bg-transparent text-brand-muted font-semibold text-sm px-2 py-1 outline-none appearance-none cursor-pointer hover:text-white transition-colors"
                            >
                              <option value="" className="bg-[#111]">All Islands</option>
                              {islandsInArchipelago.map(i => (
                                <option key={i.id} value={i.id} className="bg-[#111]">{i.name}</option>
                              ))}
                            </select>
                          </>
                        )}
                        {selectedArchipelagoId && !isRenamingArchipelago && (
                          <button
                            onClick={() => { setRenameArchipelagoValue(selectedArchipelago?.name || ''); setIsRenamingArchipelago(true); }}
                            className="p-1 hover:bg-white/10 rounded-xl transition-colors text-brand-muted hover:text-white"
                            title="Rename Archipelago"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setIsArchipelagoModalOpen(true)}
                          className="p-1 hover:bg-white/10 rounded-xl transition-colors text-brand-muted hover:text-white"
                          title="New Archipelago"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-brand-muted font-normal text-sm sm:text-base">Manage your knowledge base.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isNewUser ? (
                      <button
                        onClick={() => setIsArchipelagoModalOpen(true)}
                        className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-2xl font-bold text-sm hover:bg-white/90 transition-all shadow-[0_10px_30px_rgba(255,255,255,0.1)]"
                      >
                        <Plus className="w-4 h-4" />
                        Create Collection
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => setActiveModal('ankiImport')}
                          className="flex items-center gap-2 bg-white/5 border border-white/10 text-white px-4 py-2.5 rounded-2xl font-bold text-sm hover:bg-white/10 transition-all"
                          title="Import Anki deck"
                        >
                          <Upload className="w-4 h-4" />
                          Import Anki
                        </button>
                        <button
                          onClick={() => setIsModalOpen(true)}
                          className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-2xl font-bold text-sm hover:bg-white/90 transition-all shadow-[0_10px_30px_rgba(255,255,255,0.1)]"
                        >
                          <Plus className="w-4 h-4" />
                          Create New Island
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Archipelago Study Section */}
                {allCards.length > 0 && (
                  <div className="mb-8 sm:mb-12 glass p-5 sm:p-8 rounded-[32px] sm:rounded-[40px] border-brand-primary/20 relative overflow-hidden group">
                    <div className="absolute top-[-100px] right-[-100px] w-[300px] h-[300px] bg-brand-primary/10 rounded-full blur-[80px] group-hover:bg-brand-primary/15 transition-colors" />

                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 sm:gap-8 relative z-10">
                      <div className="flex items-center gap-4 sm:gap-6">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-brand-primary/10 rounded-2xl sm:rounded-3xl flex items-center justify-center border border-brand-primary/20 shrink-0">
                          <Map className="w-6 h-6 sm:w-8 sm:h-8 text-brand-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base sm:text-xl font-bold truncate mb-1">{archipelagoName} Study</h3>
                          {selectedArchipelagoId && selectedArchipelago && (
                            <div className="flex items-center gap-2 mb-1">
                              {(() => {
                                const archipelagoPrivacyState = selectedArchipelago.isPublic
                                  ? 'public'
                                  : (selectedArchipelago.sharedWith && selectedArchipelago.sharedWith.length > 0)
                                    ? 'shared'
                                    : 'private';

                                return (
                                  <button
                                    onClick={() => archipelagoPrivacyState === 'public' ? setShowUnshareArchipelagoConfirm(true) : setShowShareArchipelagoConfirm(true)}
                                    className={cn(
                                      "p-1.5 rounded-lg transition-all flex items-center gap-1.5",
                                      archipelagoPrivacyState === 'public'
                                        ? "bg-brand-primary/10 border border-brand-primary/20 text-brand-primary"
                                        : archipelagoPrivacyState === 'shared'
                                          ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-300"
                                          : "bg-white/5 border border-white/5 text-brand-muted hover:text-white hover:border-white/10"
                                    )}
                                    title={archipelagoPrivacyState === 'public' ? "Remove this Archipelago from Community" : "Share this Archipelago"}
                                  >
                                    {archipelagoPrivacyState === 'public' ? <Globe className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                                    <span className="text-[10px] font-bold uppercase tracking-tight">
                                      {archipelagoPrivacyState === 'public' ? 'Public' : archipelagoPrivacyState === 'shared' ? `Shared (${selectedArchipelago.sharedWith?.length})` : 'Share'}
                                    </span>
                                  </button>
                                );
                              })()}
                              <button
                                onClick={() => setShowResetArchipelagoConfirm(true)}
                                className="p-1.5 rounded-lg bg-amber-500/5 border border-amber-500/10 text-amber-400/60 hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/10 transition-all flex items-center gap-1.5"
                                title="Reset progress for this Archipelago"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-tight">Reset</span>
                              </button>
                              <button
                                onClick={() => setShowArchiveArchipelagoConfirm(true)}
                                className="p-1.5 rounded-lg bg-amber-500/5 border border-amber-500/10 text-amber-400/60 hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/10 transition-all flex items-center gap-1.5"
                                title="Archive this Archipelago"
                              >
                                <Archive className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-tight">Archive</span>
                              </button>
                              <button
                                onClick={() => setShowDeleteArchipelagoConfirm(true)}
                                className="p-1.5 rounded-lg bg-red-500/5 border border-red-500/10 text-red-400/60 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all flex items-center gap-1.5"
                                title="Delete this Archipelago"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase tracking-tight">Delete</span>
                              </button>
                            </div>
                          )}
                          <p className="text-brand-muted text-xs sm:text-sm hidden sm:block max-w-sm">Review your entire knowledge base across all anchored islands.</p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                        <div className="flex flex-wrap bg-white/5 rounded-2xl p-1 border border-white/10 shadow-lg">
                          <button
                            onClick={() => setStudyMode('all')}
                            className={cn(
                              "flex-1 sm:flex-none px-4 py-2 rounded-xl transition-all font-black text-[10px] tracking-wider uppercase whitespace-nowrap",
                              studyMode === 'all' ? "bg-white/10 text-white shadow-sm" : "text-brand-muted hover:text-white"
                            )}
                          >
                            All ({allCards.length})
                          </button>
                          {trackingMode !== 'status' && (
                            <button
                              onClick={() => setStudyMode('due')}
                              disabled={globalDueCount === 0}
                              className={cn(
                                "flex-1 sm:flex-none px-4 py-2 rounded-xl transition-colors font-bold text-[10px] tracking-widest uppercase whitespace-nowrap disabled:opacity-20",
                                studyMode === 'due' ? "bg-sky-500/20 text-sky-400 border border-sky-500/30" : "text-brand-muted hover:text-sky-400"
                              )}
                            >
                              Due ({globalDueCount})
                            </button>
                          )}
                          {trackingMode !== 'srs' && (
                            <>
                              <button
                                onClick={() => setStudyMode('struggling')}
                                disabled={globalStrugglingCount === 0}
                                className={cn(
                                  "flex-1 sm:flex-none px-4 py-2 rounded-xl transition-colors font-bold text-[10px] tracking-widest uppercase whitespace-nowrap disabled:opacity-20",
                                  studyMode === 'struggling' ? "bg-red-500/20 text-red-400 border border-red-500/30" : "text-brand-muted hover:text-red-400"
                                )}
                              >
                                Struggling ({globalStrugglingCount})
                              </button>
                              <button
                                onClick={() => setStudyMode('learning')}
                                disabled={globalLearningCount === 0}
                                className={cn(
                                  "flex-1 sm:flex-none px-4 py-2 rounded-xl transition-colors font-bold text-[10px] tracking-widest uppercase whitespace-nowrap disabled:opacity-20",
                                  studyMode === 'learning' ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-brand-muted hover:text-amber-400"
                                )}
                              >
                                Learning ({globalLearningCount})
                              </button>
                              <button
                                onClick={() => setStudyMode('mastered')}
                                disabled={globalMasteredCount === 0}
                                className={cn(
                                  "flex-1 sm:flex-none px-4 py-2 rounded-xl transition-colors font-bold text-[10px] tracking-widest uppercase whitespace-nowrap disabled:opacity-20",
                                  studyMode === 'mastered' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-brand-muted hover:text-emerald-400"
                                )}
                              >
                                Mastered ({globalMasteredCount})
                              </button>
                            </>
                          )}
                        </div>

                        <button 
                          onClick={() => {
                            setSelectedIslandId('archipelago');
                            setIsStudying(true);
                          }}
                          className="btn-primary h-12 px-8 flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest shadow-[0_10px_20px_rgba(66,133,244,0.3)] group"
                        >
                          <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                          Launch Global
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 animate-pulse">
                    {[1, 2, 3].map(i => <div key={i} className="h-44 rounded-[32px] bg-white/5" />)}
                  </div>
                ) : !selectedArchipelagoId ? (
                  // Home view: show archipelago cards
                  (() => {
                    const filteredArchipelagos = ownedArchipelagos.filter(a =>
                      a.name.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                    return filteredArchipelagos.length > 0 ? (
                      <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {filteredArchipelagos.map((archipelago) => {
                          const archIslands = currentIslands.filter(i => i.archipelagoId === archipelago.id);
                          let masteryLevel: 'struggling' | 'learning' | 'mastered' = 'learning';

                          if (trackingMode === 'srs') {
                            const now = Date.now();
                            const sevenDaysMs = now + 7 * 24 * 60 * 60 * 1000;
                            const allArchCards = archIslands.flatMap(i => getActiveTierCards(i.cards));
                            if (allArchCards.some((c: any) => !c.srsNextReview || c.srsNextReview <= now + graceMs)) {
                              masteryLevel = 'struggling';
                            } else if (allArchCards.some((c: any) => c.srsNextReview && c.srsNextReview <= sevenDaysMs)) {
                              masteryLevel = 'learning';
                            } else if (allArchCards.length > 0) {
                              masteryLevel = 'mastered';
                            }
                          } else {
                            const hasStruggling = archIslands.some(i => i.cards.some(c => c.status === 'struggling' || c.needsWork));
                            if (hasStruggling) {
                              masteryLevel = 'struggling';
                            } else {
                              const allArchCards = archIslands.flatMap(i => i.cards);
                              masteryLevel = allArchCards.length > 0 && allArchCards.every(c => c.status === 'mastered') ? 'mastered' : 'learning';
                            }
                          }

                          const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
                          let imageSrc = '';
                          if (masteryLevel === 'struggling') imageSrc = `${basePath}/StrugglingArch.jpeg`;
                          else if (masteryLevel === 'learning') imageSrc = `${basePath}/LearningArch.jpeg`;
                          else imageSrc = `${basePath}/MasteredArch.jpeg`;

                          return (
                            <ArchipelagoCard
                              key={archipelago.id}
                              archipelago={archipelago}
                              islandCount={archIslands.length}
                              totalCards={archIslands.reduce((acc, i) => acc + i.cards.length, 0)}
                              masteryLevel={masteryLevel}
                              imageSrc={imageSrc}
                              onClick={() => setSelectedArchipelagoId(archipelago.id)}
                              onLongPress={() => {
                                const ids = new Set(currentIslands.filter(i => i.archipelagoId === archipelago.id).map(i => i.id));
                                setStudySelection(ids);
                              }}
                            />
                          );
                        })}
                      </div>
                      {/* Nudge: user has a collection but no islands yet */}
                      {ownedArchipelagos.length > 0 && currentIslands.length === 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-6 p-5 rounded-[24px] border border-brand-primary/20 bg-brand-primary/5 flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center shrink-0">
                              <Plus className="w-4 h-4 text-brand-primary" />
                            </div>
                            <p className="text-sm text-white/70">
                              <span className="text-white font-semibold">Collection created!</span> Now add an Island (study deck) inside it to start adding cards.
                            </p>
                          </div>
                          <button
                            onClick={() => setIsModalOpen(true)}
                            className="shrink-0 text-[11px] font-bold uppercase tracking-widest text-brand-primary border border-brand-primary/30 px-3 py-1.5 rounded-xl hover:bg-brand-primary/10 transition-colors whitespace-nowrap"
                          >
                            Add Island
                          </button>
                        </motion.div>
                      )}
                      </>
                    ) : (
                      searchQuery ? (
                        <div className="h-[400px] w-full rounded-[40px] glass flex items-center justify-center relative overflow-hidden">
                          <div className="absolute top-[-50px] right-[-50px] w-[200px] h-[200px] bg-brand-primary/5 rounded-full blur-[60px]" />
                          <div className="text-center relative z-10">
                            <div className="w-20 h-20 rounded-3xl border border-brand-border bg-white/[0.02] mx-auto mb-6 flex items-center justify-center">
                              <Compass className="w-8 h-8 text-brand-muted/30" />
                            </div>
                            <p className="text-brand-muted/40 font-medium text-sm uppercase tracking-[0.2em]">
                              No archipelagos match "{searchQuery}"
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full rounded-[40px] glass flex flex-col items-center justify-center relative overflow-hidden py-16 px-8">
                          <div className="absolute top-[-60px] right-[-60px] w-[280px] h-[280px] bg-brand-primary/5 rounded-full blur-[80px]" />
                          <div className="absolute bottom-[-40px] left-[-40px] w-[200px] h-[200px] bg-indigo-500/5 rounded-full blur-[60px]" />
                          <div className="text-center relative z-10 max-w-sm">
                            <h2 className="text-2xl font-bold text-white mb-3">Start your first collection</h2>
                            <p className="text-brand-muted text-sm mb-8 leading-relaxed">
                              In Memory Island, a <span className="text-white/70 font-medium">collection</span> (called an Archipelago) holds all your study decks. Create one to get started.
                            </p>
                            <button
                              onClick={() => setIsArchipelagoModalOpen(true)}
                              className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-2xl font-bold text-sm hover:bg-white/90 transition-all shadow-[0_10px_30px_rgba(255,255,255,0.15)] mx-auto mb-4"
                            >
                              <Plus className="w-4 h-4" />
                              Create your first collection
                            </button>
                            <button
                              onClick={() => setActiveModal('ankiImport')}
                              className="text-brand-muted/60 hover:text-brand-muted text-sm transition-colors underline underline-offset-4"
                            >
                              Or import an Anki deck
                            </button>
                          </div>
                        </div>
                      )
                    );
                  })()
                ) : studySelection !== null ? (
                  // Select mode: show ALL islands grouped by archipelago for cross-archipelago curation
                  <div>
                    {ownedArchipelagos.map(arch => {
                      const archIslands = currentIslands.filter(i => i.archipelagoId === arch.id);
                      if (!archIslands.length) return null;
                      const allSelected = archIslands.every(i => studySelection.has(i.id));
                      return (
                        <div key={arch.id} className="mb-8">
                          <div className="flex items-center gap-3 mb-3 px-1">
                            <span className="text-xs uppercase tracking-widest text-brand-muted font-bold">{arch.name}</span>
                            <button
                              onClick={() => setStudySelection(prev => {
                                const next = new Set(prev ?? []);
                                archIslands.forEach(i => allSelected ? next.delete(i.id) : next.add(i.id));
                                return next;
                              })}
                              className="text-[10px] text-brand-muted/50 hover:text-brand-muted underline transition-colors"
                            >
                              {allSelected ? 'Deselect all' : 'Select all'}
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                            {archIslands.map(island => {
                              const sc = island.cards.filter((c: any) => c.status === 'struggling' || c.needsWork).length;
                              const mc = island.cards.filter((c: any) => c.status === 'mastered').length;
                              let ml: 'struggling' | 'learning' | 'mastered' = 'learning';
                              if (sc > 0) ml = 'struggling';
                              else if (island.cards.length > 0 && mc === island.cards.length) ml = 'mastered';
                              const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
                              const imgSrc = ml === 'struggling' ? `${basePath}/struggling.jpeg` : ml === 'mastered' ? `${basePath}/mastered.jpeg` : `${basePath}/learning.jpeg`;
                              return (
                                <IslandCard
                                  key={island.id}
                                  island={island}
                                  masteryLevel={ml}
                                  islandImageSrc={imgSrc}
                                  trackingMode={trackingMode}
                                  graceWindowMinutes={progress?.settings?.graceWindowMinutes ?? 0}
                                  onClick={() => setSelectedIslandId(island.id)}
                                  isOnline={isOnline}
                                  isSelectMode
                                  isSelected={studySelection.has(island.id)}
                                  onLongPress={() => {}}
                                  onSelect={() => setStudySelection(prev => {
                                    const next = new Set(prev ?? []);
                                    if (next.has(island.id)) next.delete(island.id);
                                    else next.add(island.id);
                                    return next;
                                  })}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {currentIslands.filter(i => !i.archipelagoId).length > 0 && (
                      <div className="mb-8">
                        <div className="flex items-center gap-3 mb-3 px-1">
                          <span className="text-xs uppercase tracking-widest text-brand-muted font-bold">Uncategorized</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                          {currentIslands.filter(i => !i.archipelagoId).map(island => {
                            const sc = island.cards.filter((c: any) => c.status === 'struggling' || c.needsWork).length;
                            const mc = island.cards.filter((c: any) => c.status === 'mastered').length;
                            let ml: 'struggling' | 'learning' | 'mastered' = 'learning';
                            if (sc > 0) ml = 'struggling';
                            else if (island.cards.length > 0 && mc === island.cards.length) ml = 'mastered';
                            const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
                            const imgSrc = ml === 'struggling' ? `${basePath}/struggling.jpeg` : ml === 'mastered' ? `${basePath}/mastered.jpeg` : `${basePath}/learning.jpeg`;
                            return (
                              <IslandCard
                                key={island.id}
                                island={island}
                                masteryLevel={ml}
                                islandImageSrc={imgSrc}
                                trackingMode={trackingMode}
                                graceWindowMinutes={progress?.settings?.graceWindowMinutes ?? 0}
                                onClick={() => setSelectedIslandId(island.id)}
                                isOnline={isOnline}
                                isSelectMode
                                isSelected={studySelection.has(island.id)}
                                onLongPress={() => {}}
                                onSelect={() => setStudySelection(prev => {
                                  const next = new Set(prev ?? []);
                                  if (next.has(island.id)) next.delete(island.id);
                                  else next.add(island.id);
                                  return next;
                                })}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : filteredIslands.length > 0 ? (
                  // Archipelago drill-down: show its islands
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {filteredIslands.map((island) => {
                      const strugglingCount = island.cards.filter(c => c.status === 'struggling' || c.needsWork).length;
                      const masteredCount = island.cards.filter(c => c.status === 'mastered').length;

                      let masteryLevel: 'struggling' | 'learning' | 'mastered' = 'learning';
                      if (trackingMode === 'srs') {
                        const now = Date.now();
                        const sevenDaysMs = now + 7 * 24 * 60 * 60 * 1000;

                        if (island.cards.length > 0) {
                          const activeTierCards = getActiveTierCards(island.cards);
                          const hasDueOrOverdue = activeTierCards.some((c: any) => !c.srsNextReview || c.srsNextReview <= now + graceMs);
                          if (hasDueOrOverdue) {
                            masteryLevel = 'struggling';
                          } else if (activeTierCards.some((c: any) => c.srsNextReview <= sevenDaysMs)) {
                            masteryLevel = 'learning';
                          } else {
                            masteryLevel = 'mastered';
                          }
                        }
                      } else {
                        if (strugglingCount > 0) {
                          masteryLevel = 'struggling';
                        } else if (island.cards.length > 0 && masteredCount === island.cards.length) {
                          masteryLevel = 'mastered';
                        }
                      }

                      const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
                      let imageSrc = '';
                      if (masteryLevel === 'struggling') imageSrc = `${basePath}/struggling.jpeg`;
                      else if (masteryLevel === 'learning') imageSrc = `${basePath}/learning.jpeg`;
                      else imageSrc = `${basePath}/mastered.jpeg`;

                      return (
                        <IslandCard
                          key={island.id}
                          island={island}
                          masteryLevel={masteryLevel}
                          islandImageSrc={imageSrc}
                          trackingMode={trackingMode}
                          graceWindowMinutes={progress?.settings?.graceWindowMinutes ?? 0}
                          onClick={() => setSelectedIslandId(island.id)}
                          isPinned={isPinned(island.id)}
                          isOnline={isOnline}
                          onPinToggle={async (e) => {
                            e.stopPropagation();
                            if (isPinned(island.id)) {
                              await unpin(island.id);
                            } else {
                              await pin(island);
                            }
                          }}
                          isSelectMode={studySelection !== null}
                          isSelected={studySelection?.has(island.id) ?? false}
                          onLongPress={() => setStudySelection(new Set([island.id]))}
                          onSelect={() => setStudySelection(prev => {
                            const next = new Set(prev ?? []);
                            if (next.has(island.id)) next.delete(island.id);
                            else next.add(island.id);
                            return next;
                          })}
                          onMoveIsland={ownedArchipelagos.length > 0 ? (e) => { e.stopPropagation(); setMoveIslandId(island.id); } : undefined}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-[400px] w-full rounded-[40px] glass flex items-center justify-center relative overflow-hidden">
                    <div className="absolute top-[-50px] right-[-50px] w-[200px] h-[200px] bg-brand-primary/5 rounded-full blur-[60px]" />
                    <div className="text-center relative z-10">
                      <div className="w-20 h-20 rounded-3xl border border-brand-border bg-white/[0.02] mx-auto mb-6 flex items-center justify-center">
                        <LayoutDashboard className="w-8 h-8 text-brand-muted/30" />
                      </div>
                      <p className="text-brand-muted/40 font-medium text-sm uppercase tracking-[0.2em]">
                        {searchQuery ? `No islands match "${searchQuery}"` : "Start by creating your first Island"}
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <IslandDetail 
                  island={selectedIsland}
                  allIslands={progress?.islands || []}
                  archipelagos={progress?.archipelagos || []}
                  onUpdateIsland={(updates) => updateIsland(selectedIsland.id, updates)}
                  onBack={() => setSelectedIslandId(null)}
                  onAddCard={async (card) => {
                    await addCardToIsland(selectedIsland.id, card);
                    if (progress) {
                      const unlocked = await checkAndAwardAchievements({ progress, trigger: 'card-created' });
                      if (unlocked.length) enqueueToasts(unlocked);
                    }
                  }}
                  onUpdateCard={(cardIndex, card) => updateCardInIsland(selectedIsland.id, cardIndex, card)}
                  onDeleteCard={(cardIndex) => removeCardFromIsland(selectedIsland.id, cardIndex)}
                  onDeleteCardById={deleteCardById}
                  onMoveCard={(cardIndex, targetIslandId) => moveCardBetweenIslands(selectedIsland.id, targetIslandId, cardIndex)}
                  onDeleteIsland={() => {
                    removeIsland(selectedIsland.id);
                    setSelectedIslandId(null);
                  }}
                  onAddCards={async (cards) => {
                    await addCardsToIsland(selectedIsland.id, cards);
                    if (progress) {
                      const unlocked = await checkAndAwardAchievements({ progress, trigger: 'card-created' });
                      if (unlocked.length) enqueueToasts(unlocked);
                    }
                  }}
                  onShare={async (island, targetUids) => {
                    await shareIsland(island, targetUids);
                    if (progress) {
                      const unlocked = await checkAndAwardAchievements({ progress, trigger: 'island-shared' });
                      if (unlocked.length) enqueueToasts(unlocked);
                    }
                  }}
                  onUnshare={unshareIsland}
                  onStartStudy={(mode) => {
                    setStudyMode(mode);
                    setIsStudying(true);
                  }}
                  progressTrackingMode={trackingMode}
                  graceWindowMinutes={progress?.settings?.graceWindowMinutes ?? 0}
                  friends={friends}
                  fetchProfilesByUids={fetchProfilesByUids}
                  currentUserId={user?.uid ?? undefined}
                  onAddCollaborator={async (uid) => addCollaborator(selectedIsland.id, uid)}
                  onRemoveCollaborator={async (uid) => removeCollaborator(selectedIsland.id, uid)}
                  onResetIsland={resetIslandProgress}
                  onArchiveIsland={() => {
                    archiveIsland(selectedIsland.id);
                    setSelectedIslandId(null);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {!isStudying && (
        <nav className="md:hidden fixed bottom-1 left-4 right-4 bg-[#111]/90 backdrop-blur-xl border border-white/10 z-[100] flex items-center justify-between px-4 h-16 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] pb-[calc(env(safe-area-inset-bottom)*0.5)]">
        {/* Mobile Profile */}
        <div className="relative" ref={profileRef}>
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-9 h-9 rounded-xl overflow-hidden border border-white/10 shadow-lg active:scale-90"
          >
            <img 
              src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'D')}&background=4285F4&color=fff`} 
              alt="Profile" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </button>
          
          <AnimatePresence>
            {isProfileOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute bottom-full left-0 mb-4 w-60 glass p-4 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[110] border border-white/10"
              >
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/5">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{user?.displayName || 'Explorer'}</p>
                    <p className="text-[9px] text-brand-muted uppercase tracking-widest mt-0.5">
                      {user ? 'Verified' : 'Guest'}
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <button 
                    onClick={() => { setActiveModal('settings'); setIsProfileOpen(false); }}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-brand-muted hover:text-white hover:bg-white/5 transition-colors text-[10px] font-bold uppercase tracking-wider"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Settings
                  </button>
                  <button 
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-400/5 transition-colors text-[10px] font-bold uppercase tracking-wider"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Logout
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Home */}
        <button
          onClick={() => { setSelectedIslandId(null); setActiveModal(null); }}
          className={cn("p-2 transition-all relative", !selectedIslandId && !activeModal ? "text-white scale-110" : "text-brand-muted")}
        >
          <LayoutDashboard className="w-6 h-6" />
        </button>

        {/* Discover */}
        <button
          onClick={() => setActiveModal('discover')}
          className={cn("p-2 transition-all relative", activeModal === 'discover' ? "text-brand-primary scale-110" : "text-brand-muted")}
        >
          <Compass className="w-6 h-6" />
          {unreadDiscoverCount > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-primary border border-[#111]" />
          )}
        </button>

        {/* New-user quick-create button (replaces the full nav) */}
        {isNewUser ? (
          <button
            onClick={() => setIsArchipelagoModalOpen(true)}
            className="p-2 transition-all relative text-brand-primary"
            title="Create your first collection"
          >
            <Plus className="w-6 h-6" />
          </button>
        ) : (
          <>
            {/* Social */}
            <button
              onClick={() => setActiveModal('users')}
              className={cn("p-2 transition-all relative", activeModal === 'users' ? "text-white scale-110" : "text-brand-muted")}
            >
              <Users className="w-6 h-6" />
              {unreadSocialCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-primary border border-[#111]" />
              )}
            </button>

            {/* Stats */}
            <button
              onClick={() => setActiveModal('stats')}
              className={cn("p-2 transition-all relative", activeModal === 'stats' ? "text-brand-primary scale-110" : "text-brand-muted")}
            >
              <BarChart2 className="w-6 h-6" />
            </button>

            {/* Competitions */}
            <button
              onClick={() => setActiveModal('leaderboard')}
              className={cn("p-2 transition-all relative", activeModal === 'leaderboard' ? "text-brand-primary scale-110" : "text-brand-muted")}
            >
              <Trophy className="w-6 h-6" />
            </button>

            {/* Captain's Quarters */}
            <button
              onClick={() => setActiveModal('trophies')}
              className={cn("p-2 transition-all relative", activeModal === 'trophies' ? "text-brand-primary scale-110" : "text-brand-muted")}
            >
              <Award className="w-6 h-6" />
            </button>

            {/* Duplicate Scanner */}
            <button
              onClick={() => setActiveModal('duplicateScan')}
              className={cn("p-2 transition-all relative", activeModal === 'duplicateScan' ? "text-amber-400 scale-110" : "text-brand-muted")}
            >
              <ScanLine className="w-6 h-6" />
            </button>

            {/* Distress Signals */}
            <button
              onClick={() => { setDistressInitialTab('all'); setActiveModal('distress'); }}
              className={cn("p-2 transition-all relative", activeModal === 'distress' ? "text-orange-400 scale-110" : "text-orange-400/40")}
            >
              <Radio className="w-6 h-6" />
            </button>

            {/* Test Mode */}
            <button
              onClick={() => setActiveModal('testMode')}
              className={cn("p-2 transition-all relative", activeModal === 'testMode' ? "text-brand-primary scale-110" : "text-brand-muted")}
            >
              <GraduationCap className="w-6 h-6" />
            </button>

            {/* Archive */}
            <button
              onClick={() => setActiveModal('archive')}
              className={cn("p-2 transition-all relative", activeModal === 'archive' ? "text-amber-400 scale-110" : "text-brand-muted")}
            >
              <Archive className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Mobile Notifications */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={cn(
              "relative transition-all p-2 rounded-xl",
              isNotificationsOpen ? "text-white bg-white/5" : "text-brand-muted"
            )}
          >
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-brand-primary rounded-full border-2 border-brand-bg shadow-[0_0_10px_rgba(66,133,244,0.5)]" />
            )}
          </button>

          <AnimatePresence>
            {isNotificationsOpen && (
              <NotificationsPanel 
                notifications={notifications} 
                onClose={() => setIsNotificationsOpen(false)}
                onSelect={handleNotificationClick}
                position="bottom"
              />
            )}
          </AnimatePresence>
        </div>
      </nav>
      )}

      {/* Share Archipelago Confirmation */}
      <AnimatePresence>
        {selectedArchipelago && (
          <ShareModal
            isOpen={showShareArchipelagoConfirm}
            onClose={() => setShowShareArchipelagoConfirm(false)}
            title={selectedArchipelago.isPublic ? "Update Community Archipelago" : selectedArchipelago.sharedWith?.length ? "Update Sharing" : "Publish Archipelago?"}
            description={`This will share "${selectedArchipelago.name}" and all its ${islandsInArchipelago.length} islands. Other explorers will be able to anchor this knowledge.`}
            initialSelectedUids={selectedArchipelago.sharedWith || []}
            initialTab={selectedArchipelago.isPublic ? 'public' : selectedArchipelago.sharedWith?.length ? 'targeted' : 'public'}
            onSharePublic={async () => {
              await shareArchipelago(selectedArchipelago);
            }}
            onShareTargeted={async (uids) => {
              await shareArchipelago(selectedArchipelago, uids);
            }}
            friends={friends}
            fetchProfilesByUids={fetchProfilesByUids}
            sharedAtTimestamps={selectedArchipelago.sharedAtTimestamps}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUnshareArchipelagoConfirm && selectedArchipelago && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowUnshareArchipelagoConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass p-8 rounded-[40px] border-red-500/30 shadow-[0_40px_100px_rgba(0,0,0,0.8)] text-center"
            >
              <div className="w-20 h-20 bg-red-500/15 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-xl border border-red-500/30">
                {selectedArchipelago.isPublic ? <Globe className="w-10 h-10 text-red-300" /> : <Users className="w-10 h-10 text-red-300" />}
              </div>
              <h2 className="text-2xl font-bold mb-3 tracking-tight">
                {selectedArchipelago.isPublic ? 'Remove Archipelago?' : 'Stop Sharing?'}
              </h2>
              <p className="text-brand-muted text-sm leading-relaxed mb-10 px-4">
                {selectedArchipelago.isPublic 
                  ? <>This will remove <span className="text-white font-bold">"{selectedArchipelago.name}"</span> from the public discovery feed. People who already imported it will keep their copies.</>
                  : <>Your friends will no longer be able to discover or import <span className="text-white font-bold">"{selectedArchipelago.name}"</span>.</>}
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={async () => {
                    await unshareArchipelago(selectedArchipelago);
                    setShowUnshareArchipelagoConfirm(false);
                  }}
                  className="w-full py-4 bg-red-500 text-white rounded-[24px] font-black text-sm uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-transform"
                >
                  {selectedArchipelago.isPublic ? 'Remove from Community' : 'Stop Sharing'}
                </button>
                <button 
                  onClick={() => setShowUnshareArchipelagoConfirm(false)}
                  className="w-full py-4 text-brand-muted hover:text-white font-bold text-xs uppercase tracking-widest transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Archipelago Confirmation */}
      <AnimatePresence>
        {showDeleteArchipelagoConfirm && selectedArchipelago && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowDeleteArchipelagoConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass p-8 rounded-[40px] border-red-500/30 shadow-[0_40px_100px_rgba(0,0,0,0.8)] text-center"
            >
              <div className="w-20 h-20 bg-red-500/15 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-xl border border-red-500/30">
                <Trash2 className="w-10 h-10 text-red-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3 tracking-tight">Delete Archipelago?</h2>
              <p className="text-brand-muted text-sm leading-relaxed mb-2 px-4">
                This will permanently delete <span className="text-white font-bold">"{selectedArchipelago.name}"</span> and all of its islands and cards.
              </p>
              {selectedArchipelago.isCollaborative && (selectedArchipelago.collaborators || []).length > 0 && (
                <p className="text-amber-400/90 text-xs leading-relaxed mb-2 px-4">
                  This is a collaborative archipelago — deleting it will remove it for all {(selectedArchipelago.collaborators || []).length} crew member{(selectedArchipelago.collaborators || []).length !== 1 ? 's' : ''} too.
                </p>
              )}
              <p className="text-red-400/70 text-xs font-bold uppercase tracking-widest mb-10">This cannot be undone.</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => {
                    await removeArchipelago(selectedArchipelago.id);
                    setShowDeleteArchipelagoConfirm(false);
                    setSelectedArchipelagoId(null);
                  }}
                  className="w-full py-4 bg-red-500 text-white rounded-[24px] font-black text-sm uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-transform"
                >
                  Delete Everything
                </button>
                <button
                  onClick={() => setShowDeleteArchipelagoConfirm(false)}
                  className="w-full py-4 text-brand-muted hover:text-white font-bold text-xs uppercase tracking-widest transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Archive Archipelago Confirm */}
      <AnimatePresence>
        {showArchiveArchipelagoConfirm && selectedArchipelago && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowArchiveArchipelagoConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass p-8 rounded-[40px] border-amber-500/20 shadow-[0_40px_100px_rgba(0,0,0,0.8)] text-center"
            >
              <div className="w-20 h-20 bg-amber-500/15 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-xl border border-amber-500/30">
                <Archive className="w-10 h-10 text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3 tracking-tight">Archive Archipelago?</h2>
              <p className="text-brand-muted text-sm leading-relaxed mb-2 px-4">
                <span className="text-white font-bold">"{selectedArchipelago.name}"</span> and its islands will be hidden from your main view.
              </p>
              <p className="text-amber-400/70 text-xs font-bold uppercase tracking-widest mb-10">You can restore it any time from the Archive.</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => {
                    await archiveArchipelago(selectedArchipelago.id);
                    setShowArchiveArchipelagoConfirm(false);
                    setSelectedArchipelagoId(null);
                  }}
                  className="w-full py-4 bg-amber-500 text-white rounded-[24px] font-black text-sm uppercase tracking-widest shadow-lg shadow-amber-500/20 active:scale-95 transition-transform"
                >
                  Archive
                </button>
                <button
                  onClick={() => setShowArchiveArchipelagoConfirm(false)}
                  className="w-full py-4 text-brand-muted hover:text-white font-bold text-xs uppercase tracking-widest transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Move Island to Archipelago Modal */}
      <AnimatePresence>
        {moveIslandId && (() => {
          const movingIsland = progress?.islands.find(i => i.id === moveIslandId);
          if (!movingIsland) return null;
          return (
            <div key="move-island-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
                onClick={() => setMoveIslandId(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm glass p-8 rounded-[40px] shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-brand-primary/15 rounded-2xl flex items-center justify-center border border-brand-primary/30 shrink-0">
                    <Navigation2 className="w-6 h-6 text-brand-primary" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold leading-tight">Move Island</h2>
                    <p className="text-brand-muted text-xs truncate">{movingIsland.name}</p>
                  </div>
                </div>

                <p className="text-[10px] text-brand-muted uppercase tracking-widest font-bold mb-3">Select Destination</p>

                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                  <button
                    onClick={async () => {
                      await updateIsland(moveIslandId, { archipelagoId: undefined });
                      setMoveIslandId(null);
                    }}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-2xl border transition-all text-sm font-bold flex items-center justify-between",
                      !movingIsland.archipelagoId
                        ? "bg-brand-primary/20 border-brand-primary/40 text-brand-primary"
                        : "bg-white/5 border-white/10 text-brand-muted hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <span>None (standalone)</span>
                    {!movingIsland.archipelagoId && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                  {ownedArchipelagos.map(arch => (
                    <button
                      key={arch.id}
                      onClick={async () => {
                        await updateIsland(moveIslandId, { archipelagoId: arch.id });
                        setMoveIslandId(null);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-2xl border transition-all text-sm font-bold flex items-center justify-between",
                        movingIsland.archipelagoId === arch.id
                          ? "bg-brand-primary/20 border-brand-primary/40 text-brand-primary"
                          : "bg-white/5 border-white/10 text-brand-muted hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <span className="truncate">{arch.name}</span>
                      {movingIsland.archipelagoId === arch.id && <Check className="w-3.5 h-3.5 shrink-0 ml-2" />}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setMoveIslandId(null)}
                  className="mt-5 w-full py-3 text-brand-muted hover:text-white font-bold text-xs uppercase tracking-widest transition-colors"
                >
                  Cancel
                </button>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      <ConfirmDialog
        open={showResetArchipelagoConfirm}
        title="Reset archipelago progress?"
        message={`All mastery data across every island in "${selectedArchipelago?.name ?? 'this archipelago'}" will be cleared. Your cards and content are kept.`}
        confirmLabel="Reset"
        danger={true}
        onConfirm={async () => {
          setShowResetArchipelagoConfirm(false);
          if (selectedArchipelago) await resetArchipelagoProgress(selectedArchipelago.id);
        }}
        onCancel={() => setShowResetArchipelagoConfirm(false)}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        danger={confirmDialog.danger}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))}
      />
    </div>
  );
}

interface IslandCardProps {
  island: any;
  masteryLevel: 'struggling' | 'learning' | 'mastered';
  islandImageSrc: string;
  trackingMode?: string;
  graceWindowMinutes?: number;
  onClick: () => void;
  key?: string | number;
  isPinned?: boolean;
  isOnline?: boolean;
  onPinToggle?: (e: { stopPropagation: () => void }) => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onLongPress?: () => void;
  onSelect?: () => void;
  onMoveIsland?: (e: React.MouseEvent) => void;
}

function IslandCard({ island, masteryLevel, islandImageSrc, trackingMode, graceWindowMinutes = 0, onClick, isPinned = false, isOnline = true, onPinToggle, isSelectMode = false, isSelected = false, onLongPress, onSelect, onMoveIsland }: IslandCardProps) {
  const getMasteryStyles = () => {
    switch (masteryLevel) {
      case 'struggling':
        return 'bg-gradient-to-br from-gray-900 to-purple-900/20 border-gray-800 hover:border-purple-500/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.25)]';
      case 'learning':
        return 'bg-gradient-to-br from-gray-900 to-blue-900/20 border-gray-800 hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.25)]';
      case 'mastered':
        return 'bg-gradient-to-br from-gray-900 to-emerald-900/20 border-gray-800 hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.25)]';
      default:
        return 'glass hover:border-brand-primary/30';
    }
  };

  const getStatusDescription = () => {
    if (trackingMode === 'srs') {
      const cardGraceMs = graceWindowMinutes * 60_000;
      const nextDueTs = (island.cards || []).reduce((min: number, c: any) => {
        if (c.srsNextReview && c.srsNextReview > Date.now() + cardGraceMs) return Math.min(min, c.srsNextReview);
        return min;
      }, Infinity);
      switch (masteryLevel) {
        case 'struggling': return "Cards due — some are overdue for review.";
        case 'learning': return isFinite(nextDueTs) ? `Coming up — next due ${formatTimeUntil(nextDueTs)}.` : "Coming up — cards due soon.";
        case 'mastered': return "All caught up — nothing due for over a week!";
        default: return "";
      }
    }
    switch (masteryLevel) {
      case 'struggling':
        return "Struggling Island — you have some items in the struggling category.";
      case 'learning':
        return "Learning Island — you're making progress with these cards.";
      case 'mastered':
        return "Mastered Island — well done, you've mastered this set!";
      default:
        return "";
    }
  };

  const isOfflineUnavailable = !isOnline && !isPinned;
  const longPressHandlers = useLongPress(onLongPress ?? (() => {}));

  return (
    <motion.div
      layoutId={island.id}
      {...(!isSelectMode && !isOfflineUnavailable ? longPressHandlers : {})}
      onClick={isOfflineUnavailable ? undefined : isSelectMode ? onSelect : onClick}
      className={cn(
        "rounded-[32px] p-6 flex flex-row items-center gap-6 transition-all duration-300 relative border h-40",
        isOfflineUnavailable
          ? "opacity-40 cursor-not-allowed border-white/5 bg-white/[0.02]"
          : cn("cursor-pointer group hover:-translate-y-1", getMasteryStyles()),
        isSelected && "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0a0a0a]"
      )}
    >
      {isSelectMode && (
        <div className={cn(
          "absolute top-3 left-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all z-10",
          isSelected ? "bg-emerald-500 border-emerald-500" : "border-white/40 bg-black/30"
        )}>
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
      )}

      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)] relative bg-black/40 flex items-center justify-center shrink-0 border-brand-border">
        <LightboxImage
          src={islandImageSrc}
          className="w-[130%] h-[130%] object-cover transition-transform duration-500 group-hover:scale-125"
          containerClassName="w-full h-full"
        />
      </div>
      
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-lg font-bold text-white truncate group-hover:whitespace-normal transition-all duration-300" title={island.name}>
            {island.name}
          </h3>
          {island.isCollaborative && (
            <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-[9px] font-black uppercase tracking-widest">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Crew
            </span>
          )}
        </div>
        <p className="text-brand-muted text-xs uppercase tracking-[0.15em] font-medium mb-1">
          {island.cards?.length || 0} Core Cards
        </p>
        <p className="text-[10px] text-brand-muted/70 italic leading-tight group-hover:text-brand-muted transition-colors">
          {isOfflineUnavailable ? 'Not available offline — pin to study without internet' : getStatusDescription()}
        </p>
      </div>

      {/* Pin toggle button */}
      {onPinToggle && !isSelectMode && (
        <button
          onClick={onPinToggle}
          title={isPinned ? 'Remove from offline' : 'Save for offline study'}
          className={cn(
            "absolute top-3 right-3 p-1.5 rounded-xl border transition-all",
            isPinned
              ? "text-brand-primary border-brand-primary/30 bg-brand-primary/10 hover:bg-brand-primary/20"
              : "text-brand-muted/40 border-transparent hover:text-brand-muted hover:border-white/10 hover:bg-white/5"
          )}
        >
          {isPinned ? <CloudDownload className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
        </button>
      )}

      {/* Move to archipelago button */}
      {onMoveIsland && !isSelectMode && (
        <button
          onClick={onMoveIsland}
          title="Move to another archipelago"
          className="absolute bottom-3 right-3 p-1.5 rounded-xl border transition-all text-brand-muted/40 border-transparent hover:text-brand-muted hover:border-white/10 hover:bg-white/5"
        >
          <Navigation2 className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
}

function NotificationsPanel({ 
  notifications, 
  onClose,
  onSelect,
  position = 'side'
}: { 
  notifications: any[], 
  onClose: () => void,
  onSelect: (id: string) => void,
  position?: 'side' | 'bottom'
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <motion.div
      ref={panelRef}
      initial={position === 'side' ? { opacity: 0, scale: 0.95, x: 10 } : { opacity: 0, scale: 0.95, y: -10 }}
      animate={position === 'side' ? { opacity: 1, scale: 1, x: 0 } : { opacity: 1, scale: 1, y: 0 }}
      exit={position === 'side' ? { opacity: 0, scale: 0.95, x: 10 } : { opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "absolute glass p-3 rounded-[24px] shadow-[0_40px_100px_rgba(0,0,0,0.8)] z-[100] border border-white/10",
        position === 'side' ? "left-full ml-4 top-0 w-80" : "bottom-full right-0 mb-4 w-72 h-auto"
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 mb-2">
        <p className="text-[10px] text-brand-muted uppercase tracking-[0.2em] font-black">Memory Alerts</p>
        <span className="text-[10px] bg-brand-primary/20 text-brand-primary px-2 py-0.5 rounded-full font-bold">
          {notifications.length} Alerts
        </span>
      </div>

      <div className={cn("overflow-y-auto space-y-1 custom-scrollbar", position === 'side' ? "max-h-[300px]" : "max-h-[250px]")}>
        {notifications.length > 0 ? (
          notifications.map((notif) => (
            <button
              key={notif.id}
              onClick={() => onSelect(notif.islandId)}
              className="w-full text-left p-4 rounded-2xl hover:bg-white/5 transition-colors group flex gap-3 items-start"
            >
              <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border",
                notif.type === 'error' ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/10 border-amber-500/20"
              )}>
                <AlertCircle className={cn(
                  "w-4 h-4",
                  notif.type === 'error' ? "text-red-400" : "text-amber-400"
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold leading-none mb-1 text-white">{notif.title}</p>
                <p className="text-[11px] text-brand-muted leading-relaxed line-clamp-2">
                  {notif.message}
                </p>
              </div>
            </button>
          ))
        ) : (
          <div className="py-12 text-center">
            <Bell className="w-8 h-8 text-brand-muted/20 mx-auto mb-3" />
            <p className="text-xs text-brand-muted tracking-tight">Your memory map is stable.</p>
            <p className="text-[10px] text-white/20 uppercase tracking-widest mt-1">No alerts</p>
          </div>
        )}
      </div>

      {position === 'side' && <div className="absolute top-[-6px] right-4 w-3 h-3 bg-[#111] border-l border-t border-white/10 rotate-45" />}
      {position === 'bottom' && <div className="absolute bottom-[-6px] right-4 w-3 h-3 bg-[#111] border-r border-b border-white/10 rotate-45" />}
    </motion.div>
  );
}

interface ArchipelagoCardProps {
  archipelago: { id: string; name: string; isCollaborative?: boolean };
  islandCount: number;
  totalCards: number;
  masteryLevel: 'struggling' | 'learning' | 'mastered';
  imageSrc: string;
  onClick: () => void;
  onLongPress?: () => void;
}

function ArchipelagoCard({ archipelago, islandCount, totalCards, masteryLevel, imageSrc, onClick, onLongPress }: ArchipelagoCardProps) {
  const longPressHandlers = useLongPress(onLongPress ?? (() => {}));
  const getMasteryStyles = () => {
    switch (masteryLevel) {
      case 'struggling':
        return 'bg-gradient-to-br from-gray-900 to-purple-900/20 border-gray-800 hover:border-purple-500/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.25)]';
      case 'learning':
        return 'bg-gradient-to-br from-gray-900 to-blue-900/20 border-gray-800 hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.25)]';
      case 'mastered':
        return 'bg-gradient-to-br from-gray-900 to-emerald-900/20 border-gray-800 hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.25)]';
    }
  };

  const getStatusDescription = () => {
    switch (masteryLevel) {
      case 'struggling': return 'Some islands need attention — struggling cards detected.';
      case 'learning': return 'Making progress — keep studying to advance.';
      case 'mastered': return 'Outstanding — all islands fully mastered!';
    }
  };

  return (
    <motion.div
      layoutId={archipelago.id}
      {...longPressHandlers}
      onClick={onClick}
      className={cn(
        'rounded-[32px] p-6 flex flex-row items-center gap-6 transition-all duration-300 relative border h-40 cursor-pointer group hover:-translate-y-1',
        getMasteryStyles()
      )}
    >
      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)] relative bg-black/40 flex items-center justify-center shrink-0 border-brand-border">
        <LightboxImage
          src={imageSrc}
          className="w-[130%] h-[130%] object-cover transition-transform duration-500 group-hover:scale-125"
          containerClassName="w-full h-full"
        />
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-lg font-bold text-white truncate group-hover:whitespace-normal transition-all duration-300" title={archipelago.name}>
            {archipelago.name}
          </h3>
          {archipelago.isCollaborative && (
            <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-[9px] font-black uppercase tracking-widest">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Crew
            </span>
          )}
        </div>
        <p className="text-brand-muted text-xs uppercase tracking-[0.15em] font-medium mb-1">
          {islandCount} {islandCount === 1 ? 'Island' : 'Islands'} · {totalCards} Cards
        </p>
        <p className="text-[10px] text-brand-muted/70 italic leading-tight group-hover:text-brand-muted transition-colors">
          {getStatusDescription()}
        </p>
      </div>
    </motion.div>
  );
}
