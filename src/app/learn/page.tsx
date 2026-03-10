'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAIProvider } from '@/hooks/useAIProvider';
import { fadeInUp } from '@/lib/animations';
import { toast } from 'sonner';
import { getItem, setItem } from '@/lib/storage/localStorage';
import { recordActivity } from '@/lib/streak';

interface GradingResult {
  grade: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  detailedFeedback: string;
}

const GRADING_PROMPT = `You are an expert essay grader. Grade the following essay against the provided mark scheme (or general academic standards if no scheme provided).

Return ONLY valid JSON (no code blocks):
{
  "grade": "A/B/C/D/E/F letter grade",
  "score": 0-100 numeric score,
  "strengths": ["list of 3-5 specific strengths"],
  "weaknesses": ["list of 3-5 specific areas for improvement"],
  "suggestions": ["list of 3-5 actionable improvement suggestions"],
  "detailedFeedback": "2-3 paragraphs of detailed constructive feedback explaining what works, what doesn't, and exactly how to improve"
}`;

const IMPROVE_PROMPT = `You are an expert writing tutor. The student wrote the essay below. Rewrite it to address the weaknesses identified while maintaining their original voice and style as much as possible. Make it better, not different.

Keep their vocabulary level, tone, and personality. Just fix the structural, argumentative, and clarity issues.

Write ONLY the improved essay, no commentary.`;

