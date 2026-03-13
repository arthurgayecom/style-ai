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

// ── Extract MUST HAVE / MUST NOT HAVE constraints from user answers + preferences ──
function extractConstraints(
  answerList: Array<{ questionId: string; answer: string | string[] }> | undefined,
  preferences: Record<string, string> | undefined,
  instructions: unknown,
): { mustHave: string[]; mustNot: string[] } {
  const mustHave: string[] = [];
  const mustNot: string[] = [];

  // Parse answers for constraint keywords
  if (answerList) {
    for (const a of answerList) {
      if (!a.answer) continue;
      const vals = Array.isArray(a.answer) ? a.answer : [a.answer];
      for (const v of vals) {
        const lower = v.toLowerCase();
        // Detect open hem / no cuffs
        if (lower.includes('open hem') || lower.includes('straight, uncuffed') || lower.includes('no cuffs') || lower.includes('uncuffed')) {
          mustHave.push('open straight-cut hem at ankles');
          mustNot.push('elastic cuffs', 'ribbed cuffs', 'tapered cuffs', 'jogger cuffs');
        }
        // Detect oversized/baggy
        if (lower.includes('oversized') || lower.includes('baggy') || lower.includes('ultra baggy') || lower.includes('boxy')) {
          mustHave.push('ultra baggy oversized wide-leg silhouette');
        }
        // Detect no branding/logos
        if (lower.includes('no branding') || lower.includes('no logo') || lower.includes('no side logo')) {
          mustNot.push('side logos', 'visible branding', 'brand patches');
        }
        // Detect no pockets or specific pocket style
        if (lower.includes('side seam pockets only')) {
          mustHave.push('side seam pockets only');
          mustNot.push('back patch pockets', 'cargo pockets', 'front patch pockets');
        }
        if (lower.includes('no pockets')) {
          mustNot.push('any visible pockets');
        }
        // Detect fabric composition
        if (lower.includes('60') && lower.includes('40')) {
          mustHave.push('60/40 cotton polyester blend fabric');
        }
        if (lower.includes('100% cotton')) {
          mustHave.push('100% cotton fabric');
        }
        // Detect drawstring / waistband specifics
        if (lower.includes('elastic with external drawstring') || lower.includes('drawstring')) {
          mustHave.push('elastic waistband with external drawstring');
        }
        if (lower.includes('double') && lower.includes('waist')) {
          mustHave.push('double elastic waistband');
        }
        // Detect full-size graphics
        if (lower.includes('full length') || lower.includes('full size') || lower.includes('full-size')) {
          mustHave.push('full-length large-scale graphic');
        }
        // Detect screen print
        if (lower.includes('screen print')) {
          mustHave.push('screen-printed graphic');
        }
      }
    }
  }

  // Parse preferences
  if (preferences) {
    if (preferences.fit) {
      const fit = preferences.fit.toLowerCase();
      if (fit.includes('baggy') || fit.includes('oversized') || fit.includes('ultra')) {
        mustHave.push('ultra baggy oversized fit');
      }
    }
    if (preferences.hemStyle) {
      const hem = preferences.hemStyle.toLowerCase();
      if (hem.includes('open') || hem.includes('no cuffs') || hem.includes('straight')) {
        mustHave.push('open straight-cut hem');
        mustNot.push('elastic cuffs', 'ribbed cuffs');
      }
    }
    if (preferences.avoid) {
      const avoids = preferences.avoid.split(',').map(s => s.trim()).filter(Boolean);
      mustNot.push(...avoids);
    }
  }

  // Parse free-text instructions
  if (typeof instructions === 'string' && instructions.trim()) {
    const lower = instructions.toLowerCase();
    if (lower.includes('no cuffs') || lower.includes('no cuff')) {
      mustNot.push('cuffs of any kind');
    }
    if (lower.includes('no logo')) {
      mustNot.push('logos');
    }
    if (lower.includes('baggy') || lower.includes('oversized')) {
      mustHave.push('baggy oversized silhouette');
    }
  }

  // Deduplicate
  return {
    mustHave: [...new Set(mustHave)],
    mustNot: [...new Set(mustNot)],
  };
}

