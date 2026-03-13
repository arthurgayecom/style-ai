'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getItem, setItem } from '@/lib/storage/localStorage';
import { fadeInUp, staggerContainer, staggerItem } from '@/lib/animations';
import { toast } from 'sonner';
import type { GeneratedEssay } from '@/types/essay';
import type { MockupResult } from '@/types/mockup';

type Tab = 'designs' | 'essays' | 'presentations';

interface SavedPresentation {
  id: string;
  title: string;
  slideCount: number;
  format: string;
  style: string;
  createdAt: string;
}

export default function HistoryPage() {
  const [tab, setTab] = useState<Tab>('designs');
  const [essays, setEssays] = useState<GeneratedEssay[]>([]);
  const [presentations, setPresentations] = useState<SavedPresentation[]>([]);
  const [designs, setDesigns] = useState<MockupResult[]>([]);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedDesign, setSelectedDesign] = useState<MockupResult | null>(null);

  useEffect(() => {
    setEssays(getItem<GeneratedEssay[]>('generated_essays', []));
    setPresentations(getItem<SavedPresentation[]>('generated_presentations', []));
    setDesigns(getItem<MockupResult[]>('mockup_history', []));
  }, []);

  const deleteEssay = (id: string) => {
    if (!confirm('Delete this essay? This cannot be undone.')) return;
    const updated = essays.filter(e => e.id !== id);
    setEssays(updated);
    setItem('generated_essays', updated);
    toast('Essay deleted');
  };

  const deletePresentation = (id: string) => {
    if (!confirm('Delete this presentation? This cannot be undone.')) return;
    const updated = presentations.filter(p => p.id !== id);
    setPresentations(updated);
    setItem('generated_presentations', updated);
    toast('Presentation deleted');
  };

  const deleteDesign = (id: string) => {
    if (!confirm('Delete this design? This cannot be undone.')) return;
    const updated = designs.filter(d => d.id !== id);
    setDesigns(updated);
    setItem('mockup_history', updated);
    toast('Design deleted');
  };

  const openInStudio = (design: MockupResult) => {
    localStorage.setItem('edit_from_brand', JSON.stringify(design));
    window.location.href = '/design';
  };

  const openTechPack = (design: MockupResult) => {
    localStorage.setItem('techpack_from_design', JSON.stringify(design));
    window.location.href = '/techpack';
  };

  const downloadDesign = (design: MockupResult) => {
    const a = document.createElement('a');
    a.href = design.mockupImage;
    a.download = `${design.garmentType}-${design.id}.png`;
    a.click();
    toast.success('Downloaded');
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

  const filteredDesigns = designs.filter(d =>
    d.garmentType.toLowerCase().includes(search.toLowerCase()) ||
    d.description.toLowerCase().includes(search.toLowerCase())
  ).reverse();

  return (
    <motion.div className="mx-auto max-w-5xl" {...fadeInUp}>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold gradient-text inline-block">History</h1>
        <p className="text-text-secondary">All your designs, essays, and presentations</p>
      </div>

      {/* Tabs + Search */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button onClick={() => setTab('designs')}
            className={`px-5 py-2 text-sm font-medium transition-colors ${tab === 'designs' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-hover'}`}>
            Designs ({designs.length})
          </button>
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

      {/* Designs */}
      {tab === 'designs' && (
        filteredDesigns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <svg className="mx-auto mb-3 h-10 w-10 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
            </svg>
            <p className="text-sm text-text-primary font-medium mb-1">No designs generated yet</p>
            <p className="text-xs text-text-muted">Go to the Design page to create your first garment.</p>
          </div>
        ) : (
          <motion.div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" variants={staggerContainer} initial="initial" animate="animate">
            {filteredDesigns.map((design) => (
              <motion.div key={design.id} variants={staggerItem}
                className="group rounded-xl border border-border bg-bg-card overflow-hidden cursor-pointer hover:border-accent/40 transition-colors"
                style={{ boxShadow: 'var(--card-shadow)' }}
                onClick={() => setSelectedDesign(design)}>
                {design.mockupImage && (
                  <div className="aspect-[3/4] overflow-hidden bg-bg-primary">
                    <img src={design.mockupImage} alt={design.garmentType} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                )}
                <div className="p-3">
                  <span className="text-[10px] font-medium text-accent uppercase tracking-wider">{design.garmentType}</span>
                  <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">{design.description}</p>
                  <p className="text-[10px] text-text-muted mt-1">{new Date(design.createdAt).toLocaleDateString()}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )
      )}

      {/* Design Detail Modal */}
      <AnimatePresence>
        {selectedDesign && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
            onClick={() => setSelectedDesign(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-bg-card"
              onClick={e => e.stopPropagation()}
            >
              {selectedDesign.mockupImage && (
                <div className="relative aspect-square max-h-[50vh] overflow-hidden bg-bg-primary">
                  <img src={selectedDesign.mockupImage} alt={selectedDesign.garmentType} className="h-full w-full object-contain" />
                  <button
                    onClick={() => setSelectedDesign(null)}
                    className="absolute top-3 right-3 rounded-full bg-black/60 p-2 text-white/80 hover:bg-black/80 backdrop-blur-sm"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              <div className="p-5">
                <span className="text-xs font-medium text-accent uppercase tracking-wider">{selectedDesign.garmentType}</span>
                <p className="mt-1 text-sm text-text-secondary leading-relaxed">{selectedDesign.description}</p>
                {selectedDesign.specs && (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    {selectedDesign.specs.fit && <div><span className="text-text-muted">Fit:</span> <span className="text-text-primary">{selectedDesign.specs.fit}</span></div>}
                    {selectedDesign.specs.fabric && <div><span className="text-text-muted">Fabric:</span> <span className="text-text-primary">{selectedDesign.specs.fabric}</span></div>}
                    {selectedDesign.specs.weight && <div><span className="text-text-muted">Weight:</span> <span className="text-text-primary">{selectedDesign.specs.weight}</span></div>}
                    {selectedDesign.specs.colors?.length > 0 && <div><span className="text-text-muted">Colors:</span> <span className="text-text-primary">{selectedDesign.specs.colors.join(', ')}</span></div>}
                  </div>
                )}
                <p className="mt-2 text-[10px] text-text-muted">{new Date(selectedDesign.createdAt).toLocaleDateString()}</p>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button onClick={() => openInStudio(selectedDesign)} className="rounded-xl bg-white px-3 py-2.5 text-center text-xs font-bold text-black hover:shadow-lg transition-all">
                    Edit in Studio
                  </button>
                  <button onClick={() => openTechPack(selectedDesign)} className="rounded-xl border border-border px-3 py-2.5 text-center text-xs font-semibold text-text-primary hover:bg-bg-hover transition-all">
                    Tech Pack
                  </button>
                  <button onClick={() => downloadDesign(selectedDesign)} className="rounded-xl border border-border px-3 py-2.5 text-center text-xs font-semibold text-text-primary hover:bg-bg-hover transition-all">
                    Download
                  </button>
                </div>
                <button
                  onClick={() => { deleteDesign(selectedDesign.id); setSelectedDesign(null); }}
                  className="mt-2 w-full rounded-xl border border-red-500/20 px-3 py-2 text-center text-xs text-red-400 hover:bg-red-500/10 transition-all"
                >
                  Delete Design
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
