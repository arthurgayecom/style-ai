'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

interface BrandDesign {
  id: string;
  garmentType: string;
  image: string;
  description: string;
  instructions: string;
}

export default function BrandPage() {
  const [designs, setDesigns] = useState<BrandDesign[]>([]);
  const [selected, setSelected] = useState<BrandDesign | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch('/brand/collection.json')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setDesigns(data); setLoadError(false); })
      .catch(() => { setDesigns([]); setLoadError(true); });
  }, []);

  const categories = [
    { key: 'all', label: 'All Pieces' },
    { key: 'hoodie', label: 'Hoodies' },
    { key: 'pants', label: 'Pants' },
    { key: 'jeans', label: 'Jeans' },
    { key: 'tee', label: 'Tees' },
    { key: 'jacket', label: 'Jackets' },
    { key: 'windbreaker', label: 'Windbreakers' },
    { key: 'shorts', label: 'Shorts' },
  ];

  const filtered = filter === 'all'
    ? designs
    : designs.filter(d => d.garmentType.toLowerCase().includes(filter));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-6xl"
    >
      {/* Hero Header */}
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-4xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
            Streetwear Collection
          </span>
        </h1>
        <p className="text-text-secondary">
          Baggy, oversized streetwear — designed with AI
        </p>
        <div className="mt-4 flex items-center justify-center gap-3 text-sm text-text-muted">
          <span className="rounded-full border border-border px-3 py-1">{designs.length} Designs</span>
          <span className="rounded-full border border-border px-3 py-1">AI Generated</span>
          <span className="rounded-full border border-border px-3 py-1">Factory Ready</span>
        </div>
      </div>

      {/* Category Filter */}
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {categories.map(c => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              filter === c.key
                ? 'bg-purple-500 text-white'
                : 'border border-border text-text-secondary hover:border-purple-400/50 hover:text-text-primary'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Design Grid */}
      {designs.length === 0 ? (
        <div className="rounded-xl border border-border bg-bg-card p-12 text-center">
          <p className="text-lg font-semibold text-text-primary">{loadError ? 'Failed to Load Collection' : 'Collection Loading...'}</p>
          <p className="mt-2 text-sm text-text-muted">
            {loadError ? 'Could not load the collection. Please refresh the page.' : 'Designs are being generated. Refresh in a moment.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((design, i) => (
            <motion.div
              key={design.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelected(design)}
              className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-bg-card transition-all hover:border-purple-400/50 hover:shadow-lg"
              style={{ boxShadow: 'var(--card-shadow)' }}
            >
              <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800">
                <Image
                  src={`${design.image}?v=2`}
                  alt={design.garmentType}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2.5 py-0.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  #{design.id}
                </span>
              </div>
              <div className="p-3">
                <h3 className="text-sm font-bold capitalize text-text-primary">
                  {design.garmentType}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-text-muted">
                  {design.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-bg-card p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-medium text-purple-400">Design #{selected.id}</span>
                <h2 className="text-xl font-bold capitalize text-text-primary">{selected.garmentType}</h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
              <Image
                src={selected.image}
                alt={selected.garmentType}
                width={600}
                height={600}
                className="w-full object-contain"
              />
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Description</h3>
                <p className="mt-1 text-sm text-text-primary">{selected.description}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Design Specs</h3>
                <p className="mt-1 text-xs text-text-secondary">{selected.instructions}</p>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <Link
                href="/design"
                className="flex-1 rounded-lg bg-purple-500 px-4 py-2.5 text-center text-sm font-semibold text-white transition-all hover:bg-purple-600"
              >
                Edit in Design Studio
              </Link>
              <Link
                href="/techpack"
                className="flex-1 rounded-lg border border-border px-4 py-2.5 text-center text-sm font-semibold text-text-primary transition-all hover:bg-bg-hover"
              >
                Generate Tech Pack
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
