import { useEffect, useState } from 'react';
import { KeyRound, Search, UsersRound } from 'lucide-react';
import { collection, getDocs, limit, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../../firebase';

interface AdminUserRow {
  id: string;
  email: string;
  createdAt?: Timestamp;
  last_active?: Timestamp;
}

function formatTimestamp(value?: Timestamp) {
  if (!value) return 'Unknown';
  return value.toDate().toLocaleString();
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [resetStatus, setResetStatus] = useState<string | null>(null);

  const loadUsers = async (emailPrefix?: string) => {
    setLoading(true);
    setError(null);

    try {
      const usersRef = collection(db, 'users');
      const usersQuery = emailPrefix
        ? query(
            usersRef,
            where('email', '>=', emailPrefix),
            where('email', '<=', `${emailPrefix}\uf8ff`),
            orderBy('email'),
            limit(25)
          )
        : query(usersRef, orderBy('createdAt', 'desc'), limit(25));

      const snapshot = await getDocs(usersQuery);
      const rows = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        return {
          id: docSnap.id,
          email: data.email || 'Unknown email',
          createdAt: data.createdAt,
          last_active: data.last_active,
        } satisfies AdminUserRow;
      });

      setUsers(rows);
    } catch (err) {
      console.error('Failed to load users', err);
      setError('Could not load users from Firestore.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    const trimmed = searchTerm.trim().toLowerCase();
    const timeoutId = window.setTimeout(() => {
      void loadUsers(trimmed || undefined);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  const handlePasswordReset = async (user: AdminUserRow) => {
    if (!user.email || user.email === 'Unknown email') {
      setError('This user does not have a valid email address on record.');
      return;
    }

    setResettingUserId(user.id);
    setResetStatus(null);
    setError(null);

    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetStatus(`Password reset email sent to ${user.email}.`);
    } catch (err) {
      console.error('Failed to send password reset email', err);
      setError(`Could not send a password reset email to ${user.email}.`);
    } finally {
      setResettingUserId(null);
    }
  };

  return (
    <section>
      <div className="mb-8">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-red-300/80">User Management</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">Review accounts and assist users</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-muted">
          Search by email, inspect recent signups, and trigger real Firebase Auth password reset emails.
        </p>
      </div>

      <div className="mb-5 flex max-w-xl items-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-3">
        <Search className="h-4 w-4 text-brand-muted" />
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search users by email..."
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-brand-muted"
        />
      </div>

      {resetStatus && (
        <div className="mb-4 rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          {resetStatus}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-[24px] border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[#0B0B0B]/90 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="flex items-center gap-3 border-b border-white/5 px-6 py-4">
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-2 text-sky-300">
            <UsersRound className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Recent users</p>
            <p className="text-xs text-brand-muted">Most recent documents from the `users` collection.</p>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-brand-muted">Loading users...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/[0.02] text-[11px] font-black uppercase tracking-[0.18em] text-brand-muted">
                <tr>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Join Date</th>
                  <th className="px-6 py-4">Last Login</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-white/5">
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{user.email}</p>
                      <p className="mt-1 font-mono text-xs text-brand-muted">{user.id}</p>
                    </td>
                    <td className="px-6 py-4 text-brand-muted">{formatTimestamp(user.createdAt)}</td>
                    <td className="px-6 py-4 text-brand-muted">{formatTimestamp(user.last_active)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => void handlePasswordReset(user)}
                        disabled={resettingUserId === user.id}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-50"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        {resettingUserId === user.id ? 'Sending...' : 'Reset Password'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!users.length && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-brand-muted">
                      No users matched this query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
