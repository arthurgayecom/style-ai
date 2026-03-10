'use client';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeeklyActivityChart({ data }: { data: number[] }) {
  const today = new Date().getDay();
  // Reorder to start from correct day
  const labels = Array.from({ length: 7 }, (_, i) => {
    const idx = (today - 6 + i + 7) % 7;
    return DAYS[idx === 0 ? 6 : idx - 1]; // JS: 0=Sun
  });

  return (
    <div className="flex items-end gap-1.5 h-16">
      {data.map((active, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1">
          <div
            className={`w-full rounded-sm transition-all ${active ? 'bg-accent' : 'bg-bg-hover'}`}
            style={{ height: active ? '100%' : '20%' }}
          />
          <span className="text-[8px] text-text-muted">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function ConfidenceHistory({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 100);
  const h = 60;
  const w = 200;
  const step = w / (values.length - 1);

  const points = values.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
      <polyline
        points={points}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {values.map((v, i) => (
        <circle
          key={i}
          cx={i * step}
          cy={h - (v / max) * h}
          r="3"
          fill="var(--accent)"
        />
      ))}
    </svg>
  );
}
