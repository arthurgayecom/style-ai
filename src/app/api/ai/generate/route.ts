import { NextRequest } from 'next/server';
import { createProvider } from '@/lib/ai/providers';
import { buildGenerationSystemPrompt, buildGenerationUserPrompt } from '@/lib/generation/prompts';
import type { ProviderConfig } from '@/types/ai';
import type { StyleProfile } from '@/types/style';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      topic, essayType, targetWords, requirements, styleProfile, providerConfig,
      humanization, perspective, tone, level, language,
    } = body as {
      topic: string;
      essayType: string;
      targetWords: number;
      requirements?: string;
      styleProfile: StyleProfile;
      providerConfig: ProviderConfig;
      humanization?: string;
      perspective?: string;
      tone?: string;
      level?: string;
      language?: string;
    };

    const provider = createProvider(providerConfig);
    const systemPrompt = buildGenerationSystemPrompt(
      styleProfile, humanization, perspective, tone, level, language,
    );
    const userPrompt = buildGenerationUserPrompt(topic, essayType, targetWords, requirements);

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await provider.generate(systemPrompt, userPrompt, (chunk: string) => {
            controller.enqueue(encoder.encode(chunk));
          });
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Generation failed';
          controller.enqueue(encoder.encode(`\n\n[ERROR]: ${message}`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
