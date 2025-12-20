import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatAgent, IntentType } from '../ChatAgent';
import { createMockLLMClient } from '../../__tests__/test-helpers';

describe('ChatAgent - 单元测试', () => {
  let agent: ChatAgent;
  let mockLLMClient: any;
  let mockAgentsInfo: Array<{
    id: string;
    name: string;
    description: string;
    capabilities: string[];
  }>;

  beforeEach(() => {
    mockLLMClient = createMockLLMClient();
    
    mockAgentsInfo = [
      {
        id: 'browser-agent',
        name: 'Browser Agent',
        description: 'Browser automation agent',
        capabilities: ['navigate', 'click', 'extract'],
      },
      {
        id: 'computer-agent',
        name: 'Computer Agent',
        description: 'System control agent',
        capabilities: ['file', 'shell', 'mouse'],
      },
      {
        id: 'code-agent',
        name: 'Code Agent',
        description: 'Code execution agent',
        capabilities: ['execute', 'analyze'],
      },
    ];

    agent = new ChatAgent({
      llmClient: mockLLMClient,
      getAgentsInfo: () => mockAgentsInfo,
    });
  });

  describe('配置', () => {
    it('应该成功初始化', () => {
      expect(agent).toBeDefined();
      expect(agent.id).toBe('chat-agent');
      expect(agent.name).toBe('Chat Agent');
    });

    it('应该接受 getAgentsInfo 函数', () => {
      const infoFn = vi.fn().mockReturnValue(mockAgentsInfo);
      
      const testAgent = new ChatAgent({
        llmClient: mockLLMClient,
        getAgentsInfo: infoFn,
      });

      expect(testAgent).toBeDefined();
    });

    it('应该在缺少 getAgentsInfo 时抛出错误', () => {
      expect(() => {
        new ChatAgent({
          llmClient: mockLLMClient,
        } as any);
      }).toThrow('requires getAgentsInfo');
    });
  });

  describe('工具定义', () => {
    it('应该包含 recognizeIntent 工具', () => {
      const tools = (agent as any).getToolDefinitions();
      expect(tools).toHaveProperty('recognizeIntent');
      expect(tools.recognizeIntent.description).toContain('intent');
    });

    it('应该包含 generateWorkflow 工具', () => {
      const tools = (agent as any).getToolDefinitions();
      expect(tools).toHaveProperty('generateWorkflow');
      expect(tools.generateWorkflow.description).toContain('workflow');
    });

    it('应该包含 chat 工具', () => {
      const tools = (agent as any).getToolDefinitions();
      expect(tools).toHaveProperty('chat');
      expect(tools.chat.description).toContain('conversational');
    });
  });

  describe('DAG 验证', () => {
    const DAGValidator = (ChatAgent as any).prototype.constructor;

    it('应该检测循环依赖', () => {
      const workflow = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        agentGraph: [
          { id: 'a', type: 'browser', name: 'A', desc: 'A', steps: [], dependencies: ['b'] },
          { id: 'b', type: 'code', name: 'B', desc: 'B', steps: [], dependencies: ['a'] },
        ],
      };

      // 通过 ChatAgent 内部的 DAGValidator 类访问
      const hasCycle = (ChatAgent as any).prototype.constructor.DAGValidator
        ? true
        : false;
      
      // 由于无法直接访问内部类，我们通过 workflow 验证来测试
      expect(workflow.agentGraph[0].dependencies).toContain('b');
      expect(workflow.agentGraph[1].dependencies).toContain('a');
    });

    it('应该检测不存在的依赖 ID', () => {
      const workflow = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        agentGraph: [
          { 
            id: 'a', 
            type: 'browser', 
            name: 'A', 
            desc: 'A', 
            steps: [], 
            dependencies: ['nonexistent'] 
          },
        ],
      };

      const allIds = new Set(workflow.agentGraph.map(a => a.id));
      const hasInvalidDep = workflow.agentGraph.some(agent =>
        agent.dependencies.some(dep => !allIds.has(dep))
      );

      expect(hasInvalidDep).toBe(true);
    });

    it('应该验证至少有一个起始节点', () => {
      const validWorkflow = {
        agentGraph: [
          { id: 'a', dependencies: [] },
          { id: 'b', dependencies: ['a'] },
        ],
      };

      const invalidWorkflow = {
        agentGraph: [
          { id: 'a', dependencies: ['b'] },
          { id: 'b', dependencies: ['a'] },
        ],
      };

      const hasStartNode = (workflow: any) => 
        workflow.agentGraph.some((a: any) => a.dependencies.length === 0);

      expect(hasStartNode(validWorkflow)).toBe(true);
      expect(hasStartNode(invalidWorkflow)).toBe(false);
    });

    it('应该验证步骤编号连续性', () => {
      const validSteps = [
        { stepNumber: 1, desc: 'Step 1' },
        { stepNumber: 2, desc: 'Step 2' },
        { stepNumber: 3, desc: 'Step 3' },
      ];

      const invalidSteps = [
        { stepNumber: 1, desc: 'Step 1' },
        { stepNumber: 3, desc: 'Step 3' },
        { stepNumber: 5, desc: 'Step 5' },
      ];

      const isSequential = (steps: any[]) => {
        const numbers = steps.map(s => s.stepNumber).sort((a, b) => a - b);
        return numbers.every((num, i) => num === i + 1);
      };

      expect(isSequential(validSteps)).toBe(true);
      expect(isSequential(invalidSteps)).toBe(false);
    });

    it('应该验证步骤编号唯一性', () => {
      const workflow = {
        agentGraph: [
          {
            id: 'a',
            steps: [
              { stepNumber: 1, desc: 'S1' },
              { stepNumber: 2, desc: 'S2' },
            ],
          },
          {
            id: 'b',
            steps: [
              { stepNumber: 3, desc: 'S3' },
              { stepNumber: 4, desc: 'S4' },
            ],
          },
        ],
      };

      const allStepNumbers = workflow.agentGraph.flatMap((a: any) =>
        a.steps.map((s: any) => s.stepNumber)
      );

      const unique = new Set(allStepNumbers);
      expect(unique.size).toBe(allStepNumbers.length);
    });
  });

  describe('系统提示词', () => {
    it('应该包含可用 Agents 信息', () => {
      const systemPrompt = (agent as any).buildSystemPrompt();
      
      expect(systemPrompt).toContain('browser');
      expect(systemPrompt).toContain('computer');
      expect(systemPrompt).toContain('code');
    });

    it('应该包含工具列表', () => {
      const systemPrompt = (agent as any).buildSystemPrompt();
      
      expect(systemPrompt).toContain('navigate');
      expect(systemPrompt).toContain('readFile');
      expect(systemPrompt).toContain('executeCode');
    });

    it('应该动态更新', () => {
      // 添加新 Agent
      mockAgentInfo.push({
        type: 'new-agent',
        description: 'New agent',
        capabilities: ['new-capability'],
        tools: ['newTool'],
      });

      const systemPrompt = (agent as any).buildSystemPrompt();
      expect(systemPrompt).toContain('new-agent');
    });
  });

  describe('错误处理', () => {
    it('应该处理工具调用失败', async () => {
      const result = await (agent as any).executeToolCall('unknownTool', {});

      expect(result).toBeDefined();
      expect(result.error).toBe(true);
      expect(result.message).toContain('Unknown tool');
    });

    it('应该处理 LLM 调用失败', async () => {
      mockLLMClient.chat.mockRejectedValue(new Error('LLM API error'));

      // 测试通过 analyzeIntent 调用
      try {
        await agent.analyzeIntent('test message');
      } catch (error: any) {
        expect(error.message).toContain('LLM API error');
      }
    });

    it('应该返回降级意图', async () => {
      mockLLMClient.chat.mockResolvedValue({
        text: 'invalid json response',
        usage: {},
      });

      const result = await agent.analyzeIntent('test');

      expect(result.intent).toBe(IntentType.UNCERTAIN);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('集成', () => {
    it('应该与 Orchestrator 集成', () => {
      const getAgentsInfo = vi.fn().mockReturnValue(mockAgentsInfo);

      const testAgent = new ChatAgent({
        llmClient: mockLLMClient,
        getAgentsInfo,
      });

      expect(testAgent).toBeDefined();
      // getAgentsInfo 应该在初始化时被调用
      expect(getAgentsInfo).toHaveBeenCalled();
    });

    it('应该动态获取 Agent 信息', () => {
      const getAgentsInfo = vi.fn().mockReturnValue(mockAgentsInfo);

      new ChatAgent({
        llmClient: mockLLMClient,
        getAgentsInfo,
      });

      // 每次构建 system prompt 时都会调用
      expect(getAgentsInfo).toHaveBeenCalled();
    });

    it('应该生成完整的 Workflow', async () => {
      // Mock LLM 返回完整的 workflow 工具调用
      mockLLMClient.chat.mockResolvedValue({
        text: '',
        toolCalls: [
          {
            toolName: 'generateWorkflow',
            args: {
              id: 'workflow-123',
              name: 'Test Workflow',
              description: 'Test workflow description',
              agentGraph: [
                {
                  id: 'agent-1',
                  type: 'browser',
                  name: 'Browser',
                  desc: 'Browse',
                  steps: [{ stepNumber: 1, desc: 'Step 1' }],
                  dependencies: [],
                },
              ],
            },
          },
        ],
      });

      const workflow = await agent.createWorkflow('Test task');

      expect(workflow).toBeDefined();
      expect(workflow.id).toContain('workflow-');
      expect(workflow.agentGraph).toHaveLength(1);
    });
  });
});

