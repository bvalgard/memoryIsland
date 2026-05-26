import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Users, X, Check } from 'lucide-react';
import { UserProfile } from '../hooks/useSocial';
import { cn } from '../lib/utils';

const RESHARE_COOLDOWN_MS = 1 * 60 * 60 * 1000;

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  onSharePublic: () => Promise<void> | void;
  onShareTargeted: (uids: string[]) => Promise<void> | void;
  initialSelectedUids?: string[];
  initialTab?: 'public' | 'targeted';
  friends: string[];
  fetchProfilesByUids: (uids: string[]) => Promise<UserProfile[]>;
  sharedAtTimestamps?: Record<string, number>;
}

export default function ShareModal({
  isOpen,
  onClose,
  title,
  description,
  onSharePublic,
  onShareTargeted,
  initialSelectedUids = [],
  initialTab = 'public',
  friends,
  fetchProfilesByUids,
  sharedAtTimestamps = {},
}: ShareModalProps) {
  const [tab, setTab] = useState<'public' | 'targeted'>('public');
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [friendProfiles, setFriendProfiles] = useState<UserProfile[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  // Reset modal state only when it first opens — not on every re-render.
  // Putting friends/initialSelectedUids in the dep array caused tab to reset
  // when the parent re-rendered with a new array reference mid-interaction.
  useEffect(() => {
    if (!isOpen) return;
    const eligibleUids = (initialSelectedUids || []).filter(uid => {
      const lastShared = sharedAtTimestamps[uid];
      return !lastShared || lastShared + RESHARE_COOLDOWN_MS - Date.now() <= 0;
    });
    setSelectedUids(new Set(eligibleUids));
    setTab(initialTab);
    setIsSubmitting(false);
    setError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Load friend profiles separately; use join(',') so a new array ref with the
  // same UIDs doesn't retrigger (matches the pattern used in Dashboard.tsx).
  useEffect(() => {
    if (!isOpen) return;
    if (friends.length > 0) {
      const load = async () => {
        setIsLoadingFriends(true);
        const profiles = await fetchProfilesByUids(friends);
        setFriendProfiles(profiles);
        setIsLoadingFriends(false);
      };
      load();
    } else {
      setFriendProfiles([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, friends.join(',')]);

  if (!isOpen) return null;

  const getCooldownLabel = (uid: string): string | null => {
    const lastShared = sharedAtTimestamps[uid];
    if (!lastShared) return null;
    const remaining = lastShared + RESHARE_COOLDOWN_MS - Date.now();
    if (remaining <= 0) return null;
    const minutes = Math.ceil(remaining / (60 * 1000));
    if (minutes < 60) return `Reshare in ${minutes}m`;
    return `Reshare in ${Math.ceil(minutes / 60)}h`;
  };

  const toggleUser = (uid: string) => {
    const next = new Set(selectedUids);
    if (next.has(uid)) {
      next.delete(uid);
    } else {
      next.add(uid);
    }
    setSelectedUids(next);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      if (tab === 'public') {
        await onSharePublic();
      } else {
        // Merge back cooldown-blocked UIDs from the original list so they aren't silently dropped
        const cooldownBlockedUids = (initialSelectedUids || []).filter(uid => {
          const lastShared = sharedAtTimestamps[uid];
          return lastShared && lastShared + RESHARE_COOLDOWN_MS - Date.now() > 0;
        });
        const mergedUids = [...new Set([...selectedUids, ...cooldownBlockedUids])] as string[];
        await onShareTargeted(mergedUids);
      }
      onClose();
    } catch (e) {
      console.error(e);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md bg-[#111] border border-brand-primary/30 p-6 md:p-8 rounded-[40px] shadow-[0_40px_100px_rgba(0,0,0,0.8)] text-center flex flex-col max-h-[85vh]"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-brand-muted hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 bg-brand-primary/20 rounded-[24px] flex items-center justify-center mx-auto mb-4 shadow-xl border border-brand-primary/30 shrink-0">
          <Globe className="w-8 h-8 text-brand-primary" />
        </div>
        
        <h2 className="text-2xl font-bold mb-2 tracking-tight shrink-0">{title}</h2>
        <p className="text-brand-muted text-sm leading-relaxed mb-6 px-2 shrink-0">
          {description}
        </p>

        <div className="flex space-x-2 border-b border-white/5 pb-4 mb-4 shrink-0">
          <button
            onClick={() => setTab('public')}
            className={cn(
              "flex-1 py-2 rounded-xl text-sm font-medium transition-all",
              tab === 'public' ? "bg-white/10 text-white" : "text-brand-muted hover:text-white hover:bg-white/5"
            )}
          >
            Community
          </button>
          <button
            onClick={() => setTab('targeted')}
            className={cn(
              "flex-1 py-2 rounded-xl text-sm font-medium transition-all",
              tab === 'targeted' ? "bg-white/10 text-white" : "text-brand-muted hover:text-white hover:bg-white/5"
            )}
          >
            Targeted
          </button>
        </div>

        <div className="flex-1 overflow-y-auto mb-6 text-left custom-scrollbar">
          {tab === 'public' ? (
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
              <p className="text-sm text-brand-muted">
                Sharing to the community makes this content discoverable by anyone. It will appear in the global Discovery feed.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-muted mb-3 px-2">Select Friends</p>
              {isLoadingFriends ? (
                <div className="text-center py-6 text-brand-muted text-sm">
                  Loading friends...
                </div>
              ) : friendProfiles.length === 0 ? (
                <div className="text-center py-6 text-brand-muted text-sm">
                  You haven't added any friends yet. Add friends via the Community tab.
                </div>
              ) : (
                friendProfiles.map(profile => {
                  const isSelected = selectedUids.has(profile.uid);
                  const cooldownLabel = getCooldownLabel(profile.uid);
                  const isOnCooldown = cooldownLabel !== null;
                  return (
                    <div
                      key={profile.uid}
                      onClick={() => !isOnCooldown && toggleUser(profile.uid)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-2xl border transition-all",
                        isOnCooldown
                          ? "bg-white/[0.02] border-white/5 opacity-50 cursor-not-allowed"
                          : isSelected
                            ? "bg-brand-primary/10 border-brand-primary/30 cursor-pointer"
                            : "bg-white/5 border-white/5 hover:border-white/10 cursor-pointer"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#222] overflow-hidden flex items-center justify-center shrink-0">
                          {profile.photoURL ? (
                            <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <Users className="w-4 h-4 text-brand-muted" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">{profile.displayName}</span>
                          {isOnCooldown && (
                            <span className="text-xs text-brand-muted">{cooldownLabel}</span>
                          )}
                        </div>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center border",
                        isOnCooldown ? "border-white/10" : isSelected ? "bg-brand-primary border-brand-primary" : "border-white/20"
                      )}>
                        {isSelected && !isOnCooldown && <Check className="w-3 h-3 text-black" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-col gap-3">
          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (tab === 'targeted' && selectedUids.size === 0)}
            className="w-full py-4 bg-brand-primary text-white rounded-[24px] font-black text-sm uppercase tracking-widest shadow-lg shadow-brand-primary/20 active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
          >
            {isSubmitting ? "Processing..." : tab === 'public' ? "Share with Community" : "Share with Selected"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
