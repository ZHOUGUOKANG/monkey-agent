/**
 * 工作流集成测试
 * 
 * 测试流程：
 * 1. Mock 几个简单的 Agent（browser, code, file）
 * 2. 使用 ChatAgent 根据任务描述生成 Workflow
 * 3. 使用 WorkflowOrchestrator 调度执行 Mock Agent
 * 4. 验证执行结果
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowOrchestrator } from '../WorkflowOrchestrator';
import { BaseAgent } from '@monkey-agent/base';
import type { Task, TaskResult, Workflow } from '@monkey-agent/types';
import { LLMClient } from '@monkey-agent/llm';
import { ChatAgent } from '@monkey-agent/agents';
import { tool } from 'ai';
import { z } from 'zod';

// ============ Mock Agents ============

/**
 * Mock Browser Agent - 模拟浏览器操作
 */
class MockBrowserAgent extends BaseAgent {
  constructor() {
    super({
      id: 'browser-agent',
      name: 'Browser Agent',
      description: '模拟浏览器操作，可以导航、点击、提取内容',
      capabilities: ['navigate', 'click', 'extract'],
      llmConfig: {
        provider: 'openai',
        apiKey: 'mock-key',
        model: 'gpt-4',
      },
    });
  }

  protected getToolDefinitions() {
    return {
      navigate: tool({
        description: '导航到指定 URL',
        inputSchema: z.object({
          url: z.string(),
        }),
      }),
      extractText: tool({
        description: '提取页面文本',
        inputSchema: z.object({}),
      }),
    };
  }

  protected async executeToolCall(toolName: string, input: any): Promise<any> {
    // Mock 实现 - 返回伪数据
    switch (toolName) {
      case 'navigate':
        return {
          success: true,
          url: input.url,
          status: 200,
          message: `已导航到 ${input.url}`,
        };
      case 'extractText':
        return {
          success: true,
          text: '这是从页面提取的示例文本内容',
          wordCount: 10,
        };
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // 覆盖 execute 方法，直接返回模拟结果，跳过 LLM 调用
  // @ts-expect-error - Mock implementation returns TaskResult interface, not the specific union type from BaseAgent
  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    this.emit('task:start', task);

    try {
      // 模拟执行延迟
      await new Promise(resolve => setTimeout(resolve, 100));

      // 默认返回提取数据的结果（因为大多数测试需要这个）
      const result: TaskResult = {
        success: true,
        data: {
          action: 'extract',
          text: '示例产品数据：Product A, Product B, Product C',
          itemCount: 3,
          summary: '已成功提取 3 个产品信息',
        },
        metadata: { taskId: task.id, agentId: this.id },
        duration: Date.now() - startTime,
      };

      this.emit('task:complete', result);
      return result;
    } catch (error) {
      const result: TaskResult = {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: { taskId: task.id, agentId: this.id },
        duration: Date.now() - startTime,
      };
      this.emit('task:error', result);
      return result;
    }
  }
}

/**
 * Mock Code Agent - 模拟代码执行
 */
class MockCodeAgent extends BaseAgent {
  constructor() {
    super({
      id: 'code-agent',
      name: 'Code Agent',
      description: '模拟代码执行，可以运行 Python/JavaScript 代码',
      capabilities: ['execute-python', 'execute-javascript', 'analyze-data'],
      llmConfig: {
        provider: 'openai',
        apiKey: 'mock-key',
        model: 'gpt-4',
      },
    });
  }

  protected getToolDefinitions() {
    return {
      executePython: tool({
        description: '执行 Python 代码',
        inputSchema: z.object({
          code: z.string(),
        }),
      }),
      analyzeData: tool({
        description: '分析数据',
        inputSchema: z.object({
          data: z.any(),
        }),
      }),
    };
  }

