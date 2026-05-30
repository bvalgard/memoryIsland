import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { RichText, RichTextInline } from '../../RichText';
import { Card } from '../../../hooks/useUserProgress';

interface SequencingCardRendererProps {
  isFlipped: boolean;
  isTestMode: boolean;
  currentCard: Card;
  shuffledSequence: Array<{ id: string; text: string }>;
  seqDragIdx: number | null;
  seqOverIdx: number | null;
  setShuffledSequence: React.Dispatch<React.SetStateAction<Array<{ id: string; text: string }>>>;
  setSeqDragIdx: (i: number | null) => void;
  setSeqOverIdx: (i: number | null) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function SequencingCardRenderer({
  isFlipped, isTestMode, currentCard, shuffledSequence, seqDragIdx, seqOverIdx,
  setShuffledSequence, setSeqDragIdx, setSeqOverIdx, onSubmit,
}: SequencingCardRendererProps) {
  return (
    <div className="w-full flex-1 flex flex-col justify-center items-center gap-3 pb-4">
      <form onSubmit={onSubmit} className="w-full flex flex-col gap-3">
        <ul className="w-full flex flex-col gap-2 list-none p-0 m-0">
          {shuffledSequence.map((item, idx) => {
            let btnClass = "bg-white/5 border border-white/10 text-white/80";
            let icon = null;

            if (isFlipped && !isTestMode) {
              const correctOpt = currentCard.options![idx];
              if (item.text === correctOpt) {
                btnClass = "bg-emerald-500/20 border-emerald-500/50 text-emerald-400";
                icon = <CheckCircle2 className="w-5 h-5" />;
              } else {
                btnClass = "bg-red-500/20 border-red-500/50 text-red-500";
                icon = <XCircle className="w-5 h-5" />;
              }
            } else if (isFlipped && isTestMode) {
              btnClass = "bg-white/10 border-white/20 text-white/70";
            }

            const isDraggingThis = seqDragIdx === idx;
            const isOverThis = seqOverIdx === idx && seqDragIdx !== idx;

            return (
              <li
                key={item.id}
                draggable={!isFlipped}
                onDragStart={!isFlipped ? (e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  setSeqDragIdx(idx);
                } : undefined}
                onDragOver={!isFlipped ? (e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setSeqOverIdx(idx);
                } : undefined}
                onDrop={!isFlipped ? (e) => {
                  e.preventDefault();
                  if (seqDragIdx === null || seqDragIdx === idx) {
                    setSeqDragIdx(null);
                    setSeqOverIdx(null);
                    return;
                  }
                  const next = [...shuffledSequence];
                  const [moved] = next.splice(seqDragIdx, 1);
                  next.splice(idx, 0, moved);
                  setShuffledSequence(next);
                  setSeqDragIdx(null);
                  setSeqOverIdx(null);
                } : undefined}
                onDragEnd={!isFlipped ? () => {
                  setSeqDragIdx(null);
                  setSeqOverIdx(null);
                } : undefined}
                className={cn(
                  "w-full text-left px-4 py-3 sm:px-5 sm:py-4 rounded-xl transition-all font-medium text-xs sm:text-sm md:text-base leading-relaxed flex items-center gap-3 select-none",
                  btnClass,
                  !isFlipped && "cursor-grab hover:bg-white/10",
                  isDraggingThis && "opacity-40 scale-95",
                  isOverThis && "ring-2 ring-brand-primary/60 ring-inset"
                )}
              >
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0 pointer-events-none">
                  {idx + 1}
                </div>
                <span className="flex-1 pointer-events-none"><RichTextInline>{item.text}</RichTextInline></span>
                {!isFlipped && (
                  <svg className="w-4 h-4 text-white/30 shrink-0 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
                  </svg>
                )}
                {icon && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                    {icon}
                  </motion.div>
                )}
              </li>
            );
          })}
        </ul>
        {!isFlipped && (
          <button type="submit" className="w-full mt-4 bg-brand-primary hover:bg-white text-black py-4 rounded-xl text-sm font-bold transition-colors">
            Submit Sequence
          </button>
        )}
      </form>
      {isFlipped && !isTestMode && currentCard?.explanation && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-4 rounded-2xl bg-white/5 border border-white/10 text-left w-full"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted block mb-1.5">Why</span>
          <div className="text-sm text-white/70 leading-relaxed"><RichText>{currentCard.explanation}</RichText></div>
        </motion.div>
      )}
    </div>
  );
}
