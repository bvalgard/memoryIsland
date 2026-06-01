import { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, AlertCircle, Mail, ArrowLeft, Key, UserPlus } from 'lucide-react';
import { auth, googleProvider, isConfigPlaceholder } from '../firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

type AuthMode = 'social' | 'email-signin' | 'email-signup';

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('social');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (isConfigPlaceholder) {
      alert('Firebase Configuration Required: Please update /firebase-applet-config.json with your Firebase keys.');
      return;
    }
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Sign in error:', error);
      setError(error.message);
    }
  };

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    if (isConfigPlaceholder) return;
    
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'email-signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
          await updateProfile(userCredential.user, { displayName });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error('Email auth error:', error);
      let message = 'An error occurred during authentication.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = 'Invalid email or password. If you are new, please use Sign Up.';
      } else if (error.code === 'auth/email-already-in-use') {
        message = 'This email is already registered.';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg overflow-hidden">
      <div className="flex w-full min-h-screen md:min-h-0 items-center justify-center md:justify-start md:pl-[10vw] md:gap-16 lg:gap-24">

      {/* Auth card */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full h-full md:w-[375px] md:h-[667px] md:shrink-0 bg-brand-card md:rounded-[40px] md:border-8 border-[#1a1a1a] shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
      >
        {/* Background Gradients */}
        <div className="absolute top-[-100px] left-[-100px] w-[300px] h-[300px] bg-brand-primary/10 rounded-full blur-[80px]" />
        <div className="absolute bottom-[-50px] right-[-50px] w-[250px] h-[250px] bg-red-500/5 rounded-full blur-[80px]" />

        <div className="relative flex-1 flex flex-col px-8 pt-12 pb-10 z-10">
          <AnimatePresence mode="wait">
            {mode === 'social' ? (
              <motion.div
                key="social"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex-1 flex flex-col"
              >
                {/* Island Images */}
                <div className="flex gap-2 mb-8">
                  {[
                    { src: `${BASE}/struggling.jpeg`, label: 'Building' },
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
                      <span className="font-bold text-amber-500">Action Required:</span> Update <code className="bg-black/20 px-1 rounded">/firebase-applet-config.json</code> with your real Firebase keys.
                    </div>
                  </div>
                )}

                <div className="mt-auto space-y-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleGoogleSignIn}
                    className="w-full btn-primary gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.3)] opacity-100 disabled:opacity-50"
                    disabled={isConfigPlaceholder}
                  >
                    <LogIn className="w-5 h-5" />
                    <span>Get Started with Google</span>
                  </motion.button>
                  
                  {isConfigPlaceholder ? (
                    <button 
                      onClick={() => window.location.href = `${BASE}/#/dashboard`}
                      className="w-full btn-secondary text-amber-500/80 border-amber-500/20 hover:bg-amber-500/5"
                    >
                      Enter Demo Dashboard
                    </button>
                  ) : (
                    <button 
                      onClick={() => setMode('email-signin')}
                      className="w-full btn-secondary gap-3"
                    >
                      <Mail className="w-5 h-5" />
                      <span>Continue with Email</span>
                    </button>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col"
              >
                <button 
                  onClick={() => { setMode('social'); setError(null); }}
                  className="flex items-center gap-2 text-brand-muted hover:text-white transition-colors mb-8 -ml-1 text-sm font-medium"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>

                <h2 className="text-2xl font-bold mb-2">
                  {mode === 'email-signin' ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-brand-muted text-sm mb-8">
                  {mode === 'email-signin' 
                    ? 'Sign in to access your islands.' 
                    : 'Start your memory journey with any email.'}
                </p>

                <form onSubmit={handleEmailAuth} className="space-y-4">
                  {mode === 'email-signup' && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-widest font-black text-brand-muted ml-1">Display Name</label>
                      <div className="relative">
                        <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                        <input 
                          type="text"
                          required
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:border-brand-primary transition-all"
                          placeholder="What should we call you?"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest font-black text-brand-muted ml-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                      <input 
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:border-brand-primary transition-all"
                        placeholder="e.g. name@hotmail.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest font-black text-brand-muted ml-1">Password</label>
                    <div className="relative">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                      <input 
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:border-brand-primary transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex gap-2 text-red-400 text-xs font-medium bg-red-400/5 p-3 rounded-xl border border-red-400/10">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    type="submit"
                    disabled={isLoading}
                    className="w-full btn-primary py-4 mt-4 relative overflow-hidden"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
                    ) : (
                      <div className="flex items-center gap-2 justify-center">
                        {mode === 'email-signin' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                        <span>{mode === 'email-signin' ? 'Sign In' : 'Sign Up'}</span>
                      </div>
                    )}
                  </motion.button>
                </form>

                <div className="mt-8 pt-6 border-t border-white/5 text-center">
                  <p className="text-xs text-brand-muted mb-3">
                    {mode === 'email-signin' 
                      ? "New to Memory Island?" 
                      : "Already have an account?"}
                  </p>
                  <button 
                    type="button"
                    onClick={() => {
                      setMode(mode === 'email-signin' ? 'email-signup' : 'email-signin');
                      setError(null);
                    }}
                    className="text-sm font-bold text-brand-primary hover:text-brand-primary/80 transition-all hover:scale-105 active:scale-95"
                  >
                    {mode === 'email-signin' 
                      ? "Create an explorer account" 
                      : "Sign in to your account"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="text-center mt-auto pt-6 flex flex-col gap-2">
            <p className="text-[10px] text-brand-muted uppercase tracking-[0.1em] font-medium">
              Privacy &bull; Terms of Service
            </p>
          </div>
        </div>

        {/* iPhone style home indicator */}
        <div className="w-32 h-1 bg-[#333] rounded-full mx-auto mb-2 hidden md:block" />
      </motion.div>

      {/* Right panel — desktop only */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="hidden md:flex flex-col justify-center max-w-sm lg:max-w-md"
      >
        <div className="mb-10">
          <h2 className="text-4xl lg:text-5xl font-bold tracking-tight leading-tight mb-4">
            Anchor what<br />you learn.
          </h2>
          <p className="text-brand-muted text-base leading-relaxed">
            Memory Island uses spaced repetition to help knowledge stick — so you stop re-learning what you already studied.
          </p>
        </div>

        {/* Island progression display */}
        <div className="flex gap-4 mb-10">
          {[
            { src: `${BASE}/struggling.jpeg`, label: 'Building', color: 'text-red-400' },
            { src: `${BASE}/learning.jpeg`,   label: 'Learning',   color: 'text-amber-400' },
            { src: `${BASE}/mastered.jpeg`,   label: 'Mastered',   color: 'text-emerald-400' },
          ].map(({ src, label, color }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-[20px] overflow-hidden border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
                <img src={src} alt={label} className="w-full h-full object-cover" />
              </div>
              <span className={`text-[10px] uppercase tracking-widest font-bold ${color}`}>{label}</span>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {[
            'Spaced repetition that adapts to you',
            'Track mastery across every subject',
            'Study with friends on shared islands',
          ].map((item, i) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + i * 0.1, duration: 0.5 }}
              className="flex items-center gap-3 text-sm text-brand-muted"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-brand-primary shrink-0" />
              {item}
            </motion.div>
          ))}
        </div>
      </motion.div>

      </div>
    </div>
  );
}


