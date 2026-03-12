import { NextRequest, NextResponse } from 'next/server';
import { parseAIJSON } from '@/lib/ai/parseJSON';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const IMAGE_MODEL = 'gemini-2.0-flash-exp';
const TEXT_MODEL = 'gemini-2.5-flash';

function getGeminiKeys(): string[] {
  const multi = process.env.FREE_GEMINI_API_KEYS;
  if (multi) return multi.split(',').map(k => k.trim()).filter(Boolean);
  const single = process.env.FREE_GEMINI_API_KEY;
  if (single) return [single.trim()];
  return [];
}

let keyIndex = 0;

// ── Shared: call Gemini with key rotation ──
async function callGemini(
  model: string,
  contents: unknown[],
  systemInstruction?: string,
  generationConfig?: Record<string, unknown>,
) {
  const keys = getGeminiKeys();
  if (keys.length === 0) throw new Error('No AI keys configured. Add Gemini API keys in Settings.');

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: 8192, ...generationConfig },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  const bodyStr = JSON.stringify(body);

  for (let i = 0; i < keys.length; i++) {
    const idx = (keyIndex + i) % keys.length;
    const apiKey = keys[idx];

    const res = await fetch(
      `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`,
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

// ── Parse base64 image from data URL ──
function parseImage(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (match) return { mimeType: match[1], data: match[2] };
  return null;
}

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
// Analyzes reference images + part selections and generates smart questions
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

  // Build content with images
  const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (refs) {
    for (const ref of refs.slice(0, 4)) {
      const img = parseImage(ref.dataUrl);
      if (img) contentParts.push({ inlineData: img });
    }
  }
  contentParts.push({ text: userPrompt });

  const data = await callGemini(TEXT_MODEL, [{ role: 'user', parts: contentParts }], systemPrompt);
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  try {
    const parsed = parseAIJSON(text) as { questions?: unknown[] };
    return NextResponse.json({ questions: parsed.questions || [] });
  } catch {
    return NextResponse.json({ questions: getDefaultQuestions(garmentType as string) });
  }
}

// ═══════ MODE: GENERATE ═══════
// Creates the actual mockup from references + answers + instructions
async function handleGenerate(body: Record<string, unknown>) {
  const { referenceImages, garmentType, answers, instructions } = body;
  const refs = referenceImages as Array<{ dataUrl: string; parts: string[]; notes: string }> | undefined;
  const answerList = answers as Array<{ questionId: string; answer: string | string[] }> | undefined;

  // Build detailed prompt from all inputs
  const promptLines: string[] = [
    `You are a professional fashion designer creating a production-ready flat-lay mockup.`,
    ``,
    `GARMENT: ${garmentType}`,
  ];

  // Part annotations
  if (refs?.some(r => r.parts?.length > 0)) {
    promptLines.push(``, `PART SELECTION FROM REFERENCE IMAGES:`);
    refs.forEach((r, i) => {
      if (r.parts?.length > 0) {
        promptLines.push(`- Image ${i + 1}: Take the ${r.parts.join(', ')}${r.notes ? ` (${r.notes})` : ''}`);
      } else if (r.notes) {
        promptLines.push(`- Image ${i + 1}: ${r.notes}`);
      }
    });
    promptLines.push(`Combine these elements into ONE cohesive design.`);
  }

  // Q&A answers
  if (answerList?.some(a => a.answer && (typeof a.answer === 'string' ? a.answer.trim() : a.answer.length > 0))) {
    promptLines.push(``, `DESIGN SPECIFICATIONS FROM CUSTOMER:`);
    for (const a of answerList) {
      if (!a.answer || (typeof a.answer === 'string' && !a.answer.trim()) || (Array.isArray(a.answer) && a.answer.length === 0)) continue;
      const val = Array.isArray(a.answer) ? a.answer.join(', ') : a.answer;
      promptLines.push(`- ${a.questionId}: ${val}`);
    }
  }

  if (instructions) promptLines.push(``, `ADDITIONAL INSTRUCTIONS: ${instructions}`);

  promptLines.push(
    ``,
    `OUTPUT REQUIREMENTS:`,
    `- Generate a clean, high-quality flat-lay mockup on a white/light background`,
    `- Show the garment with precise proportions and realistic fabric texture`,
    `- Include visible construction details (seams, stitching, hardware)`,
    `- Make it look production-ready — like something you'd send to a factory`,
    `- The mockup should be a SINGLE cohesive design incorporating all the specified elements`,
  );

  const prompt = promptLines.join('\n');

  // Build content parts with images
  const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (refs) {
    for (const ref of refs.slice(0, 6)) {
      const img = parseImage(ref.dataUrl);
      if (img) contentParts.push({ inlineData: img });
    }
  }
  contentParts.push({ text: prompt });

  const data = await callGemini(IMAGE_MODEL, [{ role: 'user', parts: contentParts }], undefined, {
    responseModalities: ['TEXT', 'IMAGE'],
    maxOutputTokens: 4096,
  });

  const parts = data?.candidates?.[0]?.content?.parts || [];
  let description = '';
  let mockupImage = '';
  for (const part of parts) {
    if (part.text) description += part.text;
    if (part.inlineData) mockupImage = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  }

  if (!mockupImage && !description) {
    return NextResponse.json({ error: 'AI did not generate a design. Try different references or instructions.' }, { status: 500 });
  }

  // Also generate quick specs via text model
  let specs = null;
  try {
    const specsData = await callGemini(TEXT_MODEL, [{
      role: 'user',
      parts: [{ text: `Based on this design description, extract quick specs. Return ONLY JSON:\n{"fit":"...","fabric":"...","weight":"...","colors":["..."],"keyFeatures":["..."]}\n\nDesign: ${garmentType}. ${description}. ${promptLines.slice(3).join(' ')}` }],
    }]);
    const specsText = specsData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    specs = parseAIJSON(specsText);
  } catch { /* specs are optional */ }

  return NextResponse.json({ mockupImage, description, garmentType, specs });
}

// ═══════ MODE: EDIT ═══════
// Takes an existing mockup and applies changes
async function handleEdit(body: Record<string, unknown>) {
  const { mockupImage, editInstructions, garmentType } = body;

  if (!mockupImage || !editInstructions) {
    return NextResponse.json({ error: 'Both a mockup image and edit instructions are required.' }, { status: 400 });
  }

  const prompt = [
    `You are editing an existing clothing design mockup.`,
    ``,
    `GARMENT TYPE: ${garmentType}`,
    `EDIT REQUEST: ${editInstructions}`,
    ``,
    `Apply ONLY the requested changes to this garment design.`,
    `Keep everything else the same — same style, same background, same perspective.`,
    `Generate the updated mockup as a clean flat-lay image.`,
  ].join('\n');

  const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  const img = parseImage(mockupImage as string);
  if (img) contentParts.push({ inlineData: img });
  contentParts.push({ text: prompt });

  const data = await callGemini(IMAGE_MODEL, [{ role: 'user', parts: contentParts }], undefined, {
    responseModalities: ['TEXT', 'IMAGE'],
    maxOutputTokens: 4096,
  });

  const parts = data?.candidates?.[0]?.content?.parts || [];
  let description = '';
  let editedImage = '';
  for (const part of parts) {
    if (part.text) description += part.text;
    if (part.inlineData) editedImage = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
  }

  // Generate updated specs
  let specs = null;
  try {
    const specsData = await callGemini(TEXT_MODEL, [{
      role: 'user',
      parts: [{ text: `Extract quick specs from this design edit. Return ONLY JSON:\n{"fit":"...","fabric":"...","weight":"...","colors":["..."],"keyFeatures":["..."]}\n\nGarment: ${garmentType}. Edit: ${editInstructions}. ${description}` }],
    }]);
    const specsText = specsData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    specs = parseAIJSON(specsText);
  } catch { /* optional */ }

  return NextResponse.json({
    mockupImage: editedImage || mockupImage,
    description: description || `Applied: ${editInstructions}`,
    garmentType,
    specs,
  });
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
