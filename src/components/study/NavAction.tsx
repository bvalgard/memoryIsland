import React from 'react';
import { cn } from '../../lib/utils';

export default function NavAction({ icon: Icon, label, onClick, variant = 'muted' }: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  variant?: 'muted' | 'primary';
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={cn(
          "flex items-center gap-2 transition-colors border border-transparent px-3 py-2 rounded-xl",
          variant === 'muted'
            ? "text-brand-muted group-hover:text-white group-hover:border-white/10"
            : "text-brand-primary group-hover:bg-brand-primary/10 group-hover:border-brand-primary/20 bg-brand-primary/5 border-brand-primary/10"
        )}
      >
        <Icon className="w-5 h-5 md:w-4 md:h-4" />
        <span className="text-sm font-medium hidden md:inline">{label}</span>
      </button>
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-brand-bg/95 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 md:group-hover:opacity-0 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-2xl">
        {label}
      </div>
    </div>
  );
}
