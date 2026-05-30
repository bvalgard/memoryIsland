import { motion, AnimatePresence } from 'motion/react';
import { X, Users, Search, AlertCircle, Check } from 'lucide-react';
import type { User } from 'firebase/auth';
import { cn } from '../../../lib/utils';

interface SocialPanelProps {
  isOpen: boolean;
  onClose: () => void;
  discoveryTab: 'islands' | 'archipelagos' | 'explorers';
  setDiscoveryTab: (t: 'islands' | 'archipelagos' | 'explorers') => void;
  discoverySearch: string;
  setDiscoverySearch: (s: string) => void;
  discoveryExplorers: any[];
  discoveryInboundRequests: any[];
  discoveryFriends: any[];
  isDiscovering: boolean;
  isLoadingRequests: boolean;
  isLoadingFriends: boolean;
  socialError: string | null;
  friends: string[];
  sentRequests: string[];
  friendRequests: string[];
  user: User | null;
  onSendFriendRequest: (uid: string) => void;
  onAcceptFriendRequest: (uid: string) => void;
  onRemoveFriend: (uid: string) => void;
}

export default function SocialPanel({
  isOpen, onClose, discoveryTab, setDiscoveryTab, discoverySearch, setDiscoverySearch,
  discoveryExplorers, discoveryInboundRequests, discoveryFriends,
  isDiscovering, isLoadingRequests, isLoadingFriends, socialError,
  friends, sentRequests, friendRequests, user,
  onSendFriendRequest, onAcceptFriendRequest, onRemoveFriend,
}: SocialPanelProps) {
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
                            onClick={() => onSendFriendRequest(profile.uid)}
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
                          onClick={() => onAcceptFriendRequest(profile.uid)}
                          className="w-10 h-10 rounded-xl bg-brand-primary/20 text-brand-primary hover:bg-brand-primary hover:text-white transition-all flex items-center justify-center"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => onRemoveFriend(profile.uid)}
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
                            onRemoveFriend(profile.uid);
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
  );
}
