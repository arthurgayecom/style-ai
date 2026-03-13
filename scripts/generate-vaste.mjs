#!/usr/bin/env node
/**
 * VASTE Collection Generator
 * Generates a full streetwear collection via FLUX image models.
 * Each design is a carefully prompted, ultra-baggy oversized garment.
 */

import fs from 'fs';
import path from 'path';

const AIRFORCE_API_URL = 'https://api.airforce/v1/images/generations';
const OUTPUT_DIR = path.resolve('public/brand/vaste');

const IMAGE_MODELS = ['flux-realism', 'flux', 'flux-2-klein-4b'];

// ── Retry logic per model ──
async function tryModel(model, prompt, width, height) {
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1500 + attempt * 1500));
    try {
      const res = await fetch(AIRFORCE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, size: `${width}x${height}`, n: 1 }),
      });
      if (res.status === 429) { console.log(`  [${model}] rate limited, retry ${attempt + 1}...`); continue; }
      if (!res.ok) return null; // skip to next model
      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (b64) return Buffer.from(b64, 'base64');
      const url = data?.data?.[0]?.url;
      if (url) {
        const imgRes = await fetch(url);
        if (imgRes.ok) return Buffer.from(await imgRes.arrayBuffer());
      }
    } catch (e) {
      console.log(`  [${model}] network error: ${e.message}`);
    }
  }
  return null;
}

// ── Generate image with model cascade ──
async function generateImage(prompt, width = 864, height = 1152) {
  for (const model of IMAGE_MODELS) {
    console.log(`  Trying ${model}...`);
    const buf = await tryModel(model, prompt, width, height);
    if (buf) { console.log(`  ✓ Generated with ${model}`); return buf; }
  }
  return null;
}

// ── CLI args ──
const args = process.argv.slice(2);
const singleId = args.find(a => a.startsWith('--id='))?.split('=')[1]?.toUpperCase();
const forceOverwrite = args.includes('--force');

// ── Brand style prefix for consistency ──
const BRAND_STYLE = `professional fashion product photography, studio lighting, clean white background, full garment displayed on model, high-end streetwear lookbook photo, ultra sharp detail, 8k quality`;
const BAGGY_CORE = `ultra-baggy oversized silhouette, extremely wide legs, exaggerated volume, pooling fabric at ankles, relaxed drop-crotch`;

// ── Outfit isolation rules (prevents model wearing matching/distracting items) ──
const OUTFIT_BOTTOMS = `model wearing ONLY a plain solid white crewneck t-shirt tucked in and simple white sneakers, NO jacket NO hoodie NO vest NO matching set NO hat NO bag, front-facing natural relaxed pose`;
const OUTFIT_TOPS = `model wearing simple blue jeans on bottom and simple white sneakers, NO matching pants NO hat NO bag, front-facing natural relaxed pose`;
const OUTFIT_JACKETS = `model wearing plain solid white crewneck t-shirt underneath simple blue jeans and white sneakers, NO matching set, front-facing natural relaxed pose`;

function getOutfitRule(garmentType) {
  const lower = garmentType.toLowerCase();
  if (/pant|jean|jogger|cargo|short|sweat/.test(lower)) return OUTFIT_BOTTOMS;
  if (/jacket|bomber|coat|windbreaker|vest|parka/.test(lower)) return OUTFIT_JACKETS;
  return OUTFIT_TOPS;
}

