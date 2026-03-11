import { NextRequest, NextResponse } from 'next/server';
import type { ProviderType } from '@/types/ai';

export async function POST(req: NextRequest) {
  try {
    const { type, apiKey } = (await req.json()) as { type: ProviderType; apiKey?: string };

    switch (type) {
      case 'free': {
        // Support both comma-separated keys and legacy single key
        const multi = process.env.FREE_GEMINI_API_KEYS;
        const single = process.env.FREE_GEMINI_API_KEY;
        const freeKey = multi ? multi.split(',')[0]?.trim() : single;
        if (!freeKey) {
          return NextResponse.json({ connected: false, error: 'Free AI not configured on this server. The site owner needs to add FREE_GEMINI_API_KEYS.' });
        }
        // Use models.get (read-only metadata) instead of generateContent to avoid burning free quota
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash?key=${freeKey}`
        );
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const detail = errBody?.error?.message || `HTTP ${res.status}`;
          return NextResponse.json({ connected: false, error: `Free AI check failed: ${detail}` });
        }
        return NextResponse.json({ connected: true, model: 'gemini-2.5-flash' });
      }

      case 'anthropic': {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic({ apiKey });
        await client.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        });
        return NextResponse.json({ connected: true, model: 'claude-sonnet-4-5-20250929' });
      }

      case 'openai': {
        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({ apiKey });
        await client.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        });
        return NextResponse.json({ connected: true, model: 'gpt-4o-mini' });
      }

      case 'gemini': {
        // Use models.get (metadata) instead of generateContent to validate key without burning quota
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash?key=${apiKey}`
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = err?.error?.message || `Gemini API error (${res.status})`;
          return NextResponse.json({ connected: false, error: msg });
        }
        return NextResponse.json({ connected: true, model: 'gemini-2.0-flash' });
      }

      case 'claude-cli': {
        const { spawn } = await import('child_process');
        const result = await new Promise<boolean>((resolve) => {
          try {
            const child = spawn('claude', ['--version'], { stdio: ['pipe', 'pipe', 'pipe'] });
            child.on('close', (code) => resolve(code === 0));
            child.on('error', () => resolve(false));
            setTimeout(() => { try { child.kill(); } catch {} resolve(false); }, 5000);
          } catch {
            resolve(false);
          }
        });
        if (result) {
          return NextResponse.json({ connected: true, model: 'claude-cli' });
        }
        return NextResponse.json({ connected: false, error: 'Claude CLI not found in PATH' });
      }

      case 'kimi': {
        // Use provided key or fall back to server default
        const effectiveKey = apiKey || process.env.DEFAULT_KIMI_API_KEY;
        if (!effectiveKey) {
          return NextResponse.json({ connected: false, error: 'No API key provided and no default Kimi key configured.' });
        }

        // Detect NVIDIA NIM keys vs Moonshot keys
        if (effectiveKey.startsWith('nvapi-')) {
          const OpenAI = (await import('openai')).default;
          const client = new OpenAI({ apiKey: effectiveKey, baseURL: 'https://integrate.api.nvidia.com/v1' });
          await client.chat.completions.create({
            model: 'meta/llama-3.1-8b-instruct',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }],
          });
          return NextResponse.json({ connected: true, model: 'meta/llama-3.1-8b-instruct' });
        }

        // Moonshot keys
        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({ apiKey: effectiveKey, baseURL: 'https://api.moonshot.cn/v1' });
        await client.chat.completions.create({
          model: 'moonshot-v1-8k',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        });
        return NextResponse.json({ connected: true, model: 'moonshot-v1-8k' });
      }

      case 'ollama': {
        const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
        if (!res.ok) throw new Error('Ollama not responding');
        const data = await res.json();
        const models = (data.models || []).map((m: { name: string }) => m.name);
        return NextResponse.json({ connected: true, model: models[0] || 'llama3.2', models });
      }

      default:
        return NextResponse.json({ connected: false, error: 'Unknown provider' }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Connection failed';
    return NextResponse.json({ connected: false, error: message });
  }
}
