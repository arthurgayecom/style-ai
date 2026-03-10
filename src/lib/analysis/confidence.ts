export function calculateConfidence(essayCount: number, totalWordCount: number): number {
  if (essayCount === 0) return 0;

  // Base: logarithmic growth from essay count
  const essayBase = 20 + 15 * Math.log2(essayCount);

  // Word count bonus: up to 15 points for 5000+ words total
  const wordBonus = Math.min(15, (totalWordCount / 5000) * 15);

  // Combine and cap at 95
  const raw = essayBase + wordBonus;
  return Math.min(95, Math.round(raw));
}

export function getRecommendation(confidence: number, essayCount: number): string {
  if (essayCount === 0) return 'Upload at least 3 essays to get started';
  if (confidence < 40) return `Upload ${Math.max(3 - essayCount, 1)} more essay${essayCount < 2 ? 's' : ''} for a basic style profile`;
  if (confidence < 60) return 'Upload 2-3 more essays for more accurate style matching';
  if (confidence < 75) return 'Good foundation! 2-3 more essays will improve accuracy';
  if (confidence < 90) return 'Strong profile! A few more essays will fine-tune the details';
  return 'Excellent style profile! Your AI writing will closely match your voice';
}

export function getConfidenceColor(confidence: number): string {
  if (confidence < 40) return 'text-error';
  if (confidence < 60) return 'text-warning';
  if (confidence < 80) return 'text-accent';
  return 'text-success';
}
