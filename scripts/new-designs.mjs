import fs from 'fs';
import path from 'path';

const BRAND_DIR = 'C:/Users/laure/style-ai/public/brand';
const API_URL = 'https://api.airforce/v1/images/generations';

const DESIGNS = [
  {
    id: '22',
    prompt: 'Professional flat-lay product photo of black oversized cropped windbreaker jacket with adjustable drawstring waistband and elastic toggle hem, half-zip front, high funnel collar, lightweight waterproof nylon shell, boxy cropped fit hitting at the waist, velcro cuff adjusters, hidden hood in collar, on clean white background, studio lighting, fashion product photography, streetwear',
  },
  {
    id: '23',
    prompt: 'Professional flat-lay product photo of navy blue and white color-blocked oversized windbreaker with adjustable waistband cinch, full zip front, retro side stripe detailing, mesh lining visible at collar, oversized boxy fit, zippered chest pocket, elastic cuffs, on clean white background, studio lighting, fashion product photography, vintage sportswear streetwear',
  },
  {
    id: '24',
    prompt: 'Professional flat-lay product photo of stone gray oversized cropped Gore-Tex waterproof jacket, boxy silhouette cropped above the hip, sealed seams, hidden hood with brim, large flap cargo pockets, adjustable velcro cuffs, technical waterproof membrane fabric, on clean white background, studio lighting, fashion product photography, techwear streetwear',
  },
  {
    id: '25',
    prompt: 'Professional flat-lay product photo of black oversized graphic t-shirt with large vintage Japanese drift car illustration printed across the front in white and red ink, JDM sports car artwork, washed heavyweight cotton, boxy dropped shoulder fit, ribbed crew neck, on clean white background, studio lighting, fashion product photography, streetwear',
  },
  {
    id: '26',
    prompt: 'Professional flat-lay product photo of white oversized graphic t-shirt with large classic American muscle car illustration printed on the back in black ink, vintage car show poster style artwork, heavyweight 300 GSM cotton, massively oversized boxy fit, raw hem, on clean white background, studio lighting, fashion product photography, streetwear',
  },
  {
    id: '27',
    prompt: 'Professional flat-lay product photo of black super baggy wide-leg jeans, extremely relaxed oversized fit, heavy raw denim, five pocket styling, contrast white topstitching, ultra wide barrel leg silhouette, low crotch drop, on clean white background, studio lighting, fashion product photography, JNCO style 90s streetwear',
  },
  {
    id: '28',
    prompt: 'Professional flat-lay product photo of light blue washed super baggy carpenter jeans, ultra wide leg, double knee reinforcement, hammer loop and tool pockets on right leg, distressed wash with whiskering, contrast yellow topstitching, oversized relaxed fit, on clean white background, studio lighting, fashion product photography, workwear streetwear',
  },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateImage(design) {
  const output = path.join(BRAND_DIR, `design_${design.id}.jpg`);
  console.log(`\n=== Design ${design.id} ===`);

  for (let attempt = 1; attempt <= 25; attempt++) {
    if (attempt > 1) {
      const wait = 5000 + attempt * 3000;
      console.log(`  Waiting ${wait / 1000}s...`);
      await sleep(wait);
    }

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'flux-2-klein-4b',
          prompt: design.prompt,
          size: '1024x1024',
          n: 1,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (res.status === 429) {
        console.log(`  Attempt ${attempt}: Rate limited (429)`);
        continue;
      }

      if (!res.ok) {
        console.log(`  Attempt ${attempt}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const imgUrl = data?.data?.[0]?.url;
      const b64 = data?.data?.[0]?.b64_json;

      if (b64) {
        fs.writeFileSync(output, Buffer.from(b64, 'base64'));
        const size = fs.statSync(output).size;
        if (size > 100000) {
          console.log(`  SUCCESS (b64): ${size} bytes`);
          return true;
        }
        continue;
      }

      if (!imgUrl) {
        console.log(`  Attempt ${attempt}: No URL in response`);
        continue;
      }

      const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(30000) });
      if (!imgRes.ok) {
        console.log(`  Attempt ${attempt}: Image download failed (${imgRes.status})`);
        continue;
      }

      const buffer = Buffer.from(await imgRes.arrayBuffer());

      if (buffer.length < 280000) {
        console.log(`  Attempt ${attempt}: Image too small (${buffer.length} bytes), likely error page`);
        continue;
      }

      if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
        console.log(`  Attempt ${attempt}: Not a valid JPEG`);
        continue;
      }

      fs.writeFileSync(output, buffer);
      console.log(`  SUCCESS: ${buffer.length} bytes`);
      return true;
    } catch (err) {
      console.log(`  Attempt ${attempt}: ${err.message}`);
    }
  }

  console.log(`  FAILED after 25 attempts`);
  return false;
}

async function main() {
  console.log('=== Generating 7 new designs (22-28) ===\n');

  let success = 0;
  for (const design of DESIGNS) {
    const ok = await generateImage(design);
    if (ok) success++;
    await sleep(15000);
  }

  console.log(`\n=== DONE: ${success}/${DESIGNS.length} generated ===`);
}

main();
