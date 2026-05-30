import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, X, Check, ArrowUp } from 'lucide-react';
import { Card } from '../../hooks/useUserProgress';
import { cn } from '../../lib/utils';

interface CardPreviewModalProps {
  card: Card | null;
  onClose: () => void;
}

export default function CardPreviewModal({ card, onClose }: CardPreviewModalProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [fibInput, setFibInput] = useState('');
  const [fibSubmitted, setFibSubmitted] = useState(false);
  const [shuffledOptions, setShuffledOptions] = useState<string[]>([]);
  const [sequenceOrder, setSequenceOrder] = useState<number[]>([]);
  const [sequenceSubmitted, setSequenceSubmitted] = useState(false);

  useEffect(() => {
    if (!card) return;
    const opts = card.options || [];
    setShuffledOptions([...opts].sort(() => Math.random() - 0.5));
    setSequenceOrder(opts.map((_, i) => i).sort(() => Math.random() - 0.5));
    setIsFlipped(false);
    setSelectedOption(null);
    setFibInput('');
    setFibSubmitted(false);
    setSequenceSubmitted(false);
  }, [card?.id]);

  if (!card) return null;

  const isFlashcard = !card.type || card.type === 'flashcard';
  const isMcq = card.type === 'mcq' || card.type === 'multi-select';
  const isFib = card.type === 'fill-in-the-blank';
  const isSeq = card.type === 'sequencing';
  const isMatching = card.type === 'matching';
  const typeLabel = isMcq ? 'Multiple Choice' : isFib ? 'Fill in the Blank' : isSeq ? 'Sequencing' : isMatching ? 'Matching' : 'Flashcard';

  return (
    <>
      <motion.div
        key="preview-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        key="preview-modal"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-lg glass p-6 sm:p-8 rounded-[32px] border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.8)] z-[101] max-h-[85vh] overflow-y-auto custom-scrollbar"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-primary/20 flex items-center justify-center">
              <Eye className="w-4 h-4 text-brand-primary" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-brand-muted font-medium">{typeLabel}</p>
              <p className="text-xs text-white/40">Card Preview</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-brand-muted hover:text-white rounded-xl bg-white/5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Flashcard */}
        {isFlashcard && (
          <div>
            <div className="glass rounded-2xl p-6 border border-brand-primary/20 text-center mb-4 min-h-[120px] flex flex-col items-center justify-center gap-4">
              <p className="text-[10px] uppercase tracking-widest text-brand-muted/60 font-medium">Front</p>
              {card.imageUrl && <img src={card.imageUrl} alt="" className="max-h-32 rounded-xl object-contain" />}
              <p className="text-lg font-bold leading-snug">{card.front}</p>
            </div>
            <AnimatePresence>
              {!isFlipped ? (
                <motion.button
                  key="reveal-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsFlipped(true)}
                  className="w-full py-3 rounded-xl bg-brand-primary/20 text-brand-primary font-bold text-sm hover:bg-brand-primary/30 transition-colors border border-brand-primary/30"
                >
                  Reveal Answer
                </motion.button>
              ) : (
                <motion.div key="back-face" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="glass rounded-2xl p-6 border border-emerald-500/20 text-center min-h-[100px] flex flex-col items-center justify-center gap-4 mb-4">
                    <p className="text-[10px] uppercase tracking-widest text-emerald-400/60 font-medium">Back</p>
                    {card.backImageUrl && <img src={card.backImageUrl} alt="" className="max-h-32 rounded-xl object-contain" />}
                    <p className="text-base font-medium leading-snug text-white/90">{card.back}</p>
                    {card.explanation && <p className="text-xs text-brand-muted mt-1 leading-relaxed">{card.explanation}</p>}
                  </div>
                  <button
                    onClick={() => setIsFlipped(false)}
                    className="w-full py-2.5 rounded-xl bg-white/5 text-brand-muted text-sm hover:text-white transition-colors"
                  >
                    Flip Back
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* MCQ */}
        {isMcq && (() => {
          const correctSet = card.correctOptions?.length
            ? new Set(card.correctOptions)
            : new Set([card.back]);
          const isMultiAnswer = correctSet.size > 1;
          return (
            <div>
              <div className="glass rounded-2xl p-6 border border-brand-primary/20 text-center mb-6 min-h-[100px] flex flex-col items-center justify-center gap-3">
                <p className="text-[10px] uppercase tracking-widest text-brand-muted/60 font-medium">{isMultiAnswer ? 'Select All That Apply' : 'Select the Correct Answer'}</p>
                {card.imageUrl && <img src={card.imageUrl} alt="" className="max-h-28 rounded-xl object-contain" />}
                <p className="text-lg font-bold leading-snug">{card.front}</p>
              </div>
              <div className="space-y-2">
                {shuffledOptions.map((opt, i) => {
                  const isCorrect = correctSet.has(opt);
                  const isSelected = selectedOption === opt;
                  const revealed = selectedOption !== null;
                  let cls = "bg-white/5 border border-white/10 hover:bg-white/10 text-white/70";
                  if (revealed) {
                    if (isCorrect) cls = "bg-emerald-500/10 border-emerald-500/50 text-white";
                    else if (isSelected) cls = "bg-red-500/10 border-red-500/50 text-white";
                    else cls = "bg-white/5 border-transparent text-brand-muted/30 opacity-40";
                  }
                  const letter = String.fromCharCode(65 + i);
                  return (
                    <button
                      key={opt}
                      disabled={revealed}
                      onClick={() => setSelectedOption(opt)}
                      className={cn("w-full text-left px-4 py-3 rounded-xl transition-colors flex items-start gap-3 text-sm font-medium", cls)}
                    >
                      <span className="font-bold text-white/50 shrink-0">{letter}.</span>
                      <span className="flex-1">{opt}</span>
                      {revealed && isCorrect && <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                      {revealed && isSelected && !isCorrect && <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
              {selectedOption && card.explanation && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-brand-muted mt-4 p-3 rounded-xl bg-white/5 leading-relaxed">
                  {card.explanation}
                </motion.p>
              )}
              {selectedOption && (
                <button onClick={() => { setSelectedOption(null); setShuffledOptions(p => [...p].sort(() => Math.random() - 0.5)); }} className="w-full mt-3 py-2.5 rounded-xl bg-white/5 text-brand-muted text-sm hover:text-white transition-colors">
                  Try Again
                </button>
              )}
            </div>
          );
        })()}

        {/* Fill in the Blank */}
        {isFib && (
          <div>
            <div className="glass rounded-2xl p-6 border border-brand-primary/20 text-center mb-6 min-h-[100px] flex flex-col items-center justify-center gap-3">
              <p className="text-[10px] uppercase tracking-widest text-brand-muted/60 font-medium">Fill in the Blank</p>
              {card.imageUrl && <img src={card.imageUrl} alt="" className="max-h-28 rounded-xl object-contain" />}
              <p className="text-lg font-bold leading-snug">{card.front}</p>
            </div>
            {!fibSubmitted ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={fibInput}
                  onChange={e => setFibInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fibInput.trim() && setFibSubmitted(true)}
                  placeholder="Type your answer..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-brand-muted/40 focus:outline-none focus:border-brand-primary/50"
                  autoFocus
                />
                <button
                  onClick={() => fibInput.trim() && setFibSubmitted(true)}
                  disabled={!fibInput.trim()}
                  className="w-full py-3 rounded-xl bg-brand-primary/20 text-brand-primary font-bold text-sm hover:bg-brand-primary/30 transition-colors border border-brand-primary/30 disabled:opacity-40"
                >
                  Check Answer
                </button>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-brand-muted/60">Your answer</p>
                  <p className="text-sm font-medium text-white/80">{fibInput}</p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-400/60">Correct answer</p>
                  <p className="text-sm font-bold text-emerald-300">{card.back}</p>
                </div>
                {card.explanation && <p className="text-xs text-brand-muted p-3 rounded-xl bg-white/5 leading-relaxed">{card.explanation}</p>}
                <button onClick={() => { setFibInput(''); setFibSubmitted(false); }} className="w-full py-2.5 rounded-xl bg-white/5 text-brand-muted text-sm hover:text-white transition-colors">
                  Try Again
                </button>
              </motion.div>
            )}
          </div>
        )}

        {/* Sequencing */}
        {isSeq && (
          <div>
            <div className="glass rounded-2xl p-6 border border-brand-primary/20 text-center mb-6 min-h-[100px] flex flex-col items-center justify-center gap-3">
              <p className="text-[10px] uppercase tracking-widest text-brand-muted/60 font-medium">Put in the Correct Order</p>
              <p className="text-lg font-bold leading-snug">{card.front}</p>
            </div>
            <div className="space-y-2 mb-4">
              {sequenceOrder.map((origIdx, pos) => {
                const opts = card.options || [];
                const isCorrectPos = sequenceSubmitted && origIdx === pos;
                const isWrongPos = sequenceSubmitted && origIdx !== pos;
                return (
                  <div key={origIdx} className={cn("flex items-center gap-3 p-3 rounded-xl border transition-colors", sequenceSubmitted ? (isCorrectPos ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30") : "bg-white/5 border-white/10")}>
                    <span className="text-xs font-bold text-brand-muted/60 w-5 shrink-0">{pos + 1}.</span>
                    <span className="flex-1 text-sm font-medium">{opts[origIdx]}</span>
                    {!sequenceSubmitted && (
                      <div className="flex gap-1">
                        <button disabled={pos === 0} onClick={() => { const o = [...sequenceOrder]; [o[pos-1], o[pos]] = [o[pos], o[pos-1]]; setSequenceOrder(o); }} className="p-1 text-brand-muted hover:text-white disabled:opacity-20 transition-colors">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button disabled={pos === sequenceOrder.length - 1} onClick={() => { const o = [...sequenceOrder]; [o[pos], o[pos+1]] = [o[pos+1], o[pos]]; setSequenceOrder(o); }} className="p-1 text-brand-muted hover:text-white disabled:opacity-20 transition-colors" style={{ transform: 'rotate(180deg)' }}>
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {sequenceSubmitted && isCorrectPos && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                    {sequenceSubmitted && isWrongPos && <X className="w-4 h-4 text-red-400 shrink-0" />}
                  </div>
                );
              })}
            </div>
            {!sequenceSubmitted ? (
              <button onClick={() => setSequenceSubmitted(true)} className="w-full py-3 rounded-xl bg-brand-primary/20 text-brand-primary font-bold text-sm hover:bg-brand-primary/30 transition-colors border border-brand-primary/30">
                Check Order
              </button>
            ) : (
              <button onClick={() => { setSequenceOrder((card.options || []).map((_, i) => i).sort(() => Math.random() - 0.5)); setSequenceSubmitted(false); }} className="w-full py-2.5 rounded-xl bg-white/5 text-brand-muted text-sm hover:text-white transition-colors">
                Try Again
              </button>
            )}
          </div>
        )}

        {/* Matching */}
        {isMatching && (card.pairs || []).length > 0 && (
          <div>
            <div className="glass rounded-2xl p-6 border border-brand-primary/20 text-center mb-6 min-h-[100px] flex flex-col items-center justify-center gap-3">
              <p className="text-[10px] uppercase tracking-widest text-brand-muted/60 font-medium">Match the Pairs</p>
              <p className="text-lg font-bold leading-snug">{card.front}</p>
            </div>
            <div className="space-y-3">
              {(card.pairs || []).map((pair) => (
                <div key={pair.id} className="flex items-center gap-3">
                  <div className="flex-1 p-3 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-center">{pair.left}</div>
                  <div className="text-brand-muted/40 shrink-0">↔</div>
                  <div className="flex-1 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm font-medium text-center text-emerald-300">{pair.rights[0]}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {card.hint && (
          <p className="text-xs text-brand-muted/60 mt-4 text-center italic">Hint: {card.hint}</p>
        )}
      </motion.div>
    </>
  );
}
