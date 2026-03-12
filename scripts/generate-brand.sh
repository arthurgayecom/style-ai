#!/bin/bash
# Generate 20 baggy streetwear designs using free APIs
# Text: api.airforce (DeepSeek) | Image: api.airforce (FLUX)

BRAND_DIR="C:/Users/laure/style-ai/public/brand"
TEXT_API="https://api.airforce/v1/chat/completions"
IMAGE_API="https://api.airforce/v1/images/generations"
COLLECTION="$BRAND_DIR/collection.json"

mkdir -p "$BRAND_DIR"
echo "[" > "$COLLECTION"

# Define all 20 designs
DESIGNS=(
  "01|baggy joggers|Dark gray heavyweight 350 GSM cotton baggy joggers, oversized relaxed fit, double waistband with Burberry-inspired tartan plaid pattern, elastic drawstring waist, bold AK-47 rifle graphic screen printed on right leg in black ink, ribbed elastic ankle cuffs, deep side pockets, streetwear urban aesthetic"
  "02|oversized hoodie|Jet black oversized pullover hoodie, 400 GSM heavyweight brushed fleece, massively oversized boxy fit with exaggerated drop shoulders, large kangaroo pocket, double-layered hood with black drawstrings, ribbed cuffs and hem, subtle tonal embossed logo on front left chest, raw edge details on hood"
  "03|baggy cargo pants|Olive green baggy parachute cargo pants, oversized relaxed fit with wide straight legs, multiple oversized cargo pockets with snap-button flaps, adjustable drawstring waist, elastic bungee cord ankle closures, reinforced double knee panels, heavyweight 320 GSM cotton twill, military-inspired streetwear"
  "04|wide leg track pants|Cream off-white wide leg track pants, ultra-baggy oversized fit, side stripe detail in black running down both legs, elastic waistband with contrast black drawstring, zippered ankle openings, two side pockets, 280 GSM French terry, retro 90s streetwear aesthetic"
  "05|oversized graphic tee|Washed vintage black oversized t-shirt, heavyweight 300 GSM cotton, massively boxy dropped shoulder fit, large abstract skull graphic across the entire back in cracked white ink, ribbed crew neck, raw hem finish, distressed wash effect, underground streetwear vibe"
  "06|oversized puffer vest|Matte black oversized cropped puffer vest, boxy silhouette, high collar with snap closure, two large front welt pockets, quilted horizontal baffles, water-resistant nylon shell, heavyweight streetwear layering piece"
  "07|baggy work pants|Khaki tan baggy double-knee work pants, ultra wide leg relaxed fit, heavy 14oz cotton canvas, reinforced double-layer knee panels, hammer loop, multiple tool pockets, wide belt loops, brass zipper, carpenter streetwear"
  "08|oversized zip-up hoodie|Charcoal dark gray oversized full-zip hoodie, 380 GSM heavyweight French terry, relaxed boxy fit with drop shoulders, oversized hood, heavy metal zipper, ribbed cuffs, streetwear essential"
  "09|baggy basketball shorts|Black and white color-blocked oversized basketball shorts, knee-length baggy fit, mesh side panels, elastic waistband with drawstring, deep side pockets, bold white stripes down sides, athletic streetwear crossover"
  "10|oversized crewneck sweatshirt|Stone washed navy blue oversized crewneck sweatshirt, 360 GSM heavyweight fleece, extremely boxy fit with drop shoulders, ribbed collar cuffs and hem, embroidered small logo on chest, vintage garment-dyed wash, premium streetwear"
  "11|baggy denim jeans|Washed indigo blue super baggy wide-leg jeans, extremely relaxed oversized fit, 14oz raw selvedge denim, five pocket western styling, contrast orange topstitching, barrel leg silhouette, 90s hip-hop streetwear"
  "12|oversized bomber jacket|Forest green oversized satin bomber jacket, boxy relaxed fit, ribbed collar cuffs and hem in black, quilted orange lining visible at collar, two front slant pockets, brass zipper, MA-1 military-inspired streetwear"
  "13|baggy sweatpants|Heather gray classic baggy sweatpants, 330 GSM heavyweight fleece, super relaxed fit with tapered elastic ankle cuffs, wide elastic waistband with external drawcord, deep side pockets, vintage washed, essential streetwear basics"
  "14|oversized varsity jacket|Black and cream oversized wool varsity jacket, leather sleeves in black, snap-button front closure, ribbed collar cuffs and hem with dual stripes, large chenille letter patch on front left chest, two welt pockets, collegiate streetwear"
  "15|baggy parachute pants|Black technical nylon baggy parachute pants, ultra-wide leg with gathering at ankles via elastic and toggles, multiple zip cargo pockets, elastic waistband, reflective detailing on pockets, futuristic techwear streetwear"
  "16|oversized long sleeve tee|Washed burgundy oversized long sleeve t-shirt, 260 GSM cotton jersey, extremely relaxed dropped shoulder fit, ribbed crew neck, extended length covering past the hips, subtle back neck label, vintage distressed wash, minimalist streetwear layering piece"
  "17|baggy corduroy pants|Dark brown wide-wale corduroy baggy pants, relaxed oversized fit, pleated front, wide straight legs, deep pockets, button fly, belt loops, heavyweight corduroy, 70s retro-inspired streetwear"
  "18|oversized quarter-zip fleece|Oatmeal beige oversized quarter-zip fleece pullover, 350 GSM plush sherpa fleece, boxy fit with drop shoulders, metal quarter-zip with pull tab, kangaroo pocket, ribbed cuffs, cozy outdoor streetwear"
  "19|baggy utility shorts|Washed black baggy utility cargo shorts, just-below-knee length, multiple cargo pockets with velcro flaps, elastic waistband with drawstring, heavyweight cotton ripstop, tactical-inspired streetwear"
  "20|oversized windbreaker|Two-tone black and electric blue oversized windbreaker jacket, lightweight nylon shell, boxy fit, half-zip with high collar, elasticated cuffs and hem, one chest pocket with zip, reflective logo on back, 90s sportswear streetwear"
)

