import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, X, Send, Globe, Users, Anchor, RefreshCw, Flag, ChevronUp, ChevronDown, Trash2, Check } from 'lucide-react';
import { useFlares, type Flare } from '../hooks/useFlares';

interface DistressSignalsFeedProps {
  onClose: () => void;
  currentUserId: string;
  ownedIslandIds: string[];
  friends: string[];
  initialTab?: 'all' | 'mine';
}

type FeedTab = 'all' | 'friends' | 'my-islands' | 'mine';

export default function DistressSignalsFeed({ onClose, currentUserId, ownedIslandIds, friends, initialTab = 'all' }: DistressSignalsFeedProps) {
  const {
    distressFlares, myFlares,
    loading, myFlaresLoading,
    throwLifePreserver, fetchDistressFeed, fetchMyFlares,
    resolveFlare,
    updateFlareVisibility, deleteFlare,
  } = useFlares();

  const [activeTab, setActiveTab] = useState<FeedTab>(initialTab);
  const [hintInputs, setHintInputs] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [working, setWorking] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchDistressFeed(currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    if (activeTab === 'mine' && myFlares.length === 0 && !myFlaresLoading) {
      fetchMyFlares(currentUserId);
    }
  }, [activeTab]);

  const filteredFlares = distressFlares.filter(f => {
    if (activeTab === 'friends') return friends.includes(f.askerId);
    if (activeTab === 'my-islands') return ownedIslandIds.includes(f.islandId);
    return true;
  });

  const handleThrow = async (flare: Flare) => {
    const hint = hintInputs[flare.id]?.trim();
    if (!hint) return;
    setSending(prev => ({ ...prev, [flare.id]: true }));
    await throwLifePreserver(flare.id, hint);
    setSent(prev => ({ ...prev, [flare.id]: true }));
    setHintInputs(prev => ({ ...prev, [flare.id]: '' }));
    setSending(prev => ({ ...prev, [flare.id]: false }));
  };

  const handleVisibilitySwitch = async (flare: Flare) => {
    setWorking(prev => ({ ...prev, [flare.id]: true }));
    const next: 'friends' | 'global' = flare.visibility === 'friends' ? 'global' : 'friends';
    await updateFlareVisibility(flare.id, next, friends);
    setWorking(prev => ({ ...prev, [flare.id]: false }));
  };

  const handleDelete = async (flareId: string) => {
    setWorking(prev => ({ ...prev, [flareId]: true }));
    await deleteFlare(flareId);
    // working state cleans itself up since the item is removed from the list
  };

  const handleUpvote = async (flare: Flare, preserverIndex: number) => {
    setWorking(prev => ({ ...prev, [flare.id]: true }));
    await resolveFlare(flare, preserverIndex);
    await fetchMyFlares(currentUserId);
    setWorking(prev => ({ ...prev, [flare.id]: false }));
  };

  const isCurrentLoading = activeTab === 'mine' ? myFlaresLoading : loading;

  const tabs: { id: FeedTab; label: string; icon: typeof Globe }[] = [
    { id: 'all', label: 'All', icon: Globe },
    { id: 'friends', label: 'Crew', icon: Users },
    { id: 'my-islands', label: 'Islands', icon: Anchor },
    { id: 'mine', label: 'My Flares', icon: Flag },
  ];

  const refresh = () => {
    if (activeTab === 'mine') fetchMyFlares(currentUserId);
    else fetchDistressFeed(currentUserId);
  };

  return (
    <div className="flex flex-col h-full max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
            <Radio className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Distress Signals</h2>
            <p className="text-[11px] text-white/40">Crew members who need a memory trick</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={isCurrentLoading}
            className="text-white/30 hover:text-white/70 transition-colors disabled:opacity-30"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isCurrentLoading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 shrink-0 bg-white/5 rounded-xl p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeTab === id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
            }`}
          >
            <Icon className="w-3 h-3 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
        {isCurrentLoading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-2xl bg-white/5 border border-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {/* My Flares tab */}
        {!isCurrentLoading && activeTab === 'mine' && (
          myFlares.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-3xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4">
                <Flag className="w-7 h-7 text-orange-400/50" />
              </div>
              <p className="text-sm font-semibold text-white/40">No flares sent yet</p>
              <p className="text-xs text-white/25 mt-1">Fire a flare from inside a study session when you're stuck</p>
            </div>
          ) : (
            <AnimatePresence>
              {myFlares.map((flare: Flare, idx: number) => (
                <MyFlareCard
                  key={flare.id}
                  flare={flare}
                  idx={idx}
                  working={!!working[flare.id]}
                  onSwitchVisibility={() => handleVisibilitySwitch(flare)}
                  onDelete={() => handleDelete(flare.id)}
                  onUpvote={(preserverIndex) => handleUpvote(flare, preserverIndex)}
                />
              ))}
            </AnimatePresence>
          )
        )}

        {/* Help-others tabs */}
        {!isCurrentLoading && activeTab !== 'mine' && (
          filteredFlares.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-3xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4">
                <Radio className="w-7 h-7 text-orange-400/50" />
              </div>
              <p className="text-sm font-semibold text-white/40">All clear — no distress signals</p>
              <p className="text-xs text-white/25 mt-1">When explorers need help, their flares appear here</p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredFlares.map((flare, idx) => (
                <motion.div
                  key={flare.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.04 }}
                  className="p-4 rounded-2xl bg-white/5 border border-white/8 hover:border-white/12 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400">
                          {flare.askerName}
                        </span>
                        {friends.includes(flare.askerId) && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400/70 bg-blue-400/10 px-1.5 py-0.5 rounded-md">Crew</span>
                        )}
                        {ownedIslandIds.includes(flare.islandId) && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/70 bg-emerald-400/10 px-1.5 py-0.5 rounded-md">Your Island</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{flare.frontText}</p>
                    </div>
                    <Radio className="w-3.5 h-3.5 text-orange-400/50 shrink-0 mt-0.5" />
                  </div>

                  {flare.backText && (
                    <div className="mb-3 px-3 py-2 rounded-xl bg-white/5 border border-white/8">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-white/30 block mb-0.5">
                        {flare.cardType === 'flashcard' ? 'Answer' : 'Correct Answer'}
                      </span>
                      <p className="text-xs text-white/70 leading-snug">{flare.backText}</p>
                    </div>
                  )}

                  {flare.lifePreservers.length > 0 && (
                    <div className="flex flex-col gap-1.5 mb-3">
                      {flare.lifePreservers.map((lp, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-white/50 bg-white/5 rounded-xl px-3 py-2">
                          <span className="font-semibold text-white/70 shrink-0">{lp.helperName}:</span>
                          <span className="flex-1">{lp.hintText}</span>
                          {lp.isHelpful && <span className="text-emerald-400 shrink-0">✓ Saved</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {sent[flare.id] ? (
                    <p className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-widest text-center py-2">
                      🛟 Life preserver thrown!
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Share a mnemonic or memory trick…"
                        value={hintInputs[flare.id] || ''}
                        onChange={e => setHintInputs(prev => ({ ...prev, [flare.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') handleThrow(flare); }}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-orange-500/40"
                      />
                      <button
                        disabled={!hintInputs[flare.id]?.trim() || sending[flare.id]}
                        onClick={() => handleThrow(flare)}
                        className="w-10 h-9 rounded-xl bg-orange-500/15 border border-orange-500/25 text-orange-400 hover:bg-orange-500/25 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )
        )}
      </div>
    </div>
  );
}

function MyFlareCard({ flare, idx, working, onSwitchVisibility, onDelete, onUpvote }: {
  flare: Flare;
  idx: number;
  working: boolean;
  onSwitchVisibility: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  onUpvote: (preserverIndex: number) => void | Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const helpfulHint = flare.lifePreservers.find(lp => lp.isHelpful);
  const isGlobal = flare.visibility === 'global';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: idx * 0.04 }}
      className={`p-4 rounded-2xl border transition-colors ${
        flare.status === 'resolved'
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : 'bg-white/5 border-white/8'
      }`}
    >
      {/* Status + visibility badges */}
      <div className="flex items-center gap-2 mb-2">
        {flare.status === 'resolved' ? (
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md">
            <Check className="w-2.5 h-2.5" /> Resolved
          </span>
        ) : (
          <span className="text-[9px] font-bold uppercase tracking-widest text-orange-400/80 bg-orange-400/10 px-2 py-0.5 rounded-md">
            Active
          </span>
        )}
        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${
          isGlobal ? 'text-blue-400/70 bg-blue-400/10' : 'text-white/40 bg-white/5'
        }`}>
          {isGlobal ? 'Coast Guard' : 'Crew only'}
        </span>
      </div>

      <p className="text-sm font-semibold text-white leading-snug mb-3">{flare.frontText}</p>

      {/* Resolved: helpful hint */}
      {flare.status === 'resolved' && helpfulHint && (
        <div className="flex items-start gap-2 text-xs bg-emerald-500/8 border border-emerald-500/20 rounded-xl px-3 py-2 mb-3">
          <span className="text-emerald-400 shrink-0">🛟</span>
          <div>
            <span className="font-semibold text-emerald-300/80 block text-[10px] uppercase tracking-widest mb-0.5">{helpfulHint.helperName}</span>
            <span className="text-white/60">{helpfulHint.hintText}</span>
          </div>
        </div>
      )}

      {/* Active: pending hints */}
      {flare.status === 'active' && flare.lifePreservers.some(lp => !lp.isHelpful) && (
        <div className="flex flex-col gap-1.5 mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">
            {flare.lifePreservers.filter(lp => !lp.isHelpful).length} hint{flare.lifePreservers.filter(lp => !lp.isHelpful).length > 1 ? 's' : ''} received
          </p>
          {flare.lifePreservers.map((lp, originalIndex) => {
            if (lp.isHelpful) return null;
            return (
              <div key={originalIndex} className="flex items-start gap-2 text-xs bg-white/5 rounded-xl px-3 py-2">
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-white/70 block text-[10px] uppercase tracking-widest mb-0.5">{lp.helperName}</span>
                  <span className="text-white/60">{lp.hintText}</span>
                </div>
                <button
                  onClick={() => onUpvote(originalIndex)}
                  disabled={working}
                  className="shrink-0 mt-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-400/60 hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 px-2 py-1 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  This Saved Me!
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Active: action buttons */}
      {flare.status === 'active' && (
        <div className="flex gap-2 mt-1">
          {/* Visibility toggle */}
          <button
            onClick={onSwitchVisibility}
            disabled={working}
            className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              isGlobal
                ? 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
                : 'border-orange-500/25 bg-orange-500/8 text-orange-400 hover:bg-orange-500/15'
            }`}
          >
            {isGlobal ? (
              <><ChevronDown className="w-3 h-3" /> Switch to Crew</>
            ) : (
              <><ChevronUp className="w-3 h-3" /> Escalate</>
            )}
          </button>

          {/* Delete */}
          {confirmDelete ? (
            <div className="flex gap-1.5">
              <button
                onClick={() => { onDelete(); setConfirmDelete(false); }}
                disabled={working}
                className="h-9 px-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-40"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white/70 text-[10px] font-bold uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={working}
              className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white/30 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 flex items-center justify-center transition-all disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {flare.status === 'active' && flare.lifePreservers.length === 0 && (
        <p className="text-center text-[10px] text-white/20 font-bold uppercase tracking-widest mt-2">
          Waiting for tips…
        </p>
      )}
    </motion.div>
  );
}
