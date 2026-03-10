'use client';

import { createContext, useCallback, useEffect, useState } from 'react';
import type { ProviderConfig, ProviderType } from '@/types/ai';
import { getItem, setItem } from '@/lib/storage/localStorage';

interface AIProviderContextValue {
  providers: Record<ProviderType, ProviderConfig>;
  activeProvider: ProviderType | null;
  setProviderConfig: (type: ProviderType, config: Partial<ProviderConfig>) => void;
  setActiveProvider: (type: ProviderType) => void;
  isConfigured: boolean;
}

const DEFAULT_PROVIDERS: Record<ProviderType, ProviderConfig> = {
  anthropic: { type: 'anthropic', apiKey: '', enabled: false },
  openai: { type: 'openai', apiKey: '', enabled: false },
  gemini: { type: 'gemini', apiKey: '', enabled: false },
  'claude-cli': { type: 'claude-cli', enabled: false },
  kimi: { type: 'kimi', apiKey: '', enabled: false },
  ollama: { type: 'ollama', enabled: false },
};

export const AIProviderContext = createContext<AIProviderContextValue>({
  providers: DEFAULT_PROVIDERS,
  activeProvider: null,
  setProviderConfig: () => {},
  setActiveProvider: () => {},
  isConfigured: false,
});

export function AIProviderProvider({ children }: { children: React.ReactNode }) {
  const [providers, setProviders] = useState<Record<ProviderType, ProviderConfig>>(DEFAULT_PROVIDERS);
  const [activeProvider, setActiveProviderState] = useState<ProviderType | null>(null);

  useEffect(() => {
    const saved = getItem<Record<string, ProviderConfig>>('providers', {});
    const merged = { ...DEFAULT_PROVIDERS, ...saved };
    const active = getItem<ProviderType | null>('active_provider', null);
    setProviders(merged as Record<ProviderType, ProviderConfig>);
    setActiveProviderState(active);
  }, []);

  const setProviderConfig = useCallback((type: ProviderType, config: Partial<ProviderConfig>) => {
    setProviders((prev) => {
      const updated = { ...prev, [type]: { ...prev[type], ...config } };
      setItem('providers', updated);
      return updated;
    });
  }, []);

  const setActiveProvider = useCallback((type: ProviderType) => {
    setActiveProviderState(type);
    setItem('active_provider', type);
  }, []);

  const isConfigured = activeProvider !== null && providers[activeProvider]?.enabled;

  return (
    <AIProviderContext.Provider value={{ providers, activeProvider, setProviderConfig, setActiveProvider, isConfigured }}>
      {children}
    </AIProviderContext.Provider>
  );
}
