'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAIProvider } from '@/hooks/useAIProvider';
import { useEssays } from '@/hooks/useEssays';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { fadeInUp } from '@/lib/animations';
import { toast } from 'sonner';
import { getItem, setItem } from '@/lib/storage/localStorage';

type Difficulty = 'easy' | 'medium' | 'hard';
type ExerciseType = 'multiple_choice' | 'fill_blank' | 'rewrite' | 'error_fix';

interface Exercise {
  type: ExerciseType;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  category: string;
  imageDescription?: string;
}

interface ExerciseStats {
  exercisesDone: number;
  streak: number;
  bestStreak: number;
  correct: number;
  total: number;
}

const DEFAULT_STATS: ExerciseStats = { exercisesDone: 0, streak: 0, bestStreak: 0, correct: 0, total: 0 };

const EXERCISE_PROMPT = `You are an educational exercise generator. Create a set of 5 interactive exercises for a student to practice their writing skills.

Difficulty level: DIFFICULTY_LEVEL
Focus areas: grammar, vocabulary, sentence structure, punctuation, clarity
Subject: SUBJECT_AREA

Return ONLY valid JSON (no code blocks):
{
  "exercises": [
    {
      "type": "multiple_choice" | "fill_blank" | "rewrite" | "error_fix",
      "question": "the question text",
      "options": ["option1", "option2", "option3", "option4"],
      "correctAnswer": "the correct answer exactly matching one option or the expected answer",
      "explanation": "why this is correct and how to remember it",
      "category": "grammar/vocabulary/punctuation/structure/clarity",
      "imageDescription": "optional — describe an image that would help illustrate this question (only include for ~1-2 exercises)"
    }
  ]
}

For fill_blank: use ___ in the question for where the answer goes. Options are still provided.
For rewrite: the question is a poorly written sentence. The correctAnswer is the improved version. No options needed.
For error_fix: the question contains an error. Options are possible corrections. correctAnswer matches one option.
Mix the exercise types. Make them educational but engaging and fun — not dry academic drills.`;

const CUSTOM_EXERCISE_PROMPT = `You are an educational exercise generator. The student has uploaded their own essays below. Create 5 exercises based SPECIFICALLY on the content, vocabulary, topics, and arguments in these essays.

Questions should:
- Test knowledge of topics covered in the essays
- Include vocabulary FROM the essays
- Ask about arguments, evidence, and claims made
- Be engaging and entertaining, not boring
- Sometimes include imageDescription for visual questions

STUDENT'S ESSAYS:
ESSAY_CONTENT

Difficulty: DIFFICULTY_LEVEL

Return ONLY valid JSON (no code blocks):
{
  "exercises": [
    {
      "type": "multiple_choice" | "fill_blank" | "rewrite" | "error_fix",
      "question": "the question text",
      "options": ["option1", "option2", "option3", "option4"],
      "correctAnswer": "the correct answer",
      "explanation": "why this is correct",
      "category": "grammar/vocabulary/punctuation/structure/clarity",
      "imageDescription": "optional image description"
    }
  ]
}`;

const SUBJECTS = [
  { value: 'general', label: 'General Writing' },
  { value: 'grammar', label: 'Grammar' },
  { value: 'vocabulary', label: 'Vocabulary' },
  { value: 'punctuation', label: 'Punctuation' },
  { value: 'essay_structure', label: 'Essay Structure' },
  { value: 'academic', label: 'Academic Writing' },
  { value: 'french', label: 'French' },
  { value: 'math_writing', label: 'Math (Written Problems)' },
  { value: 'science', label: 'Science Writing' },
  { value: 'custom', label: 'From Your Essays' },
];

function typeLabel(type: ExerciseType) {
  switch (type) {
    case 'multiple_choice': return 'Multiple Choice';
    case 'fill_blank': return 'Fill in the Blank';
    case 'rewrite': return 'Rewrite';
    case 'error_fix': return 'Find & Fix';
  }
}

