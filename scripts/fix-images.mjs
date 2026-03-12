import fs from 'fs';
import path from 'path';

const BRAND_DIR = 'C:/Users/laure/style-ai/public/brand';
const API_URL = 'https://api.airforce/v1/images/generations';

const DESIGNS = [
  {
    id: '06',
    prompt: 'Professional flat-lay product photo of matte black oversized cropped puffer vest, boxy silhouette, high collar with snap closure, quilted horizontal baffles, water-resistant nylon shell, two front welt pockets, on clean white background, studio lighting, fashion product photography',
  },
  {
    id: '07',
    prompt: 'Professional flat-lay product photo of khaki tan baggy double-knee work pants, ultra wide leg relaxed fit, heavy cotton canvas, reinforced double-layer knee panels, hammer loop, tool pockets, wide belt loops, brass zipper, carpenter style, on clean white background, studio lighting, fashion product photography',
  },
  {
    id: '08',
    prompt: 'Professional flat-lay product photo of charcoal dark gray oversized full-zip hoodie, heavyweight French terry, relaxed boxy fit with drop shoulders, oversized hood, heavy metal zipper, ribbed cuffs and hem, on clean white background, studio lighting, fashion product photography',
  },
  {
    id: '11',
    prompt: 'Professional flat-lay product photo of washed indigo blue super baggy wide-leg jeans, extremely relaxed oversized fit, raw selvedge denim, five pocket western styling, contrast orange topstitching, barrel leg silhouette, on clean white background, studio lighting, fashion product photography',
  },
  {
    id: '12',
    prompt: 'Professional flat-lay product photo of forest green oversized satin bomber jacket, boxy relaxed fit, ribbed collar cuffs and hem in black, quilted orange lining visible at collar, two front slant pockets, brass zipper, MA-1 military inspired, on clean white background, studio lighting, fashion product photography',
  },
  {
    id: '21',
    prompt: 'Professional flat-lay product photo of heather gray baggy sweatpants with large AK-47 rifle graphic printed vertically going up the right leg in black ink, clean Burberry tartan plaid double waistband, no elastic cuffs with open straight leg hem, heavyweight cotton fleece, oversized relaxed fit, no logos on sides, on clean white background, studio lighting, fashion product photography, streetwear',
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
        console.log(`  Attempt ${attempt}: b64 image too small (${size})`);
        continue;
      }

      if (!imgUrl) {
        console.log(`  Attempt ${attempt}: No URL in response`);
        continue;
      }

      // Download from URL
      const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(30000) });
      if (!imgRes.ok) {
        console.log(`  Attempt ${attempt}: Image download failed (${imgRes.status})`);
        continue;
      }

      const buffer = Buffer.from(await imgRes.arrayBuffer());

      // Validate: must be >280KB (error screenshots are ~250KB) and start with JPEG magic
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
  console.log('=== Regenerating 5 broken images + new design 21 ===\n');

  let success = 0;
  for (const design of DESIGNS) {
    const ok = await generateImage(design);
    if (ok) success++;
    // Wait between designs
    await sleep(15000);
  }

  console.log(`\n=== DONE: ${success}/${DESIGNS.length} generated ===`);
}

main();
