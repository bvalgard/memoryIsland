import { motion } from 'motion/react';
import { X, Flame, CheckCircle2 } from 'lucide-react';
import { CardUpdateRecord } from '../../hooks/useUserProgress';
import { SessionMeta } from '../../achievements';

interface StrugglingCard {
  name: string;
  islandName?: string;
}

interface SessionCompleteProps {
  accuracyPct: number;
  cardsReviewed: number;
  correctAnswers: number;
  incorrectAnswers: number;
  scoreDelta: number;
  sessionMaxStreak: number;
  isNewRecord: boolean;
  dueCardsCleared: number;
  dueCardFrontsAtStartSize: number;
  mode: string;
  islandName: string;
  archipelagoName?: string;
  strugglingCards: StrugglingCard[];
  cardUpdates: CardUpdateRecord;
  maxStreak: number;
  meta: SessionMeta;
  onFinish: (scoreDelta: number, cardUpdates: CardUpdateRecord, maxStreak: number, meta: SessionMeta) => void;
  onStartWrongDrill: () => void;
}

export default function SessionComplete({
  accuracyPct, cardsReviewed, correctAnswers, incorrectAnswers, scoreDelta,
  sessionMaxStreak, isNewRecord, dueCardsCleared, dueCardFrontsAtStartSize, mode,
  islandName, archipelagoName, strugglingCards, cardUpdates, maxStreak, meta,
  onFinish, onStartWrongDrill,
}: SessionCompleteProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md mx-auto w-full text-center"
    >
      {/* 3-col stat grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/20 border-b-2 border-b-emerald-500/40">
          <div className="text-3xl font-black text-emerald-400 mb-1">{accuracyPct}%</div>
          <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-500/80">Accuracy</div>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 border-b-2 border-b-white/20">
          <div className="text-3xl font-black text-white mb-1">{cardsReviewed}</div>
          <div className="text-[10px] font-bold tracking-widest uppercase text-brand-muted">Reviewed</div>
        </div>
        <div className="bg-brand-primary/5 rounded-2xl p-4 border border-brand-primary/20 border-b-2 border-b-brand-primary/40">
          <div className="text-3xl font-black text-brand-primary mb-1">+{scoreDelta}</div>
          <div className="text-[10px] font-bold tracking-widest uppercase text-brand-primary/80">Score</div>
        </div>
      </div>

      {/* Streak / correct / incorrect strip */}
      <div className="flex gap-2 justify-center mb-4">
        <span className={`text-xs font-semibold px-3 py-1 rounded-full border flex items-center gap-1 ${sessionMaxStreak >= 3 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-white/5 text-brand-muted border-white/10'}`}>
          <Flame className="w-3 h-3" />
          {sessionMaxStreak} streak
          {isNewRecord && <span className="text-[9px] font-bold tracking-widest uppercase ml-0.5">· Record!</span>}
        </span>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          ✓ {correctAnswers} correct
        </span>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
          ✕ {incorrectAnswers} incorrect
        </span>
      </div>

      {/* Due cards cleared indicator */}
      {dueCardFrontsAtStartSize > 0 ? (
        <div className="mb-4 text-xs text-sky-400/80 flex items-center justify-center gap-1.5">
          <span>🗓️</span>
          <span>
            {dueCardsCleared > 0
              ? `${dueCardsCleared} overdue card${dueCardsCleared !== 1 ? 's' : ''} rescheduled — due count will drop`
              : `No overdue cards in this session — due count unchanged`}
          </span>
        </div>
      ) : mode !== 'due' ? (
        <div className="mb-4 text-xs text-brand-muted/50 flex items-center justify-center gap-1.5">
          <span>🗓️</span>
          <span>No cards were overdue — due count unchanged</span>
        </div>
      ) : null}

      {/* Cards to revisit */}
      {strugglingCards.length > 0 && (
        <div className="border-l-2 border-red-500/50 pl-3 mb-6 text-left">
          <div className="text-[10px] font-bold tracking-widest uppercase text-red-400 mb-2">Cards to revisit</div>
          <div className="flex flex-col gap-1">
            {strugglingCards.slice(0, 5).map((card, i) => {
              const archLabel = archipelagoName ?? (card.islandName ? islandName : undefined);
              const islandLabel = card.islandName ?? (archipelagoName ? islandName : undefined);
              const locationLabel = archLabel && islandLabel ? `${archLabel} → ${islandLabel}` : islandName;
              return (
                <div key={i} className="flex items-start gap-1.5">
                  <X className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="text-sm text-brand-muted leading-tight">{card.name}</span>
                    <span className="text-[10px] text-brand-muted/50">{locationLabel}</span>
                  </div>
                </div>
              );
            })}
            {strugglingCards.length > 5 && (
              <div className="text-xs text-brand-muted pl-4.5">+ {strugglingCards.length - 5} more</div>
            )}
          </div>
        </div>
      )}

      {incorrectAnswers > 0 && (
        <button
          onClick={onStartWrongDrill}
          className="w-full h-12 text-base mb-3 rounded-2xl font-semibold border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
        >
          Reel in {incorrectAnswers} missed card{incorrectAnswers !== 1 ? 's' : ''}
        </button>
      )}

      <button
        onClick={() => onFinish(scoreDelta, cardUpdates, maxStreak, meta)}
        className="w-full btn-primary h-16 text-lg mb-4"
      >
        Return to Map
      </button>

      <div className="flex items-center justify-center gap-2 text-brand-muted/60">
        <CheckCircle2 className="w-4 h-4 text-brand-primary/60" />
        <span className="text-sm font-medium">Session Complete</span>
        <span className="text-brand-muted/30">·</span>
        <span className="text-sm">{islandName}</span>
      </div>
    </motion.div>
  );
}
