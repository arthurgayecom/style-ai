import type { AIProvider } from './types';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function createGeminiProvider(apiKey: string, model: string): AIProvider {
  async function callGemini(contents: unknown[], systemInstruction?: string, stream = false) {
    const body: Record<string, unknown> = { contents, generationConfig: { maxOutputTokens: 8192 } };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const endpoint = stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?';
    const res = await fetch(`${BASE}/${model}:${endpoint}key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Gemini API error (${res.status})`);
    }

    return res;
  }

  return {
    async analyze(text: string, systemPrompt: string): Promise<string> {
      const contents = [{ role: 'user', parts: [{ text }] }];
      const res = await callGemini(contents, systemPrompt);
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    },

    async generate(systemPrompt: string, userPrompt: string, onChunk?: (chunk: string) => void): Promise<string> {
      const contents = [{ role: 'user', parts: [{ text: userPrompt }] }];

      if (onChunk) {
        const res = await callGemini(contents, systemPrompt, true);
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No stream reader');

        const decoder = new TextDecoder();
        let full = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const json = JSON.parse(line.slice(6));
                const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (text) {
                  full += text;
                  onChunk(text);
                }
              } catch {
                // skip malformed JSON chunks
              }
            }
          }
        }
        return full;
      }

      const res = await callGemini(contents, systemPrompt);
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    },

    async ocr(imageBase64: string, mimeType: string): Promise<string> {
      const contents = [{
        role: 'user',
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          { text: 'Extract ALL text from this image exactly as written, preserving the original spelling, punctuation, and formatting. Do not correct any errors. Return only the extracted text, nothing else.' },
        ],
      }];
      const res = await callGemini(contents);
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    },
  };
}
