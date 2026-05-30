import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, XCircle, ZoomIn } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { RichText, RichTextInline } from '../../RichText';
import { Card } from '../../../hooks/useUserProgress';
import type { Answer, Question } from '../../../hooks/useQuestions';
import CommunityQASection from './CommunityQASection';

interface MCQMultiCardRendererProps {
  isFlipped: boolean;
  isTestMode: boolean;
  currentCard: Card;
  shuffledOptions: string[];
  shuffledOptionImages: (string | null)[];
  selectedMultiOptions: Set<string>;
  mcqZoomSrc: string | null;
  showAskButton: boolean;
  cardAnswers: Answer[];
  cardQuestion: Question | null;
  questionJustAsked: boolean;
  onToggleOption: (opt: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onSetMcqZoomSrc: (src: string | null) => void;
  getMcqCorrectOpts: (card: Card) => string[];
  onViewQuestion?: () => void;
  onAskQuestion: () => void;
  renderAcceptPrompt: () => React.ReactNode;
}

export default function MCQMultiCardRenderer({
  isFlipped, isTestMode, currentCard, shuffledOptions, shuffledOptionImages,
  selectedMultiOptions, mcqZoomSrc, showAskButton, cardAnswers, cardQuestion,
  questionJustAsked, onToggleOption, onSubmit, onSetMcqZoomSrc, getMcqCorrectOpts,
  onViewQuestion, onAskQuestion, renderAcceptPrompt,
}: MCQMultiCardRendererProps) {
  const isAllCorrect = isFlipped && !isTestMode &&
    selectedMultiOptions.size === getMcqCorrectOpts(currentCard).length &&
    [...selectedMultiOptions].every(o => getMcqCorrectOpts(currentCard).includes(o));

  return (
    <div className="w-full flex-1 flex flex-col justify-center items-center pb-4">
      {createPortal(
        <AnimatePresence>
          {mcqZoomSrc && (
            <motion.div
              key="mcq-zoom-ms"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-lg p-6"
              onClick={() => onSetMcqZoomSrc(null)}
            >
              <motion.img
                src={mcqZoomSrc} alt=""
                initial={{ scale: 0.82, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.82, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28, delay: 0.05 }}
                onClick={() => onSetMcqZoomSrc(null)}
                className="absolute top-5 right-5 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-full p-2.5 transition-colors"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
      <form onSubmit={onSubmit} className="w-full flex flex-col gap-3">
        <div className={cn(
          shuffledOptionImages.some(Boolean) ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3"
        )}>
          {shuffledOptions.map((opt, idx) => {
            const hasImages = shuffledOptionImages.some(Boolean);
            const isSelected = selectedMultiOptions.has(opt);
            const optImage = shuffledOptionImages[idx] ?? null;
            const displayText = opt.startsWith('__img_') && opt.endsWith('__') ? '' : opt;
            let btnClass = "bg-white/5 border border-white/10 text-white/70";
            let icon: React.ReactNode = null;

            if (!isFlipped) {
              btnClass = isSelected ? "bg-brand-primary/20 border-brand-primary/50 text-white" : "bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-white/70";
            } else if (isTestMode) {
              btnClass = isSelected ? "bg-white/15 border-white/30 text-white" : "bg-white/5 border-transparent text-brand-muted/30 opacity-30";
            } else {
              const isCorrectOpt = getMcqCorrectOpts(currentCard).includes(opt);
              if (isCorrectOpt) {
                btnClass = "bg-emerald-500/20 border-emerald-500/50 text-emerald-400";
                if (isSelected) icon = <CheckCircle2 className="w-5 h-5" />;
              } else if (isSelected && !isCorrectOpt) {
                btnClass = "bg-red-500/20 border-red-500/50 text-red-500";
                icon = <XCircle className="w-5 h-5" />;
              } else {
                btnClass = "bg-white/5 border-transparent text-brand-muted/30 opacity-30";
              }
            }

            return hasImages ? (
              <div
                key={idx}
                onClick={() => onToggleOption(opt)}
                className={cn(
                  "relative rounded-xl transition-all cursor-pointer overflow-hidden flex flex-col border group/msopt",
                  btnClass
                )}
              >
                <div className="w-full aspect-[4/3] overflow-hidden flex items-center justify-center">
                  {optImage
                    ? <img src={optImage} alt="" className="w-full h-full object-contain" />
                    : <span className="font-medium text-sm leading-snug px-4 text-center"><RichTextInline>{displayText}</RichTextInline></span>
                  }
                </div>
                {(optImage || icon) && (
                  <div className="px-3 py-2 flex items-center justify-between gap-2 border-t border-white/5">
                    <span className="text-xs font-bold text-white/50 shrink-0">{String.fromCharCode(65 + idx)}.</span>
                    {optImage && displayText && <span className="text-xs leading-snug flex-1"><RichTextInline>{displayText}</RichTextInline></span>}
                    {icon && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                        {icon}
                      </motion.div>
                    )}
                  </div>
                )}
                {optImage && (
                  <button
                    type="button"
                    aria-label="Zoom image"
                    onClick={(e) => { e.stopPropagation(); onSetMcqZoomSrc(optImage); }}
                    className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/80 text-white rounded-full p-1.5 transition-all opacity-40 group-hover/msopt:opacity-100 focus:opacity-100"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                )}
              </div>
            ) : (
              <div
                key={idx}
                onClick={() => onToggleOption(opt)}
                className={cn(
                  "w-full text-left px-4 py-3 sm:px-5 sm:py-4 rounded-xl transition-all font-medium text-xs sm:text-sm md:text-base leading-relaxed shrink-0 flex flex-col cursor-pointer",
                  btnClass
                )}
              >
                {optImage && <img src={optImage} alt="" className="w-full max-h-28 object-contain rounded-lg mb-2" />}
                <div className="flex justify-between items-center">
                  {displayText && <span><RichTextInline>{displayText}</RichTextInline></span>}
                  {icon && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                      {icon}
                    </motion.div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {!isFlipped && (
          <button type="submit" disabled={selectedMultiOptions.size === 0} className="w-full mt-4 bg-brand-primary hover:bg-white text-black py-4 rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
            Submit Answer
          </button>
        )}
      </form>
      {isFlipped && !isTestMode && currentCard?.explanation && !isAllCorrect && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-4 rounded-2xl bg-white/5 border border-white/10 text-left w-full"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted block mb-1.5">Why</span>
          <div className="text-sm text-white/70 leading-relaxed"><RichText>{currentCard.explanation}</RichText></div>
        </motion.div>
      )}
      <CommunityQASection
        show={showAskButton}
        isTestMode={isTestMode}
        cardAnswers={cardAnswers}
        cardQuestion={cardQuestion}
        questionJustAsked={questionJustAsked}
        onViewQuestion={onViewQuestion}
        onAskQuestion={onAskQuestion}
        renderAcceptPrompt={renderAcceptPrompt}
      />
    </div>
  );
}
