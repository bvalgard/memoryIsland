import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';

interface TestModeNavigatorProps {
  totalCards: number;
  currentViewIndex: number;
  historyResults: (boolean | null | undefined)[];
  onJump: (index: number) => void;
}

export default function TestModeNavigator({ totalCards, currentViewIndex, historyResults, onJump }: TestModeNavigatorProps) {
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the current bubble in view
  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-idx="${currentViewIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [currentViewIndex]);

  const answeredCount = historyResults.filter(r => r !== undefined && r !== null).length;

  return (
    <div className="w-full mt-4 glass rounded-2xl border border-white/10 overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted">
            Questions
          </span>
          <span className="text-[10px] font-bold text-brand-primary/70">
            {answeredCount}/{totalCards}
          </span>
        </div>
        {collapsed
          ? <ChevronUp className="w-3.5 h-3.5 text-brand-muted/50" />
          : <ChevronDown className="w-3.5 h-3.5 text-brand-muted/50" />
        }
      </button>

      {!collapsed && (
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none"
          style={{ scrollbarWidth: 'none' }}
        >
          {Array.from({ length: totalCards }, (_, i) => {
            const result = historyResults[i];
            const isCurrent = i === currentViewIndex;
            const isAnswered = result !== undefined && result !== null;

            return (
              <button
                key={i}
                data-idx={i}
                onClick={() => onJump(i)}
                className={cn(
                  "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all border",
                  isCurrent
                    ? "bg-brand-primary text-black border-brand-primary shadow-[0_0_12px_rgba(255,255,255,0.2)]"
                    : isAnswered
                    ? "bg-white/15 border-white/25 text-white"
                    : "bg-transparent border-white/15 text-brand-muted/50"
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
