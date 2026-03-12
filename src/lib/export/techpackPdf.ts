import type { TechPackData } from '@/types/mockup';

export async function exportTechPackPdf(data: TechPackData): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF('p', 'mm', 'a4');
  const W = doc.internal.pageSize.getWidth();
  const M = 12; // margin
  const CW = W - M * 2; // content width
  let y = M;

  const PURPLE = [100, 60, 200] as const;
  const DARK = [25, 25, 35] as const;
  const LIGHT_BG = [245, 245, 250] as const;

  // ── Helpers ──
  function sectionHeader(title: string) {
    if (y > 255) { doc.addPage(); y = M; }
    y += 4;
    doc.setFillColor(...PURPLE);
    doc.rect(M, y, CW, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), M + 3, y + 5);
    y += 11;
    doc.setTextColor(...DARK);
  }

  function labelValue(label: string, value: string, xPos: number, yPos: number, maxWidth = 60) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130, 130, 140);
    doc.text(label, xPos, yPos);
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(value || '—', maxWidth);
    doc.text(lines, xPos, yPos + 4);
    return lines.length * 4;
  }

  // ═══════ PAGE 1: COVER / HEADER ═══════
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('TECH PACK', M, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(data.garmentType?.toUpperCase() || 'GARMENT', M, 30);

  // Right side header info
  doc.setFontSize(7);
  doc.text(`Style: ${data.styleNumber || '—'}`, W - M, 15, { align: 'right' });
  doc.text(`Season: ${data.season || '—'}`, W - M, 20, { align: 'right' });
  doc.text(`Base Size: ${data.baseSize || 'M'}`, W - M, 25, { align: 'right' });
  doc.text(`Date: ${new Date(data.date || Date.now()).toLocaleDateString()}`, W - M, 30, { align: 'right' });

  // Purple accent line
  doc.setFillColor(...PURPLE);
  doc.rect(0, 45, W, 2, 'F');
  y = 55;

  doc.setTextColor(...DARK);

  // Style info grid
  doc.setFillColor(...LIGHT_BG);
  doc.rect(M, y - 2, CW, 22, 'F');
  labelValue('Style Name', data.styleName || data.garmentType, M + 4, y + 2, 80);
  labelValue('Style Number', data.styleNumber || '—', M + 90, y + 2);
  labelValue('Fiber Content', data.fiberContent || '—', M + 4, y + 12, 80);
  labelValue('Country of Origin', data.countryOfOrigin || 'TBD', M + 90, y + 12);
  y += 26;

  // Mockup image
  if (data.mockupImage) {
    try {
      const imgW = 65;
      const imgH = 65;
      doc.addImage(data.mockupImage, 'PNG', M, y, imgW, imgH);
      y += imgH + 4;
    } catch { /* skip */ }
  }

  // ═══════ GRADED SPEC SHEET ═══════
  sectionHeader('Graded Measurement Specification');

  if (data.measurements?.length > 0) {
    const sizes = data.sizes || ['S', 'M', 'L', 'XL'];
    const head = [['#', 'Point of Measure', 'Tol.', ...sizes, 'Grade Rule']];
    const body = data.measurements.map((m, i) => [
      String(i + 1),
      m.pom + (m.description ? `\n${m.description}` : ''),
      m.tolerance || '—',
      ...sizes.map(s => m.values?.[s] || '—'),
      m.gradingRule || '—',
    ]);

    autoTable(doc, {
      startY: y,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: [...PURPLE], textColor: 255, fontStyle: 'bold', fontSize: 7, cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 40 },
        2: { cellWidth: 15 },
      },
      alternateRowStyles: { fillColor: [...LIGHT_BG] },
      margin: { left: M, right: M },
      didParseCell: (hookData) => {
        // Highlight base size column
        const baseIdx = sizes.indexOf(data.baseSize || 'M') + 3;
        if (hookData.column.index === baseIdx && hookData.section === 'body') {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.textColor = [...PURPLE];
        }
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ═══════ CONSTRUCTION DETAILS ═══════
  sectionHeader('Construction Specification');

  if (data.constructionDetails?.length > 0) {
    const head = [['Area', 'Stitch Type', 'SPI/Gauge', 'Seam Allowance', 'Notes']];
    const body = data.constructionDetails.map(d => [
      d.area, d.stitchType, d.spiOrGauge || '—', d.seamAllowance || '—', d.notes || '—',
    ]);

    autoTable(doc, {
      startY: y,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: [...PURPLE], textColor: 255, fontStyle: 'bold', fontSize: 7, cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [...LIGHT_BG] },
      margin: { left: M, right: M },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (data.constructionNotes?.length > 0) {
    if (y > 260) { doc.addPage(); y = M; }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('CONSTRUCTION NOTES', M, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    for (const note of data.constructionNotes) {
      if (y > 278) { doc.addPage(); y = M; }
      const lines = doc.splitTextToSize(`• ${note}`, CW);
      doc.text(lines, M, y);
      y += lines.length * 3.5 + 1;
    }
    y += 3;
  }

  // ═══════ BILL OF MATERIALS ═══════
  sectionHeader('Bill of Materials (BOM)');

  if (data.materials?.length > 0) {
    const head = [['Component', 'Description', 'Material', 'Color Code', 'Qty', 'Placement']];
    const body = data.materials.map(m => [
      m.component, m.description, m.material, m.colorCode || '—', m.quantity || '—', m.placement,
    ]);

    autoTable(doc, {
      startY: y,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: [...PURPLE], textColor: 255, fontStyle: 'bold', fontSize: 7, cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [...LIGHT_BG] },
      margin: { left: M, right: M },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ═══════ COLORWAY ═══════
  if (data.colorway?.length > 0) {
    sectionHeader('Colorway Specification');

    const head = [['Color Name', 'Pantone Code', 'Hex', 'Component']];
    const body = data.colorway.map(c => [c.name, c.pantone || '—', c.hex, c.component]);

    autoTable(doc, {
      startY: y,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: [...PURPLE], textColor: 255, fontStyle: 'bold', fontSize: 7, cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [...LIGHT_BG] },
      margin: { left: M, right: M },
      didDrawCell: (hookData) => {
        // Draw color swatch
        if (hookData.column.index === 2 && hookData.section === 'body') {
          const hex = hookData.cell.raw as string;
          if (hex?.startsWith('#')) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            doc.setFillColor(r, g, b);
            doc.roundedRect(hookData.cell.x + hookData.cell.width - 6, hookData.cell.y + 1, 4, 4, 1, 1, 'F');
          }
        }
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ═══════ ARTWORK PLACEMENTS ═══════
  if (data.artworkPlacements?.length > 0) {
    sectionHeader('Artwork & Print Placements');

    const head = [['Name', 'Method', 'Position', 'Dimensions', 'Color Codes']];
    const body = data.artworkPlacements.map(a => [
      a.name, a.method, a.position, a.dimensions, a.colorCodes?.join(', ') || '—',
    ]);

    autoTable(doc, {
      startY: y,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: [...PURPLE], textColor: 255, fontStyle: 'bold', fontSize: 7, cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [...LIGHT_BG] },
      margin: { left: M, right: M },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ═══════ LABELS ═══════
  if (data.labels?.length > 0) {
    sectionHeader('Labels & Branding');

    const head = [['Label Type', 'Method', 'Dimensions', 'Placement']];
    const body = data.labels.map(l => [l.type, l.method, l.dimensions, l.placement]);

    autoTable(doc, {
      startY: y,
      head,
      body,
      theme: 'grid',
      headStyles: { fillColor: [...PURPLE], textColor: 255, fontStyle: 'bold', fontSize: 7, cellPadding: 2 },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [...LIGHT_BG] },
      margin: { left: M, right: M },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ═══════ CARE INSTRUCTIONS ═══════
  if (data.careInstructions?.length > 0) {
    if (y > 255) { doc.addPage(); y = M; }
    sectionHeader('Care & Content Label');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const careText = data.careInstructions.join(' | ');
    const careLines = doc.splitTextToSize(careText, CW);
    doc.text(careLines, M, y);
    y += careLines.length * 4 + 4;

    if (data.fiberContent) {
      doc.setFont('helvetica', 'bold');
      doc.text(`Fiber Content: ${data.fiberContent}`, M, y);
      y += 6;
    }
  }

  // ═══════ PACKAGING ═══════
  if (data.packaging) {
    sectionHeader('Packaging Specification');

    const packData = [
      ['Fold Method', data.packaging.foldMethod || '—'],
      ['Poly Bag', data.packaging.polyBag || '—'],
      ['Hangtag', data.packaging.hangtag || '—'],
      ['Tissue Wrap', data.packaging.tissueWrap ? 'Yes' : 'No'],
      ['Units Per Carton', String(data.packaging.unitsPerCarton || '—')],
    ];

    autoTable(doc, {
      startY: y,
      body: packData,
      theme: 'grid',
      bodyStyles: { fontSize: 7, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: [...LIGHT_BG], cellWidth: 40 } },
      margin: { left: M, right: M },
      tableWidth: CW,
    });
  }

  // ═══════ FOOTER ON ALL PAGES ═══════
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Bottom line
    doc.setDrawColor(...PURPLE);
    doc.setLineWidth(0.5);
    doc.line(M, 287, W - M, 287);

    doc.setFontSize(6);
    doc.setTextColor(150, 150, 160);
    doc.text(`Page ${i} of ${pageCount}`, W - M, 291, { align: 'right' });
    doc.text(`${data.styleName || data.garmentType} | ${data.styleNumber || '—'} | CONFIDENTIAL`, M, 291);
  }

  const filename = `techpack-${(data.styleName || data.garmentType).toLowerCase().replace(/\s+/g, '-')}-${data.styleNumber || 'draft'}.pdf`;
  doc.save(filename);
}
