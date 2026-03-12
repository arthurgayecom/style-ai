import { NextRequest, NextResponse } from 'next/server';

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

export const maxDuration = 60;

async function callGemini(contents: unknown[], systemInstruction?: string) {
  const keys = getGeminiKeys();
  if (keys.length === 0) throw new Error('No AI keys configured.');

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: 4096 },
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
    if (res.ok) { keyIndex = idx + 1; return res.json(); }
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || '';
    const isQuota = res.status === 429 || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate');
    if (isQuota && i < keys.length - 1) continue;
    throw new Error(msg || `AI error (${res.status})`);
  }
  throw new Error('All AI keys are rate-limited.');
}

// ── Generate image via free API (airforce) with Together.ai fallback ──
async function generateImage(prompt: string, width = 768, height = 1024): Promise<string> {
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

      if (res.status === 429) continue;

      if (res.ok) {
        const data = await res.json();
        const imageUrl = data?.data?.[0]?.url;
        const b64 = data?.data?.[0]?.b64_json;

        if (b64) return `data:image/png;base64,${b64}`;

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { garmentDescription, measurements } = body;

    // Check for Replicate API token (premium try-on)
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (replicateToken) {
      const { userPhoto, garmentImage } = body;
      if (!userPhoto || !garmentImage) {
        return NextResponse.json({ error: 'Both a photo and garment image are required for Replicate try-on' }, { status: 400 });
      }
      return handleReplicateTryOn(userPhoto, garmentImage, replicateToken);
    }

    // Free tier: use Gemini for prompt + FLUX for image
    const measurementText = measurements
      ? `Person's measurements: ${Object.entries(measurements).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ')}.`
      : '';

    const systemPrompt = `You are creating a virtual try-on visualization. Create a detailed image prompt for generating a realistic photo of a person wearing the described garment.

The image should show: a fit male model wearing the garment in a casual standing pose, full body shot, natural lighting, clean background. Make the clothing look realistically worn with natural draping and folds.
${measurementText}

Return ONLY valid JSON: {"imagePrompt":"...","description":"..."}`;

    const desc = garmentDescription || body.garmentType || 'clothing item';

    const data = await callGemini([{
      role: 'user',
      parts: [{ text: `Generate a try-on image prompt for: ${desc}` }],
    }], systemPrompt);

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let imagePrompt = '';
    let description = '';

    try {
      const parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
      imagePrompt = parsed.imagePrompt || '';
      description = parsed.description || '';
    } catch {
      imagePrompt = `Male model wearing ${desc}, full body standing pose, natural lighting, clean white background, realistic fashion photography`;
      description = `Virtual try-on: ${desc}`;
    }

    const resultImage = await generateImage(imagePrompt);

    return NextResponse.json({ resultImage, description, source: 'flux' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Try-on failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleReplicateTryOn(userPhoto: string, garmentImage: string, token: string) {
  try {
    const Replicate = (await import('replicate')).default;
    const replicate = new Replicate({ auth: token });

    const output = await replicate.run('cuuupid/idm-vton:c871bb9b046c1b1f6aba781c79c98be75c1135ac18b91b93c8d1bba80e89aedc', {
      input: {
        human_img: userPhoto,
        garm_img: garmentImage,
        garment_des: 'clothing item',
      },
    });

    const resultUrl = typeof output === 'string' ? output : Array.isArray(output) ? output[0] : '';

    if (!resultUrl) {
      return NextResponse.json({ error: 'Replicate did not return an image.' }, { status: 500 });
    }

    return NextResponse.json({ resultImage: resultUrl, description: 'Virtual try-on generated with IDM-VTON', source: 'replicate' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Replicate API failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
