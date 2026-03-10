'use client';

import { motion } from 'framer-motion';
import { useStyleProfile } from '@/hooks/useStyleProfile';
import { useEssays } from '@/hooks/useEssays';
import { useRouter } from 'next/navigation';
import { getConfidenceColor, getRecommendation } from '@/lib/analysis/confidence';
import { fadeInUp, staggerContainer, staggerItem } from '@/lib/animations';

const DIMENSION_LABELS: Record<string, { label: string; key: string }> = {
  vocabulary: { label: 'Vocabulary', key: 'vocabulary' },
  sentenceStructure: { label: 'Sentence Structure', key: 'sentenceStructure' },
  paragraphPatterns: { label: 'Paragraph Patterns', key: 'paragraphPatterns' },
  tone: { label: 'Tone & Formality', key: 'tone' },
  punctuationHabits: { label: 'Punctuation', key: 'punctuationHabits' },
  spellingPatterns: { label: 'Spelling', key: 'spellingPatterns' },
  argumentStructure: { label: 'Argument Style', key: 'argumentStructure' },
  voicePreference: { label: 'Voice', key: 'voicePreference' },
};

function RadarChart({ dimensions }: { dimensions: Record<string, { score: number }> }) {
  const keys = Object.keys(DIMENSION_LABELS);
  const cx = 150, cy = 150, r = 110;
  const levels = [20, 40, 60, 80, 100];

  const points = keys.map((key, i) => {
    const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
    const score = dimensions[key]?.score || 0;
    const dist = (score / 100) * r;
    return {
      x: cx + dist * Math.cos(angle),
      y: cy + dist * Math.sin(angle),
      labelX: cx + (r + 25) * Math.cos(angle),
      labelY: cy + (r + 25) * Math.sin(angle),
      label: DIMENSION_LABELS[key].label,
    };
  });

  const polygon = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox="0 0 300 300" className="mx-auto w-full max-w-sm">
      {/* Grid */}
      {levels.map((level) => {
        const lr = (level / 100) * r;
        const gridPoints = keys.map((_, i) => {
          const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
          return `${cx + lr * Math.cos(angle)},${cy + lr * Math.sin(angle)}`;
        }).join(' ');
        return (
          <polygon key={level} points={gridPoints} fill="none" stroke="var(--border)" strokeWidth={0.5} opacity={0.5} />
        );
      })}
      {/* Axes */}
      {keys.map((_, i) => {
        const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
        return (
          <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(angle)} y2={cy + r * Math.sin(angle)}
            stroke="var(--border)" strokeWidth={0.5} opacity={0.3} />
        );
      })}
      {/* Data polygon */}
      <polygon points={polygon} fill="var(--accent)" fillOpacity={0.15} stroke="var(--accent)" strokeWidth={2} />
      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--accent)" />
      ))}
      {/* Labels */}
      {points.map((p, i) => (
        <text key={i} x={p.labelX} y={p.labelY} textAnchor="middle" dominantBaseline="middle"
          fill="var(--text-secondary)" fontSize={8} fontWeight={500}>
          {p.label}
        </text>
      ))}
    </svg>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="h-32 w-32 -rotate-90">
        <circle cx="64" cy="64" r="45" fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle cx="64" cy="64" r="45" fill="none" stroke="var(--accent)" strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-1000" />
      </svg>
      <div className="absolute text-center">
        <span className={`text-2xl font-bold ${getConfidenceColor(value)}`}>{value}%</span>
        <br />
        <span className="text-xs text-text-muted">confidence</span>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { profile, hasProfile } = useStyleProfile();
  const { essays } = useEssays();
  const router = useRouter();

  if (!hasProfile) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <svg className="mb-4 h-16 w-16 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h2 className="mb-2 text-xl font-bold text-text-primary">No Style Profile Yet</h2>
        <p className="mb-4 text-text-secondary">Upload and analyze at least one essay to see your style profile.</p>
        <button onClick={() => router.push('/upload')} className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">
          Upload Essays
        </button>
      </div>
    );
  }

  const dims = profile.dimensions;

  return (
    <motion.div className="mx-auto max-w-4xl" {...fadeInUp}>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold gradient-text inline-block">Your Writing Style</h1>
        <p className="text-text-secondary">
          Based on {profile.essayCount} essay{profile.essayCount !== 1 ? 's' : ''} ({profile.totalWordCount.toLocaleString()} words)
        </p>
      </div>

      {/* Top row: Confidence + Radar */}
      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <div className="flex flex-col items-center rounded-xl border border-border bg-bg-card p-6" style={{ boxShadow: 'var(--card-shadow)' }}>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-muted">Confidence</h3>
          <ConfidenceMeter value={profile.confidence} />
          <p className="mt-4 text-center text-sm text-text-secondary">
            {getRecommendation(profile.confidence, profile.essayCount)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-6" style={{ boxShadow: 'var(--card-shadow)' }}>
          <h3 className="mb-2 text-center text-sm font-semibold uppercase tracking-wide text-text-muted">Style Dimensions</h3>
          <RadarChart dimensions={dims as unknown as Record<string, { score: number }>} />
        </div>
      </div>

      {/* Style Fingerprint */}
      {profile.fingerprint && profile.fingerprint !== 'Upload more essays for a complete style fingerprint.' && (
        <div className="mb-8 rounded-xl border border-border bg-bg-card p-6" style={{ boxShadow: 'var(--card-shadow)' }}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Style Fingerprint</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">{profile.fingerprint}</p>
        </div>
      )}

      {/* Dimension Cards */}
      <motion.div className="grid gap-4 sm:grid-cols-2" variants={staggerContainer} initial="initial" animate="animate">
        {Object.entries(DIMENSION_LABELS).map(([key, { label }]) => {
          const dim = dims[key as keyof typeof dims];
          if (!dim || typeof dim !== 'object' || !('score' in dim)) return null;
          const d = dim as { score: number; details: string };
          return (
            <motion.div key={key} className="rounded-xl border border-border bg-bg-card p-4" style={{ boxShadow: 'var(--card-shadow)' }} variants={staggerItem}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">{label}</span>
                <span className="text-sm font-bold text-accent">{d.score}/100</span>
              </div>
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-bg-hover">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${d.score}%` }} />
              </div>
              <p className="text-xs text-text-secondary line-clamp-2">{d.details}</p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Common Phrases */}
      {dims.commonPhrases && dims.commonPhrases.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-bg-card p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Your Characteristic Phrases</h3>
          <div className="flex flex-wrap gap-2">
            {dims.commonPhrases.map((phrase, i) => (
              <span key={i} className="rounded-full border border-border bg-bg-hover px-3 py-1 text-xs text-text-primary">
                &ldquo;{phrase}&rdquo;
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-8 flex justify-center gap-3">
        <button onClick={() => router.push('/upload')} className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-hover">
          Upload More
        </button>
        <button
          onClick={() => router.push('/write')}
          disabled={profile.confidence < 40}
          className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Write an Essay
        </button>
      </div>
    </motion.div>
  );
}
