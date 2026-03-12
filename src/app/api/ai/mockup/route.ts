import { NextRequest, NextResponse } from 'next/server';
import { parseAIJSON } from '@/lib/ai/parseJSON';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const TEXT_MODEL = 'gemini-2.5-flash';
const AIRFORCE_API_URL = 'https://api.airforce/v1/images/generations';
const TOGETHER_API_URL = 'https://api.together.xyz/v1/images/generations';

function getGeminiKeys(): string[] {
  const multi = process.env.FREE_GEMINI_API_KEYS;
  if (multi) return multi.split(',').map(k => k.trim()).filter(Boolean);
  const single = process.env.FREE_GEMINI_API_KEY;
  if (single) return [single.trim()];
  return [];
}

let keyIndex = 0;

// ── Call Gemini text model with key rotation ──
async function callGemini(
  contents: unknown[],
  systemInstruction?: string,
) {
  const keys = getGeminiKeys();
  if (keys.length === 0) throw new Error('No AI keys configured. Add Gemini API keys in Settings.');

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: 8192 },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  const bodyStr = JSON.stringify(body);

  for (let i = 0; i < keys.length; i++) {
    const idx = (keyIndex + i) % keys.length;
    const apiKey = keys[idx];

    const res = await fetch(
      `${GEMINI_BASE}/${TEXT_MODEL}:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: bodyStr }
    );

    if (res.ok) {
      keyIndex = idx + 1;
      return res.json();
    }

    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || '';
    const isQuota = res.status === 429 || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate');
    if (isQuota && i < keys.length - 1) continue;
    throw new Error(msg || `AI error (${res.status})`);
  }
  throw new Error('All AI keys are rate-limited. Try again in a minute.');
}

// ── Generate image via free API (airforce) with Together.ai fallback ──
async function generateImage(prompt: string, width = 1024, height = 1024): Promise<string> {
  // Try free airforce API first (no key needed, FLUX models)
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1000 + attempt * 1000));

      const res = await fetch(AIRFORCE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'flux-2-klein-4b',
          prompt,
          size: `${width}x${height}`,
          n: 1,
        }),
      });

      if (res.status === 429) continue; // rate limited, retry

      if (res.ok) {
        const data = await res.json();
        const imageUrl = data?.data?.[0]?.url;
        const b64 = data?.data?.[0]?.b64_json;

        if (b64) return `data:image/png;base64,${b64}`;

        if (imageUrl) {
          // Fetch image from URL and convert to base64
          const imgRes = await fetch(imageUrl);
          if (imgRes.ok) {
            const buffer = await imgRes.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
            return `data:${contentType};base64,${base64}`;
          }
        }
      }
    } catch {
      // Network error, try next attempt
    }
  }

  // Fallback to Together.ai if key is available
  const togetherKey = process.env.TOGETHER_API_KEY;
  if (togetherKey) {
    const res = await fetch(TOGETHER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${togetherKey}`,
      },
      body: JSON.stringify({
        model: 'black-forest-labs/FLUX.1-schnell-Free',
        prompt,
        width,
        height,
        steps: 4,
        n: 1,
        response_format: 'b64_json',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (b64) return `data:image/png;base64,${b64}`;
    }
  }

  throw new Error('Image generation is temporarily unavailable. Please try again in a moment.');
}

// ── Parse base64 image from data URL ──
function parseImage(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (match) return { mimeType: match[1], data: match[2] };
  return null;
}

