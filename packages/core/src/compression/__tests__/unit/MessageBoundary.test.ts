/**
 * 消息边界查找单元测试
 */

import { describe, it, expect } from 'vitest';
import { MessageBoundaryFinder } from '../../MessageBoundaryFinder';
import type { ModelMessage } from 'ai';

describe('MessageBoundaryFinder', () => {
  const finder = new MessageBoundaryFinder();

  describe('findRoundBoundary', () => {
    it('应该找到正确的轮次边界', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: '第一轮提问' },      // index 0 - 第1轮
        { role: 'assistant', content: '第一轮回答' }, // index 1
        { role: 'user', content: '第二轮提问' },      // index 2 - 第2轮
        { role: 'assistant', content: '第二轮回答' }, // index 3
        { role: 'user', content: '第三轮提问' },      // index 4 - 第3轮
        { role: 'assistant', content: '第三轮回答' }, // index 5
      ];

      // 保留最近 2 轮
      // 算法：从后往前遍历
      // - i=5: assistant, roundCount=0
      // - i=4: user, roundCount=1 (第3轮)
      // - i=3: assistant, roundCount=1
      // - i=2: user, roundCount=2 (第2轮)
      // - i=1: assistant, roundCount=2
      // - i=0: user, roundCount=3 > keepRounds(2), break, keepStartIndex = 0+1 = 1
      const result = finder.findRoundBoundary(history, 2);
      
      expect(result.index).toBe(1); // 从 index 1 开始保留（保留后面2轮）
      expect(result.roundCount).toBe(3); // 遍历时计数到 3
    });

    it('保留轮数超过实际轮数时应保留所有消息', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: '第一轮' },
        { role: 'assistant', content: '回答' },
      ];

      const result = finder.findRoundBoundary(history, 5);
      
      // 只有1轮，但要保留5轮，所以不会截断，index 应为 0（保留所有消息）
      expect(result.index).toBe(0); // 从 index 0 开始保留（保留所有消息）
      expect(result.roundCount).toBe(1);
    });

    it('应该正确处理只有一条 user 消息的情况', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: '唯一的提问' },
      ];

      const result = finder.findRoundBoundary(history, 1);
      
      // 只有1轮，保留1轮，所以保留所有消息（index 为 0）
      expect(result.index).toBe(0); // 从 index 0 开始保留（保留所有消息）
      expect(result.roundCount).toBe(1);
    });
  });

  describe('findMessageBoundary', () => {
    it('应该在 user 消息处截断（安全点）', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: '消息 1' },
        { role: 'assistant', content: '消息 2' },
        { role: 'user', content: '消息 3' },
        { role: 'assistant', content: '消息 4' },
      ];

      // 保留最后 2 条消息，目标索引是 2
      const index = finder.findMessageBoundary(history, 2);
      
      expect(index).toBe(2); // 在 user 消息处截断
    });

    it('应该在纯文本 assistant 消息处截断', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: '消息 1' },
        { role: 'assistant', content: '消息 2' },
        { role: 'user', content: '消息 3' },
      ];

      const index = finder.findMessageBoundary(history, 1);
      
      expect(index).toBe(2); // 保留最后一条 user 消息
    });

    it('应该保持工具调用配对完整', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: '消息 1' },
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
        { role: 'assistant', content: '最终回答' },
      ];

      // 尝试只保留最后 2 条消息
      const index = finder.findMessageBoundary(history, 2);
      
      // 应该从 assistant(toolCall) 开始保留，保持配对完整
      expect(index).toBe(1);
    });

    it('应该处理多个工具调用的情况', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: '执行任务' },
        { 
          role: 'assistant', 
          content: [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'tool1', args: {} },
            { type: 'tool-call', toolCallId: 'call-2', toolName: 'tool2', args: {} }
          ] 
        },
        { 
          role: 'tool', 
          content: [
            { type: 'tool-result', toolCallId: 'call-1', toolName: 'tool1', result: 'result1' }
          ] 
        },
        { 
          role: 'tool', 
          content: [
            { type: 'tool-result', toolCallId: 'call-2', toolName: 'tool2', result: 'result2' }
          ] 
        },
        { role: 'assistant', content: '完成' },
      ];

      const index = finder.findMessageBoundary(history, 3);
      
      // 应该保持所有工具调用和结果的配对
      expect(index).toBe(1); // 从 assistant(toolCalls) 开始
    });

    it('保留消息数超过总数时应返回 0', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: '消息 1' },
        { role: 'assistant', content: '消息 2' },
      ];

      const index = finder.findMessageBoundary(history, 10);
      
      expect(index).toBe(0);
    });
  });
});
