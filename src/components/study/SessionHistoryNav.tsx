import { ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SessionHistoryNavProps {
  viewIndex: number;
  currentIndex: number;
  isViewingHistory: boolean;
  isTestMode: boolean;
  shuffledCardsLength: number;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
  onBackToCurrent: () => void;
}

export default function SessionHistoryNav({
  viewIndex, currentIndex, isViewingHistory, isTestMode,
  shuffledCardsLength, onPrev, onNext, onSkip, onBackToCurrent,
}: SessionHistoryNavProps) {
  return (
    <div className="flex items-center justify-between w-full mt-5 px-1">
      <button
        onClick={onPrev}
        disabled={viewIndex === 0}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
          viewIndex === 0 ? "opacity-25 cursor-not-allowed border-white/5 text-brand-muted" : "glass border-white/10 text-white hover:border-white/20 hover:bg-white/5"
        )}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        <span>Prev</span>
      </button>

      {isViewingHistory ? (
        <button
          onClick={onBackToCurrent}
          className="text-[9px] uppercase tracking-widest font-bold text-amber-400/80 hover:text-amber-400 transition-colors flex items-center gap-1"
        >
          <span>Back to current</span>
        </button>
      ) : !isTestMode ? (
        <button
          onClick={onSkip}
          className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-bold text-brand-muted/40 hover:text-brand-muted/70 transition-colors"
        >
          <SkipForward className="w-3 h-3" />
          <span>Skip</span>
        </button>
      ) : (
        <span className="text-[9px] uppercase tracking-widest font-bold text-brand-muted/30">
          {currentIndex + 1} / {shuffledCardsLength}
        </span>
      )}

      <div className="relative group/next">
        <button
          onClick={onNext}
          disabled={!isTestMode && viewIndex >= currentIndex}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
            !isTestMode && viewIndex >= currentIndex ? "opacity-25 cursor-not-allowed border-white/5 text-brand-muted" : "glass border-white/10 text-white hover:border-white/20 hover:bg-white/5"
          )}
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        {!isTestMode && viewIndex >= currentIndex && (
          <div className="absolute bottom-full right-0 mb-2 w-44 px-3 py-2 rounded-xl bg-brand-surface border border-white/10 text-[10px] text-brand-muted leading-snug shadow-lg pointer-events-none opacity-0 group-hover/next:opacity-100 transition-opacity duration-150 z-50">
            Answer this card first, or use Skip to move on.
            <div className="absolute top-full right-3 border-4 border-transparent border-t-white/10" />
          </div>
        )}
      </div>
    </div>
  );
}
