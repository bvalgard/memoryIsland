import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircleQuestion, Users, Globe, X } from 'lucide-react';

interface AskQuestionModalProps {
  isOpen: boolean;
  friendCount: number;
  isSending: boolean;
  onClose: () => void;
  onSend: (visibility: 'friends' | 'global', isAnonymous: boolean) => Promise<void>;
}

export default function AskQuestionModal({ isOpen, friendCount, isSending, onClose, onSend }: AskQuestionModalProps) {
  const [anonymous, setAnonymous] = useState(false);

  // Reset anonymous toggle when modal opens so each flare starts fresh
  useEffect(() => {
    if (isOpen) setAnonymous(false);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="relative w-full max-w-sm bg-[#111] border border-white/10 rounded-[28px] p-6 shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
                <MessageCircleQuestion className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Ask the Community</h3>
                <p className="text-[11px] text-white/40">Get a memory trick from your crew</p>
              </div>
            </div>

            {/* Anonymous toggle */}
            <div className="flex items-center justify-between mb-4 p-3 rounded-2xl bg-white/5 border border-white/8">
              <div>
                <p className="text-xs font-semibold text-white">Post anonymously</p>
                <p className="text-[11px] text-white/40">Your name shows as "Anonymous Explorer"</p>
              </div>
              <button
                type="button"
                onClick={() => setAnonymous(a => !a)}
                className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${anonymous ? 'bg-orange-500' : 'bg-white/15'}`}
              >
                <span className={`absolute left-0 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${anonymous ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <button
                disabled={isSending}
                onClick={() => onSend('friends', anonymous)}
                className="flex items-center gap-4 p-4 rounded-2xl border border-white/10
                           bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all
                           text-left disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-white block">Signal the Crew</span>
                  <span className="text-[11px] text-white/40">
                    {friendCount > 0 ? `${friendCount} friend${friendCount === 1 ? '' : 's'} can help` : 'Friends only'}
                  </span>
                </div>
              </button>

              <button
                disabled={isSending}
                onClick={() => onSend('global', anonymous)}
                className="flex items-center gap-4 p-4 rounded-2xl border border-orange-500/20
                           bg-orange-500/8 hover:bg-orange-500/15 hover:border-orange-500/35 transition-all
                           text-left disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center shrink-0 group-hover:bg-orange-500/25 transition-colors">
                  <Globe className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-white block">Call the Coast Guard</span>
                  <span className="text-[11px] text-white/40">Anyone can respond</span>
                </div>
              </button>
            </div>

            {isSending && (
              <p className="text-center text-[11px] text-white/40 mt-4">Posting question…</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
