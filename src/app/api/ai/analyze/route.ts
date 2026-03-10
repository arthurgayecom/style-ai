import { NextRequest, NextResponse } from 'next/server';
import { createProvider } from '@/lib/ai/providers';
import { ANALYSIS_SYSTEM_PROMPT, AGGREGATION_SYSTEM_PROMPT, buildAggregationPrompt } from '@/lib/analysis/prompts';
import type { ProviderConfig } from '@/types/ai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, providerConfig } = body as {
      mode: 'analyze' | 'aggregate' | 'custom';
      providerConfig: ProviderConfig;
      essayText?: string;
      analyses?: unknown[];
      systemPrompt?: string;
    };

    const provider = createProvider(providerConfig);

    if (mode === 'custom') {
      const { essayText, systemPrompt } = body;
      if (!essayText || !systemPrompt) {
        return NextResponse.json({ error: 'Missing essayText or systemPrompt' }, { status: 400 });
      }
      const result = await provider.analyze(essayText, systemPrompt);
      let parsed;
      try {
        const jsonStr = result.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(jsonStr);
      } catch {
        return NextResponse.json({ analysis: null, raw: result });
      }
      return NextResponse.json({ analysis: parsed });
    }

    if (mode === 'analyze') {
      const { essayText } = body;
      if (!essayText) {
        return NextResponse.json({ error: 'No essay text provided' }, { status: 400 });
      }

      const result = await provider.analyze(essayText, ANALYSIS_SYSTEM_PROMPT);

      // Try to parse JSON from the response
      let analysis;
      try {
        // Handle cases where AI wraps in code blocks
        const jsonStr = result.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
        analysis = JSON.parse(jsonStr);
      } catch {
        return NextResponse.json({ error: 'Failed to parse analysis response', raw: result }, { status: 500 });
      }

      return NextResponse.json({ analysis });
    }

    if (mode === 'aggregate') {
      const { analyses } = body;
      if (!analyses || !Array.isArray(analyses) || analyses.length < 2) {
        return NextResponse.json({ error: 'Need at least 2 analyses to aggregate' }, { status: 400 });
      }

      const prompt = buildAggregationPrompt(analyses);
      const result = await provider.analyze(prompt, AGGREGATION_SYSTEM_PROMPT);

      let aggregated;
      try {
        const jsonStr = result.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
        aggregated = JSON.parse(jsonStr);
      } catch {
        return NextResponse.json({ error: 'Failed to parse aggregation response', raw: result }, { status: 500 });
      }

      return NextResponse.json({
        dimensions: aggregated.dimensions,
        fingerprint: aggregated.fingerprint,
      });
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
