import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ImageIcon, X, Upload, Loader } from 'lucide-react';
import { auth } from '../firebase';
import { cn } from '../lib/utils';

const WORKER_URL = import.meta.env.VITE_UPLOAD_WORKER_URL as string;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

interface ImageUploadProps {
  value?: string;
  onChange: (url: string | undefined) => void;
  label?: string;
  compact?: boolean;
}

async function deleteFromR2(url: string) {
  const token = await auth.currentUser?.getIdToken();
  if (!token || !WORKER_URL) return;
  await fetch(WORKER_URL, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
}

export default function ImageUpload({ value, onChange, label, compact }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError('Image must be under 5MB.');
      return;
    }
    if (!WORKER_URL) {
      setError('Upload service not configured (VITE_UPLOAD_WORKER_URL missing).');
      return;
    }

    setUploading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not signed in');

      // Delete old image if replacing
      if (value) await deleteFromR2(value);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('token', token);

      const res = await fetch(WORKER_URL, { method: 'POST', body: formData });
      const data = await res.json() as { url?: string; error?: string };

      if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed');
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove() {
    if (value) await deleteFromR2(value);
    onChange(undefined);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  return (
    <div className="w-full">
      {label && !compact && (
        <label className="block text-[10px] text-brand-muted uppercase tracking-[0.2em] font-medium mb-3">
          {label}
        </label>
      )}

      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-white/10 bg-white/5">
          <img src={value} alt="card image" className={cn("w-full object-contain", compact ? "max-h-24" : "max-h-48")} />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-black/60 hover:bg-red-500/80 text-white rounded-full p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-colors",
            compact ? "py-3" : "py-6",
            dragOver ? "border-brand-primary/70 bg-brand-primary/10" : "border-white/15 hover:border-white/30 bg-white/5"
          )}
        >
          {uploading ? (
            <Loader className="w-5 h-5 text-brand-primary animate-spin" />
          ) : (
            <>
              <div className="flex items-center gap-2 text-brand-muted">
                <ImageIcon className="w-4 h-4" />
                <Upload className="w-3 h-3" />
              </div>
              {!compact && <span className="text-xs text-brand-muted">Click or drag an image (max 5MB)</span>}
            </>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        className="hidden"
      />
    </div>
  );
}
