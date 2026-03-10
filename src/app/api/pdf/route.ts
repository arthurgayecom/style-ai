import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // pdf-parse v1 uses CommonJS default export
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
    const data = await pdfParse(buffer);

    return NextResponse.json({
      text: data.text,
      pageCount: data.numpages,
      wordCount: data.text.split(/\s+/).filter(Boolean).length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'PDF parsing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
