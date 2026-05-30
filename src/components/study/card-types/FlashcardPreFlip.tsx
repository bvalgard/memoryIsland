import React from 'react';
import { cn } from '../../../lib/utils';
import { UserSettings } from '../../../hooks/useUserProgress';

interface FlashcardPreFlipProps {
  settings: UserSettings | undefined;
  isTestMode: boolean;
  writtenRecallText: string;
  setWrittenRecallText: (s: string) => void;
  pendingConfidence: number | null;
  onReveal: (e: React.MouseEvent) => void;
  onSetConfidence: (level: number, e: React.MouseEvent) => void;
}

export default function FlashcardPreFlip({
  settings, isTestMode, writtenRecallText, setWrittenRecallText,
  pendingConfidence, onReveal, onSetConfidence,
}: FlashcardPreFlipProps) {
  if (settings?.writtenRecallMode || isTestMode) {
    return (
      <div className="w-full mt-4 pt-5 border-t border-white/5" onClick={e => e.stopPropagation()}>
        <p className="text-[9px] uppercase tracking-[0.2em] text-brand-muted/50 font-bold mb-3">
          Write your answer from memory
        </p>
        <textarea
          value={writtenRecallText}
          onChange={e => setWrittenRecallText(e.target.value)}
          placeholder="Type your answer…"
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-brand-muted/40 resize-none focus:outline-none focus:border-white/20"
        />
        <button
          onClick={(e) => { e.stopPropagation(); onReveal(e); }}
          disabled={writtenRecallText.trim().length === 0}
          className={cn(
            "mt-3 w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
            writtenRecallText.trim().length > 0
              ? "bg-brand-primary text-white"
              : "bg-white/5 text-brand-muted/30 cursor-not-allowed"
          )}
        >
          Reveal Answer
        </button>
      </div>
    );
  }

  return (
    <div className="w-full mt-4 pt-5 border-t border-white/5" onClick={e => e.stopPropagation()}>
      <p className="text-[9px] uppercase tracking-[0.2em] text-brand-muted/50 font-bold mb-3">
        Rate your confidence
      </p>
      <div className="grid grid-cols-3 gap-2">
        {([
          { level: 1, label: 'Not Confident', active: 'bg-red-500/15 border-red-500/30 text-red-400', hover: 'hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400' },
          { level: 2, label: 'Somewhat Confident', active: 'bg-amber-500/15 border-amber-500/30 text-amber-400', hover: 'hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-400' },
          { level: 3, label: 'Confident', active: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400', hover: 'hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400' },
        ] as const).map(({ level, label, active, hover }) => (
          <button
            key={level}
            onClick={(e) => { e.stopPropagation(); onSetConfidence(level, e); }}
            className={cn(
              "border h-12 rounded-xl flex items-center justify-center transition-all",
              pendingConfidence === level
                ? active
                : cn("bg-white/5 border-white/5 text-brand-muted", hover)
            )}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest leading-none">{label}</span>
          </button>
        ))}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onReveal(e); }}
        className="mt-3 w-full text-center text-brand-muted/25 hover:text-brand-muted/50 text-[9px] uppercase tracking-[0.2em] transition-colors"
      >
        Reveal →
      </button>
    </div>
  );
}
