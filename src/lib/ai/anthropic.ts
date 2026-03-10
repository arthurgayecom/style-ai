import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider } from './types';

export function createAnthropicProvider(apiKey: string, model: string): AIProvider {
  const client = new Anthropic({ apiKey });

  return {
    async analyze(text: string, systemPrompt: string): Promise<string> {
      const msg = await client.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
      });
      const block = msg.content[0];
      return block.type === 'text' ? block.text : '';
    },

    async generate(systemPrompt: string, userPrompt: string, onChunk?: (chunk: string) => void): Promise<string> {
      if (onChunk) {
        let full = '';
        const stream = client.messages.stream({
          model,
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            full += event.delta.text;
            onChunk(event.delta.text);
          }
        }
        return full;
      }
      const msg = await client.messages.create({
        model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const block = msg.content[0];
      return block.type === 'text' ? block.text : '';
    },

    async ocr(imageBase64: string, mimeType: string): Promise<string> {
      const msg = await client.messages.create({
        model,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', data: imageBase64 },
            },
            {
              type: 'text',
              text: 'Extract ALL text from this image exactly as written, preserving the original spelling, punctuation, and formatting. Do not correct any errors. Return only the extracted text, nothing else.',
            },
          ],
        }],
      });
      const block = msg.content[0];
      return block.type === 'text' ? block.text : '';
    },
  };
}
