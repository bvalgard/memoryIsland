import React from 'react';
import { motion } from 'motion/react';
import { X, Check, Zap, TrendingDown, Flame } from 'lucide-react';
import { RichText } from '../../RichText';
import LightboxImage from '../../LightboxImage';
import OfflineImageNotice from '../OfflineImageNotice';
import { Card, UserSettings } from '../../../hooks/useUserProgress';
import type { Answer, Question } from '../../../hooks/useQuestions';

interface FlashcardPostFlipProps {
  currentCard: Card;
  isTestMode: boolean;
  isOnline: boolean;
  settings: UserSettings | undefined;
  writtenRecallText: string;
  cardAnswers: Answer[];
  cardQuestion: Question | null;
  questionJustAsked: boolean;
  onGrade: (isCorrect: boolean, e: React.MouseEvent) => void;
  onEasy: (e: React.MouseEvent) => void;
  onHard: () => void;
  onViewQuestion?: () => void;
  onAskQuestion: () => void;
  renderAcceptPrompt: () => React.ReactNode;
}

export default function FlashcardPostFlip({
  currentCard, isTestMode, isOnline, settings, writtenRecallText,
  cardAnswers, cardQuestion, questionJustAsked,
  onGrade, onEasy, onHard, onViewQuestion, onAskQuestion, renderAcceptPrompt,
}: FlashcardPostFlipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full mt-6 pt-6 border-t border-white/10 flex flex-col items-center gap-4"
      onClick={e => e.stopPropagation()}
    >
      {currentCard?.backImageUrl && (
        <div className="w-full">
          {isOnline ? (
            <>
              <LightboxImage
                src={currentCard.backImageUrl}
                className="w-full max-h-48 object-contain rounded-xl"
              />
              {currentCard.backImageCredit && (
                <p className="text-[10px] text-brand-muted/70 italic mt-1 text-center">
                  {currentCard.backImageCredit}
                </p>
              )}
            </>
          ) : (
            <OfflineImageNotice />
          )}
        </div>
      )}
      <h2 className="text-xl sm:text-2xl md:text-3xl font-normal leading-snug tracking-tight text-white">
        <RichText>{currentCard?.back}</RichText>
      </h2>
      {(settings?.writtenRecallMode || isTestMode) && (
        <div className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-left">
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted block mb-1.5">Your recall</span>
          {writtenRecallText.trim() ? (
            <p className="text-sm text-white/70 leading-relaxed italic whitespace-pre-wrap">{writtenRecallText.trim()}</p>
          ) : (
            <p className="text-sm text-brand-muted/40 leading-relaxed">Nothing written</p>
          )}
        </div>
      )}
      {!isTestMode && currentCard?.explanation && (
        <div className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-left">
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted block mb-1.5">Why</span>
          <div className="text-sm text-white/70 leading-relaxed"><RichText>{currentCard.explanation}</RichText></div>
        </div>
      )}
      {!isTestMode && cardAnswers.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          {cardAnswers.map((answer, i) => (
            <motion.div
              key={answer.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 text-left"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400 block mb-1">Crew tip from {answer.helperName}</span>
              <div className="text-sm text-white/70"><RichText>{answer.bodyText}</RichText></div>
            </motion.div>
          ))}
          {renderAcceptPrompt()}
        </div>
      )}
      <div className="w-full pt-4 border-t border-white/5">
        <p className="text-[9px] uppercase tracking-[0.2em] text-brand-muted/50 font-bold mb-3">
          Did you get it correct?
        </p>
        <div className={`grid gap-2 ${isTestMode ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <button
            onClick={(e) => { e.stopPropagation(); onGrade(false, e); }}
            className="bg-white/5 border border-white/5 hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400 text-brand-muted h-12 rounded-xl flex items-center justify-center gap-1.5 transition-all"
          >
            <X className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">No</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onGrade(true, e); }}
            className="bg-white/5 border border-white/5 hover:bg-emerald-500/15 hover:border-emerald-500/30 hover:text-emerald-400 text-white h-12 rounded-xl flex items-center justify-center gap-1.5 transition-all"
          >
            <Check className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Yes</span>
          </button>
          {!isTestMode && (
            <div className="flex flex-col gap-1.5">
              <button
                onClick={(e) => { e.stopPropagation(); onEasy(e); }}
                className="bg-white/5 border border-white/5 hover:bg-yellow-500/15 hover:border-yellow-500/30 hover:text-yellow-400 text-brand-muted h-12 rounded-xl flex items-center justify-center gap-1.5 transition-all"
                title="This is pretty easy; show me less frequently"
              >
                <Zap className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Easy</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onHard(); }}
                className="bg-white/5 border border-white/5 hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400 text-brand-muted h-10 rounded-xl flex items-center justify-center gap-1.5 transition-all"
                title="This was tough — show me sooner"
              >
                <TrendingDown className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Hard</span>
              </button>
            </div>
          )}
        </div>
        {!isTestMode && (!questionJustAsked ? (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            onClick={() => cardQuestion && onViewQuestion ? onViewQuestion() : onAskQuestion()}
            className="w-full mt-3 flex items-center justify-center gap-2 text-orange-400/50 hover:text-orange-400 transition-colors text-[10px] font-bold uppercase tracking-widest py-2"
          >
            <Flame className="w-3 h-3" /> {cardQuestion ? 'View Community Thread' : 'Ask the Community'}
          </motion.button>
        ) : (
          <p className="text-center text-[10px] text-orange-400/50 font-bold uppercase tracking-widest mt-3">🔥 Question posted!</p>
        ))}
      </div>
    </motion.div>
  );
}
