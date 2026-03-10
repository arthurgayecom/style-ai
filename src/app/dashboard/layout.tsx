import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Track your writing progress, style confidence, and study streaks. See stats and quick actions at a glance.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
