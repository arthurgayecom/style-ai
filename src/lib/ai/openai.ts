import OpenAI from 'openai';
import type { AIProvider } from './types';

export function createOpenAIProvider(apiKey: string, model: string): AIProvider {
  const client = new OpenAI({ apiKey });

  return {
    async analyze(text: string, systemPrompt: string): Promise<string> {
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        max_tokens: 4096,
      });
      const result = res.choices[0]?.message?.content || '';
      if (!result) throw new Error('OpenAI returned an empty response — try again.');
      return result;
    },

    async generate(systemPrompt: string, userPrompt: string, onChunk?: (chunk: string) => void): Promise<string> {
      if (onChunk) {
        let full = '';
        const stream = await client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 8192,
          stream: true,
        });
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || '';
          if (delta) {
            full += delta;
            onChunk(delta);
          }
        }
        if (!full) throw new Error('OpenAI returned an empty response — try again.');
        return full;
      }
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 8192,
      });
      const result = res.choices[0]?.message?.content || '';
      if (!result) throw new Error('OpenAI returned an empty response — try again.');
      return result;
    },

    async ocr(imageBase64: string, mimeType: string): Promise<string> {
      const res = await client.chat.completions.create({
        model,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
            {
              type: 'text',
              text: 'Extract ALL text from this image exactly as written, preserving the original spelling, punctuation, and formatting. Do not correct any errors. Return only the extracted text, nothing else.',
            },
          ],
        }],
        max_tokens: 4096,
      });
      const result = res.choices[0]?.message?.content || '';
      if (!result) throw new Error('OCR failed — OpenAI could not extract text from this image.');
      return result;
    },
  };
}
