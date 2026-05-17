import { useState } from 'react';
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, Check } from 'lucide-react';
import { UserProfile } from '../hooks/useSocial';

interface NewIslandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, archipelagoId: string | null) => void;
  onSubmitCollaborative?: (name: string, collaboratorUids: string[], archipelagoId: string | null) => void;
  archipelagos: { id: string; name: string }[];
  defaultArchipelagoId: string | null;
  friends?: string[];
  fetchProfilesByUids?: (uids: string[]) => Promise<UserProfile[]>;
}

export default function NewIslandModal({ isOpen, onClose, onSubmit, onSubmitCollaborative, archipelagos, defaultArchipelagoId, friends = [], fetchProfilesByUids = async () => [] }: NewIslandModalProps) {
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState(false);
  const [selectedArchipelagoId, setSelectedArchipelagoId] = useState<string | null>(defaultArchipelagoId);
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<UserProfile[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedArchipelagoId(defaultArchipelagoId);
      setName('');
      setNameError(false);
      setIsCollaborative(false);
      setSelectedFriends([]);
    }
  }, [isOpen, defaultArchipelagoId]);

  const handleCollaborativeToggle = async (enabled: boolean) => {
    setIsCollaborative(enabled);
    if (enabled && friends.length > 0 && friendProfiles.length === 0) {
      setLoadingFriends(true);
      const profiles = await fetchProfilesByUids(friends);
      setFriendProfiles(profiles);
      setLoadingFriends(false);
    }
  };

  const toggleFriend = (uid: string) => {
    setSelectedFriends(prev =>
      prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    if (isCollaborative && onSubmitCollaborative) {
      onSubmitCollaborative(name.trim(), selectedFriends, selectedArchipelagoId);
    } else {
      onSubmit(name.trim(), selectedArchipelagoId);
    }
    setName('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-brand-card border border-brand-border rounded-[32px] overflow-hidden"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold tracking-tight">Create New Island</h3>
                <button type="button" onClick={onClose} className="text-brand-muted hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-3">
                    Subject Name
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameError(false); }}
                    placeholder="e.g. Quantum Physics"
                    className={`w-full bg-white/5 border rounded-2xl px-5 py-4 text-white outline-none transition-colors ${nameError ? 'border-red-500/70 focus:border-red-500' : 'border-brand-border focus:border-brand-primary/50'}`}
                  />
                  {nameError && (
                    <p className="text-red-400 text-[11px] font-medium mt-2 ml-1">Please give your island a name first.</p>
                  )}

                  <label className="block text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-3 mt-4">
                    Archipelago (Collection)
                  </label>
                  <select
                    value={selectedArchipelagoId || ''}
                    onChange={(e) => setSelectedArchipelagoId(e.target.value || null)}
                    className="w-full bg-white/5 border border-brand-border rounded-2xl px-5 py-4 text-white outline-none focus:border-brand-primary/50 transition-colors appearance-none"
                  >
                    <option value="">None (All Islands)</option>
                    {archipelagos.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                {onSubmitCollaborative && friends.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => handleCollaborativeToggle(!isCollaborative)}
                      className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition-all ${
                        isCollaborative
                          ? 'bg-violet-500/10 border-violet-500/40 text-violet-300'
                          : 'bg-white/5 border-brand-border text-brand-muted hover:text-white hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Users className="w-4 h-4" />
                        <div className="text-left">
                          <p className="text-xs font-bold uppercase tracking-widest">Collaborative Island</p>
                          <p className="text-[10px] opacity-70 mt-0.5">Invite friends to co-create cards</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                        isCollaborative ? 'bg-violet-500 border-violet-400' : 'border-white/20'
                      }`}>
                        {isCollaborative && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>

                    {isCollaborative && (
                      <div className="mt-3">
                        <p className="text-[10px] text-brand-muted uppercase tracking-widest font-medium mb-2">
                          Invite to crew ({selectedFriends.length} selected)
                        </p>
                        {loadingFriends ? (
                          <p className="text-[10px] text-brand-muted">Loading friends...</p>
                        ) : (
                          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                            {friendProfiles.map((profile) => (
                              <button
                                key={profile.uid}
                                type="button"
                                onClick={() => toggleFriend(profile.uid)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-left ${
                                  selectedFriends.includes(profile.uid)
                                    ? 'bg-violet-500/15 border border-violet-500/30'
                                    : 'hover:bg-white/5 border border-transparent'
                                }`}
                              >
                                {profile.photoURL ? (
                                  <img src={profile.photoURL} className="w-7 h-7 rounded-full object-cover shrink-0" />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                    {profile.displayName?.[0]?.toUpperCase() || '?'}
                                  </div>
                                )}
                                <span className="text-sm text-white flex-1">{profile.displayName}</span>
                                {selectedFriends.includes(profile.uid) && (
                                  <Check className="w-4 h-4 text-violet-300 shrink-0" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full btn-primary h-14"
                >
                  {isCollaborative ? 'Create Crew Island' : 'Anchor Island'}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
