import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import SocialLeaderboard from './SocialLeaderboard';
import { LayoutDashboard, Users, Settings, LogOut, Search, Bell, Plus, Info, AlertCircle, X, Globe, Download, Check, Map, Play, BarChart2, Zap, Activity, Trophy, Award, Trash2, Calendar, RefreshCw } from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useUserProgress, Island, CardStatus, CardUpdateRecord } from '../hooks/useUserProgress';
import { cn } from '../lib/utils';
import NewIslandModal from './NewIslandModal';
import NewArchipelagoModal from './NewArchipelagoModal';
import IslandDetail from './IslandDetail';
import StudySession from './StudySession';

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
    shareIsland,
    unshareIsland,
    shareArchipelago,
    unshareArchipelago,
    discoverIslands,
    discoverArchipelagos,
    importIsland,
    importArchipelago,
    deletePublishedIsland,
    deletePublishedArchipelago,
    removeArchipelago,
  } = useUserProgress();
  const [selectedIslandId, setSelectedIslandId] = useState<string | null>(null);
  const [selectedArchipelagoId, setSelectedArchipelagoId] = useState<string | null>(() => {
    return localStorage.getItem('selectedArchipelagoId') || null;
  });
  const [isStudying, setIsStudying] = useState(false);
  const [studyMode, setStudyMode] = useState<'all' | 'struggling' | 'learning' | 'mastered'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isArchipelagoModalOpen, setIsArchipelagoModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'users' | 'settings' | 'stats' | 'leaderboard' | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'alpha-asc' | 'alpha-desc' | 'creation'>(() => {
    return (localStorage.getItem('islandSortOrder') as 'alpha-asc' | 'alpha-desc' | 'creation') || 'alpha-asc';
  });

  useEffect(() => {
    localStorage.setItem('islandSortOrder', sortOrder);
  }, [sortOrder]);

  useEffect(() => {
    if (selectedArchipelagoId) {
      localStorage.setItem('selectedArchipelagoId', selectedArchipelagoId);
    } else {
      localStorage.removeItem('selectedArchipelagoId');
    }
  }, [selectedArchipelagoId]);

  // Discovery State
  const [discoverySearch, setDiscoverySearch] = useState('');
  const [discoveryTab, setDiscoveryTab] = useState<'islands' | 'archipelagos'>('islands');
  const [publicIslands, setPublicIslands] = useState<Island[]>([]);
  const [publicArchipelagos, setPublicArchipelagos] = useState<any[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [showShareArchipelagoConfirm, setShowShareArchipelagoConfirm] = useState(false);
  const [showUnshareArchipelagoConfirm, setShowUnshareArchipelagoConfirm] = useState(false);
  const [showDeleteArchipelagoConfirm, setShowDeleteArchipelagoConfirm] = useState(false);

  useEffect(() => {
    if (activeModal === 'users') {
      if (discoveryTab === 'islands') {
        loadPublicIslands();
      } else {
        loadPublicArchipelagos();
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
    const islands = await discoverIslands(discoverySearch);
    setPublicIslands(islands);
    setIsDiscovering(false);
  };

  const loadPublicArchipelagos = async () => {
    setIsDiscovering(true);
    const archipelagos = await discoverArchipelagos(discoverySearch);
    setPublicArchipelagos(archipelagos);
    setIsDiscovering(false);
  };

  // Exclude imported (anchored from community) islands from the main view and study
  const currentIslands = (progress?.islands || []).filter(i => !i.isImported);
  const islandsInArchipelago = selectedArchipelagoId 
    ? currentIslands.filter(island => island.archipelagoId === selectedArchipelagoId)
    : currentIslands;

  const filteredIslands = islandsInArchipelago
    .filter(island => island.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === 'alpha-asc') return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      if (sortOrder === 'alpha-desc') return b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' });
      if (sortOrder === 'creation') return (b.createdAt || 0) - (a.createdAt || 0);
      return 0;
    });

  // Only show non-imported archipelagos in the selector
  const ownedArchipelagos = (progress?.archipelagos || []).filter(a => !a.isImported);

  const selectedArchipelago = ownedArchipelagos.find(a => a.id === selectedArchipelagoId);
  const archipelagoName = selectedArchipelago ? selectedArchipelago.name : 'The Archipelago';

  // Combine all cards for Archipelago Study (imported islands excluded)
  const allCards = islandsInArchipelago.flatMap(i => i.cards) || [];
  const archipelagoIsland: Island = {
    id: 'archipelago',
    name: archipelagoName,
    color_score: islandsInArchipelago.reduce((acc, i) => acc + i.color_score, 0) || 0,
    cards: allCards
  };

  // Adjusted counts for Archipelago
  const globalStrugglingCount = allCards.filter(c => c.status === 'struggling' || c.needsWork).length;
  const globalLearningCount = allCards.filter(c => (!c.status && !c.needsWork) || c.status === 'learning').length;
  const globalMasteredCount = allCards.filter(c => c.status === 'mastered').length;

  const notifications = currentIslands.filter(i => i.color_score < 80).map(island => ({
    id: `review-${island.id}`,
    title: island.color_score < 40 ? 'Urgent Review' : 'Review Recommended',
    message: island.color_score < 40 
      ? `${island.name} needs attention. Study now to improve your score!`
      : `${island.name} score is decreasing. Study soon to maintain mastery.`,
    islandId: island.id,
    type: island.color_score < 40 ? 'error' : 'warning'
  })) || [];

  const unreadCount = notifications.length;

  const handleSignOut = () => signOut(auth);

  const selectedIsland = selectedIslandId === 'archipelago' ? archipelagoIsland : currentIslands.find(i => i.id === selectedIslandId);

  const handleFinishStudy = async (delta: number, cardUpdates: CardUpdateRecord, maxStreak: number = 0) => {
    if (selectedIslandId === 'archipelago') {
      await processArchipelagoResults(delta, cardUpdates, maxStreak);
    } else if (selectedIslandId) {
      await processSessionResults(selectedIslandId, delta, cardUpdates, maxStreak);
    }
    setIsStudying(false);
    setSelectedIslandId(null);
  };

  const getScoreColor = (score: number) => {
    if (score > 80) return 'text-emerald-400';
    if (score > 40) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-brand-bg flex text-white relative">
      <NewIslandModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={addIsland}
        archipelagos={progress?.archipelagos || []}
        defaultArchipelagoId={selectedArchipelagoId}
      />

      <NewArchipelagoModal
        isOpen={isArchipelagoModalOpen}
        onClose={() => setIsArchipelagoModalOpen(false)}
        onSubmit={async (name) => {
          const newId = await addArchipelago(name);
          if (newId) setSelectedArchipelagoId(newId);
        }}
      />

      {/* Community Modal (Marketplace) */}
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
              className="relative w-full max-w-2xl bg-[#111] border border-white/10 rounded-[32px] p-8 shadow-2xl flex flex-col max-h-[90vh]"
            >
              <button 
                onClick={() => setActiveModal(null)}
                className="absolute top-6 right-6 text-brand-muted hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-6 mb-8">
                <div className="w-14 h-14 bg-brand-primary/10 rounded-2xl flex items-center justify-center border border-brand-primary/20">
                  <Globe className="w-7 h-7 text-brand-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Community Discovery</h2>
                  <div className="flex gap-4 mt-2">
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
              </div>

              <div className="relative mb-8 group">
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
                            <h4 className="font-bold text-lg mb-1">{island.name}</h4>
                            <div className="flex items-center gap-3 text-[10px] text-brand-muted uppercase tracking-widest font-black">
                              <span className="flex items-center gap-1">
                                <Download className="w-3 h-3" />
                                {island.downloads || 0}
                              </span>
                              <span className="w-1 h-1 bg-white/20 rounded-full" />
                              <span>{island.cards.length} Cards</span>
                              <span className="w-1 h-1 bg-white/20 rounded-full" />
                              <span className="text-brand-primary">@{island.authorName}</span>
                              <span className="w-1 h-1 bg-white/20 rounded-full" />
                              <span className="flex items-center gap-1 opacity-60">
                                <Calendar className="w-3 h-3" />
                                {formatDate(island.publishedAt || (island as any).submittedAt)}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {island.authorId === user?.uid && (
                              <>
                                <button 
                                  onClick={async () => {
                                    const localIsland = progress?.islands.find(i => i.publishedId === island.id || i.id === island.id);
                                    if (localIsland) {
                                      await shareIsland(localIsland);
                                      loadPublicIslands();
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
                                  onClick={() => {
                                    if (confirm('Are you sure you want to permanently delete this shared island?')) {
                                      deletePublishedIsland(island.id);
                                      setPublicIslands(prev => prev.filter(i => i.id !== island.id));
                                    }
                                  }}
                                  className="flex items-center justify-center px-4 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 font-bold transition-all shadow-lg active:scale-95"
                                  title="Delete from Community"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button 
                              onClick={() => {
                                importIsland(island);
                                setActiveModal(null);
                              }}
                              disabled={isAlreadyImported && island.authorId !== user?.uid}
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
                            <h4 className="font-bold text-lg mb-1">{arch.name}</h4>
                            <div className="flex items-center gap-3 text-[10px] text-brand-muted uppercase tracking-widest font-black">
                              <span className="flex items-center gap-1">
                                <Download className="w-3 h-3" />
                                {arch.downloads || 0}
                              </span>
                              <span className="w-1 h-1 bg-white/20 rounded-full" />
                              <span>{arch.islandCount} Islands</span>
                              <span className="w-1 h-1 bg-white/20 rounded-full" />
                              <span className="text-brand-primary">@{arch.authorName}</span>
                              <span className="w-1 h-1 bg-white/20 rounded-full" />
                              <span className="flex items-center gap-1 opacity-60">
                                <Calendar className="w-3 h-3" />
                                {formatDate(arch.publishedAt)}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {arch.authorId === user?.uid && (
                              <>
                                <button 
                                  onClick={async () => {
                                    const localArch = progress?.archipelagos?.find(a => a.publishedId === arch.id || a.id === arch.id);
                                    if (localArch) {
                                      await shareArchipelago(localArch);
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
                                  onClick={() => {
                                    if (confirm('Are you sure you want to permanently delete this shared archipelago?')) {
                                      deletePublishedArchipelago(arch.id);
                                      setPublicArchipelagos(prev => prev.filter(a => a.id !== arch.id));
                                    }
                                  }}
                                  className="flex items-center justify-center px-4 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 font-bold transition-all shadow-lg active:scale-95"
                                  title="Delete from Community"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button 
                              onClick={() => {
                                importArchipelago(arch);
                                setActiveModal(null);
                              }}
                              disabled={isAlreadyImported && arch.authorId !== user?.uid}
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
                    onChange={(e) => setSortOrder(e.target.value as 'alpha-asc' | 'alpha-desc' | 'creation')}
                    className="bg-[#222] border border-white/10 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-brand-primary"
                  >
                    <option value="alpha-asc">A to Z</option>
                    <option value="alpha-desc">Z to A</option>
                    <option value="creation">Creation Date</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div>
                    <p className="text-sm font-bold text-white mb-1">Learning Streak</p>
                    <p className="text-xs text-brand-muted">Correct in a row to move from Struggling to Learning.</p>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={progress?.settings?.learningStreakNeeded || 1}
                    onChange={(e) => updateSettings({ learningStreakNeeded: parseInt(e.target.value) || 1 })}
                    className="w-16 bg-[#222] border border-white/10 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-brand-primary text-center"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div>
                    <p className="text-sm font-bold text-white mb-1">Mastery Streak</p>
                    <p className="text-xs text-brand-muted">Correct in a row to move from Learning to Mastered.</p>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={progress?.settings?.masteryStreakNeeded || 3}
                    onChange={(e) => updateSettings({ masteryStreakNeeded: parseInt(e.target.value) || 3 })}
                    className="w-16 bg-[#222] border border-white/10 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-brand-primary text-center"
                  />
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
          <SocialLeaderboard onClose={() => setActiveModal(null)} />
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                    </div>
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
                            <span className="text-[10px] tracking-widest uppercase font-bold text-brand-muted whitespace-nowrap">
                              {island.color_score} / 100 Score
                            </span>
                          </div>
                        </div>
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
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar - Desktop Only */}
      <aside className="w-20 hidden md:flex flex-col items-center py-6 border-r border-brand-border bg-brand-card sticky top-0 h-screen z-50">
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
                onSelect={(id) => {
                  setSelectedIslandId(id);
                  setIsNotificationsOpen(false);
                }}
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
            onClick={() => setActiveModal('users')}
            className="relative group text-brand-muted hover:text-white transition-all flex items-center justify-center"
          >
            <Users className="w-6 h-6" />
            <div className="absolute left-full ml-4 px-3 py-1.5 bg-[#222] border border-white/5 text-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
              Community
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
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
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
        <div className="p-6 md:p-12 max-w-7xl mx-auto w-full">
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
                  onFinish={handleFinishStudy}
                  onManage={async (delta, cardUpdates, maxStreak) => {
                    if (selectedIslandId === 'archipelago') await processArchipelagoResults(delta, cardUpdates, maxStreak);
                    else if (selectedIslandId) await processSessionResults(selectedIslandId, delta, cardUpdates, maxStreak);
                    setIsStudying(false);
                  }}
                  onBackToMap={async (delta, cardUpdates, maxStreak) => {
                    if (selectedIslandId === 'archipelago') await processArchipelagoResults(delta, cardUpdates, maxStreak);
                    else if (selectedIslandId) await processSessionResults(selectedIslandId, delta, cardUpdates, maxStreak);
                    setIsStudying(false);
                    setSelectedIslandId(null);
                  }}
                  onSwitchMode={async (newMode, delta, cardUpdates, maxStreak) => {
                    if (selectedIslandId === 'archipelago') await processArchipelagoResults(delta, cardUpdates, maxStreak);
                    else if (selectedIslandId) await processSessionResults(selectedIslandId, delta, cardUpdates, maxStreak);
                    setStudyMode(newMode);
                  }}
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
                <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-12 gap-6">
                  <div>
                    <div className="flex items-center gap-4 mb-2">
                      <h2 className="text-2xl sm:text-[32px] font-bold tracking-tight">Memory Islands</h2>
                      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-1">
                        <select
                          value={selectedArchipelagoId || ''}
                          onChange={(e) => setSelectedArchipelagoId(e.target.value || null)}
                          className="bg-transparent text-white font-bold text-sm px-3 py-1 outline-none appearance-none cursor-pointer"
                        >
                          <option value="" className="bg-[#111]">All Islands</option>
                          {ownedArchipelagos.map(a => (
                            <option key={a.id} value={a.id} className="bg-[#111]">{a.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => setIsArchipelagoModalOpen(true)}
                          className="p-1 hover:bg-white/10 rounded-xl transition-colors text-brand-muted hover:text-white"
                          title="New Archipelago"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-brand-muted font-normal text-sm sm:text-base">Manage your knowledge base and track retention.</p>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-2xl font-bold text-sm hover:bg-white/90 transition-all shadow-[0_10px_30px_rgba(255,255,255,0.1)] shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Create New Island
                  </button>
                </div>

                {/* Archipelago Study Section */}
                {allCards.length > 0 && (
                  <div className="mb-12 glass p-8 rounded-[40px] border-brand-primary/20 relative overflow-hidden group">
                    <div className="absolute top-[-100px] right-[-100px] w-[300px] h-[300px] bg-brand-primary/10 rounded-full blur-[80px] group-hover:bg-brand-primary/15 transition-colors" />
                    
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 relative z-10">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-brand-primary/10 rounded-3xl flex items-center justify-center border border-brand-primary/20 shrink-0">
                          <Map className="w-8 h-8 text-brand-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-xl font-bold">{archipelagoName} Study</h3>
                            {selectedArchipelagoId && (
                              <>
                                <button 
                                  onClick={() => selectedArchipelago?.isPublic ? setShowUnshareArchipelagoConfirm(true) : setShowShareArchipelagoConfirm(true)}
                                  className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-brand-muted hover:text-white hover:border-white/10 transition-all flex items-center gap-1.5"
                                  title={selectedArchipelago?.isPublic ? "Remove this Archipelago from Community" : "Share this Archipelago"}
                                >
                                  <Globe className="w-3.5 h-3.5" />
                                  <span className="text-[10px] font-bold uppercase tracking-tight">
                                    {selectedArchipelago?.isPublic ? 'Public' : 'Share'}
                                  </span>
                                </button>
                                <button
                                  onClick={() => setShowDeleteArchipelagoConfirm(true)}
                                  className="p-1.5 rounded-lg bg-red-500/5 border border-red-500/10 text-red-400/60 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all flex items-center gap-1.5"
                                  title="Delete this Archipelago"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span className="text-[10px] font-bold uppercase tracking-tight">Delete</span>
                                </button>
                              </>
                            )}
                          </div>
                          <p className="text-brand-muted text-sm max-w-sm">Review your entire knowledge base across all anchored islands.</p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
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
                ) : filteredIslands.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {filteredIslands.map((island) => {
                      const strugglingCount = island.cards.filter(c => c.status === 'struggling' || c.needsWork).length;
                      const learningCount = island.cards.filter(c => (!c.status && !c.needsWork) || c.status === 'learning').length;
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
                          onClick={() => setSelectedIslandId(island.id)}
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
                  onAddCard={(card) => addCardToIsland(selectedIsland.id, card)}
                  onUpdateCard={(cardIndex, card) => updateCardInIsland(selectedIsland.id, cardIndex, card)}
                  onDeleteCard={(cardIndex) => removeCardFromIsland(selectedIsland.id, cardIndex)}
                  onMoveCard={(cardIndex, targetIslandId) => moveCardBetweenIslands(selectedIsland.id, targetIslandId, cardIndex)}
                  onDeleteIsland={() => {
                    removeIsland(selectedIsland.id);
                    setSelectedIslandId(null);
                  }}
                  onAddCards={(cards) => addCardsToIsland(selectedIsland.id, cards)}
                  onShare={shareIsland}
                  onUnshare={unshareIsland}
                  onStartStudy={(mode) => {
                    setStudyMode(mode);
                    setIsStudying(true);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
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

        {/* Social */}
        <button 
          onClick={() => setActiveModal('users')} 
          className={cn("p-2 transition-all relative", activeModal === 'users' ? "text-white scale-110" : "text-brand-muted")}
        >
          <Users className="w-6 h-6" />
        </button>

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
                onSelect={(id) => {
                  setSelectedIslandId(id);
                  setIsNotificationsOpen(false);
                }}
                position="bottom"
              />
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Share Archipelago Confirmation */}
      <AnimatePresence>
        {showShareArchipelagoConfirm && selectedArchipelago && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowShareArchipelagoConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass p-8 rounded-[40px] border-brand-primary/30 shadow-[0_40px_100px_rgba(0,0,0,0.8)] text-center"
            >
              <div className="w-20 h-20 bg-brand-primary/20 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-xl border border-brand-primary/30">
                <Globe className="w-10 h-10 text-brand-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-3 tracking-tight">Publish Archipelago?</h2>
              <p className="text-brand-muted text-sm leading-relaxed mb-10 px-4">
                This will share <span className="text-white font-bold">"{selectedArchipelago.name}"</span> and all its <span className="text-white font-bold">{islandsInArchipelago.length} islands</span> to the public discovery feed. Other explorers will be able to anchor this knowledge.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={async () => {
                    await shareArchipelago(selectedArchipelago);
                    setShowShareArchipelagoConfirm(false);
                  }}
                  className="w-full py-4 bg-brand-primary text-white rounded-[24px] font-black text-sm uppercase tracking-widest shadow-lg shadow-brand-primary/20 active:scale-95 transition-transform"
                >
                  Confirm & Publish
                </button>
                <button 
                  onClick={() => setShowShareArchipelagoConfirm(false)}
                  className="w-full py-4 text-brand-muted hover:text-white font-bold text-xs uppercase tracking-widest transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
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
                <Globe className="w-10 h-10 text-red-300" />
              </div>
              <h2 className="text-2xl font-bold mb-3 tracking-tight">Remove Archipelago?</h2>
              <p className="text-brand-muted text-sm leading-relaxed mb-10 px-4">
                This will remove <span className="text-white font-bold">"{selectedArchipelago.name}"</span> from the public discovery feed. People who already imported it will keep their copies.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={async () => {
                    await unshareArchipelago(selectedArchipelago);
                    setShowUnshareArchipelagoConfirm(false);
                  }}
                  className="w-full py-4 bg-red-500 text-white rounded-[24px] font-black text-sm uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-transform"
                >
                  Remove from Community
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
    </div>
  );
}

interface IslandCardProps {
  island: any;
  masteryLevel: 'struggling' | 'learning' | 'mastered';
  islandImageSrc: string;
  onClick: () => void;
  key?: string | number;
}

function IslandCard({ island, masteryLevel, islandImageSrc, onClick }: IslandCardProps) {
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

  return (
    <motion.div 
      layoutId={island.id}
      onClick={onClick}
      className={cn(
        "rounded-[32px] p-6 flex flex-row items-center gap-6 transition-all duration-300 cursor-pointer group relative border hover:-translate-y-1 h-40",
        getMasteryStyles()
      )}
    >
      
      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)] relative bg-black/40 flex items-center justify-center shrink-0 border-brand-border">
        <img 
          src={islandImageSrc} 
          alt={`${masteryLevel} island`} 
          className="w-[130%] h-[130%] object-cover transition-transform duration-500 group-hover:scale-125" 
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (masteryLevel === 'struggling') target.src = 'https://images.unsplash.com/photo-1505672678657-cc7037095e60?auto=format&fit=crop&q=80&w=200&h=200';
            else if (masteryLevel === 'learning') target.src = 'https://images.unsplash.com/photo-1544550581-5f7ceaf7f992?auto=format&fit=crop&q=80&w=200&h=200';
            else target.src = 'https://images.unsplash.com/photo-1523363065056-11f8b449174b?auto=format&fit=crop&q=80&w=200&h=200';
          }}
        />
      </div>
      
      <div className="flex-1 overflow-hidden">
        <h3 className="text-lg font-bold mb-1 text-white truncate group-hover:whitespace-normal transition-all duration-300" title={island.name}>
          {island.name}
        </h3>
        <p className="text-brand-muted text-xs uppercase tracking-[0.15em] font-medium mb-1">
          {island.cards?.length || 0} Core Cards
        </p>
        <p className="text-[10px] text-brand-muted/70 italic leading-tight group-hover:text-brand-muted transition-colors">
          {getStatusDescription()}
        </p>
      </div>
    </motion.div>
  );
}

function RetentionTooltip({ score }: { score: number }) {
  const [show, setShow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShow(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getStatus = (s: number) => {
    if (s > 80) return { label: 'High Retention', desc: 'Solid consistency. You know this material well.' };
    if (s > 40) return { label: 'Moderate Retention', desc: 'Starting to slip. A review session is recommended.' };
    return { label: 'Low Retention', desc: 'Significant attention needed. Study now to rebuild knowledge.' };
  };

  const status = getStatus(score);
  
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const safeScore = Math.max(0, Math.min(100, score));
  const dashoffset = circumference - (safeScore / 100) * circumference;
  
  const colorClass = score > 80 ? 'text-emerald-400 stroke-emerald-400' : score > 40 ? 'text-amber-400 stroke-amber-400' : 'text-red-400 stroke-red-400';

  return (
    <div ref={containerRef} className="relative inline-block w-fit self-start z-10" onClick={(e) => e.stopPropagation()}>
      <div 
        onClick={() => setShow(!show)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 hover:bg-white/10 transition-colors cursor-help group relative"
      >
        <svg className="w-10 h-10 -rotate-90 transform absolute inset-1" viewBox="0 0 40 40">
          <circle
            className="stroke-white/10"
            strokeWidth="3.5"
            fill="transparent"
            r={radius}
            cx="20"
            cy="20"
          />
          <circle
            className={cn("transition-all duration-1000 ease-out", colorClass.split(' ')[1])}
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx="20"
            cy="20"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: dashoffset
            }}
          />
        </svg>
        <span className={cn("text-[11px] font-black tracking-tighter relative z-10", colorClass.split(' ')[0])}>
          {Math.round(score)}
        </span>
      </div>

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute bottom-full left-0 mb-4 w-64 glass p-5 rounded-[24px] shadow-[0_30px_60px_rgba(0,0,0,0.8)] z-[100] pointer-events-none md:pointer-events-auto border border-white/10"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                <Info className="w-4 h-4 text-brand-primary" />
              </div>
              <div>
                <p className="text-[10px] text-brand-muted uppercase tracking-widest font-black leading-none mb-1">Retention</p>
                <p className={cn("text-xs font-bold", colorClass.split(' ')[0])}>
                  {status.label}
                </p>
              </div>
            </div>
            <p className="text-xs text-brand-muted leading-relaxed mb-3">
              {status.desc}
            </p>
            <div className="pt-3 border-t border-white/5">
              <p className="text-[9px] text-brand-muted/50 leading-tight">
                Complete study sessions to increase your score and reach <span className="text-white">Mastery</span>.
              </p>
            </div>
            <div className="absolute bottom-[-6px] left-6 w-3 h-3 bg-[#111] border-r border-b border-brand-border rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