  protected async executeToolCall(toolName: string, input: any): Promise<any> {
    switch (toolName) {
      case 'executePython':
        return {
          success: true,
          output: 'Code executed successfully',
          result: { analyzed: true },
        };
      case 'analyzeData':
        return {
          success: true,
          insights: ['数据质量良好', '发现 3 个趋势'],
          summary: '数据分析完成',
        };
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // @ts-expect-error - Mock implementation returns TaskResult interface, not the specific union type from BaseAgent
  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    this.emit('task:start', task);

    try {
      await new Promise(resolve => setTimeout(resolve, 150));

      const result: TaskResult = {
        success: true,
        data: {
          action: 'analyze',
          insights: [
            '发现 3 个高频关键词',
            '数据质量评分: 85/100',
            '建议进行进一步清洗',
          ],
          summary: '数据分析完成，发现 3 个关键洞察',
        },
        metadata: { taskId: task.id, agentId: this.id },
        duration: Date.now() - startTime,
      };

      this.emit('task:complete', result);
      return result;
    } catch (error) {
      const result: TaskResult = {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: { taskId: task.id, agentId: this.id },
        duration: Date.now() - startTime,
      };
      this.emit('task:error', result);
      return result;
    }
  }
}

/**
 * Mock File Agent - 模拟文件操作
 */
class MockFileAgent extends BaseAgent {
  constructor() {
    super({
      id: 'file-agent',
      name: 'File Agent',
      description: '模拟文件操作，可以读写文件',
      capabilities: ['read-file', 'write-file', 'search-files'],
      llmConfig: {
        provider: 'openai',
        apiKey: 'mock-key',
        model: 'gpt-4',
      },
    });
  }

  protected getToolDefinitions() {
    return {
      writeFile: tool({
        description: '写入文件',
        inputSchema: z.object({
          path: z.string(),
          content: z.string(),
        }),
      }),
      readFile: tool({
        description: '读取文件',
        inputSchema: z.object({
          path: z.string(),
        }),
      }),
    };
  }

