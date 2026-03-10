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

const ACTION_COLORS = [
  'bg-accent/10 text-accent',
  'bg-accent-secondary/10 text-accent-secondary',
  'bg-success/10 text-success',
  'bg-warning/10 text-warning',
  'bg-error/10 text-error',
  'bg-accent/10 text-accent',
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
    recordActivity(); // Track visit
    setGenerated(getItem<GeneratedEssay[]>('generated_essays', []));
    setLearningStats(getItem('learning_stats', { essaysGraded: 0, exercisesDone: 0, streak: 0, lecturesRecorded: 0 }));
    setDayStreak(getDayStreak());
    setWeeklyActivity(getWeeklyActivity());
  }, []);

  const analyzedCount = essays.filter((e) => e.status === 'analyzed').length;
  const totalWords = essays.reduce((s, e) => s + e.wordCount, 0);
  const generatedWords = generated.reduce((s, e) => s + e.wordCount, 0);
  const confidence = hasProfile ? profile.confidence : 0;

  const stats = [
    { label: 'Essays Uploaded', value: essays.length, icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12', color: 'text-accent' },
    { label: 'Essays Analyzed', value: analyzedCount, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', color: 'text-success' },
    { label: 'Essays Generated', value: generated.length, icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', color: 'text-accent-secondary' },
    { label: 'Words Analyzed', value: totalWords.toLocaleString(), icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129', color: 'text-warning' },
    { label: 'Words Generated', value: generatedWords.toLocaleString(), icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'text-accent' },
    { label: 'Style Confidence', value: `${confidence}%`, icon: 'M13 10V3L4 14h7v7l9-11h-7z', color: getConfidenceColor(confidence) },
  ];

  const quickActions = [
    { label: 'Upload Essays', href: '/upload', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12', desc: 'Add more essays to improve accuracy' },
    { label: 'Write an Essay', href: '/write', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', desc: 'Generate an essay in your style' },
    { label: 'Learning Hub', href: '/learn', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', desc: 'Get your essays graded' },
    { label: 'Practice', href: '/exercises', icon: 'M13 10V3L4 14h7v7l9-11h-7z', desc: 'Interactive exercises for weak spots' },
    { label: 'Record Lecture', href: '/record', icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z', desc: 'Record and analyze a lecture' },
    { label: 'Presentations', href: '/present', icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z', desc: 'Create styled presentations' },
    { label: 'History', href: '/history', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', desc: 'View all past work' },
  ];

  const displayEssays = generated.length > 0 ? generated.slice(-5).reverse() : null;

  return (
    <motion.div className="mx-auto max-w-5xl" {...fadeInUp}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-1 text-3xl font-bold gradient-text inline-block">Dashboard</h1>
        <p className="text-text-secondary mt-1">
          {activeProvider ? `Connected to ${PROVIDERS[activeProvider].name}` : 'No AI provider connected'}
          {hasProfile && ` | ${confidence}% style confidence`}
        </p>
      </div>

      {/* Stats Grid */}
      <motion.div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6" {...staggerContainer}>
        {stats.map((stat, i) => (
          <motion.div key={stat.label} className="rounded-xl border border-border bg-bg-card p-4 text-center" style={{ boxShadow: 'var(--card-shadow)' }} {...staggerItem} transition={{ delay: i * 0.05 }}>
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-bg-hover">
              <svg className={`h-5 w-5 ${stat.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
              </svg>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-text-muted mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Confidence Progress */}
      <div className="mb-8 rounded-xl border border-border bg-bg-card p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-text-primary">Style Profile Progress</h2>
          <Link href="/profile" className="text-sm text-accent hover:underline">View full profile</Link>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-bg-hover mb-2">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent to-accent-secondary"
            initial={{ width: 0 }}
            animate={{ width: `${confidence}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-text-secondary">
            {hasProfile ? getRecommendation(profile.confidence, profile.essayCount) : 'Upload essays to build your style profile'}
          </span>
          <span className={`text-sm font-bold ${getConfidenceColor(confidence)}`}>{confidence}%</span>
        </div>
      </div>

      {/* Learning Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Essays Graded', value: learningStats.essaysGraded, color: 'text-accent' },
          { label: 'Exercises Done', value: learningStats.exercisesDone, color: 'text-success' },
          { label: 'Day Streak', value: dayStreak, color: 'text-warning' },
          { label: 'Lectures Recorded', value: learningStats.lecturesRecorded, color: 'text-accent-secondary' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-bg-card p-4" style={{ boxShadow: 'var(--card-shadow)' }}>
            <p className="text-xs text-text-muted uppercase tracking-wide mb-1">{item.label}</p>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Weekly Activity */}
      <div className="mb-8 rounded-xl border border-border bg-bg-card p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
        <h2 className="text-sm font-semibold text-text-primary mb-3">This Week</h2>
        <WeeklyActivityChart data={weeklyActivity} />
      </div>

      {/* Quick Actions */}
      <motion.h2 className="mb-4 text-lg font-semibold text-text-primary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>Quick Actions</motion.h2>
      <motion.div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" variants={staggerContainer} initial="initial" animate="animate">
        {quickActions.map((action, i) => (
          <motion.div key={action.href} variants={staggerItem}>
            <Link
              href={action.href}
              className="group flex items-center gap-4 rounded-xl border border-border bg-bg-card p-4 transition-all hover:border-accent hover:bg-accent/5"
              style={{ boxShadow: 'var(--card-shadow)' }}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ACTION_COLORS[i]} transition-colors`}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={action.icon} />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">{action.label}</p>
                <p className="text-xs text-text-muted">{action.desc}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* Recently Generated Essays */}
      {displayEssays && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">Recently Generated</h2>
          <div className="space-y-3">
            {displayEssays.map((essay) => (
              <motion.div
                key={essay.id}
                className="flex items-center justify-between rounded-xl border border-border bg-bg-card p-4"
                style={{ boxShadow: 'var(--card-shadow)' }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">{essay.topic}</p>
                  <p className="text-xs text-text-muted">
                    {essay.wordCount} words | {essay.essayType} | {new Date(essay.generatedAt).toLocaleDateString()}
                  </p>
                </div>
                {essay.styleMatchScore !== undefined && (
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    essay.styleMatchScore >= 80 ? 'bg-success/10 text-success' :
                    essay.styleMatchScore >= 60 ? 'bg-warning/10 text-warning' : 'bg-error/10 text-error'
                  }`}>
                    {essay.styleMatchScore}% match
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Get started prompt when no data */}
      {!displayEssays && (
        <div className="mt-8 rounded-xl border border-dashed border-border p-8 text-center">
          <svg className="mx-auto mb-3 h-10 w-10 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-sm font-medium text-text-primary mb-1">No essays yet</p>
          <p className="text-xs text-text-muted mb-4">Upload your essays to build a style profile, then generate essays that sound like you.</p>
          <Link href="/upload" className="inline-block rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">
            Upload Essays
          </Link>
        </div>
      )}
    </motion.div>
  );
}
