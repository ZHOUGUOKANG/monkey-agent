import { IAgent, AgentNode, AgentExecutionResult, AgentContext, ILLMClient } from '@monkey-agent/types';
import EventEmitter from 'eventemitter3';
import type { ToolSet } from 'ai';
import type { ContextCompressionConfig } from '@monkey-agent/compression';
import { ContextManager, createContextTools, isContextTool, executeContextTool } from '@monkey-agent/context';
import { ReactLoop } from './ReactLoop';
import { Logger } from '@monkey-agent/logger';

/**
 * Agent 基础配置
 */
export interface BaseAgentConfig {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  llmClient: ILLMClient;
  systemPrompt?: string;
  maxIterations?: number;
  contextCompression?: ContextCompressionConfig;
  /** 是否启用流式输出（默认 true） */
  enableStreaming?: boolean;
  /** 流式文本回调 */
  onStreamChunk?: (chunk: string) => void;
}

/**
 * Agent 执行选项（运行时覆盖）
 */
export interface AgentExecuteOptions {
  /** 结构化任务信息（可选），包含 steps、dependencies 等 */
  agentNode?: Partial<AgentNode>;
  /** 是否启用流式输出（覆盖配置） */
  enableStreaming?: boolean;
  /** 流式文本回调（覆盖配置） */
  onStreamChunk?: (chunk: string) => void;
}

/**
 * Agent 基类（架构重构版）
 * 
 * 核心变更：
 * - 职责分离：ReactLoop 负责 ReAct 循环，ContextManager 负责上下文管理
 * - BaseAgent 只作为协调器，组合各个模块
 * - 简化代码，提高可测试性
 * 
 * 使用方式：
 * 1. 继承 BaseAgent
 * 2. 实现 getToolDefinitions() - 定义工具（不含 execute 函数）
 * 3. 实现 executeToolCall() - 处理工具执行
 * 4. 可选：覆盖 buildSystemPrompt() 和 buildUserMessage()
 */
export abstract class BaseAgent extends EventEmitter implements IAgent {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;
  public readonly capabilities: string[];
  
  protected llm: ILLMClient;
  protected systemPrompt: string;
  protected maxIterations: number;
  protected enableStreaming: boolean;
  protected onStreamChunk?: (chunk: string) => void;
  protected logger: Logger;
  
  // 模块化组件
  protected reactLoop: ReactLoop;
  protected contextManager: ContextManager;

  constructor(config: BaseAgentConfig) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.capabilities = config.capabilities;
    this.llm = config.llmClient;
    
    this.systemPrompt = config.systemPrompt || '';
    this.maxIterations = config.maxIterations ?? 30;
    this.enableStreaming = config.enableStreaming ?? true;
    this.onStreamChunk = config.onStreamChunk;
    this.logger = new Logger(`BaseAgent:${this.name}`);
    
    // 初始化模块
    const compression = config.contextCompression ?? {};
    this.contextManager = new ContextManager(this.llm, {
      enabled: compression.enabled ?? true,
      maxMessages: compression.maxMessages ?? 20,
      maxTokens: compression.maxTokens ?? 8000,
    });
    
    this.reactLoop = new ReactLoop();
    
