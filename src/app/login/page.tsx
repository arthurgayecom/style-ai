'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { fadeInUp } from '@/lib/animations';
import { toast } from 'sonner';

export default function LoginPage() {
  const { signIn, signUp, user, configured } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (user) {
    router.push('/dashboard');
    return null;
  }

  if (!configured) {
    return (
      <motion.div className="mx-auto max-w-md mt-20 text-center" {...fadeInUp}>
        <div className="rounded-xl border border-border bg-bg-card p-8" style={{ boxShadow: 'var(--card-shadow)' }}>
          <h1 className="text-2xl font-bold text-text-primary mb-3">Accounts Not Set Up</h1>
          <p className="text-sm text-text-secondary mb-4">
            Cloud sync requires Supabase. The app works without accounts — your settings are saved locally in your browser.
          </p>
          <button onClick={() => router.push('/setup')} className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">
            Go to Setup
          </button>
        </div>
      </motion.div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Fill in all fields'); return; }

    if (mode === 'register') {
      if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
      if (password !== confirm) { toast.error('Passwords don\'t match'); return; }
    }

    setLoading(true);
    const result = mode === 'login' ? await signIn(email, password) : await signUp(email, password);

    if (result.error) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    if (mode === 'register') {
      toast.success('Account created! Check your email to confirm, then log in.');
      setMode('login');
    } else {
      toast.success('Logged in!');
      router.push('/dashboard');
    }
    setLoading(false);
  };

  return (
    <motion.div className="mx-auto max-w-sm mt-12" {...fadeInUp}>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold gradient-text inline-block">{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h1>
        <p className="text-text-secondary mt-1">
          {mode === 'login' ? 'Sign in to sync your settings across devices' : 'Register to save your API keys and settings in the cloud'}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-bg-card p-6" style={{ boxShadow: 'var(--card-shadow)' }}>
        {/* Mode toggle */}
        <div className="mb-6 flex rounded-lg border border-border overflow-hidden">
          <button onClick={() => setMode('login')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'login' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-hover'}`}>
            Log In
          </button>
          <button onClick={() => setMode('register')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'register' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-hover'}`}>
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              className="w-full rounded-lg border border-border bg-bg-input px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-ring" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
              className="w-full rounded-lg border border-border bg-bg-input px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-ring" />
          </div>

          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Confirm Password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••"
                className="w-full rounded-lg border border-border bg-bg-input px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-ring" />
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {loading ? <><LoadingSpinner className="h-4 w-4" /> {mode === 'login' ? 'Signing in...' : 'Creating account...'}</> : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-text-muted">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-accent hover:underline">
            {mode === 'login' ? 'Register' : 'Log in'}
          </button>
        </p>
      </div>

      <p className="mt-4 text-center text-xs text-text-muted">
        The app works without an account too — settings save locally.
      </p>
    </motion.div>
  );
}
