import { BaseAgent, BaseAgentConfig } from '@monkey-agent/base';
import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { z } from 'zod';
import type { Workflow, ILLMClient } from '@monkey-agent/types';
import { IntentRecognizer, IntentType, type IntentRecognitionResult } from './intent';
import { WorkflowGenerator, type AgentInfo } from './workflow';
import { buildSystemPrompt } from './prompts/system';
import { workflowSchema } from './workflow/schema';

// Re-export types for convenience
export { IntentType, type IntentRecognitionResult };

/**
 * Chat Agent 配置
 */
export interface ChatAgentConfig {
  /** Agent ID */
  id?: string;
  /** Agent 名称 */
  name?: string;
  /** Agent 描述 */
  description?: string;
  /** Agent 能力列表 */
  capabilities?: string[];
  /** 最大迭代次数 */
  maxIterations?: number;
  /** 上下文压缩配置 */
  contextCompression?: BaseAgentConfig['contextCompression'];
  /** 系统提示词 */
  systemPrompt?: string;
  /** 
   * 获取可用 Agent 信息的函数
   * 由外部（如 WorkflowOrchestrator）提供
   * 仅在需要生成工作流时必需
   */
  getAgentsInfo?: () => AgentInfo[];
  
  /**
   * Orchestrator 实例（便利选项）
   * 如果提供此选项，将自动调用 orchestrator.getAgentsInfo()
   * 仅在需要生成工作流时必需
   */
  orchestrator?: {
    getAgentsInfo(): AgentInfo[];
  };
  
  /** LLM 客户端（必需） */
  llmClient: ILLMClient;
}

/**
 * Chat Agent
 * 
 * 核心能力：
 * 1. 意图识别 - 理解用户意图，判断是否需要多智能体协作
 * 2. 工作流生成 - 生成完整的工作流定义
 * 3. 对话管理 - 简单场景下提供智能对话能力
 */
export class ChatAgent extends BaseAgent {
  private intentRecognizer: IntentRecognizer;
  private workflowGenerator?: WorkflowGenerator;
  private getAgentsInfo?: () => AgentInfo[];

  constructor(config: ChatAgentConfig) {
    // 解析 getAgentsInfo（可选，仅生成工作流时需要）
    const getAgentsInfo = ChatAgent.resolveGetAgentsInfo(config);
    
    // 获取 Agent 信息用于构建 system prompt（如果有的话）
    const agentsInfo = getAgentsInfo ? getAgentsInfo() : [];
    
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
      llmClient: config.llmClient!,
      systemPrompt: config.systemPrompt || buildSystemPrompt(agentsInfo),
      maxIterations: config.maxIterations,
      contextCompression: config.contextCompression,
    });

    this.getAgentsInfo = getAgentsInfo;
    this.intentRecognizer = new IntentRecognizer(config.llmClient);
    
    // 只有在提供了 getAgentsInfo 时才创建 workflowGenerator
    if (getAgentsInfo) {
      this.workflowGenerator = new WorkflowGenerator(
        config.llmClient,
        getAgentsInfo
      );
    }
  }

  /**
   * 解析 getAgentsInfo 函数（可选）
   */
  private static resolveGetAgentsInfo(config: ChatAgentConfig): (() => AgentInfo[]) | undefined {
    if (config.orchestrator) {
      return () => config.orchestrator!.getAgentsInfo();
    } else if (config.getAgentsInfo) {
      return config.getAgentsInfo;
    }
    // 不再抛出错误，返回 undefined 表示没有配置
    return undefined;
  }

  /**
   * 定义工具
   * 
   * 如果没有配置 agentsInfo，则不返回工具（纯对话模式由 BaseAgent 处理）
   * 如果配置了 agentsInfo，则返回意图识别和工作流生成工具
   */
  public getToolDefinitions(): ToolSet {
    // 纯对话模式：不需要工具，BaseAgent 会直接处理对话
    if (!this.getAgentsInfo) {
      return {};
    }
    
    // 工作流生成模式：提供完整工具集
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
        return await this.intentRecognizer.recognize(input.userMessage, input.context);

      case 'chat':
        return {
          type: 'chat_response',
          message: 'Processing your message...',
          context: input.context,
        };

      case 'generateWorkflow':
        // LLM 生成的 workflow 参数
        // 重要：标记这是最终结果，让 ReactLoop 停止
        return {
          __final_result__: true,  // 特殊标记：表示这是最终结果
          type: 'workflow',
          workflow: input,  // input 就是完整的 workflow 对象
        };

      default:
        return {
          error: true,
          message: `Unknown tool: ${toolName}`,
          toolName,
        };
    }
  }

  // ============ 公共 API ============

  /**
   * 直接识别意图（供外部调用）
   */
  async analyzeIntent(
    userMessage: string,
    context?: Record<string, any>
  ): Promise<IntentRecognitionResult> {
    return await this.intentRecognizer.recognize(userMessage, context);
  }

  /**
   * 直接生成工作流（供外部调用）
   */
  async createWorkflow(
    taskDescription: string,
    options?: {
      requirements?: string[];
      availableAgents?: string[];
      envContext?: any;
      pageInfo?: any;
    }
  ): Promise<Workflow> {
    // 检查是否配置了 workflowGenerator
    if (!this.workflowGenerator) {
      throw new Error(
        'ChatAgent cannot generate workflow without orchestrator or getAgentsInfo. ' +
        'Please provide either orchestrator or getAgentsInfo in the config.'
      );
    }
    
    // 首先识别意图
    const intentResult = await this.intentRecognizer.recognize(taskDescription);

    // 构建增强的任务描述（包含环境上下文）
    let enhancedTask = taskDescription;
    if (options?.envContext) {
      const env = options.envContext;
      enhancedTask += `\n\n**环境上下文：**\n`;
      enhancedTask += `- 当前时间：${env.currentTime}\n`;
      enhancedTask += `- 浏览器语言：${env.language}\n`;
      enhancedTask += `- 打开的标签页：${env.tabCount} 个\n`;
      if (env.activeTab) {
        enhancedTask += `- 当前页面：${env.activeTab.title} (${env.activeTab.url})\n`;
      }
    }
    
    if (options?.pageInfo) {
      enhancedTask += `\n**当前页面信息：**\n`;
      enhancedTask += `- URL: ${options.pageInfo.url}\n`;
      enhancedTask += `- 标题: ${options.pageInfo.title}\n`;
    }

    return await this.workflowGenerator.generate(
      enhancedTask,
      intentResult.intent,
      options?.requirements
    );
  }

  /**
   * 构建系统提示词（供测试使用）
   * @internal
   */
  buildSystemPrompt(): string {
    const agentsInfo = this.getAgentsInfo ? this.getAgentsInfo() : [];
    return buildSystemPrompt(agentsInfo);
  }
}
