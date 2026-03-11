'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAIProvider } from '@/hooks/useAIProvider';
import { useStyleProfile } from '@/hooks/useStyleProfile';
import { fadeInUp, staggerContainer, staggerItem } from '@/lib/animations';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getItem, setItem } from '@/lib/storage/localStorage';
import { exportAsPPTX } from '@/lib/export/pptxExport';
import { toast } from 'sonner';

type SlideLayout = 'title' | 'content' | 'image_text' | 'comparison' | 'quote' | 'section' | 'timeline' | 'stats' | 'steps'
  | 'big_statement' | 'icon_grid' | 'split_image' | 'numbered_list' | 'full_image' | 'two_column_text' | 'highlight_box' | 'process_flow' | 'feature_cards' | 'closing' | 'agenda' | 'bento_grid';

interface Slide {
  layout: SlideLayout;
  title: string;
  bullets: string[];
  notes: string;
  imageDescription?: string;
  imageUrl?: string;
  quote?: string;
  quoteAuthor?: string;
  leftColumn?: string[];
  rightColumn?: string[];
  leftLabel?: string;
  rightLabel?: string;
  steps?: { label: string; description: string }[];
  stats?: { value: string; label: string }[];
  timelineItems?: { date: string; event: string }[];
  statement?: string;
  iconItems?: { icon: string; title: string; desc: string }[];
  numberedItems?: { number: string; title: string; desc: string }[];
  processSteps?: { label: string; desc: string }[];
  featureCards?: { icon: string; title: string; desc: string }[];
  highlightValue?: string;
  highlightLabel?: string;
  agendaItems?: { title: string; desc: string }[];
  overlayText?: string;
  bentoItems?: { icon: string; title: string; desc: string; span?: 'wide' | 'tall' | 'normal' }[];
}

interface Presentation {
  title: string;
  slides: Slide[];
}

/* ── Option Arrays ── */

const LANGUAGES = [
  { value: 'english', label: 'English' }, { value: 'french', label: 'French' },
  { value: 'spanish', label: 'Spanish' }, { value: 'german', label: 'German' },
  { value: 'arabic', label: 'Arabic' }, { value: 'chinese', label: 'Chinese' },
  { value: 'portuguese', label: 'Portuguese' }, { value: 'italian', label: 'Italian' },
  { value: 'japanese', label: 'Japanese' }, { value: 'korean', label: 'Korean' },
  { value: 'russian', label: 'Russian' }, { value: 'hindi', label: 'Hindi' },
];

const STYLES = [
  { value: 'Professional', desc: 'Clean corporate look' },
  { value: 'Creative', desc: 'Colorful and expressive' },
  { value: 'Minimal', desc: 'Less is more' },
  { value: 'Academic', desc: 'Scholarly and formal' },
  { value: 'Playful', desc: 'Fun and engaging' },
  { value: 'Bold', desc: 'High impact statements' },
  { value: 'Elegant', desc: 'Refined and sophisticated' },
  { value: 'Tech', desc: 'Modern tech aesthetic' },
  { value: 'Startup', desc: 'Pitch-ready energy' },
  { value: 'Retro', desc: 'Vintage vibes' },
  { value: 'Corporate', desc: 'Board-room ready' },
  { value: 'Artistic', desc: 'Visual storytelling' },
];

const FORMATS = [
  { value: 'standard', label: 'Standard Slides', desc: 'General purpose' },
  { value: 'pitch', label: 'Pitch Deck', desc: 'Investor-ready' },
  { value: 'report', label: 'Report', desc: 'Data-driven' },
  { value: 'lesson', label: 'Lesson Plan', desc: 'Educational' },
  { value: 'workshop', label: 'Workshop', desc: 'Interactive session' },
  { value: 'keynote', label: 'Keynote', desc: 'Conference talk' },
  { value: 'ted_talk', label: 'TED-style Talk', desc: 'Story-driven' },
  { value: 'case_study', label: 'Case Study', desc: 'Problem → Solution' },
  { value: 'tutorial', label: 'Tutorial', desc: 'Step-by-step guide' },
  { value: 'team_meeting', label: 'Team Meeting', desc: 'Status updates' },
  { value: 'research', label: 'Research Defense', desc: 'Academic defense' },
  { value: 'product_demo', label: 'Product Demo', desc: 'Feature showcase' },
];

const LEVELS = ['Elementary', 'High School', 'University', 'Professional', 'Expert'];

const TONES = [
  'Formal', 'Conversational', 'Humorous', 'Inspirational',
  'Persuasive', 'Analytical', 'Storytelling', 'Motivational',
];

const AUDIENCES = [
  { value: 'general', label: 'General Public' },
  { value: 'academic', label: 'Academic / Researchers' },
  { value: 'professional', label: 'Business / Professional' },
  { value: 'casual', label: 'Casual / School' },
  { value: 'investors', label: 'Investors / Stakeholders' },
  { value: 'technical', label: 'Technical / Developers' },
  { value: 'executives', label: 'C-Suite / Executives' },
  { value: 'students', label: 'Students / Learners' },
];

const COLOR_SCHEMES = [
  { value: 'auto', label: 'Auto', colors: ['#6366f1', '#8b5cf6', '#a78bfa'] },
  { value: 'blue', label: 'Ocean', colors: ['#3b82f6', '#2563eb', '#60a5fa'] },
  { value: 'purple', label: 'Amethyst', colors: ['#8b5cf6', '#7c3aed', '#a78bfa'] },
  { value: 'green', label: 'Forest', colors: ['#22c55e', '#16a34a', '#4ade80'] },
  { value: 'red', label: 'Crimson', colors: ['#ef4444', '#dc2626', '#f87171'] },
  { value: 'orange', label: 'Sunset', colors: ['#f97316', '#ea580c', '#fb923c'] },
  { value: 'teal', label: 'Aqua', colors: ['#14b8a6', '#0d9488', '#2dd4bf'] },
  { value: 'rose', label: 'Rose', colors: ['#f43f5e', '#e11d48', '#fb7185'] },
  { value: 'mono', label: 'Mono', colors: ['#6b7280', '#4b5563', '#9ca3af'] },
  { value: 'dark', label: 'Dark', colors: ['#1e293b', '#334155', '#475569'] },
];

const CONTENT_DENSITY = [
  { value: 'brief', label: 'Brief', desc: '2-3 bullets per slide' },
  { value: 'standard', label: 'Standard', desc: '4-5 bullets per slide' },
  { value: 'detailed', label: 'Detailed', desc: '6+ bullets, more depth' },
];

