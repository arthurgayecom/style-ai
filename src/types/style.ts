export interface StyleDimension {
  score: number;
  details: string;
}

export interface StyleAnalysis {
  vocabulary: StyleDimension & {
    complexity: string;
    uniqueWords: string[];
    favoriteExpressions: string[];
  };
  sentenceStructure: StyleDimension & {
    avgLength: number;
    variation: string;
    complexity: string;
  };
  paragraphPatterns: StyleDimension & {
    avgLength: number;
    transitionStyle: string;
  };
  tone: StyleDimension & {
    formality: number;
    description: string;
  };
  commonPhrases: string[];
  punctuationHabits: StyleDimension & {
    patterns: Record<string, number>;
  };
  spellingPatterns: StyleDimension & {
    variant: string;
    quirks: string[];
  };
  argumentStructure: StyleDimension & {
    style: string;
  };
  voicePreference: StyleDimension & {
    activePercent: number;
    personPreference: string;
  };
}

export interface StyleProfile {
  id: string;
  essayCount: number;
  totalWordCount: number;
  confidence: number;
  fingerprint: string;
  dimensions: StyleAnalysis;
  lastUpdated: string;
}
