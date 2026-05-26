import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, Check, AlertCircle, Package } from 'lucide-react';
import { parseAnkiFile, AnkiDeck } from '../lib/parseAnki';
import { cn } from '../lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  archipelagos: { id: string; name: string }[];
  onImport: (
    decks: AnkiDeck[],
    selectedIds: Set<string>,
    existingArchipelagoId: string | null,
    newArchipelagoName: string | null
  ) => Promise<{ islandsCreated: number; cardsCreated: number }>;
}

type Phase = 'idle' | 'parsing' | 'configuring' | 'importing' | 'done' | 'error';

export default function AnkiImportModal({ isOpen, onClose, archipelagos, onImport }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [fileName, setFileName] = useState('');
  const [decks, setDecks] = useState<AnkiDeck[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [archOption, setArchOption] = useState<'new' | 'existing' | 'none'>('new');
  const [selectedArchId, setSelectedArchId] = useState<string>('');
  const [newArchName, setNewArchName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<{ islandsCreated: number; cardsCreated: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPhase('idle');
    setFileName('');
    setDecks([]);
    setSelectedIds(new Set());
    setArchOption('new');
    setSelectedArchId('');
    setNewArchName('');
    setResult(null);
    setErrorMsg('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.apkg')) {
      setErrorMsg('Please select an Anki .apkg file.');
      setPhase('error');
      return;
    }
    setFileName(file.name);
    setPhase('parsing');
    try {
      const parsed = await parseAnkiFile(file);
      if (parsed.length === 0) {
        setErrorMsg('No card decks found in this file.');
        setPhase('error');
        return;
      }
      setDecks(parsed);
      setSelectedIds(new Set(parsed.map(d => d.id)));
      setNewArchName(file.name.replace(/\.apkg$/i, ''));
      if (archipelagos.length > 0) {
        setSelectedArchId(archipelagos[0].id);
      }
      setPhase('configuring');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Failed to read the .apkg file. It may be corrupt or an unsupported format.');
      setPhase('error');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, []);

  const toggleDeck = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) return;
    setPhase('importing');
    try {
      const archId = archOption === 'existing' ? (selectedArchId || null) : null;
      const archName = archOption === 'new' ? (newArchName.trim() || fileName.replace(/\.apkg$/i, '')) : null;
      const res = await onImport(decks, selectedIds, archId, archName);
      setResult(res);
      setPhase('done');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Import failed. Please try again.');
      setPhase('error');
    }
  };

  const totalSelectedCards = decks
    .filter(d => selectedIds.has(d.id))
    .reduce((sum, d) => sum + d.cards.length, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-brand-card border border-brand-border rounded-[32px] overflow-hidden"
          >
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-primary/20 rounded-[18px] flex items-center justify-center shrink-0">
                    <Package className="w-6 h-6 text-brand-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">Import Anki Deck</h3>
                    <p className="text-brand-muted text-xs mt-0.5">Import flashcards from a .apkg file</p>
                  </div>
                </div>
                <button onClick={handleClose} className="text-brand-muted hover:text-white transition-colors mt-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* IDLE / DROP ZONE */}
              {phase === 'idle' && (
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'border-2 border-dashed rounded-[24px] p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all',
                    isDragging
                      ? 'border-brand-primary bg-brand-primary/10'
                      : 'border-white/15 hover:border-white/30 hover:bg-white/5'
                  )}
                >
                  <Upload className="w-8 h-8 text-brand-muted" />
                  <div className="text-center">
                    <p className="font-bold text-sm">Drop your .apkg file here</p>
                    <p className="text-brand-muted text-xs mt-1">or click to browse files</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".apkg"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                  <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-left" onClick={e => e.stopPropagation()}>
                    <span className="text-amber-400 text-xs mt-0.5 shrink-0">⚠</span>
                    <p className="text-amber-300/80 text-xs leading-relaxed">
                      In Anki: <span className="font-bold text-amber-300">check "Support older Anki versions"</span> when exporting. The newer format is not yet supported.
                    </p>
                  </div>
                </div>
              )}

              {/* PARSING */}
              {phase === 'parsing' && (
                <div className="flex flex-col items-center justify-center py-14 gap-4">
                  <div className="w-10 h-10 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-bold tracking-widest uppercase text-brand-muted">Reading {fileName}...</p>
                </div>
              )}

              {/* CONFIGURING */}
              {phase === 'configuring' && (
                <div className="space-y-5">
                  <p className="text-xs text-brand-muted uppercase tracking-widest font-bold">
                    {decks.length} deck{decks.length !== 1 ? 's' : ''} found in {fileName}
                  </p>

                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                    {decks.map(deck => (
                      <button
                        key={deck.id}
                        type="button"
                        onClick={() => toggleDeck(deck.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all',
                          selectedIds.has(deck.id)
                            ? 'bg-brand-primary/10 border-brand-primary/30'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        )}
                      >
                        <div className={cn(
                          'w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all',
                          selectedIds.has(deck.id) ? 'bg-brand-primary border-brand-primary' : 'border-white/30'
                        )}>
                          {selectedIds.has(deck.id) && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span className="flex-1 text-sm font-medium truncate">{deck.name}</span>
                        <span className="text-[11px] text-brand-muted font-bold shrink-0">{deck.cards.length} cards</span>
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-3">
                      Add to Archipelago
                    </label>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setArchOption('new')}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all',
                          archOption === 'new' ? 'bg-brand-primary/10 border-brand-primary/30' : 'bg-white/5 border-white/10 hover:border-white/20'
                        )}
                      >
                        <div className={cn('w-4 h-4 rounded-full border-2 shrink-0 transition-all flex items-center justify-center', archOption === 'new' ? 'border-brand-primary' : 'border-white/30')}>
                          {archOption === 'new' && <div className="w-2 h-2 rounded-full bg-brand-primary" />}
                        </div>
                        <span className="text-sm font-medium">Create new archipelago</span>
                      </button>

                      {archOption === 'new' && (
                        <input
                          autoFocus
                          type="text"
                          value={newArchName}
                          onChange={e => setNewArchName(e.target.value)}
                          placeholder="Archipelago name"
                          className="w-full bg-white/5 border border-brand-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-brand-primary/50 transition-colors"
                        />
                      )}

                      {archipelagos.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setArchOption('existing')}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all',
                            archOption === 'existing' ? 'bg-brand-primary/10 border-brand-primary/30' : 'bg-white/5 border-white/10 hover:border-white/20'
                          )}
                        >
                          <div className={cn('w-4 h-4 rounded-full border-2 shrink-0 transition-all flex items-center justify-center', archOption === 'existing' ? 'border-brand-primary' : 'border-white/30')}>
                            {archOption === 'existing' && <div className="w-2 h-2 rounded-full bg-brand-primary" />}
                          </div>
                          <span className="text-sm font-medium">Add to existing archipelago</span>
                        </button>
                      )}

                      {archOption === 'existing' && (
                        <select
                          value={selectedArchId}
                          onChange={e => setSelectedArchId(e.target.value)}
                          className="w-full bg-white/5 border border-brand-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-brand-primary/50 transition-colors appearance-none"
                        >
                          {archipelagos.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      )}

                      <button
                        type="button"
                        onClick={() => setArchOption('none')}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all',
                          archOption === 'none' ? 'bg-brand-primary/10 border-brand-primary/30' : 'bg-white/5 border-white/10 hover:border-white/20'
                        )}
                      >
                        <div className={cn('w-4 h-4 rounded-full border-2 shrink-0 transition-all flex items-center justify-center', archOption === 'none' ? 'border-brand-primary' : 'border-white/30')}>
                          {archOption === 'none' && <div className="w-2 h-2 rounded-full bg-brand-primary" />}
                        </div>
                        <span className="text-sm font-medium">No archipelago</span>
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleImport}
                    disabled={selectedIds.size === 0}
                    className="w-full btn-primary h-14 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Import {selectedIds.size} Island{selectedIds.size !== 1 ? 's' : ''} · {totalSelectedCards} Cards
                  </button>
                </div>
              )}

              {/* IMPORTING */}
              {phase === 'importing' && (
                <div className="flex flex-col items-center justify-center py-14 gap-4">
                  <div className="w-10 h-10 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-bold tracking-widest uppercase text-brand-muted">Anchoring islands...</p>
                </div>
              )}

              {/* DONE */}
              {phase === 'done' && result && (
                <div className="flex flex-col items-center justify-center py-8 gap-6">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                    <Check className="w-8 h-8 text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold">Islands Anchored!</p>
                    <p className="text-brand-muted text-sm mt-2">
                      Imported <span className="text-white font-bold">{result.islandsCreated}</span> island{result.islandsCreated !== 1 ? 's' : ''} with{' '}
                      <span className="text-white font-bold">{result.cardsCreated}</span> cards
                    </p>
                  </div>
                  <button onClick={handleClose} className="w-full btn-primary h-14">
                    Done
                  </button>
                </div>
              )}

              {/* ERROR */}
              {phase === 'error' && (
                <div className="space-y-5">
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-200">{errorMsg}</p>
                  </div>
                  <button
                    onClick={reset}
                    className="w-full h-12 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-bold text-sm"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
