import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Users } from 'lucide-react';

interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL?: string;
  showOnGlobalLeaderboard?: boolean;
  lastStudyDate?: string;
  lastStudiedIslandName?: string;
  stats: {
    dailyReviewed: number;
    dailyStreak: number;
    dailyMastered: number;
    totalCardsCreated: number;
  };
}

export default function AdminLeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const q = query(
          collection(db, 'profiles'),
          orderBy('stats.dailyReviewed', 'desc'),
          limit(50)
        );
        const snap = await getDocs(q);
        const rows = snap.docs
          .map(d => ({ uid: d.id, ...d.data() } as LeaderboardEntry))
          .filter(r => r.showOnGlobalLeaderboard !== false);
        setEntries(rows);
      } catch (err: any) {
        setError(err?.message || 'Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Global Leaderboard</h1>
      <p className="text-brand-muted text-sm mb-8">Top 50 users by cards reviewed today (opt-in only).</p>

      {loading && <p className="text-brand-muted">Loading...</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && (
        <div className="space-y-2">
          {entries.length === 0 && <p className="text-brand-muted">No data yet.</p>}
          {entries.map((entry, i) => (
            <div
              key={entry.uid}
              className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5"
            >
              <div className={[
                'w-8 text-base font-bold text-center shrink-0',
                i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-700' : 'text-brand-muted',
              ].join(' ')}>
                #{i + 1}
              </div>
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#222] border border-white/10 flex items-center justify-center shrink-0">
                {entry.photoURL
                  ? <img src={entry.photoURL} alt={entry.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  : <Users className="w-4 h-4 text-brand-muted" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{entry.displayName}</p>
                <p className="text-[10px] text-brand-muted uppercase tracking-widest font-bold">
                  {entry.lastStudiedIslandName ? `${entry.lastStudiedIslandName} · ` : ''}
                  {entry.stats.dailyReviewed} studied · {entry.stats.dailyStreak}d streak
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-black text-white">{entry.stats.dailyReviewed}</p>
                <p className="text-[9px] text-brand-muted uppercase tracking-widest">today</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
