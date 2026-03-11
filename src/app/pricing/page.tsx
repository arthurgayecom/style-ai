'use client';

import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer, staggerItem } from '@/lib/animations';

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Get started with essential features',
    badge: null,
    features: [
      '3 essays per month',
      '2 presentations per month',
      'Basic exercises',
      'Essay grading (3/month)',
      '1 AI provider',
      '3 themes',
      'Local storage only',
    ],
    limits: [
      'No AI detection scanner',
      'No cloud sync',
      'Limited humanization',
    ],
    cta: 'Get Started',
    ctaStyle: 'border border-border text-text-primary hover:bg-bg-hover',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$9',
    period: '/month',
    description: 'Everything you need for academic success',
    badge: 'Most Popular',
    features: [
      'Unlimited essays',
      'Unlimited presentations',
      'All exercises + custom',
      'Unlimited grading',
      'All 6 AI providers',
      'All 11 themes',
      'AI detection scanner',
      'Max humanization',
      'Cloud sync across devices',
      'Lecture recording + analysis',
      'Brainrot video creator',
      'Export to HTML/Markdown',
      'Priority support',
    ],
    limits: [],
    cta: 'Coming Soon',
    ctaStyle: 'bg-accent text-white hover:bg-accent-hover',
    highlight: true,
  },
  {
    name: 'Teacher',
    price: '$29',
    period: '/month',
    description: 'For educators and institutions',
    badge: null,
    features: [
      'Everything in Pro',
      'Up to 50 student accounts',
      'Bulk essay grading',
      'Classroom management',
      'Student progress tracking',
      'Custom exercise sets',
      'Assignment distribution',
      'Plagiarism detection',
      'Analytics dashboard',
      'Priority support',
    ],
    limits: [],
    cta: 'Coming Soon',
    ctaStyle: 'border border-border text-text-primary hover:bg-bg-hover',
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <motion.div className="mx-auto max-w-5xl" {...fadeInUp}>
      <div className="mb-12 text-center">
        <h1 className="mb-3 text-4xl font-bold gradient-text inline-block">Simple Pricing</h1>
        <p className="text-lg text-text-secondary max-w-xl mx-auto">
          Start for free, upgrade when you need more. No hidden fees, cancel anytime.
        </p>
      </div>

      <motion.div className="grid gap-6 lg:grid-cols-3" variants={staggerContainer} initial="initial" animate="animate">
        {TIERS.map((tier) => (
          <motion.div
            key={tier.name}
            variants={staggerItem}
            className={`relative rounded-2xl border p-6 transition-all ${
              tier.highlight
                ? 'border-accent bg-accent/5 ring-2 ring-accent/20 scale-[1.02]'
                : 'border-border bg-bg-card'
            }`}
            style={{ boxShadow: 'var(--card-shadow)' }}
          >
            {tier.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-4 py-1 text-xs font-bold text-white">
                {tier.badge}
              </span>
            )}

            <div className="mb-6">
              <h2 className="text-xl font-bold text-text-primary">{tier.name}</h2>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-text-primary">{tier.price}</span>
                <span className="text-sm text-text-muted">{tier.period}</span>
              </div>
              <p className="mt-2 text-sm text-text-secondary">{tier.description}</p>
            </div>

            <button className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-all ${tier.ctaStyle}`}>
              {tier.cta}
            </button>

            <div className="mt-6 space-y-2.5">
              {tier.features.map((feature) => (
                <div key={feature} className="flex items-start gap-2.5">
                  <svg className="h-4 w-4 shrink-0 mt-0.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-text-secondary">{feature}</span>
                </div>
              ))}
              {tier.limits.map((limit) => (
                <div key={limit} className="flex items-start gap-2.5">
                  <svg className="h-4 w-4 shrink-0 mt-0.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-sm text-text-muted">{limit}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="mt-12 text-center">
        <p className="text-2xl font-bold gradient-text inline-block">
          All features are free during beta
        </p>
        <p className="text-sm text-text-secondary mt-3 max-w-md mx-auto">
          We&apos;re in beta — enjoy every feature at no cost. Paid plans will launch soon with even more power.
        </p>
        <a
          href="https://www.snapchat.com/add/arthurgaye24"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-4 rounded-full bg-yellow-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-yellow-400 transition-all hover:scale-105"
        >
          <span>👻</span> Add @arthurgaye24 for updates &amp; ideas
        </a>
      </div>
    </motion.div>
  );
}
