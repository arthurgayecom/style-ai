import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Learning Hub',
  description: 'Get your essays graded by AI with detailed feedback on structure, grammar, style, and argumentation.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
