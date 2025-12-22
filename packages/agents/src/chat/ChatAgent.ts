import { BaseAgent, BaseAgentConfig } from '@monkey-agent/base';
import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { z } from 'zod';
import type {
  WorkflowExecutionContext,
  AgentNodeStep,
  ParentNodeInfo,
} from '@monkey-agent/context';
import type { Workflow, AgentNode } from '@monkey-agent/types';

/**
 * 意图类型
 */
export enum IntentType {
  /** 简单对话 - 闲聊、问答、一般性咨询 */
  SIMPLE_CHAT = 'simple_chat',
  /** 单一任务 - 可以由单个 Agent 完成的任务 */
  SINGLE_TASK = 'single_task',
  /** 复杂工作流 - 需要多个 Agent 协作的任务 */
  COMPLEX_WORKFLOW = 'complex_workflow',
  /** 信息查询 - 查询信息、检索数据 */
  INFORMATION_QUERY = 'information_query',
  /** 不确定 - 需要进一步澄清 */
  UNCERTAIN = 'uncertain',
}

/**
 * 意图识别结果
 */
export interface IntentRecognitionResult {
  /** 识别的意图类型 */
  intent: IntentType;
  /** 置信度 (0-1) */
  confidence: number;
  /** 解释 */
  explanation: string;
  /** 提取的关键信息 */
  entities?: Record<string, any>;
  /** 是否需要多智能体协作 */
  needsMultiAgent: boolean;
}

/**
 * Agent 节点执行上下文（传递给 Agent 的完整信息）
 */
export interface AgentNodeExecutionContext {
  /** 工作流的完整任务 */
  workflowTask: string;
  /** 当前节点的任务描述 */
  currentTask: string;
  /** 当前节点的执行步骤 */
  steps: AgentNodeStep[];
  /** 父节点信息（依赖的节点） */
  parentNodes: ParentNodeInfo[];
  /** 共享上下文（所有已完成节点的输出和共享变量） */
  sharedContext: WorkflowExecutionContext;
}

/**
 * Agent 执行结果（包含 summary）
 */
export interface AgentExecutionResult {
  /** Agent ID */
  agentId: string;
  /** 执行结果数据 */
  data: any;
  /** ReAct 循环结束后的总结 */
  summary: string;
  /** 执行状态 */
  status: 'success' | 'failed';
  /** 错误信息 */
  error?: Error;
}

/**
 * DAG 验证工具类
 */
class DAGValidator {
  /**
   * 检测环（使用 DFS）
   */
  static detectCycle(nodes: AgentNode[]): boolean {
    const graph = new Map<string, string[]>();
    nodes.forEach(node => {
      graph.set(node.id, node.dependencies);
    });

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const deps = graph.get(nodeId) || [];
      for (const dep of deps) {
        if (!visited.has(dep)) {
          if (hasCycle(dep)) return true;
        } else if (recStack.has(dep)) {
          return true; // 发现环
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (hasCycle(node.id)) return true;
      }
    }

    return false;
  }

