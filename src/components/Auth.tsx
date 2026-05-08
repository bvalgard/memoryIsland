import { motion } from 'motion/react';
import { LogIn, AlertCircle } from 'lucide-react';
import { auth, googleProvider, isConfigPlaceholder } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function Auth() {
  const handleSignIn = async () => {
    if (isConfigPlaceholder) {
      alert('Firebase Configuration Required: Please update /firebase-applet-config.json with your Firebase keys.');
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg md:p-12 overflow-hidden">
      {/* Mobile Frame Container */}
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full h-full md:w-[375px] md:h-[667px] bg-brand-card md:rounded-[40px] md:border-8 border-[#1a1a1a] shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
      >
        {/* Background Gradients */}
        <div className="absolute top-[-100px] left-[-100px] w-[300px] h-[300px] bg-brand-primary/10 rounded-full blur-[80px]" />
        <div className="absolute bottom-[-50px] right-[-50px] w-[250px] h-[250px] bg-red-500/5 rounded-full blur-[80px]" />

        <div className="relative flex-1 flex flex-col px-8 pt-12 pb-10 z-10">
          {/* Island Images */}
          <div className="flex gap-2 mb-8">
            {[
              { src: `${BASE}/struggling.jpeg`, label: 'Struggling' },
              { src: `${BASE}/learning.jpeg`,   label: 'Learning'   },
              { src: `${BASE}/mastered.jpeg`,   label: 'Mastered'   },
            ].map(({ src, label }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="w-16 h-16 rounded-[16px] overflow-hidden border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.4)] shrink-0"
              >
                <img src={src} alt={label} className="w-full h-full object-cover" />
              </motion.div>
            ))}
          </div>

          <div className="mb-12">
            <h1 className="text-[32px] font-bold tracking-tight mb-2 leading-tight">
              Start Your Journey.
            </h1>
            <p className="text-brand-muted text-base leading-relaxed">
              Anchor your knowledge in Memory Islands and stop the decay of what you learn.
            </p>
          </div>

          {isConfigPlaceholder && (
            <div className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-200/80 leading-relaxed">
                <span className="font-bold text-amber-500">Action Required:</span> Update <code className="bg-black/20 px-1 rounded">/firebase-applet-config.json</code> with your real Firebase keys to enable Google Sign-in.
              </div>
            </div>
          )}

          <div className="mt-auto space-y-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSignIn}
              className="w-full btn-primary gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.3)] opacity-100 disabled:opacity-50"
              disabled={isConfigPlaceholder}
            >
              <LogIn className="w-5 h-5" />
              <span>Get Started with Google</span>
            </motion.button>
            
            {isConfigPlaceholder ? (
              <button 
                onClick={() => window.location.href = '/dashboard'}
                className="w-full btn-secondary text-amber-500/80 border-amber-500/20 hover:bg-amber-500/5"
              >
                Enter Demo Dashboard
              </button>
            ) : (
              <button className="w-full btn-secondary">
                Continue with Email
              </button>
            )}
          </div>

          <div className="text-center mt-6 flex flex-col gap-2">
            <p className="text-[10px] text-brand-muted uppercase tracking-[0.1em] font-medium">
              Privacy &bull; Terms of Service
            </p>
            <p className="text-[10px] text-brand-muted/50 font-mono">
              Domain: {typeof window !== 'undefined' ? window.location.hostname : 'loading...'}
            </p>
          </div>
        </div>

        {/* iPhone style home indicator */}
        <div className="w-32 h-1 bg-[#333] rounded-full mx-auto mb-2 hidden md:block" />
      </motion.div>
    </div>
  );
}


