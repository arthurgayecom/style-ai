'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { setItem } from '@/lib/storage/localStorage';

const STEPS = [
  {
    title: 'Upload Your Work',
    description: 'Upload essays, notes, and documents — as text files, PDFs, or even photos of handwritten work. CDL Study Tool analyzes your writing to build a unique style profile.',
    icon: (
      <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    color: 'text-accent',
  },
  {
    title: 'AI-Powered Analysis',
    description: 'Advanced AI breaks down your vocabulary, sentence structure, tone, and argument patterns — building a profile that gets smarter with every upload.',
    icon: (
      <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    color: 'text-accent-secondary',
  },
  {
    title: 'Generate & Create',
    description: 'Write essays in your voice, create presentations, record lectures, and turn lessons into engaging brainrot-style review videos — all powered by your personal AI.',
    icon: (
      <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    color: 'text-success',
  },
  {
    title: 'Study Smarter',
    description: 'Get essays graded instantly, practice with custom exercises targeting your weak spots, and transform any lecture into study notes and review materials.',
    icon: (
      <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    color: 'text-warning',
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const router = useRouter();

  const handleFinish = () => {
    setItem('onboarding_complete', true);
    router.push('/setup');
  };

  const isLast = step === STEPS.length - 1;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center">
      {/* Skip button */}
      <button
        onClick={handleFinish}
        className="absolute right-8 top-20 rounded-lg px-3 py-1.5 text-sm text-text-muted transition-all hover:bg-bg-hover hover:text-text-primary"
      >
        Skip
      </button>

      {/* Step counter */}
      <div className="mb-8">
        <span className="rounded-full bg-accent/10 px-4 py-1.5 text-xs font-semibold text-accent uppercase tracking-wide">
          Step {step + 1} of {STEPS.length}
        </span>
      </div>

      {/* Step content */}
      <div className="relative w-full max-w-lg">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -40, scale: 0.98 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex flex-col items-center text-center"
          >
            <div className={`mb-6 rounded-2xl bg-bg-card p-8 ${STEPS[step].color}`} style={{ boxShadow: 'var(--card-shadow)' }}>
              {STEPS[step].icon}
            </div>
            <h2 className="mb-3 text-3xl font-bold gradient-text sm:text-4xl">
              {STEPS[step].title}
            </h2>
            <p className="mb-8 max-w-md text-base text-text-secondary leading-relaxed">
              {STEPS[step].description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Step indicators */}
      <div className="mb-8 flex gap-2">
        {STEPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === step ? 'w-8 bg-accent' : i < step ? 'w-4 bg-accent/40' : 'w-2 bg-border hover:bg-text-muted'
            }`}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary transition-all hover:bg-bg-hover hover:text-text-primary"
          >
            Back
          </button>
        )}
        <button
          onClick={isLast ? handleFinish : () => setStep(step + 1)}
          className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover hover:scale-[1.02] active:scale-[0.98]"
        >
          {isLast ? 'Get Started' : 'Next'}
        </button>
      </div>
    </div>
  );
}
