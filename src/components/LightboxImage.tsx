import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface LightboxImageProps {
  src: string;
  className?: string;
  containerClassName?: string;
}

export default function LightboxImage({ src, className, containerClassName }: LightboxImageProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <div
        className={`relative cursor-zoom-in${containerClassName ? ` ${containerClassName}` : ''}`}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      >
        <img src={src} alt="" className={className} />
      </div>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-lg p-6"
              onClick={() => setOpen(false)}
            >
              <motion.img
                src={src}
                alt=""
                initial={{ scale: 0.82, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.82, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28, delay: 0.05 }}
                onClick={() => setOpen(false)}
                className="absolute top-5 right-5 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-full p-2.5 transition-colors"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
