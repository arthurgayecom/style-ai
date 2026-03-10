import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Brainrot Video',
  description: 'Transform lecture notes into engaging TikTok-style podcast videos for studying on the go.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
