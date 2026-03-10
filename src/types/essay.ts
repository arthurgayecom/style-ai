import type { StyleAnalysis } from './style';

export interface UploadedEssay {
  id: string;
  title: string;
  text: string;
  wordCount: number;
  uploadedAt: string;
  sourceType: 'text' | 'pdf' | 'image';
  status: 'pending' | 'analyzing' | 'analyzed' | 'error';
  analysis?: StyleAnalysis;
  error?: string;
}

export interface GeneratedEssay {
  id: string;
  topic: string;
  essayType: string;
  text: string;
  wordCount: number;
  styleMatchScore?: number;
  generatedAt: string;
}

export type EssayType =
  | 'argumentative'
  | 'narrative'
  | 'expository'
  | 'descriptive'
  | 'persuasive'
  | 'analytical'
  | 'compare_contrast'
  | 'cause_effect'
  | 'research'
  | 'reflective'
  | 'opinion'
  | 'literary_analysis'
  | 'lab_report'
  | 'case_study'
  | 'book_review';

export const ESSAY_TYPES: { value: EssayType; label: string }[] = [
  { value: 'argumentative', label: 'Argumentative' },
  { value: 'narrative', label: 'Narrative' },
  { value: 'expository', label: 'Expository' },
  { value: 'descriptive', label: 'Descriptive' },
  { value: 'persuasive', label: 'Persuasive' },
  { value: 'analytical', label: 'Analytical' },
  { value: 'compare_contrast', label: 'Compare & Contrast' },
  { value: 'cause_effect', label: 'Cause & Effect' },
  { value: 'research', label: 'Research Paper' },
  { value: 'reflective', label: 'Reflective' },
  { value: 'opinion', label: 'Opinion / Editorial' },
  { value: 'literary_analysis', label: 'Literary Analysis' },
  { value: 'lab_report', label: 'Lab Report' },
  { value: 'case_study', label: 'Case Study' },
  { value: 'book_review', label: 'Book Review' },
];

export const WRITING_TONES = [
  'Casual', 'Formal', 'Academic', 'Conversational', 'Witty', 'Serious', 'Passionate', 'Neutral',
];

export const WRITING_PERSPECTIVES = [
  { value: 'first', label: '1st Person (I/We)' },
  { value: 'second', label: '2nd Person (You)' },
  { value: 'third', label: '3rd Person (He/She/They)' },
  { value: 'auto', label: 'Auto (match profile)' },
];

export const WRITING_LEVELS = [
  { value: 'middle_school', label: 'Middle School' },
  { value: 'high_school', label: 'High School' },
  { value: 'undergraduate', label: 'Undergraduate' },
  { value: 'graduate', label: 'Graduate' },
  { value: 'professional', label: 'Professional' },
];

export const HUMANIZATION_LEVELS = [
  { value: 'low', label: 'Standard', desc: 'Normal AI writing' },
  { value: 'medium', label: 'Natural', desc: 'Reduced AI patterns' },
  { value: 'high', label: 'Human-like', desc: 'Max humanization' },
];

export const LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'french', label: 'French' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'german', label: 'German' },
  { value: 'arabic', label: 'Arabic' },
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'italian', label: 'Italian' },
  { value: 'dutch', label: 'Dutch' },
  { value: 'russian', label: 'Russian' },
  { value: 'chinese', label: 'Chinese' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'korean', label: 'Korean' },
];
