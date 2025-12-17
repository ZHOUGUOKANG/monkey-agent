/**
 * ValidationUtils 单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  validateConfig,
  validateConfigOrThrow,
  validateToolCallPairing,
  validateCompressionOptions,
  hasEnoughMessagesToCompress,
} from '../ValidationUtils';
import type { ModelMessage } from 'ai';
import type { ContextCompressionConfig } from '../types';
import { ConfigValidationError } from '../errors';

describe('ValidationUtils', () => {
  describe('validateConfig', () => {
    it('应该验证有效配置', () => {
      const config: ContextCompressionConfig = {
        maxMessages: 20,
        maxTokens: 8000,
        keepRecentRounds: 3,
        keepRecentMessages: 10,
      };

      const result = validateConfig(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('应该检测 maxMessages 过小', () => {
      const config: ContextCompressionConfig = {
        maxMessages: 1,
      };

      const result = validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]).toContain('maxMessages');
    });

    it('应该警告 maxMessages 过大', () => {
      const config: ContextCompressionConfig = {
        maxMessages: 15000,
      };

      const result = validateConfig(config);
      
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('very large'))).toBe(true);
    });

    it('应该检测 maxTokens 过小', () => {
      const config: ContextCompressionConfig = {
        maxTokens: 50,
      };

      const result = validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('应该警告 keepRecentMessages >= maxMessages', () => {
      const config: ContextCompressionConfig = {
        maxMessages: 20,
        keepRecentMessages: 25,
      };

      const result = validateConfig(config);
      
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('should be less than'))).toBe(true);
    });

    it('应该检测配置不一致', () => {
      const config: ContextCompressionConfig = {
        maxMessages: 15,
        keepRecentMessages: 14,
      };

      const result = validateConfig(config);
      
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('Gap'))).toBe(true);
    });

    it('应该检测 keepRecentMessages 为负数', () => {
      const config: ContextCompressionConfig = {
        keepRecentMessages: -1,
      };

      const result = validateConfig(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('应该检测 keepRecentRounds 为 0', () => {
      const config: ContextCompressionConfig = {
        keepRecentRounds: 0,
      };

      const result = validateConfig(config);
      
      expect(result.valid).toBe(false);
    });

    it('应该警告压缩比例过高', () => {
      const config: ContextCompressionConfig = {
        maxMessages: 100,
        keepRecentMessages: 90,
      };

      const result = validateConfig(config);
      
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('very close'))).toBe(true);
    });

    it('应该警告压缩被禁用', () => {
      const config: ContextCompressionConfig = {
        enabled: false,
      };

      const result = validateConfig(config);
      
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('disabled'))).toBe(true);
    });
  });

  describe('validateConfigOrThrow', () => {
    it('应该通过有效配置', () => {
      const config: ContextCompressionConfig = {
        maxMessages: 20,
        maxTokens: 8000,
      };

      expect(() => validateConfigOrThrow(config)).not.toThrow();
    });

    it('应该抛出无效配置错误', () => {
      const config: ContextCompressionConfig = {
        maxMessages: 1,
      };

      expect(() => validateConfigOrThrow(config)).toThrow(ConfigValidationError);
    });

    it('应该在有警告时不抛出错误', () => {
      const config: ContextCompressionConfig = {
        maxMessages: 100,
        keepRecentMessages: 90,
      };

      expect(() => validateConfigOrThrow(config)).not.toThrow();
    });
  });

  describe('validateToolCallPairing', () => {
    it('应该验证正确配对的消息', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              args: {},
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'tool1',
              output: 'result',
            },
          ],
        },
      ];

      const result = validateToolCallPairing(messages);
      
      expect(result.valid).toBe(true);
      expect(result.issues).toBeUndefined();
    });

    it('应该检测未配对的 tool-call', () => {
      const messages: ModelMessage[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              args: {},
            },
          ],
        },
      ];

      const result = validateToolCallPairing(messages);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toBeDefined();
      expect(result.issues?.[0]).toContain('Unmatched tool-call');
    });

    it('应该检测孤立的 tool-result', () => {
      const messages: ModelMessage[] = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'orphan',
              toolName: 'tool1',
              output: 'result',
            },
          ],
        },
      ];

      const result = validateToolCallPairing(messages);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toBeDefined();
      expect(result.issues?.[0]).toContain('Orphan tool-result');
    });

    it('应该检测重复的 toolCallId', () => {
      const messages: ModelMessage[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              args: {},
            },
          ],
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool2',
              args: {},
            },
          ],
        },
      ];

      const result = validateToolCallPairing(messages);
      
      expect(result.valid).toBe(false);
      expect(result.issues).toBeDefined();
      expect(result.issues?.some(i => i.includes('Duplicate'))).toBe(true);
    });

    it('应该处理多个工具调用', () => {
      const messages: ModelMessage[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              args: {},
            },
            {
              type: 'tool-call',
              toolCallId: 'call-2',
              toolName: 'tool2',
              args: {},
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'tool1',
              output: 'result1',
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-2',
              toolName: 'tool2',
              output: 'result2',
            },
          ],
        },
      ];

      const result = validateToolCallPairing(messages);
      
      expect(result.valid).toBe(true);
    });

    it('应该处理空消息列表', () => {
      const result = validateToolCallPairing([]);
      
      expect(result.valid).toBe(true);
    });

    it('应该处理纯文本消息', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' },
      ];

      const result = validateToolCallPairing(messages);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('validateCompressionOptions', () => {
    it('应该验证有效的 keepRounds', () => {
      const result = validateCompressionOptions({ keepRounds: 3 });
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('应该验证有效的 keepMessages', () => {
      const result = validateCompressionOptions({ keepMessages: 10 });
      
      expect(result.valid).toBe(true);
    });

    it('应该拒绝两者都未指定', () => {
      const result = validateCompressionOptions({});
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Must specify');
    });

    it('应该拒绝 keepRounds <= 0', () => {
      const result = validateCompressionOptions({ keepRounds: 0 });
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('positive');
    });

    it('应该拒绝 keepMessages <= 0', () => {
      const result = validateCompressionOptions({ keepMessages: -5 });
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('positive');
    });

    it('应该接受同时指定两者', () => {
      const result = validateCompressionOptions({
        keepRounds: 3,
        keepMessages: 10,
      });
      
      // 虽然通常只用一个，但同时指定是合法的
      expect(result.valid).toBe(true);
    });
  });

  describe('hasEnoughMessagesToCompress', () => {
    it('应该在有足够消息时返回 true', () => {
      const result = hasEnoughMessagesToCompress(10, 5, 2);
      
      expect(result.sufficient).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('应该在 keepStartIndex 为 0 时返回 false', () => {
      const result = hasEnoughMessagesToCompress(10, 0, 2);
      
      expect(result.sufficient).toBe(false);
      expect(result.error).toContain('No messages to compress');
    });

    it('应该在消息不足时返回 false', () => {
      const result = hasEnoughMessagesToCompress(10, 1, 2);
      
      expect(result.sufficient).toBe(false);
      expect(result.error).toContain('Not enough messages');
    });

    it('应该使用默认最小压缩数', () => {
      const result = hasEnoughMessagesToCompress(10, 2);
      
      expect(result.sufficient).toBe(true);
    });

    it('应该在边界情况下工作', () => {
      const result = hasEnoughMessagesToCompress(5, 2, 2);
      
      expect(result.sufficient).toBe(true);
    });

    it('应该在消息数刚好等于最小值时通过', () => {
      const result = hasEnoughMessagesToCompress(10, 3, 3);
      
      expect(result.sufficient).toBe(true);
    });
  });

  describe('边界情况', () => {
    it('应该处理极小的配置值', () => {
      const config: ContextCompressionConfig = {
        maxMessages: 2,
        maxTokens: 100,
        keepRecentMessages: 1,
        keepRecentRounds: 1,
      };

      const result = validateConfig(config);
      
      // 应该有警告但不应该有错误
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
    });

    it('应该处理极大的配置值', () => {
      const config: ContextCompressionConfig = {
        maxMessages: 50000,
        maxTokens: 2000000,
        keepRecentMessages: 1000,
        keepRecentRounds: 100,
      };

      const result = validateConfig(config);
      
      expect(result.warnings).toBeDefined();
    });

    it('应该处理空内容数组', () => {
      const messages: ModelMessage[] = [
        { role: 'assistant', content: [] },
      ];

      const result = validateToolCallPairing(messages);
      
      expect(result.valid).toBe(true);
    });
  });
});