export default function LearnPage() {
  const { providers, activeProvider } = useAIProvider();
  const [essayText, setEssayText] = useState('');
  const [markScheme, setMarkScheme] = useState('');
  const [result, setResult] = useState<GradingResult | null>(null);
  const [improvedText, setImprovedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [improving, setImproving] = useState(false);
  const [tab, setTab] = useState<'grade' | 'improved'>('grade');
  const inputRef = useRef<HTMLInputElement>(null);

  const getProviderConfig = () => activeProvider ? providers[activeProvider] : null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type === 'text/plain') {
      setEssayText(await file.text());
    } else if (file.type === 'application/pdf') {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/pdf', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.text) setEssayText(data.text);
      else toast.error(data.error || 'Failed to read PDF');
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleGrade = async () => {
    if (!essayText.trim()) { toast.error('Paste or upload an essay first'); return; }
    const config = getProviderConfig();
    if (!config) { toast.error('No AI provider configured'); return; }

    setLoading(true);
    setResult(null);
    setImprovedText('');
    try {
      const prompt = markScheme
        ? `MARK SCHEME:\n${markScheme}\n\nESSAY:\n${essayText}`
        : `ESSAY (grade against general academic standards):\n${essayText}`;

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'custom', essayText: prompt, systemPrompt: GRADING_PROMPT, providerConfig: config }),
      });
      const data = await res.json();

      let parsed: GradingResult;
      if (data.analysis && data.analysis.grade) {
        parsed = data.analysis;
      } else if (data.raw) {
        const cleaned = data.raw.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } else {
        throw new Error('Could not parse grading response');
      }
      setResult(parsed);
      setTab('grade');

      // Update learning stats + activity
      const stats = getItem('learning_stats', { essaysGraded: 0, exercisesDone: 0, streak: 0, lecturesRecorded: 0 });
      stats.essaysGraded += 1;
      setItem('learning_stats', stats);
      recordActivity();

      toast.success('Essay graded!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Grading failed');
    }
    setLoading(false);
  };

  const handleImprove = async () => {
    if (!essayText.trim() || !result) return;
    const config = getProviderConfig();
    if (!config) { toast.error('No AI provider configured'); return; }

    setImproving(true);
    try {
      const prompt = `${IMPROVE_PROMPT}\n\nWEAKNESSES TO ADDRESS:\n${result.weaknesses.join('\n')}\n\nSUGGESTIONS:\n${result.suggestions.join('\n')}\n\nORIGINAL ESSAY:\n${essayText}`;

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: 'Improve essay',
          essayType: 'improvement',
          targetWords: essayText.split(/\s+/).length,
          requirements: prompt,
          styleProfile: { dimensions: {}, fingerprint: 'Match the original style.', confidence: 100, essayCount: 1, totalWordCount: 0, id: 'temp', lastUpdated: '' },
          providerConfig: config,
        }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setImprovedText(full);
      }
      setTab('improved');
      toast.success('Essay improved!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Improvement failed');
    }
    setImproving(false);
  };

  const gradeColor = (score: number) =>
    score >= 80 ? 'text-success' : score >= 60 ? 'text-warning' : 'text-error';

  return (
    <motion.div className="mx-auto max-w-4xl" {...fadeInUp}>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold gradient-text inline-block">Learning Hub</h1>
        <p className="text-text-secondary">Get your essays graded by AI and learn how to improve</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input */}
        <div>
          <div className="rounded-xl border border-border bg-bg-card p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-primary">Your Essay</h2>
              <div>
                <input ref={inputRef} type="file" accept=".txt,.pdf" onChange={handleFileUpload} className="hidden" />
                <button onClick={() => inputRef.current?.click()} className="text-xs text-accent hover:underline">
                  Upload file
                </button>
              </div>
            </div>
            <textarea
              value={essayText}
              onChange={(e) => setEssayText(e.target.value)}
              placeholder="Paste your essay here or upload a file..."
              rows={12}
              className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-ring focus:ring-1 focus:ring-ring resize-none"
            />
            {essayText && (
              <p className="mt-1 text-xs text-text-muted">{essayText.split(/\s+/).filter(Boolean).length} words</p>
            )}

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-text-primary">Mark Scheme (optional)</label>
              <textarea
                value={markScheme}
                onChange={(e) => setMarkScheme(e.target.value)}
                placeholder="Paste the mark scheme or grading criteria..."
                rows={4}
                className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-ring focus:ring-1 focus:ring-ring resize-none"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleGrade}
                disabled={loading || !essayText.trim()}
                className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Grading...' : 'Grade My Essay'}
              </button>
              {result && (
                <button
                  onClick={handleImprove}
                  disabled={improving}
                  className="rounded-lg border border-accent px-4 py-2.5 text-sm font-semibold text-accent hover:bg-accent/10 disabled:opacity-40"
                >
                  {improving ? 'Improving...' : 'Improve with AI'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        <div>
          {result ? (
            <div className="rounded-xl border border-border bg-bg-card" style={{ boxShadow: 'var(--card-shadow)' }}>
              {/* Tab buttons */}
              <div className="flex border-b border-border">
                <button
                  onClick={() => setTab('grade')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${tab === 'grade' ? 'text-accent border-b-2 border-accent' : 'text-text-muted hover:text-text-primary'}`}
                >
                  Grading
                </button>
                <button
                  onClick={() => setTab('improved')}
                  disabled={!improvedText}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors disabled:opacity-40 ${tab === 'improved' ? 'text-accent border-b-2 border-accent' : 'text-text-muted hover:text-text-primary'}`}
                >
                  Improved Version
                </button>
              </div>

              <div className="p-5">
                {tab === 'grade' ? (
                  <div className="space-y-4">
                    {/* Grade */}
                    <div className="flex items-center gap-4">
                      <div className={`text-5xl font-black ${gradeColor(result.score)}`}>{result.grade}</div>
                      <div>
                        <p className={`text-2xl font-bold ${gradeColor(result.score)}`}>{result.score}/100</p>
                        <p className="text-xs text-text-muted">Overall Score</p>
                      </div>
                    </div>

                    {/* Strengths */}
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-success">Strengths</h3>
                      <ul className="space-y-1">
                        {result.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                            <svg className="mt-0.5 h-4 w-4 shrink-0 text-success" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Weaknesses */}
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-error">Areas to Improve</h3>
                      <ul className="space-y-1">
                        {result.weaknesses.map((w, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                            <svg className="mt-0.5 h-4 w-4 shrink-0 text-error" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Suggestions */}
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-accent">How to Improve</h3>
                      <ul className="space-y-1">
                        {result.suggestions.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                            <svg className="mt-0.5 h-4 w-4 shrink-0 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Detailed feedback */}
                    <div>
                      <h3 className="mb-2 text-sm font-semibold text-text-primary">Detailed Feedback</h3>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">{result.detailedFeedback}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="mb-3 text-xs text-text-muted">AI-improved version of your essay (your style preserved):</p>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
                      {improvedText}
                      {improving && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-accent" />}
                    </div>
                    {improvedText && !improving && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(improvedText); toast.success('Copied!'); }}
                        className="mt-4 rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
                      >
                        Copy improved essay
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-dashed border-border">
              <div className="text-center">
                <svg className="mx-auto mb-3 h-12 w-12 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p className="text-sm text-text-muted">Paste an essay and click Grade to see results</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
