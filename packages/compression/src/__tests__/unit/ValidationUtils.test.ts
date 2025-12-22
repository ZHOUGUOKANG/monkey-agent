/**
 * 验证工具单元测试
 */

import { describe, it, expect } from 'vitest';
import { 
  validateConfig, 
  validateToolCallPairing,
  validateCompressionOptions,
  hasEnoughMessagesToCompress 
} from '../../ValidationUtils';
import type { ModelMessage } from 'ai';

describe('ValidationUtils', () => {
  describe('validateConfig', () => {
    it('应该接受有效的配置', () => {
      const result = validateConfig({
        enabled: true,
        maxMessages: 20,
        maxTokens: 8000,
        keepRecentMessages: 10,
        keepRecentRounds: 3,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('应该拒绝过小的 maxMessages', () => {
      const result = validateConfig({
        maxMessages: 1,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxMessages must be at least 2');
    });

    it('应该拒绝过小的 maxTokens', () => {
      const result = validateConfig({
        maxTokens: 50,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('maxTokens must be at least 100');
    });

    it('应该拒绝无效的 keepRecentMessages', () => {
      const result = validateConfig({
        keepRecentMessages: 0,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('keepRecentMessages must be at least 1');
    });

    it('应该警告 keepRecentMessages >= maxMessages', () => {
      const result = validateConfig({
        maxMessages: 10,
        keepRecentMessages: 10,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.[0]).toContain('should be less than maxMessages');
    });

    it('应该警告过大的参数值', () => {
      const result = validateConfig({
        maxMessages: 20000,
        maxTokens: 2000000,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.length).toBeGreaterThan(0);
    });
  });

  describe('validateToolCallPairing', () => {
    it('应该验证通过配对正确的消息', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: '执行任务' },
        { 
          role: 'assistant', 
          content: [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'test', args: {} }
          ] 
        },
        { 
          role: 'tool', 
          content: [
            { type: 'tool-result', toolCallId: 'call-1', toolName: 'test', result: 'ok' }
          ] 
        },
      ];

      const result = validateToolCallPairing(messages);

      expect(result.valid).toBe(true);
      expect(result.issues).toBeUndefined();
    });

    it('应该检测到孤立的 tool-result', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: '执行任务' },
        { 
          role: 'tool', 
          content: [
            { type: 'tool-result', toolCallId: 'call-1', toolName: 'test', result: 'ok' }
          ] 
        },
      ];

      const result = validateToolCallPairing(messages);

      expect(result.valid).toBe(false);
      expect(result.issues).toBeDefined();
      expect(result.issues?.[0]).toContain('Orphan tool-result');
    });

    it('应该检测到未配对的 tool-call', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: '执行任务' },
        { 
          role: 'assistant', 
          content: [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'test', args: {} }
          ] 
        },
      ];

      const result = validateToolCallPairing(messages);

      expect(result.valid).toBe(false);
      expect(result.issues).toBeDefined();
      expect(result.issues?.[0]).toContain('Unmatched tool-call');
    });

    it('应该检测到重复的 toolCallId', () => {
      const messages: ModelMessage[] = [
        { 
          role: 'assistant', 
          content: [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'test', args: {} }
          ] 
        },
        { 
          role: 'assistant', 
          content: [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'test2', args: {} }
          ] 
        },
      ];

      const result = validateToolCallPairing(messages);

      expect(result.valid).toBe(false);
      expect(result.issues).toBeDefined();
      expect(result.issues?.[0]).toContain('Duplicate toolCallId');
    });

    it('应该处理多个工具调用和结果', () => {
      const messages: ModelMessage[] = [
        { 
          role: 'assistant', 
          content: [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'test1', args: {} },
            { type: 'tool-call', toolCallId: 'call-2', toolName: 'test2', args: {} }
          ] 
        },
        { 
          role: 'tool', 
          content: [
            { type: 'tool-result', toolCallId: 'call-1', toolName: 'test1', result: 'ok' }
          ] 
        },
        { 
          role: 'tool', 
          content: [
            { type: 'tool-result', toolCallId: 'call-2', toolName: 'test2', result: 'ok' }
          ] 
        },
      ];

      const result = validateToolCallPairing(messages);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateCompressionOptions', () => {
    it('应该接受有效的 keepRounds', () => {
      const result = validateCompressionOptions({ keepRounds: 3 });
      expect(result.valid).toBe(true);
    });

    it('应该接受有效的 keepMessages', () => {
      const result = validateCompressionOptions({ keepMessages: 10 });
      expect(result.valid).toBe(true);
    });

    it('应该拒绝两者都未指定', () => {
      const result = validateCompressionOptions({});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Must specify either');
    });

    it('应该拒绝负数或零', () => {
      const result1 = validateCompressionOptions({ keepRounds: 0 });
      expect(result1.valid).toBe(false);

      const result2 = validateCompressionOptions({ keepMessages: -1 });
      expect(result2.valid).toBe(false);
    });
  });

  describe('hasEnoughMessagesToCompress', () => {
    it('应该接受足够的消息', () => {
      const result = hasEnoughMessagesToCompress(10, 5);
      expect(result.sufficient).toBe(true);
    });

    it('应该拒绝消息数不足', () => {
      const result = hasEnoughMessagesToCompress(10, 1);
      expect(result.sufficient).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该拒绝 keepStartIndex 为 0', () => {
      const result = hasEnoughMessagesToCompress(10, 0);
      expect(result.sufficient).toBe(false);
      expect(result.error).toContain('keepStartIndex is 0');
    });

    it('应该支持自定义最小压缩消息数', () => {
      const result = hasEnoughMessagesToCompress(10, 3, 5);
      expect(result.sufficient).toBe(false);
    });
  });
});
