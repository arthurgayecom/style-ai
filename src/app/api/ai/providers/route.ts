import { NextRequest, NextResponse } from 'next/server';
import type { ProviderType } from '@/types/ai';

export async function POST(req: NextRequest) {
  try {
    const { type, apiKey } = (await req.json()) as { type: ProviderType; apiKey?: string };

    switch (type) {
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
        return NextResponse.json({ connected: true, model: 'gpt-4o' });
      }

      case 'gemini': {
        // Use REST API directly — more reliable than SDK across environments
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Hi' }] }],
              generationConfig: { maxOutputTokens: 10 },
            }),
          }
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
        // Check key format first
        if (apiKey && !apiKey.startsWith('sk-')) {
          return NextResponse.json({
            connected: false,
            error: `Invalid key format. Kimi (Moonshot) keys start with "sk-". Your key starts with "${apiKey.slice(0, 6)}..." which looks like a different provider's key.`,
          });
        }
        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({ apiKey, baseURL: 'https://api.moonshot.cn/v1' });
        await client.chat.completions.create({
          model: 'moonshot-v1-8k',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        });
        return NextResponse.json({ connected: true, model: 'moonshot-v1-32k' });
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
