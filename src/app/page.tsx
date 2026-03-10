'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getItem } from '@/lib/storage/localStorage';
import { useAIProvider } from '@/hooks/useAIProvider';

const FEATURES = [
  {
    title: 'Essay Analysis',
    desc: 'Upload your work and get a detailed AI breakdown of your writing style, vocabulary, and patterns.',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    color: 'text-accent',
    bg: 'bg-accent/10',
  },
  {
    title: 'Write In Your Voice',
    desc: 'Generate essays that sound exactly like you — same vocabulary, rhythm, and quirks.',
    icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    color: 'text-success',
    bg: 'bg-success/10',
  },
  {
    title: 'AI Grading',
    desc: 'Get instant grades with detailed feedback on strengths, weaknesses, and how to improve.',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    color: 'text-warning',
    bg: 'bg-warning/10',
  },
  {
    title: 'Practice Exercises',
    desc: 'Custom exercises that target your weak spots — multiple choice, fill-in-the-blank, and more.',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    color: 'text-accent-secondary',
    bg: 'bg-accent-secondary/10',
  },
  {
    title: 'Lecture Recorder',
    desc: 'Record or upload lectures and instantly get summaries, study notes, and practice questions.',
    icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
    color: 'text-error',
    bg: 'bg-error/10',
  },
  {
    title: 'Brainrot Video',
    desc: 'Turn any lesson into a TikTok-style podcast with AI hosts, subtitles, and gameplay backgrounds.',
    icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
    color: 'text-accent',
    bg: 'bg-accent/10',
  },
  {
    title: 'Presentations',
    desc: 'Create beautiful slide decks with 12 styles, real images, and multiple layouts — like Gamma, but free.',
    icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    color: 'text-warning',
    bg: 'bg-warning/10',
  },
  {
    title: 'History & Tracking',
    desc: 'All your essays and presentations saved in one place. Track streaks, progress, and study activity.',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'text-success',
    bg: 'bg-success/10',
  },
];

const STATS = [
  { label: 'AI Models', value: '6+' },
  { label: 'Themes', value: '11' },
  { label: 'Essay Types', value: '15' },
  { label: 'Languages', value: '12' },
];

export default function Home() {
  const router = useRouter();
  const { isConfigured } = useAIProvider();
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    const onboarded = getItem('onboarding_complete', false);
    const hasEssays = getItem<unknown[]>('essays', []).length > 0;

    if (onboarded && isConfigured && hasEssays) {
      router.replace('/dashboard');
    } else if (onboarded && isConfigured) {
      router.replace('/upload');
    } else if (onboarded) {
      router.replace('/setup');
    } else {
      setShowLanding(true);
    }
  }, [router, isConfigured]);

  if (!showLanding) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="-mt-8 -mx-4 px-4">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl border border-border bg-bg-card px-8 py-16 text-center sm:px-16 sm:py-24"
        style={{ boxShadow: 'var(--card-shadow)' }}
      >
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-accent/5 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-accent-secondary/5 blur-3xl" />
        </div>

        <div className="relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <span className="mb-4 inline-block rounded-full border border-accent/20 bg-accent/10 px-4 py-1.5 text-xs font-semibold text-accent uppercase tracking-wider">
              AI-Powered Study Tool
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-4 text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl"
          >
            <span className="gradient-text">CDL Study Tool</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mx-auto mb-8 max-w-xl text-lg text-text-secondary leading-relaxed"
          >
            Upload your essays. Record your lectures. Let AI learn your style and
            generate content that sounds like <span className="font-semibold text-text-primary">you</span>.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <Link
              href="/onboarding"
              className="rounded-xl bg-accent px-8 py-3.5 text-base font-bold text-white transition-all hover:bg-accent-hover hover:scale-[1.03] active:scale-[0.98] hover:shadow-lg"
            >
              Get Started Free
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl border border-border px-8 py-3.5 text-base font-medium text-text-secondary transition-all hover:bg-bg-hover hover:text-text-primary hover:border-text-muted"
            >
              I Already Have an Account
            </Link>
          </motion.div>
        </div>
      </motion.div>

      {/* Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="my-8 grid grid-cols-2 gap-4 sm:grid-cols-4"
      >
        {STATS.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-bg-card p-4 text-center" style={{ boxShadow: 'var(--card-shadow)' }}>
            <p className="text-2xl font-bold gradient-text">{stat.value}</p>
            <p className="text-xs text-text-muted mt-1">{stat.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Features Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <h2 className="mb-6 text-center text-2xl font-bold text-text-primary">
          Everything You Need to <span className="gradient-text">Study Smarter</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.7 + i * 0.08 }}
              className="feature-card group rounded-xl border border-border bg-bg-card p-5"
              style={{ boxShadow: 'var(--card-shadow)' }}
            >
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${feature.bg} ${feature.color} transition-transform group-hover:scale-110`}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                </svg>
              </div>
              <h3 className="mb-1 text-sm font-bold text-text-primary">{feature.title}</h3>
              <p className="text-xs text-text-muted leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Bottom CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.2 }}
        className="my-12 text-center"
      >
        <p className="mb-4 text-text-muted">Works with Claude, OpenAI, Gemini, Kimi, and local models via Ollama</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/onboarding"
            className="inline-block rounded-xl bg-accent px-10 py-3.5 text-base font-bold text-white transition-all hover:bg-accent-hover hover:scale-[1.03] active:scale-[0.98]"
          >
            Start Studying Now
          </Link>
          <Link
            href="/pricing"
            className="inline-block rounded-xl border border-border px-8 py-3.5 text-base font-medium text-text-secondary transition-all hover:bg-bg-hover hover:text-text-primary"
          >
            View Pricing
          </Link>
        </div>
      </motion.div>

      {/* Footer */}
      <footer className="mt-8 mb-4 border-t border-border pt-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-xs text-text-muted">&copy; {new Date().getFullYear()} CDL Study Tool. Built by Arthur.</p>
          <div className="flex gap-6">
            <Link href="/pricing" className="text-xs text-text-muted hover:text-text-primary transition-colors">Pricing</Link>
            <Link href="/setup" className="text-xs text-text-muted hover:text-text-primary transition-colors">Setup</Link>
            <Link href="/login" className="text-xs text-text-muted hover:text-text-primary transition-colors">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
