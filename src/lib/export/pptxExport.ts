interface Slide {
  layout: string;
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
  bentoItems?: { icon: string; title: string; desc: string; span?: string }[];
}

interface Presentation {
  title: string;
  slides: Slide[];
}

const GRADIENT_LAYOUTS = new Set(['big_statement', 'section', 'closing', 'title', 'highlight_box']);

function hexToRgb(hex: string): string {
  return hex.replace('#', '');
}

export async function exportAsPPTX({
  presentation,
  colors,
}: {
  presentation: Presentation;
  colors: string[];
}) {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();

  pptx.title = presentation.title;
  pptx.author = 'CDL Study Tool';
  pptx.layout = 'LAYOUT_WIDE';

  const c1 = hexToRgb(colors[0]);
  const c2 = hexToRgb(colors[1]);
  const c3 = hexToRgb(colors[2]);

  for (const s of presentation.slides) {
    const slide = pptx.addSlide();
    const isGradient = GRADIENT_LAYOUTS.has(s.layout);

    if (isGradient) {
      slide.background = { color: c1 };
    }

    if (s.notes) slide.addNotes(s.notes);

    slide.addText('', { x: 0, y: 0, w: 0, h: 0 });

    switch (s.layout) {
      case 'title':
        slide.background = { color: c1 };
        slide.addText(s.title, { x: 0.8, y: 1.5, w: 11.5, h: 2, fontSize: 44, fontFace: 'Arial', bold: true, color: 'FFFFFF', align: 'center' });
        if (s.bullets[0]) {
          slide.addText(s.bullets[0], { x: 0.8, y: 3.8, w: 11.5, h: 1, fontSize: 20, fontFace: 'Arial', color: 'FFFFFF', align: 'center', transparency: 30 });
        }
        break;

      case 'big_statement':
        slide.background = { color: c1 };
        if (s.title) {
          slide.addText(s.title, { x: 0.8, y: 1.2, w: 11.5, h: 0.6, fontSize: 12, fontFace: 'Arial', bold: true, color: 'FFFFFF', align: 'center', transparency: 50 });
        }
        slide.addText(s.statement || s.bullets[0] || '', {
          x: 1, y: 2, w: 11, h: 3.5, fontSize: 40, fontFace: 'Arial', bold: true, color: 'FFFFFF', align: 'center', valign: 'middle',
        });
        break;

      case 'closing':
        slide.background = { color: c2 };
        slide.addText(s.statement || s.title, {
          x: 1, y: 2, w: 11, h: 3, fontSize: 44, fontFace: 'Arial', bold: true, color: 'FFFFFF', align: 'center', valign: 'middle',
        });
        if (s.bullets[0]) {
          slide.addText(s.bullets[0], { x: 1, y: 5.2, w: 11, h: 0.8, fontSize: 18, fontFace: 'Arial', color: 'FFFFFF', align: 'center', transparency: 40 });
        }
        break;

      case 'section':
        slide.background = { color: c1 };
        slide.addShape(pptx.ShapeType.rect, { x: 5.5, y: 3.1, w: 2, h: 0.08, fill: { color: 'FFFFFF', transparency: 60 } });
        slide.addText(s.title, {
          x: 1, y: 3.4, w: 11, h: 1.5, fontSize: 36, fontFace: 'Arial', bold: true, color: 'FFFFFF', align: 'center',
        });
        break;

      case 'highlight_box':
        slide.background = { color: c1 };
        slide.addText(s.title, { x: 0.8, y: 0.8, w: 11.5, h: 0.8, fontSize: 18, fontFace: 'Arial', bold: true, color: 'FFFFFF', align: 'center' });
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 3, y: 2, w: 7, h: 3, fill: { color: c3, transparency: 70 }, rectRadius: 0.3,
        });
        slide.addText(s.highlightValue || s.bullets[0] || '', {
          x: 3, y: 2.2, w: 7, h: 2, fontSize: 48, fontFace: 'Arial', bold: true, color: 'FFFFFF', align: 'center', valign: 'middle',
        });
        if (s.highlightLabel) {
          slide.addText(s.highlightLabel, { x: 3, y: 4, w: 7, h: 0.7, fontSize: 14, fontFace: 'Arial', color: 'FFFFFF', align: 'center', transparency: 40 });
        }
        break;

      case 'content':
        slide.addText(s.title, { x: 0.8, y: 0.5, w: 11.5, h: 1, fontSize: 28, fontFace: 'Arial', bold: true, color: '333333' });
        if (s.bullets.length > 0) {
          const bulletText = s.bullets.map(b => ({ text: b, options: { bullet: { type: 'bullet' as const }, fontSize: 16, color: '555555', breakLine: true } }));
          slide.addText(bulletText, { x: 0.8, y: 1.8, w: s.imageDescription ? 7 : 11.5, h: 5, fontFace: 'Arial', valign: 'top' });
        }
        if (s.imageUrl) {
          try {
            slide.addImage({ path: s.imageUrl, x: 8.5, y: 1.8, w: 4, h: 4, rounding: true });
          } catch { /* skip image on failure */ }
        }
        break;

      case 'image_text':
        slide.addText(s.title, { x: 0.8, y: 0.5, w: 11.5, h: 1, fontSize: 28, fontFace: 'Arial', bold: true, color: '333333' });
        if (s.imageUrl) {
          try {
            slide.addImage({ path: s.imageUrl, x: 0.8, y: 1.8, w: 5.5, h: 4.5, rounding: true });
          } catch { /* skip */ }
        }
        if (s.bullets.length > 0) {
          const bulletText = s.bullets.map(b => ({ text: b, options: { bullet: { type: 'bullet' as const }, fontSize: 16, color: '555555', breakLine: true } }));
          slide.addText(bulletText, { x: 7, y: 1.8, w: 5.5, h: 5, fontFace: 'Arial', valign: 'top' });
        }
        break;

      case 'split_image':
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 6.5, h: 7.5, fill: { color: c1 } });
        slide.addText(s.title, { x: 0.5, y: 1, w: 5.5, h: 1, fontSize: 24, fontFace: 'Arial', bold: true, color: 'FFFFFF' });
        if (s.bullets.length > 0) {
          const bulletText = s.bullets.map(b => ({ text: b, options: { bullet: { type: 'bullet' as const }, fontSize: 14, color: 'FFFFFF', breakLine: true } }));
          slide.addText(bulletText, { x: 0.5, y: 2.2, w: 5.5, h: 4.5, fontFace: 'Arial', valign: 'top' });
        }
        if (s.imageUrl) {
          try {
            slide.addImage({ path: s.imageUrl, x: 6.5, y: 0, w: 6.84, h: 7.5 });
          } catch { /* skip */ }
        }
        break;

      case 'comparison':
      case 'two_column_text':
        slide.addText(s.title, { x: 0.8, y: 0.5, w: 11.5, h: 1, fontSize: 28, fontFace: 'Arial', bold: true, color: '333333' });
        slide.addText(s.leftLabel || 'Column A', { x: 0.8, y: 1.6, w: 5.5, h: 0.5, fontSize: 14, fontFace: 'Arial', bold: true, color: c1 });
        if (s.leftColumn) {
          const leftText = s.leftColumn.map(b => ({ text: b, options: { bullet: { type: 'bullet' as const }, fontSize: 14, color: '555555', breakLine: true } }));
          slide.addText(leftText, { x: 0.8, y: 2.2, w: 5.5, h: 4.5, fontFace: 'Arial', valign: 'top' });
        }
        slide.addShape(pptx.ShapeType.line, { x: 6.67, y: 1.6, w: 0, h: 5, line: { color: 'CCCCCC', width: 1 } });
        slide.addText(s.rightLabel || 'Column B', { x: 7, y: 1.6, w: 5.5, h: 0.5, fontSize: 14, fontFace: 'Arial', bold: true, color: c2 });
        if (s.rightColumn) {
          const rightText = s.rightColumn.map(b => ({ text: b, options: { bullet: { type: 'bullet' as const }, fontSize: 14, color: '555555', breakLine: true } }));
          slide.addText(rightText, { x: 7, y: 2.2, w: 5.5, h: 4.5, fontFace: 'Arial', valign: 'top' });
        }
        break;

      case 'quote':
        slide.addText(`"${s.quote || ''}"`, {
          x: 1.5, y: 1.5, w: 10, h: 3.5, fontSize: 28, fontFace: 'Arial', italic: true, color: '333333', align: 'center', valign: 'middle',
        });
        if (s.quoteAuthor) {
          slide.addText(`— ${s.quoteAuthor}`, { x: 1.5, y: 5, w: 10, h: 0.8, fontSize: 16, fontFace: 'Arial', color: c1, align: 'center' });
        }
        break;

      case 'stats':
        slide.addText(s.title, { x: 0.8, y: 0.5, w: 11.5, h: 1, fontSize: 28, fontFace: 'Arial', bold: true, color: '333333', align: 'center' });
        (s.stats || []).forEach((stat, i) => {
          const xPos = 0.8 + i * 3.1;
          slide.addText(stat.value, { x: xPos, y: 2.5, w: 2.8, h: 1.5, fontSize: 36, fontFace: 'Arial', bold: true, color: c1, align: 'center' });
          slide.addText(stat.label, { x: xPos, y: 4, w: 2.8, h: 0.8, fontSize: 12, fontFace: 'Arial', color: '888888', align: 'center' });
        });
        break;

      case 'timeline':
        slide.addText(s.title, { x: 0.8, y: 0.5, w: 11.5, h: 1, fontSize: 28, fontFace: 'Arial', bold: true, color: '333333' });
        (s.timelineItems || []).forEach((item, i) => {
          const yPos = 1.8 + i * 1;
          slide.addShape(pptx.ShapeType.ellipse, { x: 0.8, y: yPos + 0.1, w: 0.25, h: 0.25, fill: { color: c1 } });
          slide.addText(item.date, { x: 1.3, y: yPos, w: 2, h: 0.4, fontSize: 11, fontFace: 'Arial', bold: true, color: c1 });
          slide.addText(item.event, { x: 3.3, y: yPos, w: 9, h: 0.4, fontSize: 14, fontFace: 'Arial', color: '555555' });
        });
        break;

      case 'steps':
        slide.addText(s.title, { x: 0.8, y: 0.5, w: 11.5, h: 1, fontSize: 28, fontFace: 'Arial', bold: true, color: '333333' });
        (s.steps || []).forEach((step, i) => {
          const yPos = 1.8 + i * 1.1;
          slide.addShape(pptx.ShapeType.ellipse, { x: 0.8, y: yPos, w: 0.5, h: 0.5, fill: { color: c1 } });
          slide.addText(String(i + 1), { x: 0.8, y: yPos, w: 0.5, h: 0.5, fontSize: 14, fontFace: 'Arial', bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
          slide.addText(step.label, { x: 1.6, y: yPos, w: 3, h: 0.5, fontSize: 14, fontFace: 'Arial', bold: true, color: '333333' });
          slide.addText(step.description, { x: 4.6, y: yPos, w: 8, h: 0.5, fontSize: 13, fontFace: 'Arial', color: '666666' });
        });
        break;

      case 'numbered_list':
        slide.addText(s.title, { x: 0.8, y: 0.5, w: 11.5, h: 1, fontSize: 28, fontFace: 'Arial', bold: true, color: '333333' });
        (s.numberedItems || []).forEach((item, i) => {
          const yPos = 1.8 + i * 1.2;
          slide.addShape(pptx.ShapeType.ellipse, { x: 0.8, y: yPos, w: 0.7, h: 0.7, fill: { color: c1 } });
          slide.addText(item.number || String(i + 1).padStart(2, '0'), { x: 0.8, y: yPos, w: 0.7, h: 0.7, fontSize: 14, fontFace: 'Arial', bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
          slide.addText(item.title, { x: 1.8, y: yPos, w: 10, h: 0.4, fontSize: 16, fontFace: 'Arial', bold: true, color: '333333' });
          slide.addText(item.desc, { x: 1.8, y: yPos + 0.4, w: 10, h: 0.4, fontSize: 13, fontFace: 'Arial', color: '666666' });
        });
        break;

      case 'process_flow':
        slide.addText(s.title, { x: 0.8, y: 0.5, w: 11.5, h: 1, fontSize: 28, fontFace: 'Arial', bold: true, color: '333333', align: 'center' });
        (s.processSteps || []).forEach((step, i, arr) => {
          const totalWidth = arr.length * 2.2 + (arr.length - 1) * 0.5;
          const startX = (13.34 - totalWidth) / 2;
          const xPos = startX + i * 2.7;
          slide.addShape(pptx.ShapeType.ellipse, { x: xPos + 0.6, y: 2.5, w: 0.8, h: 0.8, fill: { color: c1 } });
          slide.addText(String(i + 1), { x: xPos + 0.6, y: 2.5, w: 0.8, h: 0.8, fontSize: 16, fontFace: 'Arial', bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
          slide.addText(step.label, { x: xPos, y: 3.5, w: 2, h: 0.5, fontSize: 12, fontFace: 'Arial', bold: true, color: '333333', align: 'center' });
          slide.addText(step.desc, { x: xPos, y: 4, w: 2, h: 0.8, fontSize: 10, fontFace: 'Arial', color: '888888', align: 'center' });
          if (i < arr.length - 1) {
            slide.addShape(pptx.ShapeType.line, { x: xPos + 2, y: 2.9, w: 0.7, h: 0, line: { color: 'CCCCCC', width: 2 } });
          }
        });
        break;

      case 'icon_grid':
        slide.addText(s.title, { x: 0.8, y: 0.5, w: 11.5, h: 1, fontSize: 28, fontFace: 'Arial', bold: true, color: '333333', align: 'center' });
        (s.iconItems || []).forEach((item, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const xPos = 0.8 + col * 4.1;
          const yPos = 1.8 + row * 2.6;
          slide.addShape(pptx.ShapeType.roundRect, { x: xPos, y: yPos, w: 3.8, h: 2.3, fill: { color: 'F5F5F5' }, rectRadius: 0.15 });
          slide.addText(item.icon, { x: xPos, y: yPos + 0.2, w: 3.8, h: 0.6, fontSize: 22, align: 'center' });
          slide.addText(item.title, { x: xPos + 0.3, y: yPos + 0.9, w: 3.2, h: 0.5, fontSize: 13, fontFace: 'Arial', bold: true, color: '333333', align: 'center' });
          slide.addText(item.desc, { x: xPos + 0.3, y: yPos + 1.4, w: 3.2, h: 0.7, fontSize: 10, fontFace: 'Arial', color: '888888', align: 'center' });
        });
        break;

      case 'feature_cards':
        slide.addText(s.title, { x: 0.8, y: 0.5, w: 11.5, h: 1, fontSize: 28, fontFace: 'Arial', bold: true, color: '333333', align: 'center' });
        (s.featureCards || []).forEach((card, i, arr) => {
          const cardWidth = Math.min(3.5, 11.5 / arr.length - 0.3);
          const totalWidth = arr.length * cardWidth + (arr.length - 1) * 0.3;
          const startX = (13.34 - totalWidth) / 2;
          const xPos = startX + i * (cardWidth + 0.3);
          slide.addShape(pptx.ShapeType.rect, { x: xPos, y: 1.8, w: cardWidth, h: 0.08, fill: { color: [c1, c2, c3][i % 3] } });
          slide.addShape(pptx.ShapeType.roundRect, { x: xPos, y: 1.88, w: cardWidth, h: 4, fill: { color: 'F8F8F8' }, rectRadius: 0.1 });
          slide.addText(card.icon, { x: xPos, y: 2.1, w: cardWidth, h: 0.6, fontSize: 22, align: 'center' });
          slide.addText(card.title, { x: xPos + 0.2, y: 2.8, w: cardWidth - 0.4, h: 0.6, fontSize: 14, fontFace: 'Arial', bold: true, color: '333333', align: 'center' });
          slide.addText(card.desc, { x: xPos + 0.2, y: 3.4, w: cardWidth - 0.4, h: 2, fontSize: 11, fontFace: 'Arial', color: '888888', align: 'center' });
        });
        break;

      case 'agenda':
        slide.addText(s.title, { x: 0.8, y: 0.5, w: 11.5, h: 1, fontSize: 28, fontFace: 'Arial', bold: true, color: '333333' });
        slide.addShape(pptx.ShapeType.line, { x: 0.8, y: 1.6, w: 0, h: 5, line: { color: c1, width: 3, transparency: 60 } });
        (s.agendaItems || []).forEach((item, i) => {
          const yPos = 1.8 + i * 1;
          slide.addText(String(i + 1).padStart(2, '0'), { x: 1.2, y: yPos, w: 1, h: 0.5, fontSize: 22, fontFace: 'Arial', bold: true, color: c1 });
          slide.addText(item.title, { x: 2.5, y: yPos, w: 9, h: 0.4, fontSize: 16, fontFace: 'Arial', bold: true, color: '333333' });
          if (item.desc) {
            slide.addText(item.desc, { x: 2.5, y: yPos + 0.4, w: 9, h: 0.4, fontSize: 12, fontFace: 'Arial', color: '888888' });
          }
        });
        break;

      case 'bento_grid':
        slide.addText(s.title, { x: 0.8, y: 0.5, w: 11.5, h: 1, fontSize: 28, fontFace: 'Arial', bold: true, color: '333333', align: 'center' });
        (s.bentoItems || []).forEach((item, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const isWide = item.span === 'wide';
          const xPos = 0.8 + col * 4.1;
          const yPos = 1.8 + row * 2.6;
          const width = isWide ? 8.2 : 3.8;
          slide.addShape(pptx.ShapeType.roundRect, {
            x: xPos, y: yPos, w: width, h: 2.3,
            fill: { color: i === 0 ? c1 : 'F0F0F0' }, rectRadius: 0.15,
          });
          slide.addText(item.icon, { x: xPos + 0.3, y: yPos + 0.2, w: 0.6, h: 0.5, fontSize: 18 });
          slide.addText(item.title, { x: xPos + 0.3, y: yPos + 0.7, w: width - 0.6, h: 0.5, fontSize: 13, fontFace: 'Arial', bold: true, color: i === 0 ? 'FFFFFF' : '333333' });
          slide.addText(item.desc, { x: xPos + 0.3, y: yPos + 1.2, w: width - 0.6, h: 0.9, fontSize: 10, fontFace: 'Arial', color: i === 0 ? 'FFFFFF' : '888888' });
        });
        break;

      case 'full_image':
        if (s.imageUrl) {
          try {
            slide.addImage({ path: s.imageUrl, x: 0, y: 0, w: 13.34, h: 7.5, sizing: { type: 'cover', w: 13.34, h: 7.5 } });
          } catch { /* skip */ }
        }
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 4, w: 13.34, h: 3.5,
          fill: { color: '000000', transparency: 40 },
        });
        slide.addText(s.title, { x: 0.8, y: 4.5, w: 11, h: 1.2, fontSize: 32, fontFace: 'Arial', bold: true, color: 'FFFFFF' });
        if (s.overlayText || s.bullets[0]) {
          slide.addText(s.overlayText || s.bullets[0], { x: 0.8, y: 5.7, w: 11, h: 0.8, fontSize: 16, fontFace: 'Arial', color: 'FFFFFF', transparency: 30 });
        }
        break;

      default:
        slide.addText(s.title, { x: 0.8, y: 0.5, w: 11.5, h: 1, fontSize: 28, fontFace: 'Arial', bold: true, color: '333333' });
        if (s.bullets.length > 0) {
          const bulletText = s.bullets.map(b => ({ text: b, options: { bullet: { type: 'bullet' as const }, fontSize: 16, color: '555555', breakLine: true } }));
          slide.addText(bulletText, { x: 0.8, y: 1.8, w: 11.5, h: 5, fontFace: 'Arial', valign: 'top' });
        }
        break;
    }
  }

  const filename = presentation.title.replace(/[^a-zA-Z0-9]/g, '_') + '.pptx';
  await pptx.writeFile({ fileName: filename });
}
