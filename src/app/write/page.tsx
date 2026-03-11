'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useStyleProfile } from '@/hooks/useStyleProfile';
import { useAIProvider } from '@/hooks/useAIProvider';
import {
  ESSAY_TYPES, WRITING_TONES, WRITING_PERSPECTIVES, WRITING_LEVELS,
  HUMANIZATION_LEVELS, LANGUAGES,
  type EssayType,
} from '@/types/essay';
import type { GeneratedEssay } from '@/types/essay';
import { getItem, setItem } from '@/lib/storage/localStorage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { fadeInUp } from '@/lib/animations';
import { toast } from 'sonner';

interface AIDetectionResult {
  aiScore: number;
  humanScore: number;
  verdict: string;
  flags: { issue: string; severity: string; suggestion: string }[];
  highlights: string[];
  strengths: string[];
  overallFeedback: string;
}

export default function WritePage() {
  const { profile, hasProfile } = useStyleProfile();
  const { providers, activeProvider } = useAIProvider();
  const router = useRouter();

  const [topic, setTopic] = useState('');
  const [essayType, setEssayType] = useState<EssayType>('argumentative');
  const [targetWords, setTargetWords] = useState(500);
  const [requirements, setRequirements] = useState('');
  const [tone, setTone] = useState('');
  const [perspective, setPerspective] = useState('auto');
  const [level, setLevel] = useState('');
  const [humanization, setHumanization] = useState('high');
  const [language, setLanguage] = useState('english');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [styleScore, setStyleScore] = useState<{ score: number; feedback: string } | null>(null);

  // AI Detection
  const [scanning, setScanning] = useState(false);
  const [detectionResult, setDetectionResult] = useState<AIDetectionResult | null>(null);

  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current && isGenerating) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [generatedText, isGenerating]);

  const wordCount = generatedText.split(/\s+/).filter(Boolean).length;

  const handleGenerate = async () => {
    if (!topic.trim()) { toast.error('Please enter a topic'); return; }
    if (!activeProvider) { toast.error('No AI provider configured'); return; }

    setIsGenerating(true);
    setGeneratedText('');
    setStyleScore(null);
    setDetectionResult(null);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic, essayType, targetWords, requirements,
          styleProfile: profile,
          providerConfig: providers[activeProvider],
          humanization, perspective, tone, level, language,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Generation failed');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk.includes('[ERROR]:')) throw new Error(chunk.replace(/.*\[ERROR\]:\s*/, ''));
        full += chunk;
        setGeneratedText(full);
      }
      if (!full.trim()) throw new Error('AI returned an empty response — try again.');

      // Save generated essay to history
      const wc = full.split(/\s+/).filter(Boolean).length;
      const saved = getItem<GeneratedEssay[]>('generated_essays', []);
      saved.push({
        id: crypto.randomUUID(),
        topic,
        essayType,
        text: full,
        wordCount: wc,
        generatedAt: new Date().toISOString(),
      });
      setItem('generated_essays', saved);

      // Track activity for streak
      setItem('last_active_date', new Date().toISOString().slice(0, 10));

      // Auto-scan for AI detection after generation
      scanForAI(full);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    }

    setIsGenerating(false);
  };

  const scanForAI = async (text?: string) => {
    const textToScan = text || generatedText;
    if (!textToScan.trim()) return;
    if (!activeProvider) { toast.error('No AI provider configured'); return; }

    setScanning(true);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'custom',
          essayText: textToScan,
          systemPrompt: `You are an AI writing detection expert. Analyze the following text and identify patterns that suggest it was written by AI vs. a human.

Score the text on a scale of 0-100 where:
- 0 = Definitely human-written
- 50 = Uncertain
- 100 = Definitely AI-written

Look for these AI indicators:
1. Unnaturally consistent sentence length
2. Over-use of formal transitions (Furthermore, Moreover, Additionally)
3. Perfectly balanced paragraph structures
4. Lack of personal voice or colloquialisms
5. Overly polished prose without natural imperfections
6. Generic examples instead of specific ones
7. Formulaic essay structure (intro-3 body-conclusion)
8. Excessive hedging language
9. Unnaturally varied vocabulary (synonym cycling)
10. Absence of contractions, fragments, or casual language

Return ONLY valid JSON (no code blocks):
{
  "aiScore": <0-100>,
  "humanScore": <0-100>,
  "verdict": "Likely Human" | "Possibly AI" | "Likely AI",
  "flags": [
    {"issue": "description of AI-like pattern found", "severity": "low|medium|high", "suggestion": "how to fix it"}
  ],
  "highlights": ["specific phrases that seem AI-generated"],
  "strengths": ["human-like qualities in the text"],
  "overallFeedback": "2-3 sentences of overall assessment"
}`,
          providerConfig: providers[activeProvider],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Detection failed (${res.status})`);
      }
      const data = await res.json();
      let parsed: AIDetectionResult;
      if (data.analysis?.aiScore !== undefined) {
        parsed = data.analysis;
      } else if (data.raw) {
        const { parseAIJSON } = await import('@/lib/ai/parseJSON');
        parsed = parseAIJSON<AIDetectionResult>(data.raw);
      } else {
        throw new Error('AI detection failed — try again.');
      }

      setDetectionResult(parsed);
    } catch {
      // Detection is optional — don't block user
    }
    setScanning(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedText);
    toast.success('Copied to clipboard');
  };

  const handleDownload = () => {
    const blob = new Blob([generatedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${topic.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}_essay.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded');
  };

  const verdictColor = (verdict: string) => {
    if (verdict === 'Likely Human') return 'text-success';
    if (verdict === 'Possibly AI') return 'text-warning';
    return 'text-error';
  };

  const severityColor = (s: string) => {
    if (s === 'high') return 'bg-error/10 text-error';
    if (s === 'medium') return 'bg-warning/10 text-warning';
    return 'bg-accent/10 text-accent';
  };

  if (!hasProfile || profile.confidence < 40) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <svg className="mb-4 h-16 w-16 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <h2 className="mb-2 text-xl font-bold text-text-primary">Not Enough Data</h2>
        <p className="mb-4 max-w-md text-text-secondary">
          Upload and analyze more essays to build your style profile. You need at least 40% confidence to start writing.
        </p>
        <button onClick={() => router.push('/upload')} className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">
          Upload Essays
        </button>
      </div>
    );
  }

  return (
    <motion.div className="mx-auto max-w-5xl" {...fadeInUp}>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold gradient-text inline-block">Write In Your Style</h1>
        <p className="text-text-secondary">
          Generate essays that sound exactly like you ({profile.confidence}% confidence)
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border bg-bg-card p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">Topic</label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="What should the essay be about?"
                  rows={3}
                  className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-ring focus:ring-1 focus:ring-ring resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-primary">Essay Type</label>
                  <select
                    value={essayType}
                    onChange={(e) => setEssayType(e.target.value as EssayType)}
                    className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary outline-none focus:border-ring"
                  >
                    {ESSAY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-primary">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary outline-none focus:border-ring"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">
                  Target Words: <span className="text-accent">{targetWords}</span>
                </label>
                <input
                  type="range"
                  min={100}
                  max={5000}
                  step={50}
                  value={targetWords}
                  onChange={(e) => setTargetWords(Number(e.target.value))}
                  className="w-full accent-accent"
                />
                <div className="flex justify-between text-xs text-text-muted">
                  <span>100</span>
                  <span>5000</span>
                </div>
              </div>

              {/* Humanization Level */}
              <div>
                <label className="mb-2 block text-sm font-medium text-text-primary">Humanization Level</label>
                <div className="flex gap-2">
                  {HUMANIZATION_LEVELS.map(h => (
                    <button
                      key={h.value}
                      onClick={() => setHumanization(h.value)}
                      className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
                        humanization === h.value ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:bg-bg-hover'
                      }`}
                      title={h.desc}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {HUMANIZATION_LEVELS.find(h => h.value === humanization)?.desc}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">Additional Requirements</label>
                <textarea
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="Thesis statement, sources to cite, key points... (optional)"
                  rows={2}
                  className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-ring focus:ring-1 focus:ring-ring resize-none"
                />
              </div>

              {/* Advanced Options Toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover"
              >
                <span>Advanced Options</span>
                <svg className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showAdvanced && (
                <div className="space-y-3 rounded-lg border border-border bg-bg-secondary p-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Tone</label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setTone('')}
                        className={`rounded-full px-2.5 py-1 text-xs transition-all ${!tone ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:bg-bg-hover'}`}
                      >
                        Auto
                      </button>
                      {WRITING_TONES.map(t => (
                        <button
                          key={t}
                          onClick={() => setTone(t)}
                          className={`rounded-full px-2.5 py-1 text-xs transition-all ${tone === t ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:bg-bg-hover'}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Perspective</label>
                    <div className="flex flex-wrap gap-1.5">
                      {WRITING_PERSPECTIVES.map(p => (
                        <button
                          key={p.value}
                          onClick={() => setPerspective(p.value)}
                          className={`rounded-full px-2.5 py-1 text-xs transition-all ${perspective === p.value ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:bg-bg-hover'}`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-muted">Writing Level</label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setLevel('')}
                        className={`rounded-full px-2.5 py-1 text-xs transition-all ${!level ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:bg-bg-hover'}`}
                      >
                        Auto
                      </button>
                      {WRITING_LEVELS.map(l => (
                        <button
                          key={l.value}
                          onClick={() => setLevel(l.value)}
                          className={`rounded-full px-2.5 py-1 text-xs transition-all ${level === l.value ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:bg-bg-hover'}`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !topic.trim()}
                className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner />
                    Generating...
                  </span>
                ) : 'Generate Essay'}
              </button>
            </div>
          </div>
        </div>

        {/* Output */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-xl border border-border bg-bg-card" style={{ boxShadow: 'var(--card-shadow)' }}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-text-primary">Generated Essay</span>
                {wordCount > 0 && (
                  <span className="rounded-full bg-bg-hover px-2 py-0.5 text-xs text-text-muted">{wordCount} words</span>
                )}
                {styleScore && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    styleScore.score >= 80 ? 'bg-success/10 text-success' :
                    styleScore.score >= 60 ? 'bg-warning/10 text-warning' :
                    'bg-error/10 text-error'
                  }`}>
                    {styleScore.score}% match
                  </span>
                )}
                {detectionResult && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    detectionResult.humanScore >= 70 ? 'bg-success/10 text-success' :
                    detectionResult.humanScore >= 40 ? 'bg-warning/10 text-warning' :
                    'bg-error/10 text-error'
                  }`}>
                    {detectionResult.humanScore}% human
                  </span>
                )}
              </div>
              {generatedText && (
                <div className="flex gap-1">
                  <button
                    onClick={() => scanForAI()}
                    disabled={scanning}
                    className="rounded px-2 py-1 text-xs text-accent hover:bg-accent/10 disabled:opacity-40"
                    title="Scan for AI patterns"
                  >
                    {scanning ? <LoadingSpinner className="h-3.5 w-3.5" /> : 'Scan AI'}
                  </button>
                  <button onClick={handleCopy} className="rounded p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary" title="Copy">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button onClick={handleDownload} className="rounded p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary" title="Download">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Content */}
            <div ref={outputRef} className="max-h-[60vh] overflow-y-auto p-5">
              {generatedText ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
                  {generatedText}
                  {isGenerating && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-accent" />}
                </div>
              ) : (
                <div className="flex min-h-[200px] items-center justify-center text-center">
                  <div>
                    <svg className="mx-auto mb-3 h-10 w-10 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <p className="text-sm text-text-muted">Enter a topic and click Generate</p>
                  </div>
                </div>
              )}
            </div>

            {/* Style match feedback */}
            {styleScore?.feedback && (
              <div className="border-t border-border px-5 py-3">
                <p className="text-xs text-text-secondary">{styleScore.feedback}</p>
              </div>
            )}
          </div>

          {/* AI Detection Results */}
          {detectionResult && (
            <div className="rounded-xl border border-border bg-bg-card p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-text-primary">AI Detection Analysis</h3>
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${verdictColor(detectionResult.verdict)}`}>
                  {detectionResult.verdict}
                </span>
              </div>

              {/* Score bars */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-muted">Human Score</span>
                    <span className="font-bold text-success">{detectionResult.humanScore}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-bg-hover overflow-hidden">
                    <div className="h-full rounded-full bg-success transition-all" style={{ width: `${detectionResult.humanScore}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text-muted">AI Score</span>
                    <span className="font-bold text-error">{detectionResult.aiScore}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-bg-hover overflow-hidden">
                    <div className="h-full rounded-full bg-error transition-all" style={{ width: `${detectionResult.aiScore}%` }} />
                  </div>
                </div>
              </div>

              <p className="text-sm text-text-secondary mb-4">{detectionResult.overallFeedback}</p>

              {/* Flags */}
              {detectionResult.flags.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide">Issues Found</p>
                  <div className="space-y-2">
                    {detectionResult.flags.map((flag, i) => (
                      <div key={i} className="rounded-lg border border-border p-3">
                        <div className="flex items-start gap-2">
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${severityColor(flag.severity)}`}>
                            {flag.severity}
                          </span>
                          <div>
                            <p className="text-sm text-text-primary">{flag.issue}</p>
                            <p className="text-xs text-accent mt-1">{flag.suggestion}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths */}
              {detectionResult.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide">Human-like Qualities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {detectionResult.strengths.map((s, i) => (
                      <span key={i} className="rounded-full bg-success/10 px-2.5 py-1 text-xs text-success">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
