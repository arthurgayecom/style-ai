import { NextRequest, NextResponse } from 'next/server';
import { parseAIJSON } from '@/lib/ai/parseJSON';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-2.5-flash';
const DAILY_LIMIT = 50;

// In-memory rate limiting (resets on server restart)
const usageMap = new Map<string, { count: number; date: string }>();

function getGeminiKeys(): string[] {
  const multi = process.env.FREE_GEMINI_API_KEYS;
  if (multi) return multi.split(',').map(k => k.trim()).filter(Boolean);
  const single = process.env.FREE_GEMINI_API_KEY;
  if (single) return [single.trim()];
  return [];
}

function getKimiKey(): string | null {
  return process.env.DEFAULT_KIMI_API_KEY?.trim() || null;
}

// Round-robin index for Gemini keys
let keyIndex = 0;

function getClientId(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

function checkRateLimit(clientId: string): { allowed: boolean; remaining: number } {
  const today = new Date().toISOString().split('T')[0];
  const usage = usageMap.get(clientId);

  if (!usage || usage.date !== today) {
    usageMap.set(clientId, { count: 1, date: today });
    return { allowed: true, remaining: DAILY_LIMIT - 1 };
  }

  if (usage.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  usage.count += 1;
  return { allowed: true, remaining: DAILY_LIMIT - usage.count };
}

// Try each Gemini key in sequence — if one hits quota, try the next
async function callGeminiWithRetry(contents: unknown[], systemInstruction?: string, stream = false) {
  const keys = getGeminiKeys();
  if (keys.length === 0) throw new Error('NO_GEMINI_KEYS');

  const body: Record<string, unknown> = { contents, generationConfig: { maxOutputTokens: 8192 } };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  const bodyStr = JSON.stringify(body);
  const endpoint = stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?';

  // Try each key starting from round-robin index
  for (let i = 0; i < keys.length; i++) {
    const idx = (keyIndex + i) % keys.length;
    const apiKey = keys[idx];

    const res = await fetch(`${GEMINI_BASE}/${MODEL}:${endpoint}key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
    });

    if (res.ok) {
      keyIndex = idx + 1; // next call starts from next key
      return { source: 'gemini' as const, res };
    }

    // Check if it's a quota/rate-limit error — try next key
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || '';
    const isQuota = res.status === 429 || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate');

    if (isQuota && i < keys.length - 1) {
      continue; // try next key
    }

    // Not a quota error or last key — throw
    throw new Error(msg || `Gemini API error (${res.status})`);
  }

  // All keys exhausted
  throw new Error('GEMINI_QUOTA_EXHAUSTED');
}

// Kimi/NVIDIA fallback for when all Gemini keys are rate-limited
async function callKimiFallback(contents: unknown[], systemInstruction?: string) {
  const kimiKey = getKimiKey();
  if (!kimiKey) throw new Error('All AI keys exhausted. Try again in a minute.');

  const OpenAI = (await import('openai')).default;

  // NVIDIA NIM key
  if (kimiKey.startsWith('nvapi-')) {
    const client = new OpenAI({ apiKey: kimiKey, baseURL: 'https://integrate.api.nvidia.com/v1' });
    const userText = (contents as Array<{ parts: Array<{ text: string }> }>)[0]?.parts?.[0]?.text || '';
    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
    messages.push({ role: 'user', content: userText });

    const res = await client.chat.completions.create({
      model: 'meta/llama-3.1-8b-instruct',
      messages,
      max_tokens: 8192,
    });
    const text = res.choices[0]?.message?.content || '';
    if (!text) throw new Error('Backup AI returned an empty response — try again.');
    return { source: 'kimi' as const, text };
  }

  // Moonshot key
  const client = new OpenAI({ apiKey: kimiKey, baseURL: 'https://api.moonshot.cn/v1' });
  const userText = (contents as Array<{ parts: Array<{ text: string }> }>)[0]?.parts?.[0]?.text || '';
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  messages.push({ role: 'user', content: userText });

  const res = await client.chat.completions.create({
    model: 'moonshot-v1-8k',
    messages,
    max_tokens: 8192,
  });
  const text = res.choices[0]?.message?.content || '';
  if (!text) throw new Error('Backup AI returned an empty response — try again.');
  return { source: 'kimi' as const, text };
}

// Kimi streaming fallback
async function callKimiFallbackStream(contents: unknown[], systemInstruction?: string) {
  const kimiKey = getKimiKey();
  if (!kimiKey) throw new Error('All AI keys exhausted. Try again in a minute.');

  const OpenAI = (await import('openai')).default;
  const isNvidia = kimiKey.startsWith('nvapi-');
  const client = new OpenAI({
    apiKey: kimiKey,
    baseURL: isNvidia ? 'https://integrate.api.nvidia.com/v1' : 'https://api.moonshot.cn/v1',
  });

  const userText = (contents as Array<{ parts: Array<{ text: string }> }>)[0]?.parts?.[0]?.text || '';
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  messages.push({ role: 'user', content: userText });

  return client.chat.completions.create({
    model: isNvidia ? 'meta/llama-3.1-8b-instruct' : 'moonshot-v1-8k',
    messages,
    max_tokens: 8192,
    stream: true,
  });
}

export async function POST(req: NextRequest) {
  try {
    const clientId = getClientId(req);
    const body = await req.json();
    const { mode, essayText, systemPrompt, userPrompt } = body;

    // Handle status check
    if (mode === 'status') {
      const today = new Date().toISOString().split('T')[0];
      const usage = usageMap.get(clientId);
      if (!usage || usage.date !== today) {
        return NextResponse.json({ remaining: DAILY_LIMIT, limit: DAILY_LIMIT, used: 0 });
      }
      return NextResponse.json({
        remaining: DAILY_LIMIT - usage.count,
        limit: DAILY_LIMIT,
        used: usage.count,
      });
    }

    const { allowed, remaining } = checkRateLimit(clientId);

    if (!allowed) {
      return NextResponse.json(
        { error: `Daily limit reached (${DAILY_LIMIT}/day). Come back tomorrow or connect your own API key in Settings.` },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      );
    }

    if (mode === 'analyze') {
      const contents = [{ role: 'user', parts: [{ text: essayText }] }];

      let text = '';
      try {
        const result = await callGeminiWithRetry(contents, systemPrompt);
        const data = await result.res.json();
        text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        // If all Gemini keys are exhausted, fall back to Kimi
        if (msg === 'GEMINI_QUOTA_EXHAUSTED' || msg === 'NO_GEMINI_KEYS') {
          try {
            const fallback = await callKimiFallback(contents, systemPrompt);
            text = fallback.text;
          } catch {
            return NextResponse.json({ error: 'All free AI providers are temporarily rate-limited. Try again in ~60 seconds.' }, {
              status: 503, headers: { 'X-RateLimit-Remaining': String(remaining) }
            });
          }
        } else {
          throw err;
        }
      }

      if (!text) {
        return NextResponse.json({ error: 'AI returned an empty response — try again.' }, {
          status: 500, headers: { 'X-RateLimit-Remaining': String(remaining) }
        });
      }

      let parsed;
      try {
        parsed = parseAIJSON(text);
      } catch {
        return NextResponse.json({ analysis: null, raw: text, remaining }, {
          headers: { 'X-RateLimit-Remaining': String(remaining) }
        });
      }
      return NextResponse.json({ analysis: parsed, remaining }, {
        headers: { 'X-RateLimit-Remaining': String(remaining) }
      });
    }

    if (mode === 'generate') {
      const contents = [{ role: 'user', parts: [{ text: userPrompt }] }];
      const encoder = new TextEncoder();

      // Try Gemini first
      let geminiStream: Response | null = null;
      let useKimiFallback = false;
      try {
        const result = await callGeminiWithRetry(contents, systemPrompt, true);
        geminiStream = result.res;
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'GEMINI_QUOTA_EXHAUSTED' || msg === 'NO_GEMINI_KEYS') {
          useKimiFallback = true;
        } else {
          throw err;
        }
      }

      if (useKimiFallback) {
        // Stream from Kimi/NVIDIA instead
        try {
          const kimiStream = await callKimiFallbackStream(contents, systemPrompt);
          const stream = new ReadableStream({
            async start(controller) {
              let hasContent = false;
              try {
                for await (const chunk of kimiStream) {
                  const delta = chunk.choices[0]?.delta?.content || '';
                  if (delta) { controller.enqueue(encoder.encode(delta)); hasContent = true; }
                }
                if (!hasContent) {
                  controller.enqueue(encoder.encode('\n\n[ERROR]: AI returned an empty response — try again.'));
                }
                controller.close();
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Stream error';
                controller.enqueue(encoder.encode(`\n\n[ERROR]: ${msg}`));
                controller.close();
              }
            },
          });
          return new Response(stream, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Transfer-Encoding': 'chunked',
              'X-RateLimit-Remaining': String(remaining),
            },
          });
        } catch {
          return NextResponse.json({ error: 'All free AI providers are temporarily rate-limited. Try again in ~60 seconds.' }, { status: 503 });
        }
      }

      // Gemini stream
      const reader = geminiStream!.body?.getReader();
      if (!reader) throw new Error('No stream');

      const decoder = new TextDecoder();
      const stream = new ReadableStream({
        async start(controller) {
          let buffer = '';
          let hasContent = false;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const json = JSON.parse(line.slice(6));
                    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (text) { controller.enqueue(encoder.encode(text)); hasContent = true; }
                  } catch { /* skip */ }
                }
              }
            }
            // Flush remaining buffer
            if (buffer.startsWith('data: ')) {
              try {
                const json = JSON.parse(buffer.slice(6));
                const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (text) { controller.enqueue(encoder.encode(text)); hasContent = true; }
              } catch { /* skip */ }
            }
            if (!hasContent) {
              controller.enqueue(encoder.encode('\n\n[ERROR]: AI returned an empty response — try again.'));
            }
            controller.close();
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Stream error';
            controller.enqueue(encoder.encode(`\n\n[ERROR]: ${msg}`));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'X-RateLimit-Remaining': String(remaining),
        },
      });
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Free AI failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
