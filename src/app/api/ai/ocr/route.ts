import { NextRequest, NextResponse } from 'next/server';
import { createProvider } from '@/lib/ai/providers';
import type { ProviderConfig } from '@/types/ai';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const providerConfigStr = formData.get('providerConfig') as string;

    if (!file || !providerConfigStr) {
      return NextResponse.json({ error: 'Missing file or provider config' }, { status: 400 });
    }

    const providerConfig: ProviderConfig = JSON.parse(providerConfigStr);
    const provider = createProvider(providerConfig);

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'image/png';

    const text = await provider.ocr(base64, mimeType);

    return NextResponse.json({
      text,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'OCR failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
