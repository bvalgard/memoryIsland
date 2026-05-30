export default function OfflineImageNotice() {
  return (
    <div className="w-full max-h-48 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col items-center justify-center gap-2 py-6 px-4 text-center">
      <svg className="w-6 h-6 text-amber-400/60 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M6.343 6.343a9 9 0 000 12.728M9.172 9.172a5 5 0 000 7.071M12 12h.01" />
      </svg>
      <p className="text-[11px] text-amber-300/70 leading-snug max-w-[200px]">
        You're studying offline — images aren't available without a connection
      </p>
    </div>
  );
}
