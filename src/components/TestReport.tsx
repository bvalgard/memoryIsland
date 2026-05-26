import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RotateCcw, ChevronDown, ChevronUp, Flame, Flag, BookOpen } from 'lucide-react';
import { TestSessionDoc } from '../hooks/useTestMode';
import AskQuestionModal from './AskQuestionModal';
import { useQuestions } from '../hooks/useQuestions';
import { cn } from '../lib/utils';

interface Props {
  session: TestSessionDoc;
  onClose: () => void;
  onRetake: () => void;
  onRestudy: (cardIds: string[]) => void;
  onFlagForTomorrow: (cardIds: string[]) => Promise<void>;
  friends?: string[];
  currentUserName?: string;
  islandIdToId?: Record<string, string>; // islandName -> islandId for SOS
}

function ScoreColor(pct: number) {
  if (pct >= 85) return 'text-emerald-400';
  if (pct >= 70) return 'text-amber-400';
  return 'text-red-400';
}

function ScoreBg(pct: number) {
  if (pct >= 85) return 'bg-emerald-500/10 border-emerald-500/20';
  if (pct >= 70) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

export default function TestReport({
  session,
  onClose,
  onRetake,
  onRestudy,
  onFlagForTomorrow,
  friends = [],
  currentUserName = 'Explorer',
}: Props) {
  const [missedOpen, setMissedOpen] = useState(true);
  const [flagging, setFlagging] = useState<Set<string>>(new Set());
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [askCard, setAskCard] = useState<{ cardId: string; islandId: string } | null>(null);
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);

  const { askQuestion } = useQuestions();

  const missed = session.questions.filter(q => !q.correct);
  const pct = session.scorePercent;
  const avgSec = Math.round(session.avgTimeMs / 1000);

  const timeLabel = avgSec < 15 ? 'Very Fast' : avgSec < 30 ? 'Fast' : avgSec < 60 ? 'Average' : 'Slow';

  const handleFlag = async (cardId: string) => {
    if (flagged.has(cardId) || flagging.has(cardId)) return;
    setFlagging(prev => new Set([...prev, cardId]));
    await onFlagForTomorrow([cardId]);
    setFlagged(prev => new Set([...prev, cardId]));
    setFlagging(prev => { const n = new Set(prev); n.delete(cardId); return n; });
  };

  const handleFlagAll = async () => {
    const toFlag = missed.filter(q => !flagged.has(q.cardId) && q.cardId).map(q => q.cardId);
    if (!toFlag.length) return;
    setFlagging(new Set(toFlag));
    await onFlagForTomorrow(toFlag);
    setFlagged(prev => new Set([...prev, ...toFlag]));
    setFlagging(new Set());
  };

  const handleAskFlare = async (visibility: 'friends' | 'global', isAnonymous: boolean) => {
    if (!askCard) return;
    const q = session.questions.find(q => q.cardId === askCard.cardId);
    if (!q) return;
    setIsAskingQuestion(true);
    try {
      const fakeCard = { id: q.cardId, front: q.front, back: q.back, type: q.type as any };
      await askQuestion(fakeCard as any, q.islandId, visibility, friends, currentUserName, isAnonymous);
    } finally {
      setIsAskingQuestion(false);
      setAskCard(null);
    }
  };

  const date = new Date(session.completedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

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
        className="relative w-full max-w-xl bg-[#111] border border-white/10 rounded-[28px] shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-white/5 shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">Captain's Log</h2>
            <p className="text-[10px] text-brand-muted uppercase tracking-widest">{date}</p>
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Score Hero */}
          <div className={cn('rounded-2xl border p-5 text-center', ScoreBg(pct))}>
            <div className={cn('text-5xl font-black mb-1', ScoreColor(pct))}>{pct}%</div>
            <div className="text-xs text-white/60">{session.correctCards} / {session.totalCards} correct</div>
            <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-white/10">
              <div className="text-center">
                <div className="text-sm font-bold text-white">{avgSec}s</div>
                <div className="text-[10px] text-brand-muted uppercase tracking-widest">Avg / question</div>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div className="text-center">
                <div className="text-sm font-bold text-white">{timeLabel}</div>
                <div className="text-[10px] text-brand-muted uppercase tracking-widest">Pace</div>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div className="text-center">
                <div className="text-sm font-bold text-white">{session.totalCards}</div>
                <div className="text-[10px] text-brand-muted uppercase tracking-widest">Questions</div>
              </div>
            </div>
          </div>

          {/* Island Breakdown */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-3">Score by Island</p>
            <div className="space-y-2">
              {Object.entries(session.islandBreakdown)
                .sort((a, b) => (b[1].correct / b[1].total) - (a[1].correct / a[1].total))
                .map(([islandId, data]) => {
                  const islandPct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                  return (
                    <div key={islandId} className="flex items-center gap-3">
                      <div className="w-32 text-xs text-white/70 truncate shrink-0">{data.islandName}</div>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${islandPct}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className={cn('h-full rounded-full', islandPct >= 85 ? 'bg-emerald-500' : islandPct >= 70 ? 'bg-amber-500' : 'bg-red-500')}
                        />
                      </div>
                      <div className="text-xs text-right shrink-0 w-20">
                        <span className={ScoreColor(islandPct)}>{islandPct}%</span>
                        <span className="text-brand-muted ml-1">({data.correct}/{data.total})</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Missed Questions */}
          {missed.length > 0 && (
            <div>
              <div
                onClick={() => setMissedOpen(v => !v)}
                className="flex items-center justify-between w-full mb-3 cursor-pointer"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
                  Missed Questions ({missed.length})
                </p>
                <div className="flex items-center gap-2">
                  {missedOpen && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleFlagAll(); }}
                      className="text-[10px] text-amber-400/70 hover:text-amber-400 transition-colors font-bold uppercase tracking-widest"
                    >
                      Flag All for Tomorrow
                    </button>
                  )}
                  {missedOpen ? <ChevronUp className="w-4 h-4 text-brand-muted" /> : <ChevronDown className="w-4 h-4 text-brand-muted" />}
                </div>
              </div>

              <AnimatePresence>
                {missedOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2">
                      {missed.map((q, i) => (
                        <div key={i} className="rounded-xl bg-white/3 border border-white/8 p-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-white/80 leading-snug line-clamp-2">{q.front}</p>
                              <p className="text-[10px] text-brand-muted mt-0.5">{q.islandName}</p>
                            </div>
                            <span className="text-[10px] text-brand-muted shrink-0">{Math.round(q.timeMs / 1000)}s</span>
                          </div>
                          <div className="flex gap-1.5">
                            {q.cardId && (
                              <button
                                onClick={() => onRestudy([q.cardId])}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-[10px] font-bold uppercase tracking-widest hover:bg-brand-primary/20 transition-colors"
                              >
                                <BookOpen className="w-3 h-3" />
                                Restudy
                              </button>
                            )}
                            <button
                              onClick={() => setAskCard({ cardId: q.cardId, islandId: q.islandId })}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold uppercase tracking-widest hover:bg-orange-500/20 transition-colors"
                            >
                              <Flame className="w-3 h-3" />
                              SOS Flare
                            </button>
                            {q.cardId && (
                              <button
                                onClick={() => handleFlag(q.cardId)}
                                disabled={flagging.has(q.cardId) || flagged.has(q.cardId)}
                                className={cn(
                                  'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-colors',
                                  flagged.has(q.cardId)
                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                    : 'bg-white/5 border-white/10 text-brand-muted hover:text-amber-400 hover:border-amber-500/20'
                                )}
                              >
                                <Flag className="w-3 h-3" />
                                {flagged.has(q.cardId) ? 'Flagged' : 'Tomorrow'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-white/5 shrink-0 flex gap-3">
          <button
            onClick={() => onRetake()}
            className="flex-1 h-11 rounded-2xl border border-white/10 bg-white/5 text-white text-sm font-semibold hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Retake
          </button>
          <button
            onClick={onClose}
            className="flex-1 btn-primary h-11 text-sm"
          >
            Close
          </button>
        </div>
      </motion.div>

      <AskQuestionModal
        isOpen={!!askCard}
        friendCount={friends.length}
        isSending={isAskingQuestion}
        onClose={() => setAskCard(null)}
        onSend={handleAskFlare}
      />
    </div>
  );
}
