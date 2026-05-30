import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useLongPress } from '../hooks/useLongPress';
import LightboxImage from './LightboxImage';

interface ArchipelagoCardProps {
  archipelago: { id: string; name: string; isCollaborative?: boolean };
  islandCount: number;
  totalCards: number;
  masteryLevel: 'struggling' | 'learning' | 'mastered';
  imageSrc: string;
  onClick: () => void;
  onLongPress?: () => void;
}

export default function ArchipelagoCard({ archipelago, islandCount, totalCards, masteryLevel, imageSrc, onClick, onLongPress }: ArchipelagoCardProps) {
  const longPressHandlers = useLongPress(onLongPress ?? (() => {}));

  const getMasteryStyles = () => {
    switch (masteryLevel) {
      case 'struggling':
        return 'bg-gradient-to-br from-gray-900 to-purple-900/20 border-gray-800 hover:border-purple-500/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.25)]';
      case 'learning':
        return 'bg-gradient-to-br from-gray-900 to-blue-900/20 border-gray-800 hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.25)]';
      case 'mastered':
        return 'bg-gradient-to-br from-gray-900 to-emerald-900/20 border-gray-800 hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.25)]';
    }
  };

  const getStatusDescription = () => {
    switch (masteryLevel) {
      case 'struggling': return 'Some islands need attention — struggling cards detected.';
      case 'learning': return 'Making progress — keep studying to advance.';
      case 'mastered': return 'Outstanding — all islands fully mastered!';
    }
  };

  return (
    <motion.div
      layoutId={archipelago.id}
      {...longPressHandlers}
      onClick={onClick}
      className={cn(
        'rounded-[32px] p-6 flex flex-row items-center gap-6 transition-all duration-300 relative border h-40 cursor-pointer group hover:-translate-y-1',
        getMasteryStyles()
      )}
    >
      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)] relative bg-black/40 flex items-center justify-center shrink-0 border-brand-border">
        <LightboxImage
          src={imageSrc}
          className="w-[130%] h-[130%] object-cover transition-transform duration-500 group-hover:scale-125"
          containerClassName="w-full h-full"
        />
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-lg font-bold text-white truncate group-hover:whitespace-normal transition-all duration-300" title={archipelago.name}>
            {archipelago.name}
          </h3>
          {archipelago.isCollaborative && (
            <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-[9px] font-black uppercase tracking-widest">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Crew
            </span>
          )}
        </div>
        <p className="text-brand-muted text-xs uppercase tracking-[0.15em] font-medium mb-1">
          {islandCount} {islandCount === 1 ? 'Island' : 'Islands'} · {totalCards} Cards
        </p>
        <p className="text-[10px] text-brand-muted/70 italic leading-tight group-hover:text-brand-muted transition-colors">
          {getStatusDescription()}
        </p>
      </div>
    </motion.div>
  );
}
