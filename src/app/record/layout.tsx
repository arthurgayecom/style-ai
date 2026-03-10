import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Lecture Recorder',
  description: 'Record or upload lectures and get AI-generated summaries, key points, practice questions, and study notes.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
