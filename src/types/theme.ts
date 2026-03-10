export type Theme = 'light' | 'dark' | 'tokyo' | 'ocean' | 'forest' | 'sunset' | 'lavender' | 'midnight' | 'rose' | 'nord' | 'dracula';

export const THEME_ORDER: Theme[] = ['light', 'dark', 'tokyo', 'ocean', 'forest', 'sunset', 'lavender', 'midnight', 'rose', 'nord', 'dracula'];

export const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  tokyo: 'Tokyo',
  ocean: 'Ocean',
  forest: 'Forest',
  sunset: 'Sunset',
  lavender: 'Lavender',
  midnight: 'Midnight',
  rose: 'Rose',
  nord: 'Nord',
  dracula: 'Dracula',
};

export const THEME_COLORS: Record<Theme, { accent: string; bg: string }> = {
  light: { accent: '#3b82f6', bg: '#ffffff' },
  dark: { accent: '#8b5cf6', bg: '#0f172a' },
  tokyo: { accent: '#7dcfff', bg: '#1a1b26' },
  ocean: { accent: '#00b4d8', bg: '#0d1b2a' },
  forest: { accent: '#2dd4bf', bg: '#0a1f0a' },
  sunset: { accent: '#f97316', bg: '#1a0e0e' },
  lavender: { accent: '#a78bfa', bg: '#1e1b2e' },
  midnight: { accent: '#60a5fa', bg: '#0a0a0f' },
  rose: { accent: '#f472b6', bg: '#1a1018' },
  nord: { accent: '#88c0d0', bg: '#2e3440' },
  dracula: { accent: '#bd93f9', bg: '#282a36' },
};
