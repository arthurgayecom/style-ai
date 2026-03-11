'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useEssays } from '@/hooks/useEssays';
import { useStyleProfile } from '@/hooks/useStyleProfile';
import { useAIProvider } from '@/hooks/useAIProvider';
import { calculateConfidence, getRecommendation, getConfidenceColor } from '@/lib/analysis/confidence';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { fadeInUp, staggerItem } from '@/lib/animations';
import { toast } from 'sonner';
import type { UploadedEssay } from '@/types/essay';

const ACCEPTED_TYPES = {
  'text/plain': '.txt',
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

export default function UploadPage() {
  const { essays, addEssay, updateEssay, removeEssay } = useEssays();
  const { profile, updateProfile } = useStyleProfile();
  const { providers, activeProvider } = useAIProvider();
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [pasteSubmitting, setPasteSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const totalWords = essays.reduce((sum, e) => sum + e.wordCount, 0);
  const analyzedCount = essays.filter((e) => e.status === 'analyzed').length;
  const confidence = calculateConfidence(analyzedCount, totalWords);

  const getProviderConfig = () => {
    if (!activeProvider) return null;
    return providers[activeProvider];
  };

  const processFile = async (file: File) => {
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_SIZE) {
      toast.error(`${file.name} is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`);
      return;
    }

    const id = crypto.randomUUID();
    let text = '';
    let sourceType: 'text' | 'pdf' | 'image' = 'text';

    try {
      if (file.type === 'text/plain') {
        text = await file.text();
        sourceType = 'text';
      } else if (file.type === 'application/pdf') {
        sourceType = 'pdf';
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/pdf', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        text = data.text;
      } else if (file.type.startsWith('image/')) {
        sourceType = 'image';
        const config = getProviderConfig();
        if (!config) throw new Error('No AI provider configured');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('providerConfig', JSON.stringify(config));
        const res = await fetch('/api/ai/ocr', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        text = data.text;
      } else {
        throw new Error(`Unsupported file type: ${file.type}`);
      }

      if (!text.trim()) throw new Error('No text content found in file');

      const essay: UploadedEssay = {
        id,
        title: file.name.replace(/\.[^.]+$/, '') || 'Untitled',
        text,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        uploadedAt: new Date().toISOString(),
        sourceType,
        status: 'pending',
      };

      addEssay(essay);
      toast.success(`Uploaded: ${essay.title} (${essay.wordCount} words)`);

      // Auto-analyze
      await analyzeEssay(essay);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast.error(msg);
    }
  };

  const handlePasteSubmit = async () => {
    const text = pasteText.trim();
    if (!text) { toast.error('Paste or type some text first'); return; }

    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount < 50) { toast.error('Text is too short — need at least 50 words for analysis'); return; }

    setPasteSubmitting(true);

    const essay: UploadedEssay = {
      id: crypto.randomUUID(),
      title: pasteTitle.trim() || `Essay (${wordCount} words)`,
      text,
      wordCount,
      uploadedAt: new Date().toISOString(),
      sourceType: 'text',
      status: 'pending',
    };

    addEssay(essay);
    toast.success(`Added: ${essay.title} (${wordCount} words)`);

    await analyzeEssay(essay);

    setPasteTitle('');
    setPasteText('');
    setPasteSubmitting(false);
  };

  const analyzeEssay = async (essay: UploadedEssay) => {
    const config = getProviderConfig();
    if (!config) {
      toast.error('No AI provider configured');
      return;
    }

    setAnalyzing(essay.id);
    updateEssay(essay.id, { status: 'analyzing' });

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'analyze',
          essayText: essay.text,
          providerConfig: config,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Analysis failed (${res.status})`);
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      updateEssay(essay.id, { status: 'analyzed', analysis: data.analysis });
      toast.success(`Analyzed: ${essay.title}`);

      // Check if we should aggregate
      const allEssays = [...essays.filter((e) => e.id !== essay.id && e.status === 'analyzed'), { ...essay, analysis: data.analysis }];
      if (allEssays.length >= 2) {
        await aggregateProfiles(allEssays.map((e) => e.analysis).filter(Boolean), allEssays);
      } else {
        // Single essay — update profile with individual analysis
        const wc = allEssays.reduce((s, e) => s + e.wordCount, 0);
        updateProfile({
          id: 'main',
          essayCount: allEssays.length,
          totalWordCount: wc,
          confidence: calculateConfidence(allEssays.length, wc),
          dimensions: data.analysis,
          fingerprint: 'Upload more essays for a complete style fingerprint.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      updateEssay(essay.id, { status: 'error', error: msg });
      toast.error(msg);
    }

    setAnalyzing(null);
  };

  const aggregateProfiles = async (analyses: unknown[], allEssays: UploadedEssay[]) => {
    const config = getProviderConfig();
    if (!config) return;

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'aggregate',
          analyses,
          providerConfig: config,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn('Aggregation failed:', err.error || res.status);
        return;
      }
      const data = await res.json();
      if (data.error) {
        console.warn('Aggregation failed:', data.error);
        return;
      }

      const wc = allEssays.reduce((s, e) => s + e.wordCount, 0);
      updateProfile({
        id: 'main',
        essayCount: allEssays.length,
        totalWordCount: wc,
        confidence: calculateConfidence(allEssays.length, wc),
        dimensions: data.dimensions,
        fingerprint: data.fingerprint,
      });
    } catch (err) {
      console.warn('Aggregation error:', err);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(processFile);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [essays, activeProvider, providers]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(processFile);
    if (inputRef.current) inputRef.current.value = '';
  };

  const pasteWordCount = pasteText.trim() ? pasteText.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <motion.div className="mx-auto max-w-3xl" {...fadeInUp}>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold gradient-text inline-block">Upload Your Essays</h1>
        <p className="text-text-secondary">
          Upload or paste essays you&apos;ve written so the AI can learn your unique style.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-6 rounded-xl border border-border bg-bg-card p-4" style={{ boxShadow: 'var(--card-shadow)' }}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">
            {analyzedCount} essay{analyzedCount !== 1 ? 's' : ''} analyzed
          </span>
          <span className={`text-sm font-bold ${getConfidenceColor(confidence)}`}>
            {confidence}% confidence
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-bg-hover">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent to-accent-secondary"
            initial={{ width: 0 }}
            animate={{ width: `${confidence}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <p className="mt-2 text-xs text-text-muted">{getRecommendation(confidence, analyzedCount)}</p>
      </div>

      {/* Input mode toggle */}
      <div className="mb-4 flex rounded-lg border border-border overflow-hidden">
        <button onClick={() => setInputMode('file')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${inputMode === 'file' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-hover'}`}>
          Upload File
        </button>
        <button onClick={() => setInputMode('text')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${inputMode === 'text' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-hover'}`}>
          Paste Text
        </button>
      </div>

      {/* File upload mode */}
      {inputMode === 'file' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`mb-6 cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all ${
            dragging
              ? 'border-accent bg-accent/5'
              : 'border-border hover:border-text-muted hover:bg-bg-card'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".txt,.pdf,.png,.jpg,.jpeg,.webp"
            onChange={handleFileSelect}
            className="hidden"
          />
          <svg className="mx-auto mb-3 h-10 w-10 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-text-secondary">
            <span className="font-medium text-accent">Click to upload</span> or drag and drop
          </p>
          <p className="mt-1 text-xs text-text-muted">
            TXT, PDF, PNG, JPG (essays, papers, presentations)
          </p>
        </div>
      )}

      {/* Text paste mode */}
      {inputMode === 'text' && (
        <div className="mb-6 rounded-xl border border-border bg-bg-card p-5 space-y-4" style={{ boxShadow: 'var(--card-shadow)' }}>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Title (optional)</label>
            <input
              type="text"
              value={pasteTitle}
              onChange={(e) => setPasteTitle(e.target.value)}
              placeholder="e.g. My History Essay"
              className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-ring"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium text-text-primary">Essay Text</label>
              {pasteWordCount > 0 && (
                <span className={`text-xs font-medium ${pasteWordCount >= 50 ? 'text-success' : 'text-warning'}`}>
                  {pasteWordCount} words {pasteWordCount < 50 && '(min 50)'}
                </span>
              )}
            </div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste or type your essay here..."
              rows={10}
              className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-ring resize-y leading-relaxed"
            />
          </div>
          <button
            onClick={handlePasteSubmit}
            disabled={pasteSubmitting || pasteWordCount < 50}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {pasteSubmitting ? <><LoadingSpinner className="h-4 w-4" /> Adding &amp; Analyzing...</> : 'Add & Analyze'}
          </button>
        </div>
      )}

      {/* Essay list */}
      {essays.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">Uploaded Essays</h2>
          <AnimatePresence>
          {essays.map((essay) => (
            <motion.div
              key={essay.id}
              className="flex items-center justify-between rounded-xl border border-border bg-bg-card p-4 transition-all hover:border-text-muted"
              style={{ boxShadow: 'var(--card-shadow)' }}
              {...staggerItem}
              layout
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                  essay.sourceType === 'text' ? 'bg-accent/10 text-accent' :
                  essay.sourceType === 'pdf' ? 'bg-error/10 text-error' :
                  'bg-success/10 text-success'
                }`}>
                  {essay.sourceType === 'text' ? 'TXT' : essay.sourceType === 'pdf' ? 'PDF' : 'IMG'}
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{essay.title}</p>
                  <p className="text-xs text-text-muted">{essay.wordCount} words</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {essay.status === 'pending' && (
                  <span className="rounded-full bg-bg-hover px-2 py-0.5 text-xs text-text-muted">Pending</span>
                )}
                {essay.status === 'analyzing' && (
                  <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                    <LoadingSpinner className="h-3 w-3" />
                    Analyzing
                  </span>
                )}
                {essay.status === 'analyzed' && (
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">Analyzed</span>
                )}
                {essay.status === 'error' && (
                  <span className="rounded-full bg-error/10 px-2 py-0.5 text-xs text-error" title={essay.error}>Error</span>
                )}
                <button
                  onClick={() => { removeEssay(essay.id); toast('Essay removed'); }}
                  className="rounded p-1 text-text-muted transition-colors hover:bg-error/10 hover:text-error"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ))}
          </AnimatePresence>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex justify-between">
        <button
          onClick={() => router.push('/setup')}
          className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary transition-all hover:bg-bg-hover"
        >
          Back to Setup
        </button>
        <div className="flex gap-3">
          {analyzedCount > 0 && (
            <button
              onClick={() => router.push('/profile')}
              className="rounded-lg border border-accent px-6 py-2.5 text-sm font-medium text-accent transition-all hover:bg-accent/10"
            >
              View Profile
            </button>
          )}
          <button
            onClick={() => router.push('/write')}
            disabled={confidence < 40}
            className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Start Writing
          </button>
        </div>
      </div>
    </motion.div>
  );
}
