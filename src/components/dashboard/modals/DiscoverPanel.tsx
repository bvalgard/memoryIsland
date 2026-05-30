import { motion, AnimatePresence } from 'motion/react';
import { X, Compass, Users, Download, Calendar, Check, RefreshCw, Trash2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import { Island } from '../../../hooks/useUserProgress';
import { cn } from '../../../lib/utils';

function formatDate(timestamp: any) {
  if (!timestamp) return 'Recently';
  const date = timestamp.toMillis ? new Date(timestamp.toMillis()) : new Date(timestamp);
  if (isNaN(date.getTime())) return 'Recently';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface DiscoverPanelProps {
  isOpen: boolean;
  onClose: () => void;
  discoveryTab: 'islands' | 'archipelagos' | 'explorers';
  setDiscoveryTab: (t: 'islands' | 'archipelagos' | 'explorers') => void;
  discoverySearch: string;
  setDiscoverySearch: (s: string) => void;
  publicIslands: Island[];
  publicArchipelagos: any[];
  isDiscovering: boolean;
  importingIslandId: string | null;
  importingArchipelagoId: string | null;
  importedIslandNames: Set<string>;
  importedArchipelagoNames: Set<string>;
  user: User | null;
  onImportIsland: (island: Island) => void;
  onImportArchipelago: (arch: any) => void;
  onUpdateIsland: (island: Island) => void;
  onDeleteIsland: (island: Island) => void;
  onUpdateArchipelago: (arch: any) => void;
  onDeleteArchipelago: (arch: any) => void;
  onDismissIsland: (island: Island) => void;
  onDismissArchipelago: (arch: any) => void;
}

export default function DiscoverPanel({
  isOpen, onClose, discoveryTab, setDiscoveryTab, discoverySearch, setDiscoverySearch,
  publicIslands, publicArchipelagos, isDiscovering,
  importingIslandId, importingArchipelagoId, importedIslandNames, importedArchipelagoNames,
  user, onImportIsland, onImportArchipelago, onUpdateIsland, onDeleteIsland,
  onUpdateArchipelago, onDeleteArchipelago, onDismissIsland, onDismissArchipelago,
}: DiscoverPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-[#111] border border-white/10 rounded-[32px] p-8 shadow-2xl flex flex-col max-h-[85vh]"
          >
            <button
              onClick={onClose}
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
                    const isAlreadyImported = importedIslandNames.has(island.name);
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
                              <span>{(island as any).authorName || 'Explorer'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-brand-muted">
                              <Download className="w-3.5 h-3.5" />
                              <span>{(island as any).downloads || 0} Imports</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-brand-muted">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>{formatDate((island as any).createdAt)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {(island as any).authorId === user?.uid && (
                            <>
                              <button
                                onClick={() => onUpdateIsland(island)}
                                className="flex items-center justify-center px-4 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 font-bold transition-all shadow-lg active:scale-95 gap-2"
                                title="Update Community Version"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span className="text-xs uppercase tracking-widest hidden sm:inline">Update</span>
                              </button>
                              <button
                                onClick={() => onDeleteIsland(island)}
                                className="flex items-center justify-center px-4 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 font-bold transition-all shadow-lg active:scale-95"
                                title="Delete from Community"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {(island as any).sharedWith?.includes(user?.uid) && !isAlreadyImported && (
                            <button
                              onClick={() => onDismissIsland(island)}
                              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 text-brand-muted hover:bg-red-500/10 hover:text-red-400 font-bold transition-all active:scale-95"
                              title="Dismiss"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onImportIsland(island)}
                            disabled={(isAlreadyImported && (island as any).authorId !== user?.uid) || importingIslandId === island.id}
                            className={cn(
                              "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all",
                              isAlreadyImported
                                ? "bg-white/5 text-brand-muted cursor-default"
                                : "bg-white text-black hover:bg-white/90 shadow-lg active:scale-95"
                            )}
                          >
                            {isAlreadyImported ? (
                              <><Check className="w-3.5 h-3.5" />Anchored</>
                            ) : importingIslandId === island.id ? (
                              <><div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />Importing...</>
                            ) : (
                              <><Download className="w-3.5 h-3.5" />Import</>
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
                    const isAlreadyImported = importedArchipelagoNames.has(arch.name);
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
                                onClick={() => onUpdateArchipelago(arch)}
                                className="flex items-center justify-center px-4 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 font-bold transition-all shadow-lg active:scale-95 gap-2"
                                title="Update Community Version"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span className="text-xs uppercase tracking-widest hidden sm:inline">Update</span>
                              </button>
                              <button
                                onClick={() => onDeleteArchipelago(arch)}
                                className="flex items-center justify-center px-4 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 font-bold transition-all shadow-lg active:scale-95"
                                title="Delete from Community"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {arch.sharedWith?.includes(user?.uid) && !isAlreadyImported && (
                            <button
                              onClick={() => onDismissArchipelago(arch)}
                              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 text-brand-muted hover:bg-red-500/10 hover:text-red-400 font-bold transition-all active:scale-95"
                              title="Dismiss"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => onImportArchipelago(arch)}
                            disabled={(isAlreadyImported && arch.authorId !== user?.uid) || importingArchipelagoId === arch.id}
                            className={cn(
                              "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all",
                              isAlreadyImported
                                ? "bg-white/5 text-brand-muted cursor-default"
                                : "bg-white text-black hover:bg-white/90 shadow-lg active:scale-95"
                            )}
                          >
                            {isAlreadyImported ? (
                              <><Check className="w-3.5 h-3.5" />Imported</>
                            ) : importingArchipelagoId === arch.id ? (
                              <><div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />Importing...</>
                            ) : (
                              <><Download className="w-3.5 h-3.5" />Import All</>
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
  );
}
