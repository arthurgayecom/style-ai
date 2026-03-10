import OpenAI from 'openai';
import type { AIProvider } from './types';

export function createOllamaProvider(model: string, baseUrl?: string): AIProvider {
  const client = new OpenAI({
    apiKey: 'ollama',
    baseURL: (baseUrl || 'http://localhost:11434') + '/v1',
  });

  return {
    async analyze(text: string, systemPrompt: string): Promise<string> {
      const res = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
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
      });
      return res.choices[0]?.message?.content || '';
    },

    async ocr(): Promise<string> {
      throw new Error('Ollama does not support image input. Use a provider with vision support.');
    },
  };
}
