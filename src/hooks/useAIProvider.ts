'use client';

import { useContext } from 'react';
import { AIProviderContext } from '@/context/AIProviderContext';

export function useAIProvider() {
  return useContext(AIProviderContext);
}
