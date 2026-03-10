'use client';

interface ComingSoonProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
}

export function ComingSoon({ title, description, icon, features }: ComingSoonProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-2xl bg-bg-card p-5 text-accent" style={{ boxShadow: 'var(--card-shadow)' }}>
        {icon}
      </div>
      <h1 className="mb-2 text-2xl font-bold text-text-primary">{title}</h1>
      <p className="mb-6 max-w-md text-text-secondary">{description}</p>

      <div className="rounded-xl border border-border bg-bg-card p-5 text-left" style={{ boxShadow: 'var(--card-shadow)' }}>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Planned Features</h3>
        <ul className="space-y-2">
          {features.map((feature, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-text-secondary">
              <svg className="h-4 w-4 shrink-0 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-2 text-sm font-medium text-accent">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Coming Soon
      </div>
    </div>
  );
}
