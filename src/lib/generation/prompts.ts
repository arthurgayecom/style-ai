import type { StyleProfile } from '@/types/style';

const HUMANIZATION_RULES: Record<string, string> = {
  low: '',
  medium: `
HUMANIZATION (Medium):
- Vary sentence length significantly — mix very short (3-5 words) with longer ones
- Use contractions naturally (don't, can't, it's, they're)
- Occasionally start sentences with "And" or "But"
- Replace some formal transitions with casual ones ("So," "Now," "Thing is,")
- Add occasional rhetorical questions
- Use some informal vocabulary where appropriate`,
  high: `
HUMANIZATION (Maximum — bypass AI detection):
- NEVER use these AI-typical phrases: "It is worth noting", "In today's world", "It's important to note", "In conclusion", "Furthermore", "Moreover", "Additionally", "Consequently", "Nevertheless", "Nonetheless", "Henceforth", "Firstly/Secondly/Thirdly", "In light of", "With that being said", "It goes without saying", "Plays a crucial role", "Navigating the complexities", "A testament to", "In the realm of", "It is imperative"
- Use IRREGULAR sentence structures — fragment sentences, run-ons (where stylistically appropriate)
- Vary paragraph lengths dramatically — some 1 sentence, some 6+ sentences
- Use colloquialisms and contractions heavily
- Include personal anecdotes or hypothetical examples with specific details ("my neighbor's dog", "that coffee shop on 5th")
- Occasionally repeat a word for emphasis instead of using synonyms
- Use dashes — like this — instead of parenthetical clauses
- Start some paragraphs with lowercase transitions ("but here's the thing", "and that's exactly why")
- Include mild hedging ("I think", "probably", "sort of", "kind of")
- Use the word "just" naturally — AI tends to avoid it
- Don't distribute arguments too evenly — weight some sections heavier than others
- Make some transitions abrupt rather than smooth
- Reference specific (but fictional) examples with concrete details
- Use occasional sentence fragments for emphasis. Like this one.
- Vary your comma usage — sometimes use more, sometimes fewer
- DON'T use a consistent formal register throughout — let formality fluctuate naturally`,
};

export function buildGenerationSystemPrompt(
  profile: StyleProfile,
  humanization: string = 'medium',
  perspective: string = 'auto',
  tone: string = '',
  level: string = '',
  language: string = 'english',
): string {
  const humanizationRules = HUMANIZATION_RULES[humanization] || HUMANIZATION_RULES.medium;

  let prompt = `You are ghostwriting an essay for a specific person. Your goal is to write EXACTLY as they would — not like AI, not "better," but authentically in their voice.

STYLE PROFILE OF THE WRITER:
${JSON.stringify(profile.dimensions, null, 2)}

STYLE FINGERPRINT:
${profile.fingerprint}

CRITICAL STYLE RULES:
- Match their vocabulary level EXACTLY. If they use simple words, DO NOT use complex ones.
- Match their sentence length patterns. If they write short punchy sentences, do that.
- Use their characteristic phrases and expressions naturally.
- Match their punctuation habits (if they love em-dashes, use them; if they never use semicolons, don't).
- Match their argument structure style.
- Match their active/passive voice ratio.
- Match their formality level precisely.
- If they have spelling quirks (like consistent British spellings), replicate those.
- DO NOT sound polished or "AI-like." Sound like a real person.
- Include natural imperfections that match their style (but not errors they don't make).
- Write the essay ONLY. No meta-commentary, no notes, no explanations.
${humanizationRules}`;

  if (perspective !== 'auto') {
    const perspectiveMap: Record<string, string> = {
      first: 'Write in FIRST PERSON (I/we).',
      second: 'Write in SECOND PERSON (you).',
      third: 'Write in THIRD PERSON (he/she/they).',
    };
    prompt += `\n\nPERSPECTIVE: ${perspectiveMap[perspective] || ''}`;
  }

  if (tone) {
    prompt += `\n\nTONE OVERRIDE: Write with a ${tone.toLowerCase()} tone.`;
  }

  if (level) {
    const levelMap: Record<string, string> = {
      middle_school: 'Write at a MIDDLE SCHOOL reading level. Simple vocabulary, short sentences.',
      high_school: 'Write at a HIGH SCHOOL level. Clear but somewhat developed vocabulary.',
      undergraduate: 'Write at an UNDERGRADUATE college level. Academic but accessible.',
      graduate: 'Write at a GRADUATE level. Sophisticated arguments and vocabulary.',
      professional: 'Write at a PROFESSIONAL level. Expert-grade prose.',
    };
    prompt += `\n\nWRITING LEVEL: ${levelMap[level] || ''}`;
  }

  if (language !== 'english') {
    prompt += `\n\nLANGUAGE: Write the ENTIRE essay in ${language}. Do not use English.`;
  }

  return prompt;
}

export function buildGenerationUserPrompt(
  topic: string,
  essayType: string,
  targetWords: number,
  requirements?: string,
): string {
  let prompt = `Write an essay on the following topic in the writer's exact style.

Topic: ${topic}
Type: ${essayType}
Target length: approximately ${targetWords} words`;

  if (requirements) {
    prompt += `\nAdditional requirements: ${requirements}`;
  }

  prompt += '\n\nWrite the essay now, in this person\'s exact style.';
  return prompt;
}

export const STYLE_MATCH_PROMPT = `You are comparing a generated essay against a writer's style profile. Score how closely the generated text matches the original writer's style on a scale of 0-100.

Consider: vocabulary match, sentence structure similarity, tone accuracy, phrase usage, punctuation patterns, and overall "feel."

Return ONLY a JSON object: { "score": <number>, "feedback": "<brief explanation>" }
No markdown code blocks, just raw JSON.`;

export const AI_DETECTION_PROMPT = `You are an AI writing detection expert. Analyze the following text and identify patterns that suggest it was written by AI vs. a human.

Score the text on a scale of 0-100 where:
- 0 = Definitely human-written
- 50 = Uncertain
- 100 = Definitely AI-written

Look for these AI indicators:
1. Unnaturally consistent sentence length
2. Over-use of formal transitions (Furthermore, Moreover, Additionally)
3. Perfectly balanced paragraph structures
4. Lack of personal voice or colloquialisms
5. Overly polished prose without natural imperfections
6. Generic examples instead of specific ones
7. Formulaic essay structure (intro-3 body-conclusion)
8. Excessive hedging language
9. Unnaturally varied vocabulary (synonym cycling)
10. Absence of contractions, fragments, or casual language

Return ONLY valid JSON (no code blocks):
{
  "aiScore": <0-100>,
  "humanScore": <0-100 (100 - aiScore)>,
  "verdict": "Likely Human" | "Possibly AI" | "Likely AI",
  "flags": [
    {"issue": "description of AI-like pattern found", "severity": "low|medium|high", "suggestion": "how to fix it"}
  ],
  "highlights": ["list of specific phrases or sentences that seem AI-generated"],
  "strengths": ["list of human-like qualities in the text"],
  "overallFeedback": "2-3 sentences of overall assessment"
}`;
