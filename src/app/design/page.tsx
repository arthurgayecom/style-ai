'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GARMENT_TYPES, PART_LABELS } from '@/types/mockup';
import type { ReferenceImage, PartLabel, DesignQuestion, DesignAnswer, MockupResult, DesignStep, CanvasAnnotation } from '@/types/mockup';
import { getItem, setItem } from '@/lib/storage/localStorage';
import DesignCanvas from '@/components/canvas/DesignCanvas';

const MAX_IMAGES = 6;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const STEPS: { key: DesignStep; label: string }[] = [
  { key: 'upload', label: 'References' },
  { key: 'annotate', label: 'Annotate' },
  { key: 'parts', label: 'Pick Parts' },
  { key: 'questions', label: 'Details' },
  { key: 'generate', label: 'Generate' },
  { key: 'review', label: 'Review & Edit' },
];

export default function DesignPage() {
  // Wizard
  const [step, setStep] = useState<DesignStep>('upload');
  const [garmentType, setGarmentType] = useState('T-Shirt');
  const [detecting, setDetecting] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);

  // Step 1: References
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Part picking (handled within references)

  // Step 3: Q&A
  const [questions, setQuestions] = useState<DesignQuestion[]>([]);
  const [answers, setAnswers] = useState<DesignAnswer[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Step 4: Generate
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<MockupResult | null>(() => {
    // Check if coming from brand page with a design to edit
    if (typeof window !== 'undefined') {
      const brandData = localStorage.getItem('edit_from_brand');
      if (brandData) {
        localStorage.removeItem('edit_from_brand');
        try {
          const parsed = JSON.parse(brandData);
          // Need to convert relative image URL to full data URL for editing
          // For now, store the URL — the edit flow will handle it
          return parsed as MockupResult;
        } catch { /* ignore */ }
      }
    }
    return null;
  });

  // If we loaded from brand page, jump to review step
  const [initializedFromBrand] = useState(() => {
    if (typeof window !== 'undefined') {
      const hadBrand = result !== null && result.id?.startsWith('brand-');
      return hadBrand;
    }
    return false;
  });

  // Step 5: Review & Edit
  const [editText, setEditText] = useState('');
  const [editing, setEditing] = useState(false);

  // Canvas annotations
  const [preGenAnnotations, setPreGenAnnotations] = useState<CanvasAnnotation[]>([]);
  const [preGenCanvasImage, setPreGenCanvasImage] = useState<string>('');
  const [postGenAnnotations, setPostGenAnnotations] = useState<CanvasAnnotation[]>([]);
  const [postGenCanvasImage, setPostGenCanvasImage] = useState<string>('');
  const [showPostGenCanvas, setShowPostGenCanvas] = useState(false);

  // Shared
  const [error, setError] = useState('');
  const [extraInstructions, setExtraInstructions] = useState('');
  const [history, setHistory] = useState<MockupResult[]>(() => getItem('mockup_history', []));
  const [showHistory, setShowHistory] = useState(false);

  // Template browser (VASTE collection as mockup bases)
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; garmentType: string; name: string; image: string; description: string }[]>([]);
  const [templateFilter, setTemplateFilter] = useState('all');
  const templatesLoaded = useRef(false);

  const loadTemplates = useCallback(() => {
    if (templatesLoaded.current) { setShowTemplates(true); return; }
    fetch('/brand/vaste/collection.json')
      .then(r => r.ok ? r.json() : [])
      .then(data => { setTemplates(data); templatesLoaded.current = true; setShowTemplates(true); })
      .catch(() => setTemplates([]));
  }, []);

  const addTemplateAsRef = useCallback(async (tpl: { image: string; garmentType: string; name: string }) => {
    // Fetch the template image and convert to data URL
    try {
      const res = await fetch(tpl.image);
      if (!res.ok) return;
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setReferences(prev => {
          if (prev.length >= MAX_IMAGES) return prev;
          return [...prev, {
            id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            dataUrl,
            filename: tpl.name,
            parts: [],
            notes: '',
          }];
        });
        setGarmentType(tpl.garmentType);
        setAutoDetected(true);
        setShowTemplates(false);
      };
      reader.readAsDataURL(blob);
    } catch { /* ignore fetch errors */ }
  }, []);

  // Design Preferences (persisted to localStorage)
  const [showPrefs, setShowPrefs] = useState(false);
  const [preferences, setPreferences] = useState<Record<string, string>>(() =>
    getItem('design_preferences', {
      fit: '',
      hemStyle: '',
      weight: '',
      aesthetic: '',
      avoid: '',
    })
  );
  const updatePref = (key: string, value: string) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setItem('design_preferences', next);
  };

  // If loaded from brand page, jump to review step with that design
  useEffect(() => {
    if (initializedFromBrand && result) {
      setStep('review');
      if (result.garmentType) setGarmentType(result.garmentType);
      // Convert relative URL to base64 data URL so edit API can send it to Gemini
      if (result.mockupImage && !result.mockupImage.startsWith('data:')) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d')?.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          setResult(prev => prev ? { ...prev, mockupImage: dataUrl } : prev);
        };
        img.src = result.mockupImage;
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-detect garment type from image ──
  const detectGarmentType = useCallback(async (dataUrl: string) => {
    if (autoDetected) return; // only auto-detect once per session
    setDetecting(true);
    try {
      const res = await fetch('/api/ai/mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'detect', image: dataUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.garmentType && data.confidence > 0.3) {
          setGarmentType(data.garmentType);
          setAutoDetected(true);
        }
      }
    } catch { /* detection is best-effort */ }
    setDetecting(false);
  }, [autoDetected]);

  // ── Step 1: Upload References ──
  const addImages = useCallback((files: FileList | File[]) => {
    const fileArr = Array.from(files);
    let isFirst = references.length === 0;
    for (const file of fileArr) {
      if (references.length >= MAX_IMAGES) break;
      if (!file.type.startsWith('image/')) continue;
      if (file.size > MAX_FILE_SIZE) { setError(`"${file.name}" is too large (max 5MB)`); continue; }
      const reader = new FileReader();
      const shouldDetect = isFirst;
      isFirst = false;
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setReferences(prev => {
          if (prev.length >= MAX_IMAGES) return prev;
          return [...prev, { id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, dataUrl, filename: file.name, parts: [], notes: '' }];
        });
        // Auto-detect garment type from the first uploaded image
        if (shouldDetect) detectGarmentType(dataUrl);
      };
      reader.readAsDataURL(file);
    }
    setError('');
  }, [references.length, detectGarmentType]);

  const removeRef = (id: string) => setReferences(prev => prev.filter(r => r.id !== id));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) addImages(e.dataTransfer.files);
  };

  // ── Step 2: Part Picking ──
  const togglePart = (refId: string, part: PartLabel) => {
    setReferences(prev => prev.map(r => {
      if (r.id !== refId) return r;
      const parts = r.parts.includes(part) ? r.parts.filter(p => p !== part) : [...r.parts, part];
      return { ...r, parts };
    }));
  };

  const updateRefNotes = (refId: string, notes: string) => {
    setReferences(prev => prev.map(r => r.id === refId ? { ...r, notes } : r));
  };

  // ── Step 3: Q&A ──
  const generateQuestions = async () => {
    setLoadingQuestions(true);
    setError('');
    try {
      const partsSummary = references
        .filter(r => r.parts.length > 0)
        .map(r => `Image "${r.filename}": taking ${r.parts.join(', ')}${r.notes ? ` (${r.notes})` : ''}`)
        .join('; ');

      const res = await fetch('/api/ai/mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'questions',
          garmentType,
          partsSummary,
          referenceImages: references.map(r => ({ dataUrl: r.dataUrl, parts: r.parts, notes: r.notes })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate questions');
      setQuestions(data.questions || []);
      setAnswers((data.questions || []).map((q: DesignQuestion) => ({ questionId: q.id, answer: q.type === 'multi-select' ? [] : '' })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate questions');
    } finally {
      setLoadingQuestions(false);
    }
  };

  const updateAnswer = (questionId: string, answer: string | string[]) => {
    setAnswers(prev => prev.map(a => a.questionId === questionId ? { ...a, answer } : a));
  };

  // ── Step 4: Generate ──
  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    setResult(null);

    try {
      const activePrefs = Object.fromEntries(
        Object.entries(preferences).filter(([, v]) => v && v.trim())
      );
      const res = await fetch('/api/ai/mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'generate',
          referenceImages: references.map(r => ({ dataUrl: r.dataUrl, parts: r.parts, notes: r.notes })),
          garmentType,
          answers,
          instructions: extraInstructions,
          quality: 'high',
          preferences: Object.keys(activePrefs).length > 0 ? activePrefs : undefined,
          canvasAnnotations: preGenAnnotations.length > 0 ? preGenAnnotations : undefined,
          canvasImage: preGenCanvasImage || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      const newResult: MockupResult = {
        id: `mockup-${Date.now()}`,
        mockupImage: data.mockupImage || '',
        description: data.description || '',
        garmentType,
        createdAt: new Date().toISOString(),
        specs: data.specs,
      };
      setResult(newResult);

      const updated = [newResult, ...history].slice(0, 30);
      setHistory(updated);
      setItem('mockup_history', updated);

      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setGenerating(false);
    }
  };

  // ── Step 5: Edit / Remix ──
  const handleEdit = async () => {
    if ((!editText.trim() && postGenAnnotations.length === 0) || !result?.mockupImage) return;
    setEditing(true);
    setError('');

    try {
      const activePrefs = Object.fromEntries(
        Object.entries(preferences).filter(([, v]) => v && v.trim())
      );
      // Build edit instructions from text + canvas annotations
      let fullEditInstructions = editText.trim();
      if (postGenAnnotations.length > 0) {
        const textLabels = postGenAnnotations
          .filter(a => a.tool === 'text')
          .map(a => (a as CanvasAnnotation & { text: string }).text)
          .filter(Boolean);
        if (textLabels.length > 0 && !fullEditInstructions) {
          fullEditInstructions = textLabels.join('. ');
        }
      }

      const res = await fetch('/api/ai/mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'edit',
          mockupImage: result.mockupImage,
          editInstructions: fullEditInstructions,
          garmentType,
          description: result.description,
          specs: result.specs,
          preferences: Object.keys(activePrefs).length > 0 ? activePrefs : undefined,
          canvasAnnotations: postGenAnnotations.length > 0 ? postGenAnnotations : undefined,
          canvasImage: postGenCanvasImage || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Edit failed');

      const edited: MockupResult = {
        ...result,
        id: `mockup-${Date.now()}`,
        mockupImage: data.mockupImage || result.mockupImage,
        description: data.description || result.description,
        createdAt: new Date().toISOString(),
        specs: data.specs || result.specs,
      };
      setResult(edited);
      setEditText('');

      const updated = [edited, ...history].slice(0, 30);
      setHistory(updated);
      setItem('mockup_history', updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Edit failed');
    } finally {
      setEditing(false);
    }
  };

  // ── Navigation ──
  const stepIndex = STEPS.findIndex(s => s.key === step);
  const canNext = () => {
    if (step === 'upload') return references.length > 0;
    if (step === 'annotate') return true; // annotate is optional
    if (step === 'parts') return true;
    if (step === 'questions') return true;
    return false;
  };

  const goNext = () => {
    if (step === 'upload') setStep('annotate');
    else if (step === 'annotate') setStep('parts');
    else if (step === 'parts') { setStep('questions'); if (questions.length === 0) generateQuestions(); }
    else if (step === 'questions') { setStep('generate'); handleGenerate(); }
  };

  const goBack = () => {
    if (step === 'annotate') setStep('upload');
    else if (step === 'parts') setStep('annotate');
    else if (step === 'questions') setStep('parts');
    else if (step === 'generate') setStep('questions');
    else if (step === 'review') setStep('questions');
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] pb-24">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-text-primary">Design Studio</h1>
            <p className="mt-1 text-sm text-text-muted">Factory-ready clothing design with AI</p>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            History ({history.length})
          </button>
        </div>
      </motion.div>

      {/* Progress Steps */}
      <div className="mb-8 flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center flex-1">
            <button
              onClick={() => { if (i < stepIndex) setStep(s.key); }}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all w-full ${
                s.key === step
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                  : i < stepIndex
                    ? 'bg-green-500/10 text-green-400 border border-green-500/30 cursor-pointer hover:bg-green-500/20'
                    : 'border border-border text-text-muted'
              }`}
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                i < stepIndex ? 'bg-green-500/30 text-green-400' : s.key === step ? 'bg-purple-500/30 text-purple-300' : 'bg-bg-hover text-text-muted'
              }`}>
                {i < stepIndex ? '✓' : i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className="mx-1 h-px w-4 bg-border shrink-0" />}
          </div>
        ))}
      </div>

      {/* Garment Type Selector (always visible except review) */}
      {step !== 'review' && step !== 'generate' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
          <div className="mb-2 flex items-center gap-2">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider">Garment Type</label>
            {detecting && (
              <span className="flex items-center gap-1.5 text-[10px] text-purple-400 animate-pulse">
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Auto-detecting...
              </span>
            )}
            {autoDetected && !detecting && (
              <span className="text-[10px] text-green-400">Auto-detected</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {GARMENT_TYPES.map(type => (
              <button
                key={type}
                onClick={() => { setGarmentType(type); setAutoDetected(false); }}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
                  garmentType === type
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                    : 'border border-border text-text-muted hover:bg-bg-hover hover:text-text-secondary'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Design Preferences (collapsible) */}
      {step !== 'review' && step !== 'generate' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
          <button
            onClick={() => setShowPrefs(!showPrefs)}
            className="flex items-center gap-2 text-xs font-semibold text-text-muted hover:text-text-secondary transition-colors"
          >
            <svg className={`h-3 w-3 transition-transform ${showPrefs ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            Style Preferences
            {Object.values(preferences).some(v => v.trim()) && (
              <span className="rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[9px] text-purple-400">Active</span>
            )}
          </button>
          <AnimatePresence>
            {showPrefs && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-text-muted uppercase tracking-wider">Default Fit</label>
                    <select
                      value={preferences.fit || ''}
                      onChange={(e) => updatePref('fit', e.target.value)}
                      className="w-full rounded-lg border border-border bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:border-purple-400 focus:outline-none"
                    >
                      <option value="">Not set</option>
                      <option value="Same fit as reference image — match the exact silhouette and proportions from the uploaded reference">Similar to Reference Image</option>
                      <option value="Ultra baggy oversized wide-leg">Ultra Baggy / Oversized</option>
                      <option value="Relaxed oversized">Relaxed Oversized</option>
                      <option value="Regular fit">Regular Fit</option>
                      <option value="Slim fit">Slim Fit</option>
                      <option value="Boxy cropped">Boxy / Cropped</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-text-muted uppercase tracking-wider">Hem / Cuffs</label>
                    <select
                      value={preferences.hemStyle || ''}
                      onChange={(e) => updatePref('hemStyle', e.target.value)}
                      className="w-full rounded-lg border border-border bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:border-purple-400 focus:outline-none"
                    >
                      <option value="">Not set</option>
                      <option value="Open straight-cut hem, NO elastic cuffs">Open / Straight Cut (No Cuffs)</option>
                      <option value="Elastic ribbed cuffs at ankles">Elastic Ribbed Cuffs</option>
                      <option value="Raw edge hem">Raw Edge</option>
                      <option value="Split hem">Split Hem</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-text-muted uppercase tracking-wider">Fabric Weight</label>
                    <select
                      value={preferences.weight || ''}
                      onChange={(e) => updatePref('weight', e.target.value)}
                      className="w-full rounded-lg border border-border bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:border-purple-400 focus:outline-none"
                    >
                      <option value="">Not set</option>
                      <option value="Lightweight fabric 130-160 GSM">Lightweight (130-160 GSM)</option>
                      <option value="Midweight fabric 180-220 GSM">Midweight (180-220 GSM)</option>
                      <option value="Heavyweight fabric 280-320 GSM">Heavyweight (280-320 GSM)</option>
                      <option value="Premium heavyweight fabric 350+ GSM">Premium Heavy (350+ GSM)</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-text-muted uppercase tracking-wider">Aesthetic</label>
                    <select
                      value={preferences.aesthetic || ''}
                      onChange={(e) => updatePref('aesthetic', e.target.value)}
                      className="w-full rounded-lg border border-border bg-bg-primary px-2 py-1.5 text-xs text-text-primary focus:border-purple-400 focus:outline-none"
                    >
                      <option value="">Not set</option>
                      <option value="Streetwear, oversized silhouettes, bold graphics">Streetwear</option>
                      <option value="Minimalist clean, no logos, muted tones">Minimalist</option>
                      <option value="Vintage retro washed distressed">Vintage / Retro</option>
                      <option value="Luxury high-end premium fabrics">Luxury</option>
                      <option value="Athletic sportswear performance">Athletic</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-[10px] font-bold text-text-muted uppercase tracking-wider">Always Avoid</label>
                    <input
                      type="text"
                      value={preferences.avoid || ''}
                      onChange={(e) => updatePref('avoid', e.target.value)}
                      placeholder="e.g., elastic cuffs, logos, slim fit..."
                      className="w-full rounded-lg border border-border bg-bg-primary px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted/40 focus:border-purple-400 focus:outline-none"
                    />
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-text-muted/50">These preferences apply to every generation and override AI defaults.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-start gap-2">
            <svg className="h-4 w-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-400/60 hover:text-red-400">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ STEP 1: UPLOAD REFERENCES ═══════ */}
      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="rounded-2xl border border-border bg-bg-card p-6">
              <h2 className="mb-1 text-lg font-bold text-text-primary">Upload Reference Images</h2>
              <p className="mb-5 text-sm text-text-muted">Upload clothing images you want to use as inspiration. You can mix parts from different images in the next step.</p>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border transition-all hover:border-purple-400/50 hover:bg-purple-500/5"
              >
                <svg className="mb-2 h-10 w-10 text-text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
                <p className="text-sm font-medium text-text-muted">Drop images here or click to upload</p>
                <p className="mt-1 text-xs text-text-muted/50">Up to {MAX_IMAGES} images, 5MB each</p>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && addImages(e.target.files)} />
              </div>

              {/* Template browser toggle */}
              <div className="mt-3 flex items-center justify-center">
                <button
                  onClick={loadTemplates}
                  className="flex items-center gap-1.5 text-xs font-medium text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                  Or browse free mockup templates
                </button>
              </div>

              {/* Template browser panel */}
              <AnimatePresence>
                {showTemplates && templates.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-text-primary">VASTE Templates</h3>
                        <button onClick={() => setShowTemplates(false)} className="text-xs text-text-muted hover:text-text-secondary">Close</button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {['all', 'sweatpants', 'jeans', 'cargo', 'jacket', 'hoodie', 't-shirt', 'shorts'].map(cat => (
                          <button
                            key={cat}
                            onClick={() => setTemplateFilter(cat)}
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-all ${
                              templateFilter === cat
                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                                : 'border border-border text-text-muted hover:text-text-secondary'
                            }`}
                          >
                            {cat === 'all' ? 'All' : cat === 't-shirt' ? 'Tees' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-[280px] overflow-y-auto">
                        {templates
                          .filter(t => templateFilter === 'all' || t.garmentType.toLowerCase().includes(templateFilter))
                          .map(tpl => (
                            <button
                              key={tpl.id}
                              onClick={() => addTemplateAsRef(tpl)}
                              className="group relative overflow-hidden rounded-lg border border-border aspect-[3/4] hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/10"
                            >
                              <img src={`${tpl.image}?v=1`} alt={tpl.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                              <span className="absolute bottom-1 inset-x-1 text-[8px] text-white font-medium truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                {tpl.name}
                              </span>
                            </button>
                          ))}
                      </div>
                      <p className="mt-2 text-[10px] text-text-muted/60">Click a template to use it as your starting reference. Garment type will auto-set.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {references.length > 0 && (
                <div className="mt-5 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {references.map((ref) => (
                    <div key={ref.id} className="group relative overflow-hidden rounded-xl border border-border aspect-square">
                      <img src={ref.dataUrl} alt={ref.filename} className="h-full w-full object-cover" />
                      <button
                        onClick={(e) => { e.stopPropagation(); removeRef(ref.id); }}
                        className="absolute top-1 right-1 rounded-full bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                        <p className="text-[9px] text-white/80 truncate">{ref.filename}</p>
                        {ref.parts.length > 0 && (
                          <p className="text-[8px] text-purple-300">{ref.parts.length} part{ref.parts.length > 1 ? 's' : ''} selected</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══════ STEP 1.5: ANNOTATE (optional) ═══════ */}
        {step === 'annotate' && (
          <motion.div key="annotate" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="rounded-2xl border border-border bg-bg-card p-6">
              <h2 className="mb-1 text-lg font-bold text-text-primary">Annotate Your Reference</h2>
              <p className="mb-3 text-sm text-text-muted">
                Draw on your reference image to show exactly where you want things. Use text labels for instructions like &quot;pocket here&quot; or &quot;chain from here to here&quot;.
                <span className="text-purple-400 font-medium"> This step is optional — skip if not needed.</span>
              </p>

              {references.length > 1 && (
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                  {references.map((ref, i) => (
                    <button
                      key={ref.id}
                      onClick={() => {
                        // Move selected ref to front for annotation
                        setReferences(prev => {
                          const arr = [...prev];
                          const [selected] = arr.splice(i, 1);
                          arr.unshift(selected);
                          return arr;
                        });
                        setPreGenAnnotations([]);
                        setPreGenCanvasImage('');
                      }}
                      className={`shrink-0 rounded-lg border overflow-hidden ${
                        i === 0 ? 'border-purple-500/50 ring-2 ring-purple-500/20' : 'border-border hover:border-border/80'
                      }`}
                    >
                      <img src={ref.dataUrl} alt={ref.filename} className="h-14 w-14 object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <DesignCanvas
                backgroundImage={references[0]?.dataUrl}
                mode="annotate"
                onAnnotationsChange={setPreGenAnnotations}
                onExportImage={setPreGenCanvasImage}
              />

              {preGenAnnotations.length > 0 && (
                <div className="mt-3 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
                  <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">Your annotations will be sent to the AI</p>
                  <p className="text-xs text-text-muted">
                    The AI will see your drawings and text labels when generating. Text labels become direct instructions.
                    Circles highlight areas. Arrows show direction/placement.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══════ STEP 2: PICK PARTS ═══════ */}
        {step === 'parts' && (
          <motion.div key="parts" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="rounded-2xl border border-border bg-bg-card p-6">
              <h2 className="mb-1 text-lg font-bold text-text-primary">Pick Parts from Each Image</h2>
              <p className="mb-5 text-sm text-text-muted">
                Select which elements to take from each reference. For example: the collar design from image 1, the fabric texture from image 2, the pocket style from image 3.
              </p>

              <div className="space-y-6">
                {references.map((ref, refIdx) => (
                  <motion.div
                    key={ref.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: refIdx * 0.05 }}
                    className="rounded-xl border border-border bg-bg-primary/50 p-4"
                  >
                    <div className="flex gap-4">
                      <img src={ref.dataUrl} alt={ref.filename} className="h-28 w-28 shrink-0 rounded-lg object-cover border border-border" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary mb-2 truncate">
                          Image {refIdx + 1}: {ref.filename}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {PART_LABELS.map(part => (
                            <button
                              key={part}
                              onClick={() => togglePart(ref.id, part)}
                              className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-all ${
                                ref.parts.includes(part)
                                  ? 'bg-purple-500/25 text-purple-300 border border-purple-500/50'
                                  : 'border border-border/50 text-text-muted/60 hover:text-text-muted hover:bg-bg-hover'
                              }`}
                            >
                              {part}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={ref.notes || ''}
                          onChange={(e) => updateRefNotes(ref.id, e.target.value)}
                          placeholder="Notes: e.g., 'love the double stitching on this one'"
                          className="w-full rounded-lg border border-border bg-bg-primary px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted/40 focus:border-purple-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════ STEP 3: AI QUESTIONS ═══════ */}
        {step === 'questions' && (
          <motion.div key="questions" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="rounded-2xl border border-border bg-bg-card p-6">
              <h2 className="mb-1 text-lg font-bold text-text-primary">Tell Us More</h2>
              <p className="mb-5 text-sm text-text-muted">
                AI needs a few details to create your perfect design. Answer what you can — skip what you don&apos;t know.
              </p>

              {loadingQuestions ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full border-4 border-purple-500/20" />
                    <div className="absolute inset-0 h-12 w-12 animate-spin rounded-full border-4 border-transparent border-t-purple-500" />
                  </div>
                  <p className="mt-4 text-sm text-text-muted">Analyzing your references...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {questions.map((q, qi) => {
                    const currentAnswer = answers.find(a => a.questionId === q.id);
                    return (
                      <motion.div
                        key={q.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: qi * 0.05 }}
                        className="rounded-xl border border-border bg-bg-primary/50 p-4"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                            q.category === 'fit' ? 'bg-blue-500/20 text-blue-400' :
                            q.category === 'fabric' ? 'bg-amber-500/20 text-amber-400' :
                            q.category === 'construction' ? 'bg-green-500/20 text-green-400' :
                            q.category === 'color' ? 'bg-pink-500/20 text-pink-400' :
                            q.category === 'branding' ? 'bg-cyan-500/20 text-cyan-400' :
                            q.category === 'accessories' ? 'bg-orange-500/20 text-orange-400' :
                            q.category === 'graphics' ? 'bg-rose-500/20 text-rose-400' :
                            'bg-purple-500/20 text-purple-400'
                          }`}>{q.category}</span>
                        </div>
                        <p className="text-sm font-medium text-text-primary mb-3">{q.question}</p>

                        {q.type === 'select' && q.options && (
                          <div className="flex flex-wrap gap-2">
                            {q.options.map(opt => (
                              <button
                                key={opt}
                                onClick={() => updateAnswer(q.id, opt)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                                  currentAnswer?.answer === opt
                                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                                    : 'border border-border text-text-muted hover:bg-bg-hover'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}

                        {q.type === 'multi-select' && q.options && (
                          <div className="flex flex-wrap gap-2">
                            {q.options.map(opt => {
                              const selected = Array.isArray(currentAnswer?.answer) && currentAnswer.answer.includes(opt);
                              return (
                                <button
                                  key={opt}
                                  onClick={() => {
                                    const current = Array.isArray(currentAnswer?.answer) ? currentAnswer.answer : [];
                                    const next = selected ? current.filter((a: string) => a !== opt) : [...current, opt];
                                    updateAnswer(q.id, next);
                                  }}
                                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                                    selected
                                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                                      : 'border border-border text-text-muted hover:bg-bg-hover'
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {q.type === 'text' && (
                          <input
                            type="text"
                            value={(currentAnswer?.answer as string) || ''}
                            onChange={(e) => updateAnswer(q.id, e.target.value)}
                            placeholder="Type your answer..."
                            className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/40 focus:border-purple-400 focus:outline-none"
                          />
                        )}
                      </motion.div>
                    );
                  })}

                  {/* Extra instructions */}
                  <div className="rounded-xl border border-border bg-bg-primary/50 p-4">
                    <p className="text-sm font-medium text-text-primary mb-2">Anything else?</p>
                    <textarea
                      value={extraInstructions}
                      onChange={(e) => setExtraInstructions(e.target.value)}
                      placeholder="Any other details, special requests, brand references, or specific changes you want..."
                      rows={3}
                      className="w-full resize-none rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/40 focus:border-purple-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══════ STEP 4: GENERATING ═══════ */}
        {step === 'generate' && (
          <motion.div key="generate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {generating ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="relative mb-6">
                  <div className="h-20 w-20 rounded-full border-4 border-purple-500/20" />
                  <div className="absolute inset-0 h-20 w-20 animate-spin rounded-full border-4 border-transparent border-t-purple-500" style={{ animationDuration: '1.5s' }} />
                  <div className="absolute inset-2 h-16 w-16 animate-spin rounded-full border-4 border-transparent border-b-pink-500" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
                </div>
                <h2 className="text-xl font-bold text-text-primary mb-2">Creating Your Design</h2>
                <p className="text-sm text-text-muted mb-1">AI is combining your references and specifications...</p>
                <p className="text-xs text-text-muted/60">This usually takes 15-30 seconds</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-text-primary mb-2">Generation Failed</h2>
                <p className="text-sm text-text-muted mb-4">{error || 'Something went wrong. Please try again.'}</p>
                <div className="flex gap-3">
                  <button onClick={() => setStep('questions')} className="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-bg-hover transition-colors">
                    Go Back
                  </button>
                  <button onClick={() => { setError(''); handleGenerate(); }} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 transition-colors">
                    Retry
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ═══════ STEP 5: REVIEW & EDIT ═══════ */}
        {step === 'review' && result && (
          <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="grid gap-6 lg:grid-cols-[1fr,400px]">
              {/* Mockup Result */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
                  {result.mockupImage ? (
                    <img src={result.mockupImage} alt={`${result.garmentType} mockup`} className="w-full" />
                  ) : (
                    <div className="flex items-center justify-center h-64 bg-bg-primary">
                      <p className="text-sm text-text-muted">No image generated — see description below</p>
                    </div>
                  )}
                </div>

                {/* Description & Specs */}
                {result.description && (
                  <div className="rounded-2xl border border-border bg-bg-card p-5">
                    <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Design Description</h3>
                    <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{result.description}</p>
                  </div>
                )}

                {result.specs && (
                  <div className="rounded-2xl border border-border bg-bg-card p-5">
                    <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3">Quick Specs</h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {result.specs.fit && <div><span className="text-text-muted">Fit:</span> <span className="text-text-primary font-medium">{result.specs.fit}</span></div>}
                      {result.specs.fabric && <div><span className="text-text-muted">Fabric:</span> <span className="text-text-primary font-medium">{result.specs.fabric}</span></div>}
                      {result.specs.weight && <div><span className="text-text-muted">Weight:</span> <span className="text-text-primary font-medium">{result.specs.weight}</span></div>}
                    </div>
                    {result.specs.keyFeatures && result.specs.keyFeatures.length > 0 && (
                      <div className="mt-3">
                        <span className="text-xs text-text-muted">Key Features:</span>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {result.specs.keyFeatures.map((f, i) => (
                            <span key={i} className="rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] text-purple-400">{f}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Edit Panel */}
              <div className="space-y-4">
                {/* Draw on Image Toggle */}
                <div className="rounded-2xl border border-border bg-bg-card p-5">
                  <button
                    onClick={() => { setShowPostGenCanvas(!showPostGenCanvas); if (showPostGenCanvas) { setPostGenAnnotations([]); setPostGenCanvasImage(''); } }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-bold transition-all ${
                      showPostGenCanvas
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                        : 'border border-border text-text-muted hover:bg-bg-hover hover:text-text-secondary'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Draw on Image
                    </span>
                    <span className="text-[10px] font-normal">{showPostGenCanvas ? 'Close' : 'Open'}</span>
                  </button>

                  <AnimatePresence>
                    {showPostGenCanvas && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3">
                          <p className="text-[10px] text-text-muted mb-2">
                            Draw on the result to show the AI exactly what to change. Use text labels like &quot;remove this&quot; or &quot;make wider here&quot;.
                          </p>
                          <DesignCanvas
                            backgroundImage={result.mockupImage}
                            mode="edit"
                            onAnnotationsChange={setPostGenAnnotations}
                            onExportImage={setPostGenCanvasImage}
                          />
                          {postGenAnnotations.length > 0 && (
                            <button
                              onClick={() => {
                                // Auto-fill edit text from text annotations
                                const textLabels = postGenAnnotations
                                  .filter(a => a.tool === 'text')
                                  .map(a => ('text' in a ? a.text : ''))
                                  .filter(Boolean);
                                const circleCount = postGenAnnotations.filter(a => a.tool === 'circle').length;
                                const parts: string[] = [];
                                if (textLabels.length > 0) parts.push(textLabels.join('. '));
                                if (circleCount > 0) parts.push(`${circleCount} circled area${circleCount > 1 ? 's' : ''} to modify`);
                                if (parts.length > 0) setEditText(parts.join('. '));
                              }}
                              className="mt-2 w-full rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-[10px] font-semibold text-purple-400 hover:bg-purple-500/20 transition-colors"
                            >
                              Use Annotations as Edit Instructions
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="rounded-2xl border border-border bg-bg-card p-5">
                  <h3 className="text-sm font-bold text-text-primary mb-3">Edit Your Design</h3>
                  <p className="text-xs text-text-muted mb-3">Tell the AI what to change. Be specific!</p>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    placeholder="e.g., 'make the collar wider and add a v-neck', 'change to a boxy oversized fit', 'add double stitching on the hem', 'switch to a heavier cotton fabric'..."
                    rows={4}
                    className="w-full resize-none rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/40 focus:border-purple-400 focus:outline-none mb-3"
                  />
                  <button
                    onClick={handleEdit}
                    disabled={editing || (!editText.trim() && postGenAnnotations.length === 0)}
                    className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editing ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Applying Changes...
                      </span>
                    ) : postGenAnnotations.length > 0 && !editText.trim() ? 'Apply Canvas Annotations' : 'Apply Changes'}
                  </button>
                </div>

                {/* Manual Editing Tools */}
                <div className="rounded-2xl border border-border bg-bg-card p-5">
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Manual Edit Tools</h3>

                  {/* Silhouette & Fit */}
                  <div className="mb-3">
                    <p className="text-[9px] font-bold text-purple-400 uppercase tracking-wider mb-1.5">Silhouette & Fit</p>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { label: 'Wider Legs', cmd: 'Make the legs significantly wider and more oversized, increase volume throughout' },
                        { label: 'Narrower', cmd: 'Make the legs narrower and more tapered' },
                        { label: 'More Baggy', cmd: 'Make the entire garment much more baggy and oversized with extreme volume' },
                        { label: 'Longer', cmd: 'Make the garment longer so it pools more on the ground' },
                        { label: 'Shorter/Cropped', cmd: 'Make the garment shorter, cropped length' },
                        { label: 'Drop Crotch', cmd: 'Add a lower drop crotch for a more relaxed oversized look' },
                      ].map(t => (
                        <button key={t.label} onClick={() => { setEditText(t.cmd); }} className="rounded-md border border-purple-500/20 bg-purple-500/5 px-2 py-1 text-[10px] text-purple-400 hover:bg-purple-500/15 transition-colors">
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Remove Elements */}
                  <div className="mb-3">
                    <p className="text-[9px] font-bold text-red-400 uppercase tracking-wider mb-1.5">Remove</p>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { label: 'Remove Logo', cmd: 'Remove all logos and branding from the garment completely, make it clean with no visible logos' },
                        { label: 'Remove Cuffs', cmd: 'Remove elastic cuffs at ankles, replace with open straight-cut hem that drags on ground, absolutely no ribbed cuffs' },
                        { label: 'Remove Print', cmd: 'Remove all graphic prints from the garment, make it clean solid color' },
                        { label: 'Remove Pockets', cmd: 'Remove all visible pockets from the garment' },
                        { label: 'Remove Stripes', cmd: 'Remove all side stripes and stripe panels from the garment' },
                        { label: 'Remove Drawstring', cmd: 'Remove the drawstring from the waistband' },
                      ].map(t => (
                        <button key={t.label} onClick={() => { setEditText(t.cmd); }} className="rounded-md border border-red-500/20 bg-red-500/5 px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/15 transition-colors">
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Add Elements */}
                  <div className="mb-3">
                    <p className="text-[9px] font-bold text-green-400 uppercase tracking-wider mb-1.5">Add</p>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { label: 'Side Stripes', cmd: 'Add three white sport stripes running down the outer side seam of each leg' },
                        { label: 'Cargo Pockets', cmd: 'Add large cargo pockets on both thighs with button flap closure' },
                        { label: 'Contrast Waistband', cmd: 'Add a plaid tartan contrast fabric waistband visible above the elastic' },
                        { label: 'Double Waistband', cmd: 'Add a double-layered elastic waistband with contrasting inner layer visible' },
                        { label: 'Drawstring', cmd: 'Add an external drawstring to the waistband with metal aglet tips' },
                        { label: 'Side Panels', cmd: 'Add curved contrasting black fabric panels on the outer side of each leg' },
                      ].map(t => (
                        <button key={t.label} onClick={() => { setEditText(t.cmd); }} className="rounded-md border border-green-500/20 bg-green-500/5 px-2 py-1 text-[10px] text-green-400 hover:bg-green-500/15 transition-colors">
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fabric & Texture */}
                  <div className="mb-3">
                    <p className="text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1.5">Fabric & Texture</p>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { label: 'Heavyweight Fleece', cmd: 'Change fabric to heavyweight 340 GSM brushed cotton fleece with thick substantial feel' },
                        { label: 'French Terry', cmd: 'Change fabric to French terry cotton with loopback interior texture' },
                        { label: 'Heavy Denim', cmd: 'Change fabric to heavyweight raw denim with rigid construction' },
                        { label: 'Corduroy', cmd: 'Change fabric to thick wide-wale corduroy' },
                        { label: 'Distressed/Washed', cmd: 'Add a vintage garment-dyed distressed wash with fading at thighs and knees' },
                        { label: 'Ripstop Nylon', cmd: 'Change fabric to military ripstop nylon with slight sheen' },
                      ].map(t => (
                        <button key={t.label} onClick={() => { setEditText(t.cmd); }} className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[10px] text-amber-400 hover:bg-amber-500/15 transition-colors">
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color */}
                  <div>
                    <p className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider mb-1.5">Color</p>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { label: 'Black', cmd: 'Change the main color to solid black' },
                        { label: 'Heather Grey', cmd: 'Change the main color to heather grey' },
                        { label: 'Cream/Off-White', cmd: 'Change the main color to cream off-white' },
                        { label: 'Navy', cmd: 'Change the main color to dark navy blue' },
                        { label: 'Olive', cmd: 'Change the main color to olive green' },
                        { label: 'Brown', cmd: 'Change the main color to dark brown chocolate' },
                        { label: 'Camo', cmd: 'Change to woodland camouflage pattern in green/brown/black' },
                      ].map(t => (
                        <button key={t.label} onClick={() => { setEditText(t.cmd); }} className="rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2 py-1 text-[10px] text-cyan-400 hover:bg-cyan-500/15 transition-colors">
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {result.mockupImage && (
                    <button
                      onClick={() => downloadImage(result.mockupImage, `${garmentType}-design.png`)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2.5 text-xs font-semibold text-purple-400 hover:bg-purple-500/20 transition-colors"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Download
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setItem('techpack_from_design', result);
                      window.location.href = '/techpack';
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2.5 text-xs font-semibold text-green-400 hover:bg-green-500/20 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Generate Tech Pack
                  </button>
                </div>

                <button
                  onClick={() => { setStep('upload'); setResult(null); setQuestions([]); setAnswers([]); setPreGenAnnotations([]); setPreGenCanvasImage(''); setPostGenAnnotations([]); setPostGenCanvasImage(''); setShowPostGenCanvas(false); }}
                  className="w-full rounded-lg border border-border px-3 py-2 text-xs text-text-muted hover:bg-bg-hover transition-colors"
                >
                  Start New Design
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Buttons */}
      {step !== 'generate' && step !== 'review' && (
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={goBack}
            disabled={step === 'upload'}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-xs font-medium text-text-muted hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
          <button
            onClick={goNext}
            disabled={!canNext()}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:shadow-xl"
          >
            {step === 'questions' ? 'Generate Design' : 'Next'}
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}

      {/* History Drawer */}
      <AnimatePresence>
        {showHistory && history.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-4xl rounded-2xl border border-border bg-bg-card p-4 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-primary">Design History</h3>
              <button onClick={() => setShowHistory(false)} className="text-text-muted hover:text-text-primary">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {history.map(item => (
                <div key={item.id} className="group shrink-0 w-28">
                  <div className="relative overflow-hidden rounded-lg border border-border aspect-square mb-1">
                    {item.mockupImage ? (
                      <img src={item.mockupImage} alt={item.garmentType} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-bg-primary"><p className="text-[9px] text-text-muted">{item.garmentType}</p></div>
                    )}
                    <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="p-1.5 w-full flex justify-between items-center">
                        <span className="text-[8px] text-white/80">{new Date(item.createdAt).toLocaleDateString()}</span>
                        {item.mockupImage && (
                          <button onClick={() => downloadImage(item.mockupImage, `${item.garmentType}.png`)} className="rounded bg-white/20 p-0.5">
                            <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-[9px] text-text-muted truncate">{item.garmentType}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
