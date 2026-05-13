import { motion } from 'motion/react';
import { X, Award, Lock, Check } from 'lucide-react';
import { ACHIEVEMENTS, Achievement, AchievementCategory } from '../achievements';
import { cn } from '../lib/utils';

interface TrophyRoomProps {
  onClose: () => void;
  unlockedIds: string[];
  unlockedTimestamps?: Record<string, number>;
}

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  resilience: '⚓ Resilience',
  motivating: '🗺️ The Grind',
  quirky: '🌙 Hidden Discoveries',
};

const CATEGORY_ORDER: AchievementCategory[] = ['resilience', 'motivating', 'quirky'];

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface BadgeCardProps {
  achievement: Achievement;
  isUnlocked: boolean;
  unlockedAt?: number;
}

function BadgeCard({ achievement, isUnlocked, unlockedAt }: BadgeCardProps) {
  const isHidden = achievement.hidden && !isUnlocked;

  return (
    <motion.div
      whileHover={isUnlocked ? { scale: 1.03 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'rounded-[20px] p-4 border relative overflow-hidden flex flex-col gap-2',
        isUnlocked
          ? 'bg-brand-primary/10 border-brand-primary/30'
          : 'bg-white/3 border-white/5 opacity-40 grayscale'
      )}
      style={isUnlocked ? { boxShadow: '0 0 20px rgba(66,133,244,0.08)' } : undefined}
    >
      <div className="text-2xl select-none">{isHidden ? '❓' : achievement.icon}</div>
      <div className="flex-1">
        <p className="text-xs font-bold text-white mb-1 leading-tight">
          {isHidden ? '???' : achievement.name}
        </p>
        <p className="text-[10px] text-brand-muted leading-relaxed">
          {isHidden ? 'Hidden achievement — keep exploring.' : achievement.description}
        </p>
      </div>
      {isUnlocked && unlockedAt && (
        <p className="text-[9px] text-brand-primary/60 font-medium">
          {formatDate(unlockedAt)}
        </p>
      )}
      {isUnlocked && (
        <div className="absolute top-3 right-3">
          <Check className="w-3 h-3 text-brand-primary" />
        </div>
      )}
      {!isUnlocked && !isHidden && (
        <div className="absolute top-3 right-3">
          <Lock className="w-3 h-3 text-white/30" />
        </div>
      )}
    </motion.div>
  );
}

export default function TrophyRoom({ onClose, unlockedIds, unlockedTimestamps = {} }: TrophyRoomProps) {
  const unlockedSet = new Set(unlockedIds);
  const unlockedCount = unlockedIds.length;
  const totalCount = ACHIEVEMENTS.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-[#111] border border-white/10 rounded-[32px] shadow-2xl flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center gap-4 p-8 pb-6 shrink-0">
          <div className="w-12 h-12 bg-brand-primary/20 rounded-[18px] flex items-center justify-center">
            <Award className="w-6 h-6 text-brand-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white tracking-tight">Captain's Quarters</h2>
            <p className="text-brand-muted text-sm">
              {unlockedCount} of {totalCount} discoveries made
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-brand-muted hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-8 pb-6 shrink-0">
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(unlockedCount / totalCount) * 100}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="h-full bg-brand-primary rounded-full"
            />
          </div>
        </div>

        {/* Scrollable grid */}
        <div className="overflow-y-auto flex-1 px-8 pb-8 space-y-8">
          {CATEGORY_ORDER.map(cat => {
            const categoryAchievements = ACHIEVEMENTS.filter(a => a.category === cat);
            return (
              <div key={cat}>
                <h3 className="text-[10px] uppercase tracking-widest font-black text-brand-muted mb-4">
                  {CATEGORY_LABELS[cat]}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {categoryAchievements.map(a => {
                    const isUnlocked = unlockedSet.has(a.id);
                    const unlockedAt = unlockedTimestamps[a.id];
                    return (
                      <BadgeCard
                        key={a.id}
                        achievement={a}
                        isUnlocked={isUnlocked}
                        unlockedAt={unlockedAt}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
