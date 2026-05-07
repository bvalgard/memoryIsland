import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, ShieldAlert, XCircle } from 'lucide-react';
import { collection, getDocs, query, updateDoc, where, doc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase';

interface ModerationIsland {
  id: string;
  name: string;
  creatorId: string;
  creatorEmail?: string;
  submittedAt?: Timestamp | number | string;
  approvalStatus?: string;
}

function toMillis(value?: Timestamp | number | string) {
  if (!value) return 0;
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatTimestamp(value?: Timestamp | number | string) {
  if (!value) return 'Unknown';
  if (value instanceof Timestamp) return value.toDate().toLocaleString();
  if (typeof value === 'number') return new Date(value).toLocaleString();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 'Unknown' : new Date(parsed).toLocaleString();
}

export default function AdminModerationPage() {
  const [islands, setIslands] = useState<ModerationIsland[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadPendingIslands = async () => {
    setLoading(true);
    setError(null);

    try {
      const moderationQuery = query(
        collection(db, 'islands'),
        where('isPublic', '==', true),
        where('approvalStatus', '==', 'pending')
      );

      const snapshot = await getDocs(moderationQuery);
      const pendingIslands = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        return {
          id: docSnap.id,
          name: data.name || 'Untitled Island',
          creatorId: data.authorId || data.creatorId || 'Unknown',
          creatorEmail: data.authorEmail || data.creatorEmail,
          submittedAt: data.submittedAt || data.publishedAt || data.createdAt,
          approvalStatus: data.approvalStatus,
        } satisfies ModerationIsland;
      }).sort((a, b) => toMillis(b.submittedAt) - toMillis(a.submittedAt));

      setIslands(pendingIslands);
    } catch (err) {
      console.error('Failed to load pending islands', err);
      setError('Could not load pending public islands.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPendingIslands();
  }, []);

  const moderateIsland = async (islandId: string, status: 'approved' | 'rejected') => {
    setProcessingId(islandId);

    try {
      await updateDoc(doc(db, 'islands', islandId), {
        approvalStatus: status,
        isPublic: status === 'approved',
        moderatedAt: Timestamp.now(),
        moderatedBy: auth.currentUser?.uid || null,
      });

      setIslands((prev) => prev.filter((island) => island.id !== islandId));
    } catch (err) {
      console.error(`Failed to mark island as ${status}`, err);
      setError(`Could not ${status === 'approved' ? 'approve' : 'reject'} that island.`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <section>
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-red-300/80">Moderation Queue</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Review public island submissions</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-muted">
            Pending islands are pulled directly from Firestore where `isPublic == true` and `approvalStatus == 'pending'`.
          </p>
        </div>
        <button
          onClick={() => void loadPendingIslands()}
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-brand-muted transition-colors hover:border-white/20 hover:text-white"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-[24px] border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[#0B0B0B]/90 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="flex items-center gap-3 border-b border-white/5 px-6 py-4">
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-2 text-amber-300">
            <Clock3 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Pending approvals</p>
            <p className="text-xs text-brand-muted">Approve or reject community submissions.</p>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-brand-muted">Loading pending islands...</div>
        ) : islands.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <ShieldAlert className="h-10 w-10 text-brand-muted/50" />
            <p className="mt-4 text-sm font-medium text-white">No pending islands right now.</p>
            <p className="mt-1 text-sm text-brand-muted">The moderation queue is clear.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/[0.02] text-[11px] font-black uppercase tracking-[0.18em] text-brand-muted">
                <tr>
                  <th className="px-6 py-4">Island Name</th>
                  <th className="px-6 py-4">Creator ID</th>
                  <th className="px-6 py-4">Date Submitted</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {islands.map((island) => (
                  <tr key={island.id} className="border-t border-white/5">
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{island.name}</p>
                      {island.creatorEmail && (
                        <p className="mt-1 text-xs text-brand-muted">{island.creatorEmail}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-brand-muted">{island.creatorId}</td>
                    <td className="px-6 py-4 text-brand-muted">{formatTimestamp(island.submittedAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => void moderateIsland(island.id, 'approved')}
                          disabled={processingId === island.id}
                          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => void moderateIsland(island.id, 'rejected')}
                          disabled={processingId === island.id}
                          className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-red-200 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
