'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAIProvider } from '@/hooks/useAIProvider';
import { PROVIDERS, type ProviderType } from '@/types/ai';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { fadeInUp, staggerContainer, staggerItem } from '@/lib/animations';
import { toast } from 'sonner';

const API_PROVIDERS: ProviderType[] = ['anthropic', 'openai', 'gemini', 'kimi'];

const PROVIDER_COLORS: Record<ProviderType, string> = {
  'claude-cli': 'text-accent',
  anthropic: 'text-[#d4a27f]',
  openai: 'text-[#10a37f]',
  gemini: 'text-[#4285f4]',
  kimi: 'text-[#5B6AE0]',
  ollama: 'text-[#eeeeee]',
};

export default function SetupPage() {
  const { providers, activeProvider, setProviderConfig, setActiveProvider } = useAIProvider();
  const [testing, setTesting] = useState<ProviderType | null>(null);
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | null>>({});
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const autoChecked = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (!autoChecked.current) {
      autoChecked.current = true;
      handleTest('claude-cli', true);
      handleTest('ollama', true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTest = async (type: ProviderType, silent = false) => {
    setTesting(type);
    setTestResults((prev) => ({ ...prev, [type]: null }));
    try {
      const config = providers[type];
      const res = await fetch('/api/ai/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, apiKey: config.apiKey }),
      });
      const data = await res.json();
      if (data.connected) {
        setTestResults((prev) => ({ ...prev, [type]: 'success' }));
        setProviderConfig(type, { enabled: true, model: data.model });
        if (!silent) toast.success(`${PROVIDERS[type].name} connected!`);
        if (!activeProvider) setActiveProvider(type);
        if (type === 'ollama' && data.models) {
          setOllamaModels(data.models);
        }
      } else {
        setTestResults((prev) => ({ ...prev, [type]: 'error' }));
        if (!silent) toast.error(data.error || 'Connection failed');
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [type]: 'error' }));
      if (!silent) toast.error('Connection test failed');
    }
    setTesting(null);
  };

  const handleSelect = (type: ProviderType) => {
    setActiveProvider(type);
    toast.success(`Using ${PROVIDERS[type].name}`);
  };

  const canContinue = activeProvider && providers[activeProvider]?.enabled;
  const cliResult = testResults['claude-cli'];
  const cliTesting = testing === 'claude-cli';
  const cliActive = activeProvider === 'claude-cli';
  const cliEnabled = providers['claude-cli']?.enabled;

  const ollamaResult = testResults['ollama'];
  const ollamaTesting = testing === 'ollama';
  const ollamaActive = activeProvider === 'ollama';
  const ollamaEnabled = providers['ollama']?.enabled;

  return (
    <motion.div className="mx-auto max-w-3xl" {...fadeInUp}>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold gradient-text inline-block">Choose Your AI Model</h1>
        <p className="text-text-secondary">Connect Claude Code, an API key, or a local model.</p>
      </div>

      {/* Claude MAX — featured card */}
      <div
        className={`mb-6 rounded-xl border-2 p-6 transition-all ${
          cliActive ? 'border-accent bg-accent/5' : cliResult === 'success' ? 'border-success/50 bg-success/5' : 'border-border bg-bg-card'
        }`}
        style={{ boxShadow: 'var(--card-shadow)' }}
      >
        <span className="rounded bg-accent/20 px-2 py-0.5 text-xs font-bold text-accent uppercase tracking-wide">Recommended</span>
        <div className="flex items-start justify-between gap-4 mt-3">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-accent mb-1">Claude Code (CLI)</h3>
            <p className="text-sm text-text-secondary mb-4">Uses Claude directly through the CLI. No API key needed — just have Claude Code installed.</p>
            <div className="flex items-center gap-3">
              {cliResult === 'success' ? (
                <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  Connected — Claude CLI detected
                </span>
              ) : cliResult === 'error' ? (
                <div>
                  <span className="flex items-center gap-1.5 rounded-full bg-error/10 px-3 py-1 text-sm text-error mb-2">CLI not found — use an API key below instead</span>
                  <button onClick={() => handleTest('claude-cli')} className="text-xs text-text-muted hover:text-text-primary">Retry detection</button>
                </div>
              ) : cliTesting ? (
                <span className="flex items-center gap-1.5 text-sm text-text-muted">
                  <LoadingSpinner />
                  Detecting Claude CLI...
                </span>
              ) : (
                <button onClick={() => handleTest('claude-cli')} className="rounded-lg bg-bg-hover px-4 py-2 text-sm font-medium text-text-primary hover:bg-border">Check Connection</button>
              )}
            </div>
          </div>
          <button
            onClick={() => handleSelect('claude-cli')}
            disabled={!cliEnabled}
            className={`shrink-0 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${
              cliActive ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {cliActive ? 'Active' : 'Use This'}
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-6">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Or use an API key</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* API key providers */}
      <motion.div className="grid gap-4" variants={staggerContainer} initial="initial" animate="animate">
        {API_PROVIDERS.map((type) => {
          const info = PROVIDERS[type];
          const config = providers[type];
          const isActive = activeProvider === type;
          const testResult = testResults[type];
          const isTesting = testing === type;

          return (
            <motion.div
              key={type}
              className={`rounded-xl border p-5 transition-all ${
                isActive ? 'border-accent bg-accent/5' : 'border-border bg-bg-card hover:border-text-muted'
              }`}
              style={{ boxShadow: 'var(--card-shadow)' }}
              variants={staggerItem}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className={`text-lg font-semibold ${PROVIDER_COLORS[type]}`}>{info.name}</h3>
                    {config.enabled && testResult === 'success' && (
                      <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        Connected
                      </span>
                    )}
                    {testResult === 'error' && (
                      <span className="rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error">Failed</span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary mb-3">{info.description}</p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder={`Enter ${info.name} API key...`}
                      value={config.apiKey || ''}
                      onChange={(e) => setProviderConfig(type, { apiKey: e.target.value })}
                      className="flex-1 rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none transition-all focus:border-ring focus:ring-1 focus:ring-ring"
                    />
                    <button
                      onClick={() => handleTest(type)}
                      disabled={!config.apiKey || isTesting}
                      className="rounded-lg bg-bg-hover px-4 py-2 text-sm font-medium text-text-primary transition-all hover:bg-border disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isTesting ? 'Testing...' : 'Test'}
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {info.supportsVision && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">Vision</span>}
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">Streaming</span>
                  </div>
                </div>
                <button
                  onClick={() => handleSelect(type)}
                  disabled={!config.enabled}
                  className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    isActive ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  {isActive ? 'Active' : 'Select'}
                </button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Local models divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Or run locally</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Ollama card */}
      <div
        className={`rounded-xl border-2 p-5 transition-all ${
          ollamaActive ? 'border-accent bg-accent/5' : ollamaResult === 'success' ? 'border-success/50 bg-success/5' : 'border-border bg-bg-card'
        }`}
        style={{ boxShadow: 'var(--card-shadow)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h3 className={`text-lg font-semibold ${PROVIDER_COLORS['ollama']}`}>Ollama (Local Models)</h3>
              {ollamaResult === 'success' && (
                <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  Running
                </span>
              )}
            </div>
            <p className="text-sm text-text-secondary mb-3">Run models like Llama 3, Mistral, Gemma locally. No API key or internet needed.</p>

            {ollamaResult === 'success' && ollamaModels.length > 0 ? (
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-text-muted">Select Model</label>
                <select
                  value={providers['ollama']?.model || ''}
                  onChange={(e) => setProviderConfig('ollama', { model: e.target.value })}
                  className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary outline-none focus:border-ring"
                >
                  {ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            ) : ollamaResult === 'error' ? (
              <div className="mb-3">
                <p className="text-sm text-text-muted mb-2">Ollama not detected. Install it from <span className="text-accent">ollama.com</span> and start it.</p>
                <button onClick={() => handleTest('ollama')} className="text-xs text-accent hover:underline">Retry detection</button>
              </div>
            ) : ollamaTesting ? (
              <span className="flex items-center gap-1.5 text-sm text-text-muted mb-3">
                <LoadingSpinner />
                Detecting Ollama...
              </span>
            ) : (
              <button onClick={() => handleTest('ollama')} className="rounded-lg bg-bg-hover px-4 py-2 text-sm font-medium text-text-primary hover:bg-border mb-3">Check Connection</button>
            )}
            <div className="flex gap-2">
              <span className="rounded-full bg-bg-hover px-2 py-0.5 text-xs text-text-muted">Free</span>
              <span className="rounded-full bg-bg-hover px-2 py-0.5 text-xs text-text-muted">Offline</span>
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">Streaming</span>
            </div>
          </div>
          <button
            onClick={() => handleSelect('ollama')}
            disabled={!ollamaEnabled}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              ollamaActive ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {ollamaActive ? 'Active' : 'Select'}
          </button>
        </div>
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={() => router.push('/upload')}
          disabled={!canContinue}
          className="rounded-lg bg-accent px-8 py-3 text-base font-semibold text-white transition-all hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue to Upload
        </button>
        {!canContinue && <p className="mt-2 text-sm text-text-muted">Connect a provider to continue</p>}
      </div>
    </motion.div>
  );
}
