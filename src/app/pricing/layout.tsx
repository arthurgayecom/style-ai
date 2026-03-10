import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Choose the right plan for you. Free, Pro, and Teacher tiers available. All Pro features free during beta.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
