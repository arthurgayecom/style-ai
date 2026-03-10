import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Write an Essay',
  description: 'Generate essays that match your personal writing style using AI. Choose from 15 essay types with adjustable tone and length.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