    // 监听 ReactLoop 内部事件并转换为外部事件
    this.setupEventConversion();
  }

  /**
   * 设置事件转换：将 ReactLoop 的内部事件（react:*）转换为 BaseAgent 的外部事件（agent:*）
   */
  private setupEventConversion(): void {
    // react:thinking → agent:thinking
    this.reactLoop.on('react:thinking', (data: any) => {
      this.emit('agent:thinking', {
        agentId: this.id,
        ...data
      });
    });

    // react:action → agent:tool-call
    this.reactLoop.on('react:action', (data: any) => {
      this.emit('agent:tool-call', {
        agentId: this.id,
        ...data
      });
    });

    // react:observation → agent:tool-result
    this.reactLoop.on('react:observation', (data: any) => {
      this.emit('agent:tool-result', {
        agentId: this.id,
        ...data
      });
    });

    // react:observation-error → agent:tool-error
    this.reactLoop.on('react:observation-error', (data: any) => {
      this.emit('agent:tool-error', {
        agentId: this.id,
        ...data
      });
    });

    // react:compressed → agent:compressed
    this.reactLoop.on('react:compressed', (data: any) => {
      this.emit('agent:compressed', {
        agentId: this.id,
        ...data
      });
    });

    // react:stream-text → agent:stream-text
    this.reactLoop.on('react:stream-text', (data: any) => {
      this.emit('agent:stream-text', {
        agentId: this.id,
        ...data
      });
    });

    // react:stream-finish → agent:stream-finish
    this.reactLoop.on('react:stream-finish', (data: any) => {
      this.emit('agent:stream-finish', {
        agentId: this.id,
        ...data
      });
    });

    // react:context-length-error → agent:context-length-error
    this.reactLoop.on('react:context-length-error', (data: any) => {
      this.emit('agent:context-length-error', {
        agentId: this.id,
        ...data
      });
    });

    // react:warning → agent:warning
    this.reactLoop.on('react:warning', (data: any) => {
      this.emit('agent:warning', {
        agentId: this.id,
        ...data
      });
    });

    // react:max-iterations → agent:max-iterations
    this.reactLoop.on('react:max-iterations', (data: any) => {
      this.emit('agent:max-iterations', {
        agentId: this.id,
        ...data
      });
    });
  }

  /**
   * 执行 Workflow 节点（重构版 - 使用模块化组件）
   * 
   * @param task 任务描述（可选，默认使用 agent 描述）
   * @param context 执行上下文（可选，自动创建）
   * @param options 执行选项（可选，用于运行时覆盖配置）
   */
  async execute(
    task?: string, 
    context?: AgentContext,
    options?: AgentExecuteOptions
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    
    // 1. 规范化 task
    const normalizedTask = task || `Execute ${this.name}`;
    
    // 2. 构建完整的 AgentNode（合并 task 和 options.agentNode）
    const agentNode = this.buildAgentNode(normalizedTask, options?.agentNode);
    
    // 3. 规范化 context（未提供则创建最小化 context）
    const normalizedContext = context || this.createMinimalContext(normalizedTask);
    
    this.logger.info('Agent starting', {
      nodeId: agentNode.id,
      workflowId: normalizedContext.workflowId,
      desc: agentNode.desc
    });
    
    try {
      this.emit('agent:start', { 
        agentId: this.id, 
        node: agentNode,
        workflowId: normalizedContext.workflowId,
        timestamp: Date.now()
      });
      
      // 构建提示词
      const systemPrompt = this.buildSystemPrompt(agentNode, normalizedContext);
      const userMessage = this.buildUserMessage(agentNode, normalizedContext);
      
      // 合并 agent 工具和 context 工具
      const agentTools = this.getToolDefinitions();
      const contextTools = createContextTools(normalizedContext);
      const mergedTools = { ...agentTools, ...contextTools };
      
      // 详细的调试日志
      this.logger.debug('Tool merging details', {
        agentTools: Object.keys(agentTools),
        contextTools: Object.keys(contextTools),
        mergedTools: Object.keys(mergedTools),
        total: Object.keys(mergedTools).length,
        hasValSet: 'valSet' in mergedTools,
        hasValGet: 'valGet' in mergedTools,
        hasValList: 'valList' in mergedTools,
      });
      
      // 运行 ReAct 循环（委托给 ReactLoop）
      // 优先使用 options 中的配置，否则使用实例配置
      const result = await this.reactLoop.run({
        systemPrompt,
        userMessage,
        tools: mergedTools,  // 使用合并后的工具集
        toolExecutor: async (name, input) => {
          // 路由到对应的工具执行器
          if (isContextTool(name)) {
            return await executeContextTool(name, input, normalizedContext);
          }
          return await this.executeToolCall(name, input);
        },
        llmClient: this.llm,
        contextManager: this.contextManager,
        maxIterations: this.maxIterations,
        enableStreaming: options?.enableStreaming ?? this.enableStreaming,
        onStreamChunk: options?.onStreamChunk ?? this.onStreamChunk,
      });
      
      this.emit('agent:complete', { 
        agentId: this.id, 
        result,
        duration: Date.now() - startTime,
        iterations: result.iterations,
        timestamp: Date.now()
      });
      
      this.logger.info('Agent completed', {
        iterations: result.iterations,
        duration: Date.now() - startTime,
        status: 'success'
      });
      
      return {
        agentId: this.id,
        data: result.data,
        summary: result.summary,
        status: 'success',
        duration: Date.now() - startTime,
        iterations: result.iterations,  // 添加迭代次数
      };
    } catch (error: any) {
      this.logger.error('Agent execution failed', {
        error: error.message,
        nodeId: agentNode.id
      });
      
      this.emit('agent:error', { 
        agentId: this.id, 
        error: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
      
      return {
        agentId: this.id,
        data: null,
        summary: `Error: ${error.message}`,
        status: 'failed',
        error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 构建系统提示词（增强版：智能展示 steps + context tools）
   */
  protected buildSystemPrompt(node: AgentNode, context: AgentContext): string {
    // 获取当前时间和时区信息
    const now = new Date();
    const timeString = now.toLocaleString('zh-CN', { 
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timezoneOffset = -now.getTimezoneOffset() / 60;
    const timezoneStr = `UTC${timezoneOffset >= 0 ? '+' : ''}${timezoneOffset}`;
    
    // 获取所有可用工具（包括 context tools）
    const agentTools = this.getToolDefinitions();
    const contextTools = createContextTools(context);
    const allTools = { ...agentTools, ...contextTools };
    
    let prompt = `You are ${this.name}.

Description: ${this.description}

Current Task:
${node.desc}
`;

    // 如果有多个步骤，或步骤描述与任务描述不同，则显示步骤
    const shouldShowSteps = node.steps && node.steps.length > 1 || 
                            (node.steps && node.steps.length === 1 && node.steps[0].desc !== node.desc);
    
    if (shouldShowSteps) {
      prompt += `\nSteps to complete:\n`;
      prompt += node.steps.map(s => `${s.stepNumber}. ${s.desc}`).join('\n');
      prompt += '\n';
    }

    prompt += `
Context:
- Workflow: ${context.workflowTask}
- Current Time: ${timeString} (${timezone}, ${timezoneStr})
- You have access to these tools: ${Object.keys(allTools).join(', ')}

## Data Sharing in Workflows
When working in a multi-agent workflow, you can share data with downstream agents using context tools:

- **valSet(key, value)**: Save data to shared context
  Example: valSet({ key: "extractedData", value: [...data...] })
  
- **valGet(key)**: Retrieve data saved by previous agents
  Example: valGet({ key: "extractedData" })
  
- **valList()**: List all available shared variables
  Example: valList({})

**⚠️ CRITICAL - When to use valSet:**
1. **Call valSet IMMEDIATELY** after you extract/collect/generate data
2. **DON'T wait** until the end of your task - store data as soon as you have it
3. **Example order**: extract data → call valSet → continue with other steps
4. **Why**: If you hit max iterations before calling valSet, the data will be lost!

**IMPORTANT**: If you produce data that might be useful for downstream agents (like reports), 
ALWAYS save it using valSet and mention the variable name in your summary.

Important:
- Follow the steps in order
- Use tools to complete the task
- **When you have data, call valSet immediately before doing anything else**
- When done, provide a summary of what was accomplished
`;

    return prompt;
  }

  /**
   * 构建用户消息（包含父节点信息）
   */
  protected buildUserMessage(node: AgentNode, context: AgentContext): string {
    if (node.dependencies.length === 0) {
      return `Please complete the task: ${node.desc}`;
    }
    
    // 有依赖节点，提供父节点的 summary
    const parentInfo = node.dependencies.map(depId => {
      const output = context.getOutput(depId);
      return `- ${depId}: ${output?.summary || 'No summary'}`;
    }).join('\n');
    
    return `Previous steps completed:
${parentInfo}

Now, please complete your task: ${node.desc}

You can access data from previous steps using valGet tool if needed.
`;
  }

  /**
   * 构建 AgentNode（合并 task 和 options.agentNode）
   * 将简单的 task 字符串转换为完整的 AgentNode 结构
   * 
   * @param task 任务描述字符串
   * @param nodeOptions 可选的节点配置（steps、dependencies 等）
   * @returns 完整的 AgentNode 对象
   */
  private buildAgentNode(
    task: string, 
    nodeOptions?: Partial<AgentNode>
  ): AgentNode {
    return {
      id: nodeOptions?.id || `${this.id}-${Date.now()}`,
      type: nodeOptions?.type || this.id,
      name: nodeOptions?.name || this.name,
      desc: task,  // 使用 task 作为主要描述
      steps: nodeOptions?.steps || [
        { stepNumber: 1, desc: task }  // 默认单步骤
      ],
      dependencies: nodeOptions?.dependencies || [],
    };
  }

  /**
   * 创建最小化 AgentContext
   * 用于独立执行场景，不需要完整的 Workflow 上下文
   * 
   * @param task 任务描述
   * @returns 最小化的 AgentContext 对象
   */
  private createMinimalContext(task: string): AgentContext {
    const workflowId = `standalone-${Date.now()}`;
    const outputs = new Map();
    const vals = new Map();
    
    return {
      workflowId,
      workflowTask: task,
      outputs,
      vals,
      startTime: Date.now(),
      status: 'running',
      currentLevel: 0,
      
      // 实现辅助方法
      getOutput: (agentId: string) => outputs.get(agentId),
      getValue: (key: string) => vals.get(key),
      setValue: (key: string, value: any) => vals.set(key, value),
      toJSON: () => ({
        workflowId,
        workflowTask: task,
        outputs,
        vals,
        startTime: Date.now(),
        status: 'running' as const,
        currentLevel: 0,
      }),
    } as AgentContext;
  }

  /**
   * 获取工具定义（子类实现）
   * 注意：不要提供 execute 函数，工具执行由 executeToolCall 处理
   * 
   * 设为 public 以匹配 IAgent 接口要求
   */
  public abstract getToolDefinitions(): ToolSet;

  /**
   * 执行工具调用（子类实现）
   */
  protected abstract executeToolCall(toolName: string, input: any): Promise<any>;
}
