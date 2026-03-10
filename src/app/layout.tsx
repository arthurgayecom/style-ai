import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@/context/ThemeContext';
import { AIProviderProvider } from '@/context/AIProviderContext';
import { AuthProvider } from '@/context/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Navbar } from '@/components/layout/Navbar';
import { Toaster } from 'sonner';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'CDL Study Tool — AI-Powered Essay & Presentation Maker',
    template: '%s | CDL Study Tool',
  },
  description: 'Generate essays that sound like you, create presentations, get AI grading, practice exercises, record lectures, and more. The ultimate AI study tool.',
  openGraph: {
    title: 'CDL Study Tool — AI-Powered Essay & Presentation Maker',
    description: 'Generate essays in your voice, create Gamma-style presentations, get AI grading, and study smarter.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CDL Study Tool',
    description: 'Generate essays in your voice, create presentations, get AI grading, and study smarter.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>
          <AuthProvider>
          <AIProviderProvider>
            <ErrorBoundary>
            <Navbar />
            <main className="mx-auto max-w-6xl px-4 py-8">
              {children}
            </main>
            </ErrorBoundary>
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                },
              }}
            />
          </AIProviderProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
