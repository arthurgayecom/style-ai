'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useStyleProfile } from '@/hooks/useStyleProfile';
import { useEssays } from '@/hooks/useEssays';
import { useAIProvider } from '@/hooks/useAIProvider';
import { getItem } from '@/lib/storage/localStorage';
import { getConfidenceColor, getRecommendation } from '@/lib/analysis/confidence';
import { getDayStreak, getWeeklyActivity, recordActivity } from '@/lib/streak';
import { PROVIDERS } from '@/types/ai';
import { fadeInUp, staggerContainer, staggerItem } from '@/lib/animations';
import { WeeklyActivityChart } from '@/components/ui/MiniChart';
import type { GeneratedEssay } from '@/types/essay';

const WORKFLOW_STEPS = [
  {
    step: 1,
    title: 'Upload a Lesson',
    desc: 'Record a lecture, upload pictures of notes/whiteboard, paste text, or upload PDFs',
    href: '/record',
    icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
    color: 'text-accent',
    bg: 'bg-accent/10',
    cta: 'Record / Upload',
  },
  {
    step: 2,
    title: 'Study & Practice',
    desc: 'AI generates summaries, exercises, and practice questions from your lesson',
    href: '/exercises',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    color: 'text-success',
    bg: 'bg-success/10',
    cta: 'Practice',
  },
  {
    step: 3,
    title: 'Create Content',
    desc: 'Turn your lessons into essays, presentations, or brainrot videos',
    href: '/write',
    icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    color: 'text-accent-secondary',
    bg: 'bg-accent-secondary/10',
    cta: 'Write / Present',
  },
];

