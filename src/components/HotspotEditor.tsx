import { useEffect, useRef, useState } from 'react';
import { Target, X } from 'lucide-react';
import type { HotspotZone } from '../hooks/useUserProgress';

interface HotspotEditorProps {
  imageUrl: string;
  zone: HotspotZone | null;
  onZoneChange: (z: HotspotZone | null) => void;
}

/**
 * HotspotEditor — lets a card creator click on an uploaded image to define
 * the correct "tap zone" for a hotspot card. The zone is stored as normalized
 * coordinates (0–1) relative to the image dimensions so it scales correctly
 * on any screen size.
 */
export function HotspotEditor({ imageUrl, zone, onZoneChange }: HotspotEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgSize, setImgSize] = useState({ w: 1, h: 1 });
  const [radius, setRadius] = useState(zone?.radius ?? 0.10);
  const [label, setLabel] = useState(zone?.label ?? '');

  // Track rendered image size so the SVG overlay stays accurate on resize
  useEffect(() => {
    if (!imgRef.current || !imgLoaded) return;
    const ro = new ResizeObserver(() => {
      if (imgRef.current) {
        setImgSize({ w: imgRef.current.clientWidth, h: imgRef.current.clientHeight });
      }
    });
    ro.observe(imgRef.current);
    setImgSize({ w: imgRef.current.clientWidth, h: imgRef.current.clientHeight });
    return () => ro.disconnect();
  }, [imgLoaded]);

  // Sync radius / label back to parent when they change
  useEffect(() => {
    if (!zone) return;
    onZoneChange({ ...zone, radius, label: label || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius, label]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!imgLoaded || !imgRef.current) return;
    // Only handle primary button / first touch
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();

    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    onZoneChange({
      id: zone?.id ?? crypto.randomUUID(),
      x,
      y,
      radius,
      label: label || undefined,
    });
  }

  // SVG circle dimensions in normalized viewBox space
  const svgRx = zone ? zone.radius : 0;
  // Compensate for non-square images so the zone looks circular on screen
  const aspectRatio = imgSize.h > 0 ? imgSize.w / imgSize.h : 1;
  const svgRy = svgRx / aspectRatio;

  return (
    <div className="flex flex-col gap-3">
      {/* Image + overlay */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden select-none"
        style={{ touchAction: 'none', cursor: imgLoaded ? 'crosshair' : 'default' }}
        onPointerDown={handlePointerDown}
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Hotspot image"
          className="w-full object-contain rounded-xl"
          draggable={false}
          onLoad={() => setImgLoaded(true)}
        />

        {/* SVG overlay — zone circle + center dot */}
        {zone && imgLoaded && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
          >
            {/* Zone area */}
            <ellipse
              cx={zone.x}
              cy={zone.y}
              rx={svgRx}
              ry={svgRy}
              fill="rgba(74,222,128,0.15)"
              stroke="#4ade80"
              strokeWidth="0.004"
              strokeDasharray="0.014 0.007"
            />
            {/* Center dot */}
            <circle
              cx={zone.x}
              cy={zone.y}
              r="0.012"
              fill="#4ade80"
            />
          </svg>
        )}

        {/* "Click to place" hint when no zone set */}
        {!zone && imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/60 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-2">
              <Target className="w-4 h-4 text-green-400" />
              Click to place the correct zone
            </div>
          </div>
        )}

        {!imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/5">
            <div className="text-brand-muted text-xs">Loading image…</div>
          </div>
        )}
      </div>

      {/* Controls — only shown once a zone is placed */}
      {zone && (
        <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-xl border border-white/10">
          {/* Radius slider */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted w-16 shrink-0">
              Zone size
            </span>
            <input
              type="range"
              min={0.04}
              max={0.30}
              step={0.01}
              value={radius}
              onChange={e => setRadius(parseFloat(e.target.value))}
              className="flex-1 accent-green-400"
            />
            <span className="text-[10px] text-brand-muted w-10 text-right">
              {Math.round(radius * 100)}%
            </span>
          </div>

          {/* Optional label */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted w-16 shrink-0">
              Label
            </span>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Aorta (creator only)"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder:text-brand-muted focus:outline-none focus:border-green-400/40"
            />
          </div>

          {/* Clear button */}
          <button
            type="button"
            onClick={() => onZoneChange(null)}
            className="self-start flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-muted hover:text-red-400 transition-colors mt-1"
          >
            <X className="w-3 h-3" />
            Clear zone
          </button>
        </div>
      )}
    </div>
  );
}
