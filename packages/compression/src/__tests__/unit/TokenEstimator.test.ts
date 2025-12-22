/**
 * Token 估算单元测试
 */

import { describe, it, expect } from 'vitest';
import { TokenEstimator, estimateTokens } from '../../TokenEstimator';
import type { ModelMessage } from 'ai';

describe('TokenEstimator', () => {
  const estimator = new TokenEstimator();

  describe('estimateTokens', () => {
    it('应该估算纯文本消息的 token 数', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Hello' }, // 5 chars + 10 overhead = 15 chars
        { role: 'assistant', content: 'Hi there!' }, // 9 chars + 10 = 19 chars
      ];

      const tokens = estimator.estimateTokens(messages);
      
      // (15 + 19) * 0.5 = 17
      expect(tokens).toBe(17);
    });

    it('应该估算包含工具调用的消息', () => {
      const messages: ModelMessage[] = [
        { 
          role: 'assistant', 
          content: [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'test', args: { x: 1 } }
          ] 
        },
      ];

      const tokens = estimator.estimateTokens(messages);
      
      // 工具名 + JSON 化的参数 + overhead
      expect(tokens).toBeGreaterThan(0);
    });

    it('应该估算包含工具结果的消息', () => {
      const messages: ModelMessage[] = [
        { 
          role: 'tool', 
          content: [
            { type: 'tool-result', toolCallId: 'call-1', toolName: 'test', result: 'success' }
          ] 
        },
      ];

      const tokens = estimator.estimateTokens(messages);
      
      expect(tokens).toBeGreaterThan(0);
    });

    it('应该处理混合内容的消息', () => {
      const messages: ModelMessage[] = [
        { 
          role: 'assistant', 
          content: [
            { type: 'text', text: 'Let me call a tool' },
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'test', args: {} }
          ] 
        },
      ];

      const tokens = estimator.estimateTokens(messages);
      
      expect(tokens).toBeGreaterThan(0);
    });

    it('应该处理空消息列表', () => {
      const tokens = estimator.estimateTokens([]);
      
      expect(tokens).toBe(0);
    });

    it('应该为中文分配正确的权重', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: '你好世界' }, // 4 个中文字符
      ];

      const tokens = estimator.estimateTokens(messages);
      
      // (4 + 10) * 0.5 = 7
      expect(tokens).toBe(7);
    });
  });

  describe('estimateMessageTokens', () => {
    it('应该估算单条消息的 token 数', () => {
      const message: ModelMessage = {
        role: 'user',
        content: 'Hello, world!',
      };

      const tokens = estimator.estimateMessageTokens(message);
      
      // (13 + 10) * 0.5 = 11.5 -> 12
      expect(tokens).toBe(12);
    });
  });

  describe('estimateTextTokens', () => {
    it('应该估算纯文本的 token 数', () => {
      const text = 'This is a test string';
      
      const tokens = estimator.estimateTextTokens(text);
      
      // 21 * 0.5 = 10.5 -> 11
      expect(tokens).toBe(11);
    });
  });

  describe('快捷函数', () => {
    it('estimateTokens 应该正常工作', () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Test' },
      ];

      const tokens = estimateTokens(messages);
      
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('自定义转换比例', () => {
    it('应该支持自定义字符到 token 的转换比例', () => {
      const customEstimator = new TokenEstimator(1.0); // 1 字符 = 1 token
      
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Hello' }, // 5 chars + 10 = 15
      ];

      const tokens = customEstimator.estimateTokens(messages);
      
      expect(tokens).toBe(15);
    });
  });
});
