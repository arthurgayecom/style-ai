'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getItem, setItem } from '@/lib/storage/localStorage';
import { fadeInUp, staggerContainer, staggerItem } from '@/lib/animations';
import { toast } from 'sonner';
import type { GeneratedEssay } from '@/types/essay';

type Tab = 'essays' | 'presentations';

interface SavedPresentation {
  id: string;
  title: string;
  slideCount: number;
  format: string;
  style: string;
  createdAt: string;
}

export default function HistoryPage() {
  const [tab, setTab] = useState<Tab>('essays');
  const [essays, setEssays] = useState<GeneratedEssay[]>([]);
  const [presentations, setPresentations] = useState<SavedPresentation[]>([]);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setEssays(getItem<GeneratedEssay[]>('generated_essays', []));
    setPresentations(getItem<SavedPresentation[]>('generated_presentations', []));
  }, []);

  const deleteEssay = (id: string) => {
    const updated = essays.filter(e => e.id !== id);
    setEssays(updated);
    setItem('generated_essays', updated);
    toast('Essay deleted');
  };

  const deletePresentation = (id: string) => {
    const updated = presentations.filter(p => p.id !== id);
    setPresentations(updated);
    setItem('generated_presentations', updated);
    toast('Presentation deleted');
  };

  const copyEssay = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const filteredEssays = essays.filter(e =>
    e.topic.toLowerCase().includes(search.toLowerCase()) ||
    e.essayType.toLowerCase().includes(search.toLowerCase())
  ).reverse();

  const filteredPresentations = presentations.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase())
  ).reverse();

  return (
    <motion.div className="mx-auto max-w-4xl" {...fadeInUp}>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold gradient-text inline-block">History</h1>
        <p className="text-text-secondary">All your generated essays and presentations</p>
      </div>

      {/* Tabs + Search */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button onClick={() => setTab('essays')}
            className={`px-5 py-2 text-sm font-medium transition-colors ${tab === 'essays' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-hover'}`}>
            Essays ({essays.length})
          </button>
          <button onClick={() => setTab('presentations')}
            className={`px-5 py-2 text-sm font-medium transition-colors ${tab === 'presentations' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-hover'}`}>
            Presentations ({presentations.length})
          </button>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-ring sm:w-64"
        />
      </div>

      {/* Essays */}
      {tab === 'essays' && (
        filteredEssays.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <svg className="mx-auto mb-3 h-10 w-10 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-sm text-text-primary font-medium mb-1">No essays generated yet</p>
            <p className="text-xs text-text-muted">Go to the Write page to create your first essay.</p>
          </div>
        ) : (
          <motion.div className="space-y-3" variants={staggerContainer} initial="initial" animate="animate">
            <AnimatePresence>
              {filteredEssays.map((essay) => (
                <motion.div key={essay.id} variants={staggerItem} layout
                  className="rounded-xl border border-border bg-bg-card overflow-hidden"
                  style={{ boxShadow: 'var(--card-shadow)' }}>
                  <div className="flex items-center justify-between p-4">
                    <button onClick={() => setExpandedId(expandedId === essay.id ? null : essay.id)} className="flex-1 text-left">
                      <p className="text-sm font-semibold text-text-primary">{essay.topic}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {essay.essayType} | {essay.wordCount} words | {new Date(essay.generatedAt).toLocaleDateString()}
                      </p>
                    </button>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {essay.styleMatchScore !== undefined && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          essay.styleMatchScore >= 80 ? 'bg-success/10 text-success' :
                          essay.styleMatchScore >= 60 ? 'bg-warning/10 text-warning' : 'bg-error/10 text-error'
                        }`}>{essay.styleMatchScore}%</span>
                      )}
                      <button onClick={() => copyEssay(essay.text)} className="rounded p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary" title="Copy">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </button>
                      <button onClick={() => deleteEssay(essay.id)} className="rounded p-1.5 text-text-muted hover:bg-error/10 hover:text-error" title="Delete">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                      <svg className={`h-4 w-4 text-text-muted transition-transform ${expandedId === essay.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                  <AnimatePresence>
                    {expandedId === essay.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-border"
                      >
                        <div className="p-4 bg-bg-secondary">
                          <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                            {essay.text}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )
      )}

      {/* Presentations */}
      {tab === 'presentations' && (
        filteredPresentations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <svg className="mx-auto mb-3 h-10 w-10 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
            </svg>
            <p className="text-sm text-text-primary font-medium mb-1">No presentations generated yet</p>
            <p className="text-xs text-text-muted">Go to the Present page to create your first presentation.</p>
          </div>
        ) : (
          <motion.div className="grid gap-3 sm:grid-cols-2" variants={staggerContainer} initial="initial" animate="animate">
            {filteredPresentations.map((pres) => (
              <motion.div key={pres.id} variants={staggerItem}
                className="rounded-xl border border-border bg-bg-card p-4"
                style={{ boxShadow: 'var(--card-shadow)' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{pres.title}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {pres.slideCount} slides | {pres.format} | {pres.style}
                    </p>
                    <p className="text-xs text-text-muted">{new Date(pres.createdAt).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => deletePresentation(pres.id)} className="rounded p-1.5 text-text-muted hover:bg-error/10 hover:text-error">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )
      )}
    </motion.div>
  );
}
