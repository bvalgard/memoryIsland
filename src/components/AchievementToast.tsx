import { useEffect } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { Achievement } from '../achievements';

interface AchievementToastProps {
  achievement: Achievement;
  onDismiss: () => void;
}

export default function AchievementToast({ achievement, onDismiss }: AchievementToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4500);
    return () => clearTimeout(timer);
  }, [achievement.id]);

  return (
    <motion.div
      key={achievement.id}
      initial={{ opacity: 0, y: 80, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2rem)] max-w-sm"
    >
      <div
        className="bg-[#111] border border-brand-primary/40 rounded-[24px] p-4 shadow-2xl flex items-center gap-4"
        style={{ boxShadow: '0 0 24px rgba(66,133,244,0.15), 0 8px 32px rgba(0,0,0,0.6)' }}
      >
        <div className="w-12 h-12 bg-brand-primary/20 rounded-[14px] flex items-center justify-center text-2xl shrink-0 select-none">
          {achievement.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-brand-primary mb-0.5">
            Achievement Unlocked
          </p>
          <p className="text-sm font-bold text-white truncate">{achievement.name}</p>
          <p className="text-xs text-brand-muted line-clamp-2 leading-relaxed">{achievement.description}</p>
        </div>
        <button
          onClick={onDismiss}
          className="text-brand-muted hover:text-white transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
