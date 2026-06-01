import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Island } from '../../hooks/useUserProgress';
import { cn } from '../../lib/utils';

interface ChartingCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  island: Island;
  chartingIndices: number[];
  chartingCount: number;
}

export default function ChartingCardsModal({ isOpen, onClose, island, chartingIndices, chartingCount }: ChartingCardsModalProps) {
  const [previewCardIdx, setPreviewCardIdx] = useState<number | null>(null);
  const [previewRevealed, setPreviewRevealed] = useState(false);

  const handleClose = () => {
    setPreviewCardIdx(null);
    setPreviewRevealed(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-2xl glass rounded-[32px] border border-red-500/20 shadow-[0_40px_100px_rgba(0,0,0,0.8)] z-[101] flex flex-col max-h-[80vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-red-500/15 shrink-0">
              <div className="flex items-center gap-3">
                {previewCardIdx !== null && (
                  <button
                    onClick={() => { setPreviewCardIdx(null); setPreviewRevealed(false); }}
                    className="p-1.5 text-brand-muted hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white tracking-tight">
                    {previewCardIdx !== null
                      ? `Card ${chartingIndices.indexOf(previewCardIdx) + 1} of ${chartingCount}`
                      : 'Charting Cards'}
                  </h3>
                  <p className="text-[11px] text-red-400/60 font-medium">
                    {previewCardIdx !== null ? 'Practice preview' : `${chartingCount} card${chartingCount !== 1 ? 's' : ''} need attention`}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 text-brand-muted hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body — grid or preview */}
            <div className="overflow-y-auto custom-scrollbar flex-1">
              <AnimatePresence mode="wait" initial={false}>
                {previewCardIdx === null ? (
                  <motion.div
                    key="grid"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.15 }}
                    className="p-5"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {chartingIndices.map((idx) => {
                        const card = island.cards[idx];
                        const accuracy = card.totalAnswers && card.totalAnswers > 0
                          ? Math.round((card.totalCorrect ?? 0) / card.totalAnswers * 100)
                          : null;
                        const typeLabel =
                          card.type === 'mcq' || card.type === 'multi-select' ? 'MCQ' :
                          card.type === 'fill-in-the-blank' ? 'Fill-in' :
                          card.type === 'sequencing' ? 'Sequence' :
                          card.type === 'matching' ? 'Matching' : 'Flashcard';
                        return (
                          <button
                            key={idx}
                            onClick={() => { setPreviewCardIdx(idx); setPreviewRevealed(false); }}
                            className="text-left glass rounded-2xl p-4 border border-red-500/20 hover:border-red-500/50 hover:bg-red-500/5 transition-all group flex flex-col gap-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[9px] font-black uppercase tracking-widest text-red-400/70 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/15">
                                {typeLabel}
                              </span>
                              {accuracy !== null && (
                                <span className="text-xs font-black text-red-400 tabular-nums">{accuracy}%</span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-white/80 leading-snug line-clamp-3 group-hover:text-white transition-colors">
                              {card.front}
                            </p>
                            {card.totalAnswers != null && card.totalAnswers > 0 && (
                              <p className="text-[10px] text-red-400/50 mt-auto">
                                {card.totalAnswers - (card.totalCorrect ?? 0)} wrong of {card.totalAnswers} attempts
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : (() => {
                  const card = island.cards[previewCardIdx];
                  const posInList = chartingIndices.indexOf(previewCardIdx);
                  const prevIdx = posInList > 0 ? chartingIndices[posInList - 1] : null;
                  const nextIdx = posInList < chartingIndices.length - 1 ? chartingIndices[posInList + 1] : null;
                  return (
                    <motion.div
                      key={`preview-${previewCardIdx}`}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 16 }}
                      transition={{ duration: 0.15 }}
                      className="p-5 flex flex-col gap-4"
                    >
                      <div className="glass rounded-2xl p-5 border border-white/5">
                        <p className="text-[10px] uppercase tracking-widest font-bold text-brand-muted mb-3">Question</p>
                        <p className="text-base font-semibold text-white leading-relaxed">{card.front}</p>
                        {card.hint && !previewRevealed && (
                          <p className="text-xs text-brand-muted/60 mt-3 italic">Hint: {card.hint}</p>
                        )}
                      </div>

                      {(card.type === 'mcq' || card.type === 'multi-select') && card.options && (
                        <div className="space-y-2">
                          {card.options.map((opt, i) => {
                            const isCorrect = card.correctOptions?.includes(opt);
                            return (
                              <div
                                key={i}
                                className={cn(
                                  "px-4 py-3 rounded-xl border text-sm font-medium transition-colors",
                                  previewRevealed
                                    ? isCorrect
                                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                      : "border-white/5 bg-white/3 text-white/40"
                                    : "border-white/10 bg-white/5 text-white/70"
                                )}
                              >
                                {previewRevealed && isCorrect && <CheckCircle2 className="w-3.5 h-3.5 inline mr-2 text-emerald-400" />}
                                {opt}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {!previewRevealed ? (
                        <button
                          onClick={() => setPreviewRevealed(true)}
                          className="w-full py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-bold text-white/70 hover:text-white transition-all"
                        >
                          Reveal Answer
                        </button>
                      ) : (
                        <AnimatePresence>
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass rounded-2xl p-5 border border-emerald-500/20 bg-emerald-500/5 flex flex-col gap-3"
                          >
                            <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-400/70">Answer</p>
                            {card.type === 'matching' && card.pairs ? (
                              <div className="space-y-2">
                                {card.pairs.map((pair) => (
                                  <div key={pair.id} className="flex items-start gap-2 text-sm">
                                    <span className="font-bold text-white/80 shrink-0">{pair.left}</span>
                                    <span className="text-white/40">→</span>
                                    <span className="text-emerald-300/80">{pair.rights.join(', ')}</span>
                                  </div>
                                ))}
                              </div>
                            ) : card.type === 'sequencing' && card.options ? (
                              <ol className="space-y-1.5 list-none">
                                {card.options.map((step, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm">
                                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                                    <span className="text-white/80">{step}</span>
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <p className="text-sm text-white/80 leading-relaxed">{card.back}</p>
                            )}
                            {card.explanation && (
                              <p className="text-xs text-brand-muted/70 border-t border-white/5 pt-3 leading-relaxed italic">{card.explanation}</p>
                            )}
                          </motion.div>
                        </AnimatePresence>
                      )}

                      <p className="text-[10px] text-brand-muted/40 text-center leading-relaxed">
                        Reviewing here won't reset your due date — use this to practice between sessions.
                      </p>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <button
                          onClick={() => { if (prevIdx !== null) { setPreviewCardIdx(prevIdx); setPreviewRevealed(false); } }}
                          disabled={prevIdx === null}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 disabled:opacity-30 text-sm font-bold text-white/70 hover:text-white transition-all"
                        >
                          <ChevronLeft className="w-4 h-4" /> Prev
                        </button>
                        <button
                          onClick={() => { if (nextIdx !== null) { setPreviewCardIdx(nextIdx); setPreviewRevealed(false); } }}
                          disabled={nextIdx === null}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 disabled:opacity-30 text-sm font-bold text-white/70 hover:text-white transition-all"
                        >
                          Next <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/5 shrink-0">
              <p className="text-[10px] text-brand-muted/50 text-center">
                {previewCardIdx === null ? 'Tap a card to preview it' : 'Answers hidden until revealed'}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
