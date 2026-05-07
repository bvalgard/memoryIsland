import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, Search, UserPlus, UserCheck, X } from 'lucide-react';
import { useSocial, UserProfile } from '../hooks/useSocial';
import { cn } from '../lib/utils';
import { auth } from '../firebase';

export default function SocialLeaderboard({ onClose }: { onClose: () => void }) {
  const { profiles, following, loading, error, loadLeaderboard, followUser, unfollowUser, searchUsers } = useSocial();
  const [tab, setTab] = useState<'leaderboard' | 'friends' | 'search'>('leaderboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (tab === 'leaderboard' || tab === 'friends') {
      loadLeaderboard();
    }
  }, [tab]);

  useEffect(() => {
    const doSearch = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
      setSearching(false);
    };
    
    const timeoutId = setTimeout(doSearch, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const displayedProfiles = tab === 'friends' 
    ? profiles.filter(p => following.includes(p.uid) || p.uid === currentUser?.uid).sort((a, b) => b.stats.dailyReviewed - a.stats.dailyReviewed)
    : profiles;

  return (
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
        className="relative w-full max-w-2xl bg-[#111] border border-white/10 rounded-[32px] p-6 shadow-2xl flex flex-col h-[80vh] overflow-hidden"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-brand-muted hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-medium text-white">Competitions</h2>
            <p className="text-sm text-brand-muted">See how you rank against peers.</p>
          </div>
        </div>

        <div className="flex space-x-2 border-b border-white/5 pb-4 mb-4 shrink-0">
          <button
            onClick={() => setTab('leaderboard')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all w-32",
              tab === 'leaderboard' ? "bg-white/10 text-white" : "text-brand-muted hover:text-white hover:bg-white/5"
            )}
          >
            Global Top
          </button>
          <button
            onClick={() => setTab('friends')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all w-32",
              tab === 'friends' ? "bg-white/10 text-white" : "text-brand-muted hover:text-white hover:bg-white/5"
            )}
          >
            Following
          </button>
          <button
            onClick={() => setTab('search')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all w-32",
              tab === 'search' ? "bg-white/10 text-white" : "text-brand-muted hover:text-white hover:bg-white/5"
            )}
          >
            Search
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
          {tab === 'search' && (
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input
                  type="text"
                  placeholder="Ask for their display name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-brand-primary transition-colors"
                />
              </div>
            </div>
          )}

          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-5 text-sm text-red-100">
              <p className="font-medium">Social data couldn&apos;t load.</p>
              <p className="mt-1 text-red-100/80">{error}</p>
            </div>
          ) : tab === 'search' ? (
            <div className="space-y-3">
              {searching ? (
                <div className="text-center text-brand-muted py-8">Searching...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map(profile => (
                  <ProfileCard 
                    key={profile.uid} 
                    profile={profile} 
                    isFollowing={following.includes(profile.uid)}
                    isSelf={profile.uid === currentUser?.uid}
                    onFollow={() => followUser(profile.uid)}
                    onUnfollow={() => unfollowUser(profile.uid)}
                  />
                ))
              ) : searchQuery.length >= 2 ? (
                <div className="text-center text-brand-muted py-8">No users found.</div>
              ) : (
                <div className="text-center text-brand-muted py-8">Search for a username to add friends.</div>
              )}
            </div>
          ) : loading ? (
            <div className="text-center text-brand-muted py-8">Updating scores...</div>
          ) : displayedProfiles.length > 0 ? (
            displayedProfiles.map((profile, i) => (
              <ProfileCard 
                key={profile.uid} 
                profile={profile} 
                rank={i + 1}
                isFollowing={following.includes(profile.uid)}
                isSelf={profile.uid === currentUser?.uid}
                onFollow={() => followUser(profile.uid)}
                onUnfollow={() => unfollowUser(profile.uid)}
              />
            ))
          ) : (
             <div className="text-center text-brand-muted py-8">No ranks to display yet.</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ProfileCard({ profile, rank, isFollowing, isSelf, onFollow, onUnfollow }: { 
  key?: string | number;
  profile: UserProfile; 
  rank?: number; 
  isFollowing: boolean;
  isSelf: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
}) {
  return (
    <div className={cn(
      "p-4 rounded-2xl flex items-center justify-between border transition-all",
      isSelf ? "bg-brand-primary/10 border-brand-primary/20" : "bg-white/5 border-white/5 hover:border-white/10"
    )}>
      <div className="flex items-center space-x-4">
        {rank !== undefined && (
          <div className={cn(
            "w-8 text-lg font-bold text-center",
            rank === 1 ? "text-yellow-500" :
            rank === 2 ? "text-gray-400" :
            rank === 3 ? "text-amber-700" : "text-brand-muted"
          )}>
            #{rank}
          </div>
        )}
        <div className="w-12 h-12 rounded-full overflow-hidden bg-[#222] border border-white/10 flex items-center justify-center shrink-0">
           {profile.photoURL ? (
             <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
           ) : (
             <Users className="w-5 h-5 text-brand-muted" />
           )}
        </div>
        <div>
          <h3 className="text-white font-medium flex items-center space-x-2">
            <span>{profile.displayName}</span>
            {isSelf && <span className="text-xs bg-brand-primary/20 text-brand-primary px-2 py-0.5 rounded-full">You</span>}
          </h3>
          <div className="flex items-center text-sm text-brand-muted mt-1 space-x-3">
            <span className="flex items-center space-x-1" title="Cards Reviewed">
               <div className="w-2 h-2 rounded-full bg-blue-500" />
               <span>{profile.stats.dailyReviewed} studied</span>
            </span>
            <span className="flex items-center space-x-1" title="Current Streak">
               <div className="w-2 h-2 rounded-full bg-orange-500" />
               <span>{profile.stats.dailyStreak} streak</span>
            </span>
          </div>
        </div>
      </div>

      {!isSelf && (
        <button
          onClick={isFollowing ? onUnfollow : onFollow}
          className={cn(
            "p-2 rounded-xl transition-all",
            isFollowing 
              ? "bg-white/5 text-white hover:bg-white/10 hover:text-red-400" 
              : "bg-brand-primary text-white hover:bg-brand-primary/90"
          )}
        >
          {isFollowing ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}
