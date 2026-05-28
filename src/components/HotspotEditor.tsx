import { useEffect, useRef, useState } from 'react';
import { Target, X, Link2, Link2Off } from 'lucide-react';
import type { HotspotZone } from '../hooks/useUserProgress';

interface HotspotEditorProps {
  imageUrl: string;
  zone: HotspotZone | null;
  onZoneChange: (z: HotspotZone | null) => void;
  /** Already-committed questions in the set — shown as numbered purple markers */
  existingZones?: Array<{ zone: HotspotZone; index: number }>;
}

/**
 * HotspotEditor — lets a card creator click on an uploaded image to define
 * the correct "tap zone" for a hotspot card. The zone is stored as normalized
 * coordinates (0–1) relative to the image dimensions so it scales correctly
 * on any screen size.
 *
 * Supports independent Width/Height radii and a Rotation angle (0–360°).
 * A "Constrain Proportions" lock keeps Width === Height for a perfect circle.
 *
 * When building a multi-question set, `existingZones` shows the already-added
 * questions as numbered purple pins so the creator can see all placements at once.
 */
export function HotspotEditor({ imageUrl, zone, onZoneChange, existingZones }: HotspotEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgSize, setImgSize] = useState({ w: 1, h: 1 });

  // Zone shape state — all three drive the SVG overlay and onZoneChange
  const [radiusX, setRadiusX] = useState(zone?.radius ?? 0.10);
  const [radiusY, setRadiusY] = useState(zone?.radiusY ?? zone?.radius ?? 0.10);
  const [rotation, setRotation] = useState(zone?.rotation ?? 0);
  const [constrained, setConstrained] = useState(true);
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

  // Sync shape / label back to parent when they change
  useEffect(() => {
    if (!zone) return;
    onZoneChange({ ...zone, radius: radiusX, radiusY, rotation, label: label || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radiusX, radiusY, rotation, label]);

  // ── Slider handlers ──────────────────────────────────────────────────────
  function handleWidthChange(v: number) {
    setRadiusX(v);
    if (constrained) setRadiusY(v);
  }

  function handleHeightChange(v: number) {
    setRadiusY(v);
    if (constrained) setRadiusX(v);
  }

  function handleToggleConstrain() {
    if (!constrained) {
      // Locking: snap both to radiusX so we snap to a circle
      setRadiusY(radiusX);
    }
    setConstrained(prev => !prev);
  }

  // ── Click-to-place ───────────────────────────────────────────────────────
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!imgLoaded || !imgRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();

    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    onZoneChange({
      id: zone?.id ?? crypto.randomUUID(),
      x,
      y,
      radius: radiusX,
      radiusY,
      rotation,
      label: label || undefined,
    });
  }

  // ── SVG dimensions ───────────────────────────────────────────────────────
  const aspectRatio = imgSize.h > 0 ? imgSize.w / imgSize.h : 1;
  // rx stays in normalized-width space; ry is also stored in normalized-width
  // space but must be divided by the aspect ratio for the SVG viewBox (0 0 1 1)
  // so it renders as the intended pixel height.
  const svgRx = zone ? zone.radius : 0;
  const svgRy = zone ? (zone.radiusY ?? zone.radius) / aspectRatio : 0;
  const svgRotation = zone?.rotation ?? 0;

  const hasExisting = existingZones && existingZones.length > 0;

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

        {/* SVG overlay — existing zone pins + active zone */}
        {imgLoaded && (hasExisting || zone) && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
          >
            {/* Already-added questions — numbered purple pins */}
            {existingZones?.map(({ zone: ez, index }) => {
              const ezAr = imgSize.h > 0 ? imgSize.w / imgSize.h : 1;
              const ezRy = (ez.radiusY ?? ez.radius) / ezAr;
              return (
                <g key={ez.id} transform={ez.rotation ? `rotate(${ez.rotation}, ${ez.x}, ${ez.y})` : undefined}>
                  <ellipse
                    cx={ez.x}
                    cy={ez.y}
                    rx={ez.radius}
                    ry={ezRy}
                    fill="rgba(99,102,241,0.12)"
                    stroke="#6366f1"
                    strokeWidth="0.003"
                    strokeDasharray="0.010 0.006"
                  />
                  {/* Numbered pin (outside the rotation group so it stays upright) */}
                </g>
              );
            })}
            {/* Pins drawn outside rotation groups so numbers stay upright */}
            {existingZones?.map(({ zone: ez, index }) => (
              <g key={`pin-${ez.id}`}>
                <circle cx={ez.x} cy={ez.y} r="0.028" fill="#6366f1" />
                <text
                  x={ez.x}
                  y={ez.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="0.024"
                  fill="white"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {index + 1}
                </text>
              </g>
            ))}

            {/* Active zone — solid glow ellipse + pin (matches answer reveal style) */}
            {zone && (
              <>
                <defs>
                  <filter id="hotspot-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="0.006" result="blur1" />
                    <feGaussianBlur stdDeviation="0.015" result="blur2" />
                    <feMerge>
                      <feMergeNode in="blur2" />
                      <feMergeNode in="blur1" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <ellipse
                  cx={zone.x}
                  cy={zone.y}
                  rx={svgRx}
                  ry={svgRy}
                  transform={svgRotation ? `rotate(${svgRotation}, ${zone.x}, ${zone.y})` : undefined}
                  fill="none"
                  stroke="#4ade80"
                  strokeWidth="0.003"
                  filter="url(#hotspot-glow)"
                />
                {/* Pin — white center, green ring, glow (always upright) */}
                <circle
                  cx={zone.x}
                  cy={zone.y}
                  r="0.016"
                  fill="white"
                  stroke="#4ade80"
                  strokeWidth="0.005"
                  filter="url(#hotspot-glow)"
                />
              </>
            )}
          </svg>
        )}

        {/* "Click to place" hint when no active zone set */}
        {!zone && imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/60 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-2">
              <Target className="w-4 h-4 text-green-400" />
              {hasExisting
                ? `Click to place zone for Q${existingZones!.length + 1}`
                : 'Click to place the correct zone'}
            </div>
          </div>
        )}

        {!imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/5">
            <div className="text-brand-muted text-xs">Loading image…</div>
          </div>
        )}
      </div>

      {/* Controls — only shown once an active zone is placed */}
      {zone && (
        <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-xl border border-white/10">

          {/* Width + Height sliders + Constrain lock */}
          <div className="flex flex-col gap-1.5">
            {/* Width */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted w-16 shrink-0">
                Width
              </span>
              <input
                type="range"
                min={0.04}
                max={0.40}
                step={0.01}
                value={radiusX}
                onChange={e => handleWidthChange(parseFloat(e.target.value))}
                className="flex-1 accent-green-400"
              />
              <span className="text-[10px] text-brand-muted w-10 text-right">
                {Math.round(radiusX * 100)}%
              </span>
              {/* Lock / unlock proportions */}
              <button
                type="button"
                onClick={handleToggleConstrain}
                title={constrained ? 'Unlock proportions' : 'Lock proportions'}
                className={`shrink-0 p-1 rounded transition-colors ${
                  constrained
                    ? 'text-green-400 hover:text-green-300'
                    : 'text-brand-muted hover:text-white'
                }`}
              >
                {constrained
                  ? <Link2 className="w-3.5 h-3.5" />
                  : <Link2Off className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Height */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted w-16 shrink-0">
                Height
              </span>
              <input
                type="range"
                min={0.04}
                max={0.40}
                step={0.01}
                value={radiusY}
                onChange={e => handleHeightChange(parseFloat(e.target.value))}
                className="flex-1 accent-green-400"
              />
              <span className="text-[10px] text-brand-muted w-10 text-right">
                {Math.round(radiusY * 100)}%
              </span>
              {/* Spacer to align with lock button column */}
              <div className="w-[26px] shrink-0" />
            </div>
          </div>

          {/* Rotation */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-muted w-16 shrink-0">
              Rotation
            </span>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={rotation}
              onChange={e => setRotation(parseInt(e.target.value, 10))}
              className="flex-1 accent-green-400"
            />
            <span className="text-[10px] text-brand-muted w-10 text-right">
              {rotation}°
            </span>
            {/* Spacer to align with lock button column */}
            <div className="w-[26px] shrink-0" />
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
            {/* Spacer */}
            <div className="w-[26px] shrink-0" />
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
