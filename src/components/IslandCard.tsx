import { motion } from 'motion/react';
import { Check, CloudDownload, CloudOff, Navigation2 } from 'lucide-react';
import { cn, formatTimeUntil } from '../lib/utils';
import { useLongPress } from '../hooks/useLongPress';
import LightboxImage from './LightboxImage';

interface IslandCardProps {
  island: any;
  masteryLevel: 'charting' | 'sailing' | 'mastered';
  islandImageSrc: string;
  trackingMode?: string;
  graceWindowMinutes?: number;
  onClick: () => void;
  key?: string | number;
  isPinned?: boolean;
  isOnline?: boolean;
  onPinToggle?: (e: { stopPropagation: () => void }) => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onLongPress?: () => void;
  onSelect?: () => void;
  onMoveIsland?: (e: React.MouseEvent) => void;
}

export default function IslandCard({ island, masteryLevel, islandImageSrc, trackingMode, graceWindowMinutes = 0, onClick, isPinned = false, isOnline = true, onPinToggle, isSelectMode = false, isSelected = false, onLongPress, onSelect, onMoveIsland }: IslandCardProps) {
  const getMasteryStyles = () => {
    switch (masteryLevel) {
      case 'charting':
        return 'bg-gradient-to-br from-gray-900 to-purple-900/20 border-gray-800 hover:border-purple-500/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.25)]';
      case 'sailing':
        return 'bg-gradient-to-br from-gray-900 to-blue-900/20 border-gray-800 hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.25)]';
      case 'mastered':
        return 'bg-gradient-to-br from-gray-900 to-emerald-900/20 border-gray-800 hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.25)]';
      default:
        return 'glass hover:border-brand-primary/30';
    }
  };

  const getStatusDescription = () => {
    if (trackingMode === 'srs') {
      const cardGraceMs = graceWindowMinutes * 60_000;
      const nextDueTs = (island.cards || []).reduce((min: number, c: any) => {
        if (c.srsNextReview && c.srsNextReview > Date.now() + cardGraceMs) return Math.min(min, c.srsNextReview);
        return min;
      }, Infinity);
      switch (masteryLevel) {
        case 'charting': return "Cards due — some are overdue for review.";
        case 'sailing': return isFinite(nextDueTs) ? `Coming up — next due ${formatTimeUntil(nextDueTs)}.` : "Coming up — cards due soon.";
        case 'mastered': return "All caught up — nothing due for over a week!";
        default: return "";
      }
    }
    switch (masteryLevel) {
      case 'charting':
        return "Charting Island — you have some items in the charting category.";
      case 'sailing':
        return "Sailing Island — you're making progress with these cards.";
      case 'mastered':
        return "Mastered Island — well done, you've mastered this set!";
      default:
        return "";
    }
  };

  const isOfflineUnavailable = !isOnline && !isPinned;
  const longPressHandlers = useLongPress(onLongPress ?? (() => {}));

  return (
    <motion.div
      layoutId={island.id}
      {...(!isSelectMode && !isOfflineUnavailable ? longPressHandlers : {})}
      onClick={isOfflineUnavailable ? undefined : isSelectMode ? onSelect : onClick}
      className={cn(
        "rounded-[32px] p-6 flex flex-row items-center gap-6 transition-all duration-300 relative border h-40",
        isOfflineUnavailable
          ? "opacity-40 cursor-not-allowed border-white/5 bg-white/[0.02]"
          : cn("cursor-pointer group hover:-translate-y-1", getMasteryStyles()),
        isSelected && "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0a0a0a]"
      )}
    >
      {isSelectMode && (
        <div className={cn(
          "absolute top-3 left-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all z-10",
          isSelected ? "bg-emerald-500 border-emerald-500" : "border-white/40 bg-black/30"
        )}>
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
      )}

      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)] relative bg-black/40 flex items-center justify-center shrink-0 border-brand-border">
        <LightboxImage
          src={islandImageSrc}
          className="w-[130%] h-[130%] object-cover transition-transform duration-500 group-hover:scale-125"
          containerClassName="w-full h-full"
        />
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-lg font-bold text-white truncate group-hover:whitespace-normal transition-all duration-300" title={island.name}>
            {island.name}
          </h3>
          {island.isCollaborative && (
            <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-[9px] font-black uppercase tracking-widest">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Crew
            </span>
          )}
        </div>
        <p className="text-brand-muted text-xs uppercase tracking-[0.15em] font-medium mb-1">
          {island.cards?.length || 0} Core Cards
        </p>
        <p className="text-[10px] text-brand-muted/70 italic leading-tight group-hover:text-brand-muted transition-colors">
          {isOfflineUnavailable ? 'Not available offline — pin to study without internet' : getStatusDescription()}
        </p>
      </div>

      {onPinToggle && !isSelectMode && (
        <button
          onClick={onPinToggle}
          title={isPinned ? 'Remove from offline' : 'Save for offline study'}
          className={cn(
            "absolute top-3 right-3 p-1.5 rounded-xl border transition-all",
            isPinned
              ? "text-brand-primary border-brand-primary/30 bg-brand-primary/10 hover:bg-brand-primary/20"
              : "text-brand-muted/40 border-transparent hover:text-brand-muted hover:border-white/10 hover:bg-white/5"
          )}
        >
          {isPinned ? <CloudDownload className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
        </button>
      )}

      {onMoveIsland && !isSelectMode && (
        <button
          onClick={onMoveIsland}
          title="Move to another archipelago"
          className="absolute bottom-3 right-3 p-1.5 rounded-xl border transition-all text-brand-muted/40 border-transparent hover:text-brand-muted hover:border-white/10 hover:bg-white/5"
        >
          <Navigation2 className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
}
