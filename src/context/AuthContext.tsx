'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  loading: boolean;
  configured: boolean;
}

interface AuthContextType extends AuthState {
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  saveSettings: (key: string, value: unknown) => Promise<void>;
  loadSettings: (key: string) => Promise<unknown | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  configured: false,
  signUp: async () => ({}),
  signIn: async () => ({}),
  signOut: async () => {},
  saveSettings: async () => {},
  loadSettings: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    configured: isSupabaseConfigured(),
  });

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setState(s => ({ ...s, loading: false }));
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setState(s => ({ ...s, user: session?.user ?? null, loading: false }));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(s => ({ ...s, user: session?.user ?? null }));
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) return { error: 'Auth not configured' };

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) return { error: 'Auth not configured' };

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
  }, []);

  const saveSettings = useCallback(async (key: string, value: unknown) => {
    const supabase = getSupabase();
    if (!supabase || !state.user) return;

    await supabase.from('user_settings').upsert(
      { user_id: state.user.id, setting_key: key, setting_value: value },
      { onConflict: 'user_id,setting_key' }
    );
  }, [state.user]);

  const loadSettings = useCallback(async (key: string): Promise<unknown | null> => {
    const supabase = getSupabase();
    if (!supabase || !state.user) return null;

    const { data } = await supabase
      .from('user_settings')
      .select('setting_value')
      .eq('user_id', state.user.id)
      .eq('setting_key', key)
      .single();

    return data?.setting_value ?? null;
  }, [state.user]);

  return (
    <AuthContext.Provider value={{ ...state, signUp, signIn, signOut, saveSettings, loadSettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