function catColor(cat: string) {
  switch (cat) {
    case 'grammar': return 'bg-accent/10 text-accent';
    case 'vocabulary': return 'bg-success/10 text-success';
    case 'punctuation': return 'bg-warning/10 text-warning';
    case 'structure': return 'bg-accent-secondary/10 text-accent-secondary';
    default: return 'bg-bg-hover text-text-muted';
  }
}

export default function ExercisesPage() {
  const { providers, activeProvider } = useAIProvider();
  const { essays } = useEssays();
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [subject, setSubject] = useState('general');
  const [selectedEssayIds, setSelectedEssayIds] = useState<string[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [rewriteAnswer, setRewriteAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [stats, setStats] = useState<ExerciseStats>(DEFAULT_STATS);

  useEffect(() => {
    try {
      const s = getItem<ExerciseStats>('exercise_stats', DEFAULT_STATS);
      if (s && typeof s.exercisesDone === 'number') {
        setStats(s);
      }
    } catch {
      setStats(DEFAULT_STATS);
    }
  }, []);

  const toggleEssaySelection = (id: string) => {
    setSelectedEssayIds(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  const generateExercises = async () => {
    const config = activeProvider ? providers[activeProvider] : null;
    if (!config) { toast.error('No AI provider configured'); return; }
    if (subject === 'custom' && selectedEssayIds.length === 0) { toast.error('Select at least one essay'); return; }

    setLoading(true);
    setExercises([]);
    setCurrentIdx(0);
    setScore(0);
    setSessionDone(false);
    setShowResult(false);
    setSelectedAnswer(null);

    try {
      let prompt: string;

      if (subject === 'custom') {
        const selectedEssays = essays.filter(e => selectedEssayIds.includes(e.id));
        const essayContent = selectedEssays.map(e => `### ${e.title}\n${e.text.slice(0, 3000)}`).join('\n\n');
        prompt = CUSTOM_EXERCISE_PROMPT
          .replace('ESSAY_CONTENT', essayContent)
          .replace('DIFFICULTY_LEVEL', difficulty);
      } else {
        prompt = EXERCISE_PROMPT
          .replace('DIFFICULTY_LEVEL', difficulty)
          .replace('SUBJECT_AREA', SUBJECTS.find(s => s.value === subject)?.label || subject);
      }

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'custom', essayText: `Generate ${difficulty} exercises for ${subject}`, systemPrompt: prompt, providerConfig: config }),
      });
      const data = await res.json();

      let parsed;
      if (data.analysis?.exercises) {
        parsed = data.analysis.exercises;
      } else if (data.raw) {
        const cleaned = data.raw.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned).exercises;
      }

      if (parsed && Array.isArray(parsed)) {
        setExercises(parsed);
        toast.success(`${parsed.length} exercises ready!`);
      } else {
        throw new Error('Could not parse exercises');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate exercises');
    }
    setLoading(false);
  };

  const checkAnswer = () => {
    const ex = exercises[currentIdx];
    if (!ex) return;
    const answer = ex.type === 'rewrite' ? rewriteAnswer.trim() : selectedAnswer;
    const isCorrect = ex.type === 'rewrite' ? true : answer === ex.correctAnswer;
    if (isCorrect) setScore(s => s + 1);
    setShowResult(true);

    const newStats = { ...stats };
    newStats.exercisesDone += 1;
    newStats.total += 1;
    if (isCorrect) {
      newStats.correct += 1;
      newStats.streak += 1;
      if (newStats.streak > newStats.bestStreak) newStats.bestStreak = newStats.streak;
    } else {
      newStats.streak = 0;
    }
    setStats(newStats);
    setItem('exercise_stats', newStats);

    const ls = getItem('learning_stats', { essaysGraded: 0, exercisesDone: 0, streak: 0, lecturesRecorded: 0 });
    ls.exercisesDone += 1;
    ls.streak = newStats.streak;
    setItem('learning_stats', ls);
  };

  const nextExercise = () => {
    if (currentIdx + 1 >= exercises.length) { setSessionDone(true); return; }
    setCurrentIdx(i => i + 1);
    setSelectedAnswer(null);
    setRewriteAnswer('');
    setShowResult(false);
  };

  const current = exercises.length > 0 ? exercises[currentIdx] : null;
  const analyzedEssays = essays.filter(e => e.status === 'analyzed');

  return (
    <motion.div className="mx-auto max-w-2xl" {...fadeInUp}>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold gradient-text inline-block">Practice Exercises</h1>
        <p className="text-text-secondary">Interactive exercises to sharpen your skills</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Done', value: stats.exercisesDone, color: 'text-accent' },
          { label: 'Accuracy', value: `${stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}%`, color: 'text-success' },
          { label: 'Streak', value: stats.streak, color: 'text-warning' },
          { label: 'Best Streak', value: stats.bestStreak, color: 'text-accent-secondary' },
        ].map((item) => (
          <div key={item.label} className="feature-card rounded-xl border border-border bg-bg-card p-3 text-center" style={{ boxShadow: 'var(--card-shadow)' }}>
            <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
            <p className="text-xs text-text-muted">{item.label}</p>
          </div>
        ))}
      </div>

      {exercises.length === 0 && !loading ? (
        <motion.div
          className="rounded-xl border border-border bg-bg-card p-6"
          style={{ boxShadow: 'var(--card-shadow)' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="mb-4 text-lg font-semibold text-text-primary">Configure Your Practice</h2>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-text-primary">Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary outline-none focus:border-ring"
            >
              {SUBJECTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {subject === 'custom' && (
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-text-primary">Select Essays</label>
              {analyzedEssays.length === 0 ? (
                <p className="text-sm text-text-muted">No essays uploaded yet. Upload some on the Upload page first.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto rounded-lg border border-border p-2">
                  {analyzedEssays.map(essay => (
                    <label key={essay.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-bg-hover cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedEssayIds.includes(essay.id)}
                        onChange={() => toggleEssaySelection(essay.id)}
                        className="h-4 w-4 rounded border-border accent-accent"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">{essay.title}</p>
                        <p className="text-xs text-text-muted">{essay.wordCount} words</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-text-primary">Difficulty</label>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-medium capitalize transition-all ${
                    difficulty === d ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:bg-bg-hover'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={generateExercises}
            disabled={subject === 'custom' && selectedEssayIds.length === 0}
            className="w-full rounded-lg bg-accent py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40 transition-all"
          >
            Start Practice
          </button>
        </motion.div>
      ) : loading ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-border bg-bg-card" style={{ boxShadow: 'var(--card-shadow)' }}>
          <div className="text-center">
            <LoadingSpinner className="mx-auto mb-3 h-8 w-8 text-accent" />
            <p className="text-sm text-text-muted">Generating exercises...</p>
          </div>
        </div>
      ) : sessionDone ? (
        <motion.div
          className="rounded-xl border border-border bg-bg-card p-6 text-center"
          style={{ boxShadow: 'var(--card-shadow)' }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="mb-4 text-5xl">{score >= exercises.length * 0.8 ? '🎉' : score >= exercises.length * 0.5 ? '👍' : '💪'}</div>
          <h2 className="mb-2 text-2xl font-bold text-text-primary">Session Complete!</h2>
          <p className="mb-4 text-lg text-text-secondary">
            You got <span className="font-bold text-accent">{score}</span> out of <span className="font-bold">{exercises.length}</span> correct
          </p>
          <div className="h-3 overflow-hidden rounded-full bg-bg-hover mb-6">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-secondary"
              initial={{ width: 0 }}
              animate={{ width: `${(score / exercises.length) * 100}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={generateExercises} className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-all">Practice Again</button>
            <button onClick={() => { setExercises([]); setSessionDone(false); }} className="rounded-lg border border-border px-6 py-2.5 text-sm text-text-secondary hover:bg-bg-hover transition-all">Change Settings</button>
          </div>
        </motion.div>
      ) : current ? (
        <motion.div
          className="rounded-xl border border-border bg-bg-card"
          style={{ boxShadow: 'var(--card-shadow)' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          key={currentIdx}
        >
          <div className="border-b border-border px-5 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">{currentIdx + 1}/{exercises.length}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${catColor(current.category)}`}>{current.category}</span>
                <span className="rounded-full bg-bg-hover px-2 py-0.5 text-xs text-text-muted">{typeLabel(current.type)}</span>
              </div>
              <span className="text-sm font-bold text-accent">{score} pts</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-bg-hover">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent-secondary"
                initial={{ width: 0 }}
                animate={{ width: `${((currentIdx + 1) / exercises.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          <div className="p-5">
            {current.imageDescription && (
              <div className="mb-4 rounded-lg border border-dashed border-border bg-bg-secondary p-4 text-center">
                <svg className="mx-auto mb-2 h-8 w-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5v-15a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v15a1.5 1.5 0 001.5 1.5z" />
                </svg>
                <p className="text-sm italic text-text-muted">{current.imageDescription}</p>
              </div>
            )}

            <p className="mb-5 text-base leading-relaxed text-text-primary">{current.question}</p>

            {current.type === 'rewrite' ? (
              <textarea
                value={rewriteAnswer}
                onChange={(e) => setRewriteAnswer(e.target.value)}
                placeholder="Write your improved version here..."
                rows={4}
                disabled={showResult}
                className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-ring disabled:opacity-60 resize-none transition-all"
              />
            ) : (
              <div className="space-y-2">
                {(current.options || []).map((option, i) => {
                  const isSelected = selectedAnswer === option;
                  const isCorrect = option === current.correctAnswer;
                  const showCorrect = showResult && isCorrect;
                  const showWrong = showResult && isSelected && !isCorrect;

                  return (
                    <button
                      key={i}
                      onClick={() => !showResult && setSelectedAnswer(option)}
                      disabled={showResult}
                      className={`w-full rounded-lg border p-3 text-left text-sm transition-all ${
                        showCorrect ? 'border-success bg-success/10 text-success' :
                        showWrong ? 'border-error bg-error/10 text-error' :
                        isSelected ? 'border-accent bg-accent/10 text-accent' :
                        'border-border hover:border-text-muted text-text-primary'
                      }`}
                    >
                      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs font-medium">
                        {String.fromCharCode(65 + i)}
                      </span>
                      {option}
                      {showCorrect && ' ✓'}
                      {showWrong && ' ✗'}
                    </button>
                  );
                })}
              </div>
            )}

            {showResult && (
              <motion.div
                className="mt-4 rounded-lg border border-border bg-bg-secondary p-4"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <p className="text-sm font-medium text-text-primary mb-1">
                  {current.type === 'rewrite' ? 'Suggested answer:' : selectedAnswer === current.correctAnswer ? 'Correct!' : 'Not quite.'}
                </p>
                {current.type === 'rewrite' && <p className="text-sm text-accent mb-2">{current.correctAnswer}</p>}
                <p className="text-sm text-text-secondary">{current.explanation}</p>
              </motion.div>
            )}

            <div className="mt-4 flex justify-end">
              {!showResult ? (
                <button
                  onClick={checkAnswer}
                  disabled={current.type === 'rewrite' ? !rewriteAnswer.trim() : !selectedAnswer}
                  className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40 transition-all"
                >
                  Check Answer
                </button>
              ) : (
                <button onClick={nextExercise} className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-all">
                  {currentIdx + 1 >= exercises.length ? 'See Results' : 'Next'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      ) : null}
    </motion.div>
  );
}