const CREATE_ACTIONS = [
  { label: 'Write Essay', href: '/write', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', desc: 'Generate in your style', color: 'bg-accent-secondary/10 text-accent-secondary' },
  { label: 'Presentation', href: '/present', icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z', desc: '12 styles, real images', color: 'bg-warning/10 text-warning' },
  { label: 'Brainrot Video', href: '/video', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', desc: 'TikTok-style podcast', color: 'bg-error/10 text-error' },
];

const STUDY_ACTIONS = [
  { label: 'Record Lecture', href: '/record', icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z', desc: 'Record, upload photos/PDFs', color: 'bg-accent/10 text-accent' },
  { label: 'Practice', href: '/exercises', icon: 'M13 10V3L4 14h7v7l9-11h-7z', desc: 'Exercises from your lessons', color: 'bg-success/10 text-success' },
  { label: 'Grade Essays', href: '/learn', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', desc: 'AI feedback on your writing', color: 'bg-accent-secondary/10 text-accent-secondary' },
];

export default function DashboardPage() {
  const { profile, hasProfile } = useStyleProfile();
  const { essays } = useEssays();
  const { activeProvider } = useAIProvider();
  const [generated, setGenerated] = useState<GeneratedEssay[]>([]);
  const [learningStats, setLearningStats] = useState({ essaysGraded: 0, exercisesDone: 0, streak: 0, lecturesRecorded: 0 });
  const [dayStreak, setDayStreak] = useState(0);
  const [weeklyActivity, setWeeklyActivity] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);

  useEffect(() => {
    recordActivity();
    setGenerated(getItem<GeneratedEssay[]>('generated_essays', []));
    setLearningStats(getItem('learning_stats', { essaysGraded: 0, exercisesDone: 0, streak: 0, lecturesRecorded: 0 }));
    setDayStreak(getDayStreak());
    setWeeklyActivity(getWeeklyActivity());
  }, []);

  const analyzedCount = essays.filter((e) => e.status === 'analyzed').length;
  const totalWords = essays.reduce((s, e) => s + e.wordCount, 0);
  const generatedWords = generated.reduce((s, e) => s + e.wordCount, 0);
  const confidence = hasProfile ? profile.confidence : 0;

  const displayEssays = generated.length > 0 ? generated.slice(-5).reverse() : null;

  return (
    <motion.div className="mx-auto max-w-5xl" {...fadeInUp}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold gradient-text inline-block">Dashboard</h1>
        <p className="text-text-secondary mt-1">
          {activeProvider ? `Connected to ${PROVIDERS[activeProvider].name}` : 'No AI provider connected — '}
          {!activeProvider && <Link href="/setup" className="text-accent hover:underline">set one up</Link>}
          {hasProfile && ` | ${confidence}% style confidence`}
        </p>
      </div>

      {/* How It Works — clear 3-step workflow */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">How It Works</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {WORKFLOW_STEPS.map((ws, i) => (
            <Link key={ws.step} href={ws.href} className="group relative rounded-xl border border-border bg-bg-card p-5 transition-all hover:border-accent hover:bg-accent/5" style={{ boxShadow: 'var(--card-shadow)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${ws.bg} text-sm font-bold ${ws.color}`}>
                  {ws.step}
                </div>
                <h3 className="text-sm font-bold text-text-primary">{ws.title}</h3>
              </div>
              <p className="text-xs text-text-muted leading-relaxed mb-3">{ws.desc}</p>
              <span className={`inline-block rounded-lg ${ws.bg} px-3 py-1 text-xs font-semibold ${ws.color} group-hover:scale-105 transition-transform`}>
                {ws.cta}
              </span>
              {i < WORKFLOW_STEPS.length - 1 && (
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 hidden text-text-muted sm:block">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="mb-8 grid grid-cols-3 gap-4 sm:grid-cols-6">
        {[
          { label: 'Uploaded', value: essays.length, color: 'text-accent' },
          { label: 'Analyzed', value: analyzedCount, color: 'text-success' },
          { label: 'Generated', value: generated.length, color: 'text-accent-secondary' },
          { label: 'Graded', value: learningStats.essaysGraded, color: 'text-warning' },
          { label: 'Exercises', value: learningStats.exercisesDone, color: 'text-success' },
          { label: 'Day Streak', value: dayStreak, color: 'text-warning' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-bg-card p-3 text-center" style={{ boxShadow: 'var(--card-shadow)' }}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Style Profile Progress */}
      <div className="mb-8 rounded-xl border border-border bg-bg-card p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-text-primary">Style Profile</h2>
          <Link href={hasProfile ? '/profile' : '/upload'} className="text-xs text-accent hover:underline">{hasProfile ? 'View profile' : 'Upload essays'}</Link>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-bg-hover mb-2">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent to-accent-secondary"
            initial={{ width: 0 }}
            animate={{ width: `${confidence}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        <p className="text-xs text-text-secondary">
          {hasProfile ? getRecommendation(profile.confidence, profile.essayCount) : 'Upload essays to build your style profile — AI will learn how you write'}
          <span className={`ml-2 font-bold ${getConfidenceColor(confidence)}`}>{confidence}%</span>
        </p>
      </div>

      {/* Two-column: Study + Create */}
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        {/* Study */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Study</h2>
          <div className="space-y-2">
            {STUDY_ACTIONS.map((a) => (
              <Link key={a.href} href={a.href} className="group flex items-center gap-3 rounded-xl border border-border bg-bg-card p-3.5 transition-all hover:border-accent hover:bg-accent/5" style={{ boxShadow: 'var(--card-shadow)' }}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${a.color}`}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={a.icon} /></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{a.label}</p>
                  <p className="text-xs text-text-muted">{a.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
        {/* Create */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Create</h2>
          <div className="space-y-2">
            {CREATE_ACTIONS.map((a) => (
              <Link key={a.href} href={a.href} className="group flex items-center gap-3 rounded-xl border border-border bg-bg-card p-3.5 transition-all hover:border-accent hover:bg-accent/5" style={{ boxShadow: 'var(--card-shadow)' }}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${a.color}`}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={a.icon} /></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{a.label}</p>
                  <p className="text-xs text-text-muted">{a.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Manage Row */}
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Link href="/upload" className="flex items-center gap-3 rounded-xl border border-border bg-bg-card p-3.5 transition-all hover:border-accent hover:bg-accent/5" style={{ boxShadow: 'var(--card-shadow)' }}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Upload Essays</p>
            <p className="text-xs text-text-muted">Build your style profile</p>
          </div>
        </Link>
        <Link href="/history" className="flex items-center gap-3 rounded-xl border border-border bg-bg-card p-3.5 transition-all hover:border-accent hover:bg-accent/5" style={{ boxShadow: 'var(--card-shadow)' }}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">History</p>
            <p className="text-xs text-text-muted">All past essays & decks</p>
          </div>
        </Link>
        <Link href="/setup" className="flex items-center gap-3 rounded-xl border border-border bg-bg-card p-3.5 transition-all hover:border-accent hover:bg-accent/5" style={{ boxShadow: 'var(--card-shadow)' }}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-hover text-text-muted">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">AI Settings</p>
            <p className="text-xs text-text-muted">Change provider or API key</p>
          </div>
        </Link>
      </div>

      {/* Weekly Activity */}
      <div className="mb-8 rounded-xl border border-border bg-bg-card p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
        <h2 className="text-sm font-semibold text-text-primary mb-3">This Week</h2>
        <WeeklyActivityChart data={weeklyActivity} />
      </div>

      {/* Recently Generated */}
      {displayEssays && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-primary">Recently Generated</h2>
            <Link href="/history" className="text-xs text-accent hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {displayEssays.map((essay) => (
              <motion.div
                key={essay.id}
                className="flex items-center justify-between rounded-xl border border-border bg-bg-card p-3.5"
                style={{ boxShadow: 'var(--card-shadow)' }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{essay.topic}</p>
                  <p className="text-xs text-text-muted">
                    {essay.wordCount} words | {essay.essayType} | {new Date(essay.generatedAt).toLocaleDateString()}
                  </p>
                </div>
                {essay.styleMatchScore !== undefined && (
                  <span className={`shrink-0 ml-3 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    essay.styleMatchScore >= 80 ? 'bg-success/10 text-success' :
                    essay.styleMatchScore >= 60 ? 'bg-warning/10 text-warning' : 'bg-error/10 text-error'
                  }`}>
                    {essay.styleMatchScore}%
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Get started when empty */}
      {!displayEssays && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <svg className="mx-auto mb-3 h-10 w-10 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-sm font-medium text-text-primary mb-1">Ready to start?</p>
          <p className="text-xs text-text-muted mb-4">Upload a lesson, record a lecture, or just start writing. Everything you create shows up here.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/record" className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">
              Record a Lesson
            </Link>
            <Link href="/upload" className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-hover">
              Upload Essays
            </Link>
          </div>
        </div>
      )}
    </motion.div>
  );
}
