'use client';

import { motion } from 'framer-motion';
import { useAppMode } from '@/context/AppModeContext';

export function ModeToggle() {
  const { mode, setMode } = useAppMode();

  return (
    <div className="fixed bottom-5 left-5 z-50">
      <div className="relative flex items-center rounded-full border border-border bg-bg-card/90 p-1 shadow-lg backdrop-blur-md">
        {/* Sliding indicator */}
        <motion.div
          className="absolute top-1 bottom-1 rounded-full"
          style={{ width: 'calc(50% - 4px)' }}
          animate={{ x: mode === 'school' ? 0 : '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className={`h-full w-full rounded-full ${
            mode === 'school'
              ? 'bg-accent/20 shadow-[0_0_12px_rgba(var(--accent-rgb,99,102,241),0.3)]'
              : 'bg-purple-500/20 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
          }`} />
        </motion.div>

        {/* School button */}
        <button
          onClick={() => setMode('school')}
          className={`relative z-10 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
            mode === 'school' ? 'text-accent' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          School
        </button>

        {/* Studio button */}
        <button
          onClick={() => setMode('studio')}
          className={`relative z-10 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
            mode === 'studio' ? 'text-purple-400' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-2.5 2.5L12 3m0 0L8.5 6.5M12 3v0M4.929 19.071l2.828-2.828m0 0L12 12m-4.243 4.243L3 21m0 0h4.243M3 21v-4.243" />
          </svg>
          Studio
        </button>
      </div>
    </div>
  );
}
