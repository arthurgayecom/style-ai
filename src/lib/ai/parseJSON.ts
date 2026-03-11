/**
 * Robustly extract and parse JSON from AI model responses.
 *
 * Handles common issues:
 * - Code blocks (```json ... ```)
 * - "Thinking" preamble text before the JSON
 * - Trailing text after the JSON
 * - Nested objects/arrays with proper brace matching
 */
export function parseAIJSON<T = unknown>(raw: string): T {
  if (!raw || !raw.trim()) throw new Error('Empty AI response');

  // 1. Try direct parse first (fastest path)
  try {
    return JSON.parse(raw.trim());
  } catch {
    // continue to cleaning
  }

  // 2. Strip markdown code blocks
  let cleaned = raw
    .replace(/^```(?:json|js|javascript)?\s*\n?/gm, '')
    .replace(/\n?```\s*$/gm, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // continue to extraction
  }

  // 3. Find the first { or [ and extract the JSON object/array
  const startObj = cleaned.indexOf('{');
  const startArr = cleaned.indexOf('[');

  let start = -1;
  let openChar = '{';
  let closeChar = '}';

  if (startObj === -1 && startArr === -1) {
    throw new Error('No JSON found in AI response');
  } else if (startObj === -1) {
    start = startArr;
    openChar = '[';
    closeChar = ']';
  } else if (startArr === -1) {
    start = startObj;
  } else {
    // Pick whichever comes first
    if (startArr < startObj) {
      start = startArr;
      openChar = '[';
      closeChar = ']';
    } else {
      start = startObj;
    }
  }

  // Brace-matching to find the end
  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === openChar) depth++;
    if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) {
    throw new Error('Incomplete JSON in AI response');
  }

  const extracted = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(extracted);
  } catch {
    throw new Error('Could not parse AI response as JSON');
  }
}
