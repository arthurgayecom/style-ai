'use client';

import { useState, useEffect, useCallback } from 'react';
import { getItem, setItem } from '@/lib/storage/localStorage';
import type { StyleProfile } from '@/types/style';

const EMPTY_PROFILE: StyleProfile = {
  id: '',
  essayCount: 0,
  totalWordCount: 0,
  confidence: 0,
  fingerprint: '',
  dimensions: {
    vocabulary: { score: 0, complexity: '', uniqueWords: [], favoriteExpressions: [], details: '' },
    sentenceStructure: { score: 0, avgLength: 0, variation: '', complexity: '', details: '' },
    paragraphPatterns: { score: 0, avgLength: 0, transitionStyle: '', details: '' },
    tone: { score: 0, formality: 0, description: '', details: '' },
    commonPhrases: [],
    punctuationHabits: { score: 0, patterns: {}, details: '' },
    spellingPatterns: { score: 0, variant: '', quirks: [], details: '' },
    argumentStructure: { score: 0, style: '', details: '' },
    voicePreference: { score: 0, activePercent: 0, personPreference: '', details: '' },
  },
  lastUpdated: '',
};

export function useStyleProfile() {
  const [profile, setProfile] = useState<StyleProfile>(EMPTY_PROFILE);

  useEffect(() => {
    setProfile(getItem<StyleProfile>('style_profile', EMPTY_PROFILE));
  }, []);

  const updateProfile = useCallback((updates: Partial<StyleProfile>) => {
    setProfile((prev) => {
      const updated = { ...prev, ...updates, lastUpdated: new Date().toISOString() };
      setItem('style_profile', updated);
      return updated;
    });
  }, []);

  const clearProfile = useCallback(() => {
    setProfile(EMPTY_PROFILE);
    setItem('style_profile', EMPTY_PROFILE);
  }, []);

  const hasProfile = profile.essayCount > 0 && profile.confidence > 0;

  return { profile, updateProfile, clearProfile, hasProfile };
}
