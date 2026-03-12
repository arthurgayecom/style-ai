'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GARMENT_TYPES } from '@/types/mockup';
import type { TechPackData, MockupResult } from '@/types/mockup';
import { getItem } from '@/lib/storage/localStorage';

export default function TechPackPage() {
  const [garmentType, setGarmentType] = useState('T-Shirt');
  const [description, setDescription] = useState('');
  const [selectedMockup, setSelectedMockup] = useState<MockupResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [techPack, setTechPack] = useState<TechPackData | null>(null);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'measurements' | 'construction' | 'materials' | 'color' | 'labels' | 'packaging'>('measurements');

  const mockupHistory: MockupResult[] = getItem('mockup_history', []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    setTechPack(null);

    try {
      const res = await fetch('/api/ai/techpack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garmentType,
          description,
          mockupImage: selectedMockup?.mockupImage || undefined,
          specs: selectedMockup?.specs || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      setTechPack({
        ...data.techPack,
        mockupImage: selectedMockup?.mockupImage || '',
        garmentType,
        date: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportPdf = async () => {
    if (!techPack) return;
    setExporting(true);
    try {
      const { exportTechPackPdf } = await import('@/lib/export/techpackPdf');
      await exportTechPackPdf(techPack);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF export failed');
    } finally {
      setExporting(false);
    }
  };

  const TABS = [
    { key: 'measurements' as const, label: 'Measurements', icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3' },
    { key: 'construction' as const, label: 'Construction', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    { key: 'materials' as const, label: 'BOM', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    { key: 'color' as const, label: 'Colorway', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
    { key: 'labels' as const, label: 'Labels', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
    { key: 'packaging' as const, label: 'Packaging', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  ];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] pb-24">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-3xl font-extrabold text-text-primary">Tech Pack</h1>
        <p className="mt-1 text-sm text-text-muted">Factory-ready production specifications</p>
      </motion.div>

      {!techPack ? (
        /* ═══ INPUT FORM ═══ */
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="rounded-2xl border border-border bg-bg-card p-6 space-y-5">
            <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">Configuration</h2>

            <div>
              <label className="mb-2 block text-xs font-semibold text-text-secondary">Garment Type</label>
              <div className="flex flex-wrap gap-1.5">
                {GARMENT_TYPES.map(type => (
                  <button key={type} onClick={() => setGarmentType(type)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${garmentType === type ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40' : 'border border-border text-text-muted hover:bg-bg-hover'}`}>
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-text-secondary">Design Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your garment in detail: fit, fabric, construction, colors, branding, special features..."
                rows={4}
                className="w-full resize-none rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/40 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400/30" />
            </div>

            {mockupHistory.length > 0 && (
              <div>
                <label className="mb-2 block text-xs font-semibold text-text-secondary">From Your Designs</label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {mockupHistory.filter(m => m.mockupImage).slice(0, 8).map(m => (
                    <button key={m.id}
                      onClick={() => setSelectedMockup(selectedMockup?.id === m.id ? null : m)}
                      className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${selectedMockup?.id === m.id ? 'border-purple-400 ring-2 ring-purple-400/30' : 'border-border hover:border-purple-400/50'}`}>
                      <img src={m.mockupImage} alt={m.garmentType} className="h-full w-full object-cover" />
                      {selectedMockup?.id === m.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-purple-500/20">
                          <svg className="h-4 w-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={handleGenerate} disabled={generating}
            className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Generating Factory Specs...
              </span>
            ) : 'Generate Tech Pack'}
          </button>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</motion.div>
          )}
        </div>
      ) : (
        /* ═══ TECH PACK DISPLAY ═══ */
        <div>
          {/* Header Bar */}
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-border bg-bg-card p-4">
            <div>
              <h2 className="text-lg font-bold text-text-primary">{techPack.styleName || garmentType}</h2>
              <p className="text-xs text-text-muted">Style #{techPack.styleNumber} | {techPack.season} | Base size: {techPack.baseSize}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleExportPdf} disabled={exporting}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-xs font-bold text-white shadow-md disabled:opacity-50">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                {exporting ? 'Exporting...' : 'Export PDF'}
              </button>
              <button onClick={() => setTechPack(null)}
                className="rounded-lg border border-border px-3 py-2 text-xs text-text-muted hover:bg-bg-hover transition-colors">
                New Pack
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mb-4 flex gap-1 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all ${activeTab === tab.key ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40' : 'border border-border text-text-muted hover:bg-bg-hover'}`}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} /></svg>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl border border-border bg-bg-card p-6">

              {/* ── MEASUREMENTS ── */}
              {activeTab === 'measurements' && (
                <div>
                  <h3 className="mb-4 text-sm font-bold text-text-primary">Graded Spec Sheet</h3>
                  {techPack.measurements?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-purple-500/10">
                            <th className="px-3 py-2 text-left font-bold text-text-primary sticky left-0 bg-purple-500/10">POM</th>
                            <th className="px-3 py-2 text-left font-bold text-text-primary">Tolerance</th>
                            {techPack.sizes?.map(s => <th key={s} className="px-3 py-2 text-center font-bold text-text-primary">{s}</th>)}
                            <th className="px-3 py-2 text-left font-bold text-text-primary">Grade Rule</th>
                          </tr>
                        </thead>
                        <tbody>
                          {techPack.measurements.map((m, i) => (
                            <tr key={i} className={`${i % 2 === 0 ? 'bg-bg-primary/30' : ''} hover:bg-bg-hover/50`}>
                              <td className="px-3 py-2 font-medium text-text-primary sticky left-0 bg-inherit" title={m.description}>
                                {m.pom}
                                {m.description && <p className="text-[9px] text-text-muted font-normal mt-0.5">{m.description}</p>}
                              </td>
                              <td className="px-3 py-2 text-text-muted">{m.tolerance}</td>
                              {techPack.sizes?.map(s => (
                                <td key={s} className={`px-3 py-2 text-center ${s === techPack.baseSize ? 'font-bold text-purple-400' : 'text-text-secondary'}`}>
                                  {m.values?.[s] || '—'}
                                </td>
                              ))}
                              <td className="px-3 py-2 text-text-muted text-[10px]">{m.gradingRule || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-sm text-text-muted">No measurements generated</p>}
                </div>
              )}

              {/* ── CONSTRUCTION ── */}
              {activeTab === 'construction' && (
                <div>
                  <h3 className="mb-4 text-sm font-bold text-text-primary">Construction Details</h3>
                  {techPack.constructionDetails?.length > 0 ? (
                    <div className="space-y-3">
                      {techPack.constructionDetails.map((d, i) => (
                        <div key={i} className="rounded-lg border border-border p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[9px] font-bold text-purple-400 uppercase">{d.area}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                            <div><span className="text-text-muted">Stitch:</span> <span className="text-text-primary font-medium">{d.stitchType}</span></div>
                            {d.spiOrGauge && <div><span className="text-text-muted">SPI:</span> <span className="text-text-primary font-medium">{d.spiOrGauge}</span></div>}
                            {d.seamAllowance && <div><span className="text-text-muted">SA:</span> <span className="text-text-primary font-medium">{d.seamAllowance}</span></div>}
                          </div>
                          {d.notes && <p className="mt-1.5 text-[10px] text-text-muted">{d.notes}</p>}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-text-muted">No construction details</p>}

                  {techPack.constructionNotes?.length > 0 && (
                    <div className="mt-6">
                      <h4 className="mb-2 text-xs font-bold text-text-secondary uppercase tracking-wider">General Notes</h4>
                      <ul className="space-y-1.5">
                        {techPack.constructionNotes.map((n, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-text-secondary leading-relaxed">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400/60" />{n}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* ── MATERIALS / BOM ── */}
              {activeTab === 'materials' && (
                <div>
                  <h3 className="mb-4 text-sm font-bold text-text-primary">Bill of Materials</h3>
                  {techPack.materials?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-purple-500/10">
                            <th className="px-3 py-2 text-left font-bold text-text-primary">Component</th>
                            <th className="px-3 py-2 text-left font-bold text-text-primary">Description</th>
                            <th className="px-3 py-2 text-left font-bold text-text-primary">Material</th>
                            <th className="px-3 py-2 text-left font-bold text-text-primary">Color Code</th>
                            <th className="px-3 py-2 text-left font-bold text-text-primary">Qty</th>
                            <th className="px-3 py-2 text-left font-bold text-text-primary">Placement</th>
                          </tr>
                        </thead>
                        <tbody>
                          {techPack.materials.map((m, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-bg-primary/30' : ''}>
                              <td className="px-3 py-2 font-medium text-text-primary">{m.component}</td>
                              <td className="px-3 py-2 text-text-secondary">{m.description}</td>
                              <td className="px-3 py-2 text-text-secondary">{m.material}</td>
                              <td className="px-3 py-2 text-text-muted text-[10px]">{m.colorCode || '—'}</td>
                              <td className="px-3 py-2 text-text-muted">{m.quantity || '—'}</td>
                              <td className="px-3 py-2 text-text-muted">{m.placement}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="text-sm text-text-muted">No materials listed</p>}

                  {techPack.fiberContent && (
                    <p className="mt-4 text-xs text-text-muted">Fiber Content: <span className="font-medium text-text-secondary">{techPack.fiberContent}</span></p>
                  )}
                </div>
              )}

              {/* ── COLORWAY ── */}
              {activeTab === 'color' && (
                <div>
                  <h3 className="mb-4 text-sm font-bold text-text-primary">Colorway Specification</h3>
                  {techPack.colorway?.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {techPack.colorway.map((c, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-3">
                          <div className="h-12 w-12 shrink-0 rounded-lg border border-border shadow-inner" style={{ backgroundColor: c.hex }} />
                          <div>
                            <p className="text-sm font-bold text-text-primary">{c.name}</p>
                            <p className="text-[10px] text-purple-400 font-medium">{c.pantone}</p>
                            <p className="text-[10px] text-text-muted">{c.hex} | {c.component}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-text-muted">No colorway specified</p>}

                  {techPack.artworkPlacements?.length > 0 && (
                    <div className="mt-6">
                      <h4 className="mb-3 text-xs font-bold text-text-secondary uppercase tracking-wider">Artwork Placements</h4>
                      {techPack.artworkPlacements.map((a, i) => (
                        <div key={i} className="mb-2 rounded-lg border border-border p-3">
                          <p className="text-xs font-medium text-text-primary">{a.name}</p>
                          <div className="mt-1 grid grid-cols-2 gap-1 text-[10px]">
                            <span className="text-text-muted">Method: <span className="text-text-secondary">{a.method}</span></span>
                            <span className="text-text-muted">Position: <span className="text-text-secondary">{a.position}</span></span>
                            <span className="text-text-muted">Size: <span className="text-text-secondary">{a.dimensions}</span></span>
                            <span className="text-text-muted">Colors: <span className="text-text-secondary">{a.colorCodes?.join(', ')}</span></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── LABELS ── */}
              {activeTab === 'labels' && (
                <div>
                  <h3 className="mb-4 text-sm font-bold text-text-primary">Labels & Branding</h3>
                  {techPack.labels?.length > 0 ? (
                    <div className="space-y-3">
                      {techPack.labels.map((l, i) => (
                        <div key={i} className="rounded-lg border border-border p-3">
                          <p className="text-xs font-bold text-text-primary">{l.type}</p>
                          <div className="mt-1.5 grid grid-cols-3 gap-2 text-[10px]">
                            <div><span className="text-text-muted">Method:</span> <span className="text-text-secondary">{l.method}</span></div>
                            <div><span className="text-text-muted">Size:</span> <span className="text-text-secondary">{l.dimensions}</span></div>
                            <div><span className="text-text-muted">Placement:</span> <span className="text-text-secondary">{l.placement}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-text-muted">No label specs</p>}

                  {techPack.careInstructions?.length > 0 && (
                    <div className="mt-6">
                      <h4 className="mb-2 text-xs font-bold text-text-secondary uppercase tracking-wider">Care Instructions</h4>
                      <div className="flex flex-wrap gap-2">
                        {techPack.careInstructions.map((c, i) => (
                          <span key={i} className="rounded-full border border-border bg-bg-primary px-3 py-1 text-[10px] text-text-muted">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── PACKAGING ── */}
              {activeTab === 'packaging' && (
                <div>
                  <h3 className="mb-4 text-sm font-bold text-text-primary">Packaging Specification</h3>
                  {techPack.packaging ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-[10px] text-text-muted mb-0.5">Fold Method</p>
                        <p className="text-xs font-medium text-text-primary">{techPack.packaging.foldMethod}</p>
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-[10px] text-text-muted mb-0.5">Poly Bag</p>
                        <p className="text-xs font-medium text-text-primary">{techPack.packaging.polyBag}</p>
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-[10px] text-text-muted mb-0.5">Hangtag</p>
                        <p className="text-xs font-medium text-text-primary">{techPack.packaging.hangtag}</p>
                      </div>
                      <div className="rounded-lg border border-border p-3">
                        <p className="text-[10px] text-text-muted mb-0.5">Tissue Wrap</p>
                        <p className="text-xs font-medium text-text-primary">{techPack.packaging.tissueWrap ? 'Yes' : 'No'}</p>
                      </div>
                      {techPack.packaging.unitsPerCarton && (
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-[10px] text-text-muted mb-0.5">Units per Carton</p>
                          <p className="text-xs font-medium text-text-primary">{techPack.packaging.unitsPerCarton}</p>
                        </div>
                      )}
                    </div>
                  ) : <p className="text-sm text-text-muted">No packaging specs</p>}

                  {techPack.countryOfOrigin && (
                    <p className="mt-4 text-xs text-text-muted">Country of Origin: <span className="font-medium text-text-secondary">{techPack.countryOfOrigin}</span></p>
                  )}

                  {techPack.additionalNotes && (
                    <div className="mt-4">
                      <h4 className="mb-1 text-xs font-bold text-text-secondary uppercase tracking-wider">Additional Notes</h4>
                      <p className="text-xs text-text-muted leading-relaxed">{techPack.additionalNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
