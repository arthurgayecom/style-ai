'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAIProvider } from '@/hooks/useAIProvider';
import { getItem } from '@/lib/storage/localStorage';
import { BACKGROUNDS, type Background } from '@/lib/video/backgrounds';
import { PODCAST_PROMPT } from '@/lib/video/prompts';
import { fadeInUp } from '@/lib/animations';
import { toast } from 'sonner';

interface Segment {
  speaker: 'A' | 'B';
  text: string;
  emotion: string;
}

interface PodcastScript {
  title: string;
  segments: Segment[];
}

type VoiceEngine = 'browser' | 'neural' | 'generative';

// Puter.js type declarations
declare global {
  interface Window {
    puter?: {
      ai: {
        txt2speech: (text: string, options?: { voice?: string; engine?: string }) => Promise<Blob>;
      };
    };
  }
}

export default function VideoPage() {
  const { providers, activeProvider } = useAIProvider();
  const [transcript, setTranscript] = useState('');
  const [script, setScript] = useState<PodcastScript | null>(null);
  const [generating, setGenerating] = useState(false);

  // Player state
  const [playing, setPlaying] = useState(false);
  const [currentSegment, setCurrentSegment] = useState(0);
  const [currentWord, setCurrentWord] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [language, setLanguage] = useState('en');
  const [brainrot, setBrainrot] = useState(false);
  const [selectedBg, setSelectedBg] = useState<Background>(BACKGROUNDS[0]);
  const [customUrl, setCustomUrl] = useState('');
  const [bgOpacity, setBgOpacity] = useState(40);
  const [textMode, setTextMode] = useState<'word' | 'line' | 'all'>('word');
  const [voiceEngine, setVoiceEngine] = useState<VoiceEngine>('browser');
  const [puterLoaded, setPuterLoaded] = useState(false);
  const puterAudioRef = useRef<HTMLAudioElement | null>(null);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Load Puter.js script
  useEffect(() => {
    if (document.getElementById('puter-js')) { setPuterLoaded(true); return; }
    const script = document.createElement('script');
    script.id = 'puter-js';
    script.src = 'https://js.puter.com/v2/';
    script.onload = () => setPuterLoaded(true);
    script.onerror = () => setPuterLoaded(false);
    document.head.appendChild(script);
  }, []);

  // Load transcript from localStorage
  useEffect(() => {
    const saved = getItem<string>('current_transcript', '');
    if (saved) setTranscript(saved);
  }, []);

  // Load voices (needed after first interaction)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const getVoiceForSpeaker = useCallback((speaker: 'A' | 'B'): SpeechSynthesisVoice | undefined => {
    const langVoices = voices.filter(v => v.lang.startsWith(language));
    const pool = langVoices.length >= 2 ? langVoices : voices.filter(v => v.lang.startsWith('en'));
    if (pool.length === 0) return undefined;
    if (speaker === 'A') return pool[0];
    return pool[1] || pool[0];
  }, [voices, language]);

  // Puter.js voice assignments
  const getPuterVoice = (speaker: 'A' | 'B') => {
    return speaker === 'A' ? 'Matthew' : 'Joanna';
  };

  const generateScript = async () => {
    if (!transcript.trim()) { toast.error('No transcript loaded. Go to Record page first.'); return; }
    const config = activeProvider ? providers[activeProvider] : null;
    if (!config) { toast.error('No AI provider configured'); return; }

    setGenerating(true);
    setScript(null);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'custom',
          essayText: `LESSON TRANSCRIPT:\n${transcript}`,
          systemPrompt: PODCAST_PROMPT,
          providerConfig: config,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }
      const data = await res.json();

      let parsed: PodcastScript;
      if (data.analysis?.segments) {
        parsed = data.analysis;
      } else if (data.raw) {
        const { parseAIJSON } = await import('@/lib/ai/parseJSON');
        parsed = parseAIJSON<PodcastScript>(data.raw);
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        throw new Error('AI returned an empty response — try again.');
      }

      setScript(parsed);
      setCurrentSegment(0);
      setCurrentWord(0);
      toast.success(`Podcast ready — ${parsed.segments.length} segments!`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    }
    setGenerating(false);
  };

  // Play segment with browser speechSynthesis (fallback)
  const playBrowserSegment = useCallback((segIdx: number) => {
    if (!script || segIdx >= script.segments.length) {
      setPlaying(false);
      return;
    }

    const seg = script.segments[segIdx];
    setCurrentSegment(segIdx);
    setCurrentWord(0);

    const utterance = new SpeechSynthesisUtterance(seg.text);
    const voice = getVoiceForSpeaker(seg.speaker);
    if (voice) utterance.voice = voice;
    utterance.rate = speed;

    const words = seg.text.split(/\s+/);
    utterance.onboundary = (e) => {
      if (e.name === 'word') {
        let accum = 0;
        for (let i = 0; i < words.length; i++) {
          if (accum >= e.charIndex) { setCurrentWord(i); break; }
          accum += words[i].length + 1;
        }
      }
    };

    utterance.onend = () => {
      playBrowserSegment(segIdx + 1);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [script, speed, getVoiceForSpeaker]);

  // Play segment with Puter.js TTS
  const playPuterSegment = useCallback(async (segIdx: number) => {
    if (!script || segIdx >= script.segments.length) {
      setPlaying(false);
      return;
    }

    const seg = script.segments[segIdx];
    setCurrentSegment(segIdx);
    setCurrentWord(0);

    try {
      if (!window.puter?.ai?.txt2speech) throw new Error('Puter not loaded');

      const blob = await window.puter.ai.txt2speech(seg.text, {
        voice: getPuterVoice(seg.speaker),
        engine: voiceEngine === 'generative' ? 'generative' : 'neural',
      });

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.playbackRate = speed;
      puterAudioRef.current = audio;

      // Word-by-word highlight approximation (estimate word timing from audio duration)
      const words = seg.text.split(/\s+/);
      audio.onloadedmetadata = () => {
        const duration = audio.duration;
        const msPerWord = (duration / words.length) * 1000;
        let wordIdx = 0;
        const interval = setInterval(() => {
          if (wordIdx < words.length) {
            setCurrentWord(wordIdx);
            wordIdx++;
          } else {
            clearInterval(interval);
          }
        }, msPerWord / speed);
        audio.onended = () => {
          clearInterval(interval);
          URL.revokeObjectURL(url);
          playPuterSegment(segIdx + 1);
        };
      };

      audio.play();
    } catch {
      // Fallback to browser TTS
      playBrowserSegment(segIdx);
    }
  }, [script, speed, voiceEngine, playBrowserSegment]);

  const playSegment = useCallback((segIdx: number) => {
    if (voiceEngine === 'browser') {
      playBrowserSegment(segIdx);
    } else {
      playPuterSegment(segIdx);
    }
  }, [voiceEngine, playBrowserSegment, playPuterSegment]);

  const handlePlay = () => {
    if (playing) {
      window.speechSynthesis.cancel();
      if (puterAudioRef.current) { puterAudioRef.current.pause(); puterAudioRef.current = null; }
      setPlaying(false);
    } else {
      setPlaying(true);
      playSegment(currentSegment);
    }
  };

  const handleSkip = (dir: number) => {
    window.speechSynthesis.cancel();
    if (puterAudioRef.current) { puterAudioRef.current.pause(); puterAudioRef.current = null; }
    const next = Math.max(0, Math.min((script?.segments.length || 1) - 1, currentSegment + dir));
    setCurrentSegment(next);
    setCurrentWord(0);
    if (playing) playSegment(next);
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (puterAudioRef.current) { puterAudioRef.current.pause(); puterAudioRef.current = null; }
    };
  }, []);

  const currentSeg = script?.segments[currentSegment];
  const words = currentSeg?.text.split(/\s+/) || [];
  const bgUrl = brainrot
    ? (selectedBg.category === 'custom' ? customUrl : selectedBg.url)
    : null;

  const speakerColor = (s: string) => s === 'A' ? 'text-accent' : 'text-accent-secondary';
  const speakerName = (s: string) => s === 'A' ? 'Alex' : 'Sam';

  return (
    <motion.div className="mx-auto max-w-4xl" {...fadeInUp}>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold gradient-text inline-block">AI Brainrot Video</h1>
        <p className="text-text-secondary">TikTok-style podcast from your lesson — with optional gameplay backgrounds</p>
      </div>

      {!script ? (
        <div className="mx-auto max-w-lg space-y-4">
          <div className="rounded-xl border border-border bg-bg-card p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
            <h2 className="mb-2 text-sm font-semibold text-text-primary">Lesson Content</h2>
            <p className="mb-2 text-xs text-text-muted">Paste your lesson transcript, notes, or any study material. The AI will turn it into a 2-person podcast conversation.</p>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste your lesson transcript, notes, or study material here..."
              rows={8}
              className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-ring resize-none"
            />
            {transcript && (
              <div className="mt-2 rounded-lg bg-bg-secondary p-3 border border-border">
                <p className="text-xs text-text-muted">{transcript.split(/\s+/).filter(Boolean).length} words</p>
                <p className="mt-1 text-xs text-text-secondary">
                  Preview: {transcript.slice(0, 200).trim()}{transcript.length > 200 ? '...' : ''}
                </p>
              </div>
            )}
          </div>

          {transcript.trim() && (
            <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-1">Ready to generate?</h3>
              <p className="text-xs text-text-muted mb-3">This will create a TikTok-style 2-person podcast (Alex & Sam) from your content. Uses your AI provider.</p>
              <button
                onClick={generateScript}
                disabled={generating}
                className="w-full rounded-lg bg-accent py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40"
              >
                {generating ? 'Generating Podcast Script...' : 'Generate Podcast Script'}
              </button>
            </div>
          )}

          {!transcript.trim() && (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-text-muted">Paste or type your lesson content above to get started</p>
              <p className="mt-1 text-xs text-text-muted">Or go to the Record page to capture a lecture first</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Video player container */}
          <div className="relative mx-auto overflow-hidden rounded-2xl border border-border bg-black" style={{ maxWidth: 400, aspectRatio: '9/16' }}>
            {/* Background video */}
            {bgUrl && (
              <video
                ref={videoRef}
                src={bgUrl}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ opacity: bgOpacity / 100 }}
                muted autoPlay loop playsInline
              />
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/60" />

            {/* Content overlay */}
            <div className="relative flex h-full flex-col justify-between p-6">
              {/* Title */}
              <div>
                <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-1">{script.title}</p>
                <p className="text-xs text-white/40">Segment {currentSegment + 1}/{script.segments.length}</p>
              </div>

              {/* Speaker + Subtitles */}
              <div className="flex-1 flex flex-col items-center justify-center">
                {currentSeg && (
                  <>
                    <div className={`mb-4 rounded-full bg-black/50 px-4 py-1 text-sm font-bold ${speakerColor(currentSeg.speaker)}`}>
                      {speakerName(currentSeg.speaker)}
                    </div>
                    <div className="text-center px-2">
                      <p className="text-lg font-bold leading-relaxed">
                        {textMode === 'all' ? (
                          <span className="text-white">{currentSeg.text}</span>
                        ) : textMode === 'line' ? (
                          <span className="text-white">{words.slice(0, currentWord + 1).join(' ')}</span>
                        ) : (
                          words.map((word, i) => (
                            <span
                              key={i}
                              className={`inline-block mx-0.5 transition-all duration-150 ${
                                i === currentWord
                                  ? 'text-white scale-110'
                                  : i < currentWord
                                    ? 'text-white/70'
                                    : 'text-white/30'
                              }`}
                            >
                              {word}
                            </span>
                          ))
                        )}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                <button onClick={() => handleSkip(-1)} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button onClick={handlePlay} className="rounded-full bg-white/20 p-4 text-white hover:bg-white/30">
                  {playing ? (
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                  ) : (
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  )}
                </button>
                <button onClick={() => handleSkip(1)} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
              <div className="h-full bg-accent transition-all" style={{ width: `${((currentSegment + 1) / script.segments.length) * 100}%` }} />
            </div>
          </div>

          {/* Controls panel */}
          <div className="rounded-xl border border-border bg-bg-card p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
            <div className="grid grid-cols-2 gap-4">
              {/* Speed */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">Speed</label>
                <div className="flex gap-1">
                  {[0.75, 1, 1.25, 1.5].map(s => (
                    <button key={s} onClick={() => setSpeed(s)}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${speed === s ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:bg-bg-hover'}`}>
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Brainrot toggle */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">Brainrot Mode</label>
                <button
                  onClick={() => setBrainrot(!brainrot)}
                  className={`w-full rounded-lg py-1.5 text-sm font-medium transition-all ${brainrot ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:bg-bg-hover'}`}
                >
                  {brainrot ? 'ON — Gameplay Background' : 'OFF — Clean View'}
                </button>
              </div>
            </div>

            {/* Voice Quality */}
            <div className="col-span-2 mt-2">
              <label className="mb-1 block text-sm font-medium text-text-primary">Voice Quality</label>
              <p className="text-[10px] text-text-muted mb-1.5">
                {voiceEngine === 'browser' ? 'Browser voices — robotic but instant' : voiceEngine === 'neural' ? 'Neural voices — natural sounding' : 'Generative voices — most human-like (may take a moment)'}
              </p>
              <div className="flex gap-1">
                {([
                  ['browser', 'Standard'] as const,
                  ['neural', 'Neural'] as const,
                  ['generative', 'Generative'] as const,
                ]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setVoiceEngine(key)}
                    disabled={key !== 'browser' && !puterLoaded}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
                      voiceEngine === key ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed'
                    }`}
                  >
                    {label}
                    {key !== 'browser' && !puterLoaded && ' (loading...)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Language (only for browser engine) */}
            {voiceEngine === 'browser' && (
              <div className="col-span-2 mt-2">
                <label className="mb-1 block text-sm font-medium text-text-primary">Voice Language</label>
                <p className="text-[10px] text-text-muted mb-1.5">Changes the text-to-speech voice (browser voices only)</p>
                <div className="flex flex-wrap gap-1">
                  {[['en', 'English'], ['fr', 'French'], ['es', 'Spanish'], ['de', 'German'], ['pt', 'Portuguese'], ['it', 'Italian']].map(([code, name]) => (
                    <button key={code} onClick={() => setLanguage(code)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${language === code ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:bg-bg-hover'}`}>
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Text Animation */}
            <div className="col-span-2 mt-2">
              <label className="mb-1 block text-sm font-medium text-text-primary">Text Animation</label>
              <div className="flex gap-1">
                {([['word', 'Word by Word'], ['line', 'Line by Line'], ['all', 'All at Once']] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setTextMode(key)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${textMode === key ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:bg-bg-hover'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Background Opacity */}
            {brainrot && (
              <div className="col-span-2 mt-2">
                <label className="mb-1 block text-sm font-medium text-text-primary">Background Opacity: {bgOpacity}%</label>
                <input
                  type="range" min={10} max={100} value={bgOpacity}
                  onChange={(e) => setBgOpacity(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>
            )}

            {/* Background selector */}
            {brainrot && (
              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-text-primary">Background</label>
                <div className="flex flex-wrap gap-2">
                  {BACKGROUNDS.filter(b => b.category !== 'none').map(bg => (
                    <button
                      key={bg.id}
                      onClick={() => setSelectedBg(bg)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        selectedBg.id === bg.id ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:bg-bg-hover'
                      }`}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>
                {selectedBg.category === 'custom' && (
                  <input
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="Paste a direct video URL (MP4)..."
                    className="mt-2 w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-ring"
                  />
                )}
                <p className="mt-2 text-xs text-text-muted">
                  Place MP4 files in the public/videos/ folder (subway.mp4, minecraft.mp4, satisfying.mp4)
                </p>
              </div>
            )}
          </div>

          {/* Script segments */}
          <div className="rounded-xl border border-border bg-bg-card p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
            <h3 className="mb-3 text-sm font-semibold text-text-primary">Script ({script.segments.length} segments)</h3>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {script.segments.map((seg, i) => (
                <button
                  key={i}
                  onClick={() => { window.speechSynthesis.cancel(); if (puterAudioRef.current) { puterAudioRef.current.pause(); puterAudioRef.current = null; } setCurrentSegment(i); setCurrentWord(0); if (playing) playSegment(i); }}
                  className={`w-full rounded-lg p-3 text-left text-sm transition-all ${
                    i === currentSegment ? 'border border-accent bg-accent/5' : 'border border-transparent hover:bg-bg-hover'
                  }`}
                >
                  <span className={`mr-2 font-bold ${speakerColor(seg.speaker)}`}>{speakerName(seg.speaker)}:</span>
                  <span className="text-text-secondary">{seg.text}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="text-center">
            <button onClick={() => setScript(null)} className="rounded-lg border border-border px-6 py-2.5 text-sm text-text-secondary hover:bg-bg-hover">
              Generate New Script
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
