import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, GraduationCap, Plus, ChevronRight, ChevronLeft, RotateCcw, Trophy } from 'lucide-react';
import { TestSessionDoc, TestDefinition } from '../hooks/useTestMode';
import { cn } from '../lib/utils';

interface Props {
  userTests: TestDefinition[];
  allSessions: TestSessionDoc[];
  loading: boolean;
  onClose: () => void;
  onNewTest: () => void;
  onTakeAgain: (test: TestDefinition) => void;
  onViewReport: (session: TestSessionDoc) => void;
}

function ScoreColor(pct: number) {
  if (pct >= 85) return 'text-emerald-400';
  if (pct >= 70) return 'text-amber-400';
  return 'text-red-400';
}

function ScoreBadgeBg(pct: number) {
  if (pct >= 85) return 'bg-emerald-500/10 border-emerald-500/20';
  if (pct >= 70) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

function ScoreGraph({ sessions }: { sessions: TestSessionDoc[] }) {
  const data = [...sessions].sort((a, b) => a.completedAt - b.completedAt).slice(-10);
  if (data.length < 2) {
    return (
      <div className="h-24 flex items-center justify-center text-xs text-brand-muted">
        Complete 2+ attempts to see progress
      </div>
    );
  }

  const W = 320;
  const H = 80;
  const pad = 10;

  const xStep = (W - pad * 2) / (data.length - 1);
  const pts = data.map((s, i) => {
    const x = pad + i * xStep;
    const y = H - pad - (s.scorePercent / 100) * (H - pad * 2);
    return [x, y] as [number, number];
  });

  const polyline = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const areaPath = [
    `M ${pts[0][0]},${H - pad}`,
    ...pts.map(([x, y]) => `L ${x},${y}`),
    `L ${pts[pts.length - 1][0]},${H - pad}`,
    'Z',
  ].join(' ');

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4285F4" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#4285F4" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#scoreGrad)" />
        <polyline points={polyline} fill="none" stroke="#4285F4" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="3.5" fill="#4285F4" />
            <title>{data[i].scorePercent}% — {new Date(data[i].completedAt).toLocaleDateString()}</title>
          </g>
        ))}
        {[25, 50, 75].map(pct => {
          const lineY = H - pad - (pct / 100) * (H - pad * 2);
          return (
            <line key={pct} x1={pad} y1={lineY} x2={W - pad} y2={lineY}
              stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4,4" />
          );
        })}
      </svg>
      <div className="flex justify-between px-[10px] mt-1">
        <span className="text-[9px] text-brand-muted">{new Date(data[0].completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        <span className="text-[9px] text-brand-muted">{new Date(data[data.length - 1].completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      </div>
    </div>
  );
}

export default function TestModeHub({ userTests, allSessions, loading, onClose, onNewTest, onTakeAgain, onViewReport }: Props) {
  const [drillTestId, setDrillTestId] = useState<string | null>(null);

  const drilledTest = drillTestId ? userTests.find(t => t.id === drillTestId) ?? null : null;
  const drilledSessions = drillTestId
    ? allSessions.filter(s => s.testId === drillTestId).sort((a, b) => b.completedAt - a.completedAt)
    : [];

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
        className="relative w-full max-w-lg bg-[#111] border border-white/10 rounded-[28px] shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            {drilledTest ? (
              <button onClick={() => setDrillTestId(null)} className="text-brand-muted hover:text-white transition-colors p-1 -ml-1">
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-brand-primary" />
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-white truncate max-w-[260px]">
                {drilledTest ? drilledTest.name : 'Exam Voyage'}
              </h2>
              <p className="text-[10px] text-brand-muted uppercase tracking-widest">
                {drilledTest ? `${drilledSessions.length} attempt${drilledSessions.length !== 1 ? 's' : ''}` : "Captain's Log"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          <AnimatePresence mode="wait">
            {drilledTest ? (
              /* ── Drill-down: single test ── */
              <motion.div
                key="drill"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-5"
              >
                {/* Best score + Take Again */}
                <div className="flex items-center gap-4">
                  <div className={cn('w-16 h-16 rounded-2xl border flex flex-col items-center justify-center shrink-0', ScoreBadgeBg(drilledTest.bestScore))}>
                    <Trophy className={cn('w-4 h-4 mb-0.5', ScoreColor(drilledTest.bestScore))} />
                    <span className={cn('text-lg font-black leading-none', ScoreColor(drilledTest.bestScore))}>{drilledTest.bestScore}%</span>
                    <span className="text-[9px] text-brand-muted">best</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/70">{drilledTest.attemptCount} attempt{drilledTest.attemptCount !== 1 ? 's' : ''}</p>
                    <p className="text-[10px] text-brand-muted">
                      Last: {new Date(drilledTest.lastAttemptAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    onClick={() => { onTakeAgain(drilledTest); }}
                    className="btn-primary h-9 px-4 text-xs flex items-center gap-1.5 shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Take Again
                  </button>
                </div>

                {/* Score history graph */}
                {drilledSessions.length >= 2 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-3">Score Trend</p>
                    <div className="rounded-2xl bg-white/3 border border-white/8 p-4">
                      <ScoreGraph sessions={drilledSessions} />
                    </div>
                  </div>
                )}

                {/* Attempts list */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-3">Attempts</p>
                  {drilledSessions.length === 0 ? (
                    <p className="text-sm text-brand-muted text-center py-4">No attempts yet</p>
                  ) : (
                    <div className="space-y-2">
                      {drilledSessions.map((s, i) => (
                        <motion.button
                          key={s.id ?? i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          onClick={() => onViewReport(s)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/8 hover:bg-white/6 hover:border-white/15 transition-colors group"
                        >
                          <div className={cn('w-12 h-12 rounded-xl border flex items-center justify-center shrink-0', ScoreBadgeBg(s.scorePercent))}>
                            <span className={cn('text-base font-black', ScoreColor(s.scorePercent))}>{s.scorePercent}%</span>
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-sm text-white font-semibold">
                              {s.correctCards}/{s.totalCards} correct
                            </p>
                            <p className="text-[10px] text-brand-muted">
                              {new Date(s.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-brand-muted group-hover:text-white transition-colors shrink-0" />
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              /* ── Main: test list ── */
              <motion.div
                key="list"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <button
                  onClick={onNewTest}
                  className="w-full btn-primary h-11 text-sm flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Test
                </button>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-3">Your Tests</p>
                  {loading ? (
                    <div className="text-center py-8 text-brand-muted text-sm">Loading...</div>
                  ) : userTests.length === 0 ? (
                    <div className="text-center py-8">
                      <GraduationCap className="w-10 h-10 text-brand-muted/30 mx-auto mb-3" />
                      <p className="text-sm text-brand-muted">No tests yet.</p>
                      <p className="text-xs text-brand-muted/60 mt-1">Create a named test to start tracking your progress.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {userTests.map((test, i) => (
                        <motion.button
                          key={test.id ?? i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          onClick={() => setDrillTestId(test.id ?? null)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/8 hover:bg-white/6 hover:border-white/15 transition-colors group"
                        >
                          <div className={cn('w-12 h-12 rounded-xl border flex flex-col items-center justify-center shrink-0', ScoreBadgeBg(test.bestScore))}>
                            <span className={cn('text-base font-black leading-none', ScoreColor(test.bestScore))}>{test.bestScore}%</span>
                            <span className="text-[9px] text-brand-muted leading-none mt-0.5">best</span>
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-sm text-white font-semibold truncate">{test.name}</p>
                            <p className="text-[10px] text-brand-muted">
                              {test.attemptCount} attempt{test.attemptCount !== 1 ? 's' : ''} · Last {new Date(test.lastAttemptAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-brand-muted group-hover:text-white transition-colors shrink-0" />
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
