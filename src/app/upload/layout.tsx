import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Upload Essays',
  description: 'Upload or paste your essays to build a personal writing style profile. Supports file upload and text input.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
