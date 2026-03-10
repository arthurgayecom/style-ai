'use client';

import { useState, useEffect, useCallback } from 'react';
import { getItem, setItem } from '@/lib/storage/localStorage';
import type { UploadedEssay } from '@/types/essay';

export function useEssays() {
  const [essays, setEssays] = useState<UploadedEssay[]>([]);

  useEffect(() => {
    setEssays(getItem<UploadedEssay[]>('essays', []));
  }, []);

  const save = useCallback((updated: UploadedEssay[]) => {
    setEssays(updated);
    setItem('essays', updated);
  }, []);

  const addEssay = useCallback((essay: UploadedEssay) => {
    setEssays((prev) => {
      const updated = [...prev, essay];
      setItem('essays', updated);
      return updated;
    });
  }, []);

  const updateEssay = useCallback((id: string, updates: Partial<UploadedEssay>) => {
    setEssays((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, ...updates } : e));
      setItem('essays', updated);
      return updated;
    });
  }, []);

  const removeEssay = useCallback((id: string) => {
    setEssays((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      setItem('essays', updated);
      return updated;
    });
  }, []);

  return { essays, addEssay, updateEssay, removeEssay, save };
}