// ── Validate and patch imagePrompt to enforce constraints ──
function enforceConstraints(imagePrompt: string, mustHave: string[], mustNot: string[]): string {
  let prompt = imagePrompt;
  const lower = prompt.toLowerCase();

  // Prepend missing MUST NOT constraints
  const missingNots: string[] = [];
  for (const constraint of mustNot) {
    const keywords = constraint.toLowerCase().split(/\s+/);
    // Check if the prompt already mentions "no <constraint>"
    const hasNegation = lower.includes(`no ${constraint.toLowerCase()}`) ||
      lower.includes(`without ${constraint.toLowerCase()}`) ||
      lower.includes(`not ${constraint.toLowerCase()}`);
    if (!hasNegation) {
      missingNots.push(`no ${constraint}`);
    }
  }

  // Prepend missing MUST HAVE constraints
  const missingHaves: string[] = [];
  for (const constraint of mustHave) {
    const keywords = constraint.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const hasKeyword = keywords.some(kw => lower.includes(kw));
    if (!hasKeyword) {
      missingHaves.push(constraint);
    }
  }

  // Inject at the front of the prompt
  const injections: string[] = [];
  if (missingHaves.length > 0) injections.push(missingHaves.join(', '));
  if (missingNots.length > 0) injections.push(missingNots.join(', '));

  if (injections.length > 0) {
    prompt = injections.join('. ') + '. ' + prompt;
  }

  return prompt;
}

