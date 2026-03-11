import { NextRequest, NextResponse } from 'next/server';
import { parseAIJSON } from '@/lib/ai/parseJSON';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-2.5-flash';
const DAILY_LIMIT = 50;

// In-memory rate limiting (resets on server restart)
const usageMap = new Map<string, { count: number; date: string }>();

function getApiKeys(): string[] {
  // Support both new comma-separated format and legacy single key
  const multi = process.env.FREE_GEMINI_API_KEYS;
  if (multi) return multi.split(',').map(k => k.trim()).filter(Boolean);
  const single = process.env.FREE_GEMINI_API_KEY;
  if (single) return [single.trim()];
  return [];
}

// Round-robin key selection for load balancing
let keyIndex = 0;
function getNextKey(): string {
  const keys = getApiKeys();
  if (keys.length === 0) throw new Error('Free AI not configured. Set FREE_GEMINI_API_KEYS in environment.');
  const key = keys[keyIndex % keys.length];
  keyIndex++;
  return key;
}

function getClientId(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  return ip;
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

async function callGemini(contents: unknown[], systemInstruction?: string, stream = false) {
  const apiKey = getNextKey();

  const body: Record<string, unknown> = { contents, generationConfig: { maxOutputTokens: 8192 } };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const endpoint = stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?';
  const res = await fetch(`${GEMINI_BASE}/${MODEL}:${endpoint}key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `AI error (${res.status})`);
  }

  return res;
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
      const res = await callGemini(contents, systemPrompt);
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

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
      const res = await callGemini(contents, systemPrompt, true);

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');

      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const stream = new ReadableStream({
        async start(controller) {
          let buffer = '';
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
                    if (text) controller.enqueue(encoder.encode(text));
                  } catch { /* skip */ }
                }
              }
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
