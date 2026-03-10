import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Log In',
  description: 'Sign in or create an account to sync your API keys and settings across devices.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
