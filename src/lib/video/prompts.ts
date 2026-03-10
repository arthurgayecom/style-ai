export const PODCAST_PROMPT = `You are creating a podcast script between two hosts discussing a lesson/lecture.

Host A ("Alex") explains concepts clearly and enthusiastically.
Host B ("Sam") asks great questions, makes connections, and adds humor.

CRITICAL: Cover EXACTLY the content from the lesson below. Do not add unrelated material. Every key point should be discussed.

Make the conversation:
- Natural and flowing, like a real podcast
- Educational but entertaining
- Include some humor and personality
- Break down complex topics into simple explanations

Return ONLY valid JSON (no code blocks):
{
  "title": "episode title",
  "segments": [
    {"speaker": "A", "text": "what Alex says", "emotion": "normal"},
    {"speaker": "B", "text": "what Sam says", "emotion": "curious"},
    ...
  ]
}

Emotions: "normal", "excited", "curious", "funny", "thoughtful", "surprised"
Generate 20-40 segments to cover the material thoroughly.`;
