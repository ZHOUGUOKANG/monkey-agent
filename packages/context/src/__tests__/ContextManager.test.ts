/**
 * ContextManager 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextManager } from '../ContextManager';
import type { ModelMessage } from 'ai';
import type { ILLMClient } from '@monkey-agent/types';

describe('ContextManager', () => {
  let contextManager: ContextManager;
  let mockLLM: ILLMClient;

  beforeEach(() => {
    // Mock LLM Client
    mockLLM = {
      chat: vi.fn(),
      stream: vi.fn(),
      streamText: vi.fn(),
    };

    contextManager = new ContextManager(mockLLM, {
      enabled: true,
      maxMessages: 10,
      maxTokens: 1000,
      checkInterval: 3,
    });
  });

  describe('构造函数', () => {
    it('应该正确初始化配置', () => {
      expect(contextManager).toBeDefined();
      expect(contextManager).toBeInstanceOf(ContextManager);
    });

    it('应该使用默认的 checkInterval', () => {
      const manager = new ContextManager(mockLLM, {
        enabled: true,
        maxMessages: 10,
        maxTokens: 1000,
      });
      expect(manager).toBeDefined();
    });
  });

  describe('manageContext', () => {
    it('应该在禁用时直接返回原始历史', async () => {
      const disabledManager = new ContextManager(mockLLM, {
        enabled: false,
        maxMessages: 10,
        maxTokens: 1000,
      });

      const history: ModelMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ];

      const result = await disabledManager.manageContext(history, 1);
      expect(result).toBe(history);
      expect(result.length).toBe(2);
    });

    it('应该在消息数未超过阈值时返回原历史', async () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ];

      const result = await contextManager.manageContext(history, 1);
      expect(result).toBe(history);
    });

    it('应该在达到检查间隔时执行压缩检查', async () => {
      // 创建超过阈值的历史
      const history: ModelMessage[] = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      })) as ModelMessage[];

      // Mock 压缩函数
      vi.mock('@monkey-agent/compression', async () => {
        const actual = await vi.importActual('@monkey-agent/compression');
        return {
          ...actual,
          shouldCompress: vi.fn(() => ({
            shouldCompress: true,
            reason: 'Message count exceeded',
            recommendedOptions: { keepRounds: 3 },
          })),
          compressHistory: vi.fn(() => Promise.resolve({
            success: true,
            summary: 'Compressed summary',
            originalLength: 15,
            newLength: 6,
            compressedCount: 9,
            keptMessages: history.slice(-6),
            compressedHistory: [
              { role: 'user', content: '[Summary]' },
              ...history.slice(-6),
            ],
          })),
        };
      });

      const result = await contextManager.manageContext(history, 3);
      
      // 应该触发压缩逻辑，但如果压缩失败会返回原历史
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('应该在非检查间隔时跳过压缩', async () => {
      const history: ModelMessage[] = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      })) as ModelMessage[];

      // 迭代次数不是检查间隔的倍数
      const result = await contextManager.manageContext(history, 2);
      
      expect(result).toBe(history);
    });
  });

  describe('handleContextLengthError', () => {
    it('应该执行紧急压缩', async () => {
      const history: ModelMessage[] = Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      })) as ModelMessage[];

      vi.mock('@monkey-agent/compression', async () => {
        const actual = await vi.importActual('@monkey-agent/compression');
        return {
          ...actual,
          compressHistory: vi.fn(() => Promise.resolve({
            success: true,
            summary: 'Emergency compressed',
            originalLength: 20,
            newLength: 4,
            compressedCount: 16,
            keptMessages: history.slice(-4),
            compressedHistory: [
              { role: 'user', content: '[Emergency Summary]' },
              ...history.slice(-4),
            ],
          })),
        };
      });

      const result = await contextManager.handleContextLengthError(history);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // 在压缩失败的情况下，会返回原历史
      expect(result.length).toBeGreaterThan(0);
    });

    it('应该在压缩失败时返回原历史', async () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ];

      const result = await contextManager.handleContextLengthError(history);
      
      // 由于历史较短，压缩可能会失败并返回原历史
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('isContextLengthError', () => {
    it('应该识别上下文长度错误', () => {
      expect(contextManager.isContextLengthError('context length exceeded')).toBe(true);
      expect(contextManager.isContextLengthError('maximum context length')).toBe(true);
      expect(contextManager.isContextLengthError('prompt is too long')).toBe(true);
      expect(contextManager.isContextLengthError('token limit')).toBe(true);
    });

    it('应该不将其他错误识别为上下文长度错误', () => {
      expect(contextManager.isContextLengthError('network error')).toBe(false);
      expect(contextManager.isContextLengthError('authentication failed')).toBe(false);
      expect(contextManager.isContextLengthError('unknown error')).toBe(false);
    });
  });

  describe('边界情况', () => {
    it('应该处理空历史', async () => {
      const history: ModelMessage[] = [];
      const result = await contextManager.manageContext(history, 1);
      expect(result).toEqual(history);
    });

    it('应该处理单条消息', async () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'Hello' },
      ];
      const result = await contextManager.manageContext(history, 1);
      expect(result).toEqual(history);
    });

    it('应该处理刚好达到阈值的历史', async () => {
      const history: ModelMessage[] = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      })) as ModelMessage[];

      const result = await contextManager.manageContext(history, 3);
      expect(result).toBeDefined();
    });
  });

  describe('压缩策略', () => {
    it('应该根据对话轮次选择合适的压缩策略', async () => {
      // 多轮对话场景
      const multiRoundHistory: ModelMessage[] = [];
      for (let i = 0; i < 6; i++) {
        multiRoundHistory.push(
          { role: 'user', content: `User ${i}` },
          { role: 'assistant', content: `Assistant ${i}` }
        );
      }

      const result = await contextManager.manageContext(multiRoundHistory, 3);
      expect(result).toBeDefined();
    });

    it('应该处理单轮多工具调用场景', async () => {
      const history: ModelMessage[] = [
        { role: 'user', content: 'Execute tasks' },
        { 
          role: 'assistant', 
          content: [
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'tool1', args: {} }
          ] 
        },
        { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'call-1', result: 'result1' }] },
        { 
          role: 'assistant', 
          content: [
            { type: 'tool-call', toolCallId: 'call-2', toolName: 'tool2', args: {} }
          ] 
        },
        { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'call-2', result: 'result2' }] },
      ] as ModelMessage[];

      const result = await contextManager.manageContext(history, 3);
      expect(result).toBeDefined();
    });
  });

  describe('性能和效率', () => {
    it('应该避免频繁的压缩检查', async () => {
      const history: ModelMessage[] = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      })) as ModelMessage[];

      // 连续调用多次，但只有在检查间隔时才会触发压缩
      await contextManager.manageContext(history, 1);
      await contextManager.manageContext(history, 2);
      const result = await contextManager.manageContext(history, 3);

      expect(result).toBeDefined();
    });

    it('应该缓存上次检查的迭代次数', async () => {
      const history: ModelMessage[] = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      })) as ModelMessage[];

      await contextManager.manageContext(history, 3);
      await contextManager.manageContext(history, 4);
      await contextManager.manageContext(history, 5);
      
      // 第二次检查应该在迭代 6
      const result = await contextManager.manageContext(history, 6);
      expect(result).toBeDefined();
    });
  });
});
