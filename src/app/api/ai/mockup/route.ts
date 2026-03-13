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

// ── Models to try in order: best quality first, fastest last ──
const IMAGE_MODELS = [
  'flux-realism',       // Photorealistic — best for fashion mockups
  'flux',               // Base FLUX — good general quality
  'flux-2-klein-4b',    // Small/fast fallback
];

// ── Try a single model on airforce API, return base64 or null ──
async function tryAirforceModel(model: string, prompt: string, width: number, height: number): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1000 + attempt * 1000));

      const res = await fetch(AIRFORCE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, size: `${width}x${height}`, n: 1 }),
      });

      if (res.status === 429) continue; // rate limited, retry

      if (res.ok) {
        const data = await res.json();
        const b64 = data?.data?.[0]?.b64_json;
        if (b64) return `data:image/png;base64,${b64}`;

        const imageUrl = data?.data?.[0]?.url;
        if (imageUrl) {
          const imgRes = await fetch(imageUrl);
          if (imgRes.ok) {
            const buffer = await imgRes.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
            return `data:${contentType};base64,${base64}`;
          }
        }
      }

      // Non-429 error (model not found, etc.) — skip to next model
      if (!res.ok && res.status !== 429) return null;
    } catch {
      // Network error
    }
  }
  return null; // All retries exhausted for this model
}

