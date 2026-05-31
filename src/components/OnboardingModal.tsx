import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Layers, Sparkles, Compass } from 'lucide-react';

interface OnboardingModalProps {
  onClose: () => void;
  onCreateIsland: () => void;
  onDiscover: () => void;
}

const STEPS = [
  {
    label: 'Step 1 of 3',
    icon: Layers,
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
    title: 'The Island Way',
    description:
      'Each Island is a study deck. Cards travel through three stages — Struggling, Learning, and Mastered — using spaced repetition to show you the right card at exactly the right moment.',
  },
  {
    label: 'Step 2 of 3',
    icon: Sparkles,
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    title: 'AI Card Generation',
    description:
      'Paste your notes and let AI turn them into flashcards, multiple choice, and fill-in-the-blank questions in seconds. Less time formatting, more time actually learning.',
  },
  {
    label: 'Step 3 of 3',
    icon: Compass,
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    title: 'Discover & Connect',
    description:
      'Browse public Islands from the community, share your own knowledge, and study alongside friends. Learning is better together.',
  },
] as const;

export default function OnboardingModal({ onClose, onCreateIsland, onDiscover }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const StepIcon = current.icon;

  const dismiss = () => {
    localStorage.setItem('mi_onboarding_seen', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={dismiss}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md bg-[#111] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden"
      >
        <button
          onClick={dismiss}
          className="absolute top-5 right-5 z-10 text-white/40 hover:text-white transition-colors"
          aria-label="Skip onboarding"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-8 pt-10 pb-8 min-h-[320px] flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex flex-col flex-1"
            >
              <div className={`w-20 h-20 rounded-[24px] flex items-center justify-center mb-6 ${current.iconBg}`}>
                <StepIcon className={`w-9 h-9 ${current.iconColor}`} />
              </div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">{current.label}</p>
              <h2 className="text-2xl font-bold text-white mb-3 leading-tight">{current.title}</h2>
              <p className="text-sm text-white/60 leading-relaxed">{current.description}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="px-8 pb-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`rounded-full transition-all ${
                  i === step ? 'w-4 h-2 bg-white' : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          {isLast ? (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { localStorage.setItem('mi_onboarding_seen', 'true'); onCreateIsland(); }}
                className="btn-primary w-full"
              >
                Create my first Island
              </button>
              <button
                onClick={() => { localStorage.setItem('mi_onboarding_seen', 'true'); onDiscover(); }}
                className="w-full h-[56px] rounded-[14px] bg-white/10 hover:bg-white/15 text-white font-bold transition-all active:scale-95"
              >
                Browse Community
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              {step > 0 ? (
                <button
                  onClick={() => setStep(s => s - 1)}
                  className="text-sm text-white/40 hover:text-white transition-colors font-medium"
                >
                  ← Back
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={() => setStep(s => s + 1)}
                className="btn-primary !h-auto px-6 py-3"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
