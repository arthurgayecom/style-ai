'use client';

import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { THEME_ORDER, THEME_LABELS, THEME_COLORS, type Theme } from '@/types/theme';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleKey);
    }
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const pick = (t: Theme) => {
    setTheme(t);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-all hover:bg-bg-hover hover:text-text-primary"
      >
        <span
          className="h-3.5 w-3.5 rounded-full border border-border"
          style={{ background: THEME_COLORS[theme].accent }}
        />
        <span className="hidden sm:inline">{THEME_LABELS[theme]}</span>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-40 grid grid-cols-2 gap-1 rounded-xl border border-border bg-bg-card p-2 min-w-[200px]" style={{ boxShadow: 'var(--card-shadow)' }}>
          {THEME_ORDER.map((t) => (
            <button
              key={t}
              onClick={() => pick(t)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all ${
                t === theme
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ background: THEME_COLORS[t].accent, boxShadow: t === theme ? `0 0 6px ${THEME_COLORS[t].accent}` : 'none' }}
              />
              {THEME_LABELS[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
