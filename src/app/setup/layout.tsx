import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Provider Setup',
  description: 'Configure your AI provider — Claude, OpenAI, Gemini, Kimi, or Ollama. Enter your API key to get started.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
