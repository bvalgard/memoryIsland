import React from 'react';
import { motion } from 'motion/react';
import { Flame } from 'lucide-react';
import { RichText } from '../../RichText';
import type { Question, Answer } from '../../../hooks/useQuestions';

interface CommunityQASectionProps {
  show: boolean;
  isTestMode: boolean;
  cardAnswers: Answer[];
  cardQuestion: Question | null;
  questionJustAsked: boolean;
  onViewQuestion?: () => void;
  onAskQuestion: () => void;
  renderAcceptPrompt: () => React.ReactNode;
}

export default function CommunityQASection({
  show, isTestMode, cardAnswers, cardQuestion, questionJustAsked,
  onViewQuestion, onAskQuestion, renderAcceptPrompt,
}: CommunityQASectionProps) {
  if (isTestMode || !show) return null;

  return (
    <>
      {cardAnswers.length > 0 && (
        <div className="flex flex-col gap-2 w-full mt-2">
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
      {!questionJustAsked && (
        <motion.button
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => cardQuestion && onViewQuestion ? onViewQuestion() : onAskQuestion()}
          className="w-full mt-2 flex items-center justify-center gap-2 border border-orange-500/25 bg-orange-500/8 text-orange-400 hover:bg-orange-500/15 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
        >
          <Flame className="w-3.5 h-3.5" /> {cardQuestion ? 'View Community Thread' : 'Ask the Community'}
        </motion.button>
      )}
      {questionJustAsked && (
        <p className="text-center text-[10px] text-orange-400/60 font-bold uppercase tracking-widest mt-2">🔥 Question posted!</p>
      )}
    </>
  );
}
