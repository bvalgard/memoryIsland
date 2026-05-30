import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';
import { RichTextInline } from '../../RichText';

interface MatchingItem {
  id: string;
  text: string;
  image?: string;
  matchId?: string;
}

interface MatchingCardRendererProps {
  matchingLefts: MatchingItem[];
  matchingRights: MatchingItem[];
  matchedLeftIds: Set<string>;
  matchedRightIds: Set<string>;
  matchingErrors: Set<string>;
  selectedLeft: string | null;
  selectedRight: string | null;
  onSelect: (side: 'left' | 'right', id: string, e: React.MouseEvent) => void;
}

export default function MatchingCardRenderer({
  matchingLefts, matchingRights, matchedLeftIds, matchedRightIds,
  matchingErrors, selectedLeft, selectedRight, onSelect,
}: MatchingCardRendererProps) {
  return (
    <div className="w-full flex-1 flex flex-col md:flex-row gap-4 mt-2 sm:mt-6 pb-4">
      <div className="flex-1 flex flex-col gap-2 relative">
        <h3 className="text-[10px] uppercase font-bold text-brand-muted tracking-widest mb-1 text-left hidden md:block">Terms</h3>
        {matchingLefts.map((left) => {
          const isMatched = matchedLeftIds.has(left.id);
          const isSelected = selectedLeft === left.id;
          const isError = matchingErrors.has(left.id);
          return (
            <motion.button
              key={left.id}
              layout="position"
              onClick={(e) => onSelect('left', left.id, e)}
              className={cn(
                "text-left px-4 py-3 rounded-xl transition-all font-medium text-xs sm:text-sm",
                isSelected ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-[1.02]" :
                  isError ? "bg-red-500/20 text-red-500 border border-red-500/50" :
                    "bg-white/5 border border-white/10 hover:bg-white/10 text-white/80"
              )}
            >
              {left.image && <img src={left.image} alt="" className="w-full max-h-20 object-contain rounded-lg mb-1.5" />}
              {left.text && <RichTextInline>{left.text}</RichTextInline>}
            </motion.button>
          );
        })}
      </div>
      <div className="flex-1 flex flex-col gap-2 relative mt-4 md:mt-0">
        <h3 className="text-[10px] uppercase font-bold text-brand-muted tracking-widest mb-1 text-left hidden md:block">Matches</h3>
        {matchingRights.map((right) => {
          const isMatched = matchedRightIds.has(right.id);
          const isSelected = selectedRight === right.id;
          const isError = matchingErrors.has(right.id);
          return (
            <motion.button
              key={right.id}
              layout="position"
              disabled={isMatched}
              onClick={(e) => onSelect('right', right.id, e)}
              className={cn(
                "text-left px-4 py-3 rounded-xl transition-all font-medium text-xs sm:text-sm",
                isMatched ? "bg-emerald-500/10 text-emerald-500/60 border border-emerald-500/20" :
                  isSelected ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-[1.02]" :
                    isError ? "bg-red-500/20 text-red-500 border border-red-500/50" :
                      "bg-white/5 border border-white/10 hover:bg-white/10 text-white/80"
              )}
            >
              {right.image && <img src={right.image} alt="" className={cn("w-full max-h-20 object-contain rounded-lg mb-1.5", isMatched && "opacity-40")} />}
              {right.text && <span className={cn(isMatched && "line-through decoration-emerald-500/30")}><RichTextInline>{right.text}</RichTextInline></span>}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
