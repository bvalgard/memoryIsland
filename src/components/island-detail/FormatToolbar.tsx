import React from 'react';
import { cn } from '../../lib/utils';

export function wrapSelection(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  setter: (v: string) => void,
  before: string,
  after: string
) {
  const el = ref.current;
  if (!el) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const value = el.value;
  const newValue = value.slice(0, start) + before + value.slice(start, end) + after + value.slice(end);
  setter(newValue);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + before.length, end + before.length);
  });
}

const FORMAT_BUTTONS = [
  { label: 'B', title: 'Bold', before: '**', after: '**', cls: 'font-bold' },
  { label: 'I', title: 'Italic', before: '*', after: '*', cls: 'italic' },
  { label: 'U', title: 'Underline', before: '<u>', after: '</u>', cls: 'underline' },
  { label: '`', title: 'Code', before: '`', after: '`', cls: 'font-mono' },
  { label: '∑', title: 'Inline math ($…$)', before: '$', after: '$', cls: '' },
  { label: '∑∑', title: 'Block math ($$…$$)', before: '$$\n', after: '\n$$', cls: '' },
] as const;

export default function FormatToolbar({ taRef, setter }: {
  taRef: React.RefObject<HTMLTextAreaElement | null>;
  setter: (v: string) => void;
}) {
  return (
    <div className="flex gap-1 mb-1.5">
      {FORMAT_BUTTONS.map(({ label, title, before, after, cls }) => (
        <button
          key={label}
          type="button"
          title={title}
          onMouseDown={e => e.preventDefault()}
          onClick={() => wrapSelection(taRef, setter, before, after)}
          className={cn('px-2 py-0.5 text-[10px] rounded-md bg-white/5 border border-white/10 text-brand-muted hover:text-white hover:bg-white/10 transition-colors', cls)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
