import { useState } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  limit,
  writeBatch,
  arrayUnion,
  increment,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Card } from './useUserProgress';

export interface LifePreserver {
  helperId: string;
  helperName: string;
  hintText: string;
  isHelpful: boolean;
}

export interface Flare {
  id: string;
  cardId: string;
  islandId: string;
  frontText: string;
  backText: string;
  askerId: string;
  askerName: string;
  status: 'active' | 'resolved';
  visibility: 'friends' | 'global';
  createdAt: Timestamp;
  lifePreservers: LifePreserver[];
  visibleTo: string[];
}

export function useFlares() {
  const [distressFlares, setDistressFlares] = useState<Flare[]>([]);
  const [loading, setLoading] = useState(false);

  const sendFlare = async (
    card: Card,
    islandId: string,
    visibility: 'friends' | 'global',
    friendUids: string[],
    askerName: string
  ): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user || !card.id) return null;

    const existing = await getDocs(
      query(
        collection(db, 'flares'),
        where('cardId', '==', card.id),
        where('askerId', '==', user.uid),
        where('status', '==', 'active'),
        limit(1)
      )
    );
    if (!existing.empty) return existing.docs[0].id;

    const ref = await addDoc(collection(db, 'flares'), {
      cardId: card.id,
      islandId,
      frontText: card.front,
      backText: card.back ?? '',
      askerId: user.uid,
      askerName: askerName || user.displayName || 'Explorer',
      status: 'active',
      visibility,
      createdAt: serverTimestamp(),
      lifePreservers: [],
      visibleTo: visibility === 'friends' ? friendUids : [],
    });
    return ref.id;
  };

  const throwLifePreserver = async (flareId: string, hintText: string): Promise<void> => {
    const user = auth.currentUser;
    if (!user) return;
    const preserver: LifePreserver = {
      helperId: user.uid,
      helperName: user.displayName || 'Explorer',
      hintText,
      isHelpful: false,
    };
    await updateDoc(doc(db, 'flares', flareId), {
      lifePreservers: arrayUnion(preserver),
    });
  };

  const fetchCardFlares = async (cardId: string): Promise<Flare[]> => {
    const snap = await getDocs(
      query(
        collection(db, 'flares'),
        where('cardId', '==', cardId),
        where('status', '==', 'active'),
        limit(5)
      )
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Flare));
  };

  const resolveFlare = async (flare: Flare, preserverIndex: number): Promise<number> => {
    const updatedPreservers = flare.lifePreservers.map((lp, idx) =>
      idx === preserverIndex ? { ...lp, isHelpful: true } : lp
    );
    const helperId = flare.lifePreservers[preserverIndex]?.helperId;
    if (!helperId) return 0;

    const batch = writeBatch(db);
    batch.update(doc(db, 'flares', flare.id), {
      status: 'resolved',
      lifePreservers: updatedPreservers,
    });
    const rescueRef = doc(db, 'rescue_stats', helperId);
    batch.set(rescueRef, { totalRescues: increment(1) }, { merge: true });
    await batch.commit();

    const snap = await getDoc(rescueRef);
    return (snap.data()?.totalRescues as number) ?? 1;
  };

  // One-time fetch — avoids the Firestore WatchStream bug caused by
  // two simultaneous onSnapshot listeners being subscribed/unsubscribed together.
  const fetchDistressFeed = async (currentUserId: string): Promise<void> => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const merged = new Map<string, Flare>();

      const [globalSnap, friendsSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'flares'),
            where('status', '==', 'active'),
            where('visibility', '==', 'global'),
            limit(50)
          )
        ),
        getDocs(
          query(
            collection(db, 'flares'),
            where('status', '==', 'active'),
            where('visibility', '==', 'friends'),
            where('visibleTo', 'array-contains', currentUserId),
            limit(50)
          )
        ),
      ]);

      globalSnap.docs.forEach(d => merged.set(d.id, { id: d.id, ...d.data() } as Flare));
      friendsSnap.docs.forEach(d => merged.set(d.id, { id: d.id, ...d.data() } as Flare));

      const sorted = [...merged.values()]
        .filter(f => f.askerId !== currentUserId)
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));

      setDistressFlares(sorted);
    } catch (err) {
      console.warn('[useFlares] fetchDistressFeed error:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    distressFlares,
    loading,
    sendFlare,
    throwLifePreserver,
    fetchCardFlares,
    resolveFlare,
    fetchDistressFeed,
  };
}
