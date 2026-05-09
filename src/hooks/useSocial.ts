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
  deleteDoc,
  onSnapshot,
  serverTimestamp
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

export interface Friendship {
  id: string;
  users: string[];
  status: 'pending' | 'accepted';
  requesterId: string;
  createdAt: number;
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

function getFriendshipId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

export function useSocial() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [friendRequests, setFriendRequests] = useState<string[]>([]); // Inbound
  const [sentRequests, setSentRequests] = useState<string[]>([]); // Outbound
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) {
      setFriends([]);
      setFriendRequests([]);
      setSentRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const friendshipsRef = collection(db, 'friendships');
    const q = query(friendshipsRef, where('users', 'array-contains', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newFriends: string[] = [];
      const newInbound: string[] = [];
      const newOutbound: string[] = [];

      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data() as Omit<Friendship, 'id'>;
        const otherUserId = data.users.find(id => id !== user.uid);
        if (!otherUserId) return;

        if (data.status === 'accepted') {
          newFriends.push(otherUserId);
        } else if (data.status === 'pending') {
          if (data.requesterId === user.uid) {
            newOutbound.push(otherUserId);
          } else {
            newInbound.push(otherUserId);
          }
        }
      });

      setFriends(newFriends);
      setFriendRequests(newInbound);
      setSentRequests(newOutbound);
      setLoading(false);
    }, (err: any) => {
      console.error("Friendships listener error:", err);
      setError(err?.code === 'permission-denied'
        ? 'Social features are blocked by Firestore rules.'
        : 'Could not sync friends list.');
      setLoading(false);
    });

    return () => unsubscribe();
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
      const fetchedProfiles = snapshot.docs.map(docSnap => normalizeProfile(docSnap.data() as Partial<UserProfile>, docSnap.id));
      setProfiles(fetchedProfiles);
    } catch (err: any) {
      console.error("Failed to load leaderboard", err);
      setProfiles([]);
      setError(err?.code === 'permission-denied'
        ? 'Leaderboard access is blocked by Firestore rules.'
        : 'Could not load leaderboard data.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProfilesByUids = async (uids: string[]) => {
    if (!uids.length) return [];
    try {
      const chunks = [];
      for (let i = 0; i < uids.length; i += 30) {
        chunks.push(uids.slice(i, i + 30));
      }
      
      const allProfiles: UserProfile[] = [];
      for (const chunk of chunks) {
        const q = query(collection(db, 'profiles'), where('__name__', 'in', chunk));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(docSnap => {
          allProfiles.push(normalizeProfile(docSnap.data() as Partial<UserProfile>, docSnap.id));
        });
      }
      return allProfiles;
    } catch (err) {
      console.error("Failed to fetch specific profiles", err);
      return [];
    }
  };

  const sendFriendRequest = async (targetUserId: string) => {
    if (!user) return;
    const friendshipId = getFriendshipId(user.uid, targetUserId);
    try {
      await setDoc(doc(db, 'friendships', friendshipId), {
        users: [user.uid, targetUserId],
        status: 'pending',
        requesterId: user.uid,
        createdAt: Date.now()
      });
      // onSnapshot handles state update
    } catch (err: any) {
      console.error("Failed to send friend request", err);
      setError(err?.code === 'permission-denied'
        ? 'Friend requests are blocked by Firestore rules.'
        : 'Could not send friend request.');
    }
  };

  const acceptFriendRequest = async (targetUserId: string) => {
    if (!user) return;
    const friendshipId = getFriendshipId(user.uid, targetUserId);
    try {
      await setDoc(doc(db, 'friendships', friendshipId), {
        status: 'accepted',
        updatedAt: Date.now()
      }, { merge: true });
      // onSnapshot handles state update
    } catch (err: any) {
      console.error("Failed to accept friend request", err);
      setError(err?.code === 'permission-denied'
        ? 'Accepting requests is blocked by Firestore rules.'
        : 'Could not accept friend request.');
    }
  };

  const removeFriend = async (targetUserId: string) => {
    if (!user) return;
    const friendshipId = getFriendshipId(user.uid, targetUserId);
    try {
      await deleteDoc(doc(db, 'friendships', friendshipId));
      // onSnapshot handles state update
    } catch (err: any) {
      console.error("Failed to remove friend", err);
      setError(err?.code === 'permission-denied'
        ? 'Removing friends is blocked by Firestore rules.'
        : 'Could not remove friend.');
    }
  };

  const searchUsers = async (searchTerm: string) => {
    if (!searchTerm.trim()) return [];
    try {
      const lowerSearch = searchTerm.toLowerCase();
      const q = query(
        collection(db, 'profiles'),
        where('displayNameLowercase', '>=', lowerSearch),
        where('displayNameLowercase', '<=', lowerSearch + '\uf8ff'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      
      // If we found results, return them
      if (!snapshot.empty) {
        setError(null);
        return snapshot.docs.map(docSnap => normalizeProfile(docSnap.data() as Partial<UserProfile>, docSnap.id));
      }

      // FALLBACK: If no results, try a case-sensitive search for older profiles 
      // that don't have the displayNameLowercase field yet.
      const qFallback = query(
        collection(db, 'profiles'),
        where('displayName', '>=', searchTerm),
        where('displayName', '<=', searchTerm + '\uf8ff'),
        limit(10)
      );
      const snapshotFallback = await getDocs(qFallback);
      setError(null);
      return snapshotFallback.docs.map(docSnap => normalizeProfile(docSnap.data() as Partial<UserProfile>, docSnap.id));
    } catch (err: any) {
      console.error("Failed to search users", err);
      setError(err?.code === 'permission-denied'
        ? 'User search is blocked by Firestore rules.'
        : 'Could not search users.');
      return [];
    }
  };

  return {
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
    searchUsers
  };
}