// ── Generate image: cascade through models from best to fastest ──
async function generateImage(prompt: string, width = 832, height = 1216): Promise<string> {
  // Try each model in priority order on airforce API
  for (const model of IMAGE_MODELS) {
    const result = await tryAirforceModel(model, prompt, width, height);
    if (result) return result;
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

// ── Convert canvas annotations to text descriptions for Gemini ──
function convertAnnotationsToText(
  annotations: Array<Record<string, unknown>> | undefined,
  canvasHeight = 960,
  garmentType = 'garment',
): string {
  if (!annotations || annotations.length === 0) return '';

  const isBottom = /pant|jean|jogger|cargo|short|trouser|sweat/i.test(garmentType);

  const getZone = (y: number): string => {
    const pct = y / canvasHeight;
    if (isBottom) {
      if (pct < 0.12) return 'waistband area';
      if (pct < 0.25) return 'hip/upper thigh';
      if (pct < 0.45) return 'mid-thigh';
      if (pct < 0.60) return 'knee area';
      if (pct < 0.80) return 'shin/lower leg';
      return 'ankle/hem area';
    }
    // Tops / jackets
    if (pct < 0.10) return 'collar/neckline area';
    if (pct < 0.25) return 'upper chest/shoulder';
    if (pct < 0.45) return 'mid-chest';
    if (pct < 0.60) return 'lower torso';
    if (pct < 0.75) return 'waist/hem area';
    return 'bottom edge';
  };

  const lines: string[] = [];
  for (const ann of annotations) {
    const tool = ann.tool as string;
    if (tool === 'text' && ann.text) {
      const zone = getZone(ann.y as number);
      lines.push(`Text label "${ann.text}" placed at ${zone}`);
    } else if (tool === 'circle' && ann.center) {
      const c = ann.center as { x: number; y: number };
      const zone = getZone(c.y);
      lines.push(`Circle highlighting ${zone} — area to modify or add detail`);
    } else if (tool === 'arrow' && ann.from && ann.to) {
      const from = ann.from as { x: number; y: number };
      const to = ann.to as { x: number; y: number };
      const fromZone = getZone(from.y);
      const toZone = getZone(to.y);
      if (fromZone === toZone) {
        lines.push(`Arrow pointing within ${fromZone} — indicates placement direction`);
      } else {
        lines.push(`Arrow from ${fromZone} to ${toZone} — element should span this area`);
      }
    } else if (tool === 'pen' && Array.isArray(ann.points) && ann.points.length > 0) {
      const pts = ann.points as Array<{ x: number; y: number }>;
      const avgY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
      const zone = getZone(avgY);
      lines.push(`Freehand sketch in ${zone} — shows desired design element shape`);
    }
  }

  return lines.length > 0 ? '\n\nUSER CANVAS ANNOTATIONS (drawn directly on the reference image):\n' + lines.join('\n') : '';
}

// Allow up to 60s for image generation
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode } = body;

    if (mode === 'detect') return handleDetect(body);
    if (mode === 'questions') return handleQuestions(body);
    if (mode === 'generate') return handleGenerate(body);
    if (mode === 'edit') return handleEdit(body);

    return NextResponse.json({ error: 'Invalid mode. Use: detect, questions, generate, or edit.' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Design generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ═══════ MODE: DETECT ═══════
async function handleDetect(body: Record<string, unknown>) {
  const { image } = body;
  if (!image || typeof image !== 'string') {
    return NextResponse.json({ error: 'Image is required for detection.' }, { status: 400 });
  }

  const img = parseImage(image);
  if (!img) {
    return NextResponse.json({ error: 'Invalid image format.' }, { status: 400 });
  }

  const validTypes = [
    'Sweatpants', 'Joggers', 'Cargo Pants', 'Jeans', 'Pants', 'Shorts',
    'Hoodie', 'Sweatshirt', 'T-Shirt', 'Jacket', 'Windbreaker', 'Vest',
    'Tank Top', 'Polo', 'Button-Down Shirt', 'Blazer', 'Coat',
    'Dress', 'Skirt', 'Jumpsuit', 'Cap',
  ];

  const systemPrompt = `You are a garment classification expert. Analyze the image and determine what type of clothing item it shows.

Valid garment types (pick EXACTLY one): ${validTypes.join(', ')}

Rules:
- If the image shows a full outfit, identify the PRIMARY/main garment that stands out most
- If it shows pants with cargo pockets, classify as "Cargo Pants"
- If it shows athletic/fleece pants, classify as "Sweatpants" or "Joggers"
- If it shows a zip-up hoodie or pullover hoodie, classify as "Hoodie"
- If it shows a crewneck sweatshirt (no hood), classify as "Sweatshirt"
- If it shows a puffer vest or utility vest, classify as "Vest"
- Be specific — don't default to generic "Pants" when a more specific type applies

Return ONLY valid JSON (no markdown): {"garmentType": "exact type from list", "confidence": 0.95}`;

  try {
    const data = await callGemini([{
      role: 'user',
      parts: [
        { inlineData: img },
        { text: 'What type of garment is shown in this image? Classify it.' },
      ],
    }], systemPrompt);

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = parseAIJSON(text) as { garmentType?: string; confidence?: number };

    // Validate the returned type is in our list
    const detected = parsed.garmentType || 'T-Shirt';
    const isValid = validTypes.some(t => t.toLowerCase() === detected.toLowerCase());

    return NextResponse.json({
      garmentType: isValid ? detected : 'T-Shirt',
      confidence: parsed.confidence ?? 0.5,
    });
  } catch {
    return NextResponse.json({ garmentType: 'T-Shirt', confidence: 0 });
  }
}

// ═══════ MODE: QUESTIONS ═══════
async function handleQuestions(body: Record<string, unknown>) {
  const { garmentType, partsSummary, referenceImages } = body;
  const refs = referenceImages as Array<{ dataUrl: string; parts: string[]; notes: string }> | undefined;

  const systemPrompt = `You are an expert streetwear fashion designer specializing in oversized/baggy garments. You're helping a client specify their custom design for manufacturing.

Based on their reference images and selections, generate 6-10 precise questions. These questions will directly control the AI image generation, so they MUST capture the exact construction details.

Return ONLY valid JSON (no markdown, no code fences):
{
  "questions": [
    {
      "id": "q1",
      "question": "What fit are you going for?",
      "type": "select",
      "options": ["Slim fit", "Regular fit", "Relaxed fit", "Oversized", "Ultra Baggy Wide-Leg"],
      "category": "fit"
    }
  ]
}

Rules:
- "type" must be: "select" (single choice), "multi-select" (multiple), or "text" (free input)
- "category" must be: "fit", "fabric", "construction", "color", "branding", "details", "accessories", or "graphics"
- Questions MUST be specific to what you SEE in the reference images
- For pants/joggers always ask about: hem style (open vs cuffed), waistband style (single vs double, drawstring vs flat), leg width, pocket placement
- For tops always ask about: shoulder drop, sleeve length, hem length, neckline
- Include a question about fabric weight with GSM options (Lightweight 130-160, Midweight 180-220, Heavyweight 280-320, Premium 350+)
- Include a question about ACCESSORIES if relevant (chains, D-rings, carabiner clips, decorative zippers, grommets)
- Include a question about GRAPHICS if relevant — placement, size, style, what the graphic depicts
- Include a question about what to AVOID / what should NOT be on the garment
- If reference images show specific elements (graphics, stripes, panels, patterns, chains, hardware), ask about those EXACT elements — don't generalize
- Options must be practical streetwear terms (not generic fashion terms)
- Always include "Ultra Baggy Wide-Leg" and "Oversized" as fit options for bottoms`;

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
        // Detect fabric weight from answers
        if (lower.includes('lightweight') && (lower.includes('gsm') || lower.includes('french terry') || lower.includes('loopback') || lower.includes('130'))) {
          mustHave.push('lightweight fabric 130-160 GSM');
        }
        if (lower.includes('medium-weight') || lower.includes('midweight') || (lower.includes('medium') && lower.includes('weight')) || lower.includes('180-220')) {
          mustHave.push('midweight fabric 180-220 GSM');
        }
        if ((lower.includes('heavyweight') || lower.includes('heavy weight') || (lower.includes('heavy') && lower.includes('fleece')) || lower.includes('280-320')) && !lower.includes('premium')) {
          mustHave.push('heavyweight fabric 280-320 GSM');
        }
        if (lower.includes('premium') && (lower.includes('heavyweight') || lower.includes('350'))) {
          mustHave.push('premium heavyweight fabric 350+ GSM');
        }
        // Detect waistband style from answers
        if (lower.includes('double elastic') || lower.includes('double waistband')) {
          mustHave.push('double elastic waistband');
        }
        if (lower.includes('contrast fabric waistband') || lower.includes('plaid waistband') || lower.includes('tartan')) {
          mustHave.push('contrast fabric waistband (plaid/tartan)');
        }
        // Detect material composition
        if (lower.includes('french terry')) mustHave.push('French terry fabric');
        if (lower.includes('fleece') && !lower.includes('french')) mustHave.push('fleece fabric');
        if (lower.includes('ripstop') || lower.includes('nylon')) mustHave.push('ripstop nylon fabric');
        if (lower.includes('denim') || lower.includes('heavy denim')) mustHave.push('heavyweight denim fabric');
        if (lower.includes('canvas') || lower.includes('twill')) mustHave.push('cotton twill/canvas fabric');
        // Detect hem styles from new questions
        if (lower.includes('dragging') || lower.includes('pooling')) {
          mustHave.push('hem pooling/dragging on ground');
        }
        if (lower.includes('raw frayed') || lower.includes('frayed edge')) {
          mustHave.push('raw frayed hem edge');
        }
        if (lower.includes('drawstring ankle') || lower.includes('ankle toggle')) {
          mustHave.push('drawstring ankle toggles');
        }
        // Detect pocket styles
        if (lower.includes('cargo pockets')) mustHave.push('cargo pockets on thighs');
        if (lower.includes('deep slant')) mustHave.push('deep slant pockets');
        // Detect accessories
        if (lower.includes('chain') && !lower.includes('no chain')) mustHave.push('decorative chain detail');
        if (lower.includes('d-ring') || lower.includes('d ring')) mustHave.push('metal D-ring hardware');
        if (lower.includes('carabiner')) mustHave.push('carabiner clip attachment');
        if (lower.includes('decorative zipper') || lower.includes('exposed zipper')) mustHave.push('decorative exposed zipper detail');
        if (lower.includes('grommet') || lower.includes('eyelet')) mustHave.push('metal grommet/eyelet detail');
        // Detect avoid question (questionId might be "avoid")
        if (a.questionId === 'avoid' && typeof a.answer === 'string' && a.answer.trim()) {
          const avoidItems = a.answer.split(',').map(s => s.trim()).filter(Boolean);
          mustNot.push(...avoidItems);
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
      if (fit.includes('same fit as reference') || fit.includes('similar to reference')) {
        mustHave.push('same fit and silhouette as the reference image');
      }
    }
    if (preferences.hemStyle) {
      const hem = preferences.hemStyle.toLowerCase();
      if (hem.includes('open') || hem.includes('no cuffs') || hem.includes('straight')) {
        mustHave.push('open straight-cut hem');
        mustNot.push('elastic cuffs', 'ribbed cuffs');
      }
    }
    if (preferences.weight) {
      const weight = preferences.weight.toLowerCase();
      if (weight.includes('lightweight')) mustHave.push('lightweight fabric 130-160 GSM');
      else if (weight.includes('midweight')) mustHave.push('midweight fabric 180-220 GSM');
      else if (weight.includes('premium')) mustHave.push('premium heavyweight fabric 350+ GSM');
      else if (weight.includes('heavyweight')) mustHave.push('heavyweight fabric 280-320 GSM');
      else if (weight.trim()) mustHave.push(preferences.weight);
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

  // Always enforce: front-facing, no matching set, correct outfit pairing
  if (!lower.includes('front-facing') && !lower.includes('front facing')) {
    prompt = 'Front-facing model, natural relaxed pose. ' + prompt;
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
    const canvasAnnotations = body.canvasAnnotations as Array<Record<string, unknown>> | undefined;
    const canvasImage = body.canvasImage as string | undefined;

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

    // Add canvas annotation text
    const annotationText = convertAnnotationsToText(canvasAnnotations, 960, garmentType as string);
    if (annotationText) contextLines.push(annotationText);

    // Add explicit outfit instruction based on garment category
    const isBottom = /pant|jean|jogger|cargo|short|trouser|sweat/i.test(garmentType as string);
    const isJacket = /jacket|bomber|coat|windbreaker|parka/i.test(garmentType as string);
    if (isBottom) {
      contextLines.push(`OUTFIT RULE: Model must wear ONLY a plain solid white crewneck t-shirt on top — NO hoodie, NO jacket, NO vest, NO open shirt, NO matching sweatshirt, NO graphic tee. Simple white sneakers on feet. The ${garmentType} is the ONLY product.`);
    } else if (isJacket) {
      contextLines.push(`OUTFIT RULE: Model must wear a plain solid white crewneck t-shirt underneath, simple blue jeans on bottom, white sneakers. The ${garmentType} is the ONLY product — NO matching pants, NO extra layers.`);
    } else {
      contextLines.push(`OUTFIT RULE: Model must wear simple blue jeans or plain black pants on bottom and white sneakers. The ${garmentType} is the ONLY product — NO matching set, NO extra accessories.`);
    }

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

    const systemPrompt = `You are an expert streetwear fashion designer creating image generation prompts for FLUX AI. You deeply understand oversized/baggy aesthetics: ultra-wide legs, dropped crotch, open hems that pool on the ground, contrast waistbands, side stripe panels, heavyweight fabrics with natural drape. You also understand streetwear accessories: decorative chains hanging from belt loops, D-ring hardware, carabiner clips, exposed decorative zippers, and metal grommets/eyelets.

Your ONLY job: faithfully translate the user's design specs + reference images into a precise FLUX image prompt. You NEVER add, change, or ignore details.
${canvasAnnotations && canvasAnnotations.length > 0 ? '\nThe user has drawn annotations directly on their reference image. An annotated version of the image is attached. Text labels are direct instructions. Circles highlight areas to focus on. Arrows indicate placement or direction. Freehand sketches show desired element shapes. Incorporate ALL annotations into your prompt.' : ''}

=== PROMPT STRUCTURE — 4 LAYERS (follow this EXACT order) ===

LAYER 1 — BASE (first 40 words): Garment silhouette + fit + primary fabric + primary color. This is the most important part — FLUX reads left-to-right and weighs early words most.
Example: "Ultra baggy oversized wide-leg heather grey heavyweight French terry sweatpants with dropped crotch and open straight-cut hem pooling at ankles on a front-facing male model"

LAYER 2 — OVERLAYS & ACCESSORIES (40-60 words): Chains, D-rings, carabiners, decorative zippers, double-waistband layers, contrast panels, side stripes, layered elements. Describe each accessory with exact placement ("silver curb chain hanging from right front belt loop to right back belt loop, 8-inch drop").

LAYER 3 — GRAPHICS & PRINTS (40-60 words): Any graphic/print with EXACT placement, size, style, and method. Example: "AK-47 silhouette screen-printed in matte black, centered on left thigh panel, 8 inches tall, clean vector style". If no graphics requested, skip this layer entirely.

LAYER 4 — CONSTRUCTION + QUALITY (40-60 words): Remaining construction details + outfit rule + quality suffix.
Always end with: "Model wearing ONLY a plain solid white crewneck t-shirt [adjust per outfit rule] and white sneakers. Professional fashion product photo, front-facing model, natural relaxed pose, studio lighting, clean white/grey background, fabric texture clearly visible, natural skin tone, correct human anatomy, photorealistic, high-end streetwear lookbook, 8k sharp detail"

=== OUTFIT RULES (CRITICAL — prevents wrong items appearing) ===
- The target garment is the ONLY featured piece. Everything else the model wears must be PLAIN and NEUTRAL.
- If designing BOTTOMS (pants, jeans, cargos, joggers, sweats, shorts): model wears ONLY a plain solid white crewneck t-shirt (tucked or untucked) and simple white sneakers. NO jacket, NO hoodie, NO vest, NO open shirt, NO matching sweatshirt, NO graphic tee, NO hat, NO bag.
- If designing TOPS (tee, hoodie, sweater): model wears SIMPLE BLUE JEANS or plain black pants, and simple white sneakers. NO hat, NO bag, NO extra layers.
- If designing a JACKET: model wears a plain solid white crewneck t-shirt underneath, simple blue jeans, white sneakers. NO matching pants.
- NEVER generate a matching set or coordinated outfit — the viewer must instantly know which single piece is the product.
- The model must be FRONT-FACING with a natural relaxed pose, arms slightly away from body so the garment silhouette is fully visible.
- The garment must be shown RIGHT-SIDE FORWARD (not backwards) — front pockets, fly, waistband drawstring, and any front details must be visible.

=== HARD RULES ===
- UNDER 300 words total across all 4 layers
- If user says "no cuffs" → write "open straight-cut hem at ankles, absolutely no elastic cuffs, no ribbed cuffs, no jogger cuffs"
- If user says "baggy/oversized" → write "ultra baggy oversized wide-leg with extreme volume" as first words of Layer 1
- If user says "full-size graphic" → write "large full-length graphic covering entire [area] from [top] to [bottom]" with specific placement
- If user mentions accessories (chains, D-rings, carabiners) → describe the EXACT type, material (silver/gold/gunmetal), placement, and attachment method
- If reference images show a specific design element, describe it EXACTLY as it appears — never minimize or reinterpret
- If user wants "same fit as reference" → study the reference closely and describe the EXACT proportions
- Include fabric weight when specified (e.g., "heavyweight 320 GSM French terry")
- NEVER add elements the user didn't request
- NEVER change the silhouette — if user says wide-leg, you CANNOT output slim, tapered, or fitted
- NEVER show the garment backwards — always front view
- The model must look natural and well-proportioned — no distorted limbs, no weird poses
${constraintBlock}
${prefBlock}

Return ONLY valid JSON (no markdown):
{
  "imagePrompt": "Layer 1... Layer 2... Layer 3... Layer 4...",
  "description": "2-3 sentence fashion description matching EXACTLY what user requested",
  "specs": {"fit":"...","fabric":"...","weight":"...","colors":["..."],"keyFeatures":["..."]}
}`;

    // Build content parts WITH reference images (so Gemini can SEE them)
    const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    // If annotated canvas image exists, send it first (so Gemini sees the user's drawings)
    if (canvasImage) {
      const annotatedImg = parseImage(canvasImage);
      if (annotatedImg) contentParts.push({ inlineData: annotatedImg });
    }

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
    const { editInstructions, garmentType, description: prevDesc, mockupImage: currentImage, specs: prevSpecs } = body;
    const canvasAnnotations = body.canvasAnnotations as Array<Record<string, unknown>> | undefined;
    const canvasImage = body.canvasImage as string | undefined;

    if (!editInstructions && (!canvasAnnotations || canvasAnnotations.length === 0)) {
      return NextResponse.json({ error: 'Edit instructions or canvas annotations are required.' }, { status: 400 });
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

    // Build specs context so Gemini knows the full current design
    let specsContext = '';
    if (prevSpecs && typeof prevSpecs === 'object') {
      const s = prevSpecs as Record<string, unknown>;
      const parts: string[] = [];
      if (s.fit) parts.push(`Fit: ${s.fit}`);
      if (s.fabric) parts.push(`Fabric: ${s.fabric}`);
      if (s.weight) parts.push(`Weight: ${s.weight}`);
      if (Array.isArray(s.colors) && s.colors.length > 0) parts.push(`Colors: ${s.colors.join(', ')}`);
      if (Array.isArray(s.keyFeatures) && s.keyFeatures.length > 0) parts.push(`Key features: ${s.keyFeatures.join(', ')}`);
      if (parts.length > 0) specsContext = '\nCurrent specs: ' + parts.join(' | ');
    }

    // Convert canvas annotations to text
    const annotationText = convertAnnotationsToText(canvasAnnotations, 960, garmentType as string);

    const systemPrompt = `You are editing an existing ${garmentType} design. The attached image shows the CURRENT design. The user wants specific changes — NOT a full redesign.

CURRENT DESIGN:
- Description: "${prevDesc || 'no description'}"${specsContext}

USER'S EDIT: "${editInstructions || 'See canvas annotations below'}"
${annotationText}
${canvasImage ? '\nAn annotated image is attached showing the user\'s drawings on the current design. Text labels are direct edit instructions. Circles highlight areas to change. Arrows indicate direction of change. Incorporate ALL visible annotations as edits.' : ''}

RULES:
- Study the attached image carefully — that is the garment you're modifying
- Apply ONLY the user's requested changes (text instructions + canvas annotations)
- Keep EVERYTHING ELSE identical: same silhouette, color, fabric, graphics, fit, width, hem style, waistband, pockets, stripes
- Your imagePrompt describes the FULL garment (current design + edits applied) ON A MODEL
- Be extremely specific about preserved elements — describe colors, materials, and construction exactly as they appear
- Keep under 300 words
- Use the 4-layer format: Layer 1 (base silhouette) → Layer 2 (overlays/accessories) → Layer 3 (graphics) → Layer 4 (construction + quality)
- OUTFIT: If the garment is bottoms, model wears ONLY a plain solid white crewneck t-shirt and white sneakers — NO jacket, NO hoodie, NO vest, NO matching set. If tops, model wears simple blue jeans and white sneakers. NEVER add matching sets or extra layers.
- The garment must be shown FRONT-FACING, right-side forward (not backwards). Model in natural relaxed pose.
- End with: "Professional fashion product photo, front-facing model, studio lighting, clean white/grey background, fabric texture clearly visible, natural skin tone, correct human anatomy, photorealistic, high-end streetwear lookbook, 8k sharp detail"
${constraintBlock}
${prefBlock}

Return ONLY valid JSON:
{"imagePrompt":"full garment on model with edit applied, everything else exactly preserved","description":"2-3 sentences","specs":{"fit":"...","fabric":"...","weight":"...","colors":[...],"keyFeatures":[...]}}`;

    // Build content parts — include annotated canvas and/or current design image
    const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    // Send annotated canvas image first if available (so Gemini sees user's drawings)
    if (canvasImage) {
      const annotatedImg = parseImage(canvasImage);
      if (annotatedImg) contentParts.push({ inlineData: annotatedImg });
    }

    // Then the original current design image
    if (typeof currentImage === 'string') {
      const img = parseImage(currentImage);
      if (img) contentParts.push({ inlineData: img });
    }
    contentParts.push({ text: `Edit request: ${editInstructions || 'Apply the changes shown in the annotated canvas image above.'}` });

    const data = await callGemini([{ role: 'user', parts: contentParts }], systemPrompt);

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
  const isBottom = /pant|jean|jogger|cargo|short|trouser/i.test(garmentType);
  if (isBottom) {
    return [
      { id: 'fit', question: `What silhouette for this ${garmentType}?`, type: 'select', options: ['Ultra Baggy Wide-Leg', 'Oversized Relaxed', 'Regular Straight', 'Slim Tapered'], category: 'fit' },
      { id: 'hem', question: 'Hem / ankle style?', type: 'select', options: ['Open Hem (straight, uncuffed, dragging)', 'Elastic Ribbed Cuffs', 'Drawstring Ankle Toggle', 'Raw Frayed Edge'], category: 'construction' },
      { id: 'waistband', question: 'Waistband style?', type: 'select', options: ['Elastic with External Drawstring', 'Double Elastic Waistband', 'Flat Waistband with Belt Loops', 'Contrast Fabric Waistband (e.g., plaid)'], category: 'construction' },
      { id: 'fabric', question: 'Fabric weight?', type: 'select', options: ['Lightweight (130-160 GSM)', 'Midweight (180-220 GSM)', 'Heavyweight (280-320 GSM)', 'Premium Heavyweight (350+ GSM)'], category: 'fabric' },
      { id: 'material', question: 'Material?', type: 'select', options: ['100% Cotton Fleece', '60/40 Cotton Polyester', 'French Terry', 'Heavy Denim', 'Cotton Twill / Canvas', 'Ripstop Nylon'], category: 'fabric' },
      { id: 'pockets', question: 'Pocket style?', type: 'select', options: ['Side Seam Pockets Only', 'Deep Slant Pockets', 'Cargo Pockets on Thighs', 'No Visible Pockets'], category: 'construction' },
      { id: 'accessories', question: 'Accessories / hardware?', type: 'multi-select', options: ['None', 'Decorative Chain (belt loop to belt loop)', 'D-Ring Hardware', 'Carabiner Clip', 'Decorative Exposed Zippers', 'Metal Grommets/Eyelets'], category: 'accessories' },
      { id: 'graphic', question: 'Any graphic or print?', type: 'select', options: ['None (clean)', 'Small Logo on Thigh', 'Large Full-Leg Graphic', 'All-Over Print', 'Embroidered Detail'], category: 'graphics' },
      { id: 'color', question: 'Primary color?', type: 'text', category: 'color' },
      { id: 'avoid', question: 'What should this garment NOT have?', type: 'text', category: 'details' },
    ];
  }
  return [
    { id: 'fit', question: `What fit for this ${garmentType}?`, type: 'select', options: ['Ultra Oversized / Boxy', 'Oversized Drop Shoulder', 'Regular Fit', 'Slim Fit', 'Cropped Boxy'], category: 'fit' },
    { id: 'fabric', question: 'Fabric weight?', type: 'select', options: ['Lightweight (130-160 GSM)', 'Midweight (180-220 GSM)', 'Heavyweight (280-320 GSM)', 'Premium Heavyweight (350+ GSM)'], category: 'fabric' },
    { id: 'material', question: 'Material?', type: 'select', options: ['100% Cotton', '100% Organic Cotton', 'Cotton/Polyester Blend', 'French Terry', 'Fleece', 'Nylon Shell', 'Denim'], category: 'fabric' },
    { id: 'neckline', question: 'Neckline / collar?', type: 'select', options: ['Crew Neck', 'V-Neck', 'Hoodie', 'Mock Neck / Turtleneck', 'Zip-Up Collar', 'No Collar (jacket)'], category: 'construction' },
    { id: 'color', question: 'Primary color palette?', type: 'text', category: 'color' },
    { id: 'branding', question: 'Branding / graphics?', type: 'select', options: ['No Branding (clean)', 'Small Chest Logo', 'Large Front Graphic', 'Large Back Print', 'Embroidered Script', 'All-Over Pattern'], category: 'branding' },
    { id: 'accessories', question: 'Accessories / hardware?', type: 'multi-select', options: ['None', 'Decorative Chain Detail', 'Metal D-Rings', 'Carabiner Clip', 'Decorative Zippers', 'Metal Grommets'], category: 'accessories' },
    { id: 'details', question: 'Construction details?', type: 'multi-select', options: ['Drop Shoulders', 'Extended Sleeves (covers hands)', 'Raw Edge Hem', 'Split Hem', 'Double-Needle Stitching', 'Contrast Stitching', 'Kangaroo Pocket', 'Hidden Pockets'], category: 'details' },
    { id: 'avoid', question: 'What should this garment NOT have?', type: 'text', category: 'details' },
  ];
}
