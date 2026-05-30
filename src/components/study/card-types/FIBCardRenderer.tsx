import React from 'react';
import { motion } from 'motion/react';
import { X, Check } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { RichText } from '../../RichText';
import { Card } from '../../../hooks/useUserProgress';
import type { Answer, Question } from '../../../hooks/useQuestions';
import CommunityQASection from './CommunityQASection';

interface FIBCardRendererProps {
  isFlipped: boolean;
  isTestMode: boolean;
  currentCard: Card;
  cluesUsed: number;
  revealedIndices: number[];
  fibInput: string;
  setFibInput: (s: string) => void;
  isFibCorrect: boolean | null;
  lastFibSubmitted: string | null;
  cardAnswers: Answer[];
  cardQuestion: Question | null;
  questionJustAsked: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onGetClue: () => void;
  onViewQuestion?: () => void;
  onAskQuestion: () => void;
  renderAcceptPrompt: () => React.ReactNode;
}

export default function FIBCardRenderer({
  isFlipped, isTestMode, currentCard, cluesUsed, revealedIndices,
  fibInput, setFibInput, isFibCorrect, lastFibSubmitted,
  cardAnswers, cardQuestion, questionJustAsked,
  onSubmit, onGetClue, onViewQuestion, onAskQuestion, renderAcceptPrompt,
}: FIBCardRendererProps) {
  if (!isFlipped) {
    return (
      <div className="w-full flex-1 flex flex-col justify-center items-center gap-6 pb-4 cursor-default" onClick={e => e.stopPropagation()}>
        <form onSubmit={onSubmit} className="w-full max-w-sm flex flex-col gap-4">
          {cluesUsed > 0 && currentCard?.back && (
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-3 mb-4 text-xl md:text-2xl font-mono text-brand-primary">
              {currentCard.back.split(' ').map((word, wordIndex, wordsArray) => {
                const startIndex = wordsArray.slice(0, wordIndex).join(' ').length + (wordIndex > 0 ? 1 : 0);
                return (
                  <div key={wordIndex} className="flex gap-[2px] whitespace-nowrap">
                    {word.split('').map((char, charOffset) => {
                      const globalIndex = startIndex + charOffset;
                      return (
                        <span key={charOffset} className="border-b-2 border-brand-primary pb-1 font-bold min-w-[14px] md:min-w-[18px] text-center inline-block">
                          {revealedIndices.includes(globalIndex) ? char : ' '}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
          <input
            type="text"
            value={fibInput}
            onChange={e => setFibInput(e.target.value)}
            placeholder="Type your answer..."
            className="w-full bg-white/5 border border-white/20 focus:border-brand-primary rounded-xl px-4 py-3 text-white text-center text-lg outline-none transition-colors"
            autoFocus
          />
          <div className="flex gap-2">
            {!isTestMode && (
              <button type="button" onClick={onGetClue} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl text-sm font-bold transition-colors">
                Get Clue
              </button>
            )}
            <button type="submit" className={`bg-brand-primary hover:bg-white text-black py-3 rounded-xl text-sm font-bold transition-colors ${isTestMode ? 'w-full' : 'flex-1'}`}>
              Submit
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col justify-center items-center gap-4 pb-4">
      {isFibCorrect === false && !isTestMode && (
        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 w-full max-w-sm">
          <div className="flex items-center gap-2 mb-1">
            <X className="w-4 h-4 text-red-500" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-red-500">Not quite</span>
          </div>
          <p className="text-lg font-medium text-white line-through opacity-70 mb-1">{lastFibSubmitted}</p>
        </div>
      )}
      <div className={cn(
        "flex flex-col gap-2 p-5 rounded-2xl border w-full max-w-sm",
        !isTestMode && isFibCorrect ? "bg-emerald-500/10 border-emerald-500/20" : !isTestMode ? "bg-emerald-500/5 border-emerald-500/30" : "bg-white/5 border-white/10"
      )}>
        <div className="flex items-center gap-2 mb-1">
          {!isTestMode && <Check className="w-4 h-4 text-emerald-500" />}
          <span className={cn("text-[10px] uppercase tracking-widest font-bold", isTestMode ? "text-brand-muted" : "text-emerald-500")}>
            {isTestMode ? 'Correct Answer' : (isFibCorrect ? 'Perfectly Answered' : 'Correct Answer')}
          </span>
        </div>
        <div className="text-xl sm:text-2xl font-normal text-white tracking-tight"><RichText>{currentCard?.back}</RichText></div>
      </div>
      {isFibCorrect === false && !isTestMode && currentCard?.explanation && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left w-full max-w-sm"
        >
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted block mb-1.5">Why</span>
          <div className="text-sm text-white/70 leading-relaxed"><RichText>{currentCard.explanation}</RichText></div>
        </motion.div>
      )}
      {isFibCorrect && !isTestMode && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-emerald-400 text-xs font-bold uppercase tracking-[0.2em]"
        >
          Progress +1
        </motion.div>
      )}
      <CommunityQASection
        show={isFibCorrect === false}
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