FIRST=true
DESIGN_COUNT=0

for ENTRY in "${DESIGNS[@]}"; do
  IFS='|' read -r NUM TYPE DESC <<< "$ENTRY"
  echo ""
  echo "=========================================="
  echo "Design $NUM: $TYPE"
  echo "=========================================="

  # Step 1: Generate image prompt via text API
  echo "Step 1: Generating prompt..."
  sleep 3

  PROMPT_RESULT=""
  for attempt in 1 2 3 4 5; do
    if [ "$attempt" -gt 1 ]; then sleep $((attempt * 2)); fi

    PROMPT_RESULT=$(curl -s -X POST "$TEXT_API" -H "Content-Type: application/json" -d "{
      \"model\": \"deepseek-v3-0324\",
      \"messages\": [
        {\"role\": \"system\", \"content\": \"You are a fashion design AI. Return ONLY valid JSON (no markdown code fences, no extra text). Generate: imagePrompt (detailed flat-lay product photo prompt ending with studio lighting on white background), description (2-3 sentence fashion description), specs object with fit, fabric, weight, colors array, keyFeatures array.\"},
        {\"role\": \"user\", \"content\": \"Create image prompt and description for: $DESC. Return JSON: {\\\"imagePrompt\\\":\\\"...\\\",\\\"description\\\":\\\"...\\\",\\\"specs\\\":{\\\"fit\\\":\\\"...\\\",\\\"fabric\\\":\\\"...\\\",\\\"weight\\\":\\\"...\\\",\\\"colors\\\":[\\\"...\\\"],\\\"keyFeatures\\\":[\\\"...\\\"]}}\"}
      ],
      \"max_tokens\": 800
    }" --max-time 30 2>&1)

    if echo "$PROMPT_RESULT" | grep -q '"content"'; then
      break
    fi
    echo "  Text attempt $attempt failed, retrying..."
  done

  # Extract the content
  CONTENT=$(echo "$PROMPT_RESULT" | sed 's/.*"content":"//' | sed 's/","finish_reason.*//')
  # Clean markdown fences and spam
  CONTENT=$(echo "$CONTENT" | sed 's/```json\\n//g' | sed 's/\\n```//g' | sed 's/Need proxies.*//g')
  # Unescape
  CONTENT=$(echo "$CONTENT" | sed 's/\\n/\n/g' | sed 's/\\"/"/g' | sed 's/\\\\/\\/g')

  # Extract imagePrompt
  IMAGE_PROMPT=$(echo "$CONTENT" | grep -o '"imagePrompt"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"imagePrompt"[[:space:]]*:[[:space:]]*"//;s/"$//')
  DESCRIPTION=$(echo "$CONTENT" | grep -o '"description"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"description"[[:space:]]*:[[:space:]]*"//;s/"$//')

  if [ -z "$IMAGE_PROMPT" ]; then
    IMAGE_PROMPT="Professional flat-lay product photo of $TYPE, $DESC, clean white background, studio lighting, high detail, fashion e-commerce photography"
    DESCRIPTION="$TYPE - $DESC"
  fi

  echo "  Prompt: ${IMAGE_PROMPT:0:100}..."
  echo "  Description: ${DESCRIPTION:0:80}..."

  # Step 2: Generate image
  echo "Step 2: Generating image..."
  sleep 5

  IMAGE_URL=""
  for attempt in 1 2 3 4 5 6 7 8; do
    if [ "$attempt" -gt 1 ]; then sleep $((attempt * 2)); fi

    IMG_RESULT=$(curl -s -X POST "$IMAGE_API" -H "Content-Type: application/json" -d "{
      \"model\": \"flux-2-klein-4b\",
      \"prompt\": \"$IMAGE_PROMPT\",
      \"size\": \"1024x1024\",
      \"n\": 1
    }" --max-time 60 2>&1)

    IMAGE_URL=$(echo "$IMG_RESULT" | grep -o '"url":"[^"]*"' | sed 's/"url":"//;s/"$//')

    if [ -n "$IMAGE_URL" ]; then
      break
    fi
    echo "  Image attempt $attempt failed, retrying..."
  done

  if [ -z "$IMAGE_URL" ]; then
    echo "  FAILED to generate image for design $NUM"
    continue
  fi

  # Step 3: Download image
  echo "Step 3: Downloading image..."
  curl -s -o "$BRAND_DIR/design_$NUM.jpg" "$IMAGE_URL" --max-time 30

  if [ -f "$BRAND_DIR/design_$NUM.jpg" ]; then
    SIZE=$(wc -c < "$BRAND_DIR/design_$NUM.jpg")
    echo "  Saved: design_$NUM.jpg ($SIZE bytes)"
    DESIGN_COUNT=$((DESIGN_COUNT + 1))
  else
    echo "  FAILED to download image"
    continue
  fi

  # Add to collection JSON
  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    echo "," >> "$COLLECTION"
  fi

  # Escape description for JSON
  SAFE_DESC=$(echo "$DESCRIPTION" | sed 's/"/\\"/g')
  SAFE_TYPE=$(echo "$TYPE" | sed 's/"/\\"/g')

  cat >> "$COLLECTION" << JSONEOF
  {
    "id": "$NUM",
    "garmentType": "$SAFE_TYPE",
    "image": "/brand/design_$NUM.jpg",
    "description": "$SAFE_DESC",
    "instructions": "$(echo "$DESC" | sed 's/"/\\"/g')"
  }
JSONEOF

  echo "  Design $NUM complete! ($DESIGN_COUNT total)"
done

echo "" >> "$COLLECTION"
echo "]" >> "$COLLECTION"

echo ""
echo "=========================================="
echo "BRAND GENERATION COMPLETE"
echo "Total designs: $DESIGN_COUNT / 20"
echo "Collection: $COLLECTION"
echo "=========================================="