// Allow up to 60s for image generation
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode } = body;

    if (mode === 'questions') return handleQuestions(body);
    if (mode === 'generate') return handleGenerate(body);
    if (mode === 'edit') return handleEdit(body);

    return NextResponse.json({ error: 'Invalid mode. Use: questions, generate, or edit.' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Design generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ═══════ MODE: QUESTIONS ═══════
async function handleQuestions(body: Record<string, unknown>) {
  const { garmentType, partsSummary, referenceImages } = body;
  const refs = referenceImages as Array<{ dataUrl: string; parts: string[]; notes: string }> | undefined;

  const systemPrompt = `You are a professional fashion designer helping a client design a custom garment for manufacturing.
Based on their reference images and part selections, generate 6-10 smart questions to nail down the exact design specifications.

Return ONLY valid JSON (no markdown, no code fences):
{
  "questions": [
    {
      "id": "q1",
      "question": "What fit are you going for?",
      "type": "select",
      "options": ["Slim fit", "Regular fit", "Relaxed fit", "Oversized", "Boxy"],
      "category": "fit"
    }
  ]
}

Rules:
- "type" must be: "select" (single choice), "multi-select" (multiple), or "text" (free input)
- "category" must be: "fit", "fabric", "construction", "color", "branding", or "details"
- Questions should be specific to the garment type and reference images
- Cover: fit/silhouette, fabric weight & feel, construction details (stitch type, seam style), color specifics, branding/logo, target use case
- Make options practical and specific (not generic)
- If they selected specific parts from images, ask about how those parts should be combined`;

  const userPrompt = `Garment type: ${garmentType}
${partsSummary ? `Parts selected from references: ${partsSummary}` : 'No specific parts selected — ask about general design preferences.'}
Generate questions to fully specify this ${garmentType} for manufacturing.`;

  const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (refs) {
    for (const ref of refs.slice(0, 4)) {
      const img = parseImage(ref.dataUrl);
      if (img) contentParts.push({ inlineData: img });
    }
  }
  contentParts.push({ text: userPrompt });

  const data = await callGemini([{ role: 'user', parts: contentParts }], systemPrompt);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  try {
    const parsed = parseAIJSON(text) as { questions?: unknown[] };
    return NextResponse.json({ questions: parsed.questions || [] });
  } catch {
    return NextResponse.json({ questions: getDefaultQuestions(garmentType as string) });
  }
}

// ═══════ MODE: GENERATE ═══════
// Step 1: Gemini creates a detailed image prompt from user inputs
// Step 2: FLUX generates the actual image (free via airforce API)
async function handleGenerate(body: Record<string, unknown>) {
  try {
    const { referenceImages, garmentType, answers, instructions } = body;
    const refs = referenceImages as Array<{ dataUrl: string; parts: string[]; notes: string }> | undefined;
    const answerList = answers as Array<{ questionId: string; answer: string | string[] }> | undefined;

    // Build context for Gemini
    const contextLines: string[] = [`Garment: ${garmentType}`];

    if (refs?.some(r => r.parts?.length > 0)) {
      contextLines.push(`Parts from reference images:`);
      refs.forEach((r, i) => {
        if (r.parts?.length > 0) contextLines.push(`- Image ${i + 1}: ${r.parts.join(', ')}${r.notes ? ` (${r.notes})` : ''}`);
        else if (r.notes) contextLines.push(`- Image ${i + 1}: ${r.notes}`);
      });
    }

    if (answerList?.some(a => a.answer && (typeof a.answer === 'string' ? a.answer.trim() : a.answer.length > 0))) {
      contextLines.push(`Design specs:`);
      for (const a of answerList) {
        if (!a.answer || (typeof a.answer === 'string' && !a.answer.trim()) || (Array.isArray(a.answer) && a.answer.length === 0)) continue;
        const val = Array.isArray(a.answer) ? a.answer.join(', ') : a.answer;
        contextLines.push(`- ${a.questionId}: ${val}`);
      }
    }

    if (instructions) contextLines.push(`Additional: ${instructions}`);

    // Step 1: Ask Gemini to create the perfect image generation prompt + description
    const systemPrompt = `You are a fashion design AI. Given the garment details below, create TWO things:

1. "imagePrompt" — A detailed, vivid prompt for an AI image generator to create a professional flat-lay mockup photo. Be very specific about: garment type, exact colors, fabric texture, fit/silhouette, all design details (waistband, cuffs, seams, prints, patterns), and styling. End with: "Professional flat-lay product photo on clean white background, studio lighting, high detail, fashion e-commerce style."

2. "description" — A fashion-industry description of the garment (2-3 sentences).

3. "specs" — Quick specs as JSON: {"fit":"...","fabric":"...","weight":"...","colors":["..."],"keyFeatures":["..."]}

Return ONLY valid JSON (no markdown):
{"imagePrompt":"...","description":"...","specs":{...}}`;

    const data = await callGemini([{
      role: 'user',
      parts: [{ text: contextLines.join('\n') }],
    }], systemPrompt);

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let imagePrompt = '';
    let description = '';
    let specs = null;

    try {
      const parsed = parseAIJSON(text) as { imagePrompt?: string; description?: string; specs?: unknown };
      imagePrompt = parsed.imagePrompt || '';
      description = parsed.description || '';
      specs = parsed.specs || null;
    } catch {
      imagePrompt = `Professional flat-lay mockup of ${garmentType}. ${instructions || ''}. Clean white background, studio lighting, fashion e-commerce photo.`;
      description = text || `${garmentType} design`;
    }

    if (!imagePrompt) {
      imagePrompt = `Professional flat-lay mockup of ${garmentType}. ${instructions || ''}. Clean white background, studio lighting, high detail, fashion product photo.`;
    }

    // Step 2: Generate the image via FLUX
    const mockupImage = await generateImage(imagePrompt);

    return NextResponse.json({ mockupImage, description, garmentType, specs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Mockup generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ═══════ MODE: EDIT ═══════
async function handleEdit(body: Record<string, unknown>) {
  try {
    const { editInstructions, garmentType, description: prevDesc } = body;

    if (!editInstructions) {
      return NextResponse.json({ error: 'Edit instructions are required.' }, { status: 400 });
    }

    const systemPrompt = `You are editing an existing ${garmentType} design. The previous design was: "${prevDesc || 'no description'}".
The user wants to: "${editInstructions}".

Create an updated image generation prompt incorporating these changes. Return ONLY valid JSON:
{"imagePrompt":"...","description":"...","specs":{...}}

The imagePrompt should describe the FULL updated garment (not just the changes). End with: "Professional flat-lay product photo on clean white background, studio lighting, high detail, fashion e-commerce style."`;

    const data = await callGemini([{
      role: 'user',
      parts: [{ text: `Edit request: ${editInstructions}` }],
    }], systemPrompt);

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let imagePrompt = '';
    let description = '';
    let specs = null;

    try {
      const parsed = parseAIJSON(text) as { imagePrompt?: string; description?: string; specs?: unknown };
      imagePrompt = parsed.imagePrompt || '';
      description = parsed.description || `Applied: ${editInstructions}`;
      specs = parsed.specs || null;
    } catch {
      imagePrompt = `Professional flat-lay mockup of ${garmentType}. ${editInstructions}. Clean white background, studio lighting, fashion e-commerce photo.`;
      description = `Applied: ${editInstructions}`;
    }

    const mockupImage = await generateImage(imagePrompt);

    return NextResponse.json({ mockupImage, description, garmentType, specs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Edit failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Fallback questions if AI fails ──
function getDefaultQuestions(garmentType: string) {
  return [
    { id: 'fit', question: `What fit do you want for this ${garmentType}?`, type: 'select', options: ['Slim fit', 'Regular fit', 'Relaxed fit', 'Oversized', 'Boxy/streetwear'], category: 'fit' },
    { id: 'fabric', question: 'What fabric weight and feel?', type: 'select', options: ['Lightweight (130-160 GSM)', 'Midweight (180-220 GSM)', 'Heavyweight (250-320 GSM)', 'Premium heavyweight (350+ GSM)'], category: 'fabric' },
    { id: 'material', question: 'Preferred material composition?', type: 'select', options: ['100% Cotton', '100% Organic Cotton', 'Cotton/Polyester blend', 'French Terry', 'Fleece', 'Jersey knit'], category: 'fabric' },
    { id: 'neckline', question: 'Neckline style?', type: 'select', options: ['Crew neck', 'V-neck', 'Scoop neck', 'Mock neck', 'Henley', 'Collar'], category: 'construction' },
    { id: 'stitch', question: 'What stitching style?', type: 'select', options: ['Standard single-needle', 'Double-needle (durable)', 'Flatlock (athletic)', 'Contrast stitching', 'Topstitching detail'], category: 'construction' },
    { id: 'color', question: 'Primary color palette?', type: 'text', category: 'color' },
    { id: 'branding', question: 'Any branding or logo placement?', type: 'select', options: ['No branding', 'Small chest logo', 'Large front graphic', 'Back print', 'Embroidered label', 'Woven neck label only'], category: 'branding' },
    { id: 'details', question: 'Any special construction details?', type: 'multi-select', options: ['Ribbed cuffs', 'Split hem', 'Side slits', 'Drop shoulders', 'Raglan sleeves', 'Raw edge hem', 'Taped seams', 'Hidden pockets'], category: 'details' },
  ];
}