const TRANSITIONS = [
  { value: 'morph', label: 'Morph' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide', label: 'Slide' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'push', label: 'Push' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'none', label: 'None' },
];

/* ── Prompt Builder ── */

function buildPrompt(opts: {
  language: string; style: string; format: string; level: string;
  tone: string; imageSource: string; slideCount: number; audience: string;
  colorScheme: string; contentDensity: string; transition: string;
  includeTOC: boolean; includeSummary: boolean; includeTakeaways: boolean;
  includeReferences: boolean; customInstructions: string;
  styleSection: string;
}) {
  const densityMap: Record<string, string> = {
    brief: 'Keep slides concise with only 2-3 key bullet points each. Less text, more impact.',
    standard: 'Use 4-5 bullet points per content slide. Balance detail with readability.',
    detailed: 'Use 6+ bullet points where appropriate. Provide thorough coverage of each topic.',
  };

  let specialSlides = '';
  if (opts.includeTOC) specialSlides += '\n- Include a Table of Contents / Agenda slide after the title';
  if (opts.includeSummary) specialSlides += '\n- Include a Summary / Conclusion slide at the end';
  if (opts.includeTakeaways) specialSlides += '\n- Include a Key Takeaways slide near the end';
  if (opts.includeReferences) specialSlides += '\n- Include a Sources / References slide at the very end';

  return `You are an elite presentation designer. Design like a modern TikTok presentation creator — one idea per slide, bold punchy text, minimal words, high visual contrast. Create a ${opts.format} presentation.

LANGUAGE: ${opts.language}
VISUAL STYLE: ${opts.style}
COLOR SCHEME: ${opts.colorScheme} (hint the color theme in content tone)
TONE: ${opts.tone}
AUDIENCE LEVEL: ${opts.level}
AUDIENCE: ${opts.audience}
TARGET SLIDES: ${opts.slideCount}
CONTENT DENSITY: ${densityMap[opts.contentDensity] || densityMap.standard}
TRANSITION STYLE: ${opts.transition} (suggest pacing accordingly)
${opts.imageSource === 'descriptions' ? 'Include "imageDescription" for relevant slides (describe what image should appear).' : 'Do not include images.'}
${specialSlides ? `\nSPECIAL SLIDES:${specialSlides}` : ''}
${opts.customInstructions ? `\nCUSTOM INSTRUCTIONS:\n${opts.customInstructions}` : ''}

WRITING STYLE:
${opts.styleSection}

AVAILABLE LAYOUTS (21 total — you MUST use at least 8 different layout types, NEVER use the same layout 3 times in a row):

IMPACT LAYOUTS (bold, gradient backgrounds, one idea per slide):
- title: Opening slide. title + optional subtitle in bullets[0]
- big_statement: Full gradient bg, single powerful statement. Fields: statement (the big text), title (small label above)
- section: Section divider with just a title
- closing: Final slide with CTA or "Thank You". Fields: statement (main text), title (small label)
- highlight_box: Large accent-colored box with key stat/fact. Fields: highlightValue (big number/fact), highlightLabel (description), bullets (supporting points)
- full_image: Cinematic full-bleed image with text overlay. Fields: imageDescription, overlayText (text on image), title

CONTENT LAYOUTS (clean bg, readable, detail-oriented):
- content: Title + bullet points + optional imageDescription
- image_text: Split — imageDescription on one side, bullets on other
- comparison: Two columns. Fields: leftLabel, leftColumn[], rightLabel, rightColumn[]
- two_column_text: Two text columns with distinct headers. Fields: leftLabel, leftColumn[], rightLabel, rightColumn[]
- quote: Notable quote. Fields: quote, quoteAuthor

DATA & STRUCTURE LAYOUTS:
- stats: Key statistics. Fields: stats: [{value, label}] (3-4 items)
- timeline: Chronological events. Fields: timelineItems: [{date, event}]
- steps: Process/how-to. Fields: steps: [{label, description}]
- numbered_list: Numbered items with descriptions. Fields: numberedItems: [{number, title, desc}]
- process_flow: Horizontal flow of connected steps. Fields: processSteps: [{label, desc}] (3-5 steps)
- agenda: Numbered agenda items. Fields: agendaItems: [{title, desc}]

VISUAL GRID LAYOUTS:
- icon_grid: 2×3 or 3×2 grid of mini-cards with emoji. Fields: iconItems: [{icon (emoji), title, desc}] (4-6 items)
- feature_cards: 3-4 horizontal feature cards. Fields: featureCards: [{icon (emoji), title, desc}]
- split_image: Left text + right image. Fields: bullets (left text), imageDescription (right image), title
- bento_grid: Modular bento-box layout (2026 trend). Fields: bentoItems: [{icon (emoji), title, desc, span ("wide"/"tall"/"normal")}] (4-6 items, mix spans for visual interest)

DESIGN RULES:
1. ALWAYS start with "title". ALWAYS end with "closing".
2. Alternate between impact slides (big_statement, highlight_box, full_image) and content slides (content, icon_grid, feature_cards, numbered_list). This creates visual rhythm.
3. Use "big_statement" for powerful one-liners. Use "icon_grid" and "feature_cards" instead of long bullet lists. Use "split_image" when visuals matter.
4. After a dense content slide, follow with a spacious impact slide. Group related content in 2-3 slide sequences before transitioning with a "section" slide.
5. Use "highlight_box" for the single most important stat or fact.

Return ONLY valid JSON (no code blocks):
{
  "title": "presentation title",
  "slides": [
    {"layout": "title", "title": "...", "bullets": ["subtitle"], "notes": "..."},
    {"layout": "big_statement", "title": "Key Insight", "statement": "One powerful line here", "bullets": [], "notes": "..."},
    {"layout": "icon_grid", "title": "...", "bullets": [], "notes": "...", "iconItems": [{"icon": "🚀", "title": "...", "desc": "..."}]},
    {"layout": "content", "title": "...", "bullets": ["..."], "notes": "...", "imageDescription": "..."},
    {"layout": "feature_cards", "title": "...", "bullets": [], "notes": "...", "featureCards": [{"icon": "⚡", "title": "...", "desc": "..."}]},
    {"layout": "highlight_box", "title": "...", "bullets": ["supporting point"], "notes": "...", "highlightValue": "85%", "highlightLabel": "..."},
    {"layout": "numbered_list", "title": "...", "bullets": [], "notes": "...", "numberedItems": [{"number": "01", "title": "...", "desc": "..."}]},
    {"layout": "process_flow", "title": "...", "bullets": [], "notes": "...", "processSteps": [{"label": "Step 1", "desc": "..."}]},
    {"layout": "closing", "title": "Next Steps", "statement": "Let's make it happen", "bullets": [], "notes": "..."}
  ]
}

Make it engaging, NOT generic AI text. Every slide MUST have speaker notes. Use bold, punchy language. One idea per slide.`;
}

/* ── Gradient & Transition Helpers ── */

const GRADIENT_LAYOUTS = new Set(['big_statement', 'section', 'closing', 'title', 'highlight_box']);

function getSlideBackground(layout: string, colors: string[]): string | undefined {
  if (!GRADIENT_LAYOUTS.has(layout)) return undefined;
  // jacobppt/lourrutia.ppt: dark-blended gradients, 2-3 color smooth blends, subtle mid-stop transparency
  if (layout === 'big_statement' || layout === 'closing') {
    return `linear-gradient(135deg, ${colors[0]}, ${colors[1]}, ${colors[0]}bb)`;
  }
  if (layout === 'highlight_box') {
    return `linear-gradient(160deg, ${colors[0]}ee, ${colors[1]})`;
  }
  if (layout === 'title') {
    return `linear-gradient(145deg, ${colors[0]}, ${colors[1]}dd, ${colors[0]}99)`;
  }
  return `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
}

function isGradientSlide(layout: string): boolean {
  return GRADIENT_LAYOUTS.has(layout);
}

// jacobppt/lourrutia.ppt: morph = smooth scale+fade, push = slides push each other, cinematic = dramatic zoom+rotate
const TRANSITION_VARIANTS: Record<string, { in: Record<string, number>; out: Record<string, number> }> = {
  morph:     { in: { opacity: 0, scale: 0.88, y: 40 },   out: { opacity: 0, scale: 1.12, y: -40 } },
  fade:      { in: { opacity: 0 },                        out: { opacity: 0 } },
  slide:     { in: { opacity: 0, x: 120 },                out: { opacity: 0, x: -120 } },
  zoom:      { in: { opacity: 0, scale: 0.6 },            out: { opacity: 0, scale: 1.4 } },
  push:      { in: { opacity: 0, x: 300 },                out: { opacity: 0, x: -300 } },
  cinematic: { in: { opacity: 0, scale: 0.7, rotate: -2 }, out: { opacity: 0, scale: 1.3, rotate: 2 } },
  none:      { in: {},                                     out: {} },
};

// Per-transition timing: morph is smooth spring, push is snappy, cinematic is dramatic slow
const TRANSITION_TIMING: Record<string, object> = {
  morph:     { type: 'spring', stiffness: 120, damping: 20, mass: 1 },
  fade:      { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
  slide:     { type: 'spring', stiffness: 180, damping: 26 },
  zoom:      { type: 'spring', stiffness: 100, damping: 18 },
  push:      { type: 'spring', stiffness: 250, damping: 30 },
  cinematic: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  none:      { duration: 0 },
};

/* ── Component ── */

export default function PresentPage() {
  const { providers, activeProvider } = useAIProvider();
  const { profile, hasProfile } = useStyleProfile();

  // Core
  const [topic, setTopic] = useState('');
  const [slideCount, setSlideCount] = useState(8);
  const [audience, setAudience] = useState('general');
  const [language, setLanguage] = useState('english');
  const [imageSource, setImageSource] = useState('descriptions');
  const [style, setStyle] = useState('Professional');
  const [format, setFormat] = useState('standard');
  const [level, setLevel] = useState('University');
  const [tone, setTone] = useState('Formal');

  // Advanced
  const [colorScheme, setColorScheme] = useState('auto');
  const [contentDensity, setContentDensity] = useState('standard');
  const [transition, setTransition] = useState('morph');
  const [includeTOC, setIncludeTOC] = useState(false);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeTakeaways, setIncludeTakeaways] = useState(false);
  const [includeReferences, setIncludeReferences] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Viewer
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'slide' | 'grid' | 'outline'>('slide');
  const presentRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (!presentation) return;
    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      setCurrentSlide(c => Math.min(c + 1, presentation.slides.length - 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setCurrentSlide(c => Math.max(c - 1, 0));
    } else if (e.key === 'Escape' && fullscreen) {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  }, [presentation, fullscreen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const generatePresentation = async () => {
    if (!topic.trim()) { toast.error('Enter a topic'); return; }
    const config = activeProvider ? providers[activeProvider] : null;
    if (!config) { toast.error('No AI provider configured — go to Setup'); return; }

    setLoading(true);
    setPresentation(null);
    try {
      const styleSection = hasProfile
        ? `Match the writer's style:\n${profile.fingerprint || 'Natural, non-AI tone.'}\nFormality: ${profile.dimensions?.tone?.formality || 50}/100`
        : 'Write naturally. Avoid generic AI language.';

      const prompt = buildPrompt({
        language, style, format, level, tone, imageSource, slideCount, audience,
        colorScheme, contentDensity, transition,
        includeTOC, includeSummary, includeTakeaways, includeReferences,
        customInstructions, styleSection,
      });
      const userMsg = `Topic: ${topic}\n\nCreate the presentation.`;

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'custom', essayText: userMsg, systemPrompt: prompt, providerConfig: config }),
      });
      const data = await res.json();

      let parsed: Presentation;
      if (data.analysis?.slides) {
        parsed = data.analysis;
      } else if (data.raw) {
        const cleaned = data.raw.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } else {
        throw new Error('Could not parse presentation');
      }

      parsed.slides = parsed.slides.map(s => ({ ...s, layout: s.layout || 'content' }));

      // Fetch real images for slides with imageDescription
      if (imageSource === 'descriptions') {
        const slidesWithImages = parsed.slides.filter(s => s.imageDescription);
        const imagePromises = slidesWithImages.map(async (s) => {
          // Use more descriptive query — take key nouns
          const desc = s.imageDescription!;
          const query = desc.split(' ').slice(0, 5).join(' ');
          try {
            // Try Unsplash source first
            const imgUrl = `https://source.unsplash.com/800x600/?${encodeURIComponent(query)}&sig=${Date.now() + Math.random()}`;
            s.imageUrl = imgUrl;
          } catch {
            try {
              // Fallback: try simpler query
              const simpleQuery = desc.split(' ').slice(0, 2).join(' ');
              s.imageUrl = `https://source.unsplash.com/800x600/?${encodeURIComponent(simpleQuery)}&sig=${Date.now()}`;
            } catch {
              // Leave as description if all image fetches fail
            }
          }
        });
        await Promise.all(imagePromises);
      }

      // Save to history
      const saved = getItem<{ id: string; title: string; slideCount: number; format: string; style: string; createdAt: string }[]>('generated_presentations', []);
      saved.push({
        id: crypto.randomUUID(),
        title: parsed.title,
        slideCount: parsed.slides.length,
        format,
        style,
        createdAt: new Date().toISOString(),
      });
      setItem('generated_presentations', saved);
      setItem('last_active_date', new Date().toISOString().slice(0, 10));

      setPresentation(parsed);
      setCurrentSlide(0);
      setViewMode('slide');
      toast.success(`Created ${parsed.slides.length} slides!`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    }
    setLoading(false);
  };

  const loadDemo = () => {
    const demo: Presentation = {
      title: 'CDL Study Tool — Your AI Study Partner',
      slides: [
        {
          layout: 'title',
          title: 'CDL Study Tool',
          bullets: ['The AI-powered study platform that learns how YOU write'],
          notes: 'Welcome slide — introduce CDL Study Tool as a personalized AI study companion.',
        },
        {
          layout: 'bento_grid',
          title: 'Everything You Need to Study',
          bullets: [],
          notes: 'Showcase the key features in a modern bento grid layout.',
          bentoItems: [
            { icon: '🎙', title: 'Record Lectures', desc: 'Record or upload — AI summarizes everything', span: 'wide' },
            { icon: '📝', title: 'Smart Exercises', desc: 'Practice questions from your lessons', span: 'normal' },
            { icon: '🎬', title: 'Brainrot Video', desc: 'TikTok-style study podcasts', span: 'normal' },
            { icon: '🎨', title: 'Pro Presentations', desc: '21 layouts, 10 color schemes, PPTX export', span: 'normal' },
            { icon: '✍️', title: 'Essay Writer', desc: 'Generates in YOUR writing style', span: 'normal' },
          ],
        },
        {
          layout: 'highlight_box',
          title: 'Powered by Free AI',
          bullets: ['No API key needed', 'Works out of the box', '7 providers supported'],
          notes: 'Emphasize that CDL Study is free to use with the built-in AI.',
          highlightValue: '100% Free',
          highlightLabel: 'Built-in AI — no setup required',
        },
        {
          layout: 'closing',
          title: 'Get Started',
          statement: 'Start studying smarter today',
          bullets: ['Visit CDL Study Tool — free for everyone'],
          notes: 'Call to action — encourage users to try the tool.',
        },
      ],
    };
    setPresentation(demo);
    setCurrentSlide(0);
    setViewMode('slide');
    toast.success('Demo presentation loaded!');
  };

  const goToSlide = (idx: number) => {
    if (presentation && idx >= 0 && idx < presentation.slides.length) {
      setCurrentSlide(idx);
      setViewMode('slide');
    }
  };

  const toggleFullscreen = () => {
    if (!fullscreen && presentRef.current) { presentRef.current.requestFullscreen?.(); setFullscreen(true); }
    else if (document.fullscreenElement) { document.exitFullscreen?.(); setFullscreen(false); }
  };

  const exportAsText = () => {
    if (!presentation) return;
    let text = `# ${presentation.title}\n\n`;
    presentation.slides.forEach((s, i) => {
      text += `## Slide ${i + 1}: ${s.title}\n\n`;
      s.bullets.forEach(b => { text += `- ${b}\n`; });
      if (s.imageDescription) text += `\n[Image: ${s.imageDescription}]\n`;
      if (s.quote) text += `\n> "${s.quote}" — ${s.quoteAuthor || 'Unknown'}\n`;
      if (s.stats) { text += '\n'; s.stats.forEach(st => { text += `**${st.value}** — ${st.label}\n`; }); }
      if (s.steps) { text += '\n'; s.steps.forEach((st, j) => { text += `${j + 1}. **${st.label}**: ${st.description}\n`; }); }
      if (s.timelineItems) { text += '\n'; s.timelineItems.forEach(t => { text += `- **${t.date}**: ${t.event}\n`; }); }
      text += `\nNotes: ${s.notes}\n\n---\n\n`;
    });
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${presentation.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Downloaded as Markdown');
  };

  const exportAsHTML = () => {
    if (!presentation) return;
    const schemeColors = COLOR_SCHEMES.find(c => c.value === colorScheme)?.colors || COLOR_SCHEMES[0].colors;
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${presentation.title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0}
.slide{width:100vw;height:100vh;display:flex;flex-direction:column;justify-content:center;padding:8vh 10vw;scroll-snap-align:start}
.slide h2{font-size:3rem;margin-bottom:1.5rem;color:${schemeColors[0]}}
.slide h3{font-size:1.5rem;color:${schemeColors[1]};margin-bottom:1rem}
.slide ul{list-style:none;font-size:1.25rem;line-height:2}
.slide ul li::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:${schemeColors[2]};margin-right:12px}
.slide blockquote{font-size:1.75rem;font-style:italic;border-left:4px solid ${schemeColors[0]};padding-left:1.5rem;margin:2rem 0}
html{scroll-snap-type:y mandatory;overflow-y:scroll}
</style></head><body>\n`;
    presentation.slides.forEach(s => {
      html += `<div class="slide"><h2>${s.title}</h2>\n`;
      if (s.bullets.length) { html += '<ul>'; s.bullets.forEach(b => { html += `<li>${b}</li>`; }); html += '</ul>\n'; }
      if (s.quote) html += `<blockquote>"${s.quote}" — ${s.quoteAuthor || ''}</blockquote>\n`;
      html += '</div>\n';
    });
    html += '</body></html>';
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${presentation.title.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Downloaded as HTML slideshow');
  };

  const [exporting, setExporting] = useState(false);

  const exportPPTX = async () => {
    if (!presentation) return;
    setExporting(true);
    try {
      const colors = COLOR_SCHEMES.find(c => c.value === colorScheme)?.colors || COLOR_SCHEMES[0].colors;
      await exportAsPPTX({ presentation, colors });
      toast.success('Downloaded as PowerPoint!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'PPTX export failed');
    }
    setExporting(false);
  };

  const slide = presentation?.slides[currentSlide];

  /* ── Slide Renderer ── */

  const schemeColors = COLOR_SCHEMES.find(c => c.value === colorScheme)?.colors || COLOR_SCHEMES[0].colors;
  const gradientBg = isGradientSlide;
  const txtClass = (layout: string) => gradientBg(layout) ? 'text-white' : 'text-text-primary';
  const subtxtClass = (layout: string) => gradientBg(layout) ? 'text-white/70' : 'text-text-secondary';

  const renderSlide = (s: Slide) => {
    switch (s.layout) {
      case 'title':
        return (
          <div className="flex h-full flex-col items-center justify-center text-center relative overflow-hidden">
            <motion.div className="absolute top-6 right-8 w-32 h-32 rounded-full opacity-10"
              animate={{ y: [0, -12, 0], scale: [1, 1.05, 1] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ background: schemeColors[2] }} />
            <motion.div className="absolute bottom-8 left-6 w-20 h-20 rounded-full opacity-10"
              animate={{ y: [0, 10, 0], x: [0, 6, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ background: schemeColors[1] }} />
            <motion.h3 initial={{ opacity: 0, y: 40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              className={`mb-4 text-3xl font-extrabold sm:text-5xl leading-tight ${txtClass(s.layout)}`}>{s.title}</motion.h3>
            {s.bullets[0] && <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.3 }}
              className={`text-lg ${subtxtClass(s.layout)}`}>{s.bullets[0]}</motion.p>}
          </div>
        );
      case 'big_statement':
        return (
          <div className="flex h-full flex-col items-center justify-center text-center relative overflow-hidden px-8">
            <motion.div className="absolute bottom-10 right-10 w-40 h-40 rounded-full opacity-10"
              animate={{ scale: [1, 1.15, 1], rotate: [0, 8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ background: schemeColors[2] }} />
            <motion.div className="absolute top-8 left-12 w-24 h-24 rounded-full opacity-[0.07]"
              animate={{ y: [0, -15, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ background: schemeColors[1] }} />
            {s.title && <motion.p initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 100, damping: 15 }}
              className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">{s.title}</motion.p>}
            <motion.p initial={{ opacity: 0, scale: 0.85, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 100, damping: 16, delay: 0.15 }}
              className="text-3xl font-extrabold text-white sm:text-5xl leading-tight max-w-2xl">{s.statement || s.bullets[0] || s.title}</motion.p>
          </div>
        );
      case 'closing':
        return (
          <div className="flex h-full flex-col items-center justify-center text-center relative overflow-hidden px-8">
            <motion.div className="absolute top-8 left-10 w-24 h-24 rounded-full opacity-10"
              animate={{ y: [0, -10, 0], scale: [1, 1.1, 1] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ background: schemeColors[2] }} />
            <motion.div className="absolute bottom-6 right-8 w-36 h-36 rounded-full opacity-10"
              animate={{ y: [0, 12, 0], x: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ background: schemeColors[0] }} />
            <motion.p initial={{ opacity: 0, y: 50, scale: 0.85 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 100, damping: 16 }}
              className="text-4xl font-extrabold text-white sm:text-5xl mb-4">{s.statement || s.title}</motion.p>
            {s.bullets[0] && <motion.p initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.35 }}
              className="text-lg text-white/60">{s.bullets[0]}</motion.p>}
          </div>
        );
      case 'highlight_box':
        return (
          <div className="flex h-full flex-col items-center justify-center text-center relative overflow-hidden">
            <motion.div className="absolute top-8 right-12 w-28 h-28 rounded-full opacity-[0.08]"
              animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ background: schemeColors[2] }} />
            <motion.h3 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              className={`mb-6 text-lg font-semibold ${txtClass(s.layout)}`}>{s.title}</motion.h3>
            <motion.div initial={{ opacity: 0, scale: 0.7, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 100, damping: 15, delay: 0.2 }}
              className="rounded-2xl px-12 py-10 mb-6 backdrop-blur-md border border-white/10 shadow-2xl" style={{ background: `${schemeColors[0]}30` }}>
              <p className="text-5xl font-extrabold text-white sm:text-6xl">{s.highlightValue || s.bullets[0]}</p>
              <p className="mt-3 text-sm text-white/60 font-medium">{s.highlightLabel}</p>
            </motion.div>
            {s.bullets.length > 0 && (
              <div className="space-y-1">
                {s.bullets.slice(s.highlightValue ? 0 : 1).map((b, i) => (
                  <motion.p key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.08 }}
                    className="text-sm text-white/50">{b}</motion.p>
                ))}
              </div>
            )}
          </div>
        );
      case 'icon_grid':
        return (
          <div className="flex h-full flex-col justify-center">
            <motion.h3 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              className="mb-8 text-2xl font-bold text-text-primary text-center">{s.title}</motion.h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {(s.iconItems || []).map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 40, scale: 0.85 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.15 + i * 0.12 }}
                  className="rounded-xl border border-border/50 bg-bg-secondary/80 backdrop-blur-sm p-4 text-center hover:border-accent/30 hover:shadow-lg transition-all">
                  <span className="text-2xl mb-2 block">{item.icon}</span>
                  <p className="text-sm font-bold text-text-primary mb-1">{item.title}</p>
                  <p className="text-xs text-text-muted leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        );
      case 'feature_cards':
        return (
          <div className="flex h-full flex-col justify-center">
            <motion.h3 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              className="mb-8 text-2xl font-bold text-text-primary text-center">{s.title}</motion.h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {(s.featureCards || []).map((card, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 50, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.2 + i * 0.15 }}
                  className="rounded-xl bg-bg-secondary/80 backdrop-blur-sm p-5 border-t-4 shadow-lg hover:shadow-xl transition-shadow" style={{ borderTopColor: schemeColors[i % schemeColors.length] }}>
                  <span className="text-2xl mb-3 block">{card.icon}</span>
                  <p className="text-sm font-bold text-text-primary mb-2">{card.title}</p>
                  <p className="text-xs text-text-muted leading-relaxed">{card.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        );
      case 'bento_grid':
        return (
          <div className="flex h-full flex-col justify-center">
            <motion.h3 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              className="mb-6 text-2xl font-bold text-text-primary text-center">{s.title}</motion.h3>
            <div className="grid grid-cols-3 grid-rows-2 gap-3 auto-rows-fr" style={{ minHeight: '60%' }}>
              {(s.bentoItems || []).map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.75, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.15 + i * 0.12 }}
                  className={`rounded-xl p-4 flex flex-col justify-center ${
                    item.span === 'wide' ? 'col-span-2' : item.span === 'tall' ? 'row-span-2' : ''
                  }`}
                  style={{ background: i === 0 ? schemeColors[0] : i === 1 ? `${schemeColors[1]}20` : i === 2 ? `${schemeColors[0]}15` : `${schemeColors[2]}15` }}>
                  <span className="text-xl mb-1">{item.icon}</span>
                  <p className={`text-sm font-bold mb-0.5 ${i === 0 ? 'text-white' : 'text-text-primary'}`}>{item.title}</p>
                  <p className={`text-xs leading-relaxed ${i === 0 ? 'text-white/70' : 'text-text-muted'}`}>{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        );
      case 'split_image':
        return (
          <div className="flex h-full flex-col justify-center">
            <div className="grid grid-cols-2 gap-0 rounded-xl overflow-hidden h-full">
              <motion.div initial={{ opacity: 0, x: -60 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                className="flex flex-col justify-center p-8" style={{ background: schemeColors[0] }}>
                <h3 className="text-2xl font-bold text-white mb-4">{s.title}</h3>
                <ul className="space-y-2">
                  {s.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/50" />{b}
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.2 }}>
                {s.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.imageUrl} alt={s.imageDescription || ''} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full flex items-center justify-center bg-bg-secondary">
                    <p className="text-sm italic text-text-muted text-center px-4">{s.imageDescription || 'Image'}</p>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        );
      case 'full_image':
        return (
          <div className="relative flex h-full items-end justify-start overflow-hidden rounded-xl">
            {s.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.imageUrl} alt={s.imageDescription || ''} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-bg-secondary" />
            )}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 40%, transparent 100%)' }} />
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 100, damping: 16, delay: 0.2 }}
              className="relative z-10 p-8">
              {/* Luis Urrutia technique: semi-transparent frosted shape behind text */}
              <div className="inline-block rounded-xl bg-black/30 backdrop-blur-md px-6 py-4 border border-white/10">
                <h3 className="text-3xl font-extrabold text-white mb-2">{s.title}</h3>
                {(s.overlayText || s.bullets[0]) && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                  className="text-base text-white/80">{s.overlayText || s.bullets[0]}</motion.p>}
              </div>
            </motion.div>
          </div>
        );
      case 'numbered_list':
        return (
          <div className="flex h-full flex-col justify-center">
            <motion.h3 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              className="mb-8 text-2xl font-bold text-text-primary">{s.title}</motion.h3>
            <div className="space-y-5">
              {(s.numberedItems || []).map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.15 + i * 0.12 }}
                  className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-white" style={{ background: schemeColors[0] }}>
                    {item.number || String(i + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-text-primary">{item.title}</p>
                    <p className="text-sm text-text-secondary mt-0.5">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );
      case 'two_column_text':
        return (
          <div className="flex h-full flex-col justify-center">
            <motion.h3 initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="mb-6 text-2xl font-bold text-text-primary">{s.title}</motion.h3>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="mb-3 text-sm font-bold uppercase tracking-wide" style={{ color: schemeColors[0] }}>{s.leftLabel || 'Column A'}</h4>
                <ul className="space-y-2">{(s.leftColumn || []).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: schemeColors[0] }} />{item}</li>
                ))}</ul>
              </div>
              <div className="border-l border-border pl-8">
                <h4 className="mb-3 text-sm font-bold uppercase tracking-wide" style={{ color: schemeColors[1] }}>{s.rightLabel || 'Column B'}</h4>
                <ul className="space-y-2">{(s.rightColumn || []).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: schemeColors[1] }} />{item}</li>
                ))}</ul>
              </div>
            </div>
          </div>
        );
      case 'process_flow':
        return (
          <div className="flex h-full flex-col justify-center">
            <motion.h3 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              className="mb-8 text-2xl font-bold text-text-primary text-center">{s.title}</motion.h3>
            <div className="flex items-start justify-center gap-2 flex-wrap">
              {(s.processSteps || []).map((step, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 30, scale: 0.85 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.2 + i * 0.15 }}
                  className="flex items-center gap-2">
                  <div className="flex flex-col items-center text-center w-28">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white mb-2" style={{ background: schemeColors[i % schemeColors.length] }}>
                      {i + 1}
                    </div>
                    <p className="text-xs font-bold text-text-primary">{step.label}</p>
                    <p className="text-[10px] text-text-muted mt-0.5 leading-tight">{step.desc}</p>
                  </div>
                  {i < (s.processSteps || []).length - 1 && (
                    <svg className="h-4 w-4 text-text-muted shrink-0 mt-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        );
      case 'agenda':
        return (
          <div className="flex h-full flex-col justify-center">
            <motion.h3 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              className="mb-8 text-2xl font-bold text-text-primary">{s.title}</motion.h3>
            <div className="space-y-4 border-l-3 pl-6" style={{ borderLeftColor: `${schemeColors[0]}40` }}>
              {(s.agendaItems || []).map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.15 + i * 0.12 }}
                  className="flex items-start gap-4">
                  <span className="text-2xl font-extrabold" style={{ color: schemeColors[0] }}>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="text-sm font-bold text-text-primary">{item.title}</p>
                    {item.desc && <p className="text-xs text-text-muted mt-0.5">{item.desc}</p>}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );
      case 'quote':
        return (
          <div className="flex h-full flex-col items-center justify-center text-center px-8">
            <svg className="mb-4 h-8 w-8 text-accent/40" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" /></svg>
            <blockquote className="mb-4 text-xl font-medium italic text-text-primary sm:text-2xl leading-relaxed">&ldquo;{s.quote}&rdquo;</blockquote>
            {s.quoteAuthor && <p className="text-sm text-accent">— {s.quoteAuthor}</p>}
          </div>
        );
      case 'comparison':
        return (
          <div className="flex h-full flex-col justify-center">
            <h3 className="mb-6 text-2xl font-bold text-text-primary">{s.title}</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="rounded-xl bg-bg-secondary p-5">
                <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-accent">{s.leftLabel || 'Option A'}</h4>
                <ul className="space-y-2">{(s.leftColumn || []).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{item}</li>
                ))}</ul>
              </div>
              <div className="rounded-xl bg-bg-secondary p-5">
                <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-accent-secondary">{s.rightLabel || 'Option B'}</h4>
                <ul className="space-y-2">{(s.rightColumn || []).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-secondary" />{item}</li>
                ))}</ul>
              </div>
            </div>
          </div>
        );
      case 'image_text':
        return (
          <div className="flex h-full flex-col justify-center">
            <h3 className="mb-6 text-2xl font-bold text-text-primary">{s.title}</h3>
            <div className="grid grid-cols-2 gap-6">
              {s.imageUrl ? (
                <div className="overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.imageUrl} alt={s.imageDescription || ''} className="h-full w-full object-cover rounded-xl" />
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-bg-secondary p-6">
                  <p className="text-sm italic text-text-muted text-center">{s.imageDescription || 'Image'}</p>
                </div>
              )}
              <ul className="space-y-3">{s.bullets.map((b, i) => (
                <motion.li key={i} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.2 + i * 0.1 }}
                  className="flex items-start gap-3 text-sm text-text-secondary"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />{b}</motion.li>
              ))}</ul>
            </div>
          </div>
        );
      case 'section':
        return (
          <div className="flex h-full flex-col items-center justify-center text-center relative overflow-hidden">
            <motion.div className="absolute top-10 right-12 w-28 h-28 rounded-full opacity-10"
              animate={{ y: [0, -10, 0], rotate: [0, 5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ background: schemeColors[2] }} />
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ type: 'spring', stiffness: 150, damping: 15, delay: 0.1 }} className="mb-6 h-1 w-20 rounded-full bg-white/40" />
            <motion.h3 initial={{ opacity: 0, y: 40, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.25 }}
              className="text-3xl font-extrabold text-white sm:text-4xl">{s.title}</motion.h3>
          </div>
        );
      case 'timeline':
        return (
          <div className="flex h-full flex-col justify-center">
            <h3 className="mb-6 text-2xl font-bold text-text-primary">{s.title}</h3>
            <div className="relative space-y-5 pl-6 border-l-2" style={{ borderLeftColor: `${schemeColors[0]}40` }}>
              {(s.timelineItems || []).map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.15 + i * 0.12 }}
                  className="relative">
                  <div className="absolute -left-[25px] top-1 h-3 w-3 rounded-full" style={{ background: schemeColors[0] }} />
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: schemeColors[0] }}>{item.date}</p>
                  <p className="text-sm text-text-secondary mt-0.5">{item.event}</p>
                </motion.div>
              ))}
            </div>
          </div>
        );
      case 'stats':
        return (
          <div className="flex h-full flex-col justify-center">
            <h3 className="mb-8 text-2xl font-bold text-text-primary text-center">{s.title}</h3>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {(s.stats || []).map((stat, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 40, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.2 + i * 0.15 }}
                  className="text-center rounded-xl bg-bg-secondary/80 backdrop-blur-sm p-4 shadow-lg">
                  <p className="text-3xl font-extrabold" style={{ color: schemeColors[0] }}>{stat.value}</p>
                  <p className="mt-1 text-sm text-text-muted">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        );
      case 'steps':
        return (
          <div className="flex h-full flex-col justify-center">
            <h3 className="mb-6 text-2xl font-bold text-text-primary">{s.title}</h3>
            <div className="space-y-4">
              {(s.steps || []).map((step, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -30, y: 10 }} animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.15 + i * 0.12 }}
                  className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: schemeColors[0] }}>{i + 1}</div>
                  <div className="flex-1 border-b border-border pb-3">
                    <p className="text-sm font-bold text-text-primary">{step.label}</p>
                    <p className="text-sm text-text-secondary mt-0.5">{step.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );
      default: // content
        return (
          <div className="flex h-full flex-col justify-center">
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="mb-1 text-xs font-medium text-text-muted uppercase tracking-wide">Slide {currentSlide + 1} of {presentation!.slides.length}</motion.p>
            <motion.h3 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}
              className="mb-6 text-2xl font-bold text-text-primary sm:text-3xl">{s.title}</motion.h3>
            <div className={s.imageDescription ? 'grid grid-cols-3 gap-6' : ''}>
              <ul className={`space-y-3 ${s.imageDescription ? 'col-span-2' : ''}`}>
                {s.bullets.map((b, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -25 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 120, damping: 16, delay: 0.2 + i * 0.1 }}
                    className="flex items-start gap-3 text-base text-text-secondary"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />{b}</motion.li>
                ))}
              </ul>
              {s.imageDescription && (
                s.imageUrl ? (
                  <div className="overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.imageUrl} alt={s.imageDescription} className="h-full w-full object-cover rounded-xl" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-bg-secondary p-4">
                    <p className="text-xs italic text-text-muted text-center">{s.imageDescription}</p>
                  </div>
                )
              )}
            </div>
          </div>
        );
    }
  };

  /* ── Pill selector helper ── */
  const PillSelect = ({ options, value, onChange, columns = '' }: {
    options: string[];
    value: string;
    onChange: (v: string) => void;
    columns?: string;
  }) => (
    <div className={`flex flex-wrap gap-2 ${columns}`}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${value === opt ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:bg-bg-hover'}`}
        >{opt}</button>
      ))}
    </div>
  );

  /* ── Render ── */

  return (
    <motion.div className="mx-auto max-w-5xl" {...fadeInUp}>
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold gradient-text inline-block">Presentation Maker</h1>
        <p className="text-text-secondary">Create professional presentations in your style</p>
      </div>

      {!presentation ? (
        <motion.div className="mx-auto max-w-3xl" variants={staggerContainer} initial="initial" animate="animate">
          <motion.div className="rounded-xl border border-border bg-bg-card p-6" style={{ boxShadow: 'var(--card-shadow)' }} variants={staggerItem}>
            <div className="space-y-5">
              {/* Topic */}
              <div>
                <label className="mb-1 block text-sm font-medium text-text-primary">Topic</label>
                <textarea value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="What should the presentation be about? Be as specific as you want..."
                  rows={3}
                  className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-ring resize-none" />
              </div>

              {/* Row: Format + Language */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-primary">Format</label>
                  <select value={format} onChange={(e) => setFormat(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary outline-none focus:border-ring">
                    {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label} — {f.desc}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-primary">Language</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary outline-none focus:border-ring">
                    {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Row: Level + Audience */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-primary">Level</label>
                  <select value={level} onChange={(e) => setLevel(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary outline-none focus:border-ring">
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-text-primary">Audience</label>
                  <select value={audience} onChange={(e) => setAudience(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary outline-none focus:border-ring">
                    {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Slide Count */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-text-primary">Slides</label>
                  <span className="text-sm font-bold text-accent">{slideCount}</span>
                </div>
                <input type="range" min={3} max={20} value={slideCount} onChange={(e) => setSlideCount(Number(e.target.value))}
                  className="w-full accent-accent" />
                <div className="flex justify-between text-[10px] text-text-muted mt-0.5"><span>3</span><span>20</span></div>
              </div>

              {/* Style pills */}
              <div>
                <label className="mb-2 block text-sm font-medium text-text-primary">Style</label>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {STYLES.map(s => (
                    <button key={s.value} onClick={() => setStyle(s.value)}
                      className={`rounded-lg py-2 px-2 text-center transition-all ${style === s.value ? 'bg-accent text-white ring-2 ring-accent/30' : 'border border-border text-text-secondary hover:bg-bg-hover'}`}>
                      <p className="text-xs font-semibold">{s.value}</p>
                      <p className="text-[10px] opacity-70 mt-0.5">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone pills */}
              <div>
                <label className="mb-2 block text-sm font-medium text-text-primary">Tone</label>
                <PillSelect options={TONES} value={tone} onChange={setTone} />
              </div>

              {/* Color Scheme */}
              <div>
                <label className="mb-2 block text-sm font-medium text-text-primary">Color Scheme</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_SCHEMES.map(c => (
                    <button key={c.value} onClick={() => setColorScheme(c.value)}
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${colorScheme === c.value ? 'bg-accent text-white ring-2 ring-accent/30' : 'border border-border text-text-secondary hover:bg-bg-hover'}`}>
                      <span className="flex gap-0.5">
                        {c.colors.map((col, i) => (
                          <span key={i} className="h-3 w-3 rounded-full" style={{ backgroundColor: col }} />
                        ))}
                      </span>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Density */}
              <div>
                <label className="mb-2 block text-sm font-medium text-text-primary">Content Density</label>
                <div className="grid grid-cols-3 gap-2">
                  {CONTENT_DENSITY.map(d => (
                    <button key={d.value} onClick={() => setContentDensity(d.value)}
                      className={`rounded-lg py-2 text-center transition-all ${contentDensity === d.value ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:bg-bg-hover'}`}>
                      <p className="text-xs font-semibold">{d.label}</p>
                      <p className="text-[10px] opacity-70">{d.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Images */}
              <div>
                <label className="mb-2 block text-sm font-medium text-text-primary">Images</label>
                <div className="flex gap-3">
                  <button onClick={() => setImageSource('descriptions')}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${imageSource === 'descriptions' ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:bg-bg-hover'}`}>
                    With Descriptions
                  </button>
                  <button onClick={() => setImageSource('none')}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${imageSource === 'none' ? 'bg-accent text-white' : 'border border-border text-text-secondary hover:bg-bg-hover'}`}>
                    Text Only
                  </button>
                </div>
              </div>

              {/* Advanced Options Toggle */}
              <button onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex w-full items-center justify-between rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">
                <span>Advanced Options</span>
                <svg className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    {/* Transition */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-text-primary">Transition Style</label>
                      <PillSelect options={TRANSITIONS.map(t => t.label)} value={TRANSITIONS.find(t => t.value === transition)?.label || 'Fade'} onChange={(v) => setTransition(TRANSITIONS.find(t => t.label === v)?.value || 'fade')} />
                    </div>

                    {/* Include toggles */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-text-primary">Include Special Slides</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'Table of Contents', state: includeTOC, set: setIncludeTOC },
                          { label: 'Summary Slide', state: includeSummary, set: setIncludeSummary },
                          { label: 'Key Takeaways', state: includeTakeaways, set: setIncludeTakeaways },
                          { label: 'References', state: includeReferences, set: setIncludeReferences },
                        ].map(toggle => (
                          <button key={toggle.label} onClick={() => toggle.set(!toggle.state)}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${toggle.state ? 'bg-accent/10 text-accent border border-accent/30' : 'border border-border text-text-muted hover:bg-bg-hover'}`}>
                            <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${toggle.state ? 'bg-accent border-accent' : 'border-border'}`}>
                              {toggle.state && <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </span>
                            {toggle.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Instructions */}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-text-primary">Custom Instructions</label>
                      <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)}
                        placeholder="Any additional instructions for the AI... (e.g., 'Focus on real-world examples', 'Include data visualizations')"
                        rows={3}
                        className="w-full rounded-lg border border-border bg-bg-input px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-ring resize-none" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Style profile badge */}
              {hasProfile && (
                <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2">
                  <svg className="h-4 w-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  <p className="text-xs text-success font-medium">Style profile loaded — {profile.confidence}% confidence</p>
                </div>
              )}

              {/* Generate Button */}
              <div className="flex gap-3">
                <button onClick={generatePresentation} disabled={loading || !topic.trim()}
                  className="flex-1 rounded-lg bg-accent py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {loading ? <><LoadingSpinner className="h-4 w-4" /> Generating...</> : 'Generate Presentation'}
                </button>
                <button onClick={loadDemo}
                  className="rounded-lg border border-border px-4 py-3 text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors">
                  Load Demo
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : (
        <div>
          {/* Toolbar */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-text-primary">{presentation.title}</h2>
            <div className="flex flex-wrap gap-2">
              {/* View mode buttons */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(['slide', 'grid', 'outline'] as const).map(mode => (
                  <button key={mode} onClick={() => setViewMode(mode)}
                    className={`px-3 py-1.5 text-xs capitalize transition-colors ${viewMode === mode ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-hover'}`}>{mode}</button>
                ))}
              </div>
              <button onClick={() => setShowNotes(!showNotes)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover">{showNotes ? 'Hide Notes' : 'Notes'}</button>
              <button onClick={exportPPTX} disabled={exporting} className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-40">{exporting ? 'Exporting...' : 'Export PPTX'}</button>
              <button onClick={exportAsText} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover">Export MD</button>
              <button onClick={exportAsHTML} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover">Export HTML</button>
              <button onClick={toggleFullscreen} className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover">Fullscreen</button>
              <button onClick={() => setPresentation(null)} className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20">New</button>
            </div>
          </div>

          {/* View: Slide */}
          {viewMode === 'slide' && (
            <div ref={presentRef} className={fullscreen ? 'fixed inset-0 z-50 flex flex-col bg-bg-primary p-8' : ''}>
              {/* True morph: slides overlap during transition (like PowerPoint morph) */}
              <div className={`relative ${fullscreen ? 'flex-1' : 'aspect-video'}`}>
                <AnimatePresence>
                  {slide && (
                    <motion.div
                      key={currentSlide}
                      initial={{ opacity: 0, ...(TRANSITION_VARIANTS[transition]?.in || {}) }}
                      animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, ...(TRANSITION_VARIANTS[transition]?.out || {}) }}
                      transition={TRANSITION_TIMING[transition] || { duration: 0.5 }}
                      className={`absolute inset-0 rounded-xl ${isGradientSlide(slide.layout) ? '' : 'border border-border bg-bg-card'} p-8 sm:p-12 overflow-hidden`}
                      style={{
                        boxShadow: 'var(--card-shadow)',
                        ...(getSlideBackground(slide.layout, schemeColors) ? { background: getSlideBackground(slide.layout, schemeColors) } : {}),
                      }}
                    >
                      <div className="h-full">{renderSlide(slide)}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {showNotes && slide && (
                <div className="mt-3 rounded-lg border border-border bg-bg-secondary p-4">
                  <p className="text-xs font-medium text-text-muted mb-1">Speaker Notes</p>
                  <p className="text-sm text-text-secondary">{slide.notes}</p>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                <button onClick={() => goToSlide(currentSlide - 1)} disabled={currentSlide === 0}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
                <div className="flex gap-1.5 items-center">
                  {presentation.slides.map((_, i) => (
                    <motion.button key={i} onClick={() => setCurrentSlide(i)}
                      animate={{ width: i === currentSlide ? 28 : 8, backgroundColor: i === currentSlide ? 'var(--color-accent)' : 'var(--color-border)' }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      className="h-2 rounded-full hover:opacity-80" />
                  ))}
                </div>
                <button onClick={() => goToSlide(currentSlide + 1)} disabled={currentSlide >= presentation.slides.length - 1}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
              </div>

              {fullscreen && (
                <button onClick={toggleFullscreen} className="absolute top-4 right-4 rounded-lg bg-bg-hover p-2 text-text-muted hover:text-text-primary">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          )}

          {/* View: Grid */}
          {viewMode === 'grid' && (
            <motion.div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" variants={staggerContainer} initial="initial" animate="animate">
              {presentation.slides.map((s, i) => (
                <motion.button key={i} variants={staggerItem} onClick={() => goToSlide(i)}
                  className={`rounded-xl border p-4 text-left transition-all aspect-video flex flex-col justify-between ${i === currentSlide ? 'border-accent bg-accent/5 ring-2 ring-accent/20' : 'border-border bg-bg-card hover:border-text-muted'}`}
                  style={{ boxShadow: 'var(--card-shadow)' }}>
                  <div>
                    <p className="text-xs font-bold text-text-primary line-clamp-2">{s.title}</p>
                    {s.bullets[0] && <p className="mt-1 text-[10px] text-text-muted line-clamp-2">{s.bullets[0]}</p>}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-text-muted font-medium uppercase">{s.layout}</span>
                    <span className="text-[10px] text-text-muted">{i + 1}</span>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}

          {/* View: Outline */}
          {viewMode === 'outline' && (
            <div className="rounded-xl border border-border bg-bg-card p-6 space-y-3" style={{ boxShadow: 'var(--card-shadow)' }}>
              {presentation.slides.map((s, i) => (
                <button key={i} onClick={() => goToSlide(i)}
                  className={`w-full flex items-start gap-4 rounded-lg px-4 py-3 text-left transition-all ${i === currentSlide ? 'bg-accent/10 border border-accent/30' : 'hover:bg-bg-hover border border-transparent'}`}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-hover text-xs font-bold text-text-muted">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{s.title}</p>
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-1">
                      {s.layout === 'quote' ? `"${s.quote}"` : s.bullets.join(' | ')}
                    </p>
                    {showNotes && <p className="text-xs text-text-muted mt-1 italic">{s.notes}</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-bg-hover px-2 py-0.5 text-[10px] text-text-muted uppercase">{s.layout}</span>
                </button>
              ))}
            </div>
          )}

          {/* Thumbnail strip (slide view only) */}
          {viewMode === 'slide' && (
            <div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
              {presentation.slides.map((s, i) => (
                <button key={i} onClick={() => setCurrentSlide(i)}
                  className={`rounded-lg border p-2 text-left transition-all ${i === currentSlide ? 'border-accent bg-accent/5' : 'border-border hover:border-text-muted'}`}>
                  <p className="text-[10px] font-bold text-text-primary line-clamp-1">{s.title}</p>
                  <p className="mt-0.5 text-[8px] text-text-muted">{s.layout}</p>
                </button>
              ))}
            </div>
          )}

          {/* Keyboard hint */}
          <p className="mt-4 text-center text-[10px] text-text-muted">Use arrow keys or spacebar to navigate slides</p>
        </div>
      )}
    </motion.div>
  );
}
