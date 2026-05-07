import { useState } from 'react';
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface NewIslandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, archipelagoId: string | null) => void;
  archipelagos: { id: string; name: string }[];
  defaultArchipelagoId: string | null;
}

export default function NewIslandModal({ isOpen, onClose, onSubmit, archipelagos, defaultArchipelagoId }: NewIslandModalProps) {
  const [name, setName] = useState('');
  const [selectedArchipelagoId, setSelectedArchipelagoId] = useState<string | null>(defaultArchipelagoId);

  // Update selected if default changes when reopened
  React.useEffect(() => {
    if (isOpen) {
      setSelectedArchipelagoId(defaultArchipelagoId);
      setName('');
    }
  }, [isOpen, defaultArchipelagoId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim(), selectedArchipelagoId);
      setName('');
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-brand-card border border-brand-border rounded-[32px] overflow-hidden"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold tracking-tight">Create New Island</h3>
                <button type="button" onClick={onClose} className="text-brand-muted hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-3">
                    Subject Name
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Quantum Physics"
                    className="w-full mb-4 bg-white/5 border border-brand-border rounded-2xl px-5 py-4 text-white outline-none focus:border-brand-primary/50 transition-colors"
                  />
                  
                  <label className="block text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-3 mt-4">
                    Archipelago (Collection)
                  </label>
                  <select
                    value={selectedArchipelagoId || ''}
                    onChange={(e) => setSelectedArchipelagoId(e.target.value || null)}
                    className="w-full bg-white/5 border border-brand-border rounded-2xl px-5 py-4 text-white outline-none focus:border-brand-primary/50 transition-colors appearance-none"
                  >
                    <option value="">None (All Islands)</option>
                    {archipelagos.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={!name.trim()}
                  className="w-full btn-primary h-14 disabled:opacity-50"
                >
                  Anchor Island
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