  /**
   * 拓扑排序（Kahn 算法）
   * 返回每一层可以并行执行的节点
   */
  static topologicalSort(nodes: AgentNode[]): string[][] {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    // 构建图和入度表
    nodes.forEach(node => {
      graph.set(node.id, []);
      inDegree.set(node.id, node.dependencies.length);
    });
    
    // 建立反向边（用于找到依赖此节点的节点）
    nodes.forEach(node => {
      node.dependencies.forEach(dep => {
        graph.get(dep)?.push(node.id);
      });
    });

    const levels: string[][] = [];
    const queue: string[] = [];
    
    // 找到所有入度为 0 的节点
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) queue.push(nodeId);
    });

    while (queue.length > 0) {
      const currentLevel: string[] = [...queue];
      levels.push(currentLevel);
      queue.length = 0;

      for (const nodeId of currentLevel) {
        const neighbors = graph.get(nodeId) || [];
        for (const neighbor of neighbors) {
          const newDegree = (inDegree.get(neighbor) || 0) - 1;
          inDegree.set(neighbor, newDegree);
          if (newDegree === 0) {
            queue.push(neighbor);
          }
        }
      }
    }

    return levels;
  }

  /**
   * 验证 DAG 有效性
   */
  static validate(workflow: Workflow): { valid: boolean; error?: string } {
    // 检查是否有环
    if (this.detectCycle(workflow.agentGraph)) {
      return { valid: false, error: 'Workflow contains circular dependencies' };
    }

    // 检查所有依赖的 ID 是否存在
    const allIds = new Set(workflow.agentGraph.map(a => a.id));
    for (const agent of workflow.agentGraph) {
      for (const dep of agent.dependencies) {
        if (!allIds.has(dep)) {
          return { 
            valid: false, 
            error: `Agent ${agent.id} depends on non-existent agent ${dep}` 
          };
        }
      }
    }

    // 检查是否至少有一个入度为 0 的节点
    const hasStartNode = workflow.agentGraph.some(
      agent => agent.dependencies.length === 0
    );
    if (!hasStartNode) {
      return { valid: false, error: 'Workflow must have at least one agent with no dependencies' };
    }

    return { valid: true };
  }
}

// ============ Zod Schemas for Workflow Generation ============

/**
 * Agent Node Step Schema - 简化版，兼容所有 LLM providers
 */
const agentNodeStepSchema = z.object({
  stepNumber: z.number().describe('Global step number across all agents (1, 2, 3...)'),
  desc: z.string().describe('Step description providing execution guidance'),
});

/**
 * Agent Node Schema（DAG 版本）- 简化版，兼容所有 LLM providers
 */
const agentNodeSchema = z.object({
  id: z.string().describe('Agent unique ID, format: agent-{number}'),
  type: z.string().describe('Agent type: browser, crawler, code, file, shell, computer, or image'),
  name: z.string().describe('Agent name'),
  desc: z.string().describe('Clear description of agent responsibility and what it does'),
  steps: z.array(agentNodeStepSchema).describe('1-5 steps with global sequential numbering'),
  dependencies: z.array(z.string()).describe('IDs of agents this agent depends on. Empty array = no dependencies'),
});

/**
 * Workflow Schema（DAG 版本，含验证）
 * 
 * 用于 generateWorkflow tool 的参数验证
 */
const workflowSchema = z.object({
  id: z.string()
    .regex(/^workflow-\d+$/)
    .describe('Workflow unique ID, format: workflow-{timestamp}'),
  
  name: z.string()
    .min(1)
    .max(100)
    .describe('Descriptive workflow name in user language'),
  
  description: z.string()
    .min(10)
    .max(300)
    .describe('Brief description of what this workflow accomplishes'),
  
  agentGraph: z.array(agentNodeSchema)
    .min(1)
    .max(10)
    .describe('Array of 1-10 agents forming a DAG with globally numbered steps'),
  
  estimatedDuration: z.number()
    .positive()
    .optional()
    .describe('Estimated duration in milliseconds'),
}).refine(
  (data) => {
    // 验证 1: dependencies 引用的 ID 都存在
    const allIds = new Set(data.agentGraph.map(a => a.id));
    for (const agent of data.agentGraph) {
      for (const dep of agent.dependencies) {
        if (!allIds.has(dep)) {
          return false;
        }
      }
    }
    return true;
  },
  { message: 'All dependency IDs must reference existing agents' }
).refine(
  (data) => {
    // 验证 2: 全局 stepNumber 必须唯一且连续
    const allStepNumbers = data.agentGraph
      .flatMap(agent => agent.steps.map(s => s.stepNumber))
      .sort((a, b) => a - b);
    
    // 检查是否从 1 开始连续
    for (let i = 0; i < allStepNumbers.length; i++) {
      if (allStepNumbers[i] !== i + 1) {
        return false;
      }
    }
    return true;
  },
  { message: 'Step numbers must be unique and sequential starting from 1' }
);

/**
 * Chat Agent 配置
 */
export interface ChatAgentConfig extends Partial<BaseAgentConfig> {
  /** WorkflowOrchestrator 实例（必需，用于获取可用的 Agent 类型） */
  orchestrator: any; // 使用 any 避免循环依赖
}

