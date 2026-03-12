#!/bin/bash
# Fix broken brand images + add new design #21
# Uses api.airforce FLUX with validation (checks image isn't an error screenshot)

BRAND_DIR="C:/Users/laure/style-ai/public/brand"
API_URL="https://api.airforce/v1/images/generations"
MIN_SIZE=280000  # Real clothing images are typically >300KB; error screenshots ~250KB

generate_image() {
  local id="$1"
  local prompt="$2"
  local output="$BRAND_DIR/design_${id}.jpg"

  echo "=== Generating Design $id ==="

  for attempt in $(seq 1 20); do
    # Wait between attempts (longer delays to avoid rate limit)
    if [ $attempt -gt 1 ]; then
      local wait_time=$((10 + attempt * 5))
      echo "  Waiting ${wait_time}s before attempt $attempt..."
      sleep $wait_time
    fi

    # Make API call
    local response
    response=$(curl -s -w "\n%{http_code}" "$API_URL" \
      -H "Content-Type: application/json" \
      -d "{\"model\":\"flux-2-klein-4b\",\"prompt\":\"$prompt\",\"size\":\"1024x1024\",\"n\":1}" \
      --max-time 60 2>/dev/null)

    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | sed '$d')

    if [ "$http_code" != "200" ]; then
      echo "  Attempt $attempt: HTTP $http_code, retrying..."
      continue
    fi

    # Extract image URL
    local img_url=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['url'])" 2>/dev/null)

    if [ -z "$img_url" ]; then
      echo "  Attempt $attempt: No URL in response, retrying..."
      continue
    fi

    # Download image
    curl -s -o "$output" "$img_url" --max-time 30 2>/dev/null

    # Validate: check file exists and is large enough (real clothes > 280KB)
    local fsize=$(wc -c < "$output" 2>/dev/null | tr -d ' ')

    if [ -z "$fsize" ] || [ "$fsize" -lt "$MIN_SIZE" ]; then
      echo "  Attempt $attempt: Image too small (${fsize} bytes), likely error page. Retrying..."
      rm -f "$output"
      continue
    fi

    # Check it's actually a JPEG (starts with FF D8)
    local magic=$(xxd -p -l 2 "$output" 2>/dev/null)
    if [ "$magic" != "ffd8" ]; then
      echo "  Attempt $attempt: Not a valid JPEG. Retrying..."
      rm -f "$output"
      continue
    fi

    echo "  SUCCESS: design_${id}.jpg ($fsize bytes)"
    return 0
  done

  echo "  FAILED after 20 attempts"
  return 1
}

echo "========================================="
echo "Fixing 5 broken images + adding design 21"
echo "========================================="

# Design 06: Oversized Puffer Vest
generate_image "06" "Professional flat-lay product photo of a matte black oversized cropped puffer vest, boxy silhouette, high collar with snap closure, two large front welt pockets, quilted horizontal baffles, water-resistant nylon shell, on clean white background, studio lighting, fashion product photography"

sleep 15

# Design 07: Baggy Work Pants
generate_image "07" "Professional flat-lay product photo of khaki tan baggy double-knee work pants, ultra wide leg relaxed fit, heavy cotton canvas, reinforced double-layer knee panels, hammer loop, multiple tool pockets, wide belt loops, brass zipper, on clean white background, studio lighting, fashion product photography"

sleep 15

# Design 08: Oversized Zip-Up Hoodie
generate_image "08" "Professional flat-lay product photo of a charcoal dark gray oversized full-zip hoodie, 380 GSM heavyweight French terry, relaxed boxy fit with drop shoulders, oversized hood, heavy metal zipper, ribbed cuffs and hem, on clean white background, studio lighting, fashion product photography"

sleep 15

# Design 11: Baggy Denim Jeans
generate_image "11" "Professional flat-lay product photo of washed indigo blue super baggy wide-leg jeans, extremely relaxed oversized fit, raw selvedge denim, five pocket western styling, contrast orange topstitching, barrel leg silhouette, on clean white background, studio lighting, fashion product photography"

sleep 15

# Design 12: Oversized Bomber Jacket
generate_image "12" "Professional flat-lay product photo of a forest green oversized satin bomber jacket, boxy relaxed fit, ribbed collar cuffs and hem in black, quilted orange lining visible at collar, two front slant pockets, brass zipper, MA-1 military inspired, on clean white background, studio lighting, fashion product photography"

sleep 15

# Design 21: NEW — Gray AK Sweatpants with Burberry waistband
generate_image "21" "Professional flat-lay product photo of heather gray baggy sweatpants with large AK-47 rifle graphic printed vertically going up the right leg in black ink, clean Burberry-inspired tartan plaid double waistband, no elastic cuffs with open straight leg hem, heavyweight cotton fleece, oversized relaxed fit, no logos on sides, on clean white background, studio lighting, fashion product photography, streetwear"

echo ""
echo "========================================="
echo "DONE — Check images in $BRAND_DIR"
echo "========================================="
