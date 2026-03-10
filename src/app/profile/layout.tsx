import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Style Profile',
  description: 'View your personal writing style profile built from your uploaded essays. See tone, vocabulary, and patterns.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
