import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircleQuestion, Users, Globe, X, Flame } from 'lucide-react';

interface AskQuestionModalProps {
  isOpen: boolean;
  friendCount: number;
  isSending: boolean;
  onClose: () => void;
  onSend: (visibility: 'friends' | 'global', isAnonymous: boolean) => Promise<void>;
}

export default function AskQuestionModal({ isOpen, friendCount, isSending, onClose, onSend }: AskQuestionModalProps) {
  const [anonymous, setAnonymous] = useState(false);
  const [visibility, setVisibility] = useState<'friends' | 'global'>('global');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAnonymous(false);
      setVisibility('global');
    }
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

            {/* Audience selector */}
            <div className="flex flex-col gap-3 mb-4">
              <button
                type="button"
                onClick={() => setVisibility('friends')}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group ${
                  visibility === 'friends'
                    ? 'border-blue-500/50 bg-blue-500/12'
                    : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
                  visibility === 'friends'
                    ? 'bg-blue-500/25 border-blue-500/40'
                    : 'bg-blue-500/15 border-blue-500/25 group-hover:bg-blue-500/20'
                }`}>
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
                type="button"
                onClick={() => setVisibility('global')}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group ${
                  visibility === 'global'
                    ? 'border-orange-500/50 bg-orange-500/12'
                    : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
                  visibility === 'global'
                    ? 'bg-orange-500/25 border-orange-500/40'
                    : 'bg-orange-500/15 border-orange-500/25 group-hover:bg-orange-500/25'
                }`}>
                  <Globe className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-white block">Call the Coast Guard</span>
                  <span className="text-[11px] text-white/40">Anyone can respond</span>
                </div>
              </button>
            </div>

            {/* Submit button */}
            <button
              disabled={isSending}
              onClick={() => onSend(visibility, anonymous)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl
                         bg-orange-500 hover:bg-orange-400 active:bg-orange-600
                         text-white font-semibold text-sm transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Flame className="w-4 h-4" />
              {isSending ? 'Sending Flare…' : 'Fire Flare'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
