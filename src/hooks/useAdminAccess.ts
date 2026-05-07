import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface AdminAccessState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  error: string | null;
}

export function useAdminAccess(): AdminAccessState {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setError(null);

      if (!nextUser) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const userSnapshot = await getDoc(doc(db, 'users', nextUser.uid));
        const data = userSnapshot.data() as { isAdmin?: boolean } | undefined;
        setIsAdmin(Boolean(data?.isAdmin));
      } catch (err) {
        console.error('Failed to verify admin access', err);
        setError('Could not verify admin access.');
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, loading, isAdmin, error };
}
