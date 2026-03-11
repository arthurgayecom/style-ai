'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAIProvider } from '@/hooks/useAIProvider';
import { fadeInUp } from '@/lib/animations';
import { toast } from 'sonner';
import { getItem, setItem } from '@/lib/storage/localStorage';
import { recordActivity } from '@/lib/streak';

interface LectureAnalysis {
  title: string;
  summary: string;
  keyPoints: string[];
  vocabulary: string[];
  questions: { question: string; answer: string }[];
  studyNotes: string;
}

const VOICE_FILTER_PROMPT = `You are a transcript editor. The user has a classroom recording transcript that contains both the teacher/lecturer speaking AND student questions, chatter, and filler words.

Your job:
- Keep ONLY the teacher/lecturer's content
- Remove all student questions, comments, and chatter
- Remove filler words (um, uh, like, you know, etc.)
- Keep the teacher's answers to student questions, but remove the student questions themselves
- Clean up grammar and formatting for readability
- Return clean, well-paragraphed text (NOT JSON, just plain text)
- Preserve the original meaning and order of the lecture content`;

const LECTURE_PROMPT = `You are an expert tutor. The student has provided lesson content below (from a recording and/or uploaded materials). Analyze it thoroughly.

Return ONLY valid JSON (no code blocks):
{
  "title": "a concise title for this lecture",
  "summary": "2-3 paragraph summary of the main content",
  "keyPoints": ["list of 5-10 key points covered"],
  "vocabulary": ["important terms or concepts mentioned"],
  "questions": [
    {"question": "practice question based on the lecture", "answer": "the answer"},
    ... (generate 5-8 questions)
  ],
  "studyNotes": "formatted study notes the student can review (use clear sections and bullet points)"
}

Adapt to the subject: if it's math, include formulas. If science, include key concepts. If language, include translations/grammar points.`;

