import { NextRequest, NextResponse } from 'next/server';

// Uses Unsplash Source (free, no API key required) for image URLs
// Falls back to Lorem Picsum if Unsplash is unavailable

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') || 'abstract';
  const count = parseInt(req.nextUrl.searchParams.get('count') || '1', 10);

  try {
    // Use Unsplash source API (no key needed, returns redirect to image)
    const images = Array.from({ length: Math.min(count, 10) }, (_, i) => ({
      id: `${query}-${i}`,
      url: `https://source.unsplash.com/800x600/?${encodeURIComponent(query)}&sig=${Date.now() + i}`,
      thumb: `https://source.unsplash.com/400x300/?${encodeURIComponent(query)}&sig=${Date.now() + i}`,
      alt: query,
    }));

    return NextResponse.json({ images });
  } catch {
    // Fallback to Lorem Picsum
    const images = Array.from({ length: Math.min(count, 10) }, (_, i) => ({
      id: `picsum-${i}`,
      url: `https://picsum.photos/seed/${encodeURIComponent(query)}${i}/800/600`,
      thumb: `https://picsum.photos/seed/${encodeURIComponent(query)}${i}/400/300`,
      alt: query,
    }));

    return NextResponse.json({ images });
  }
}
