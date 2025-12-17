/**
 * TokenEstimator 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TokenEstimator, createTokenEstimator, estimateTokens } from '../TokenEstimator';
import type { ModelMessage } from 'ai';

describe('TokenEstimator', () => {
  let estimator: TokenEstimator;

  beforeEach(() => {
    estimator = new TokenEstimator();
  });

  describe('构造函数和配置', () => {
    it('应该使用默认配置', () => {
      const stats = estimator.getCacheStats();
      expect(stats.maxSize).toBe(1000);
    });

    it('应该支持自定义配置', () => {
      const customEstimator = new TokenEstimator({
        defaultRatio: 0.6,
        chineseRatio: 1.8,
        englishRatio: 0.3,
        maxCacheSize: 500,
      });
      
      const stats = customEstimator.getCacheStats();
      expect(stats.maxSize).toBe(500);
    });

    it('应该支持禁用缓存', () => {
      const noCacheEstimator = new TokenEstimator({
        enableCache: false,
      });
      
      const text = 'test text';
      noCacheEstimator.estimateTextTokens(text);
      noCacheEstimator.estimateTextTokens(text);
      
      const stats = noCacheEstimator.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('estimateTextTokens', () => {
    it('应该正确估算英文文本', () => {
      const text = 'Hello world this is a test';
      const tokens = estimator.estimateTextTokens(text);
      
      // 英文默认比例 0.4，文本长度 26
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length);
    });

    it('应该正确估算中文文本', () => {
      const text = '你好世界这是一个测试';
      const tokens = estimator.estimateTextTokens(text);
      
      // 中文默认比例 1.5，每个字符消耗更多 token
      expect(tokens).toBeGreaterThan(text.length * 1.0);
    });

    it('应该正确估算混合语言文本', () => {
      const text = 'Hello 世界 test 测试';
      const tokens = estimator.estimateTextTokens(text);
      
      expect(tokens).toBeGreaterThan(0);
    });

    it('应该处理空文本', () => {
      const tokens = estimator.estimateTextTokens('');
      expect(tokens).toBe(0);
    });

    it('应该使用缓存', () => {
      const text = 'test text for caching';
      
      // 第一次调用
      const tokens1 = estimator.estimateTextTokens(text);
      
      // 第二次调用应该使用缓存
      const tokens2 = estimator.estimateTextTokens(text);
      
      expect(tokens1).toBe(tokens2);
      
      const stats = estimator.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('estimateMessageTokens', () => {
    it('应该估算字符串内容消息', () => {
      const message: ModelMessage = {
        role: 'user',
        content: 'Hello world',
      };
      
      const tokens = estimator.estimateMessageTokens(message);
      
      // 应该包含内容 + 角色开销 (10)
      expect(tokens).toBeGreaterThan(5);
    });

    it('应该估算数组内容消息（文本部分）', () => {
      const message: ModelMessage = {
        role: 'assistant',
        content: [
          { type: 'text', text: 'This is a response' },
        ],
      };
      
      const tokens = estimator.estimateMessageTokens(message);
      expect(tokens).toBeGreaterThan(5);
    });

    it('应该估算工具调用消息', () => {
      const message: ModelMessage = {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'browser_navigate',
            args: { url: 'https://example.com' },
          },
        ],
      };
      
      const tokens = estimator.estimateMessageTokens(message);
      
      // 应该包含工具名 + 参数 JSON 长度
      expect(tokens).toBeGreaterThan(10);
    });

    it('应该估算工具结果消息（字符串输出）', () => {
      const message: ModelMessage = {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'browser_navigate',
            output: 'Navigation successful',
          },
        ],
      };
      
      const tokens = estimator.estimateMessageTokens(message);
      expect(tokens).toBeGreaterThan(5);
    });

    it('应该估算工具结果消息（对象输出）', () => {
      const message: ModelMessage = {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'browser_navigate',
            output: { success: true, data: 'some data' },
          },
        ],
      };
      
      const tokens = estimator.estimateMessageTokens(message);
      expect(tokens).toBeGreaterThan(10);
    });

    it('应该处理混合内容消息', () => {
      const message: ModelMessage = {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me help you' },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'browser_navigate',
            args: { url: 'https://example.com' },
          },
        ],
      };
      
      const tokens = estimator.estimateMessageTokens(message);
      expect(tokens).toBeGreaterThan(20);
    });
  });

  describe('estimateTokens', () => {
    it('应该估算消息列表的总 token 数', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ];
      
      const tokens = estimator.estimateTokens(messages);
      
      expect(tokens).toBeGreaterThan(10);
      expect(tokens).toBe(
        estimator.estimateMessageTokens(messages[0]) +
        estimator.estimateMessageTokens(messages[1]) +
        estimator.estimateMessageTokens(messages[2])
      );
    });

    it('应该处理空消息列表', () => {
      const tokens = estimator.estimateTokens([]);
      expect(tokens).toBe(0);
    });

    it('应该正确估算包含工具调用的对话', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Go to example.com' },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'browser_navigate',
              args: { url: 'https://example.com' },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'browser_navigate',
              output: 'Success',
            },
          ],
        },
      ];
      
      const tokens = estimator.estimateTokens(messages);
      expect(tokens).toBeGreaterThan(30);
    });
  });

  describe('缓存管理', () => {
    it('应该正确清除缓存', () => {
      estimator.estimateTextTokens('test 1');
      estimator.estimateTextTokens('test 2');
      
      let stats = estimator.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
      
      estimator.clearCache();
      
      stats = estimator.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('应该实现 LRU 缓存策略', () => {
      const smallCacheEstimator = new TokenEstimator({
        maxCacheSize: 3,
      });
      
      // 添加 4 个条目
      smallCacheEstimator.estimateTextTokens('text 1');
      smallCacheEstimator.estimateTextTokens('text 2');
      smallCacheEstimator.estimateTextTokens('text 3');
      smallCacheEstimator.estimateTextTokens('text 4');
      
      const stats = smallCacheEstimator.getCacheStats();
      // 缓存大小应该不超过最大值
      expect(stats.size).toBeLessThanOrEqual(3);
    });

    it('应该提供缓存统计信息', () => {
      const stats = estimator.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.maxSize).toBe('number');
    });
  });

  describe('语言检测', () => {
    it('应该检测纯英文', () => {
      const text = 'This is pure English text';
      const tokens = estimator.estimateTextTokens(text);
      
      // 英文应该使用较小的比例
      expect(tokens).toBeLessThan(text.length * 0.5);
    });

    it('应该检测纯中文', () => {
      const text = '这是纯中文文本内容';
      const tokens = estimator.estimateTextTokens(text);
      
      // 中文应该使用较大的比例
      expect(tokens).toBeGreaterThan(text.length * 1.0);
    });

    it('应该处理特殊字符', () => {
      const text = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const tokens = estimator.estimateTextTokens(text);
      
      expect(tokens).toBeGreaterThan(0);
    });

    it('应该处理数字', () => {
      const text = '123456789';
      const tokens = estimator.estimateTextTokens(text);
      
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('工厂函数', () => {
    it('createTokenEstimator 应该创建实例', () => {
      const est = createTokenEstimator();
      expect(est).toBeInstanceOf(TokenEstimator);
    });

    it('createTokenEstimator 应该支持配置', () => {
      const est = createTokenEstimator({
        maxCacheSize: 500,
      });
      
      const stats = est.getCacheStats();
      expect(stats.maxSize).toBe(500);
    });

    it('estimateTokens 快捷函数应该工作', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Hello' },
      ];
      
      const tokens = estimateTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('边界情况', () => {
    it('应该处理极长的文本', () => {
      const longText = 'a'.repeat(10000);
      const tokens = estimator.estimateTextTokens(longText);
      
      expect(tokens).toBeGreaterThan(1000);
    });

    it('应该处理 undefined 内容部分', () => {
      const message: ModelMessage = {
        role: 'assistant',
        content: [
          { type: 'text', text: undefined as any },
        ],
      };
      
      const tokens = estimator.estimateMessageTokens(message);
      expect(tokens).toBeGreaterThan(0); // 至少有角色开销
    });

    it('应该处理空数组内容', () => {
      const message: ModelMessage = {
        role: 'assistant',
        content: [],
      };
      
      const tokens = estimator.estimateMessageTokens(message);
      expect(tokens).toBeGreaterThan(0); // 至少有角色开销
    });

    it('应该处理 null 参数', () => {
      const message: ModelMessage = {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'test',
            args: null as any,
          },
        ],
      };
      
      const tokens = estimator.estimateMessageTokens(message);
      expect(tokens).toBeGreaterThan(0);
    });
  });
});

