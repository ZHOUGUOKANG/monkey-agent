import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMClient } from '@monkey-agent/llm';
import { WorkflowOrchestrator } from '@monkey-agent/orchestrator';
import { ChatAgent, ComputerAgent } from '@monkey-agent/agents';
import type {
  ILLMClient,
  Workflow,
  WorkflowExecutionResult,
  IAgent,
} from '@monkey-agent/types';
import { BrowserAdapter } from './browser.adapter';

/**
 * Chat 请求 Payload
 */
interface ChatPayload {
  message: string;
  conversationId?: string;
  context?: Record<string, unknown>;
}

/**
 * Chat 响应
 */
interface ChatResponse {
  type: 'text' | 'workflow' | 'artifact';
  text?: string;
  workflow?: Workflow;
  artifact?: any;
}

/**
 * Agent Adapter
 *
 * 职责：
 * - 初始化核心包（LLMClient, WorkflowOrchestrator, Agents）
 * - 管理实例生命周期
 * - 提供简单的调用接口
 *
 * ❌ 不包含业务逻辑（都在核心包中）
 */
@Injectable()
export class AgentAdapter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentAdapter.name);

  private llmClient: ILLMClient | null = null;
  private orchestrator!: WorkflowOrchestrator;
  private chatAgent!: ChatAgent;
  
  /**
   * 清理流式代码中的 markdown 标记
   */
  private cleanStreamedCode(chunk: string, isFirstChunk: boolean): string {
    let cleaned = chunk;
    
    // 第一个 chunk 可能包含开头的 markdown 标记
    if (isFirstChunk) {
      // 移除开头的 ```javascript 或 ```jsx 或 ```
      cleaned = cleaned.replace(/^```(?:javascript|jsx|js|react)?\s*\n?/i, '');
    }
    
    // 移除结尾的 ```
    cleaned = cleaned.replace(/\n?```\s*$/g, '');
    
    return cleaned;
  }

  constructor(
    private config: ConfigService,
    private browserAdapter: BrowserAdapter,
  ) {}

  /**
   * 模块初始化
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing Agent system...');

    try {
      // 1. 获取 LLM Provider 和对应的 API Key
      const provider = this.config.get<string>('LLM_PROVIDER') || 'openai';

      // 根据 provider 获取对应的 API Key
      let apiKey: string | undefined;
      switch (provider) {
        case 'openai':
          apiKey = this.config.get<string>('OPENAI_API_KEY');
          break;
        case 'openrouter':
          apiKey = this.config.get<string>('OPENROUTER_API_KEY');
          break;
        case 'anthropic':
          apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
          break;
        case 'google':
          apiKey = this.config.get<string>('GOOGLE_API_KEY');
          break;
        case 'deepseek':
          apiKey = this.config.get<string>('DEEPSEEK_API_KEY');
          break;
        default:
          apiKey = this.config.get<string>('OPENAI_API_KEY'); // 默认尝试 OpenAI
      }

      // 2. 创建 LLMClient（来自 @monkey-agent/llm）
      this.llmClient = new LLMClient({
        provider,
        apiKey,
        model: this.config.get<string>('LLM_MODEL') || 'gpt-4',
        temperature: parseFloat(
          this.config.get<string>('LLM_TEMPERATURE') || '0.7',
        ),
        maxTokens: parseInt(
          this.config.get<string>('LLM_MAX_TOKENS') || '4000',
        ),
      });

      this.logger.log(`LLMClient created with provider: ${provider}`);

      // 3. 创建 WorkflowOrchestrator（来自 @monkey-agent/orchestrator）
      this.orchestrator = new WorkflowOrchestrator();

      this.logger.log('WorkflowOrchestrator created');

      // 4. 创建所有 Agents（来自 @monkey-agent/agents）

      // Browser Agent
      const browserAgent = await this.browserAdapter.createBrowserAgent(
        this.llmClient!,
      );
      this.orchestrator.registerAgent(browserAgent);
      this.logger.log('BrowserAgent registered');

      // Computer Agent (统一的系统控制 Agent)
      const allowedDirs = (this.config.get<string>('ALLOWED_DIRECTORIES') || '')
        .split(',')
        .filter(Boolean);
      const allowedCmds = (this.config.get<string>('ALLOWED_COMMANDS') || '')
        .split(',')
        .filter(Boolean);
      const computerAgent = new ComputerAgent({
        llmClient: this.llmClient!,
        allowedDirectories: allowedDirs,
        allowedCommands: allowedCmds,
      });
      this.orchestrator.registerAgent(computerAgent);
      this.logger.log(
        'ComputerAgent registered (includes file, shell, and computer control)',
      );

      // Report Agent (报告生成 Agent)
      const { ReportAgent } = await import('@monkey-agent/agents');
      const reportAgent = new ReportAgent({
        llmClient: this.llmClient!,
      });
      this.orchestrator.registerAgent(reportAgent);
      this.logger.log('ReportAgent registered (data visualization and report generation)');

      // Code Agent (代码执行 Agent - 可选)
      const e2bApiKey = this.config.get<string>('E2B_API_KEY');
      if (e2bApiKey) {
        const { CodeAgent } = await import('@monkey-agent/agents');
        const codeAgent = new CodeAgent({
          llmClient: this.llmClient!,
          e2bApiKey,
          e2bTemplateId: this.config.get<string>('E2B_TEMPLATE_ID'),
        });
        this.orchestrator.registerAgent(codeAgent);
        this.logger.log('CodeAgent registered (E2B sandbox enabled)');
      } else {
        this.logger.warn(
          'CodeAgent skipped: E2B_API_KEY not configured. Code execution will not be available.',
        );
      }

      // 5. 创建 ChatAgent（来自 @monkey-agent/agents）
      // ChatAgent 通过函数获取 Agent 信息，不直接依赖 orchestrator
      this.chatAgent = new ChatAgent({
        llmClient: this.llmClient!,
        getAgentsInfo: () => {
          const agentsInfo = this.orchestrator.getAgentsInfo();
          this.logger.log(
            `ChatAgent getAgentsInfo called, found ${agentsInfo.length} agents: ${agentsInfo.map((a) => a.id).join(', ')}`,
          );
          return agentsInfo;
        },
      });

      this.logger.log('Agent system initialized successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to initialize Agent system: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 模块销毁
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down Agent system');
    // 清理资源
    // 目前没有需要清理的资源，保留方法以备将来使用
    await Promise.resolve();
  }

  /**
   * 聊天（返回结构化结果）
   *
   * 调用 ChatAgent，根据意图识别结果返回：
   * - 简单对话：{ type: 'text', text: string }
   * - 复杂任务：{ type: 'workflow', workflow: Workflow }
   */
  async chat(payload: ChatPayload): Promise<ChatResponse> {
    try {
      // 调用 ChatAgent（只需要传递消息字符串）
      this.logger.debug(`Calling ChatAgent with message: ${payload.message}`);
      const result = await this.chatAgent.execute(payload.message);

      // 🔍 调试日志：打印 ChatAgent 返回结果
      this.logger.debug(`ChatAgent result.data: ${JSON.stringify(result.data, null, 2)}`);
      this.logger.debug(`ChatAgent result.status: ${result.status}`);
      this.logger.debug(`ChatAgent result.summary: ${result.summary}`);

      // 判断结果类型
      // 检查 result.data.type === 'workflow' 或 result.data.workflow 存在
      if (result.data?.type === 'workflow' && result.data?.workflow) {
        // 复杂任务 → 返回 Workflow
        this.logger.log(`✅ Detected workflow in result.data (type: ${result.data.type})`);
        this.logger.debug(`Workflow object: ${JSON.stringify(result.data.workflow, null, 2)}`);
        return {
          type: 'workflow',
          workflow: result.data.workflow as Workflow,
        };
      } else {
        // 简单对话 → 返回文本
        this.logger.log(`📝 Detected text response`);
        return {
          type: 'text',
          text:
            (result.data?.response as string) ||
            result.summary ||
            'No response',
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Chat error: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 聊天（支持流式输出）
   *
   * 调用 ChatAgent，支持流式文本回调和事件回调
   * - 简单对话：通过 onStreamChunk 实时返回文本片段
   * - 复杂任务：返回 Workflow
   */
  async chatWithStreaming(
    payload: ChatPayload,
    callbacks?: {
      onStreamChunk?: (chunk: string) => void;
      onEvent?: (event: any) => void;
    }
  ): Promise<ChatResponse> {
    try {
      this.logger.debug(`Calling ChatAgent (streaming) with message: ${payload.message}`);
      
      // 创建事件监听器 - 监听所有重要事件
      const eventListeners: Array<{ event: string; handler: (...args: any[]) => void }> = [];
      
      if (callbacks?.onEvent) {
        // 监听所有 agent 事件
        const events = [
          'agent:start',
          'agent:thinking', 
          'agent:tool-call', 
          'agent:tool-result',
          'agent:tool-error',
          'agent:stream-text',
          'agent:stream-finish',
          'agent:compressed',
          'agent:complete',
          'agent:error'
        ];
        
        events.forEach(event => {
          const handler = (data: any) => {
            // 添加事件类型到数据中
            callbacks.onEvent!({ type: event, ...data });
          };
          this.chatAgent.on(event, handler);
          eventListeners.push({ event, handler });
        });
      }
      
      // 调用 ChatAgent（启用流式输出）
      const result = await this.chatAgent.execute(
        payload.message,
        undefined, // context
        {
          enableStreaming: true,
          onStreamChunk: callbacks?.onStreamChunk,
        }
      );
      
      // 清理事件监听器
      eventListeners.forEach(({ event, handler }) => {
        this.chatAgent.off(event, handler);
      });

      // 🔍 调试日志：打印 ChatAgent 返回结果
      this.logger.debug(`ChatAgent result.data: ${JSON.stringify(result.data, null, 2)}`);
      this.logger.debug(`ChatAgent result.status: ${result.status}`);

      // 判断结果类型
      if (result.data?.type === 'workflow' && result.data?.workflow) {
        // 复杂任务 → 返回 Workflow
        this.logger.log(`✅ Detected workflow in result.data (type: ${result.data.type})`);
        return {
          type: 'workflow',
          workflow: result.data.workflow as Workflow,
        };
      } else if (result.data?.type === 'artifact' && result.data?.artifact) {
        // Artifact (报告/可视化) → 返回 Artifact
        this.logger.log(`✅ Detected artifact in result.data (type: ${result.data.type})`);
        this.logger.debug(`Artifact object: ${JSON.stringify(result.data.artifact, null, 2)}`);
        return {
          type: 'artifact',
          artifact: result.data.artifact,
        };
      } else {
        // 简单对话 → 文本已通过流式回调发送
        this.logger.log(`📝 Detected text response (streamed)`);
        return {
          type: 'text',
          text:
            (result.data?.response as string) ||
            result.summary ||
            'No response',
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Chat error: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 执行工作流
   *
   * 调用 WorkflowOrchestrator（来自 @monkey-agent/orchestrator）
   */
  async executeWorkflow(
    workflow: Workflow,
    options?: Record<string, unknown>,
  ): Promise<WorkflowExecutionResult> {
    this.logger.log(`Executing workflow: ${workflow.id}`);

    try {
      // 调用 WorkflowOrchestrator
      const result = await this.orchestrator.executeWorkflow(workflow, options);

      this.logger.log(`Workflow ${workflow.id} completed: ${result.status}`);

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Workflow execution error: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取可用的 Agents
   */
  getAvailableAgents(): Array<{
    id: string;
    name: string;
    description: string;
    capabilities: string[];
  }> {
    return this.orchestrator.getAllAgents().map((agent: IAgent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities,
    }));
  }

  /**
   * 获取 Orchestrator 实例
   */
  getOrchestrator(): WorkflowOrchestrator {
    return this.orchestrator;
  }

  /**
   * 获取 LLMClient 实例
   */
  getLLMClient(): ILLMClient {
    if (!this.llmClient) {
      throw new Error('LLMClient not initialized');
    }
    return this.llmClient;
  }

  /**
   * 生成 HTML 降级版本
   * 当 React 代码编译失败时调用
   */
  async generateHtmlFallback(
    artifactId: string,
    error: string,
    callbacks?: {
      onStreamChunk?: (chunk: string) => void;
    }
  ): Promise<{ artifact: any }> {
    this.logger.log(`Generating HTML fallback for artifact: ${artifactId}`);
    this.logger.log(`React error: ${error}`);

    try {
      // 获取 ReportAgent
      const reportAgent = this.orchestrator.getAgent('report-agent');
      if (!reportAgent) {
        throw new Error('ReportAgent not found');
      }

      // 类型断言并调用 generateHtmlFallback
      const result = await (reportAgent as any).generateHtmlFallback(
        error,
        callbacks?.onStreamChunk
      );

      this.logger.log('HTML fallback generated successfully');
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`HTML fallback generation error: ${errorMessage}`);
      throw error;
    }
  }
}
