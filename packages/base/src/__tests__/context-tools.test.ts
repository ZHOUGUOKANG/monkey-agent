/**
 * Context Tools 注入和数据共享测试
 */

import { describe, it, expect, vi } from 'vitest';
import { BaseAgent } from '../BaseAgent';
import type { ToolSet } from 'ai';
import type { ILLMClient, AgentContext } from '@monkey-agent/types';

/**
 * 测试用 Agent
 */
class TestAgent extends BaseAgent {
  public getToolDefinitions(): ToolSet {
    return {}; // 空工具集
  }

  protected async executeToolCall(toolName: string, input: any): Promise<any> {
    return { success: true, toolName, input };
  }
}

/**
 * Mock LLM 客户端
 */
function createMockLLMClient(): ILLMClient {
  const mockStream = {
    fullStream: (async function* () {
      yield { type: 'text-delta', textDelta: 'Task completed' };
      yield { type: 'finish', finishReason: 'stop', totalUsage: { totalTokens: 100 } };
    })(),
    textStream: (async function* () {
      yield 'Task completed';
    })(),
    usage: Promise.resolve({ totalTokens: 100 }),
  };

  return {
    chat: vi.fn().mockResolvedValue({
      text: 'Task completed',
      finishReason: 'stop',
      usage: { totalTokens: 100 },
    }),
    stream: vi.fn().mockReturnValue(mockStream),
  } as any;
}

/**
 * 创建测试用 AgentContext
 */
function createTestContext(): AgentContext {
  const outputs = new Map();
  const vals = new Map();
  
  return {
    workflowId: 'test-workflow',
    workflowTask: 'Test workflow task',
    outputs,
    vals,
    startTime: Date.now(),
    status: 'running',
    currentLevel: 0,
    
    getOutput: (agentId: string) => outputs.get(agentId),
    getValue: (key: string) => vals.get(key),
    setValue: (key: string, value: any) => vals.set(key, value),
    toJSON: () => ({
      workflowId: 'test-workflow',
      workflowTask: 'Test workflow task',
      outputs,
      vals,
      startTime: Date.now(),
      status: 'running' as const,
      currentLevel: 0,
    }),
  } as AgentContext;
}

describe('Context Tools Injection', () => {
  it('should inject context tools into agent', async () => {
    const llmClient = createMockLLMClient();
    const agent = new TestAgent({
      id: 'test-agent',
      name: 'Test Agent',
      description: 'Test agent for context tools',
      capabilities: ['test'],
      llmClient,
      maxIterations: 1,
      enableStreaming: false, // 禁用流式以便测试 chat
    });

    const context = createTestContext();
    
    // 执行 agent
    await agent.execute('test task', context);

    // 验证 LLM 被调用时包含了 context tools
    expect(llmClient.chat).toHaveBeenCalled();
    const callArgs = (llmClient.chat as any).mock.calls[0];
    const options = callArgs[1];
    
    // 检查工具集包含 context tools
    expect(options.tools).toBeDefined();
    expect(options.tools.valSet).toBeDefined();
    expect(options.tools.valGet).toBeDefined();
    expect(options.tools.valList).toBeDefined();
  });

  it('should include context tools in system prompt', async () => {
    const llmClient = createMockLLMClient();
    const agent = new TestAgent({
      id: 'test-agent',
      name: 'Test Agent',
      description: 'Test agent',
      capabilities: ['test'],
      llmClient,
      maxIterations: 1,
      enableStreaming: false, // 禁用流式
    });

    const context = createTestContext();
    await agent.execute('test task', context);

    // 验证 system prompt 包含 context tools 说明
    const callArgs = (llmClient.chat as any).mock.calls[0];
    const options = callArgs[1];
    const systemPrompt = options.system;
    
    expect(systemPrompt).toContain('valSet');
    expect(systemPrompt).toContain('valGet');
    expect(systemPrompt).toContain('valList');
    expect(systemPrompt).toContain('Data Sharing');
  });
});

