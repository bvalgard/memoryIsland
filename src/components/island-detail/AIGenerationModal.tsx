import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, ScanLine } from 'lucide-react';
import { Card } from '../../hooks/useUserProgress';

type AiPreviewCard = Card & { _isDuplicate?: boolean; _duplicateLocation?: string };

interface AIGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiNotes: string;
  setAiNotes: (s: string) => void;
  aiInstructions: string;
  setAiInstructions: (s: string) => void;
  aiCardCount: number;
  setAiCardCount: (n: number) => void;
  aiSelectedTypes: string[];
  setAiSelectedTypes: React.Dispatch<React.SetStateAction<string[]>>;
  aiLoading: boolean;
  aiError: string | null;
  aiRemaining: number | null;
  aiPreviewCards: AiPreviewCard[];
  setAiPreviewCards: React.Dispatch<React.SetStateAction<AiPreviewCard[]>>;
  aiSaving: boolean;
  onGenerate: () => void;
  onSave: () => void;
}

export default function AIGenerationModal({
  isOpen, onClose, aiNotes, setAiNotes, aiInstructions, setAiInstructions,
  aiCardCount, setAiCardCount, aiSelectedTypes, setAiSelectedTypes,
  aiLoading, aiError, aiRemaining, aiPreviewCards, setAiPreviewCards,
  aiSaving, onGenerate, onSave,
}: AIGenerationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
            onClick={() => { if (!aiLoading) onClose(); }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-lg glass rounded-[24px] border border-white/10 shadow-2xl flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-primary" />
                  <span className="text-sm font-bold text-white">Generate from Notes</span>
                </div>
                <div className="flex items-center gap-3">
                  {aiRemaining !== null && (
                    <span className="text-[10px] text-brand-muted/60">{aiRemaining} generations left today</span>
                  )}
                  {!aiLoading && (
                    <button onClick={onClose} className="text-brand-muted hover:text-white transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {aiPreviewCards.length === 0 ? (
                /* Input screen */
                <div className="flex flex-col gap-4 p-6">
                  <textarea
                    value={aiNotes}
                    onChange={e => setAiNotes(e.target.value)}
                    placeholder="Paste your notes, a paragraph, a textbook excerpt… AI will turn it into flashcards."
                    className="w-full h-48 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-brand-muted/40 resize-none focus:outline-none focus:border-brand-primary/40 custom-scrollbar"
                    disabled={aiLoading}
                  />
                  <textarea
                    value={aiInstructions}
                    onChange={e => setAiInstructions(e.target.value)}
                    placeholder="Special instructions (optional) — e.g. use NCLEX-style phrasing, focus on clinical application, keep answers under one sentence…"
                    className="w-full h-16 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-brand-muted/40 resize-none focus:outline-none focus:border-brand-primary/40"
                    disabled={aiLoading}
                  />

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-brand-muted uppercase tracking-widest">Card types</span>
                    <div className="flex flex-wrap gap-1.5">
                      {([
                        { value: 'mcq', label: 'Multiple Choice' },
                        { value: 'multi-select', label: 'Multi-Select' },
                        { value: 'sequencing', label: 'Ordering' },
                        { value: 'fill-in-the-blank', label: 'Fill in the Blank' },
                        { value: 'flashcard', label: 'Flashcard' },
                      ] as const).map(({ value, label }) => {
                        const on = aiSelectedTypes.includes(value);
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setAiSelectedTypes(prev =>
                              on && prev.length > 1 ? prev.filter(t => t !== value) : on ? prev : [...prev, value]
                            )}
                            className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${on ? 'bg-brand-primary/15 border-brand-primary/30 text-brand-primary' : 'bg-white/5 border-white/5 text-brand-muted/50'}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-brand-muted uppercase tracking-widest">Cards</span>
                      <div className="flex gap-1">
                        {[5, 10, 15, 20].map(n => (
                          <button
                            key={n}
                            onClick={() => setAiCardCount(n)}
                            className={`w-8 h-7 rounded-lg text-[11px] font-bold transition-colors ${aiCardCount === n ? 'bg-brand-primary text-white' : 'bg-white/5 text-brand-muted hover:bg-white/10'}`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={onGenerate}
                      disabled={aiLoading || !aiNotes.trim() || aiRemaining === 0}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {aiLoading ? (
                        <>
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                            <Sparkles className="w-3.5 h-3.5" />
                          </motion.div>
                          Generating…
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Generate
                        </>
                      )}
                    </button>
                  </div>
                  {aiError && (
                    <p className="text-xs text-red-400 text-center">{aiError}</p>
                  )}
                </div>
              ) : (
                /* Preview screen */
                <>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                    {(() => {
                      const dupCount = aiPreviewCards.filter(c => c._isDuplicate).length;
                      return (
                        <p className="text-[10px] text-brand-muted uppercase tracking-widest px-1 mb-1">
                          {aiPreviewCards.length} cards generated
                          {dupCount > 0 && <span className="text-amber-400/80"> · {dupCount} duplicate{dupCount > 1 ? 's' : ''} excluded</span>}
                          {!dupCount && ' — edit before saving'}
                        </p>
                      );
                    })()}
                    {aiPreviewCards.map((card, i) => (
                      <div key={i} className={`rounded-2xl border p-3 flex flex-col gap-2 ${card._isDuplicate ? 'bg-amber-500/5 border-amber-500/20 opacity-60' : 'bg-white/5 border-white/10'}`}>
                        {card._isDuplicate && (
                          <div className="flex items-center gap-1.5 text-[10px] text-amber-400/80">
                            <ScanLine className="w-3 h-3 shrink-0" />
                            <span>Duplicate — already in {card._duplicateLocation}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <textarea
                            value={card.front}
                            onChange={e => !card._isDuplicate && setAiPreviewCards(prev => prev.map((c, idx) => idx === i ? { ...c, front: e.target.value } : c))}
                            disabled={!!card._isDuplicate}
                            className={`flex-1 bg-transparent text-sm placeholder:text-brand-muted/40 resize-none focus:outline-none leading-relaxed ${card._isDuplicate ? 'line-through text-white/30' : 'text-white'}`}
                            rows={2}
                            placeholder="Question"
                          />
                          <span className={`shrink-0 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md ${
                            card.type === 'mcq' ? 'bg-brand-primary/15 text-brand-primary' :
                            card.type === 'multi-select' ? 'bg-purple-500/15 text-purple-400' :
                            card.type === 'sequencing' ? 'bg-amber-500/15 text-amber-400' :
                            card.type === 'fill-in-the-blank' ? 'bg-emerald-500/15 text-emerald-400' :
                            'bg-white/5 text-brand-muted/50'
                          }`}>
                            {card.type === 'mcq' ? 'MCQ' :
                             card.type === 'multi-select' ? 'Multi' :
                             card.type === 'sequencing' ? 'Order' :
                             card.type === 'fill-in-the-blank' ? 'Fill' :
                             'Flash'}
                          </span>
                        </div>
                        <div className="h-px bg-white/5" />
                        <textarea
                          value={card.back}
                          onChange={e => !card._isDuplicate && setAiPreviewCards(prev => prev.map((c, idx) => idx === i ? { ...c, back: e.target.value } : c))}
                          disabled={!!card._isDuplicate}
                          className={`w-full bg-transparent text-xs placeholder:text-brand-muted/40 resize-none focus:outline-none leading-relaxed ${card._isDuplicate ? 'line-through text-brand-muted/30' : 'text-brand-muted'}`}
                          rows={2}
                          placeholder="Answer"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="px-4 pb-4 pt-2 flex gap-2 shrink-0 border-t border-white/5">
                    <button
                      onClick={() => setAiPreviewCards([])}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-white/5 text-brand-muted hover:bg-white/10 hover:text-white transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={onSave}
                      disabled={aiSaving}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-brand-primary text-white hover:bg-brand-primary/80 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {aiSaving ? (
                        <>
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                            <Sparkles className="w-3.5 h-3.5" />
                          </motion.div>
                          Saving…
                        </>
                      ) : (
                        `Add ${aiPreviewCards.filter(c => c.front.trim() && !c._isDuplicate).length} cards`
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
