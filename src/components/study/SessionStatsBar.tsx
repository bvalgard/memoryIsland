import { motion } from 'motion/react';
import { Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SessionStatsBarProps {
  streak: number;
  liveCorrect: number;
  liveIncorrect: number;
  isNewRecord: boolean;
  sessionStats: { mastered: number; sailing: number; charting: number };
}

export default function SessionStatsBar({ streak, liveCorrect, liveIncorrect, isNewRecord, sessionStats }: SessionStatsBarProps) {
  return (
    <div className="w-full mt-12 px-4 md:px-0">
      <div className="mx-auto grid gap-2 md:gap-4 pointer-events-auto max-w-xl grid-cols-3">
        {/* Streak Counter */}
        <motion.div
          animate={isNewRecord ? {
            scale: [1, 1.06, 1],
            backgroundColor: 'rgba(234, 179, 8, 0.28)',
            boxShadow: ['0 0 8px rgba(234, 179, 8, 0.3)', '0 0 28px rgba(234, 179, 8, 0.75)', '0 0 8px rgba(234, 179, 8, 0.3)'],
          } : {
            scale: streak > 0 ? [1, 1.1, 1] : 1,
            backgroundColor: streak >= 3 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            boxShadow: '0 0 0px rgba(0,0,0,0)'
          }}
          transition={isNewRecord ? { duration: 0.5, repeat: Infinity, repeatType: 'loop' } : { duration: 0.3 }}
          className={cn(
            "rounded-2xl p-2 md:p-4 border shadow-2xl backdrop-blur-md flex flex-col items-center justify-center gap-1",
            isNewRecord ? "border-amber-400/70" : streak >= 3 ? "border-amber-500/30" : "border-white/10"
          )}
        >
          <div className="flex items-center gap-1.5 md:gap-2">
            <motion.div
              animate={isNewRecord ? { scale: [1, 1.5, 0.8, 1.4, 1] } : {}}
              transition={isNewRecord ? { duration: 0.5, repeat: Infinity } : {}}
            >
              <Zap className={cn("w-3 h-3 md:w-4 md:h-4", isNewRecord || streak >= 3 ? "text-amber-400 fill-amber-400" : "text-brand-muted")} />
            </motion.div>
            <span className="text-xs md:text-sm font-black text-white">{streak}</span>
          </div>
          <span className={cn(
            "text-[7px] md:text-[10px] font-bold uppercase tracking-widest text-center leading-none",
            isNewRecord ? "text-amber-400" : "text-brand-muted"
          )}>
            {isNewRecord ? "New Record!" : "Streak"}
          </span>
        </motion.div>

        {/* Correct */}
        <div className="bg-emerald-500/10 rounded-2xl p-2 md:p-4 border border-emerald-500/20 backdrop-blur-md flex flex-col items-center justify-center gap-1">
          <motion.span
            key={sessionStats.mastered + sessionStats.sailing}
            initial={{ scale: 1.5, color: '#10b981' }}
            animate={{ scale: 1, color: '#ffffff' }}
            className="text-xs md:text-sm font-black"
          >
            {liveCorrect}
          </motion.span>
          <span className="text-[7px] md:text-[10px] font-bold uppercase tracking-widest text-emerald-500/80 text-center leading-none">Correct</span>
        </div>

        {/* Incorrect */}
        <div className="bg-red-500/10 rounded-2xl p-2 md:p-4 border border-red-500/20 backdrop-blur-md flex flex-col items-center justify-center gap-1">
          <motion.span
            key={sessionStats.charting}
            initial={{ scale: 1.5, color: '#ef4444' }}
            animate={{ scale: 1, color: '#ffffff' }}
            className="text-xs md:text-sm font-black"
          >
            {liveIncorrect}
          </motion.span>
          <span className="text-[7px] md:text-[10px] font-bold uppercase tracking-widest text-red-500/80 text-center leading-none">Incorrect</span>
        </div>
      </div>
    </div>
  );
}
