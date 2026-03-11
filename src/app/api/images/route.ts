import { NextRequest, NextResponse } from 'next/server';

// Image search API for presentations
// Priority: Pexels API (if key) → loremflickr (keyword search, no key)

const PEXELS_BASE = 'https://api.pexels.com/v1/search';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') || 'abstract';
  const count = Math.min(parseInt(req.nextUrl.searchParams.get('count') || '1', 10), 10);

  // Clean query: take first 4 keywords for better matches
  const cleanQuery = query.split(/\s+/).slice(0, 4).join(' ');

  try {
    // Try Pexels API if key is available (best quality, keyword search)
    const pexelsKey = process.env.PEXELS_API_KEY;
    if (pexelsKey) {
      const res = await fetch(
        `${PEXELS_BASE}?query=${encodeURIComponent(cleanQuery)}&per_page=${count}&orientation=landscape`,
        { headers: { Authorization: pexelsKey } }
      );
      if (res.ok) {
        const data = await res.json();
        const images = (data.photos || []).map((p: { id: number; src: { large: string; medium: string }; alt: string }) => ({
          id: String(p.id),
          url: p.src.large,
          thumb: p.src.medium,
          alt: p.alt || cleanQuery,
        }));
        if (images.length > 0) {
          return NextResponse.json({ images, source: 'pexels' });
        }
      }
    }

    // Fallback: loremflickr.com (keyword-based, no key needed)
    // The browser's <img> tag follows the 302 redirect automatically
    const keywords = cleanQuery.replace(/\s+/g, ',');
    const images = Array.from({ length: count }, (_, i) => ({
      id: `flickr-${i}`,
      url: `https://loremflickr.com/800/600/${encodeURIComponent(keywords)}?lock=${Date.now() + i}`,
      thumb: `https://loremflickr.com/400/300/${encodeURIComponent(keywords)}?lock=${Date.now() + i}`,
      alt: cleanQuery,
    }));

    return NextResponse.json({ images, source: 'loremflickr' });
  } catch {
    // Final fallback: picsum (random but reliable)
    const images = Array.from({ length: count }, (_, i) => ({
      id: `picsum-${i}`,
      url: `https://picsum.photos/seed/${encodeURIComponent(cleanQuery)}${i}/800/600`,
      thumb: `https://picsum.photos/seed/${encodeURIComponent(cleanQuery)}${i}/400/300`,
      alt: cleanQuery,
    }));

    return NextResponse.json({ images, source: 'picsum' });
  }
}
