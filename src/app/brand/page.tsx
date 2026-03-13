'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface BrandDesign {
  id: string;
  garmentType: string;
  name?: string;
  image: string;
  description: string;
  instructions: string;
}

export default function BrandPage() {
  const [designs, setDesigns] = useState<BrandDesign[]>([]);
  const [selected, setSelected] = useState<BrandDesign | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [loadError, setLoadError] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);

  useEffect(() => {
    fetch('/brand/vaste/collection.json')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { setDesigns(data); setLoadError(false); })
      .catch(() => { setDesigns([]); setLoadError(true); });
  }, []);

  const categories = [
    { key: 'all', label: 'All' },
    { key: 'sweatpants', label: 'Sweatpants' },
    { key: 'jeans', label: 'Jeans' },
    { key: 'cargo', label: 'Cargos' },
    { key: 'jacket', label: 'Jackets' },
    { key: 'hoodie', label: 'Hoodies' },
    { key: 't-shirt', label: 'Tees' },
    { key: 'shorts', label: 'Shorts' },
  ];

  const filtered = filter === 'all'
    ? designs
    : designs.filter(d => d.garmentType.toLowerCase().includes(filter));

  const categoryCount = (key: string) =>
    key === 'all' ? designs.length : designs.filter(d => d.garmentType.toLowerCase().includes(key)).length;

  return (
    <div className="mx-auto max-w-7xl">
      {/* Hero / Brand Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 text-center"
      >
        {/* Logo */}
        <div className="mb-4 flex justify-center">
          <img
            src="/brand/vaste/logo.png"
            alt="VASTE"
            className={`h-16 object-contain transition-opacity duration-500 ${logoLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setLogoLoaded(true)}
          />
          {!logoLoaded && (
            <h1 className="text-5xl font-black tracking-[0.3em] text-text-primary">VASTE</h1>
          )}
        </div>

        <p className="text-lg font-light tracking-wide text-text-secondary">
          Ultra-Baggy Oversized Streetwear
        </p>
        <p className="mt-1 text-sm text-text-muted">
          Volume. Drape. Silhouette. Every piece designed for maximum width.
        </p>

        {/* Stats */}
        <div className="mt-5 flex items-center justify-center gap-4 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
            {designs.length} Pieces
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-pink-500" />
            {categories.length - 1} Categories
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Factory Ready
          </span>
        </div>
      </motion.div>

      {/* Category Filter */}
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {categories.map(c => {
          const count = categoryCount(c.key);
          return (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                filter === c.key
                  ? 'bg-white text-black shadow-md'
                  : 'border border-border text-text-secondary hover:border-white/30 hover:text-text-primary'
              }`}
            >
              {c.label}
              <span className={`text-[10px] ${filter === c.key ? 'text-black/50' : 'text-text-muted'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Design Grid */}
      {designs.length === 0 ? (
        <div className="rounded-xl border border-border bg-bg-card p-16 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
            <svg className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-text-primary">
            {loadError ? 'Collection Unavailable' : 'Loading Collection...'}
          </p>
          <p className="mt-2 text-sm text-text-muted">
            {loadError ? 'Could not load the VASTE collection. Please refresh.' : 'Designs are being generated. Check back soon.'}
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          {filtered.map((design) => (
            <div
              key={design.id}
              onClick={() => setSelected(design)}
              className="group cursor-pointer overflow-hidden rounded-xl border border-border bg-bg-card transition-all hover:border-white/20 hover:shadow-xl hover:shadow-purple-500/5"
            >
              <div className="relative aspect-[3/4] overflow-hidden bg-bg-primary">
                <img
                  src={`${design.image}?v=1`}
                  alt={design.name || design.garmentType}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                {/* Category pill */}
                <span className="absolute top-2 left-2 rounded-full bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-white/80">
                  {design.garmentType}
                </span>
                {/* Hover ID */}
                <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-mono text-white/60 opacity-0 transition-opacity group-hover:opacity-100">
                  {design.id}
                </span>
              </div>
              <div className="p-3">
                <h3 className="text-xs font-bold text-text-primary truncate">
                  {design.name || design.garmentType}
                </h3>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-text-muted">
                  {design.description}
                </p>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Brand Philosophy */}
      {designs.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-16 mb-8 rounded-2xl border border-border bg-bg-card p-8 text-center"
        >
          <h2 className="text-2xl font-black tracking-wide text-text-primary mb-3">The VASTE Philosophy</h2>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-text-secondary">
            Every piece in the VASTE collection is designed with one principle: maximum volume, zero compromise.
            Ultra-wide legs, dropped shoulders, and open hems that pool at the ankle. No cuffs. No taper.
            Just pure, unfiltered silhouette. Built from heavyweight fabrics that drape naturally,
            each garment is factory-ready with full technical specifications.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/design"
              className="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black transition-all hover:shadow-lg hover:shadow-white/20"
            >
              Design Your Own
            </Link>
            <Link
              href="/techpack"
              className="rounded-full border border-border px-6 py-2.5 text-sm font-semibold text-text-primary transition-all hover:bg-bg-hover"
            >
              Generate Tech Pack
            </Link>
          </div>
        </motion.div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-bg-card"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Image */}
              <div className="relative aspect-square max-h-[50vh] overflow-hidden bg-bg-primary">
                <img
                  src={`${selected.image}?v=1`}
                  alt={selected.name || selected.garmentType}
                  className="h-full w-full object-contain"
                />
                <button
                  onClick={() => setSelected(null)}
                  className="absolute top-3 right-3 rounded-full bg-black/60 p-2 text-white/80 hover:bg-black/80 hover:text-white backdrop-blur-sm transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <span className="absolute top-3 left-3 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1 text-xs font-medium text-white/80">
                  {selected.id}
                </span>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                <div className="mb-4">
                  <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">{selected.garmentType}</span>
                  <h2 className="mt-1 text-xl font-black text-text-primary">{selected.name || selected.garmentType}</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Description</h3>
                    <p className="text-sm leading-relaxed text-text-secondary">{selected.description}</p>
                  </div>
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Manufacturing Specs</h3>
                    <p className="text-xs leading-relaxed text-text-muted">{selected.instructions}</p>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <Link
                    href="/design"
                    className="flex-1 rounded-xl bg-white px-4 py-3 text-center text-sm font-bold text-black transition-all hover:shadow-lg"
                  >
                    Edit in Studio
                  </Link>
                  <Link
                    href="/techpack"
                    className="flex-1 rounded-xl border border-border px-4 py-3 text-center text-sm font-semibold text-text-primary transition-all hover:bg-bg-hover"
                  >
                    Tech Pack
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
