import { useEffect, useState } from 'react';
import { BookOpen, Layers3, Users as UsersIcon } from 'lucide-react';
import { collection, doc, getCountFromServer, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface OverviewMetrics {
  totalUsers: number;
  totalIslands: number;
  totalCards: number;
}

const metricCards = [
  { key: 'totalUsers', label: 'Total Users', icon: UsersIcon, accent: 'text-sky-300', bg: 'bg-sky-500/10 border-sky-500/20' },
  { key: 'totalIslands', label: 'Total Islands', icon: Layers3, accent: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { key: 'totalCards', label: 'Total Cards', icon: BookOpen, accent: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/20' },
] as const;

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<OverviewMetrics>({
    totalUsers: 0,
    totalIslands: 0,
    totalCards: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadMetrics = async () => {
      setLoading(true);
      setError(null);

      try {
        const statsSnapshot = await getDoc(doc(db, 'adminStats', 'global'));
        const statsData = statsSnapshot.data() as Partial<OverviewMetrics> | undefined;

        if (statsData?.totalUsers !== undefined && statsData?.totalIslands !== undefined && statsData?.totalCards !== undefined) {
          if (!active) return;

          setMetrics({
            totalUsers: statsData.totalUsers,
            totalIslands: statsData.totalIslands,
            totalCards: statsData.totalCards,
          });
        } else {
          const [usersCount, islandsCount, cardsCount] = await Promise.all([
            getCountFromServer(collection(db, 'users')),
            getCountFromServer(collection(db, 'islands')),
            getCountFromServer(collection(db, 'cards')),
          ]);

          if (!active) return;

          setMetrics({
            totalUsers: usersCount.data().count,
            totalIslands: islandsCount.data().count,
            totalCards: cardsCount.data().count,
          });
        }
      } catch (err) {
        console.error('Failed to load admin overview metrics', err);
        if (active) {
          setError('Could not load live overview analytics from Firestore.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadMetrics();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section>
      <div className="mb-8">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-red-300/80">Admin Overview</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">Live platform analytics</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-muted">
          These counts read directly from Firestore using server-side aggregation to keep the dashboard fast and read-efficient.
        </p>
      </div>

      {error ? (
        <div className="rounded-[28px] border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-100">
          {error}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          {metricCards.map(({ key, label, icon: Icon, accent, bg }) => (
            <div key={key} className={`rounded-[32px] border p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)] ${bg}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-white/45">{label}</p>
                  <p className="mt-4 text-4xl font-semibold tracking-tight text-white">
                    {loading ? '...' : metrics[key].toLocaleString()}
                  </p>
                </div>
                <div className={`rounded-2xl border border-white/10 p-3 ${accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