// ── Collection Designs ──
const DESIGNS = [
  // ═══════════════════════════════════════════
  // SWEATPANTS (10 designs)
  // ═══════════════════════════════════════════
  {
    id: 'SW01',
    garmentType: 'Sweatpants',
    name: 'Contrast Panel Sweats',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, heather grey ultra-wide-leg sweatpants on model, black contrast elastic waistband with drawstring, curved black side panels with three white sport stripes running from hip to ankle, deep slant pockets, open straight-cut hem dragging on floor, premium heavyweight french terry cotton, no cuffs no elastic at ankles, model wearing white sneakers`,
    description: 'Heather grey ultra-wide sweatpants with black contrast waistband and curved side stripe panels. Open hem, heavyweight terry.',
    instructions: 'Grey French terry, 340 GSM. Black contrast elastic waistband. Curved black panels on outer leg with 3 white stripes. Open hem. Deep slant pockets. Drawstring with metal aglets.',
  },
  {
    id: 'SW02',
    garmentType: 'Sweatpants',
    name: 'Plaid Waistband Sweats',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, heather grey ultra-wide-leg sweatpants on female model, red tartan plaid fabric waistband showing above elastic, three white vertical stripes running down outer side seam, small embroidered heart logo on left thigh, grey drawstring, open hem straight cut at ankles pooling on floor, premium heavyweight cotton fleece, no cuffs`,
    description: 'Heather grey wide-leg sweats with exposed red tartan plaid waistband detail. White side stripes and embroidered heart logo.',
    instructions: 'Grey cotton fleece, 320 GSM. Double waistband: inner elastic + outer red tartan plaid band. 3 white side stripes. Embroidered heart logo left thigh. Open hem.',
  },
  {
    id: 'SW03',
    garmentType: 'Sweatpants',
    name: 'Midnight Drape Sweats',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, solid black ultra-wide-leg sweatpants on model, matte black heavyweight fleece fabric, double layered waistband with visible inner grey layer, gunmetal drawstring hardware, oversized kangaroo pocket on front, open straight-cut hem dragging on ground, minimal clean design no logos visible, model wearing black shoes`,
    description: 'All-black ultra-wide sweatpants with double-layered waistband showing grey inner layer. Kangaroo front pocket. Clean minimal.',
    instructions: 'Black heavyweight fleece, 360 GSM. Double waistband (black outer + heather grey inner). Front kangaroo pocket. Gunmetal aglets. Open hem. No visible branding.',
  },
  {
    id: 'SW04',
    garmentType: 'Sweatpants',
    name: 'Cream Cloud Sweats',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, cream off-white ultra-wide-leg sweatpants on model, brown contrast stitching throughout, wide brown elastic waistband with cream drawstring, two deep front slant pockets, small embossed tonal logo on back waistband, open hem puddling on floor, premium 100% cotton brushed fleece`,
    description: 'Cream off-white ultra-wide sweats with brown contrast stitching and brown waistband. Tonal embossed branding.',
    instructions: 'Cream/off-white brushed fleece, 340 GSM. Brown contrast topstitching. Brown elastic waistband. Cream drawstring. Embossed tonal logo back waistband. Open hem.',
  },
  {
    id: 'SW05',
    garmentType: 'Sweatpants',
    name: 'Split Tone Sweats',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, two-tone ultra-wide-leg sweatpants on model, left leg heather grey right leg black, split down center front and back, black elastic waistband with dual drawstrings, open hem dragging, no logos, extreme width at knee and ankle, heavyweight cotton`,
    description: 'Two-tone split design — grey left leg, black right leg. Extreme width. Black waistband with dual drawstrings.',
    instructions: 'Split construction: left panel heather grey, right panel black. Both 320 GSM fleece. Black waistband. Dual drawstrings. Open hem. No visible logos.',
  },
  {
    id: 'SW06',
    garmentType: 'Sweatpants',
    name: 'Triple Stripe Drape Sweats',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, navy blue ultra-wide-leg sweatpants on model, three thick white stripes running from waistband to open hem on outer side of each leg, navy elastic waistband with white drawstring, deep side pockets, no cuffs open hem dragging, premium heavyweight french terry`,
    description: 'Navy blue ultra-wide sweats with bold white triple stripes from waist to hem. Open hem, deep pockets.',
    instructions: 'Navy French terry, 340 GSM. Three 1.5cm white stripes on outer seam both legs. Navy waistband. White drawstring with metal tips. Open hem. Deep side pockets.',
  },
  {
    id: 'SW07',
    garmentType: 'Sweatpants',
    name: 'Stone Wash Fleece Sweats',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, stone washed sage green ultra-wide-leg sweatpants on model, vintage distressed wash effect, raw edge waistband with exposed elastic and drawstring, no side seam pockets only back patch pocket, open frayed hem, garment-dyed heavyweight cotton, worn-in vintage look`,
    description: 'Stone-washed sage green fleece sweats with raw-edge waistband and frayed open hem. Vintage garment-dyed finish.',
    instructions: 'Sage green garment-dyed fleece, 320 GSM. Stone wash finish. Raw-edge cut waistband. Exposed elastic + drawstring. Back patch pocket only. Frayed open hem.',
  },
  {
    id: 'SW08',
    garmentType: 'Sweatpants',
    name: 'Archive Panel Sweats',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, heather grey ultra-wide-leg sweatpants on model, large brown corduroy fabric panels inserted on both outer thighs as decorative patches, grey elastic waistband with grey drawstring, deep pockets, open straight hem, mixed material design streetwear, premium cotton fleece body with corduroy inserts`,
    description: 'Heather grey sweats with brown corduroy panel inserts on outer thighs. Mixed material design. Open hem.',
    instructions: 'Grey fleece body 320 GSM + brown corduroy panel inserts (outer thigh, 20x30cm). Grey waistband. Grey drawstring. Deep pockets. Open hem.',
  },
  {
    id: 'SW09',
    garmentType: 'Sweatpants',
    name: 'Double Layer Sweats',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, charcoal dark grey ultra-wide-leg sweatpants on model, double layered waistband with burgundy red inner layer visible folded over, matching burgundy drawstring, charcoal body extremely wide, subtle tonal pinstripe texture in fabric, open hem, deep pockets`,
    description: 'Charcoal ultra-wide sweats with burgundy double waistband detail. Tonal pinstripe texture. Open hem.',
    instructions: 'Charcoal pinstripe fleece, 340 GSM. Double waistband (charcoal outer + burgundy inner fold). Burgundy drawstring. Open hem. Deep slant pockets.',
  },
  {
    id: 'SW10',
    garmentType: 'Sweatpants',
    name: 'Chalk White Drape Sweats',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, chalk white ultra-wide-leg sweatpants on model, clean all-white minimal design, thick black drawstring as only contrast, deep front pockets, open straight hem pooling on white sneakers, premium heavyweight brushed cotton fleece, no logos no graphics pure white`,
    description: 'Pure chalk white ultra-wide sweats. Minimal design with only a black drawstring for contrast. Premium brushed cotton.',
    instructions: 'Chalk white brushed fleece, 360 GSM. Black drawstring only contrast element. Deep front pockets. Open hem. Zero branding visible.',
  },

  // ═══════════════════════════════════════════
  // JEANS (8 designs)
  // ═══════════════════════════════════════════
  {
    id: 'JN01',
    garmentType: 'Jeans',
    name: 'Washed Olive Baggy Jeans',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, olive green acid-washed ultra-baggy jeans on model, extremely wide straight legs, low-rise waist with brown leather belt, vintage distressed wash with yellow-green tint, five-pocket design, no taper at ankle, raw unhemmed bottom edge dragging on ground, thick rigid denim, 90s skater silhouette`,
    description: 'Olive acid-washed ultra-baggy jeans with raw unhemmed edges. Vintage distressed finish. Five-pocket.',
    instructions: '14oz rigid denim, olive acid wash. Ultra-wide straight leg. Low rise. Five-pocket. Raw unhemmed edge. Brown leather patch on back.',
  },
  {
    id: 'JN02',
    garmentType: 'Jeans',
    name: 'Faded Black Wide Jeans',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, faded black washed ultra-wide-leg jeans on model, charcoal grey faded wash effect especially on thighs and knees, extremely wide straight legs from hip to ankle, five-pocket construction, no taper, raw selvedge hem, heavyweight denim, model wearing tan suede boots`,
    description: 'Faded black-to-charcoal washed ultra-wide jeans. Raw selvedge hem. Heavyweight rigid denim.',
    instructions: '15oz rigid denim, faded black wash. Ultra-wide leg no taper. Five-pocket. Raw selvedge hem. No stretch.',
  },
  {
    id: 'JN03',
    garmentType: 'Jeans',
    name: 'Double Knee Work Jeans',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, light blue washed ultra-baggy carpenter jeans on model, double-layered reinforced knee patches in same denim, hammer loop on right side, wide straight legs, carpenter tool pocket on right thigh, whisker wash at thighs, no taper, open hem dragging, workwear streetwear fusion`,
    description: 'Light wash ultra-baggy carpenter jeans with double knee reinforcement. Hammer loop. Tool pocket. Workwear fusion.',
    instructions: '14oz light wash denim. Double knee panels. Right-side hammer loop + tool pocket. Wide straight leg. Open hem. Whisker wash.',
  },
  {
    id: 'JN04',
    garmentType: 'Jeans',
    name: 'Indigo Raw Wide Jeans',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, deep indigo raw unwashed ultra-wide-leg jeans on model, dark crisp indigo color with no fading, extremely wide straight legs, chain stitch hem visible, red selvedge line visible on cuff turn-up, five pocket, leather back patch, clean rigid look`,
    description: 'Deep indigo raw unwashed ultra-wide jeans. Chain stitch hem. Red selvedge line. Rigid and crisp.',
    instructions: '16oz raw unwashed selvedge denim. Deep indigo. Ultra-wide leg. Chain stitch hem. Red selvedge ID. Leather back patch. Five-pocket.',
  },
  {
    id: 'JN05',
    garmentType: 'Jeans',
    name: 'Mud Wash Balloon Jeans',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, brown mud-wash ultra-wide balloon-leg jeans on model, brown-tinted vintage wash with heavy fading at thighs, extremely voluminous balloon silhouette, mid-rise, five-pocket, open hem puddling at ankles, thick rigid denim, earthy tone vintage aesthetic`,
    description: 'Brown mud-wash balloon jeans with extreme volume. Heavy fade at thighs. Earthy vintage aesthetic.',
    instructions: '14oz denim, brown mud wash. Balloon-leg silhouette. Heavy thigh fade. Five-pocket. Open hem. Mid-rise.',
  },
  {
    id: 'JN06',
    garmentType: 'Jeans',
    name: 'Bleach Splatter Wide Jeans',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, medium blue ultra-wide-leg jeans on model with random bleach splatter marks creating white spots and drips, distressed with small rips at knees, extremely wide straight legs, five-pocket, open raw hem, artistic custom look, vintage punk streetwear`,
    description: 'Medium blue ultra-wide jeans with artistic bleach splatter treatment. Distressed knee rips. Raw hem.',
    instructions: '14oz medium wash denim. Custom bleach splatter treatment. Small knee distressing. Wide straight leg. Raw hem. Five-pocket.',
  },
  {
    id: 'JN07',
    garmentType: 'Jeans',
    name: 'Snow Wash Parachute Jeans',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, snow white washed ultra-wide-leg jeans on model, very light wash almost white with subtle blue tint remaining, extremely wide parachute-like legs, drawstring at waist instead of belt, elastic ankle option but worn open and dragging, lightweight denim`,
    description: 'Snow-white washed ultra-wide parachute jeans with drawstring waist. Light and flowing.',
    instructions: '10oz lightweight denim, extreme snow wash. Drawstring waist. Parachute-width legs. Optional ankle drawstring (worn open). Ultra-light finish.',
  },
  {
    id: 'JN08',
    garmentType: 'Jeans',
    name: 'Charcoal Stripe Wide Jeans',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, charcoal grey ultra-wide-leg jeans on model, two thin white pinstripes running down outer seam of each leg, dark grey wash, five-pocket, open hem, thick heavyweight denim, subtle texture, model wearing black leather shoes`,
    description: 'Charcoal grey ultra-wide jeans with white pinstripes on outer seam. Heavyweight denim. Open hem.',
    instructions: '15oz charcoal wash denim. Twin white pinstripes on outer seam. Five-pocket. Open hem. Thick rigid construction.',
  },

  // ═══════════════════════════════════════════
  // CARGO PANTS (8 designs)
  // ═══════════════════════════════════════════
  {
    id: 'CG01',
    garmentType: 'Cargo Pants',
    name: 'Woodland Camo Cargos',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, woodland green camouflage ultra-baggy cargo pants on model, traditional green-brown-black camo print, large bellows cargo pockets on both thighs, studded leather belt with hanging chain, wide straight legs, ankle gathered slightly but not cuffed, heavy cotton ripstop fabric, military surplus inspired`,
    description: 'Woodland camo ultra-baggy cargos with large bellows pockets. Leather belt with chain. Military surplus vibe.',
    instructions: 'Woodland camo ripstop cotton, 280 GSM. Large bellows cargo pockets (both thighs). Belt loops. Wide straight leg. Optional ankle gather. Double-needle stitching.',
  },
  {
    id: 'CG02',
    garmentType: 'Cargo Pants',
    name: 'Black Utility Cargos',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, solid black ultra-wide cargo pants on model, multiple oversized cargo pockets — two on thighs two below knees, black snap-button pocket flaps, black nylon webbing belt with metal buckle, open hem dragging, heavy cotton twill fabric, tactical streetwear look`,
    description: 'All-black ultra-wide cargos with 4 oversized cargo pockets. Snap-button flaps. Nylon webbing belt. Tactical.',
    instructions: 'Black cotton twill, 300 GSM. 4 cargo pockets (2 thigh + 2 below knee). Snap-button flaps. Nylon webbing belt. Open hem.',
  },
  {
    id: 'CG03',
    garmentType: 'Cargo Pants',
    name: 'Sand Storm Cargos',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, sand beige khaki ultra-baggy cargo pants on model, washed cotton canvas fabric, two large flap cargo pockets on thighs with button closure, additional small zip pocket on left shin, wide straight legs, open hem, tan drawstring at waist, desert military aesthetic`,
    description: 'Sand beige washed canvas ultra-baggy cargos. Large thigh flap pockets + shin zip pocket. Desert military.',
    instructions: 'Sand beige washed canvas, 280 GSM. 2 large thigh flap pockets + 1 shin zip pocket. Drawstring waist. Wide leg. Open hem.',
  },
  {
    id: 'CG04',
    garmentType: 'Cargo Pants',
    name: 'Olive Parachute Cargos',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, olive green ultra-wide parachute cargo pants on model, lightweight nylon fabric with slight sheen, multiple small zip pockets scattered on legs, drawstring waist and ankle drawstrings, extreme width billowing out, toggle adjusters at knees, techwear military fusion`,
    description: 'Olive parachute cargos in lightweight nylon. Multiple zip pockets. Drawstring waist + ankles. Techwear military.',
    instructions: 'Olive nylon ripstop, 180 GSM. Multiple zip pockets. Drawstring waist + ankle toggles. Knee toggles. Extreme wide parachute cut.',
  },
  {
    id: 'CG05',
    garmentType: 'Cargo Pants',
    name: 'Washed Grey Cargos',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, washed grey ultra-baggy cargo pants on model, garment-dyed faded grey cotton, two angled cargo pockets on thighs with velcro flaps, contrast white topstitching throughout, wide straight legs, open hem, drawstring waist with metal aglets, vintage military surplus feel`,
    description: 'Garment-dyed faded grey cargos with angled thigh pockets. White contrast stitching. Vintage surplus feel.',
    instructions: 'Garment-dyed grey cotton twill, 260 GSM. Angled thigh cargo pockets with velcro. White contrast stitching. Drawstring waist. Open hem.',
  },
  {
    id: 'CG06',
    garmentType: 'Cargo Pants',
    name: 'Desert Camo Cargos',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, desert tri-color camouflage ultra-baggy cargo pants on model, sand tan brown camo pattern, large cargo pockets on both legs, fabric belt with military buckle, wide straight legs bunching at ankles, heavy cotton, combat boot styling`,
    description: 'Desert tri-color camo ultra-baggy cargos. Large pockets. Military fabric belt. Heavy cotton.',
    instructions: 'Desert camo cotton ripstop, 280 GSM. Tri-color (sand/tan/brown). Large cargo pockets. Military fabric belt. Wide leg open hem.',
  },
  {
    id: 'CG07',
    garmentType: 'Cargo Pants',
    name: 'Navy Tech Cargos',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, dark navy blue ultra-wide technical cargo pants on model, water-resistant nylon-cotton blend fabric, sleek zip cargo pockets on thighs with reflective zip pulls, minimalist techwear design, hidden drawstring waist, open hem, clean modern tactical look`,
    description: 'Dark navy tech cargos with zip cargo pockets and reflective pulls. Water-resistant. Minimalist techwear.',
    instructions: 'Navy nylon-cotton blend, 240 GSM, DWR coating. Zip cargo pockets with reflective pulls. Hidden drawstring waist. Open hem. Minimalist.',
  },
  {
    id: 'CG08',
    garmentType: 'Cargo Pants',
    name: 'Brown Earth Cargos',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, dark brown chocolate ultra-baggy cargo pants on model, heavy washed cotton canvas, two large square cargo pockets on thighs with button flaps, hammer loop on right side, wide straight legs, open hem pooling, workwear carpenter cargo hybrid, brown leather belt`,
    description: 'Dark brown washed canvas ultra-baggy cargos. Square thigh pockets. Hammer loop. Workwear-cargo hybrid.',
    instructions: 'Brown washed canvas, 300 GSM. Square cargo pockets with button flaps. Hammer loop right side. Wide leg. Open hem.',
  },

  // ═══════════════════════════════════════════
  // JACKETS & HOODIES (10 designs)
  // ═══════════════════════════════════════════
  {
    id: 'JK01',
    garmentType: 'Jacket',
    name: 'Cream Varsity Bomber',
    prompt: `${BRAND_STYLE}, oversized cream off-white varsity bomber jacket on model, cropped oversized fit hitting at waist, large cursive script embroidered text on chest, full zip front, cream satin body, ribbed cuffs and hem in cream, puffed sleeves, model wearing the jacket open over white tee, clean premium look`,
    description: 'Cream varsity bomber with cursive script embroidery. Cropped oversized fit. Satin body with ribbed trim.',
    instructions: 'Cream satin shell, polyester fill. Cropped oversized. Cursive script chest embroidery. Full zip. Ribbed cuffs + hem in cream. Puffed sleeves.',
  },
  {
    id: 'JK02',
    garmentType: 'Jacket',
    name: 'Khaki Multi-Pocket Jacket',
    prompt: `${BRAND_STYLE}, oversized khaki tan multi-pocket utility jacket on model, 4 large chest flap pockets, boxy oversized silhouette, zip front with storm flap, standing collar, crinkled nylon fabric with slight sheen, model wearing over grey hoodie layered underneath, military surplus inspired`,
    description: 'Khaki multi-pocket utility jacket with 4 chest pockets. Crinkled nylon. Boxy oversized fit over hoodie.',
    instructions: 'Khaki crinkled nylon shell. 4 flap chest pockets. Zip + storm flap. Standing collar. Boxy oversized cut. Layering-friendly.',
  },
  {
    id: 'JK03',
    garmentType: 'Jacket',
    name: 'Dark Denim Trucker Jacket',
    prompt: `${BRAND_STYLE}, oversized dark washed black denim trucker jacket on model, classic trucker jacket silhouette but heavily oversized and boxy, two chest flap pockets, button front with metal buttons, model wearing over grey hoodie with hood visible, faded charcoal-black wash, raw hem at bottom`,
    description: 'Oversized dark wash denim trucker jacket. Boxy fit. Button front. Worn over grey hoodie. Raw hem.',
    instructions: 'Charcoal-black washed 14oz denim. Oversized trucker cut. 2 chest flap pockets. Metal button front. Raw hem bottom.',
  },
  {
    id: 'JK04',
    garmentType: 'Hoodie',
    name: 'Grey Heavyweight Zip Hoodie',
    prompt: `${BRAND_STYLE}, oversized heather grey heavyweight zip-up hoodie on model, extremely oversized boxy fit, large kangaroo pocket, full zip front, thick drawstring hood, ribbed cuffs and hem, heavy 400gsm fleece fabric, clean no logos minimal design, model wearing open showing white tee underneath`,
    description: 'Heather grey heavyweight zip hoodie. Extreme oversized fit. 400 GSM fleece. Clean minimal, no logos.',
    instructions: 'Heather grey 400 GSM heavyweight fleece. Oversized boxy fit. Full zip. Kangaroo pocket. Thick drawstring hood. Ribbed cuffs/hem. No branding.',
  },
  {
    id: 'JK05',
    garmentType: 'Hoodie',
    name: 'Black Essential Pullover Hoodie',
    prompt: `${BRAND_STYLE}, oversized solid black pullover hoodie on model, extremely baggy oversized silhouette, large front kangaroo pocket, thick drawstring hood covering model head slightly, dropped shoulders, extra long sleeves covering hands, premium heavy cotton fleece, clean minimal no logos`,
    description: 'All-black oversized pullover hoodie. Dropped shoulders, extra-long sleeves. Heavyweight fleece. No logos.',
    instructions: 'Black 380 GSM cotton fleece. Extreme oversized. Dropped shoulders. Extended sleeves. Kangaroo pocket. Thick drawstrings. No branding.',
  },
  {
    id: 'JK06',
    garmentType: 'Jacket',
    name: 'Olive Flight Bomber',
    prompt: `${BRAND_STYLE}, oversized olive green MA-1 flight bomber jacket on model, classic bomber silhouette but very oversized, bright orange lining visible at collar and partially at zip, front zip with two slant zip pockets, ribbed collar cuffs and hem in olive, slightly cropped length, nylon shell`,
    description: 'Olive MA-1 bomber jacket, oversized. Orange satin lining. Zip front. Ribbed trim. Classic military flight.',
    instructions: 'Olive nylon shell, orange satin lining. Oversized MA-1 cut. Zip front + 2 slant pockets. Ribbed collar/cuffs/hem. Slightly cropped.',
  },
  {
    id: 'JK07',
    garmentType: 'Jacket',
    name: 'Brown Leather Biker Jacket',
    prompt: `${BRAND_STYLE}, oversized dark brown vintage leather biker jacket on model, aged distressed brown leather, asymmetric zip front, wide notch lapel collar, zip pockets on chest and waist, oversized boxy fit, belted hem, silver hardware, model wearing over white tee, vintage 80s feel`,
    description: 'Distressed brown leather biker jacket. Asymmetric zip. Silver hardware. Oversized boxy with belted hem.',
    instructions: 'Aged brown leather (or PU). Asymmetric zip. Notch lapel. 4 zip pockets. Belt hem. Silver hardware. Oversized.',
  },
  {
    id: 'JK08',
    garmentType: 'Hoodie',
    name: 'Sage Double Layer Hoodie',
    prompt: `${BRAND_STYLE}, oversized sage green pullover hoodie on model, double-layered construction with darker green inner layer visible at hem and cuffs, extremely baggy, large kangaroo pocket, thick natural-colored drawstrings, dropped shoulders, garment-dyed vintage wash look`,
    description: 'Sage green double-layer hoodie with darker inner showing at hem/cuffs. Garment-dyed vintage wash.',
    instructions: 'Sage green garment-dyed 360 GSM fleece. Double layer (darker sage inner). Kangaroo pocket. Thick natural drawstrings. Dropped shoulders.',
  },
  {
    id: 'JK09',
    garmentType: 'Jacket',
    name: 'Cream Puffer Vest',
    prompt: `${BRAND_STYLE}, oversized cream off-white puffer vest on model, puffy quilted panels, standing collar, snap-button front closure, two large hand-warmer pockets, oversized boxy silhouette, model wearing over black hoodie with hood out, premium down-filled look`,
    description: 'Cream oversized puffer vest. Quilted panels. Snap front. Standing collar. Layered over hoodie.',
    instructions: 'Cream nylon shell, polyester fill. Quilted panels. Snap-button front. Standing collar. 2 hand-warmer pockets. Boxy oversized.',
  },
  {
    id: 'JK10',
    garmentType: 'Jacket',
    name: 'Washed Denim Chore Coat',
    prompt: `${BRAND_STYLE}, oversized medium-wash blue denim chore coat on model, boxy straight silhouette, three-pocket front design with large patch pockets, button front with brass buttons, corduroy collar in brown, mid-thigh length, heavy washed denim, French workwear inspired, model wearing over white tee`,
    description: 'Medium-wash denim chore coat. Boxy oversized. Patch pockets. Brown corduroy collar. French workwear.',
    instructions: 'Medium wash 14oz denim. Chore coat cut. 3 patch pockets. Brass buttons. Brown corduroy collar. Mid-thigh length.',
  },

  // ═══════════════════════════════════════════
  // TEES & SHORTS (6 designs)
  // ═══════════════════════════════════════════
  {
    id: 'TE01',
    garmentType: 'T-Shirt',
    name: 'Heavyweight Box Tee',
    prompt: `${BRAND_STYLE}, oversized boxy white heavyweight t-shirt on model, extremely oversized fit falling past waist, thick heavy cotton fabric with visible texture, dropped shoulders, slightly longer back hem, clean no graphics no logos pure white, model wearing with baggy jeans, premium blank tee look`,
    description: 'Pure white heavyweight box tee. Extreme oversized. Dropped shoulders. Longer back hem. No graphics.',
    instructions: 'White 280 GSM combed cotton. Extreme oversized boxy. Dropped shoulders. Split longer-back hem. No branding. Premium blank.',
  },
  {
    id: 'TE02',
    garmentType: 'T-Shirt',
    name: 'Black Graphic Back Print Tee',
    prompt: `${BRAND_STYLE}, oversized boxy black t-shirt on model shown from back view, large white distressed vintage graphic print on back showing gothic cathedral architecture illustration, small logo on front chest, extremely oversized, thick heavy cotton, dropped shoulders`,
    description: 'Black oversized tee with large gothic cathedral back print. Small front logo. Distressed vintage graphics.',
    instructions: 'Black 280 GSM cotton. Large gothic back print (DTG). Small chest logo. Extreme oversized. Dropped shoulders.',
  },
  {
    id: 'TE03',
    garmentType: 'T-Shirt',
    name: 'Washed Earth Tone Tee',
    prompt: `${BRAND_STYLE}, oversized boxy faded olive green t-shirt on model, garment-dyed vintage wash with uneven fading, thick heavy cotton, dropped shoulders, slightly cropped hitting at hip, raw rolled hem edges, vintage military surplus tee aesthetic, no graphics`,
    description: 'Faded olive garment-dyed oversized tee. Vintage wash. Raw rolled hem. Military surplus aesthetic.',
    instructions: 'Olive garment-dyed 260 GSM cotton. Vintage wash. Oversized boxy. Dropped shoulders. Raw rolled hem. No graphics.',
  },
  {
    id: 'SH01',
    garmentType: 'Shorts',
    name: 'Grey Baggy Sweat Shorts',
    prompt: `${BRAND_STYLE}, ultra-baggy heather grey sweat shorts on model, extremely wide and long hitting below knee, black elastic waistband with drawstring, deep side pockets, heavy french terry cotton, open hem with raw edge, same ultra-wide silhouette as the sweatpants but shorts length`,
    description: 'Heather grey ultra-baggy below-knee sweat shorts. Black waistband. Heavy French terry. Raw open hem.',
    instructions: 'Heather grey 340 GSM French terry. Ultra-wide below-knee length. Black waistband. Drawstring. Deep pockets. Raw hem.',
  },
  {
    id: 'SH02',
    garmentType: 'Shorts',
    name: 'Black Cargo Shorts',
    prompt: `${BRAND_STYLE}, ultra-baggy black cargo shorts on model, hitting below knee, extremely wide legs, two large cargo pockets on thighs with snap flaps, drawstring waist, heavy cotton twill, open hem, same oversized cargo aesthetic as the cargo pants but shorts`,
    description: 'Black ultra-baggy below-knee cargo shorts. Large thigh pockets. Snap flaps. Heavy cotton twill.',
    instructions: 'Black cotton twill, 300 GSM. Ultra-wide below-knee. 2 thigh cargo pockets with snap flaps. Drawstring waist. Open hem.',
  },
  {
    id: 'SH03',
    garmentType: 'Shorts',
    name: 'Denim Cutoff Shorts',
    prompt: `${BRAND_STYLE}, ultra-baggy medium wash denim cutoff shorts on model, hitting at knee, extremely wide legs, raw frayed cutoff hem, five-pocket design, medium blue wash with subtle fading, oversized relaxed silhouette, thick rigid denim, summer streetwear look`,
    description: 'Medium wash denim ultra-baggy cutoff shorts. Raw frayed hem. Knee-length. Five-pocket rigid denim.',
    instructions: '14oz medium wash denim. Ultra-wide knee-length. Raw cutoff hem. Five-pocket. Rigid construction.',
  },

  // ═══════════════════════════════════════════
  // ACCESSORIES COLLECTION (4 designs)
  // ═══════════════════════════════════════════
  {
    id: 'AC01',
    garmentType: 'Jeans',
    name: 'Chain Detail Wide Jeans',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, dark indigo ultra-wide-leg jeans on model, silver curb chain hanging from right front belt loop to right back belt loop with 8 inch drop, additional thin silver chain draped across left thigh from pocket to pocket, five-pocket rigid denim, open hem dragging on ground, chains are prominent decorative accessories on the jeans`,
    description: 'Dark indigo ultra-wide jeans with silver curb chain detail — draped from belt loops and across left thigh. Rigid heavyweight denim.',
    instructions: '15oz dark indigo rigid denim. Silver curb chain (8" drop, right belt loop to back). Thin silver chain draped left thigh. Five-pocket. Open hem.',
  },
  {
    id: 'AC02',
    garmentType: 'Cargo Pants',
    name: 'D-Ring Utility Cargos',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, black ultra-wide cargo pants on model, gunmetal D-ring hardware attached at waistband and cargo pocket flaps, total of 6 visible D-rings, heavy cotton twill, two large cargo pockets on thighs with D-ring closure, nylon webbing belt threaded through D-rings, tactical streetwear, open hem`,
    description: 'Black ultra-wide cargos with gunmetal D-ring hardware throughout — waistband, pockets, belt. Tactical streetwear.',
    instructions: 'Black cotton twill, 300 GSM. 6 gunmetal D-rings (waistband + pocket flaps). Nylon webbing belt. 2 thigh cargo pockets. Open hem.',
  },
  {
    id: 'AC03',
    garmentType: 'Cargo Pants',
    name: 'Carabiner Clip Cargos',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, olive green ultra-wide cargo pants on model, silver carabiner clips attached at belt loops and cargo pocket D-rings as decorative hardware, 4 visible carabiner clips hanging from pants, heavy cotton ripstop, large cargo pockets, webbing loops for clip attachment, military techwear look, open hem`,
    description: 'Olive cargos with silver carabiner clip hardware — 4 clips hanging from belt loops and D-rings. Military techwear.',
    instructions: 'Olive ripstop cotton, 280 GSM. 4 silver carabiner clips on D-ring/belt loop mounts. Large cargo pockets. Webbing loops. Open hem.',
  },
  {
    id: 'AC04',
    garmentType: 'Shorts',
    name: 'Chain Detail Cargo Shorts',
    prompt: `${BRAND_STYLE}, ultra-baggy black cargo shorts on model hitting below knee, extremely wide legs, silver wallet chain hanging from front belt loop to back pocket, metal grommets/eyelets along cargo pocket flaps as decorative detail, two large cargo pockets on thighs, heavy cotton twill, open hem, streetwear accessories visible`,
    description: 'Black ultra-baggy cargo shorts with silver wallet chain and metal grommet detail on pocket flaps. Below-knee.',
    instructions: 'Black cotton twill, 300 GSM. Below-knee ultra-wide. Silver wallet chain. Metal grommets on cargo flaps. 2 thigh pockets. Open hem.',
  },

  // ═══════════════════════════════════════════
  // 2025-2026 TREND COLLECTION (12 designs)
  // ═══════════════════════════════════════════
  {
    id: 'SW11',
    garmentType: 'Sweatpants',
    name: 'Pistachio Balloon Sweats',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, washed pistachio green balloon-fit sweatpants on model, extreme volume balloon silhouette, garment-dyed vintage fade finish, drawstring waist with brass aglets, deep slant pockets, open straight-cut hem, soft pastel green trending colorway`,
    description: 'Washed pistachio green balloon-fit sweats with extreme volume. Garment-dyed vintage finish. Drawstring waist and open hem.',
    instructions: 'Pistachio green garment-dyed fleece, 340 GSM. Extreme balloon silhouette. Deep slant pockets. Drawstring with brass aglets. Open straight-cut hem. No branding.',
  },
  {
    id: 'SW12',
    garmentType: 'Sweatpants',
    name: 'Tech Mesh Panel Sweats',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, charcoal grey ultra-wide sweatpants on model, black mesh panel inserts at inner thigh for ventilation and techwear look, hidden zip pocket on right thigh, reflective drawstring tips, technical athletic streetwear crossover, open hem`,
    description: 'Charcoal ultra-wide sweats with black mesh panel inserts at inner thigh. Moisture-wicking. Techwear-athletic crossover.',
    instructions: 'Charcoal technical fleece 300 GSM. Black mesh panels inner thigh. Hidden zip pocket right thigh. Reflective drawstring tips. Open hem.',
  },
  {
    id: 'JN09',
    garmentType: 'Jeans',
    name: 'Taupe Vintage Wide Jeans',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, washed taupe brown ultra-wide jeans on model, heavy fade at thighs and knees, earth tone vintage aesthetic, garment dyed warm brown color, five-pocket design, raw open hem, mid-rise waist, 2025 trending earth tone colorway`,
    description: 'Washed taupe ultra-wide jeans with heavy fade at thighs and knees. Earth-tone vintage aesthetic. Five-pocket.',
    instructions: '14oz denim, taupe garment wash. Heavy fade at thighs/knees. Wide straight leg. Five-pocket. Raw open hem. Mid-rise.',
  },
  {
    id: 'JN10',
    garmentType: 'Jeans',
    name: 'Black Carpenter Wide Jeans',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, triple black ultra-wide carpenter jeans on model, double knee reinforcement panels, hammer loop on right side, tool pocket on left thigh, utility workwear details, heavy rigid black denim, open hem, 2025 workwear trend`,
    description: 'Triple-black ultra-wide carpenter jeans with hammer loop, tool pocket, and reinforced double knees. Utility workwear.',
    instructions: '15oz black rigid denim. Ultra-wide straight leg. Double knee reinforcement. Hammer loop right side. Tool pocket left thigh. Open hem.',
  },
  {
    id: 'CG09',
    garmentType: 'Cargo Pants',
    name: 'Gorpcore Convertible Cargos',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, sage green ultra-wide convertible cargo pants on model, zip-off legs at knee showing zip detail, DWR water-resistant technical ripstop nylon fabric, 4 zip cargo pockets, elastic drawstring waist, ankle toggle hems, gorpcore outdoor streetwear fusion`,
    description: 'Sage green DWR-coated convertible cargos with zip-off legs. Technical ripstop. Zip pockets. Outdoor-streetwear fusion.',
    instructions: 'Sage green nylon ripstop with DWR coating. Zip-off legs at knee. 4 zip cargo pockets. Elastic drawstring waist. Toggle ankle hems.',
  },
  {
    id: 'CG10',
    garmentType: 'Cargo Pants',
    name: 'Stone Parachute Cargos',
    prompt: `${BRAND_STYLE}, ${BAGGY_CORE}, stone beige parachute-width cargo pants on model, extreme parachute balloon volume, lightweight nylon ripstop fabric, toggle drawstring waist, toggle ankle hems, large flap cargo pockets, elastic webbing belt, Y2K revival streetwear`,
    description: 'Stone beige parachute-width cargos in lightweight ripstop nylon. Toggle waist and ankles. Maximum volume. Y2K revival.',
    instructions: 'Stone beige nylon ripstop 160 GSM. Extreme parachute width. Drawstring waist + ankle toggles. Large flap cargo pockets. Elastic webbing belt.',
  },
  {
    id: 'JK11',
    garmentType: 'Jacket',
    name: 'Slate Gorpcore Utility Vest',
    prompt: `${BRAND_STYLE}, slate grey ripstop nylon utility vest on model, 6 pockets including 2 chest zip pockets and 2 side zip pockets, DWR water-resistant coating, standing collar, snap plus zip front closure, oversized boxy fit, gorpcore outdoor city crossover`,
    description: 'Slate grey ripstop utility vest with 6 pockets. DWR-coated. Standing collar. Gorpcore outdoor-city crossover.',
    instructions: 'Slate grey nylon ripstop, DWR coating. 6 pockets (2 chest zip, 2 side zip, 2 internal). Standing collar. Snap + zip front. Oversized boxy.',
  },
  {
    id: 'JK12',
    garmentType: 'Hoodie',
    name: 'Washed Black Heavyweight Hoodie',
    prompt: `${BRAND_STYLE}, vintage washed black heavyweight pullover hoodie on model, extremely heavy 400 GSM fleece, faded garment-dyed wash, extreme oversized drop shoulder silhouette, thick kangaroo pocket, thick natural drawstring, ribbed cuffs, minimal no branding, premium blank hoodie`,
    description: 'Vintage washed black heavyweight pullover hoodie. 400 GSM. Faded finish. Oversized drop shoulders. Minimal.',
    instructions: 'Washed black garment-dyed 400 GSM fleece. Extreme oversized. Dropped shoulders. Kangaroo pocket. Thick drawstring. Ribbed cuffs. No branding.',
  },
  {
    id: 'TE04',
    garmentType: 'T-Shirt',
    name: 'Sky Blue Washed Box Tee',
    prompt: `${BRAND_STYLE}, sky blue garment-dyed oversized boxy t-shirt on model, soft vintage wash pastel blue, dropped shoulders, split hem with longer back, thick heavy cotton fabric, trending soft pastel colorway 2025, no graphics no branding clean`,
    description: 'Sky blue garment-dyed oversized box tee. Soft vintage wash. Dropped shoulders. Split hem. Pastel trending colorway.',
    instructions: 'Sky blue garment-dyed 260 GSM cotton. Boxy oversized fit. Dropped shoulders. Split hem longer back. Vintage fade. No branding.',
  },
  {
    id: 'TE05',
    garmentType: 'T-Shirt',
    name: 'Cream Gothic Print Tee',
    prompt: `${BRAND_STYLE}, cream garment-dyed oversized t-shirt on model, large bold gothic cross graphic on front center chest, matte black screen print, distressed vintage print effect, boxy oversized fit, dropped shoulders, heavyweight cotton`,
    description: 'Cream oversized tee with bold gothic cross graphic on front. Screen-printed matte black. Vintage washed finish.',
    instructions: 'Cream garment-dyed 280 GSM cotton. Large gothic cross front print, matte black screen print. Boxy oversized. Dropped shoulders.',
  },
  {
    id: 'SH04',
    garmentType: 'Shorts',
    name: 'Olive Parachute Shorts',
    prompt: `${BRAND_STYLE}, olive green nylon parachute shorts on model, extreme wide volume, below-knee length, lightweight ripstop nylon fabric, drawstring toggle waist, cargo flap pocket on right thigh, open hem, summer techwear streetwear look`,
    description: 'Olive nylon parachute shorts with extreme volume. Toggle waist. Below-knee. Lightweight ripstop. Summer techwear.',
    instructions: 'Olive nylon ripstop, 160 GSM. Extreme parachute width. Below-knee. Drawstring + toggle waist. Cargo flap pocket right thigh. Open hem.',
  },
  {
    id: 'SH05',
    garmentType: 'Shorts',
    name: 'Taupe Washed Cargo Shorts',
    prompt: `${BRAND_STYLE}, washed taupe earth-tone cargo shorts on model, oversized below-knee length, garment-dyed vintage finish, two large cargo pockets with button flaps, heavy cotton twill fabric, drawstring waist, raw hem edge, 2025 earth tone trend`,
    description: 'Washed taupe earth-tone cargo shorts with oversized pockets. Heavy cotton twill. Garment-dyed vintage finish.',
    instructions: 'Taupe garment-dyed cotton twill, 280 GSM. Below-knee ultra-wide. 2 large cargo pockets with button flaps. Drawstring waist. Raw hem.',
  },
];

