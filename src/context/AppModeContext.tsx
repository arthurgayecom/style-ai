'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { AppMode } from '@/types/mockup';
import { getItem, setItem } from '@/lib/storage/localStorage';

interface AppModeContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

const AppModeContext = createContext<AppModeContextValue>({
  mode: 'school',
  setMode: () => {},
});

export function AppModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>('school');

  useEffect(() => {
    const saved = getItem<AppMode>('app_mode', 'school');
    setModeState(saved);
  }, []);

  const setMode = (m: AppMode) => {
    setModeState(m);
    setItem('app_mode', m);
  };

  return (
    <AppModeContext.Provider value={{ mode, setMode }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  return useContext(AppModeContext);
}