/**
 * Chat Agent
 * 
 * 核心能力：
 * 1. 意图识别 - 理解用户意图，判断是否需要多智能体协作
 * 2. 工作流生成 - 当需要多智能体时，生成完整的工作流定义
 * 3. 对话管理 - 简单场景下提供智能对话能力
 * 
 * 工作流程：
 * 1. 接收用户消息
 * 2. 分析意图（simple_chat | single_task | complex_workflow）
 * 3. 根据意图决定：
 *    - simple_chat: 直接对话
 *    - single_task: 可选择性生成简单计划
 *    - complex_workflow: 生成完整的 multi-agent workflow
 * 
 * @example
 * ```typescript
 * const orchestrator = new WorkflowOrchestrator();
 * orchestrator.registerAgent(new BrowserAgent({ id: 'browser-agent' }));
 * orchestrator.registerAgent(new CodeAgent({ id: 'code-agent' }));
 * 
 * const chatAgent = new ChatAgent({
 *   llmConfig: {
 *     provider: 'openai',
 *     apiKey: 'sk-...',
 *     model: 'gpt-4',
 *   },
 *   orchestrator: orchestrator,
 * });
 * 
 * // 简单对话
 * await chatAgent.execute({
 *   id: 'task-1',
 *   type: 'chat',
 *   description: '你好，今天天气怎么样？',
 *   parameters: {},
 * });
 * 
 * // 复杂任务 - 自动生成工作流
 * await chatAgent.execute({
 *   id: 'task-2',
 *   type: 'chat',
 *   description: '帮我爬取这个网站的数据，分析后生成可视化图表，并保存到本地',
 *   parameters: {},
 * });
 * ```
 */
export class ChatAgent extends BaseAgent {
  private orchestrator: any; // WorkflowOrchestrator 实例
  private agentInfoCache: Array<{ type: string; description: string; capabilities: string[] }>;

  constructor(config: ChatAgentConfig) {
    if (!config.orchestrator) {
      throw new Error('ChatAgent requires an orchestrator instance. Please provide orchestrator in config.');
    }
    
    // 保存 orchestrator 引用
    const orchestrator = config.orchestrator;
    
    // 从 orchestrator 获取可用的 Agent 类型和详细信息
    const { availableAgentTypes, agentInfo } = ChatAgent.getAvailableAgents(orchestrator);
    
    super({
      id: config.id || 'chat-agent',
      name: config.name || 'Chat Agent',
      description:
        config.description ||
        '智能对话 Agent，具备意图识别和多智能体工作流生成能力',
      capabilities: config.capabilities || [
        'intent-recognition',
        'workflow-generation',
        'conversation',
        'task-planning',
        'multi-agent-coordination',
      ],
      llmClient: config.llmClient,
      llmConfig: config.llmConfig,
      systemPrompt: config.systemPrompt || (() => {
        // 延迟构建 system prompt，使用从 orchestrator 获取的真实 agent 信息
        return `You are Chat Agent, an intelligent conversation and task coordination assistant.

Your core responsibilities:
1. **Intent Recognition**: Analyze user messages to understand their true intent
2. **Workflow Generation**: For complex tasks, design multi-agent workflows
3. **Conversation**: Provide helpful, natural conversation for simple queries

Available Agents:
${agentInfo.map((info) => `- ${info.type}: ${info.description}\n  Capabilities: ${info.capabilities.join(', ')}`).join('\n')}

Intent Classification Rules:
- **simple_chat**: Casual conversation, greetings, general questions that don't require actions
- **single_task**: Tasks that can be completed by one agent (e.g., "search the web", "write a file")
- **complex_workflow**: Tasks requiring multiple agents working together (e.g., "scrape data, analyze it, and generate a report")

When to Generate Workflows:
- Multiple distinct operations needed
- Different agent capabilities required
- Data needs to flow between agents
- Tasks have clear dependencies

Workflow Design Principles:
1. Break down complex tasks into clear steps
2. Assign each step to the most capable agent
3. Define dependencies between steps
4. Ensure data flows correctly between agents
5. Include validation and error handling

IMPORTANT: 
- Always respond in the same language as the user's input
- For simple conversations, just chat naturally - don't over-engineer
- For complex tasks, think carefully about the workflow before generating it
- Be clear about what you're doing and why`;
      })(),
      maxIterations: config.maxIterations,
      enableReflection: config.enableReflection,
      contextCompression: config.contextCompression,
    });

    this.availableAgentTypes = availableAgentTypes;
    this.orchestrator = orchestrator;
    this.agentInfoCache = agentInfo;
  }

