/**
 * AIProviders 测试
 * 测试 AI 配置工具函数
 */

import { describe, it, expect } from 'vitest';
import {
  ensureAIConfigDefaults,
  detectProviderIdFromConfig,
  createDefaultAIConfig,
  DEFAULT_PROVIDER_ID,
  CUSTOM_PROVIDER_ID,
  getProviderCapabilities,
} from '../../../../src/services/aiProviders';

describe('AIProviders', () => {
  describe('createDefaultAIConfig', () => {
    it('should create default config for known provider', () => {
      const config = createDefaultAIConfig('openai');
      expect(config.providerId).toBe('openai');
      expect(config.baseURL).toContain('openai.com');
    });

    it('should create default config for custom provider', () => {
      // Assuming 'custom' or unknown id behavior
      const config = createDefaultAIConfig(CUSTOM_PROVIDER_ID);
      expect(config.providerId).toBe(undefined); // preset not found for custom id
      expect(config.provider).toBe('自定义服务');
    });
  });

  describe('detectProviderIdFromConfig', () => {
    it('should return default id if config is null', () => {
      expect(detectProviderIdFromConfig(null)).toBe(DEFAULT_PROVIDER_ID);
    });

    it('should return providerId if present', () => {
      expect(detectProviderIdFromConfig({ providerId: 'openai' })).toBe('openai');
    });

    it('should detect by baseURL hostname', () => {
      expect(detectProviderIdFromConfig({ baseURL: 'https://api.openai.com/v1' })).toBe('openai');
    });
  });

  describe('ensureAIConfigDefaults', () => {
    it('should fill missing fields with defaults based on providerId', () => {
      const config = { providerId: 'openai', apiKey: 'test' };
      const defaults = ensureAIConfigDefaults(config);

      expect(defaults.baseURL).toContain('openai.com'); // Filled from preset
      expect(defaults.model).toBeTruthy(); // Filled from preset
      expect(defaults.timeoutMs).toBe(300000); // Default value
    });

    it('should preserve existing values', () => {
      const config = {
        providerId: 'openai',
        apiKey: 'test',
        timeoutMs: 1000,
        model: 'gpt-custom',
      };
      const defaults = ensureAIConfigDefaults(config);

      expect(defaults.timeoutMs).toBe(1000);
      expect(defaults.model).toBe('gpt-custom');
    });
  });

  describe('getProviderCapabilities', () => {
    it('marks reasoning models correctly', () => {
      const capabilities = getProviderCapabilities({
        providerId: 'deepseek',
        model: 'deepseek-reasoner',
      });

      expect(capabilities.reasoning).toBe(true);
      expect(capabilities.toolCalling).toBe(false);
    });

    it('marks tool capable chat models correctly', () => {
      const capabilities = getProviderCapabilities({
        providerId: 'openai',
        model: 'gpt-4o',
      });

      expect(capabilities.streaming).toBe(true);
      expect(capabilities.toolCalling).toBe(true);
      expect(capabilities.structuredOutputs).toBe(true);
    });
  });
});
