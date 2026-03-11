'use client';

import { createContext, useCallback, useEffect, useState, useRef } from 'react';
import type { ProviderConfig, ProviderType } from '@/types/ai';
import { getItem, setItem } from '@/lib/storage/localStorage';
import { getSupabase } from '@/lib/supabase';

interface AIProviderContextValue {
  providers: Record<ProviderType, ProviderConfig>;
  activeProvider: ProviderType | null;
  setProviderConfig: (type: ProviderType, config: Partial<ProviderConfig>) => void;
  setActiveProvider: (type: ProviderType) => void;
  isConfigured: boolean;
  syncFromCloud: () => Promise<void>;
  syncToCloud: () => Promise<void>;
}

const DEFAULT_PROVIDERS: Record<ProviderType, ProviderConfig> = {
  free: { type: 'free', enabled: false },
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
  syncFromCloud: async () => {},
  syncToCloud: async () => {},
});

export function AIProviderProvider({ children }: { children: React.ReactNode }) {
  const [providers, setProviders] = useState<Record<ProviderType, ProviderConfig>>(DEFAULT_PROVIDERS);
  const [activeProvider, setActiveProviderState] = useState<ProviderType | null>(null);
  const cloudSyncRef = useRef(false);

  // Load from localStorage on mount, auto-detect free provider
  useEffect(() => {
    const saved = getItem<Record<string, ProviderConfig>>('providers', {});
    const merged = { ...DEFAULT_PROVIDERS, ...saved };
    const active = getItem<ProviderType | null>('active_provider', null);
    setProviders(merged as Record<ProviderType, ProviderConfig>);
    setActiveProviderState(active);

    // Auto-detect free provider if nothing is configured
    if (!active) {
      fetch('/api/ai/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'free' }),
      }).then(r => r.json()).then(data => {
        if (data.connected) {
          setProviders(prev => ({ ...prev, free: { type: 'free', enabled: true, model: 'gemini-2.5-flash' } }));
          setActiveProviderState('free');
          setItem('providers', { ...merged, free: { type: 'free', enabled: true, model: 'gemini-2.5-flash' } });
          setItem('active_provider', 'free');
        }
      }).catch(() => { /* silent */ });
    }
  }, []);

  // Auto-sync from cloud on login
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user && !cloudSyncRef.current) {
        cloudSyncRef.current = true;
        // Load cloud settings
        const { data } = await supabase
          .from('user_settings')
          .select('setting_value')
          .eq('user_id', session.user.id)
          .eq('setting_key', 'providers')
          .single();

        if (data?.setting_value) {
          const cloudProviders = { ...DEFAULT_PROVIDERS, ...(data.setting_value as Record<string, ProviderConfig>) };
          setProviders(cloudProviders as Record<ProviderType, ProviderConfig>);
          setItem('providers', cloudProviders);
        }

        const { data: activeData } = await supabase
          .from('user_settings')
          .select('setting_value')
          .eq('user_id', session.user.id)
          .eq('setting_key', 'active_provider')
          .single();

        if (activeData?.setting_value) {
          const ap = activeData.setting_value as ProviderType;
          setActiveProviderState(ap);
          setItem('active_provider', ap);
        }
      }
      if (event === 'SIGNED_OUT') {
        cloudSyncRef.current = false;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const syncToCloud = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase.from('user_settings').upsert(
      { user_id: session.user.id, setting_key: 'providers', setting_value: providers },
      { onConflict: 'user_id,setting_key' }
    );
    await supabase.from('user_settings').upsert(
      { user_id: session.user.id, setting_key: 'active_provider', setting_value: activeProvider },
      { onConflict: 'user_id,setting_key' }
    );
  }, [providers, activeProvider]);

  const syncFromCloud = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data } = await supabase
      .from('user_settings')
      .select('setting_key, setting_value')
      .eq('user_id', session.user.id);

    if (data) {
      for (const row of data) {
        if (row.setting_key === 'providers') {
          const cloudProviders = { ...DEFAULT_PROVIDERS, ...(row.setting_value as Record<string, ProviderConfig>) };
          setProviders(cloudProviders as Record<ProviderType, ProviderConfig>);
          setItem('providers', cloudProviders);
        }
        if (row.setting_key === 'active_provider') {
          const ap = row.setting_value as ProviderType;
          setActiveProviderState(ap);
          setItem('active_provider', ap);
        }
      }
    }
  }, []);

  const setProviderConfig = useCallback((type: ProviderType, config: Partial<ProviderConfig>) => {
    setProviders((prev) => {
      const updated = { ...prev, [type]: { ...prev[type], ...config } };
      setItem('providers', updated);
      // Auto-sync to cloud
      const supabase = getSupabase();
      if (supabase) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            supabase.from('user_settings').upsert(
              { user_id: session.user.id, setting_key: 'providers', setting_value: updated },
              { onConflict: 'user_id,setting_key' }
            );
          }
        }).catch(() => { /* cloud sync failed silently — local state is fine */ });
      }
      return updated;
    });
  }, []);

  const setActiveProvider = useCallback((type: ProviderType) => {
    setActiveProviderState(type);
    setItem('active_provider', type);
    // Auto-sync to cloud
    const supabase = getSupabase();
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          supabase.from('user_settings').upsert(
            { user_id: session.user.id, setting_key: 'active_provider', setting_value: type },
            { onConflict: 'user_id,setting_key' }
          );
        }
      }).catch(() => { /* cloud sync failed silently — local state is fine */ });
    }
  }, []);

  const isConfigured = activeProvider !== null && providers[activeProvider]?.enabled;

  return (
    <AIProviderContext.Provider value={{ providers, activeProvider, setProviderConfig, setActiveProvider, isConfigured, syncFromCloud, syncToCloud }}>
      {children}
    </AIProviderContext.Provider>
  );
}
