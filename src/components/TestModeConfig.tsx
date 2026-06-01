import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronDown, ChevronRight, Clock, Anchor, Shuffle, AlignJustify, Tag } from 'lucide-react';
import { Island, Archipelago, Card } from '../hooks/useUserProgress';
import { TestConfig, CardType, ALL_CARD_TYPES, buildTestDeck } from '../hooks/useTestMode';
import { cn } from '../lib/utils';

const TYPE_LABELS: Record<CardType, string> = {
  mcq: 'Multiple Choice',
  'multi-select': 'Multi-Select',
  sequencing: 'Sequencing',
  'fill-in-the-blank': 'Fill in the Blank',
  matching: 'Matching',
  flashcard: 'Flashcard',
  hotspot: 'Hotspot Image',
};

const PER_Q_OPTIONS = [
  { label: '30s', value: 30 },
  { label: '1 min', value: 60 },
  { label: '90s', value: 90 },
  { label: '2 min', value: 120 },
];

interface Props {
  islands: Island[];
  archipelagos: Archipelago[];
  existingTestNames: string[];
  onStart: (config: TestConfig, cards: Card[], name: string) => void;
  onClose: () => void;
}

export default function TestModeConfig({
  islands, archipelagos,
  existingTestNames,
  onStart, onClose,
}: Props) {

  const [selectedIslandIds, setSelectedIslandIds] = useState<Set<string>>(new Set());
  const [questionLimitMode, setQuestionLimitMode] = useState<'custom' | 'all'>('custom');
  const [questionLimitValue, setQuestionLimitValue] = useState<string>('25');
  const [questionTypes, setQuestionTypes] = useState<Set<CardType>>(new Set(ALL_CARD_TYPES));
  const [timeLimitMode, setTimeLimitMode] = useState<'none' | 'per-question' | 'total'>('none');
  const [perQSeconds, setPerQSeconds] = useState(60);
  const [totalMinutes, setTotalMinutes] = useState<string>('30');
  const [questionOrder, setQuestionOrder] = useState<'shuffled' | 'sequential'>('shuffled');
  const [expandedArchs, setExpandedArchs] = useState<Set<string>>(new Set());
  const [testNameInput, setTestNameInput] = useState('');

  const totalMinutesNum = parseInt(totalMinutes);
  const totalMinutesValid = !isNaN(totalMinutesNum) && totalMinutesNum >= 1 && totalMinutesNum <= 460;

  const grouped = useMemo(() => {
    const map = new Map<string, { arch: Archipelago | null; islands: Island[] }>();
    map.set('__none__', { arch: null, islands: [] });
    for (const arch of archipelagos) map.set(arch.id, { arch, islands: [] });
    for (const island of islands) {
      const key = island.archipelagoId ?? '__none__';
      const entry = map.get(key) ?? { arch: null, islands: [] };
      entry.islands.push(island);
      map.set(key, entry);
    }
    for (const [key, val] of map.entries()) {
      if (val.islands.length === 0) map.delete(key);
    }
    return map;
  }, [islands, archipelagos]);

  const toggleIsland = (id: string) => {
    setSelectedIslandIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleArch = (archId: string) => {
    const entry = grouped.get(archId);
    if (!entry) return;
    const allSelected = entry.islands.every(i => selectedIslandIds.has(i.id));
    setSelectedIslandIds(prev => {
      const next = new Set(prev);
      if (allSelected) entry.islands.forEach(i => next.delete(i.id));
      else entry.islands.forEach(i => next.add(i.id));
      return next;
    });
  };

  const toggleType = (type: CardType) => {
    setQuestionTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size === 1) return prev;
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Derive default name from selected islands
  const derivedDefaultName = useMemo(() => {
    const sel = islands.filter(i => selectedIslandIds.has(i.id));
    if (sel.length === 0) return 'My Test';
    if (sel.length <= 3) return sel.map(i => i.name).join(' + ');
    return `${sel.slice(0, 2).map(i => i.name).join(' + ')} + ${sel.length - 2} more`;
  }, [selectedIslandIds, islands]);

  const effectiveName = testNameInput.trim() || derivedDefaultName;
  const nameConflict = existingTestNames.includes(effectiveName);
  const resolvedName = useMemo(() => {
    const base = testNameInput.trim() || derivedDefaultName;
    if (!existingTestNames.includes(base)) return base;
    let v = 2;
    while (existingTestNames.includes(`${base} v${v}`)) v++;
    return `${base} v${v}`;
  }, [testNameInput, derivedDefaultName, existingTestNames]);

  const resolvedLimit = questionLimitMode === 'all' ? 'all' : (parseInt(questionLimitValue) || 25);

  const availableCount = useMemo(() => {
    const sel = islands.filter(i => selectedIslandIds.has(i.id));
    return buildTestDeck(
      sel.map(i => ({ island: { id: i.id, name: i.name }, cards: i.cards })),
      { islandIds: [...selectedIslandIds], questionLimit: 'all', questionTypes: [...questionTypes], timeLimitMode: 'none', questionOrder: 'shuffled' }
    ).length;
  }, [selectedIslandIds, questionTypes, islands]);

  const finalCount = resolvedLimit === 'all' ? availableCount : Math.min(availableCount, resolvedLimit as number);

  const handleStart = () => {
    const config: TestConfig = {
      islandIds: [...selectedIslandIds],
      questionLimit: resolvedLimit,
      questionTypes: [...questionTypes],
      timeLimitMode,
      ...(timeLimitMode === 'per-question' ? { timeLimitSeconds: perQSeconds } : {}),
      ...(timeLimitMode === 'total' ? { totalTimeLimitSeconds: totalMinutesNum * 60 } : {}),
      questionOrder,
    };
    const sel = islands.filter(i => selectedIslandIds.has(i.id));
    const cards = buildTestDeck(sel.map(i => ({ island: { id: i.id, name: i.name }, cards: i.cards })), config);
    onStart(config, cards, resolvedName);
  };

  const canStart = selectedIslandIds.size > 0 && questionTypes.size > 0 && availableCount > 0
    && (timeLimitMode !== 'total' || totalMinutesValid);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg bg-[#111] border border-white/10 rounded-[28px] shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-6 pb-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center">
              <Anchor className="w-4 h-4 text-brand-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Configure Your Voyage</h2>
              <p className="text-[10px] text-brand-muted uppercase tracking-widest">Exam Voyage</p>
            </div>
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* Test Name */}
          {(
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-3">Test Name</p>
              <div className={cn(
                'flex items-center gap-2 h-10 px-3 rounded-xl border transition-colors',
                nameConflict ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/10 bg-white/5 focus-within:border-brand-primary/40 focus-within:bg-brand-primary/5'
              )}>
                <Tag className="w-3.5 h-3.5 text-brand-muted shrink-0" />
                <input
                  type="text"
                  maxLength={80}
                  value={testNameInput}
                  onChange={e => setTestNameInput(e.target.value)}
                  placeholder={derivedDefaultName}
                  className="bg-transparent text-white text-sm font-bold w-full outline-none placeholder:text-brand-muted/40"
                />
              </div>
              {nameConflict ? (
                <p className="text-[10px] text-amber-400/80 mt-1.5">
                  A test named "{effectiveName}" already exists — will be saved as "{resolvedName}"
                </p>
              ) : (
                <p className="text-[10px] text-brand-muted/60 mt-1.5">
                  Will be saved as "{resolvedName}"
                </p>
              )}
            </div>
          )}

          {/* Territory */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-3">Select Territory</p>
            <div className="space-y-1">
              {[...grouped.entries()].map(([key, { arch, islands: archIslands }]) => {
                const allSelected = archIslands.every(i => selectedIslandIds.has(i.id));
                const someSelected = archIslands.some(i => selectedIslandIds.has(i.id));
                const isExpanded = expandedArchs.has(key);

                return (
                  <div key={key}>
                    {arch && (
                      <div className="flex items-center gap-2 py-1.5">
                        <button onClick={() => setExpandedArchs(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; })} className="text-brand-muted hover:text-white transition-colors">
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                          <div onClick={() => toggleArch(key)} className={cn('w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors', allSelected ? 'bg-brand-primary border-brand-primary' : someSelected ? 'bg-brand-primary/40 border-brand-primary/60' : 'border-white/20 hover:border-white/40')}>
                            {(allSelected || someSelected) && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                                <path d={allSelected ? 'M2 6l3 3 5-5' : 'M2 6h8'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span className="text-xs font-bold text-white/80">{arch.name}</span>
                          <span className="text-[10px] text-brand-muted ml-auto">{archIslands.length} islands</span>
                        </label>
                      </div>
                    )}
                    <AnimatePresence>
                      {(!arch || isExpanded) && (
                        <motion.div initial={arch ? { height: 0, opacity: 0 } : false} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className={cn('space-y-1', arch && 'pl-6')}>
                            {archIslands.map(island => (
                              <label key={island.id} className="flex items-center gap-2 py-1 cursor-pointer group">
                                <div onClick={() => toggleIsland(island.id)} className={cn('w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors shrink-0', selectedIslandIds.has(island.id) ? 'bg-brand-primary border-brand-primary' : 'border-white/20 group-hover:border-white/40')}>
                                  {selectedIslandIds.has(island.id) && (
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                                  )}
                                </div>
                                <span className="text-sm text-white/70 group-hover:text-white transition-colors flex-1">{island.name}</span>
                                <span className="text-[10px] text-brand-muted">{island.cards.length} cards</span>
                              </label>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Question Count */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-3">Question Count</p>
            <div className="flex gap-2 items-center">
              <div className={cn('flex-1 flex items-center gap-2 h-10 px-3 rounded-xl border transition-colors', questionLimitMode === 'custom' ? 'border-brand-primary/40 bg-brand-primary/5' : 'border-white/10 bg-white/5')}>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={questionLimitMode === 'custom' ? questionLimitValue : ''}
                  onChange={e => { setQuestionLimitMode('custom'); setQuestionLimitValue(e.target.value); }}
                  onFocus={() => setQuestionLimitMode('custom')}
                  placeholder="e.g. 40"
                  className="bg-transparent text-white text-sm font-bold w-full outline-none placeholder:text-brand-muted/40"
                />
                <span className="text-[10px] text-brand-muted shrink-0">questions</span>
              </div>
              <button
                onClick={() => setQuestionLimitMode('all')}
                className={cn('h-10 px-4 rounded-xl text-xs font-bold uppercase tracking-widest border transition-colors shrink-0', questionLimitMode === 'all' ? 'bg-brand-primary/10 border-brand-primary/40 text-brand-primary' : 'bg-white/5 border-white/10 text-brand-muted hover:text-white')}
              >
                All
              </button>
            </div>
          </div>

          {/* Question Types */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-3">Question Types</p>
            <div className="flex flex-wrap gap-2">
              {ALL_CARD_TYPES.map(type => (
                <button key={type} onClick={() => toggleType(type)} className={cn('px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors', questionTypes.has(type) ? 'bg-brand-primary/10 border-brand-primary/40 text-brand-primary' : 'bg-white/5 border-white/10 text-brand-muted hover:text-white')}>
                  {TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Question Order */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-3">Question Order</p>
            <div className="flex gap-2">
              <button
                onClick={() => setQuestionOrder('shuffled')}
                className={cn('flex-1 h-10 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-2', questionOrder === 'shuffled' ? 'bg-brand-primary/10 border-brand-primary/40 text-brand-primary' : 'bg-white/5 border-white/10 text-brand-muted hover:text-white hover:border-white/20')}
              >
                <Shuffle className="w-3.5 h-3.5" />
                Shuffled
              </button>
              <button
                onClick={() => setQuestionOrder('sequential')}
                className={cn('flex-1 h-10 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-2', questionOrder === 'sequential' ? 'bg-brand-primary/10 border-brand-primary/40 text-brand-primary' : 'bg-white/5 border-white/10 text-brand-muted hover:text-white hover:border-white/20')}
              >
                <AlignJustify className="w-3.5 h-3.5" />
                Sequential
              </button>
            </div>
          </div>

          {/* Time Limit */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-muted mb-3">Time Limit</p>
            <div className="flex gap-2 mb-3">
              {(['none', 'per-question', 'total'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setTimeLimitMode(mode)}
                  className={cn('flex-1 h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-colors', timeLimitMode === mode ? 'bg-brand-primary/10 border-brand-primary/40 text-brand-primary' : 'bg-white/5 border-white/10 text-brand-muted hover:text-white')}
                >
                  {mode === 'none' ? 'No Limit' : mode === 'per-question' ? 'Per Question' : 'Total Time'}
                </button>
              ))}
            </div>
            <AnimatePresence>
              {timeLimitMode === 'per-question' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="flex gap-2 pt-1">
                    {PER_Q_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => setPerQSeconds(opt.value)} className={cn('flex-1 h-10 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1', perQSeconds === opt.value ? 'bg-brand-primary/10 border-brand-primary/40 text-brand-primary' : 'bg-white/5 border-white/10 text-brand-muted hover:text-white hover:border-white/20')}>
                        <Clock className="w-3 h-3" />{opt.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
              {timeLimitMode === 'total' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="pt-1">
                    <div className={cn('flex items-center gap-2 h-10 px-3 rounded-xl border transition-colors', !totalMinutesValid && totalMinutes !== '' ? 'border-red-500/60 bg-red-500/5' : totalMinutesValid ? 'border-brand-primary/40 bg-brand-primary/5' : 'border-white/10 bg-white/5')}>
                      <Clock className="w-3.5 h-3.5 text-brand-muted shrink-0" />
                      <input
                        type="number"
                        min={1}
                        max={460}
                        value={totalMinutes}
                        onChange={e => setTotalMinutes(e.target.value)}
                        placeholder="e.g. 30"
                        className="bg-transparent text-white text-sm font-bold w-full outline-none placeholder:text-brand-muted/40"
                      />
                      <span className="text-[10px] text-brand-muted shrink-0">min (max 460)</span>
                    </div>
                    {!totalMinutesValid && totalMinutes !== '' && (
                      <p className="text-[10px] text-red-400 mt-1.5">Enter a number between 1 and 460 minutes</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="p-6 pt-4 border-t border-white/5 shrink-0">
          <p className="text-xs text-brand-muted mb-4">
            {availableCount > 0
              ? `${finalCount} of ${availableCount} available questions`
              : selectedIslandIds.size === 0
              ? 'Select at least one island to begin'
              : 'No cards match the selected types'}
          </p>
          <button onClick={handleStart} disabled={!canStart} className="w-full btn-primary h-12 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
            Set Sail
          </button>
        </div>
      </motion.div>
    </div>
  );
}
