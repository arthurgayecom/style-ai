import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIProvider } from './types';

export function createGeminiProvider(apiKey: string, model: string): AIProvider {
  const genAI = new GoogleGenerativeAI(apiKey);

  return {
    async analyze(text: string, systemPrompt: string): Promise<string> {
      const m = genAI.getGenerativeModel({ model, systemInstruction: systemPrompt });
      const result = await m.generateContent(text);
      return result.response.text();
    },

    async generate(systemPrompt: string, userPrompt: string, onChunk?: (chunk: string) => void): Promise<string> {
      const m = genAI.getGenerativeModel({ model, systemInstruction: systemPrompt });
      if (onChunk) {
        let full = '';
        const result = await m.generateContentStream(userPrompt);
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            full += text;
            onChunk(text);
          }
        }
        return full;
      }
      const result = await m.generateContent(userPrompt);
      return result.response.text();
    },

    async ocr(imageBase64: string, mimeType: string): Promise<string> {
      const m = genAI.getGenerativeModel({ model });
      const result = await m.generateContent([
        {
          inlineData: { data: imageBase64, mimeType },
        },
        'Extract ALL text from this image exactly as written, preserving the original spelling, punctuation, and formatting. Do not correct any errors. Return only the extracted text, nothing else.',
      ]);
      return result.response.text();
    },
  };
}