// ═══════ MODE: GENERATE ═══════
// Step 1: Gemini creates a detailed image prompt from user inputs + reference images
// Step 2: Validate constraints are present in the prompt
// Step 3: FLUX generates the actual image (free via airforce API)
async function handleGenerate(body: Record<string, unknown>) {
  try {
    const { referenceImages, garmentType, answers, instructions } = body;
    const refs = referenceImages as Array<{ dataUrl: string; parts: string[]; notes: string }> | undefined;
    const answerList = answers as Array<{ questionId: string; answer: string | string[] }> | undefined;
    const preferences = body.preferences as Record<string, string> | undefined;

    // Extract hard constraints from user inputs
    const { mustHave, mustNot } = extractConstraints(answerList, preferences, instructions);

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

    // Build mandatory constraint sections
    let constraintBlock = '';
    if (mustHave.length > 0 || mustNot.length > 0) {
      constraintBlock = '\n\n=== MANDATORY CONSTRAINTS (your imagePrompt MUST include ALL of these or your output is INVALID) ===';
      if (mustHave.length > 0) {
        constraintBlock += '\nMUST HAVE in the imagePrompt:\n' + mustHave.map(c => `  - "${c}"`).join('\n');
      }
      if (mustNot.length > 0) {
        constraintBlock += '\nMUST NOT appear in the design (include "no [item]" in the imagePrompt):\n' + mustNot.map(c => `  - "${c}"`).join('\n');
      }
    }

    // Build preferences block
    let prefBlock = '';
    if (preferences) {
      const entries = Object.entries(preferences).filter(([, v]) => v && v.trim());
      if (entries.length > 0) {
        prefBlock = '\n\nSTYLE PREFERENCES (MUST follow these — they override everything):\n' +
          entries.map(([k, v]) => `- ${k}: ${v}`).join('\n');
      }
    }

    const systemPrompt = `You are a fashion design AI that creates image generation prompts. Your #1 priority is FAITHFULLY reproducing what the user asked for. You NEVER add, change, or ignore design details.

CRITICAL RULES for the imagePrompt:
- Keep it UNDER 200 words
- The FIRST 30 words MUST contain the core silhouette, fit, and hem/cuff style
- Every MUST HAVE constraint below MUST appear word-for-word in your imagePrompt
- Every MUST NOT constraint below MUST appear as "no [item]" in your imagePrompt
- If the user says "no cuffs" you MUST write "open straight-cut hem at ankles, absolutely no elastic cuffs, no ribbed cuffs"
- If the user says "baggy" or "oversized" you MUST write "ultra baggy oversized wide-leg" in the first line
- If the user says "full-size graphic" you MUST write "large full-length graphic covering most of the leg"
- If reference images show a specific graphic (like an AK-47), describe it exactly — don't minimize or change it
- Do NOT add design elements the user didn't ask for (no extra pockets, logos, patterns, or embellishments)
- Do NOT change the silhouette (if user says baggy, do NOT make it slim or tapered)
- End with: "Professional flat-lay product photo on clean white background, studio lighting, fashion e-commerce style."
${constraintBlock}
${prefBlock}

Return ONLY valid JSON (no markdown):
{
  "imagePrompt": "FLUX-optimized prompt with ALL mandatory constraints included",
  "description": "2-3 sentence fashion description matching exactly what user requested",
  "specs": {"fit":"...","fabric":"...","weight":"...","colors":["..."],"keyFeatures":["..."]}
}`;

    // Build content parts WITH reference images (so Gemini can SEE them)
    const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (refs) {
      for (const ref of refs.slice(0, 4)) {
        const img = parseImage(ref.dataUrl);
        if (img) contentParts.push({ inlineData: img });
      }
    }
    contentParts.push({ text: contextLines.join('\n') });

    const data = await callGemini([{ role: 'user', parts: contentParts }], systemPrompt);

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

    // Validate and enforce constraints in the generated prompt
    imagePrompt = enforceConstraints(imagePrompt, mustHave, mustNot);

    // Generate the image via FLUX
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

    const preferences = body.preferences as Record<string, string> | undefined;

    // Extract constraints from preferences + edit instructions
    const { mustHave, mustNot } = extractConstraints(undefined, preferences, editInstructions);

    let constraintBlock = '';
    if (mustHave.length > 0 || mustNot.length > 0) {
      constraintBlock = '\n\n=== MANDATORY CONSTRAINTS ===';
      if (mustHave.length > 0) {
        constraintBlock += '\nMUST HAVE: ' + mustHave.map(c => `"${c}"`).join(', ');
      }
      if (mustNot.length > 0) {
        constraintBlock += '\nMUST NOT: ' + mustNot.map(c => `"${c}"`).join(', ');
      }
    }

    let prefBlock = '';
    if (preferences) {
      const entries = Object.entries(preferences).filter(([, v]) => v && v.trim());
      if (entries.length > 0) {
        prefBlock = '\n\nSTYLE PREFERENCES (MUST follow these — they override everything):\n' +
          entries.map(([k, v]) => `- ${k}: ${v}`).join('\n');
      }
    }

    const systemPrompt = `You are editing an existing ${garmentType} design for a FLUX image generation model.
The previous design was: "${prevDesc || 'no description'}".
The user wants to: "${editInstructions}".

Your #1 priority is FAITHFULLY applying the user's edit. Do NOT ignore any instruction.

CRITICAL RULES:
- Keep the imagePrompt UNDER 200 words
- Put the most important structural details FIRST (silhouette, fit, hem/cuff style)
- Be explicit about what the garment DOES and DOES NOT have
- If user says "no cuffs" → write "open straight-cut hem, absolutely no elastic cuffs"
- If user says "baggy" → write "ultra baggy oversized wide-leg"
- Do NOT add elements the user didn't ask for
- Do NOT change elements the user didn't mention changing
${constraintBlock}
${prefBlock}

Return ONLY valid JSON:
{"imagePrompt":"full updated garment description","description":"2-3 sentences","specs":{"fit":"...","fabric":"...","weight":"...","colors":[...],"keyFeatures":[...]}}

End imagePrompt with: "Professional flat-lay product photo on clean white background, studio lighting, fashion e-commerce style."`;

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

    // Enforce constraints in the generated prompt
    imagePrompt = enforceConstraints(imagePrompt, mustHave, mustNot);

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
