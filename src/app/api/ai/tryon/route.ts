import { NextRequest, NextResponse } from 'next/server';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const IMAGE_MODEL = 'gemini-2.5-flash-image';

function getGeminiKeys(): string[] {
  const multi = process.env.FREE_GEMINI_API_KEYS;
  if (multi) return multi.split(',').map(k => k.trim()).filter(Boolean);
  const single = process.env.FREE_GEMINI_API_KEY;
  if (single) return [single.trim()];
  return [];
}

let keyIndex = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userPhoto, garmentImage, measurements } = body;

    if (!userPhoto || !garmentImage) {
      return NextResponse.json({ error: 'Both a photo of yourself and a garment image are required' }, { status: 400 });
    }

    // Check for Replicate API token (premium try-on)
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (replicateToken) {
      return handleReplicateTryOn(userPhoto, garmentImage, replicateToken);
    }

    // Fall back to Gemini image generation
    const keys = getGeminiKeys();
    if (keys.length === 0) {
      return NextResponse.json({ error: 'No AI keys configured.' }, { status: 503 });
    }

    // Build prompt
    const measurementText = measurements
      ? `The person's measurements: ${Object.entries(measurements).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ')}.`
      : '';

    const prompt = [
      `You are a professional fashion visualization expert.`,
      `I'm providing two images: (1) a photo of a person and (2) a garment/clothing item.`,
      `Generate a realistic image of the person wearing this garment.`,
      `Maintain the person's exact pose, body proportions, face, and background.`,
      `The garment should look naturally worn — with realistic draping, folds, and fit.`,
      measurementText,
      `Make it look like a real photo, not a composite or collage.`,
    ].filter(Boolean).join(' ');

    // Parse both images
    const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    for (const img of [userPhoto, garmentImage]) {
      const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        contentParts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
    }
    contentParts.push({ text: prompt });

    const requestBody = {
      contents: [{ role: 'user', parts: contentParts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        maxOutputTokens: 4096,
      },
    };

    const bodyStr = JSON.stringify(requestBody);

    for (let i = 0; i < keys.length; i++) {
      const idx = (keyIndex + i) % keys.length;
      const apiKey = keys[idx];

      const res = await fetch(
        `${GEMINI_BASE}/${IMAGE_MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyStr,
        }
      );

      if (res.ok) {
        keyIndex = idx + 1;
        const data = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];

        let description = '';
        let resultImage = '';

        for (const part of parts) {
          if (part.text) description += part.text;
          if (part.inlineData) {
            resultImage = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
        }

        if (!resultImage) {
          return NextResponse.json(
            { error: 'AI could not generate a try-on image. Try different photos or angles.' },
            { status: 500 }
          );
        }

        return NextResponse.json({ resultImage, description, source: 'gemini' });
      }

      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || '';
      const isQuota = res.status === 429 || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate');

      if (isQuota && i < keys.length - 1) continue;

      return NextResponse.json({ error: msg || `AI error (${res.status})` }, { status: res.status });
    }

    return NextResponse.json({ error: 'All AI keys are rate-limited. Try again in a minute.' }, { status: 429 });
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
