import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  getDocs, 
  where,
  orderBy,
  limit,
  doc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  stats: {
    dailyReviewed: number;
    dailyMastered: number;
    totalCardsCreated: number;
    dailyStreak: number;
    recordReviewed: number;
  };
}

const defaultStats: UserProfile['stats'] = {
  dailyReviewed: 0,
  dailyMastered: 0,
  totalCardsCreated: 0,
  dailyStreak: 0,
  recordReviewed: 0,
};

function normalizeProfile(data: Partial<UserProfile>, fallbackUid: string): UserProfile {
  return {
    uid: data.uid || fallbackUid,
    displayName: data.displayName || 'Explorer',
    photoURL: data.photoURL || undefined,
    stats: {
      ...defaultStats,
      ...(data.stats || {}),
    },
  };
}

export function useSocial() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = auth.currentUser;

  const loadFollowing = async () => {
    if (!user) {
      setFollowing([]);
      return;
    }

    const followsRef = collection(db, 'follows', user.uid, 'following');
    try {
      const snapshot = await getDocs(followsRef);
      setFollowing(snapshot.docs.map(doc => doc.id));
    } catch (err: any) {
      console.error("Failed to load following list", err);
      setFollowing([]);
      setError(err?.code === 'permission-denied'
        ? 'Social features are blocked by Firestore rules for this signed-in user.'
        : 'Could not load your following list right now.');
    }
  };

  useEffect(() => {
    setError(null);
    void loadFollowing();
  }, [user]);

  const loadLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, 'profiles'),
        orderBy('stats.dailyReviewed', 'desc'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const fetchedProfiles = snapshot.docs.map(doc => normalizeProfile(doc.data() as Partial<UserProfile>, doc.id));
      setProfiles(fetchedProfiles);
    } catch (err: any) {
      console.error("Failed to load leaderboard", err);
      setProfiles([]);
      setError(err?.code === 'permission-denied'
        ? 'Leaderboard access is blocked by Firestore rules or the deployed database configuration.'
        : 'Could not load leaderboard data right now.');
    } finally {
      setLoading(false);
    }
  };

  const followUser = async (targetUserId: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'follows', user.uid, 'following', targetUserId), {
        followedAt: Date.now()
      });
      setFollowing(prev => prev.includes(targetUserId) ? prev : [...prev, targetUserId]);
    } catch (err: any) {
      console.error("Failed to follow user", err);
      setError(err?.code === 'permission-denied'
        ? 'Following users is blocked by Firestore rules for this account.'
        : 'Could not follow that user right now.');
    }
  };

  const unfollowUser = async (targetUserId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'follows', user.uid, 'following', targetUserId));
      setFollowing(prev => prev.filter(id => id !== targetUserId));
    } catch (err: any) {
      console.error("Failed to unfollow user", err);
      setError(err?.code === 'permission-denied'
        ? 'Unfollowing users is blocked by Firestore rules for this account.'
        : 'Could not unfollow that user right now.');
    }
  };

  const searchUsers = async (searchTerm: string) => {
    if (!searchTerm.trim()) return [];
    try {
      // Basic prefix search using displayName
      const q = query(
        collection(db, 'profiles'),
        where('displayName', '>=', searchTerm),
        where('displayName', '<=', searchTerm + '\uf8ff'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      setError(null);
      return snapshot.docs.map(doc => normalizeProfile(doc.data() as Partial<UserProfile>, doc.id));
    } catch (err: any) {
      console.error("Failed to search users", err);
      setError(err?.code === 'permission-denied'
        ? 'User search is blocked by Firestore rules or missing indexes in the deployed database.'
        : 'Could not search users right now.');
      return [];
    }
  };

  return {
    profiles,
    following,
    loading,
    error,
    loadLeaderboard,
    loadFollowing,
    followUser,
    unfollowUser,
    searchUsers
  };
}
