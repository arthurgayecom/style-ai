import { NextRequest, NextResponse } from 'next/server';
import { parseAIJSON } from '@/lib/ai/parseJSON';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-2.5-flash';

function getGeminiKeys(): string[] {
  const multi = process.env.FREE_GEMINI_API_KEYS;
  if (multi) return multi.split(',').map(k => k.trim()).filter(Boolean);
  const single = process.env.FREE_GEMINI_API_KEY;
  if (single) return [single.trim()];
  return [];
}

let keyIndex = 0;

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { garmentType, description, mockupImage, specs } = body;

    if (!garmentType) {
      return NextResponse.json({ error: 'Garment type is required' }, { status: 400 });
    }

    const keys = getGeminiKeys();
    if (keys.length === 0) {
      return NextResponse.json({ error: 'No AI keys configured.' }, { status: 503 });
    }

    const systemPrompt = `You are a senior fashion tech pack specialist with 20 years of experience creating production-ready specification documents for garment manufacturers.

Generate a COMPLETE, factory-ready tech pack. This must include EVERYTHING a manufacturer needs to produce the garment without any additional communication.

Return ONLY valid JSON (no markdown, no code fences) with this EXACT structure:
{
  "styleName": "descriptive name for this design",
  "styleNumber": "ST-XXXXX (generate a unique style number)",
  "season": "SS26 or AW26",

  "sizes": ["XS", "S", "M", "L", "XL", "XXL"],
  "baseSize": "M",
  "measurements": [
    {
      "pom": "Chest Width (1/2)",
      "description": "Measure straight across chest 1 inch below armhole",
      "tolerance": "+/- 0.5\\"",
      "values": { "XS": "18\\"", "S": "19.5\\"", "M": "21\\"", "L": "22.5\\"", "XL": "24\\"", "XXL": "25.5\\"" },
      "gradingRule": "+1.5\\" per size"
    }
  ],

  "constructionDetails": [
    {
      "area": "Side seam",
      "stitchType": "5-thread safety stitch (516)",
      "spiOrGauge": "12 SPI",
      "seamAllowance": "3/8\\"",
      "notes": "Seam pressed toward back"
    }
  ],

  "materials": [
    {
      "component": "Shell Fabric",
      "description": "Heavyweight jersey knit",
      "material": "100% Combed Ring-Spun Cotton",
      "colorCode": "Pantone 19-4052 TCX",
      "supplier": "To be sourced",
      "quantity": "1.2 yards per unit (M)",
      "placement": "Full body"
    }
  ],

  "colorway": [
    {
      "name": "Midnight Navy",
      "pantone": "19-4052 TCX",
      "hex": "#1B3A5C",
      "component": "Shell fabric"
    }
  ],

  "labels": [
    {
      "type": "Brand Label",
      "method": "Woven damask",
      "dimensions": "2\\" x 0.75\\"",
      "placement": "Center back neck, 1\\" below collar seam"
    }
  ],

  "artworkPlacements": [
    {
      "name": "Front Logo",
      "method": "Screen print / Embroidery",
      "position": "Center chest, 3\\" below HPS",
      "dimensions": "4\\" x 2\\"",
      "colorCodes": ["Pantone 11-0601 TCX"]
    }
  ],

  "careInstructions": ["Machine wash cold", "Tumble dry low", "Do not bleach", "Iron low heat if needed"],
  "fiberContent": "100% Cotton",
  "countryOfOrigin": "To be determined",

  "packaging": {
    "foldMethod": "Standard shirt fold with tissue",
    "polyBag": "12\\" x 16\\" clear poly bag with suffocation warning",
    "hangtag": "Brand hangtag attached with safety pin at left side seam",
    "tissueWrap": true,
    "unitsPerCarton": 24
  },

  "constructionNotes": [
    "All seams to be overlocked before assembly",
    "Bartack at all stress points (pocket openings, fly, belt loops)"
  ],

  "additionalNotes": "Any other notes"
}

CRITICAL RULES:
- Include at LEAST 10-15 Points of Measure (POMs) with full grading across ALL sizes
- Include at LEAST 8-10 construction details with specific stitch types (301, 401, 504, 516, etc.) and SPI
- Use REAL Pantone TCX codes (not made up ones)
- Measurements must follow industry grading standards (typically +1" to +2" per size for width, +0.5" to +1" for length)
- Include tolerances for every POM (+/- values)
- Materials section must include fabric weight in GSM
- Labels must include brand label, size label, care/content label at minimum
- Be specific about seam allowances (3/8", 1/2", etc.)`;

    const specsContext = specs ? `\nDesign specs: Fit: ${specs.fit}, Fabric: ${specs.fabric}, Weight: ${specs.weight}, Colors: ${specs.colors?.join(', ')}, Features: ${specs.keyFeatures?.join(', ')}` : '';

    const userPrompt = `Generate a complete, factory-ready tech pack for:
Garment type: ${garmentType}
${description ? `Description: ${description}` : ''}${specsContext}

Make it production-ready with every detail a manufacturer needs. This should be ready to send to a factory TODAY.`;

    const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    if (mockupImage) {
      const match = (mockupImage as string).match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        contentParts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      }
    }
    contentParts.push({ text: userPrompt });

    const requestBody = {
      contents: [{ role: 'user', parts: contentParts }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { maxOutputTokens: 8192 },
    };

    const bodyStr = JSON.stringify(requestBody);

    for (let i = 0; i < keys.length; i++) {
      const idx = (keyIndex + i) % keys.length;
      const apiKey = keys[idx];

      const res = await fetch(
        `${GEMINI_BASE}/${MODEL}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: bodyStr }
      );

      if (res.ok) {
        keyIndex = idx + 1;
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!text) {
          return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 });
        }

        try {
          const techPack = parseAIJSON(text);
          return NextResponse.json({ techPack });
        } catch {
          return NextResponse.json({ error: 'Failed to parse tech pack data', raw: text }, { status: 500 });
        }
      }

      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message || '';
      const isQuota = res.status === 429 || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate');
      if (isQuota && i < keys.length - 1) continue;
      return NextResponse.json({ error: msg || `AI error (${res.status})` }, { status: res.status });
    }

    return NextResponse.json({ error: 'All AI keys are rate-limited.' }, { status: 429 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Tech pack generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