  protected async executeToolCall(toolName: string, input: any): Promise<any> {
    switch (toolName) {
      case 'writeFile':
        return {
          success: true,
          path: input.path,
          size: input.content.length,
          message: `文件已保存到 ${input.path}`,
        };
      case 'readFile':
        return {
          success: true,
          content: 'Mock file content',
        };
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // @ts-expect-error - Mock implementation returns TaskResult interface, not the specific union type from BaseAgent
  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    this.emit('task:start', task);

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      const result: TaskResult = {
        success: true,
        data: {
          action: 'save',
          path: '/data/report.json',
          size: 1024,
          summary: '分析报告已成功保存到本地文件',
        },
        metadata: { taskId: task.id, agentId: this.id },
        duration: Date.now() - startTime,
      };

      this.emit('task:complete', result);
      return result;
    } catch (error) {
      const result: TaskResult = {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: { taskId: task.id, agentId: this.id },
        duration: Date.now() - startTime,
      };
      this.emit('task:error', result);
      return result;
    }
  }
}

/**
 * 创建 Mock LLM Client，用于模拟 ChatAgent 的 LLM 调用
 */
function createMockLLMClient(): LLMClient {
  const mockClient = new LLMClient({
    provider: 'openai',
    apiKey: 'mock-key',
    model: 'gpt-4',
  });

  // Mock chat 方法
  vi.spyOn(mockClient, 'chat').mockImplementation(async (messages, options) => {
    // 检查是否是工作流生成请求（带有 generateWorkflow tool）
    if (options?.tools && 'generateWorkflow' in options.tools) {
      const workflowData = {
        id: `workflow-${Date.now()}`,
        name: '数据采集与分析工作流',
        description: '爬取网站数据，分析后保存到本地',
        agentGraph: [
          {
            id: 'agent-1',
            type: 'browser',
            name: 'Browser Agent',
            desc: '导航到目标网站并提取产品数据',
            steps: [
              { stepNumber: 1, desc: '导航到产品列表页面' },
              { stepNumber: 2, desc: '提取所有产品信息' },
            ],
            dependencies: [],
          },
          {
            id: 'agent-2',
            type: 'code',
            name: 'Code Agent',
            desc: '分析提取的数据，生成洞察报告',
            steps: [
              { stepNumber: 3, desc: '清洗和预处理数据' },
              { stepNumber: 4, desc: '执行数据分析' },
              { stepNumber: 5, desc: '生成分析报告' },
            ],
            dependencies: ['agent-1'],
          },
          {
            id: 'agent-3',
            type: 'file',
            name: 'File Agent',
            desc: '保存分析报告到本地文件',
            steps: [
              { stepNumber: 6, desc: '将报告保存为 JSON 格式' },
            ],
            dependencies: ['agent-2'],
          },
        ],
        estimatedDuration: 5000,
      };

      // 返回 tool call 结果 - 确保 input 字段存在
      return {
        text: '我将为您生成一个数据采集与分析的工作流',
        finishReason: 'tool-calls' as const,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        toolCalls: [
          {
            toolCallId: 'call-1',
            toolName: 'generateWorkflow',
            // 确保 input 和 args 都存在，以兼容不同版本的 AI SDK
            input: workflowData,
            args: workflowData,
          } as any,
        ],
        rawResponse: {} as any,
        warnings: [],
        response: {
          id: 'mock-response',
          timestamp: new Date(),
          modelId: 'gpt-4',
        },
      } as any;
    }

    // 默认响应
    return {
      text: 'Mock response',
      finishReason: 'stop' as const,
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      rawResponse: {} as any,
      warnings: [],
      response: {
        id: 'mock-response',
        timestamp: new Date(),
        modelId: 'gpt-4',
      },
    } as any;
  });

  return mockClient;
}

// ============ 测试套件 ============

describe('工作流集成测试', () => {
  let orchestrator: WorkflowOrchestrator;
  let browserAgent: MockBrowserAgent;
  let codeAgent: MockCodeAgent;
  let fileAgent: MockFileAgent;
  let chatAgent: ChatAgent;
  let mockLLMClient: LLMClient;

  beforeEach(() => {
    // 创建 orchestrator
    orchestrator = new WorkflowOrchestrator();

    // 创建并注册 mock agents
    browserAgent = new MockBrowserAgent();
    codeAgent = new MockCodeAgent();
    fileAgent = new MockFileAgent();

    orchestrator.registerAgent(browserAgent);
    orchestrator.registerAgent(codeAgent);
    orchestrator.registerAgent(fileAgent);

    // 创建 mock LLM client
    mockLLMClient = createMockLLMClient();

    // 创建真实的 ChatAgent，使用 mock LLM client
    chatAgent = new ChatAgent({
      llmClient: mockLLMClient,
      orchestrator: orchestrator,
    });
  });

  describe('Agent 注册和管理', () => {
    it('应该成功注册 Agent', () => {
      expect(orchestrator.getAgent('browser-agent')).toBe(browserAgent);
      expect(orchestrator.getAgent('code-agent')).toBe(codeAgent);
      expect(orchestrator.getAgent('file-agent')).toBe(fileAgent);
    });

    it('应该获取所有已注册的 Agent', () => {
      const agents = orchestrator.getAllAgents();
      expect(agents).toHaveLength(3);
      expect(agents.map(a => a.id)).toEqual(
        expect.arrayContaining(['browser-agent', 'code-agent', 'file-agent'])
      );
    });
  });

  describe('工作流生成', () => {
    it('应该使用 ChatAgent 生成工作流', async () => {
      const taskDescription = '爬取网站数据，分析后保存到本地';
      const workflow = await chatAgent.createWorkflow(taskDescription);

      // 验证工作流结构
      expect(workflow).toBeDefined();
      expect(workflow.id).toMatch(/^workflow-\d+$/);
      expect(workflow.name).toBeTruthy();
      expect(workflow.description).toBe(taskDescription);
      expect(workflow.agentGraph).toHaveLength(3);

      // 验证 Agent 节点
      const [agent1, agent2, agent3] = workflow.agentGraph;

      expect(agent1.id).toBe('agent-1');
      expect(agent1.type).toBe('browser');
      expect(agent1.dependencies).toEqual([]);
      expect(agent1.steps).toHaveLength(2);

      expect(agent2.id).toBe('agent-2');
      expect(agent2.type).toBe('code');
      expect(agent2.dependencies).toEqual(['agent-1']);
      expect(agent2.steps).toHaveLength(3);

      expect(agent3.id).toBe('agent-3');
      expect(agent3.type).toBe('file');
      expect(agent3.dependencies).toEqual(['agent-2']);
      expect(agent3.steps).toHaveLength(1);
    });

    it('生成的工作流应该有正确的全局步骤编号', async () => {
      const workflow = await chatAgent.createWorkflow('测试任务');

      // 收集所有步骤编号
      const allSteps = workflow.agentGraph.flatMap(agent => agent.steps);
      const stepNumbers = allSteps.map(s => s.stepNumber).sort((a, b) => a - b);

      // 验证步骤编号连续且从 1 开始
      expect(stepNumbers).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });

  describe('工作流调度执行', () => {
    it('应该按照 DAG 顺序执行工作流', async () => {
      // 1. 生成工作流
      const workflow = await chatAgent.createWorkflow('爬取并分析数据');

      // 2. 监听执行事件
      const events: string[] = [];
      orchestrator.on('workflow:start', () => events.push('workflow:start'));
      orchestrator.on('level:start', data => events.push(`level:start:${data.level}`));
      orchestrator.on('level:complete', data => events.push(`level:complete:${data.level}`));
      orchestrator.on('agent:start', data => events.push(`agent:start:${data.agentId}`));
      orchestrator.on('agent:complete', data => events.push(`agent:complete:${data.agentId}`));
      orchestrator.on('workflow:complete', () => events.push('workflow:complete'));

      // 3. 执行工作流
      const result = await orchestrator.executeWorkflow(workflow);

      // 4. 验证执行结果
      expect(result.status).toBe('completed');
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);

      // 5. 验证执行顺序
      expect(events).toContain('workflow:start');
      expect(events).toContain('workflow:complete');

      // 验证层级顺序
      expect(events).toContain('level:start:0');
      expect(events).toContain('level:start:1');
      expect(events).toContain('level:start:2');

      // 验证 agent 执行
      expect(events).toContain('agent:start:agent-1');
      expect(events).toContain('agent:complete:agent-1');
      expect(events).toContain('agent:start:agent-2');
      expect(events).toContain('agent:complete:agent-2');
      expect(events).toContain('agent:start:agent-3');
      expect(events).toContain('agent:complete:agent-3');

      // 验证执行顺序：agent-1 必须在 agent-2 之前完成
      const agent1CompleteIndex = events.indexOf('agent:complete:agent-1');
      const agent2StartIndex = events.indexOf('agent:start:agent-2');
      expect(agent1CompleteIndex).toBeLessThan(agent2StartIndex);

      // 验证执行顺序：agent-2 必须在 agent-3 之前完成
      const agent2CompleteIndex = events.indexOf('agent:complete:agent-2');
      const agent3StartIndex = events.indexOf('agent:start:agent-3');
      expect(agent2CompleteIndex).toBeLessThan(agent3StartIndex);
    });

    it('应该正确传递 Agent 状态', async () => {
      const workflow = await chatAgent.createWorkflow('测试数据流');
      const result = await orchestrator.executeWorkflow(workflow);

      // 验证 Agent 状态
      expect(result.agentStates.size).toBe(3);

      const agent1State = result.agentStates.get('agent-1');
      expect(agent1State?.status).toBe('completed');
      expect(agent1State?.result?.success).toBe(true);

      const agent2State = result.agentStates.get('agent-2');
      expect(agent2State?.status).toBe('completed');
      expect(agent2State?.result?.success).toBe(true);

      const agent3State = result.agentStates.get('agent-3');
      expect(agent3State?.status).toBe('completed');
      expect(agent3State?.result?.success).toBe(true);
    });

    it('应该收集执行指标', async () => {
      const workflow = await chatAgent.createWorkflow('测试指标收集');
      const result = await orchestrator.executeWorkflow(workflow);

      // 验证指标
      expect(result.metrics).toBeDefined();
      expect(result.metrics?.totalAgents).toBe(3);
      expect(result.metrics?.parallelLevels).toBe(3);
      expect(result.metrics?.events).toBeDefined();
      expect(result.metrics?.events.length).toBeGreaterThan(0);
    });

    it('应该正确处理执行时长', async () => {
      const workflow = await chatAgent.createWorkflow('测试时长');
      const startTime = Date.now();
      const result = await orchestrator.executeWorkflow(workflow);
      const endTime = Date.now();

      // 验证总时长
      expect(result.duration).toBeGreaterThan(0);
      expect(result.duration).toBeLessThanOrEqual(endTime - startTime);

      // 验证每个 agent 的时长
      result.agentStates.forEach((state, agentId) => {
        expect(state.duration).toBeGreaterThan(0);
        expect(state.startTime).toBeDefined();
        expect(state.endTime).toBeDefined();
      });
    });
  });

  describe('并行执行', () => {
    it('应该并行执行无依赖的 Agent', async () => {
      // 创建一个有并行节点的工作流
      const parallelWorkflow: Workflow = {
        id: 'workflow-parallel',
        name: '并行工作流',
        description: '测试并行执行',
        agentGraph: [
          {
            id: 'agent-1',
            type: 'browser',
            name: 'Browser Agent 1',
            desc: '爬取网站 A',
            steps: [{ stepNumber: 1, desc: '执行爬取任务 A' }],
            dependencies: [],
          },
          {
            id: 'agent-2',
            type: 'browser',
            name: 'Browser Agent 2',
            desc: '爬取网站 B',
            steps: [{ stepNumber: 2, desc: '执行爬取任务 B' }],
            dependencies: [],
          },
          {
            id: 'agent-3',
            type: 'code',
            name: 'Code Agent',
            desc: '合并分析数据',
            steps: [{ stepNumber: 3, desc: '合并两个数据源' }],
            dependencies: ['agent-1', 'agent-2'],
          },
        ],
      };

      const events: Array<{ type: string; timestamp: number }> = [];

      orchestrator.on('agent:start', data => {
        events.push({ type: `start:${data.agentId}`, timestamp: Date.now() });
      });
      orchestrator.on('agent:complete', data => {
        events.push({ type: `complete:${data.agentId}`, timestamp: Date.now() });
      });

      const result = await orchestrator.executeWorkflow(parallelWorkflow);

      expect(result.status).toBe('completed');
      expect(result.successCount).toBe(3);

      // 验证 agent-1 和 agent-2 是并行执行的（几乎同时开始）
      const agent1Start = events.find(e => e.type === 'start:agent-1');
      const agent2Start = events.find(e => e.type === 'start:agent-2');

      expect(agent1Start).toBeDefined();
      expect(agent2Start).toBeDefined();

      // 并行执行的 agent 应该在接近的时间开始（允许 50ms 误差）
      const timeDiff = Math.abs(agent1Start!.timestamp - agent2Start!.timestamp);
      expect(timeDiff).toBeLessThan(50);

      // agent-3 应该在 agent-1 和 agent-2 都完成后才开始
      const agent1Complete = events.find(e => e.type === 'complete:agent-1');
      const agent2Complete = events.find(e => e.type === 'complete:agent-2');
      const agent3Start = events.find(e => e.type === 'start:agent-3');

      expect(agent3Start!.timestamp).toBeGreaterThanOrEqual(agent1Complete!.timestamp);
      expect(agent3Start!.timestamp).toBeGreaterThanOrEqual(agent2Complete!.timestamp);
    });
  });

  describe('错误处理', () => {
    it('应该检测无效的工作流（循环依赖）', async () => {
      const invalidWorkflow: Workflow = {
        id: 'workflow-invalid',
        name: '无效工作流',
        description: '包含循环依赖',
        agentGraph: [
          {
            id: 'agent-1',
            type: 'browser',
            name: 'Agent 1',
            desc: '任务 1',
            steps: [{ stepNumber: 1, desc: '执行任务 1' }],
            dependencies: ['agent-2'], // 依赖 agent-2
          },
          {
            id: 'agent-2',
            type: 'code',
            name: 'Agent 2',
            desc: '任务 2',
            steps: [{ stepNumber: 2, desc: '执行任务 2' }],
            dependencies: ['agent-1'], // 依赖 agent-1，形成循环
          },
        ],
      };

      await expect(orchestrator.executeWorkflow(invalidWorkflow)).rejects.toThrow(
        /Invalid workflow/
      );
    });

    it('应该检测不存在的依赖', async () => {
      const invalidWorkflow: Workflow = {
        id: 'workflow-invalid-dep',
        name: '无效依赖工作流',
        description: '依赖不存在的 Agent',
        agentGraph: [
          {
            id: 'agent-1',
            type: 'browser',
            name: 'Agent 1',
            desc: '任务 1',
            steps: [{ stepNumber: 1, desc: '执行任务 1' }],
            dependencies: ['non-existent-agent'], // 不存在的依赖
          },
        ],
      };

      await expect(orchestrator.executeWorkflow(invalidWorkflow)).rejects.toThrow(
        /Invalid workflow/
      );
    });
  });

  describe('完整集成流程', () => {
    it('完整流程：生成工作流 -> 调度执行 -> 验证结果', async () => {
      // Step 1: 使用 ChatAgent 生成工作流
      const taskDescription = '爬取电商网站的产品数据，进行分析并生成报告保存到本地';
      const workflow = await chatAgent.createWorkflow(taskDescription);

      expect(workflow).toBeDefined();
      expect(workflow.agentGraph).toHaveLength(3);

      // Step 2: 验证工作流结构
      expect(workflow.agentGraph[0].type).toBe('browser');
      expect(workflow.agentGraph[1].type).toBe('code');
      expect(workflow.agentGraph[2].type).toBe('file');

      // Step 3: 执行工作流
      const executionResult = await orchestrator.executeWorkflow(workflow);

      // Step 4: 验证执行结果
      expect(executionResult.status).toBe('completed');
      expect(executionResult.successCount).toBe(3);
      expect(executionResult.failureCount).toBe(0);

      // Step 5: 验证每个 Agent 的执行结果
      const browserResult = executionResult.agentStates.get('agent-1');
      expect(browserResult?.status).toBe('completed');
      expect(browserResult?.result?.data?.summary).toContain('提取');

      const codeResult = executionResult.agentStates.get('agent-2');
      expect(codeResult?.status).toBe('completed');
      expect(codeResult?.result?.data?.summary).toContain('分析');

      const fileResult = executionResult.agentStates.get('agent-3');
      expect(fileResult?.status).toBe('completed');
      expect(fileResult?.result?.data?.summary).toContain('保存');

      // Step 6: 验证执行时长和性能指标
      expect(executionResult.duration).toBeGreaterThan(0);
      expect(executionResult.metrics?.totalAgents).toBe(3);
      expect(executionResult.metrics?.parallelLevels).toBe(3);

      console.log('\n✅ 完整集成测试通过');
      console.log(`📊 工作流执行统计:`);
      console.log(`   - 总耗时: ${executionResult.duration}ms`);
      console.log(`   - 成功数: ${executionResult.successCount}`);
      console.log(`   - 失败数: ${executionResult.failureCount}`);
      console.log(`   - Agent 数量: ${executionResult.metrics?.totalAgents}`);
      console.log(`   - 并行层级: ${executionResult.metrics?.parallelLevels}`);
    });
  });

  describe('Context 传递和共享', () => {
    /**
     * 创建可以验证 Context 的 Mock Agent
     */
    class ContextAwareMockAgent extends BaseAgent {
      public receivedTasks: Task[] = [];

      constructor(id: string, type: string) {
        super({
          id,
          name: `${type} Agent`,
          description: `Mock ${type} agent with context awareness`,
          capabilities: [type],
          llmConfig: {
            provider: 'openai',
            apiKey: 'mock-key',
            model: 'gpt-4',
          },
        });
      }

      protected getToolDefinitions() {
        return {};
      }

      protected async executeToolCall(toolName: string, input: any): Promise<any> {
        return { success: true };
      }

      // @ts-expect-error - Mock implementation
      async execute(task: Task): Promise<TaskResult> {
        const startTime = Date.now();
        
        // 记录接收到的 task（包括 context）
        this.receivedTasks.push(task);
        
        this.emit('task:start', task);

        try {
          await new Promise(resolve => setTimeout(resolve, 50));

          const result: TaskResult = {
            success: true,
            data: {
              agentId: this.id,
              processedData: `Processed by ${this.id}`,
              // 回传 dependencies 信息，证明收到了前置 Agent 的输出
              receivedDependencies: task.parameters.dependencies
                ? Object.keys(task.parameters.dependencies)
                : [],
            },
            metadata: { 
              taskId: task.id, 
              agentId: this.id,
              contextSessionId: task.context?.sessionId,
            },
            duration: Date.now() - startTime,
          };

          this.emit('task:complete', result);
          return result;
        } catch (error) {
          const result: TaskResult = {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
            metadata: { taskId: task.id, agentId: this.id },
            duration: Date.now() - startTime,
          };
          this.emit('task:error', result);
          return result;
        }
      }
    }

    it('应该正确传递 Context 信息到 Agent', async () => {
      // 1. 创建新的 orchestrator（避免与其他测试冲突）
      const testOrchestrator = new WorkflowOrchestrator();
      
      // 2. 创建 context-aware agents
      const agent1 = new ContextAwareMockAgent('browser-agent', 'browser');
      const agent2 = new ContextAwareMockAgent('code-agent', 'code');
      
      testOrchestrator.registerAgent(agent1);
      testOrchestrator.registerAgent(agent2);

      // 3. 创建简单的工作流
      const workflow: Workflow = {
        id: 'workflow-context-test',
        name: 'Context Test',
        description: '测试 Context 传递',
        agentGraph: [
          {
            id: 'ctx-agent-1',
            type: 'browser',
            name: 'Browser Agent',
            desc: '第一个 Agent',
            steps: [{ stepNumber: 1, desc: '执行任务' }],
            dependencies: [],
          },
          {
            id: 'ctx-agent-2',
            type: 'code',
            name: 'Code Agent',
            desc: '第二个 Agent',
            steps: [{ stepNumber: 2, desc: '处理数据' }],
            dependencies: ['ctx-agent-1'],
          },
        ],
      };

      // 4. 执行工作流
      const result = await testOrchestrator.executeWorkflow(workflow);

      // 5. 验证 Context 传递
      expect(result.status).toBe('completed');
      
      // 验证 agent1 收到的 task
      expect(agent1.receivedTasks.length).toBe(1);
      const agent1Task = agent1.receivedTasks[0];
      expect(agent1Task).toBeDefined();
      expect(agent1Task.context?.sessionId).toBe(workflow.id);
      expect(agent1Task.context?.environment).toBe('node');
      expect(agent1Task.context?.metadata?.agentId).toBe('ctx-agent-1');

      // 验证 agent2 收到的 task
      expect(agent2.receivedTasks.length).toBe(1);
      const agent2Task = agent2.receivedTasks[0];
      expect(agent2Task).toBeDefined();
      expect(agent2Task.context?.sessionId).toBe(workflow.id);
      expect(agent2Task.context?.metadata?.agentId).toBe('ctx-agent-2');
      
      // 🔑 关键验证：agent2 应该收到 agent1 的输出
      expect(agent2Task.parameters.dependencies).toBeDefined();
      expect(agent2Task.parameters.dependencies['ctx-agent-1']).toBeDefined();
      expect(agent2Task.parameters.dependencies['ctx-agent-1'].success).toBe(true);
    });

    it('应该在依赖链中正确传递前置 Agent 的输出', async () => {
      // 1. 创建独立的 orchestrator
      const testOrchestrator = new WorkflowOrchestrator();
      
      // 2. 创建三个 agent 的链式依赖
      const agent1 = new ContextAwareMockAgent('browser-agent', 'browser');
      const agent2 = new ContextAwareMockAgent('code-agent', 'code');
      const agent3 = new ContextAwareMockAgent('file-agent', 'file');
      
      testOrchestrator.registerAgent(agent1);
      testOrchestrator.registerAgent(agent2);
      testOrchestrator.registerAgent(agent3);

      const workflow: Workflow = {
        id: 'workflow-chain',
        name: 'Chain Test',
        description: '测试依赖链',
        agentGraph: [
          {
            id: 'chain-agent-1',
            type: 'browser',
            name: 'Browser',
            desc: 'Step 1',
            steps: [{ stepNumber: 1, desc: '提取数据' }],
            dependencies: [],
          },
          {
            id: 'chain-agent-2',
            type: 'code',
            name: 'Code',
            desc: 'Step 2',
            steps: [{ stepNumber: 2, desc: '分析数据' }],
            dependencies: ['chain-agent-1'],
          },
          {
            id: 'chain-agent-3',
            type: 'file',
            name: 'File',
            desc: 'Step 3',
            steps: [{ stepNumber: 3, desc: '保存结果' }],
            dependencies: ['chain-agent-2'],
          },
        ],
      };

      const result = await testOrchestrator.executeWorkflow(workflow);

      // 验证执行成功
      expect(result.status).toBe('completed');

      // 验证 agent2 收到 agent1 的输出
      expect(agent2.receivedTasks.length).toBe(1);
      const agent2Task = agent2.receivedTasks[0];
      expect(agent2Task.parameters.dependencies['chain-agent-1']).toBeDefined();
      expect(agent2Task.parameters.dependencies['chain-agent-1'].data?.agentId).toBe('browser-agent');

      // 验证 agent3 收到 agent2 的输出（但不应该包含 agent1，因为没有直接依赖）
      expect(agent3.receivedTasks.length).toBe(1);
      const agent3Task = agent3.receivedTasks[0];
      expect(agent3Task.parameters.dependencies['chain-agent-2']).toBeDefined();
      expect(agent3Task.parameters.dependencies['chain-agent-2'].data?.agentId).toBe('code-agent');
      
      // agent3 不应该直接收到 agent1 的输出（没有直接依赖）
      expect(agent3Task.parameters.dependencies['chain-agent-1']).toBeUndefined();
    });

    it('应该在并行 Agent 汇聚时传递多个依赖输出', async () => {
      // 1. 创建独立的 orchestrator
      const testOrchestrator = new WorkflowOrchestrator();
      
      // 2. 创建菱形依赖结构 - 使用不同类型避免冲突
      const agent1 = new ContextAwareMockAgent('browser-agent', 'browser');
      const agent2a = new ContextAwareMockAgent('code-agent', 'code');
      const agent2b = new ContextAwareMockAgent('file-agent', 'file');
      const agent3 = new ContextAwareMockAgent('image-agent', 'image');
      
      testOrchestrator.registerAgent(agent1);
      testOrchestrator.registerAgent(agent2a);
      testOrchestrator.registerAgent(agent2b);
      testOrchestrator.registerAgent(agent3);

      const workflow: Workflow = {
        id: 'workflow-diamond',
        name: 'Diamond Test',
        description: '测试菱形依赖',
        agentGraph: [
          {
            id: 'diamond-agent-1',
            type: 'browser',
            name: 'Root',
            desc: '起点',
            steps: [{ stepNumber: 1, desc: '初始化' }],
            dependencies: [],
          },
          {
            id: 'diamond-agent-2a',
            type: 'code',
            name: 'Branch A',
            desc: '分支 A',
            steps: [{ stepNumber: 2, desc: '处理 A' }],
            dependencies: ['diamond-agent-1'],
          },
          {
            id: 'diamond-agent-2b',
            type: 'file',
            name: 'Branch B',
            desc: '分支 B',
            steps: [{ stepNumber: 3, desc: '处理 B' }],
            dependencies: ['diamond-agent-1'],
          },
          {
            id: 'diamond-agent-3',
            type: 'image',
            name: 'Merge',
            desc: '合并',
            steps: [{ stepNumber: 4, desc: '合并结果' }],
            dependencies: ['diamond-agent-2a', 'diamond-agent-2b'],
          },
        ],
      };

      const result = await testOrchestrator.executeWorkflow(workflow);

      // 验证执行成功
      expect(result.status).toBe('completed');

      // 🔑 关键验证：agent3 应该同时收到 agent2a 和 agent2b 的输出
      expect(agent3.receivedTasks.length).toBe(1);
      const agent3Task = agent3.receivedTasks[0];
      expect(agent3Task.parameters.dependencies['diamond-agent-2a']).toBeDefined();
      expect(agent3Task.parameters.dependencies['diamond-agent-2b']).toBeDefined();
      
      // 验证收到的数据是正确的
      expect(agent3Task.parameters.dependencies['diamond-agent-2a'].data?.agentId).toBe('code-agent');
      expect(agent3Task.parameters.dependencies['diamond-agent-2b'].data?.agentId).toBe('file-agent');
      
      // 验证 agent3 报告收到了两个依赖
      const agent3Result = result.agentStates.get('diamond-agent-3');
      expect(agent3Result?.result?.data?.receivedDependencies).toHaveLength(2);
      expect(agent3Result?.result?.data?.receivedDependencies).toContain('diamond-agent-2a');
      expect(agent3Result?.result?.data?.receivedDependencies).toContain('diamond-agent-2b');
    });

    it('应该在 Context metadata 中传递工作流信息', async () => {
      // 创建独立的 orchestrator
      const testOrchestrator = new WorkflowOrchestrator();
      
      const agent = new ContextAwareMockAgent('browser-agent', 'browser');
      testOrchestrator.registerAgent(agent);

      const workflow: Workflow = {
        id: 'workflow-metadata-test',
        name: 'Metadata Test',
        description: '测试 metadata 传递',
        agentGraph: [
          {
            id: 'meta-agent',
            type: 'browser',
            name: 'Test Agent',
            desc: '测试',
            steps: [{ stepNumber: 1, desc: '执行' }],
            dependencies: [],
          },
        ],
      };

      await testOrchestrator.executeWorkflow(workflow);

      expect(agent.receivedTasks.length).toBe(1);
      const receivedTask = agent.receivedTasks[0];
      
      // 验证 context metadata 包含必要信息
      expect(receivedTask.context?.metadata?.workflowId).toBe('workflow-metadata-test');
      expect(receivedTask.context?.metadata?.agentId).toBe('meta-agent');
      expect(receivedTask.context?.metadata?.agentName).toBe('Test Agent');
    });
  });
});

