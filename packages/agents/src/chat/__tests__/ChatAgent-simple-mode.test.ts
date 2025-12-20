/**
 * ChatAgent 简单模式测试
 * 
 * 测试 ChatAgent 在没有 orchestrator 的情况下作为纯对话 Agent 工作
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatAgent } from '../ChatAgent';
import type { ILLMClient } from '@monkey-agent/types';

describe('ChatAgent - Simple Chat Mode', () => {
  let mockLLMClient: ILLMClient;

  beforeEach(() => {
    // Mock LLM 客户端
    mockLLMClient = {
      chat: vi.fn().mockResolvedValue({
        text: 'Hello! I am a helpful assistant.',
        toolCalls: undefined,
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      }),
      stream: vi.fn(),
      embeddings: vi.fn(),
    } as any;
  });

  describe('Configuration', () => {
    it('should create ChatAgent without orchestrator for simple chat', () => {
      // 不提供 orchestrator 或 getAgentsInfo
      const chatAgent = new ChatAgent({
        llmClient: mockLLMClient,
      });

      expect(chatAgent).toBeDefined();
      expect(chatAgent.id).toBe('chat-agent');
      expect(chatAgent.name).toBe('Chat Agent');
    });

    it('should return empty tools when no orchestrator is provided', () => {
      const chatAgent = new ChatAgent({
        llmClient: mockLLMClient,
      });

      const tools = chatAgent.getToolDefinitions();
      
      // 纯对话模式：不需要工具
      expect(tools).toEqual({});
      expect(Object.keys(tools)).toHaveLength(0);
    });

    it('should return full toolset when orchestrator is provided', () => {
      const mockOrchestrator = {
        getAgentsInfo: vi.fn().mockReturnValue([
          {
            type: 'browser',
            description: 'Browser automation agent',
            capabilities: ['web-navigation'],
          },
        ]),
      };

      const chatAgent = new ChatAgent({
        llmClient: mockLLMClient,
        orchestrator: mockOrchestrator,
      });

      const tools = chatAgent.getToolDefinitions();
      
      // 完整模式：应该有工具
      expect(Object.keys(tools)).toContain('recognizeIntent');
      expect(Object.keys(tools)).toContain('generateWorkflow');
      expect(Object.keys(tools)).toContain('chat');
      expect(Object.keys(tools).length).toBeGreaterThan(0);
    });
  });

  describe('Simple Chat Execution', () => {
    it('should handle simple chat without tools', async () => {
      const chatAgent = new ChatAgent({
        llmClient: mockLLMClient,
      });

      const result = await chatAgent.execute('Hello, how are you?');

      expect(result).toBeDefined();
      expect(result.status).toBe('success');
      expect(mockLLMClient.chat).toHaveBeenCalled();
      
      // 验证调用时没有传递工具
      const chatCallArgs = (mockLLMClient.chat as any).mock.calls[0];
      const options = chatCallArgs[1];
      expect(options?.tools).toEqual({} as any);
    });

    it('should work with analyzeIntent', async () => {
      const chatAgent = new ChatAgent({
        llmClient: mockLLMClient,
      });

      // 意图识别不需要 orchestrator
      const intent = await chatAgent.analyzeIntent('Hello');

      expect(intent).toBeDefined();
      expect(mockLLMClient.chat).toHaveBeenCalled();
    });
  });

  describe('Workflow Generation', () => {
    it('should throw error when trying to generate workflow without orchestrator', async () => {
      const chatAgent = new ChatAgent({
        llmClient: mockLLMClient,
      });

      await expect(
        chatAgent.createWorkflow('Scrape data from website')
      ).rejects.toThrow(
        /ChatAgent cannot generate workflow without orchestrator or getAgentsInfo/
      );
    });

    it('should generate workflow when orchestrator is provided', async () => {
      const mockOrchestrator = {
        getAgentsInfo: vi.fn().mockReturnValue([
          {
            type: 'browser',
            description: 'Browser automation',
            capabilities: ['web-navigation'],
          },
        ]),
      };

      // Mock LLM 返回工具调用
      (mockLLMClient.chat as any).mockResolvedValue({
        text: '',
        toolCalls: [
          {
            toolName: 'generateWorkflow',
            args: {
              id: 'workflow-1',
              name: 'Test Workflow',
              description: 'Test workflow description',
              agentGraph: [
                {
                  id: 'agent-1',
                  type: 'browser',
                  name: 'Browser',
                  desc: 'Navigate to website',
                  steps: [{ stepNumber: 1, desc: 'Open browser' }],
                  dependencies: [],
                },
              ],
            },
          },
        ],
        finishReason: 'tool-calls',
        usage: { promptTokens: 20, completionTokens: 50, totalTokens: 70 },
      });

      const chatAgent = new ChatAgent({
        llmClient: mockLLMClient,
        orchestrator: mockOrchestrator,
      });

      const workflow = await chatAgent.createWorkflow('Scrape website data');

      expect(workflow).toBeDefined();
      expect(workflow.id).toBe('workflow-1');
      expect(workflow.agentGraph).toHaveLength(1);
    });
  });
});

