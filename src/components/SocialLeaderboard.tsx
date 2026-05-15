import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Trophy, Users, UserPlus, UserCheck, X, Check, Clock } from 'lucide-react';
import { UserProfile } from '../hooks/useSocial';
import { cn } from '../lib/utils';
import { auth } from '../firebase';

interface SocialLeaderboardProps {
  onClose: () => void;
  profiles: UserProfile[];
  friends: string[];
  friendRequests: string[];
  sentRequests: string[];
  loading: boolean;
  error: string | null;
  loadLeaderboard: () => Promise<void>;
  fetchProfilesByUids: (uids: string[]) => Promise<UserProfile[]>;
  sendFriendRequest: (uid: string) => Promise<void>;
  acceptFriendRequest: (uid: string) => Promise<void>;
  removeFriend: (uid: string) => Promise<void>;
  myReputation?: { totalAnswers: number; totalAccepted: number; totalVotesReceived: number } | null;
}

export default function SocialLeaderboard({
  onClose,
  profiles,
  friends,
  friendRequests,
  sentRequests,
  loading,
  error,
  loadLeaderboard,
  fetchProfilesByUids,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriend,
  myReputation,
}: SocialLeaderboardProps) {
  const [tab, setTab] = useState<'leaderboard' | 'friends'>('leaderboard');
  const [friendsData, setFriendsData] = useState<UserProfile[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [pendingUid, setPendingUid] = useState<string | null>(null);

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (tab === 'leaderboard') {
      loadLeaderboard();
    } else if (tab === 'friends') {
      const load = async () => {
        setLoadingData(true);
        const data = await fetchProfilesByUids(friends);
        setFriendsData(data.sort((a, b) => b.stats.dailyReviewed - a.stats.dailyReviewed));
        setLoadingData(false);
      };
      load();
    }
  }, [tab, friends.join(','), friendRequests.join(',')]);

  const getRelationship = (uid: string) => {
    if (friends.includes(uid)) return 'friend';
    if (sentRequests.includes(uid)) return 'sent';
    if (friendRequests.includes(uid)) return 'received';
    return 'none';
  };

  const handleAdd = async (uid: string) => {
    setPendingUid(uid);
    await sendFriendRequest(uid);
    setPendingUid(null);
  };

  const handleAccept = async (uid: string) => {
    setPendingUid(uid);
    await acceptFriendRequest(uid);
    setPendingUid(null);
  };

  const handleRemove = async (uid: string) => {
    setPendingUid(uid);
    await removeFriend(uid);
    setPendingUid(null);
  };

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
            <h2 className="text-xl font-medium text-white">Achievements</h2>
            <p className="text-sm text-brand-muted">See how you rank and manage friends.</p>
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
            Friends
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-5 text-sm text-red-100">
              <p className="font-medium">Social data couldn't load.</p>
              <p className="mt-1 text-red-100/80">{error}</p>
            </div>
          ) : (loading || loadingData) ? (
            <div className="text-center text-brand-muted py-8">Loading profiles...</div>
          ) : tab === 'leaderboard' ? (
            <>
              {myReputation && (
                <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 mb-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400 mb-3">Your Crew Score</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-xl font-black text-white">{myReputation.totalAnswers}</div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-white/40 mt-0.5">Answers</div>
                    </div>
                    <div>
                      <div className="text-xl font-black text-emerald-400">{myReputation.totalAccepted}</div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-white/40 mt-0.5">Accepted</div>
                    </div>
                    <div>
                      <div className="text-xl font-black text-amber-400">{myReputation.totalVotesReceived}</div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-white/40 mt-0.5">Votes Got</div>
                    </div>
                  </div>
                </div>
              )}
            {profiles.length > 0 ? (
              profiles.map((profile, i) => (
                <ProfileCard
                  key={profile.uid}
                  profile={profile}
                  rank={i + 1}
                  isSelf={profile.uid === currentUser?.uid}
                  relationship={getRelationship(profile.uid)}
                  isPending={pendingUid === profile.uid}
                  onAdd={() => handleAdd(profile.uid)}
                  onRemove={() => handleRemove(profile.uid)}
                  onAccept={() => handleAccept(profile.uid)}
                />
              ))
            ) : <div className="text-center text-brand-muted py-8">No ranks to display yet.</div>}
            </>
          ) : (
            friendsData.length > 0 ? (
              friendsData.map((profile) => (
                <ProfileCard
                  key={profile.uid}
                  profile={profile}
                  isSelf={profile.uid === currentUser?.uid}
                  relationship="friend"
                  isPending={pendingUid === profile.uid}
                  onAdd={() => {}}
                  onRemove={() => handleRemove(profile.uid)}
                  onAccept={() => {}}
                />
              ))
            ) : <div className="text-center text-brand-muted py-8">You haven't added any friends yet.</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ProfileCard({
  profile,
  rank,
  isSelf,
  relationship,
  isPending,
  onAdd,
  onRemove,
  onAccept
}: {
  profile: UserProfile;
  rank?: number;
  isSelf: boolean;
  relationship: 'none' | 'friend' | 'sent' | 'received';
  isPending: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onAccept: () => void;
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
        <div className="flex items-center gap-2">
          {relationship === 'none' && (
            <button
              onClick={onAdd}
              disabled={isPending}
              className="p-2 rounded-xl bg-brand-primary text-white hover:bg-brand-primary/90 transition-all disabled:opacity-50"
              title="Add Friend"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          )}
          {relationship === 'sent' && (
            <button
              onClick={onRemove}
              disabled={isPending}
              className="p-2 rounded-xl bg-white/5 text-brand-muted hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
              title="Cancel Request"
            >
              <Clock className="w-4 h-4" />
            </button>
          )}
          {relationship === 'friend' && (
            <button
              onClick={onRemove}
              disabled={isPending}
              className="p-2 rounded-xl bg-white/5 text-brand-primary hover:bg-red-500/20 hover:text-red-400 transition-all disabled:opacity-50"
              title="Remove Friend"
            >
              <UserCheck className="w-4 h-4" />
            </button>
          )}
          {relationship === 'received' && (
            <>
              <button
                onClick={onAccept}
                disabled={isPending}
                className="p-2 rounded-xl bg-brand-primary text-white hover:bg-brand-primary/90 transition-all disabled:opacity-50"
                title="Accept Request"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={onRemove}
                disabled={isPending}
                className="p-2 rounded-xl bg-white/5 text-brand-muted hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
                title="Reject Request"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