  /**
   * 从 orchestrator 获取可用的 Agent 类型和详细信息
   */
  private static getAvailableAgents(orchestrator: any): {
    availableAgentTypes: string[];
    agentInfo: Array<{ type: string; description: string; capabilities: string[] }>;
  } {
    if (!orchestrator || typeof orchestrator.getAvailableAgentTypes !== 'function') {
      throw new Error('Invalid orchestrator: must have getAvailableAgentTypes() method');
    }
    
    const types = orchestrator.getAvailableAgentTypes();
    if (!types || types.length === 0) {
      throw new Error('No available agent types found in orchestrator. Please register agents first.');
    }
    
    // 获取详细的 agent 信息
    let agentInfo: Array<{ type: string; description: string; capabilities: string[] }> = [];
    if (typeof orchestrator.getAllAgentInfo === 'function') {
      agentInfo = orchestrator.getAllAgentInfo();
    }
    
    return {
      availableAgentTypes: types,
      agentInfo,
    };
  }

  /**
   * 更新可用的 Agent 类型（当 orchestrator 注册新 Agent 时调用）
   */
  public updateAvailableAgents(): void {
    if (typeof this.orchestrator.getAvailableAgentTypes === 'function') {
      const newTypes = this.orchestrator.getAvailableAgentTypes();
      if (newTypes.length > 0) {
        this.availableAgentTypes = newTypes;
      }
    }
    
    // 更新 agent 信息缓存
    if (typeof this.orchestrator.getAllAgentInfo === 'function') {
      this.agentInfoCache = this.orchestrator.getAllAgentInfo();
    }
  }

  /**
   * 定义工具
   */
  protected getToolDefinitions(): ToolSet {
    return {
      recognizeIntent: tool({
        description:
          'Analyze user input to recognize intent and determine if multi-agent workflow is needed',
        inputSchema: z.object({
          userMessage: z.string().describe('The user message to analyze'),
          context: z
            .record(z.any())
            .optional()
            .describe('Additional context for intent recognition'),
        }),
      }),

      generateWorkflow: tool({
        description: `Generate a DAG-based multi-agent workflow with globally numbered steps.
        
Key concepts:
- Agents form a Directed Acyclic Graph (DAG)
- Use 'dependencies' array to define execution order
- Empty dependencies = runs immediately
- Steps have global sequential numbers (1, 2, 3... across all agents)
- All agents access shared context with previous outputs`,
        inputSchema: workflowSchema,
      }),

      chat: tool({
        description: 'Provide a conversational response for simple queries',
        inputSchema: z.object({
          message: z.string().describe('Message to respond to'),
          context: z
            .record(z.any())
            .optional()
            .describe('Conversation context'),
        }),
      }),
    };
  }