// ── Logo design ──
const LOGO_PROMPT = `minimalist premium streetwear brand logo for brand called VASTE, clean modern sans-serif typography, bold thick letters V A S T E, black text on pure white background, fashion brand logo, high-end clean design, vector-style sharp edges, no extra graphics just the wordmark`;

// ── Main ──
async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Filter designs if --id specified
  const designsToGen = singleId
    ? DESIGNS.filter(d => d.id.toUpperCase() === singleId)
    : DESIGNS;

  if (singleId && designsToGen.length === 0) {
    console.log(`Error: Design ID "${singleId}" not found. Available IDs: ${DESIGNS.map(d => d.id).join(', ')}`);
    process.exit(1);
  }

  if (singleId) {
    console.log(`\n═══ Regenerating single design: ${singleId} ${forceOverwrite ? '(force overwrite)' : ''} ═══\n`);
  }

  const collection = [];
  let successCount = 0;
  let failCount = 0;

  // Generate logo first (only in full mode)
  if (!singleId) {
    console.log('\n═══ Generating VASTE Logo ═══');
    const logoBuf = await generateImage(LOGO_PROMPT, 1024, 512);
    if (logoBuf) {
      fs.writeFileSync(path.join(OUTPUT_DIR, 'logo.png'), logoBuf);
      console.log('✓ Logo saved');
    } else {
      console.log('✗ Logo generation failed');
    }
  }

  // Generate designs
  console.log(`\n═══ Generating ${designsToGen.length} VASTE Design${designsToGen.length !== 1 ? 's' : ''} ═══\n`);

  for (let i = 0; i < designsToGen.length; i++) {
    const design = designsToGen[i];
    const filename = `${design.id.toLowerCase()}.jpg`;
    const filepath = path.join(OUTPUT_DIR, filename);

    // Inject outfit isolation rule into prompt
    const outfitRule = getOutfitRule(design.garmentType);
    const fullPrompt = `${design.prompt}, ${outfitRule}`;

    // Skip if already generated (unless --force)
    if (fs.existsSync(filepath) && !forceOverwrite) {
      console.log(`[${i + 1}/${designsToGen.length}] ${design.name} — already exists, skipping`);
      collection.push({
        id: design.id,
        garmentType: design.garmentType,
        name: design.name,
        image: `/brand/vaste/${filename}`,
        description: design.description,
        instructions: design.instructions,
      });
      successCount++;
      continue;
    }

    console.log(`[${i + 1}/${designsToGen.length}] ${design.name} (${design.garmentType})`);
    const buf = await generateImage(fullPrompt);

    if (buf) {
      fs.writeFileSync(filepath, buf);
      collection.push({
        id: design.id,
        garmentType: design.garmentType,
        name: design.name,
        image: `/brand/vaste/${filename}`,
        description: design.description,
        instructions: design.instructions,
      });
      successCount++;
      console.log(`  ✓ Saved ${filename} (${(buf.length / 1024).toFixed(0)} KB)`);
    } else {
      failCount++;
      console.log(`  ✗ Failed to generate ${design.name}`);
    }

    // Small delay between generations to avoid hammering the API
    if (i < designsToGen.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Save collection JSON — merge with existing if single regen
  const collectionPath = path.join(OUTPUT_DIR, 'collection.json');
  if (singleId) {
    let existing = [];
    try { existing = JSON.parse(fs.readFileSync(collectionPath, 'utf-8')); } catch { /* fresh */ }
    // Replace matching ID or append
    for (const newItem of collection) {
      const idx = existing.findIndex(e => e.id === newItem.id);
      if (idx >= 0) existing[idx] = newItem;
      else existing.push(newItem);
    }
    fs.writeFileSync(collectionPath, JSON.stringify(existing, null, 2));
    console.log(`\n═══ Done — merged into existing collection ═══`);
  } else {
    fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2));
  }

  console.log(`\n═══ Done ═══`);
  console.log(`✓ ${successCount} designs generated`);
  console.log(`✗ ${failCount} failed`);
  console.log(`Collection saved to ${collectionPath}`);
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
