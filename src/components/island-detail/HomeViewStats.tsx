import { Plus, ChevronDown } from 'lucide-react';
import { cn, formatTimeUntil } from '../../lib/utils';

function formatRelativeTime(ts: number): string {
  if (!ts) return 'Never';
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

interface HomeViewStatsProps {
  totalCards: number;
  progressPct: number;
  chartingCount: number;
  sailingCount: number;
  masteredCount: number;
  progressTrackingMode: 'srs' | 'status' | 'both';
  accuracyStat: number | null;
  islandTotalCorrect: number;
  islandTotalAnswers: number;
  lastStudiedTs: number;
  dueCount: number;
  nextDueTs: number;
  onShowCharting: () => void;
  onNavigateToEditor: () => void;
}

export default function HomeViewStats({
  totalCards, progressPct, chartingCount, sailingCount, masteredCount,
  progressTrackingMode, accuracyStat, islandTotalCorrect, islandTotalAnswers,
  lastStudiedTs, dueCount, nextDueTs, onShowCharting, onNavigateToEditor,
}: HomeViewStatsProps) {
  return (
    <div className="mt-4 space-y-5">
      {totalCards > 0 ? (
        <>
          {/* Mastery bar */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] uppercase tracking-widest font-bold text-brand-muted">Mastery Progress</span>
              <span className="text-[10px] font-bold text-brand-muted">{progressPct}% mastered</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden flex bg-white/5">
              {chartingCount > 0 && (
                <div className="bg-red-500/70 h-full transition-all duration-700" style={{ width: `${(chartingCount / totalCards) * 100}%` }} />
              )}
              {sailingCount > 0 && (
                <div className="bg-amber-500/70 h-full transition-all duration-700" style={{ width: `${(sailingCount / totalCards) * 100}%` }} />
              )}
              {masteredCount > 0 && (
                <div className="bg-emerald-500/70 h-full transition-all duration-700" style={{ width: `${(masteredCount / totalCards) * 100}%` }} />
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-[11px] text-red-400/80">
                <span className="w-2 h-2 rounded-full bg-red-500/70 inline-block" />{chartingCount} charting
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-amber-400/80">
                <span className="w-2 h-2 rounded-full bg-amber-500/70 inline-block" />{sailingCount} sailing
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400/80">
                <span className="w-2 h-2 rounded-full bg-emerald-500/70 inline-block" />{masteredCount} mastered
              </span>
            </div>
          </div>

          {/* Stat grid */}
          <div className={cn("grid gap-3", progressTrackingMode !== 'status' ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")}>
            <div className="glass rounded-2xl p-4 border border-brand-border">
              <p className="text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-1">Progress</p>
              <p className={cn("text-2xl font-black", progressPct === 100 ? "text-emerald-400" : progressPct >= 50 ? "text-amber-400" : "text-white")}>{progressPct}%</p>
              <p className="text-[10px] text-brand-muted mt-0.5">{masteredCount} of {totalCards} mastered</p>
            </div>
            {accuracyStat !== null && (
              <div className="glass rounded-2xl p-4 border border-brand-border">
                <p className="text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-1">Accuracy</p>
                <p className={cn("text-2xl font-black", accuracyStat >= 80 ? "text-emerald-400" : accuracyStat >= 60 ? "text-amber-400" : "text-red-400")}>{accuracyStat}%</p>
                <p className="text-[10px] text-brand-muted mt-0.5">{islandTotalCorrect}/{islandTotalAnswers} correct</p>
              </div>
            )}
            <div className="glass rounded-2xl p-4 border border-brand-border">
              <p className="text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-1">Last Studied</p>
              <p className="text-lg font-black text-white leading-tight">{lastStudiedTs > 0 ? formatRelativeTime(lastStudiedTs) : '—'}</p>
              <p className="text-[10px] text-brand-muted mt-0.5">{totalCards} cards total</p>
            </div>
            {progressTrackingMode !== 'status' && (
              <div className="glass rounded-2xl p-4 border border-brand-border">
                <p className="text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-1">Due Now</p>
                <p className={cn("text-2xl font-black", dueCount > 0 ? "text-sky-400" : "text-white")}>{dueCount}</p>
                <p className="text-[10px] text-brand-muted mt-0.5">
                  {dueCount === 0 && isFinite(nextDueTs) ? `Next ${formatTimeUntil(nextDueTs)}` : 'cards to review'}
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="glass rounded-2xl p-8 border border-brand-border text-center">
          <p className="text-brand-muted text-sm">No cards yet — add your first card to get started.</p>
        </div>
      )}

      {/* Charting Cards trigger */}
      {chartingCount > 0 && (
        <button
          onClick={onShowCharting}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500/70 inline-block shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-red-400">Charting Cards</span>
            <span className="text-[11px] text-red-400/60 font-bold">({chartingCount})</span>
          </div>
          <ChevronDown className="w-4 h-4 text-red-400/60" />
        </button>
      )}

      {/* Create Cards CTA */}
      <div className="pt-1">
        <button
          onClick={onNavigateToEditor}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-brand-muted hover:text-white transition-all text-sm font-bold"
        >
          <Plus className="w-4 h-4" />
          {totalCards === 0 ? 'Create Cards' : 'Create & Edit Cards'}
        </button>
      </div>
    </div>
  );
}