  /**
   * 执行工具调用
   */
  protected async executeToolCall(toolName: string, input: any): Promise<any> {
    switch (toolName) {
      case 'recognizeIntent':
        return await this.recognizeIntent(input.userMessage, input.context);

      case 'chat':
        return await this.provideChatResponse(input.message, input.context);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // ============ 核心功能实现 ============

  /**
   * 识别用户意图
   */
  private async recognizeIntent(
    userMessage: string,
    context?: Record<string, any>
  ): Promise<IntentRecognitionResult> {
    this.emit('intent:recognition-start', { userMessage });

    // 使用 LLM 进行意图识别
    const prompt = this.buildIntentRecognitionPrompt(userMessage, context);

    const result = await this.getLLMClient().chat([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    try {
      const intentData = this.parseIntentResponse(result.text);

      this.emit('intent:recognized', intentData);

      return intentData;
    } catch (error) {
      // 降级处理：无法识别时返回不确定
      return {
        intent: IntentType.UNCERTAIN,
        confidence: 0.5,
        explanation: 'Unable to clearly identify the intent',
        needsMultiAgent: false,
      };
    }
  }

  /**
   * 构建意图识别提示词
   */
  private buildIntentRecognitionPrompt(
    userMessage: string,
    context?: Record<string, any>
  ): string {
    return `Analyze the following user message and identify the intent.

User Message: "${userMessage}"

${context ? `Context: ${JSON.stringify(context, null, 2)}` : ''}

Please classify the intent into one of these categories:
1. **simple_chat**: Casual conversation, greetings, general questions (no actions needed)
2. **single_task**: A task that can be completed by a single agent
3. **complex_workflow**: A complex task requiring multiple agents working together
4. **information_query**: Query for information or data
5. **uncertain**: Intent is unclear

Consider these factors:
- Does the request involve multiple distinct operations?
- Are different capabilities/tools required?
- Is there a need for data flow between different components?
- Does it involve dependencies between tasks?

Respond with a JSON object:
{
  "intent": "simple_chat | single_task | complex_workflow | information_query | uncertain",
  "confidence": 0.0-1.0,
  "explanation": "Brief explanation of why this intent was chosen",
  "entities": {
    // Extract key information like URLs, file paths, data types, etc.
  },
  "needsMultiAgent": true/false
}

Examples:
- "你好" → simple_chat (confidence: 0.95)
- "帮我搜索一下明天的天气" → single_task (confidence: 0.9)
- "爬取这个网站的数据，用Python分析，然后生成可视化图表" → complex_workflow (confidence: 0.95)`;
  }

  /**
   * 解析意图识别响应
   */
  private parseIntentResponse(responseText: string): IntentRecognitionResult {
    // 尝试从响应中提取 JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const data = JSON.parse(jsonMatch[0]);

    return {
      intent: data.intent as IntentType,
      confidence: data.confidence,
      explanation: data.explanation,
      entities: data.entities,
      needsMultiAgent: data.needsMultiAgent,
    };
  }

  /**
   * 生成多智能体工作流（使用 Tool Use）
   */
  private async generateWorkflow(
    taskDescription: string,
    intent: string,
    requirements?: string[],
    _availableAgents?: string[]
  ): Promise<Workflow> {
    this.emit('workflow:generation-start', { taskDescription });

    // 构建系统和用户消息
    const systemMessage = this.buildWorkflowSystemPrompt([]);
    const userMessage = this.buildWorkflowUserPrompt(
      taskDescription,
      intent,
      requirements
    );

    // 调用 LLM with tool use - LLM 会直接生成完整的 Workflow 结构
    const result = await this.getLLMClient().chat(
      [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      {
        tools: {
          generateWorkflow: tool({
            description: `Generate a complete DAG-based multi-agent workflow.`,
            inputSchema: z.object({
              id: z.string().describe('Workflow unique ID, format: workflow-{timestamp}'),
              name: z.string().describe('Descriptive workflow name'),
              description: z.string().describe('Brief description of workflow purpose'),
              agentGraph: z.array(agentNodeSchema).describe('Array of agents forming DAG'),
              estimatedDuration: z.number().positive().optional().describe('Estimated duration in milliseconds'),
            }),
          }),
        },
        toolChoice: 'required', // 强制 LLM 使用 tool
      }
    );

    // 提取 workflow
    if (!result.toolCalls || result.toolCalls.length === 0) {
      throw new Error('LLM did not generate workflow tool call');
    }

    const workflowCall = result.toolCalls.find(
      tc => tc.toolName === 'generateWorkflow'
    );

    if (!workflowCall) {
      throw new Error('No generateWorkflow tool call found');
    }

    // Tool call 的参数已经过 Zod 验证
    // Vercel AI SDK 使用 'args' 或 'input' 字段，取决于版本
    // @ts-ignore - AI SDK toolCalls 类型在某些情况下推导不准确
    const workflowArgs = (workflowCall as any).input;
    
    // 调试信息
    if (!workflowArgs) {
      console.error('workflowCall keys:', Object.keys(workflowCall));
      console.error('Tool calls:', JSON.stringify(result.toolCalls, null, 2));
      throw new Error('Workflow args is undefined - LLM may not have generated valid workflow structure');
    }

    const workflow: Workflow = workflowArgs as Workflow;

    // 额外的 DAG 验证
    const validation = DAGValidator.validate(workflow);
    if (!validation.valid) {
      throw new Error(`Invalid workflow DAG: ${validation.error}`);
    }

    this.emit('workflow:generated', workflow);

    return workflow;
  }

  /**
   * 构建工作流系统提示词
   */
  private buildWorkflowSystemPrompt(_availableAgents: string[]): string {
    return `You are a workflow architect. Design executable multi-agent workflows as DAGs.

Available Agents:
${this.agentInfoCache.map(info => 
  `- ${info.type}: ${info.description}\n  Capabilities: ${info.capabilities.join(', ')}`
).join('\n')}

DAG Design Guidelines:
1. Use 1-10 agents based on task complexity
2. Define dependencies to create DAG structure:
   - dependencies: [] = runs first (no deps)
   - dependencies: ['agent-1'] = waits for agent-1
   - dependencies: ['agent-1', 'agent-2'] = waits for both
3. Support parallel execution:
   - Multiple agents with same dependencies run concurrently
4. Assign global step numbers sequentially:
   - Number ALL steps across ALL agents from 1 to N
   - Example: Agent-1 (steps 1-3), Agent-2 (steps 4-6), Agent-3 (steps 7-9)
   - Follow topological order when possible
5. Each agent gets 1-5 descriptive steps with numbers:
   - Format: { stepNumber: 1, desc: "Navigate to target page and wait for load" }
   - Good: [{ stepNumber: 1, desc: "Navigate to product listing page" }, { stepNumber: 2, desc: "Extract all product names and prices" }]
   - desc should provide clear guidance for agent execution
6. Steps descriptions are guidance hints - agents figure out detailed implementation
7. All agents share execution context - can access any previous agent's output

Use the generateWorkflow tool to create the workflow.`;
  }

  /**
   * 构建工作流用户提示词
   */
  private buildWorkflowUserPrompt(
    taskDescription: string,
    intent: string,
    requirements?: string[]
  ): string {
    const reqText = requirements?.length 
      ? `\n\nRequirements:\n${requirements.map(r => `- ${r}`).join('\n')}`
      : '';

    return `Task: ${taskDescription}
Intent: ${intent}${reqText}

Design an efficient DAG workflow:
1. Break down into agents with clear responsibilities (use desc field to describe)
2. Define dependencies for proper execution order
3. Identify opportunities for parallel execution
4. Assign global step numbers sequentially (1, 2, 3... across all agents)
5. Provide descriptive step guidance (not just names, but clear instructions)

Generate the workflow now.`;
  }

  /**
   * 提供对话响应（用于简单聊天）
   */
  private async provideChatResponse(
    _message: string,
    context?: Record<string, any>
  ): Promise<any> {
    // 对于简单对话，直接返回消息本身
    // BaseAgent 的 execute 方法会通过 LLM 生成最终回复
    return {
      type: 'chat_response',
      message: 'Processing your message...',
      context,
    };
  }

  // ============ 公共方法 ============

  /**
   * 直接识别意图（供外部调用）
   */
  async analyzeIntent(
    userMessage: string,
    context?: Record<string, any>
  ): Promise<IntentRecognitionResult> {
    return await this.recognizeIntent(userMessage, context);
  }

  /**
   * 直接生成工作流（供外部调用）
   */
  async createWorkflow(
    taskDescription: string,
    options?: {
      requirements?: string[];
      availableAgents?: string[];
    }
  ): Promise<Workflow> {
    // 首先识别意图
    const intentResult = await this.recognizeIntent(taskDescription);

    return await this.generateWorkflow(
      taskDescription,
      intentResult.intent,
      options?.requirements,
      options?.availableAgents
    );
  }

}
