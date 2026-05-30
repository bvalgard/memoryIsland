import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface SparkleLayerProps {
  sparkles: Array<{ id: number; x: number; y: number }>;
}

export default function SparkleLayer({ sparkles }: SparkleLayerProps) {
  return (
    <AnimatePresence>
      {sparkles.map(s => (
        <motion.div
          key={s.id}
          initial={{ opacity: 1, scale: 0, x: s.x, y: s.y }}
          animate={{
            opacity: 0,
            scale: 2,
            x: s.x + (Math.random() - 0.5) * 200,
            y: s.y + (Math.random() - 0.5) * 200
          }}
          exit={{ opacity: 0 }}
          className="fixed pointer-events-none z-[100] text-amber-400"
        >
          <Sparkles className="w-6 h-6 fill-current" />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
