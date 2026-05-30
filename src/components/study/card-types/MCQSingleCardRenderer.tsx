import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, ZoomIn } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { RichText, RichTextInline } from '../../RichText';
import { Card } from '../../../hooks/useUserProgress';
import type { Answer, Question } from '../../../hooks/useQuestions';
import CommunityQASection from './CommunityQASection';

interface MCQSingleCardRendererProps {
  isFlipped: boolean;
  isTestMode: boolean;
  currentCard: Card;
  shuffledOptions: string[];
  shuffledOptionImages: (string | null)[];
  selectedOption: string | null;
  mcqZoomSrc: string | null;
  showHint: boolean;
  showAskButton: boolean;
  cardAnswers: Answer[];
  cardQuestion: Question | null;
  questionJustAsked: boolean;
  onOptionSelect: (opt: string, e: React.MouseEvent) => void;
  onSetMcqZoomSrc: (src: string | null) => void;
  onSetShowHint: (v: boolean) => void;
  onViewQuestion?: () => void;
  onAskQuestion: () => void;
  renderAcceptPrompt: () => React.ReactNode;
}

export default function MCQSingleCardRenderer({
  isFlipped, isTestMode, currentCard, shuffledOptions, shuffledOptionImages,
  selectedOption, mcqZoomSrc, showHint, showAskButton, cardAnswers, cardQuestion,
  questionJustAsked, onOptionSelect, onSetMcqZoomSrc, onSetShowHint,
  onViewQuestion, onAskQuestion, renderAcceptPrompt,
}: MCQSingleCardRendererProps) {
  return (
    <div className="w-full flex-1 flex flex-col justify-center pb-4">
      {createPortal(
        <AnimatePresence>
          {mcqZoomSrc && (
            <motion.div
              key="mcq-zoom"
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
      <div className={cn(
        shuffledOptionImages.some(Boolean) ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3"
      )}>
        {shuffledOptions.map((opt, idx) => {
          const hasImages = shuffledOptionImages.some(Boolean);
          let btnClass = "bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white";
          let statusText: string | null = null;

          if (selectedOption) {
            if (isTestMode) {
              btnClass = opt === selectedOption ? "bg-white/15 border-white/30 text-white" : "bg-white/5 border-transparent text-brand-muted/30 opacity-40";
            } else if (opt === currentCard?.back) {
              btnClass = "bg-emerald-500/10 border-emerald-500/50 text-white";
              statusText = "Correct answer";
            } else if (opt === selectedOption) {
              btnClass = "bg-red-500/10 border-red-500/50 text-white";
              statusText = "Not quite";
            } else {
              btnClass = "bg-white/5 border-transparent text-brand-muted/30 opacity-40";
            }
          }

          const letter = String.fromCharCode(65 + idx);
          const optImage = shuffledOptionImages[idx] ?? null;
          const displayText = opt.startsWith('__img_') && opt.endsWith('__') ? '' : opt;

          return (
            <div key={idx} className="relative flex flex-col group/opt">
              <motion.button
                layout
                whileHover={!selectedOption ? { scale: 1.02 } : {}}
                whileTap={!selectedOption ? { scale: 0.98 } : {}}
                onClick={(e: any) => onOptionSelect(opt, e)}
                disabled={selectedOption !== null}
                className={cn(
                  "w-full rounded-xl transition-colors flex flex-col overflow-hidden",
                  hasImages ? "border" : "text-left px-4 py-3 sm:px-5 sm:py-4",
                  btnClass
                )}
              >
                {hasImages ? (
                  <>
                    <div className="w-full aspect-[4/3] overflow-hidden flex items-center justify-center">
                      {optImage
                        ? <img src={optImage} alt="" className="w-full h-full object-contain" />
                        : <span className="font-medium text-sm leading-snug px-4 text-center"><RichTextInline>{displayText}</RichTextInline></span>
                      }
                    </div>
                    <div className={cn("px-3 py-2 flex items-center gap-2", optImage && displayText ? "border-t border-white/5" : optImage ? "" : "hidden")}>
                      <span className="text-xs font-bold text-white/50 shrink-0">{letter}.</span>
                      {optImage && displayText && <span className="text-xs leading-snug"><RichTextInline>{displayText}</RichTextInline></span>}
                    </div>
                  </>
                ) : (
                  <>
                    {optImage && <img src={optImage} alt="" className="w-full max-h-28 object-contain rounded-lg mb-2" />}
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="font-bold text-white/70 shrink-0">{letter}.</span>
                        {displayText && <span className="font-medium text-xs sm:text-sm md:text-base leading-relaxed flex-1">
                          <RichTextInline>{displayText}</RichTextInline>
                        </span>}
                      </div>
                    </div>
                  </>
                )}
                <AnimatePresence>
                  {selectedOption && !isTestMode && (opt === currentCard?.back || opt === selectedOption) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className={cn("overflow-hidden px-3", hasImages ? "mt-0" : "mt-2 pl-8 sm:pl-9")}
                    >
                      <div className="flex items-center gap-2 mb-1.5 mt-2">
                        <div className={cn(
                          "w-4 h-4 flex items-center justify-center rounded-full",
                          opt === currentCard?.back ? "bg-emerald-500/20" : "bg-red-500/20"
                        )}>
                          {opt === currentCard?.back ?
                            <Check className="w-2.5 h-2.5 text-emerald-500" /> :
                            <X className="w-2.5 h-2.5 text-red-500" />
                          }
                        </div>
                        <span className={cn(
                          "text-[11px] sm:text-xs font-bold uppercase tracking-wider",
                          opt === currentCard?.back ? "text-emerald-500" : "text-red-400"
                        )}>
                          {statusText}
                        </span>
                      </div>
                      {currentCard?.explanations?.[opt] && (
                        <div className="text-[13px] sm:text-[14px] text-white/70 leading-relaxed mb-2 pr-4">
                          <RichText>{currentCard.explanations[opt]}</RichText>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
              {hasImages && optImage && (
                <button
                  type="button"
                  aria-label="Zoom image"
                  onClick={(e) => { e.stopPropagation(); onSetMcqZoomSrc(optImage); }}
                  className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/80 text-white rounded-full p-1.5 transition-all opacity-40 group-hover/opt:opacity-100 focus:opacity-100"
                >
                  <ZoomIn className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {currentCard?.hint && (
        <div className="w-full mt-2 flex flex-col items-center">
          {!showHint ? (
            <button
              onClick={(e) => { e.stopPropagation(); onSetShowHint(true); }}
              className="text-[10px] sm:text-xs text-brand-muted hover:text-white transition-colors uppercase tracking-[0.2em] font-bold px-4 py-2 border border-brand-muted/20 rounded-lg hover:bg-white/5"
            >
              Show Hint
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs sm:text-sm text-amber-200 bg-amber-500/10 p-4 rounded-xl border border-amber-500/20 text-left w-full mx-auto shadow-inner"
            >
              <span className="font-bold uppercase tracking-widest text-[10px] mb-1.5 block text-amber-500">Hint</span>
              <RichText>{currentCard.hint}</RichText>
            </motion.div>
          )}
        </div>
      )}
      {selectedOption && !isTestMode && currentCard?.explanation && (
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
