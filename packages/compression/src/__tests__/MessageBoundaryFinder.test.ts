/**
 * MessageBoundaryFinder 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MessageBoundaryFinder, createMessageBoundaryFinder } from '../MessageBoundaryFinder';
import type { ModelMessage } from 'ai';

describe('MessageBoundaryFinder', () => {
  let finder: MessageBoundaryFinder;

  beforeEach(() => {
    finder = new MessageBoundaryFinder();
  });

  describe('findRoundBoundary', () => {
    it('应该找到基于轮次的边界', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: '第一轮用户消息' },
        { role: 'assistant', content: '第一轮助手回复' },
        { role: 'user', content: '第二轮用户消息' },
        { role: 'assistant', content: '第二轮助手回复' },
        { role: 'user', content: '第三轮用户消息' },
        { role: 'assistant', content: '第三轮助手回复' },
      ];

      const result = finder.findRoundBoundary(history, 2);
      
      // 应该从第二轮开始保留
      expect(result.index).toBe(2);
      expect(result.roundCount).toBe(3);
    });

    it('应该处理保留轮次大于总轮次的情况', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: '消息1' },
        { role: 'assistant', content: '回复1' },
      ];

      const result = finder.findRoundBoundary(history, 5);
      
      // 应该保留所有消息
      expect(result.index).toBe(0);
      expect(result.roundCount).toBe(1);
    });

    it('应该处理空历史', () => {
      const result = finder.findRoundBoundary([], 3);
      
      expect(result.index).toBe(0);
      expect(result.roundCount).toBe(0);
    });

    it('应该处理包含工具调用的轮次', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: '请导航到网站' },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'navigate',
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
              toolName: 'navigate',
              output: 'Success',
            },
          ],
        },
        { role: 'user', content: '第二轮' },
        { role: 'assistant', content: '回复' },
      ];

      const result = finder.findRoundBoundary(history, 1);
      
      // 应该从最后一轮开始
      expect(result.index).toBe(3);
    });

    it('应该使用缓存', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
        { role: 'assistant', content: 'reply1' },
        { role: 'user', content: 'msg2' },
        { role: 'assistant', content: 'reply2' },
      ];

      // 第一次调用
      const result1 = finder.findRoundBoundary(history, 1);
      
      // 第二次调用（应该使用缓存）
      const result2 = finder.findRoundBoundary(history, 1);
      
      expect(result1).toEqual(result2);
    });
  });

  describe('findMessageBoundary', () => {
    it('应该找到基于消息数的边界', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
        { role: 'assistant', content: 'reply1' },
        { role: 'user', content: 'msg2' },
        { role: 'assistant', content: 'reply2' },
        { role: 'user', content: 'msg3' },
      ];

      const index = finder.findMessageBoundary(history, 3);
      
      // 应该从倒数第3条开始
      expect(index).toBe(2);
    });

    it('应该在 user 消息处截断', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
        { role: 'assistant', content: 'reply1' },
        { role: 'user', content: 'msg2' },
        { role: 'assistant', content: 'reply2' },
      ];

      const index = finder.findMessageBoundary(history, 2);
      
      // 应该在 user 消息处截断
      expect(history[index].role).toBe('user');
    });

    it('应该避免在工具调用对之间截断', () => {
      const history: ModelMessage[] = [
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
        { role: 'user', content: 'msg2' },
      ];

      const index = finder.findMessageBoundary(history, 2);
      
      // 应该从 assistant 工具调用开始（保持配对完整）
      expect(index).toBeLessThanOrEqual(1);
    });

    it('应该处理纯文本 assistant 消息', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
        { role: 'assistant', content: 'pure text reply' },
        { role: 'user', content: 'msg2' },
      ];

      const index = finder.findMessageBoundary(history, 1);
      
      // 可以在纯文本 assistant 后截断
      const msg = history[index];
      expect(['user', 'assistant'].includes(msg.role)).toBe(true);
    });

    it('应该处理多个工具调用', () => {
      const history: ModelMessage[] = [
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

      const index = finder.findMessageBoundary(history, 2);
      
      // 应该保持所有工具调用和结果在一起
      // 从 assistant 工具调用开始保留
      expect(index).toBeLessThanOrEqual(1);
    });

    it('应该处理空历史', () => {
      const index = finder.findMessageBoundary([], 5);
      expect(index).toBe(0);
    });

    it('应该处理 keepMessages 大于历史长度', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
        { role: 'assistant', content: 'reply1' },
      ];

      const index = finder.findMessageBoundary(history, 10);
      
      // 应该返回 0（保留所有）
      expect(index).toBe(0);
    });
  });

  describe('缓存管理', () => {
    it('应该清除所有缓存', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
        { role: 'assistant', content: 'reply1' },
      ];

      finder.findRoundBoundary(history, 1);
      finder.findMessageBoundary(history, 1);
      
      let stats = finder.getCacheStats();
      expect(stats.roundBoundary.size).toBeGreaterThan(0);
      expect(stats.messageBoundary.size).toBeGreaterThan(0);
      
      finder.clearCache();
      
      stats = finder.getCacheStats();
      expect(stats.roundBoundary.size).toBe(0);
      expect(stats.messageBoundary.size).toBe(0);
    });

    it('应该提供缓存统计信息', () => {
      const stats = finder.getCacheStats();
      
      expect(stats).toHaveProperty('roundBoundary');
      expect(stats).toHaveProperty('messageBoundary');
      expect(stats.roundBoundary).toHaveProperty('size');
      expect(stats.roundBoundary).toHaveProperty('maxSize');
    });

    it('应该实现 LRU 缓存', () => {
      const smallFinder = new MessageBoundaryFinder({
        maxCacheSize: 2,
      });

      const history1: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
      ];
      const history2: ModelMessage[] = [
        { role: 'user', content: 'msg2' },
      ];
      const history3: ModelMessage[] = [
        { role: 'user', content: 'msg3' },
      ];

      smallFinder.findRoundBoundary(history1, 1);
      smallFinder.findRoundBoundary(history2, 1);
      smallFinder.findRoundBoundary(history3, 1);
      
      const stats = smallFinder.getCacheStats();
      expect(stats.roundBoundary.size).toBeLessThanOrEqual(2);
    });
  });

  describe('工厂函数', () => {
    it('createMessageBoundaryFinder 应该创建实例', () => {
      const f = createMessageBoundaryFinder();
      expect(f).toBeInstanceOf(MessageBoundaryFinder);
    });

    it('createMessageBoundaryFinder 应该支持配置', () => {
      const f = createMessageBoundaryFinder({
        maxCacheSize: 50,
      });
      
      const stats = f.getCacheStats();
      expect(stats.roundBoundary.maxSize).toBe(50);
    });
  });

  describe('边界情况', () => {
    it('应该处理只有 assistant 消息的历史', () => {
      const history: ModelMessage[] = [
        { role: 'assistant', content: 'reply1' },
        { role: 'assistant', content: 'reply2' },
      ];

      const result = finder.findRoundBoundary(history, 1);
      expect(result.roundCount).toBe(0);
      
      const index = finder.findMessageBoundary(history, 1);
      expect(index).toBeGreaterThanOrEqual(0);
    });

    it('应该处理孤立的 tool 消息', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'orphan-call',
              toolName: 'tool1',
              output: 'result',
            },
          ],
        },
      ];

      const index = finder.findMessageBoundary(history, 1);
      
      // 应该从 tool 消息本身开始（虽然这不应该发生）
      expect(index).toBeGreaterThanOrEqual(0);
    });

    it('应该处理极长的历史', () => {
      const longHistory: ModelMessage[] = [];
      for (let i = 0; i < 1000; i++) {
        longHistory.push({ role: 'user', content: `msg${i}` });
        longHistory.push({ role: 'assistant', content: `reply${i}` });
      }

      const result = finder.findRoundBoundary(longHistory, 5);
      expect(result.roundCount).toBe(1000);
      
      const index = finder.findMessageBoundary(longHistory, 100);
      expect(index).toBe(longHistory.length - 100);
    });
  });
});

