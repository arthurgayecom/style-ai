import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'History',
  description: 'Browse and manage all your generated essays and presentations. Search, filter, copy, and re-edit past work.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
