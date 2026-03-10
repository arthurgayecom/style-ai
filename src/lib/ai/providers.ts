import type { AIProvider } from './types';
import type { ProviderConfig, ProviderType } from '@/types/ai';
import { PROVIDERS } from '@/types/ai';

export function createProvider(config: ProviderConfig): AIProvider {
  const model = config.model || PROVIDERS[config.type].defaultModel;

  switch (config.type) {
    case 'anthropic': {
      const { createAnthropicProvider } = require('./anthropic');
      return createAnthropicProvider(config.apiKey!, model);
    }
    case 'openai': {
      const { createOpenAIProvider } = require('./openai');
      return createOpenAIProvider(config.apiKey!, model);
    }
    case 'gemini': {
      const { createGeminiProvider } = require('./gemini');
      return createGeminiProvider(config.apiKey!, model);
    }
    case 'claude-cli': {
      const { createClaudeCliProvider } = require('./claude-cli');
      return createClaudeCliProvider();
    }
    case 'kimi': {
      const { createKimiProvider } = require('./kimi');
      return createKimiProvider(config.apiKey!, model);
    }
    case 'ollama': {
      const { createOllamaProvider } = require('./ollama');
      return createOllamaProvider(model, config.baseUrl);
    }
    default:
      throw new Error(`Unknown provider: ${config.type}`);
  }
}

export function getProviderConfig(type: ProviderType, apiKey?: string, model?: string): ProviderConfig {
  return {
    type,
    apiKey,
    model: model || PROVIDERS[type].defaultModel,
    enabled: true,
  };
}
