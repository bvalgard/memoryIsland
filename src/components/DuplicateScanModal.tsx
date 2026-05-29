import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, ScanLine, BookOpen } from 'lucide-react';
import { Island } from '../hooks/useUserProgress';
import { findAllDuplicateGroups } from '../lib/duplicateDetection';

interface DuplicateScanModalProps {
  islands: Island[];
  scope: 'island' | 'archipelago' | 'global';
  onClose: () => void;
  onDeleteCard: (cardId: string, islandId: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  mcq: 'MCQ',
  'multi-select': 'Multi',
  sequencing: 'Order',
  'fill-in-the-blank': 'Fill',
  flashcard: 'Flash',
  matching: 'Match',
  hotspot: 'Hotspot',
};

const TYPE_COLORS: Record<string, string> = {
  mcq: 'bg-brand-primary/15 text-brand-primary',
  'multi-select': 'bg-purple-500/15 text-purple-400',
  sequencing: 'bg-amber-500/15 text-amber-400',
  'fill-in-the-blank': 'bg-emerald-500/15 text-emerald-400',
  flashcard: 'bg-white/5 text-white/50',
  matching: 'bg-sky-500/15 text-sky-400',
  hotspot: 'bg-rose-500/15 text-rose-400',
};

const STATUS_COLORS: Record<string, string> = {
  mastered: 'text-emerald-400',
  learning: 'text-brand-primary',
  struggling: 'text-amber-400',
};

export default function DuplicateScanModal({ islands, scope, onClose, onDeleteCard }: DuplicateScanModalProps) {
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const groups = useMemo(() => findAllDuplicateGroups(islands), [islands]);

  const scopeLabel = scope === 'island' ? 'this island' : scope === 'archipelago' ? 'this archipelago' : 'your entire library';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-0 z-[110] flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="pointer-events-auto w-full max-w-lg bg-[#111] border border-white/10 rounded-[28px] shadow-2xl flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <ScanLine className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Duplicate Scanner</h3>
                <p className="text-[10px] text-white/40">Scanning {scopeLabel}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <ScanLine className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-sm font-bold text-white">No duplicates found</p>
                <p className="text-xs text-white/40">All cards in {scopeLabel} have unique fronts.</p>
              </div>
            ) : (
              <>
                <p className="text-[10px] text-white/40 uppercase tracking-widest px-1">
                  {groups.length} duplicate {groups.length === 1 ? 'group' : 'groups'} found — keep at least one copy
                </p>
                {groups.map(group => (
                  <div key={group.key} className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden">
                    {/* Group header */}
                    <div className="flex items-start gap-2.5 px-4 py-3 border-b border-white/5">
                      <span className={`shrink-0 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md mt-0.5 ${TYPE_COLORS[group.type] ?? 'bg-white/5 text-white/50'}`}>
                        {TYPE_LABELS[group.type] ?? group.type}
                      </span>
                      <p className="text-sm text-white leading-snug line-clamp-2">{group.front}</p>
                    </div>

                    {/* Copies */}
                    <div className="divide-y divide-white/5">
                      {group.cards.map((card, idx) => {
                        const deleteKey = `${group.key}::${card.id}`;
                        const isLast = group.cards.filter(c => deletingKey !== `${group.key}::${c.id}`).length <= 1;
                        return (
                          <div key={card.id ?? idx} className="flex items-center gap-3 px-4 py-2.5">
                            <BookOpen className="w-3.5 h-3.5 text-white/20 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-white/70 truncate">{card.islandName}</p>
                              {card.status && (
                                <p className={`text-[10px] capitalize ${STATUS_COLORS[card.status] ?? 'text-white/30'}`}>
                                  {card.status}
                                </p>
                              )}
                            </div>
                            <button
                              disabled={isLast || !card.id}
                              onClick={() => {
                                if (!card.id) return;
                                setDeletingKey(deleteKey);
                                onDeleteCard(card.id, card.islandId);
                              }}
                              title={isLast ? 'Keep at least one copy' : 'Delete this copy'}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed text-white/30 hover:text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/5 shrink-0">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
