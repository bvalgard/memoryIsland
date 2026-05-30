import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, Target } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { RichText } from '../../RichText';
import { Card } from '../../../hooks/useUserProgress';
import OfflineImageNotice from '../OfflineImageNotice';

interface HotspotCardRendererProps {
  isFlipped: boolean;
  isTestMode: boolean;
  isOnline: boolean;
  currentCard: Card;
  hotspotTap: { x: number; y: number } | null;
  hotspotCorrect: boolean | null;
  hotspotImgRef: React.RefObject<HTMLImageElement | null>;
  onPointerDown: (e: React.PointerEvent<HTMLImageElement>) => void;
}

export default function HotspotCardRenderer({
  isFlipped, isTestMode, isOnline, currentCard, hotspotTap, hotspotCorrect,
  hotspotImgRef, onPointerDown,
}: HotspotCardRendererProps) {
  return (
    <div className="w-full flex-1 flex flex-col justify-center items-center gap-4 pb-4">
      {!isOnline ? (
        <OfflineImageNotice />
      ) : currentCard.imageUrl ? (
        <div className="relative w-full select-none">
          <img
            ref={hotspotImgRef}
            src={currentCard.imageUrl}
            alt=""
            draggable={false}
            className={cn(
              "w-full object-contain rounded-xl",
              !isFlipped ? "cursor-crosshair" : "cursor-default"
            )}
            onPointerDown={!isFlipped ? onPointerDown : undefined}
          />
          {/* Zone glow overlay — revealed after answer */}
          {isFlipped && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
            >
              {currentCard.hotspots?.map(zone => {
                const imgEl = hotspotImgRef.current;
                const ar = imgEl ? imgEl.clientWidth / imgEl.clientHeight : 1;
                const ry = (zone.radiusY ?? zone.radius) / ar;
                return (
                  <ellipse
                    key={zone.id}
                    cx={zone.x}
                    cy={zone.y}
                    rx={zone.radius}
                    ry={ry}
                    transform={zone.rotation ? `rotate(${zone.rotation}, ${zone.x}, ${zone.y})` : undefined}
                    fill="none"
                    stroke="#4ade80"
                    strokeWidth="0.003"
                    style={{
                      filter: 'drop-shadow(0 0 4px #4ade80) drop-shadow(0 0 10px #4ade80) drop-shadow(0 0 22px rgba(74,222,128,0.55))',
                    }}
                  />
                );
              })}
            </svg>
          )}
          {/* Tap marker */}
          {hotspotTap && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: `${hotspotTap.x * 100}%`,
                top: `${hotspotTap.y * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className={cn(
                  'relative w-4 h-4 rounded-full bg-white border-2',
                  hotspotCorrect ? 'border-green-400' : 'border-red-400'
                )}
                style={{
                  boxShadow: hotspotCorrect
                    ? '0 0 0 3px rgba(74,222,128,0.25), 0 0 12px #4ade80, 0 0 24px rgba(74,222,128,0.4)'
                    : '0 0 0 3px rgba(239,68,68,0.25), 0 0 12px #ef4444, 0 0 24px rgba(239,68,68,0.4)',
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-brand-muted">No image attached to this card.</p>
      )}

      {!isFlipped && currentCard.imageUrl && isOnline && (
        <p className="text-[11px] text-brand-muted font-semibold flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-brand-primary/70" />
          Tap the correct region
        </p>
      )}

      {isFlipped && !isTestMode && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={cn(
            "w-full p-4 rounded-2xl border text-left",
            hotspotCorrect ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            {hotspotCorrect ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-400" style={{ filter: 'drop-shadow(0 0 6px #4ade80)' }} />
            ) : (
              <XCircle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span className={cn(
              "text-xs font-bold uppercase tracking-widest",
              hotspotCorrect ? "text-green-400" : "text-red-400"
            )}>
              {hotspotCorrect ? 'Correct Region' : 'Not Quite'}
            </span>
          </div>
          {currentCard.back && (
            <div className="text-sm text-white/70 leading-relaxed">
              <RichText>{currentCard.back}</RichText>
            </div>
          )}
          {!currentCard.back && !hotspotCorrect && (
            <p className="text-sm text-white/50">The correct region is highlighted on the image above.</p>
          )}
        </motion.div>
      )}
    </div>
  );
}
