import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Practice Exercises',
  description: 'Interactive writing exercises targeting your weak spots. Improve grammar, vocabulary, structure, and style.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
