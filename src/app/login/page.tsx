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
      <motion.div className="mx-auto max-w-lg mt-12" {...fadeInUp}>
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold gradient-text inline-block">Accounts Coming Soon</h1>
          <p className="text-text-secondary mt-2">
            Create an account to sync your API keys across all your devices
          </p>
        </div>
        <div className="rounded-xl border border-border bg-bg-card p-6" style={{ boxShadow: 'var(--card-shadow)' }}>
          <div className="space-y-4 text-sm text-text-secondary">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-bold">1</span>
              <p>Set up your API keys on your PC (Setup page)</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-bold">2</span>
              <p>Create an account with email &amp; password</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-bold">3</span>
              <p>Your API keys auto-sync to the cloud — log in on your phone and everything is there</p>
            </div>
          </div>
          <div className="mt-6 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
            <p className="text-sm text-yellow-400 font-medium mb-1">Not available yet on this deployment</p>
            <p className="text-xs text-text-muted">
              The account system needs a database connection to work. The site owner needs to connect Supabase (free) and add the environment variables. Add me on Snap for updates!
            </p>
          </div>
          <div className="mt-5 flex flex-col items-center gap-3">
            <a href="https://www.snapchat.com/add/arthurgaye24" target="_blank" rel="noopener noreferrer"
              className="rounded-full bg-yellow-500 px-5 py-2 text-sm font-bold text-black hover:bg-yellow-400 transition-all hover:scale-105">
              Add @arthurgaye24 for updates
            </a>
            <button onClick={() => router.push('/setup')} className="rounded-lg border border-border px-6 py-2 text-sm font-medium text-text-secondary hover:bg-bg-hover">
              Go to Setup (works without account)
            </button>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-text-muted">
          The app works without an account — settings save locally in your browser.
        </p>
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
