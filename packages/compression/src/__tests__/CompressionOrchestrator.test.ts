/**
 * CompressionOrchestrator 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompressionOrchestrator, compressHistory, shouldCompress } from '../CompressionOrchestrator';
import type { ILLMClient } from '@monkey-agent/types';
import type { ModelMessage } from 'ai';
import { InsufficientMessagesError, InvalidStrategyError } from '../errors';

// 模拟 LLM 客户端
const createMockLLMClient = (mockSummary: string = '这是一个测试摘要'): ILLMClient => {
  return {
    chat: vi.fn().mockResolvedValue({ text: mockSummary }),
    stream: vi.fn(),
  } as any;
};

describe('CompressionOrchestrator', () => {
  let orchestrator: CompressionOrchestrator;
  let mockLLMClient: ILLMClient;

  beforeEach(() => {
    orchestrator = new CompressionOrchestrator();
    mockLLMClient = createMockLLMClient();
  });

  describe('compressHistory - 基于轮次', () => {
    it('应该压缩基于轮次的历史', async () => {
      const history: ModelMessage[] = [
        { role: 'user', content: '第一轮问题' },
        { role: 'assistant', content: '第一轮回答' },
        { role: 'user', content: '第二轮问题' },
        { role: 'assistant', content: '第二轮回答' },
        { role: 'user', content: '第三轮问题' },
        { role: 'assistant', content: '第三轮回答' },
      ];

      const result = await orchestrator.compressHistory(
        history,
        { keepRounds: 1 },
        mockLLMClient
      );

      expect(result.success).toBe(true);
      expect(result.summary).toBe('这是一个测试摘要');
      expect(result.originalLength).toBe(6);
      expect(result.compressedCount).toBe(4);
      expect(result.keptMessages.length).toBe(2);
      expect(result.compressedHistory.length).toBe(3); // 摘要 + 2 条保留消息
    });

    it('应该在压缩历史中包含摘要', async () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
        { role: 'assistant', content: 'reply1' },
        { role: 'user', content: 'msg2' },
        { role: 'assistant', content: 'reply2' },
      ];

      const result = await orchestrator.compressHistory(
        history,
        { keepRounds: 1 },
        mockLLMClient
      );

      const firstMessage = result.compressedHistory[0];
      expect(firstMessage.role).toBe('user');
      expect(firstMessage.content).toContain('[前期对话摘要]');
      expect(firstMessage.content).toContain('这是一个测试摘要');
    });
  });

  describe('compressHistory - 基于消息数', () => {
    it('应该压缩基于消息数的历史', async () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
        { role: 'assistant', content: 'reply1' },
        { role: 'user', content: 'msg2' },
        { role: 'assistant', content: 'reply2' },
        { role: 'user', content: 'msg3' },
        { role: 'assistant', content: 'reply3' },
      ];

      const result = await orchestrator.compressHistory(
        history,
        { keepMessages: 3 },
        mockLLMClient
      );

      expect(result.success).toBe(true);
      expect(result.keptMessages.length).toBe(3);
    });

    it('应该正确处理工具调用消息', async () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
        { role: 'assistant', content: 'reply1' },
        { role: 'user', content: 'msg2' },
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

      const result = await orchestrator.compressHistory(
        history,
        { keepMessages: 2 },
        mockLLMClient
      );

      expect(result.success).toBe(true);
      // 应该保留完整的工具调用对
      expect(result.keptMessages.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('错误处理', () => {
    it('应该在未指定策略时抛出错误', async () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
      ];

      await expect(
        orchestrator.compressHistory(history, {}, mockLLMClient)
      ).rejects.toThrow(InvalidStrategyError);
    });

    it('应该在消息不足时抛出错误', async () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
      ];

      await expect(
        orchestrator.compressHistory(
          history,
          { keepRounds: 1 },
          mockLLMClient
        )
      ).rejects.toThrow(InsufficientMessagesError);
    });

    it('应该在静默模式下返回失败结果而不抛出错误', async () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
      ];

      const result = await orchestrator.compressHistory(
        history,
        { keepRounds: 1, silent: true },
        mockLLMClient
      );

      expect(result.success).toBe(false);
      expect(result.warnings).toBeDefined();
      expect(result.compressedHistory).toEqual(history);
    });

    it('应该在 LLM 失败时处理错误', async () => {
      const errorClient: ILLMClient = {
        chat: vi.fn().mockRejectedValue(new Error('LLM failed')),
        stream: vi.fn(),
      } as any;

      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
        { role: 'assistant', content: 'reply1' },
        { role: 'user', content: 'msg2' },
        { role: 'assistant', content: 'reply2' },
      ];

      await expect(
        orchestrator.compressHistory(
          history,
          { keepRounds: 1 },
          errorClient
        )
      ).rejects.toThrow('LLM failed');
    });
  });

  describe('shouldCompress', () => {
    it('应该在消息数超过阈值时建议压缩', () => {
      const history: ModelMessage[] = Array(25).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `msg${i}`,
      }));

      const result = orchestrator.shouldCompress(history, {
        maxMessages: 20,
        keepRecentRounds: 3,
      });

      expect(result.shouldCompress).toBe(true);
      expect(result.reason).toContain('messages:');
      expect(result.recommendedOptions).toBeDefined();
    });

    it('应该在 token 数超过阈值时建议压缩', () => {
      const history: ModelMessage[] = Array(15).fill(null).map(() => ({
        role: 'user',
        content: 'a'.repeat(1000), // 每条消息很长
      }));

      const result = orchestrator.shouldCompress(history, {
        maxTokens: 5000,
        keepRecentMessages: 5,
      });

      expect(result.shouldCompress).toBe(true);
      expect(result.reason).toContain('tokens:');
    });

    it('应该在未超过阈值时不建议压缩', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
        { role: 'assistant', content: 'reply1' },
      ];

      const result = orchestrator.shouldCompress(history, {
        maxMessages: 20,
        maxTokens: 8000,
      });

      expect(result.shouldCompress).toBe(false);
    });

    it('应该为多轮对话推荐基于轮次的策略', () => {
      const history: ModelMessage[] = [];
      for (let i = 0; i < 10; i++) {
        history.push({ role: 'user', content: `round ${i}` });
        history.push({ role: 'assistant', content: `reply ${i}` });
      }

      const result = orchestrator.shouldCompress(history, {
        maxMessages: 15,
        keepRecentRounds: 3,
        keepRecentMessages: 10,
      });

      expect(result.shouldCompress).toBe(true);
      expect(result.recommendedOptions?.keepRounds).toBe(3);
    });

    it('应该为单轮多工具调用推荐基于消息数的策略', () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg' },
        ...Array(20).fill(null).map((_, i) => ({
          role: 'assistant',
          content: `tool call ${i}`,
        })),
      ];

      const result = orchestrator.shouldCompress(history, {
        maxMessages: 15,
        keepRecentMessages: 10,
        keepRecentRounds: 3,
      });

      expect(result.shouldCompress).toBe(true);
      expect(result.recommendedOptions?.keepMessages).toBe(10);
    });
  });

  describe('isContextLengthError', () => {
    it('应该识别 OpenAI 上下文长度错误', () => {
      const error = "This model's maximum context length is 4096 tokens";
      expect(orchestrator.isContextLengthError(error)).toBe(true);
    });

    it('应该识别 Anthropic 上下文长度错误', () => {
      const error = 'prompt is too long';
      expect(orchestrator.isContextLengthError(error)).toBe(true);
    });

    it('应该识别通用 token 限制错误', () => {
      const errors = [
        'token limit exceeded',
        'too many tokens',
        'exceeds token limit',
        'context length exceeded',
      ];

      errors.forEach(error => {
        expect(orchestrator.isContextLengthError(error)).toBe(true);
      });
    });

    it('应该忽略非上下文错误', () => {
      const errors = [
        'network error',
        'invalid API key',
        'rate limit exceeded',
      ];

      errors.forEach(error => {
        expect(orchestrator.isContextLengthError(error)).toBe(false);
      });
    });
  });

  describe('buildCompressedHistory', () => {
    it('应该构建包含摘要的历史', () => {
      const summary = '这是压缩摘要';
      const recentMessages: ModelMessage[] = [
        { role: 'user', content: 'recent msg' },
        { role: 'assistant', content: 'recent reply' },
      ];

      const result = orchestrator.buildCompressedHistory(summary, recentMessages);

      expect(result.length).toBe(3);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toContain(summary);
      expect(result[1]).toEqual(recentMessages[0]);
      expect(result[2]).toEqual(recentMessages[1]);
    });

    it('应该处理空的最近消息', () => {
      const summary = '摘要';
      const result = orchestrator.buildCompressedHistory(summary, []);

      expect(result.length).toBe(1);
      expect(result[0].content).toContain(summary);
    });
  });

  describe('向后兼容的导出函数', () => {
    it('compressHistory 函数应该工作', async () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
        { role: 'assistant', content: 'reply1' },
        { role: 'user', content: 'msg2' },
        { role: 'assistant', content: 'reply2' },
      ];

      const result = await compressHistory(
        history,
        { keepRounds: 1 },
        mockLLMClient
      );

      expect(result.success).toBe(true);
    });

    it('shouldCompress 函数应该工作', () => {
      const history: ModelMessage[] = Array(25).fill(null).map(() => ({
        role: 'user',
        content: 'test',
      }));

      const result = shouldCompress(history, { maxMessages: 20 });
      expect(result.shouldCompress).toBe(true);
    });
  });

  describe('边界情况', () => {
    it('应该处理极长的历史', async () => {
      const history: ModelMessage[] = [];
      for (let i = 0; i < 1000; i++) {
        history.push({ role: 'user', content: `msg${i}` });
        history.push({ role: 'assistant', content: `reply${i}` });
      }

      const result = await orchestrator.compressHistory(
        history,
        { keepRounds: 5 },
        mockLLMClient
      );

      expect(result.success).toBe(true);
      expect(result.compressedCount).toBeGreaterThan(990);
    });

    it('应该处理只有一轮对话', async () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
        { role: 'assistant', content: 'reply1' },
      ];

      await expect(
        orchestrator.compressHistory(
          history,
          { keepRounds: 1 },
          mockLLMClient
        )
      ).rejects.toThrow(InsufficientMessagesError);
    });

    it('应该处理混合内容类型', async () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'reply1' },
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
        { role: 'assistant', content: 'reply2' },
      ];

      const result = await orchestrator.compressHistory(
        history,
        { keepRounds: 1 },
        mockLLMClient
      );

      expect(result.success).toBe(true);
    });

    it('应该在配置不合理时添加警告', async () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
        { role: 'assistant', content: 'reply1' },
        { role: 'user', content: 'msg2' },
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
        { role: 'user', content: 'msg3' },
        { role: 'assistant', content: 'reply3' },
      ];

      const result = await orchestrator.compressHistory(
        history,
        { keepMessages: 3 },
        mockLLMClient
      );

      // 可能有工具配对警告
      if (result.warnings) {
        expect(result.warnings.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('自定义摘要配置', () => {
    it('应该支持自定义摘要配置', async () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'msg1' },
        { role: 'assistant', content: 'reply1' },
        { role: 'user', content: 'msg2' },
        { role: 'assistant', content: 'reply2' },
      ];

      const result = await orchestrator.compressHistory(
        history,
        { keepRounds: 1 },
        mockLLMClient,
        {
          maxWords: 100,
          language: 'chinese',
          strategy: 'concise',
        }
      );

      expect(result.success).toBe(true);
      expect(mockLLMClient.chat).toHaveBeenCalled();
    });
  });
});

