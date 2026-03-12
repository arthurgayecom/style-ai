'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UserMeasurements } from '@/types/mockup';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function TryOnPage() {
  const [userPhoto, setUserPhoto] = useState<string>('');
  const [garmentImage, setGarmentImage] = useState<string>('');
  const [measurements, setMeasurements] = useState<UserMeasurements>({});
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [resultImage, setResultImage] = useState('');
  const [resultDescription, setResultDescription] = useState('');
  const photoRef = useRef<HTMLInputElement>(null);
  const garmentRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please upload an image file'); return; }
    if (file.size > MAX_FILE_SIZE) { setError('File too large (max 5MB)'); return; }
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => setter(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!userPhoto || !garmentImage) {
      setError('Please upload both your photo and a garment image');
      return;
    }

    setGenerating(true);
    setError('');
    setResultImage('');

    try {
      const res = await fetch('/api/ai/tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPhoto, garmentImage, measurements: showMeasurements ? measurements : undefined }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Try-on failed');

      setResultImage(data.resultImage);
      setResultDescription(data.description || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setGenerating(false);
    }
  };

  const updateMeasurement = (key: keyof UserMeasurements, value: string) => {
    setMeasurements(prev => ({ ...prev, [key]: value }));
  };

  const downloadResult = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = 'tryon-result.png';
    link.click();
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] pb-24">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-extrabold text-text-primary">Virtual Try-On</h1>
        <p className="mt-1 text-sm text-text-muted">
          Upload your photo and a garment to see how it looks on you
        </p>
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left: Inputs */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          {/* Two upload cards side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Your Photo */}
            <div className="rounded-2xl border border-border bg-bg-card p-4">
              <h3 className="mb-3 text-xs font-bold text-text-primary uppercase tracking-wider">Your Photo</h3>
              <div
                onClick={() => photoRef.current?.click()}
                className="relative flex aspect-[3/4] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border hover:border-purple-400/50 hover:bg-bg-hover transition-all"
              >
                {userPhoto ? (
                  <>
                    <img src={userPhoto} alt="Your photo" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                      <p className="text-xs text-white font-semibold">Change Photo</p>
                    </div>
                  </>
                ) : (
                  <>
                    <svg className="mb-2 h-8 w-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <p className="text-[10px] text-text-muted text-center px-2">Full body photo works best</p>
                  </>
                )}
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, setUserPhoto)} />
              </div>
            </div>

            {/* Garment Image */}
            <div className="rounded-2xl border border-border bg-bg-card p-4">
              <h3 className="mb-3 text-xs font-bold text-text-primary uppercase tracking-wider">Garment</h3>
              <div
                onClick={() => garmentRef.current?.click()}
                className="relative flex aspect-[3/4] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border hover:border-purple-400/50 hover:bg-bg-hover transition-all"
              >
                {garmentImage ? (
                  <>
                    <img src={garmentImage} alt="Garment" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                      <p className="text-xs text-white font-semibold">Change Garment</p>
                    </div>
                  </>
                ) : (
                  <>
                    <svg className="mb-2 h-8 w-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-2.5 2.5L12 3m0 0L8.5 6.5M12 3v0M4.929 19.071l2.828-2.828m0 0L12 12m-4.243 4.243L3 21m0 0h4.243M3 21v-4.243" />
                    </svg>
                    <p className="text-[10px] text-text-muted text-center px-2">Flat-lay or product photo</p>
                  </>
                )}
                <input ref={garmentRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, setGarmentImage)} />
              </div>
            </div>
          </div>

          {/* Measurements Toggle */}
          <div className="rounded-2xl border border-border bg-bg-card p-4">
            <button
              onClick={() => setShowMeasurements(!showMeasurements)}
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
                <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Measurements</span>
                <span className="text-[10px] text-text-muted">(Optional — improves fit)</span>
              </div>
              <svg className={`h-4 w-4 text-text-muted transition-transform ${showMeasurements ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <AnimatePresence>
              {showMeasurements && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 grid grid-cols-2 gap-3 overflow-hidden"
                >
                  {(['height', 'chest', 'waist', 'hips', 'shoulders', 'size'] as const).map((field) => (
                    <div key={field}>
                      <label className="mb-1 block text-[10px] font-semibold text-text-secondary capitalize">{field}</label>
                      <input
                        type="text"
                        value={measurements[field] || ''}
                        onChange={(e) => updateMeasurement(field, e.target.value)}
                        placeholder={field === 'size' ? 'S / M / L / XL' : 'e.g., 32"'}
                        className="w-full rounded-lg border border-border bg-bg-primary px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted/50 focus:border-purple-400 focus:outline-none"
                      />
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Generate */}
          <button
            onClick={handleGenerate}
            disabled={generating || !userPhoto || !garmentImage}
            className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-xl hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating Try-On...
              </span>
            ) : (
              'Try It On'
            )}
          </button>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400"
            >
              {error}
            </motion.div>
          )}
        </motion.div>

        {/* Right: Result */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="rounded-2xl border border-border bg-bg-card p-6">
            <h2 className="mb-4 text-sm font-bold text-text-primary uppercase tracking-wider">Result</h2>

            <AnimatePresence mode="wait">
              {generating ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex min-h-[400px] flex-col items-center justify-center"
                >
                  <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-purple-500/20" />
                    <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-4 border-transparent border-t-purple-500" />
                  </div>
                  <p className="mt-4 text-sm text-text-muted">Generating your try-on...</p>
                  <p className="mt-1 text-xs text-text-muted/60">This may take 15-45 seconds</p>
                </motion.div>
              ) : resultImage ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="overflow-hidden rounded-xl border border-border">
                    <img src={resultImage} alt="Try-on result" className="w-full" />
                  </div>
                  <button
                    onClick={downloadResult}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-2.5 text-xs font-semibold text-purple-400 hover:bg-purple-500/20 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </button>
                  {resultDescription && (
                    <p className="text-xs text-text-muted leading-relaxed">{resultDescription}</p>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex min-h-[400px] flex-col items-center justify-center text-center"
                >
                  <div className="mb-4 rounded-2xl bg-purple-500/10 p-4">
                    <svg className="h-10 w-10 text-purple-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-text-secondary">Your try-on will appear here</p>
                  <p className="mt-1 text-xs text-text-muted">Upload your photo and a garment to get started</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
