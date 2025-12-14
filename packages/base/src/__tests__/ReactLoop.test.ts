/**
 * ReactLoop 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReactLoop } from '../ReactLoop';
import type { ModelMessage, ToolSet } from 'ai';
import type { ILLMClient, IChatResult } from '@monkey-agent/types';
import type { ContextManager } from '@monkey-agent/context';

describe('ReactLoop', () => {
  let reactLoop: ReactLoop;
  let mockLLM: ILLMClient;
  let mockContextManager: ContextManager;
  let mockToolExecutor: (toolName: string, input: any) => Promise<any>;

  beforeEach(() => {
    reactLoop = new ReactLoop();
    
    // Mock LLM Client
    mockLLM = {
      chat: vi.fn(),
      stream: vi.fn(),
      streamText: vi.fn(),
    };
    
    // Mock Context Manager
    mockContextManager = {
      manageContext: vi.fn((history) => Promise.resolve(history)),
      isContextLengthError: vi.fn(() => false),
      handleContextLengthError: vi.fn((history) => Promise.resolve(history)),
    } as any;
    
    // Mock Tool Executor
    mockToolExecutor = vi.fn((toolName, input) => 
      Promise.resolve({ result: `Executed ${toolName}` })
    );
  });

  describe('基本执行流程', () => {
    it('应该成功执行简单的 ReAct 循环（无工具调用）', async () => {
      // Mock LLM 返回纯文本响应
      (mockLLM.chat as any).mockResolvedValue({
        text: 'Task completed successfully',
        toolCalls: undefined,
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
      });

      const result = await reactLoop.run({
        systemPrompt: 'You are a helpful assistant',
        userMessage: 'Say hello',
        tools: {},
        toolExecutor: mockToolExecutor,
        llmClient: mockLLM,
        contextManager: mockContextManager,
        maxIterations: 10,
        enableStreaming: false,
      });

      expect(result).toMatchObject({
        data: { response: 'Task completed successfully' },
        summary: 'Task completed successfully',
        finishReason: 'stop',
        iterations: 1,
      });
      expect(mockLLM.chat).toHaveBeenCalledTimes(1);
    });

    it('应该执行带有工具调用的 ReAct 循环', async () => {
      const tools: ToolSet = {
        testTool: {
          description: 'A test tool',
          parameters: {},
        },
      };

      // 第一次调用：返回工具调用
      (mockLLM.chat as any).mockResolvedValueOnce({
        text: 'Using test tool',
        toolCalls: [{
          toolCallId: 'call-1',
          toolName: 'testTool',
          input: { param: 'value' },
        }],
        finishReason: 'tool-calls',
        usage: { promptTokens: 10, completionTokens: 20 },
      });

      // 第二次调用：返回最终结果
      (mockLLM.chat as any).mockResolvedValueOnce({
        text: 'Tool executed successfully',
        toolCalls: undefined,
        finishReason: 'stop',
        usage: { promptTokens: 15, completionTokens: 25 },
      });

      const result = await reactLoop.run({
        systemPrompt: 'You are a helpful assistant',
        userMessage: 'Execute test tool',
        tools,
        toolExecutor: mockToolExecutor,
        llmClient: mockLLM,
        contextManager: mockContextManager,
        maxIterations: 10,
        enableStreaming: false,
      });

      expect(result.iterations).toBe(2);
      expect(mockToolExecutor).toHaveBeenCalledWith('testTool', { param: 'value' });
      expect(mockLLM.chat).toHaveBeenCalledTimes(2);
    });

    it('应该处理多个连续的工具调用', async () => {
      const tools: ToolSet = {
        tool1: { description: 'Tool 1', parameters: {} },
        tool2: { description: 'Tool 2', parameters: {} },
      };

      // 第一次：调用 tool1
      (mockLLM.chat as any).mockResolvedValueOnce({
        text: '',
        toolCalls: [{
          toolCallId: 'call-1',
          toolName: 'tool1',
          input: {},
        }],
        finishReason: 'tool-calls',
      });

      // 第二次：调用 tool2
      (mockLLM.chat as any).mockResolvedValueOnce({
        text: '',
        toolCalls: [{
          toolCallId: 'call-2',
          toolName: 'tool2',
          input: {},
        }],
        finishReason: 'tool-calls',
      });

      // 第三次：完成
      (mockLLM.chat as any).mockResolvedValueOnce({
        text: 'All tools executed',
        toolCalls: undefined,
        finishReason: 'stop',
      });

      const result = await reactLoop.run({
        systemPrompt: 'System',
        userMessage: 'User message',
        tools,
        toolExecutor: mockToolExecutor,
        llmClient: mockLLM,
        contextManager: mockContextManager,
        maxIterations: 10,
        enableStreaming: false,
      });

      expect(result.iterations).toBe(3);
      expect(mockToolExecutor).toHaveBeenCalledTimes(2);
    });
  });

  describe('迭代限制', () => {
    it('应该在达到最大迭代次数时停止', async () => {
      // Mock LLM 每次都返回工具调用（模拟无限循环）
      (mockLLM.chat as any).mockResolvedValue({
        text: '',
        toolCalls: [{
          toolCallId: 'call-loop',
          toolName: 'loopTool',
          input: {},
        }],
        finishReason: 'tool-calls',
      });

      const tools: ToolSet = {
        loopTool: { description: 'Loop tool', parameters: {} },
      };

      const result = await reactLoop.run({
        systemPrompt: 'System',
        userMessage: 'User message',
        tools,
        toolExecutor: mockToolExecutor,
        llmClient: mockLLM,
        contextManager: mockContextManager,
        maxIterations: 3,
        enableStreaming: false,
      });

      expect(result.finishReason).toBe('max-iterations');
      expect(result.iterations).toBe(3);
      expect(mockLLM.chat).toHaveBeenCalledTimes(3);
    });
  });

  describe('上下文管理', () => {
    it('应该在每次迭代时调用 contextManager.manageContext', async () => {
      (mockLLM.chat as any).mockResolvedValue({
        text: 'Done',
        toolCalls: undefined,
        finishReason: 'stop',
      });

      await reactLoop.run({
        systemPrompt: 'System',
        userMessage: 'User message',
        tools: {},
        toolExecutor: mockToolExecutor,
        llmClient: mockLLM,
        contextManager: mockContextManager,
        maxIterations: 10,
        enableStreaming: false,
      });

      expect(mockContextManager.manageContext).toHaveBeenCalled();
    });

    it('应该处理上下文长度错误并重试', async () => {
      // 第一次调用抛出上下文长度错误
      (mockLLM.chat as any)
        .mockRejectedValueOnce(new Error('context length exceeded'))
        .mockResolvedValueOnce({
          text: 'Done after compression',
          toolCalls: undefined,
          finishReason: 'stop',
        });

      (mockContextManager.isContextLengthError as any).mockReturnValue(true);
      (mockContextManager.handleContextLengthError as any).mockResolvedValue([
        { role: 'user', content: 'compressed message' } as ModelMessage,
      ]);

      const result = await reactLoop.run({
        systemPrompt: 'System',
        userMessage: 'User message',
        tools: {},
        toolExecutor: mockToolExecutor,
        llmClient: mockLLM,
        contextManager: mockContextManager,
        maxIterations: 10,
        enableStreaming: false,
      });

      expect(mockContextManager.handleContextLengthError).toHaveBeenCalled();
      expect(result.summary).toBe('Done after compression');
    });
  });

  describe('工具执行错误处理', () => {
    it('应该处理工具执行错误并继续循环', async () => {
      const tools: ToolSet = {
        failTool: { description: 'Failing tool', parameters: {} },
      };

      // Mock 工具执行失败
      const failingToolExecutor = vi.fn().mockRejectedValue(
        new Error('Tool execution failed')
      );

      // 第一次：调用失败的工具
      (mockLLM.chat as any).mockResolvedValueOnce({
        text: '',
        toolCalls: [{
          toolCallId: 'call-1',
          toolName: 'failTool',
          input: {},
        }],
        finishReason: 'tool-calls',
      });

      // 第二次：返回最终结果
      (mockLLM.chat as any).mockResolvedValueOnce({
        text: 'Handled error',
        toolCalls: undefined,
        finishReason: 'stop',
      });

      const result = await reactLoop.run({
        systemPrompt: 'System',
        userMessage: 'User message',
        tools,
        toolExecutor: failingToolExecutor,
        llmClient: mockLLM,
        contextManager: mockContextManager,
        maxIterations: 10,
        enableStreaming: false,
      });

      expect(result.iterations).toBe(2);
      expect(result.summary).toBe('Handled error');
    });
  });

  describe('事件发射', () => {
    it('应该发射 react:thinking 事件', async () => {
      const thinkingSpy = vi.fn();
      reactLoop.on('react:thinking', thinkingSpy);

      (mockLLM.chat as any).mockResolvedValue({
        text: 'Done',
        toolCalls: undefined,
        finishReason: 'stop',
      });

      await reactLoop.run({
        systemPrompt: 'System',
        userMessage: 'User message',
        tools: {},
        toolExecutor: mockToolExecutor,
        llmClient: mockLLM,
        contextManager: mockContextManager,
        maxIterations: 10,
        enableStreaming: false,
      });

      expect(thinkingSpy).toHaveBeenCalled();
      expect(thinkingSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          iteration: 1,
          historyLength: 1,
          timestamp: expect.any(Number),
        })
      );
    });

    it('应该发射 react:action 和 react:observation 事件', async () => {
      const actionSpy = vi.fn();
      const observationSpy = vi.fn();
      
      reactLoop.on('react:action', actionSpy);
      reactLoop.on('react:observation', observationSpy);

      const tools: ToolSet = {
        testTool: { description: 'Test', parameters: {} },
      };

      (mockLLM.chat as any)
        .mockResolvedValueOnce({
          toolCalls: [{ toolCallId: 'call-1', toolName: 'testTool', input: {} }],
        })
        .mockResolvedValueOnce({
          text: 'Done',
          finishReason: 'stop',
        });

      await reactLoop.run({
        systemPrompt: 'System',
        userMessage: 'User message',
        tools,
        toolExecutor: mockToolExecutor,
        llmClient: mockLLM,
        contextManager: mockContextManager,
        maxIterations: 10,
        enableStreaming: false,
      });

      expect(actionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toolCallId: 'call-1',
          toolName: 'testTool',
        })
      );
      
      expect(observationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toolCallId: 'call-1',
          toolName: 'testTool',
          success: true,
        })
      );
    });
  });

  describe('最终结果标记', () => {
    it('应该在工具返回 __final_result__ 标记时立即停止', async () => {
      const tools: ToolSet = {
        finalTool: { description: 'Final tool', parameters: {} },
      };

      const finalToolExecutor = vi.fn().mockResolvedValue({
        __final_result__: true,
        data: 'Final result data',
      });

      (mockLLM.chat as any).mockResolvedValue({
        toolCalls: [{
          toolCallId: 'call-1',
          toolName: 'finalTool',
          input: {},
        }],
      });

      const result = await reactLoop.run({
        systemPrompt: 'System',
        userMessage: 'User message',
        tools,
        toolExecutor: finalToolExecutor,
        llmClient: mockLLM,
        contextManager: mockContextManager,
        maxIterations: 10,
        enableStreaming: false,
      });

      expect(result.iterations).toBe(1);
      expect(result.data).toEqual({ data: 'Final result data' });
      expect(result.finishReason).toBe('stop');
      expect(mockLLM.chat).toHaveBeenCalledTimes(1);
    });
  });
});

