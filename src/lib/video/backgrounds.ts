export interface Background {
  id: string;
  label: string;
  url: string | null;
  category: 'none' | 'gameplay' | 'satisfying' | 'custom';
}

export const BACKGROUNDS: Background[] = [
  { id: 'none', label: 'Clean (No Video)', url: null, category: 'none' },
  { id: 'subway', label: 'Subway Surfers', url: '/videos/subway.mp4', category: 'gameplay' },
  { id: 'minecraft', label: 'Minecraft Parkour', url: '/videos/minecraft.mp4', category: 'gameplay' },
  { id: 'satisfying', label: 'Satisfying', url: '/videos/satisfying.mp4', category: 'satisfying' },
  { id: 'custom', label: 'Custom URL', url: null, category: 'custom' },
];
