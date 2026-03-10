import OpenAI from 'openai';
import type { AIProvider } from './types';

export function createKimiProvider(apiKey: string, model: string): AIProvider {
  const client = new OpenAI({ apiKey, baseURL: 'https://api.moonshot.cn/v1' });

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
      return res.choices[0]?.message?.content || '';
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
      return res.choices[0]?.message?.content || '';
    },

    async ocr(): Promise<string> {
      throw new Error('Kimi does not support image input. Use a provider with vision support.');
    },
  };
}