export default function RecordPage() {
  const router = useRouter();
  const { providers, activeProvider } = useAIProvider();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [manualInput, setManualInput] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; text: string }[]>([]);
  const [analysis, setAnalysis] = useState<LectureAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAnswers, setShowAnswers] = useState<Record<number, boolean>>({});
  const [recordTime, setRecordTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [filtering, setFiltering] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        toast.error('Speech recognition not supported. Use Chrome/Edge or paste transcript.');
        setManualInput(true);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let finalTranscript = '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setTranscript(finalTranscript + interim);
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          toast.error('Microphone access denied');
          stopRecording();
        }
      };
      recognition.onend = () => {
        if (isRecording && recognitionRef.current) {
          try { recognitionRef.current.start(); } catch { /* ignore */ }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      setRecordTime(0);
      setTranscript('');
      setAnalysis(null);
      timerRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
      toast.success('Recording started');
    } catch {
      toast.error('Failed to start recording');
      setManualInput(true);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsRecording(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      try {
        let text = '';
        if (file.type === 'text/plain') {
          text = await file.text();
        } else if (file.type === 'application/pdf') {
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch('/api/pdf', { method: 'POST', body: formData });
          const data = await res.json();
          text = data.text || '';
          if (!text) { toast.error(`Failed to read ${file.name}`); continue; }
        } else if (file.type.startsWith('image/')) {
          const config = activeProvider ? providers[activeProvider] : null;
          if (!config) { toast.error('No AI provider for OCR'); continue; }
          const formData = new FormData();
          formData.append('file', file);
          formData.append('providerConfig', JSON.stringify(config));
          const res = await fetch('/api/ai/ocr', { method: 'POST', body: formData });
          const data = await res.json();
          text = data.text || '';
          if (!text) { toast.error(`OCR failed for ${file.name}`); continue; }
        }
        if (text) setUploadedFiles(prev => [...prev, { name: file.name, text }]);
      } catch {
        toast.error(`Error processing ${file.name}`);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (idx: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const filterTranscript = async () => {
    if (!transcript.trim()) { toast.error('No transcript to filter'); return; }
    const config = activeProvider ? providers[activeProvider] : null;
    if (!config) { toast.error('No AI provider configured'); return; }

    setFiltering(true);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'custom', essayText: transcript, systemPrompt: VOICE_FILTER_PROMPT, providerConfig: config }),
      });
      const data = await res.json();
      const cleaned = data.raw || data.analysis?.toString() || '';
      if (cleaned) {
        setTranscript(cleaned);
        toast.success('Student voices filtered out!');
      } else {
        toast.error('Filter returned empty result');
      }
    } catch {
      toast.error('Voice filtering failed');
    }
    setFiltering(false);
  };

  const hasContent = transcript.trim() || uploadedFiles.length > 0;

  const analyzeTranscript = async () => {
    if (!hasContent) { toast.error('No content to analyze'); return; }
    const config = activeProvider ? providers[activeProvider] : null;
    if (!config) { toast.error('No AI provider configured'); return; }

    let combined = transcript.trim();
    if (uploadedFiles.length > 0) {
      combined += '\n\n--- UPLOADED LESSON MATERIALS ---\n\n';
      uploadedFiles.forEach(f => { combined += `### ${f.name}\n${f.text}\n\n`; });
    }

    setAnalyzing(true);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'custom', essayText: combined, systemPrompt: LECTURE_PROMPT, providerConfig: config }),
      });
      const data = await res.json();

      let parsed: LectureAnalysis;
      if (data.analysis?.title) {
        parsed = data.analysis;
      } else if (data.raw) {
        const cleaned = data.raw.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } else {
        throw new Error('Could not parse analysis');
      }

      setAnalysis(parsed);
      toast.success('Lecture analyzed!');

      const stats = getItem('learning_stats', { essaysGraded: 0, exercisesDone: 0, streak: 0, lecturesRecorded: 0 });
      stats.lecturesRecorded += 1;
      setItem('learning_stats', stats);
      recordActivity();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed');
    }
    setAnalyzing(false);
  };

  const goToBrainrotVideo = () => {
    const combined = transcript.trim() + (uploadedFiles.length > 0 ? '\n\n' + uploadedFiles.map(f => f.text).join('\n\n') : '');
    setItem('current_transcript', combined);
    router.push('/video');
  };

  const toggleAnswer = (idx: number) => {
    setShowAnswers(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <motion.div className="mx-auto max-w-4xl" {...fadeInUp}>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold gradient-text inline-block">Lecture Recorder</h1>
        <p className="text-text-secondary">Record or upload lessons — get AI summaries, questions, and study notes</p>
      </div>

      {/* Recording controls */}
      <div className="mb-6 rounded-xl border border-border bg-bg-card p-6 text-center" style={{ boxShadow: 'var(--card-shadow)' }}>
        {isRecording ? (
          <div>
            <div className="mb-4 flex items-center justify-center gap-3">
              <div className="h-3 w-3 animate-pulse rounded-full bg-error" />
              <span className="text-2xl font-mono font-bold text-text-primary">{formatTime(recordTime)}</span>
            </div>
            <p className="mb-4 text-sm text-text-secondary">Recording... speak clearly</p>
            <button onClick={stopRecording} className="rounded-lg bg-error px-8 py-3 text-sm font-semibold text-white hover:bg-error/90">Stop Recording</button>
          </div>
        ) : (
          <div>
            <svg className="mx-auto mb-3 h-12 w-12 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <div className="flex justify-center gap-3">
              <button onClick={startRecording} className="rounded-lg bg-accent px-8 py-3 text-sm font-semibold text-white hover:bg-accent-hover">Start Recording</button>
              <button onClick={() => setManualInput(!manualInput)} className="rounded-lg border border-border px-6 py-3 text-sm text-text-secondary hover:bg-bg-hover">
                {manualInput ? 'Hide Text Input' : 'Paste Transcript'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* File upload section */}
      <div className="mb-6 rounded-xl border border-border bg-bg-card p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Upload Lesson Materials</h2>
            <p className="text-xs text-text-muted">Upload notes, slides, or photos of the whiteboard</p>
          </div>
          <div>
            <input ref={fileInputRef} type="file" multiple accept=".txt,.pdf,.png,.jpg,.jpeg,.webp" onChange={handleFileUpload} className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover disabled:opacity-40"
            >
              {uploading ? 'Uploading...' : 'Choose Files'}
            </button>
          </div>
        </div>
        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            {uploadedFiles.map((f, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-bg-secondary px-3 py-2">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm text-text-primary">{f.name}</span>
                  <span className="text-xs text-text-muted">({f.text.split(/\s+/).length} words)</span>
                </div>
                <button onClick={() => removeFile(i)} className="text-text-muted hover:text-error text-xs">Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transcript */}
      {(manualInput || transcript) && (
        <div className="mb-6 rounded-xl border border-border bg-bg-card p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
          <h2 className="mb-2 text-sm font-semibold text-text-primary">Transcript</h2>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste your lecture transcript here..."
            rows={8}
            className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-ring resize-none"
          />
          {transcript && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-text-muted">{transcript.split(/\s+/).filter(Boolean).length} words</p>
              <button
                onClick={filterTranscript}
                disabled={filtering}
                className="rounded-full bg-accent/10 text-accent border border-accent/20 px-4 py-1.5 text-xs font-medium hover:bg-accent/20 disabled:opacity-40 transition-colors"
              >
                {filtering ? 'Filtering...' : 'Filter Student Voices'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Analyze button */}
      {hasContent && !analysis && (
        <div className="mb-6 text-center">
          <button
            onClick={analyzeTranscript}
            disabled={analyzing}
            className="rounded-lg bg-accent px-8 py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
          >
            {analyzing ? 'Analyzing...' : 'Analyze Lesson'}
          </button>
        </div>
      )}

      {/* Analysis results */}
      {analysis && (
        <div className="space-y-6">
          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => {
                const combined = transcript.trim() + (uploadedFiles.length > 0 ? '\n\n' + uploadedFiles.map(f => f.text).join('\n\n') : '');
                setItem('lesson_content', { title: analysis.title, text: combined, keyPoints: analysis.keyPoints, vocabulary: analysis.vocabulary });
                router.push('/exercises?source=lesson');
              }}
              className="rounded-lg bg-success px-6 py-2.5 text-sm font-semibold text-white hover:bg-success/90"
            >
              Practice This Lesson
            </button>
            <button
              onClick={goToBrainrotVideo}
              className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              Create Brainrot Video
            </button>
            <button
              onClick={() => {
                const combined = transcript.trim() + (uploadedFiles.length > 0 ? '\n\n' + uploadedFiles.map(f => f.text).join('\n\n') : '');
                setItem('lesson_content', { title: analysis.title, text: combined, keyPoints: analysis.keyPoints, vocabulary: analysis.vocabulary });
                router.push('/present');
              }}
              className="rounded-lg bg-accent-secondary px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-secondary/90"
            >
              Create Presentation
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(analysis.studyNotes); toast.success('Notes copied!'); }}
              className="rounded-lg border border-border px-6 py-2.5 text-sm text-text-secondary hover:bg-bg-hover"
            >
              Copy Study Notes
            </button>
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-border bg-bg-card p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
            <h2 className="text-xl font-bold text-text-primary mb-1">{analysis.title}</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">{analysis.summary}</p>
          </div>

          {/* Key Points */}
          <div className="rounded-xl border border-border bg-bg-card p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Key Points</h3>
            <ul className="space-y-2">
              {analysis.keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">{i + 1}</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Vocabulary */}
          {analysis.vocabulary.length > 0 && (
            <div className="rounded-xl border border-border bg-bg-card p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Key Terms</h3>
              <div className="flex flex-wrap gap-2">
                {analysis.vocabulary.map((term, i) => (
                  <span key={i} className="rounded-full border border-border bg-bg-hover px-3 py-1 text-xs text-text-primary">{term}</span>
                ))}
              </div>
            </div>
          )}

          {/* Practice Questions */}
          <div className="rounded-xl border border-border bg-bg-card p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Practice Questions</h3>
            <div className="space-y-3">
              {analysis.questions.map((q, i) => (
                <div key={i} className="rounded-lg border border-border p-4">
                  <p className="text-sm font-medium text-text-primary mb-2">
                    <span className="mr-2 text-accent font-bold">Q{i + 1}.</span>{q.question}
                  </p>
                  <button onClick={() => toggleAnswer(i)} className="text-xs text-accent hover:underline">
                    {showAnswers[i] ? 'Hide Answer' : 'Show Answer'}
                  </button>
                  {showAnswers[i] && <p className="mt-2 rounded bg-bg-secondary p-2 text-sm text-text-secondary">{q.answer}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Study Notes */}
          <div className="rounded-xl border border-border bg-bg-card p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Study Notes</h3>
            <div className="whitespace-pre-line text-sm leading-relaxed text-text-primary">{analysis.studyNotes}</div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
