export type ProviderType = 'anthropic' | 'openai' | 'gemini' | 'claude-cli' | 'kimi' | 'ollama';

export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;
  model?: string;
  enabled: boolean;
  baseUrl?: string;
}

export interface ProviderInfo {
  type: ProviderType;
  name: string;
  description: string;
  models: string[];
  defaultModel: string;
  supportsVision: boolean;
  requiresApiKey: boolean;
}

export const PROVIDERS: Record<ProviderType, ProviderInfo> = {
  anthropic: {
    type: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Claude 4 & 3.5 Sonnet — excellent style analysis and writing',
    models: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
    defaultModel: 'claude-sonnet-4-5-20250929',
    supportsVision: true,
    requiresApiKey: true,
  },
  openai: {
    type: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o — strong general-purpose writing and vision',
    models: ['gpt-4o', 'gpt-4o-mini'],
    defaultModel: 'gpt-4o',
    supportsVision: true,
    requiresApiKey: true,
  },
  gemini: {
    type: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini Pro — fast and capable with vision support',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    defaultModel: 'gemini-2.0-flash',
    supportsVision: true,
    requiresApiKey: true,
  },
  'claude-cli': {
    type: 'claude-cli',
    name: 'Claude CLI',
    description: 'Uses your Claude subscription via the installed CLI',
    models: ['claude-cli'],
    defaultModel: 'claude-cli',
    supportsVision: false,
    requiresApiKey: false,
  },
  kimi: {
    type: 'kimi',
    name: 'Kimi (Moonshot)',
    description: 'Moonshot AI — 128k context, great for long documents',
    models: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k'],
    defaultModel: 'moonshot-v1-32k',
    supportsVision: false,
    requiresApiKey: true,
  },
  ollama: {
    type: 'ollama',
    name: 'Ollama (Local)',
    description: 'Run models locally on your device — no API key needed',
    models: ['llama3.2', 'mistral', 'gemma2', 'phi3', 'qwen2.5'],
    defaultModel: 'llama3.2',
    supportsVision: false,
    requiresApiKey: false,
  },
};

export interface AIResponse {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}
