import { motion, AnimatePresence } from 'motion/react';
import { X, Settings, ScanLine, Archive } from 'lucide-react';
import { UserSettings } from '../../../hooks/useUserProgress';
import { cn } from '../../../lib/utils';

type SortOrder = 'alpha-asc' | 'alpha-desc' | 'creation' | 'next-due' | 'most-struggling';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sortOrder: SortOrder;
  setSortOrder: (v: SortOrder) => void;
  trackingMode: 'srs' | 'status' | 'both';
  settings: UserSettings | undefined;
  onUpdateSettings: (updates: Partial<UserSettings>) => void;
  onOpenDuplicateScan: () => void;
  onOpenArchive: () => void;
}

export default function SettingsPanel({
  isOpen, onClose, sortOrder, setSortOrder, trackingMode, settings,
  onUpdateSettings, onOpenDuplicateScan, onOpenArchive,
}: SettingsPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
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
            className="relative w-full max-w-md bg-[#111] border border-white/10 rounded-[32px] p-8 shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 text-brand-muted hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Settings</h2>
            <p className="text-brand-muted text-sm leading-relaxed mb-8">
              Configure your learning environment and account preferences.
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div>
                  <p className="text-sm font-bold text-white mb-1">Island Sorting</p>
                  <p className="text-xs text-brand-muted">Choose how your islands are ordered.</p>
                </div>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                  className="bg-[#222] border border-white/10 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-brand-primary"
                >
                  <option value="alpha-asc">A to Z</option>
                  <option value="alpha-desc">Z to A</option>
                  <option value="creation">Creation Date</option>
                  <option value="next-due">Next Due</option>
                  <option value="most-struggling">Most Struggling</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div>
                  <p className="text-sm font-bold text-white mb-1">Public Ranking</p>
                  <p className="text-xs text-brand-muted">Show up on the global leaderboard.</p>
                </div>
                <button
                  onClick={() => onUpdateSettings({ showOnGlobalLeaderboard: !(settings?.showOnGlobalLeaderboard ?? true) })}
                  className={cn(
                    "w-10 h-6 rounded-full relative transition-colors",
                    (settings?.showOnGlobalLeaderboard ?? true) ? "bg-brand-primary" : "bg-white/10"
                  )}
                >
                  <motion.div
                    animate={{ x: (settings?.showOnGlobalLeaderboard ?? true) ? 16 : 4 }}
                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                  />
                </button>
              </div>

              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="mb-3">
                  <p className="text-sm font-bold text-white mb-1">Progress Tracking</p>
                  <p className="text-xs text-brand-muted">Choose which system shows in the UI. Both always track silently.</p>
                </div>
                <div className="flex bg-black/30 rounded-xl p-1 border border-white/10 gap-1">
                  {(['srs', 'status', 'both'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => onUpdateSettings({ progressTrackingMode: mode })}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors",
                        trackingMode === mode
                          ? "bg-brand-primary text-white shadow-sm"
                          : "text-brand-muted hover:text-white"
                      )}
                    >
                      {mode === 'srs' ? 'Spaced Rep' : mode === 'status' ? 'Mastery' : 'Both'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="mb-3">
                  <p className="text-sm font-bold text-white mb-1">Session Display</p>
                  <p className="text-xs text-brand-muted">Focused hides all stats. Stats shows streak, correct, and incorrect.</p>
                </div>
                <div className="flex bg-black/30 rounded-xl p-1 border border-white/10 gap-1">
                  {(['focused', 'stats'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => onUpdateSettings({ sessionDisplay: mode })}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors",
                        (settings?.sessionDisplay ?? 'stats') === mode
                          ? "bg-brand-primary text-white shadow-sm"
                          : "text-brand-muted hover:text-white"
                      )}
                    >
                      {mode === 'focused' ? 'Focused' : 'Stats'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div>
                  <p className="text-sm font-bold text-white mb-1">Written Recall</p>
                  <p className="text-xs text-brand-muted">Type your answer before flipping flashcards.</p>
                </div>
                <button
                  onClick={() => onUpdateSettings({ writtenRecallMode: !(settings?.writtenRecallMode ?? false) })}
                  className={cn(
                    "w-10 h-6 rounded-full relative transition-colors",
                    (settings?.writtenRecallMode ?? false) ? "bg-brand-primary" : "bg-white/10"
                  )}
                >
                  <motion.div
                    animate={{ x: (settings?.writtenRecallMode ?? false) ? 16 : 4 }}
                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                  />
                </button>
              </div>

              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="mb-3">
                  <p className="text-sm font-bold text-white mb-1">Study Grace Window</p>
                  <p className="text-xs text-brand-muted">Cards due within this window will be included in your session.</p>
                </div>
                <div className="flex bg-black/30 rounded-xl p-1 border border-white/10 gap-1">
                  {([0, 15, 30, 60, 120] as const).map((mins) => (
                    <button
                      key={mins}
                      onClick={() => onUpdateSettings({ graceWindowMinutes: mins })}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors",
                        (settings?.graceWindowMinutes ?? 0) === mins
                          ? "bg-brand-primary text-white shadow-sm"
                          : "text-brand-muted hover:text-white"
                      )}
                    >
                      {mins === 0 ? 'Off' : mins < 60 ? `${mins}m` : `${mins / 60}h`}
                    </button>
                  ))}
                </div>
              </div>


              <p className="text-xs uppercase tracking-widest text-brand-muted/60 font-bold pt-2">Library Tools</p>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <ScanLine className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-white mb-1">Duplicate Scanner</p>
                    <p className="text-xs text-brand-muted">Find and remove duplicate cards</p>
                  </div>
                </div>
                <button
                  onClick={onOpenDuplicateScan}
                  className="text-xs uppercase tracking-wider font-bold text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Scan
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <Archive className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-white mb-1">Archive</p>
                    <p className="text-xs text-brand-muted">View and restore archived cards</p>
                  </div>
                </div>
                <button
                  onClick={onOpenArchive}
                  className="text-xs uppercase tracking-wider font-bold text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Open
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
