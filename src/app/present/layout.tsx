import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Presentation',
  description: 'Generate beautiful, styled presentations with AI. Choose from 12 styles, multiple formats, and real images.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
