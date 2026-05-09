import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Users, X, Check } from 'lucide-react';
import { useSocial, UserProfile } from '../hooks/useSocial';
import { cn } from '../lib/utils';
import { auth } from '../firebase';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  onSharePublic: () => Promise<void> | void;
  onShareTargeted: (uids: string[]) => Promise<void> | void;
}

export default function ShareModal({
  isOpen,
  onClose,
  title,
  description,
  onSharePublic,
  onShareTargeted
}: ShareModalProps) {
  const { profiles, following, loadLeaderboard } = useSocial();
  const [tab, setTab] = useState<'public' | 'targeted'>('public');
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (isOpen) {
      loadLeaderboard();
      setSelectedUids(new Set());
      setTab('public');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // We rely on profiles loaded from leaderboard, matching existing app behavior
  const followingProfiles = profiles.filter(p => following.includes(p.uid));

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
    try {
      if (tab === 'public') {
        await onSharePublic();
      } else {
        await onShareTargeted(Array.from(selectedUids));
      }
      onClose();
    } catch (e) {
      console.error(e);
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
              <p className="text-xs font-bold uppercase tracking-widest text-brand-muted mb-3 px-2">Select Followers</p>
              {followingProfiles.length === 0 ? (
                <div className="text-center py-6 text-brand-muted text-sm">
                  You aren't following anyone yet, or they don't have enough score to appear. Add friends via the Social tab.
                </div>
              ) : (
                followingProfiles.map(profile => {
                  const isSelected = selectedUids.has(profile.uid);
                  return (
                    <div 
                      key={profile.uid}
                      onClick={() => toggleUser(profile.uid)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all",
                        isSelected ? "bg-brand-primary/10 border-brand-primary/30" : "bg-white/5 border-white/5 hover:border-white/10"
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
                        <span className="text-sm font-bold text-white">{profile.displayName}</span>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center border",
                        isSelected ? "bg-brand-primary border-brand-primary" : "border-white/20"
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-black" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 flex flex-col gap-3">
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