describe('Data Sharing Between Agents', () => {
  it('should allow agents to share data via context.vals', async () => {
    const llmClient = createMockLLMClient();
    
    // 创建两个 agents
    const agent1 = new TestAgent({
      id: 'agent-1',
      name: 'Agent 1',
      description: 'First agent',
      capabilities: ['test'],
      llmClient,
      maxIterations: 1,
    });

    const agent2 = new TestAgent({
      id: 'agent-2',
      name: 'Agent 2',
      description: 'Second agent',
      capabilities: ['test'],
      llmClient,
      maxIterations: 1,
    });

    const context = createTestContext();
    
    // Agent 1 设置数据
    context.setValue('testData', { value: 'shared data' });
    
    // Agent 2 应该能读取数据
    const retrievedData = context.getValue('testData');
    expect(retrievedData).toEqual({ value: 'shared data' });
    
    // 验证 vals Map 包含数据
    expect(context.vals.has('testData')).toBe(true);
    expect(context.vals.get('testData')).toEqual({ value: 'shared data' });
  });

  it('should support multiple data entries in context.vals', async () => {
    const context = createTestContext();
    
    // 设置多个数据项
    context.setValue('data1', [1, 2, 3]);
    context.setValue('data2', { name: 'test' });
    context.setValue('data3', 'string value');
    
    // 验证所有数据都存在
    expect(context.vals.size).toBe(3);
    expect(context.getValue('data1')).toEqual([1, 2, 3]);
    expect(context.getValue('data2')).toEqual({ name: 'test' });
    expect(context.getValue('data3')).toBe('string value');
  });

  it('should handle missing keys gracefully', async () => {
    const context = createTestContext();
    
    // 尝试获取不存在的 key
    const result = context.getValue('nonexistent');
    expect(result).toBeUndefined();
  });
});

describe('Context Tools in Standalone Execution', () => {
  it('should work when agent runs standalone (no context provided)', async () => {
    const llmClient = createMockLLMClient();
    const agent = new TestAgent({
      id: 'test-agent',
      name: 'Test Agent',
      description: 'Test agent',
      capabilities: ['test'],
      llmClient,
      maxIterations: 1,
      enableStreaming: false, // 禁用流式
    });

    // 不提供 context，agent 应该创建最小化 context
    const result = await agent.execute('test task');
    
    expect(result.status).toBe('success');
    
    // 验证仍然注入了 context tools
    expect(llmClient.chat).toHaveBeenCalled();
    const callArgs = (llmClient.chat as any).mock.calls[0];
    const options = callArgs[1];
    
    expect(options.tools.valSet).toBeDefined();
    expect(options.tools.valGet).toBeDefined();
    expect(options.tools.valList).toBeDefined();
  });
});

describe('Tool Executor Routing', () => {
  it('should route context tool calls correctly', async () => {
    const llmClient = createMockLLMClient();
    
    // Mock LLM 第一次返回工具调用，第二次返回完成
    let callCount = 0;
    (llmClient.chat as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          text: '',
          toolCalls: [
            {
              toolCallId: 'call-1',
              toolName: 'valSet',
              input: { key: 'testKey', value: 'testValue' },
            },
          ],
          finishReason: 'tool-calls',
          usage: { totalTokens: 100 },
        });
      } else {
        return Promise.resolve({
          text: 'Task completed',
          finishReason: 'stop',
          usage: { totalTokens: 100 },
        });
      }
    });

    const agent = new TestAgent({
      id: 'test-agent',
      name: 'Test Agent',
      description: 'Test agent',
      capabilities: ['test'],
      llmClient,
      maxIterations: 3,
      enableStreaming: false,
    });

    const context = createTestContext();
    
    // 执行 agent
    await agent.execute('test task', context);
    
    // 验证数据被设置到 context.vals
    expect(context.vals.has('testKey')).toBe(true);
    expect(context.vals.get('testKey')).toBe('testValue');
  });

  it('should route agent tool calls to executeToolCall', async () => {
    const llmClient = createMockLLMClient();
    
    // 创建带有自定义工具的 agent
    class CustomAgent extends BaseAgent {
      public customToolCalled = false;
      
      public getToolDefinitions(): ToolSet {
        return {
          customTool: {
            description: 'A custom tool',
            parameters: {
              type: 'object',
              properties: {
                param: { type: 'string' },
              },
            },
          } as any,
        };
      }

      protected async executeToolCall(toolName: string, input: any): Promise<any> {
        if (toolName === 'customTool') {
          this.customToolCalled = true;
          return { success: true, result: 'custom tool executed' };
        }
        return { success: false };
      }
    }

    // Mock LLM 第一次返回自定义工具调用，第二次返回完成
    let callCount = 0;
    (llmClient.chat as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          text: '',
          toolCalls: [
            {
              toolCallId: 'call-1',
              toolName: 'customTool',
              input: { param: 'test' },
            },
          ],
          finishReason: 'tool-calls',
          usage: { totalTokens: 100 },
        });
      } else {
        return Promise.resolve({
          text: 'Task completed',
          finishReason: 'stop',
          usage: { totalTokens: 100 },
        });
      }
    });

    const agent = new CustomAgent({
      id: 'custom-agent',
      name: 'Custom Agent',
      description: 'Custom agent',
      capabilities: ['custom'],
      llmClient,
      maxIterations: 3,
      enableStreaming: false,
    });

    const context = createTestContext();
    await agent.execute('test task', context);
    
    // 验证自定义工具被调用
    expect(agent.customToolCalled).toBe(true);
  });
});

