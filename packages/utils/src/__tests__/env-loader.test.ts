import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validateApiKey,
  getLLMConfig,
  type ApiKeyValidation,
} from '../env-loader';

describe('env-loader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 重置环境变量
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // 恢复环境变量
    process.env = originalEnv;
  });

  describe('validateApiKey', () => {
    it('应该验证有效的 OpenAI API Key', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key-12345';
      
      const result: ApiKeyValidation = validateApiKey('openai');
      
      expect(result.valid).toBe(true);
      expect(result.provider).toBe('openai');
      expect(result.apiKey).toBe('sk-test-key-12345');
      expect(result.error).toBeUndefined();
    });

    it('应该拒绝无效的占位符 API Key', () => {
      process.env.OPENAI_API_KEY = 'sk-xxx';
      
      const result: ApiKeyValidation = validateApiKey('openai');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('未找到有效的');
    });

    it('应该拒绝空 API Key', () => {
      process.env.OPENAI_API_KEY = '';
      
      const result: ApiKeyValidation = validateApiKey('openai');
      
      expect(result.valid).toBe(false);
    });

    it('应该拒绝 undefined API Key', () => {
      delete process.env.OPENAI_API_KEY;
      
      const result: ApiKeyValidation = validateApiKey('openai');
      
      expect(result.valid).toBe(false);
    });

    it('应该验证 Anthropic API Key', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-api-key-12345';
      
      const result: ApiKeyValidation = validateApiKey('anthropic');
      
      expect(result.valid).toBe(true);
      expect(result.provider).toBe('anthropic');
    });

    it('应该验证 Google API Key', () => {
      process.env.GOOGLE_API_KEY = 'AIza-test-key-12345';
      
      const result: ApiKeyValidation = validateApiKey('google');
      
      expect(result.valid).toBe(true);
      expect(result.provider).toBe('google');
    });

    it('应该在未指定 provider 时检查所有可用的 API Keys', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-key';
      
      const result: ApiKeyValidation = validateApiKey();
      
      expect(result.valid).toBe(true);
      expect(['openai', 'anthropic']).toContain(result.provider);
    });

    it('应该在没有任何有效 API Key 时返回错误', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      
      const result: ApiKeyValidation = validateApiKey();
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('未找到');
    });
  });

  describe('getLLMConfig', () => {
    it('应该返回 OpenAI 配置', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.LLM_MODEL = 'gpt-4o';
      
      const config = getLLMConfig('openai');
      
      expect(config.provider).toBe('openai');
      expect(config.apiKey).toBe('sk-test-key');
      expect(config.model).toBe('gpt-4o');
    });

    it('应该返回 Anthropic 配置', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-key';
      process.env.LLM_MODEL = 'claude-3-5-sonnet-20241022';
      
      const config = getLLMConfig('anthropic');
      
      expect(config.provider).toBe('anthropic');
      expect(config.apiKey).toBe('sk-ant-key');
      expect(config.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('应该使用默认模型当未指定时', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      delete process.env.LLM_MODEL;
      
      const config = getLLMConfig('openai');
      
      expect(config.model).toBe('gpt-4o');
    });

    it('应该在缺少 API Key 时抛出错误', () => {
      delete process.env.OPENAI_API_KEY;
      
      expect(() => getLLMConfig('openai')).toThrow();
    });

    it('应该支持自定义 baseURL', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.OPENAI_BASE_URL = 'https://custom.openai.com/v1';
      
      const config = getLLMConfig('openai');
      
      expect(config.baseURL).toBe('https://custom.openai.com/v1');
    });

    it('应该自动检测第一个可用的 provider', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-key';
      delete process.env.OPENAI_API_KEY;
      
      const config = getLLMConfig();
      
      expect(config.provider).toBe('anthropic');
      expect(config.apiKey).toBe('sk-ant-key');
    });
  });
});

