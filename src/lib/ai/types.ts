export interface AIProvider {
  analyze(text: string, systemPrompt: string): Promise<string>;
  generate(systemPrompt: string, userPrompt: string, onChunk?: (chunk: string) => void): Promise<string>;
  ocr(imageBase64: string, mimeType: string): Promise<string>;
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: Error) => void;
}
