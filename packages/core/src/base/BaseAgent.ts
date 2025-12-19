import { IAgent, Task, TaskResult, Goal, Plan, Reflection, LLMConfig } from '../types';
import { LLMClient } from '../llm/LLMClient';
import EventEmitter from 'eventemitter3';
import type { ModelMessage, ToolSet } from 'ai';
import {
  ContextCompressionConfig,
  CompressionOptions,
  createCompressionTool,
  compressHistory,
  buildCompressedHistory,
  isContextLengthError,
  shouldCompress,
  validateConfig,
  InsufficientMessagesError,
} from '../compression';

/**
 * Agent 基础配置
 */
export interface BaseAgentConfig {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  /** 
   * LLM 客户端实例（优先使用）
   * 如果提供，将直接使用此实例，忽略 llmConfig
   */
  llmClient?: LLMClient;
  /** 
   * LLM 客户端配置（当 llmClient 未提供时使用）
   * 如果 llmClient 已提供，此配置将被忽略
   */
  llmConfig?: LLMConfig;
  /** 系统提示词（描述 Agent 的角色和能力） */
  systemPrompt?: string;
  /** 最大 ReAct 循环次数 */
  maxIterations?: number;
  /** 是否启用反思 */
  enableReflection?: boolean;
  /** 上下文压缩配置 */
  contextCompression?: ContextCompressionConfig;
}

/**
 * ReAct 步骤
 */
export interface ReActStep {
  thought: string;        // 思考过程
  action?: string;        // 要执行的操作
  actionInput?: any;      // 操作参数
  observation?: string;   // 观察到的结果
}

/**
 * Agent 基类（支持 LLM 驱动的 ReAct 模式）
 * 
 * 设计理念：
 * 1. 集成 LLM Client，通过自然语言推理驱动决策
 * 2. 实现 ReAct (Reasoning + Acting) 循环
 * 3. 提供工具系统，让子类定义可用的操作
 * 4. 支持记忆和反思机制
 * 
 * 使用方式：
 * 1. 继承 BaseAgent
 * 2. 实现 getToolDefinitions() 方法，定义 Agent 可用的工具（不含 execute）
 * 3. 实现 executeToolCall() 方法，处理工具执行逻辑
 * 4. 可选：覆盖 buildSystemPrompt() 自定义提示词
 * 5. 调用 execute() 执行任务，Agent 会自动进行 ReAct 循环
 * 
 * @example
 * ```typescript
 * class MyAgent extends BaseAgent {
 *   // 定义工具（不含 execute，避免 AI SDK 自动执行）
 *   protected getToolDefinitions(): ToolSet {
 *     return {
 *       searchWeb: tool({
 *         description: 'Search the web',
 *         parameters: z.object({
 *           query: z.string(),
 *         }),
 *         // 注意：不提供 execute 函数
 *       }),
 *     };
 *   }
 *   
 *   // 手动处理工具执行
 *   protected async executeToolCall(toolName: string, input: any): Promise<any> {
 *     switch (toolName) {
 *       case 'searchWeb':
 *         return await this.searchWeb(input.query);
 *       default:
 *         throw new Error(`Unknown tool: ${toolName}`);
 *     }
 *   }
 * }
 * 
 * const agent = new MyAgent({
 *   id: 'my-agent',
 *   name: 'My Agent',
 *   description: 'A helpful agent',
 *   capabilities: ['search', 'analyze'],
 *   llmConfig: {
 *     provider: 'openai',
 *     apiKey: 'sk-...',
 *     model: 'gpt-4',
 *   },
 * });
 * 
 * const result = await agent.execute({
 *   id: 'task-1',
 *   type: 'search',
 *   description: 'Find information about AI',
 *   parameters: {},
 * });
 * ```
 */
export abstract class BaseAgent extends EventEmitter implements IAgent {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;
  public readonly capabilities: string[];
  
  protected llm: LLMClient;
  protected systemPrompt: string;
  protected maxIterations: number;
  protected enableReflection: boolean;
  protected conversationHistory: ModelMessage[] = [];
  
  // 上下文压缩相关字段
  protected enableCompression: boolean;
  protected compressionMaxMessages: number;
  protected compressionMaxTokens: number;
  protected compressionKeepRecentRounds: number;
  protected compressionKeepRecentMessages: number;
  protected autoRetryOnLength: boolean;
  protected enableCompressionTool: boolean;
  protected compressionSummary?: string;

  constructor(config: BaseAgentConfig) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.capabilities = config.capabilities;
    
    // 优先使用传入的 LLM Client，否则从配置创建
    if (config.llmClient) {
      this.llm = config.llmClient;
    } else if (config.llmConfig) {
      this.llm = new LLMClient(config.llmConfig);
    } else {
      throw new Error('Either llmClient or llmConfig must be provided');
    }
    
    this.systemPrompt = config.systemPrompt || this.buildSystemPrompt();
    this.maxIterations = config.maxIterations ?? 25;
    this.enableReflection = config.enableReflection ?? true;
    
    // 初始化上下文压缩配置
    const compression = config.contextCompression ?? {};
    
    // 验证压缩配置
    if (compression.enabled !== false) {
      const validation = validateConfig(compression);
      if (!validation.valid && validation.errors) {
        console.error('[BaseAgent] 压缩配置验证失败:');
        validation.errors.forEach(err => console.error(`  - ${err}`));
        throw new Error(`Invalid compression config: ${validation.errors.join('; ')}`);
      }
      if (validation.warnings && validation.warnings.length > 0) {
        console.warn('[BaseAgent] 压缩配置警告:');
        validation.warnings.forEach(warn => console.warn(`  - ${warn}`));
      }
    }
    
    this.enableCompression = compression.enabled ?? true;
    this.compressionMaxMessages = compression.maxMessages ?? 20;
    this.compressionMaxTokens = compression.maxTokens ?? 8000;
    this.compressionKeepRecentRounds = compression.keepRecentRounds ?? 3;
    this.compressionKeepRecentMessages = compression.keepRecentMessages ?? 10;
    this.autoRetryOnLength = compression.autoRetryOnLength ?? true;
    this.enableCompressionTool = compression.enableTool ?? true;
  }

  /**
   * 执行任务（ReAct 循环）
   */
  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      // 触发开始事件
      this.emit('task:start', task);
      
      // 初始化对话历史
      // 如果 task.parameters.continueConversation 为 true，则保持现有历史
      const continueConversation = task.parameters?.continueConversation === true;
      
      if (!continueConversation || this.conversationHistory.length === 0) {
        // 重置对话历史
        this.conversationHistory = [
          {
            role: 'user',
            content: this.formatTaskAsPrompt(task),
          },
        ];
      } else {
        // 继续现有对话，追加新任务
        this.conversationHistory.push({
          role: 'user',
          content: this.formatTaskAsPrompt(task),
        });
      }
      
      // ReAct 循环
      let finalAnswer: string | undefined;
      const steps: ReActStep[] = [];
      
      for (let i = 0; i < this.maxIterations; i++) {
        this.emit('react:iteration', { iteration: i, task });
        
        
        // 主动压缩检查：在调用 LLM 前检查是否需要压缩
        if (this.shouldProactivelyCompress()) {
          this.emit('context:proactive-compression-triggered', {
            iteration: i,
            messageCount: this.conversationHistory.length,
            threshold: this.compressionMaxMessages,
          });
          await this.compressConversationHistory();
        }
        
        // 使用 LLM 进行推理和决策
        let response;
        try {
          // 调试：输出消息历史（仅在开发模式）
          if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MESSAGES === 'true') {
            console.log('\n🔍 [DEBUG] 发送给 LLM 的消息历史:');
            console.log(JSON.stringify(this.conversationHistory, null, 2));
          }
          
          // 注意：getAllToolDefinitions() 返回的工具不包含 execute 函数
          // 这样 AI SDK 只会返回工具调用信息，不会自动执行
          response = await this.llm.chat(this.conversationHistory, {
            system: this.systemPrompt,
            tools: this.getAllToolDefinitions(),
            toolChoice: 'auto',
          });
        } catch (error) {
          // LLM 调用失败
          const errorMsg = error instanceof Error ? error.message : 'Unknown LLM error';
          
          // 检查是否是上下文长度错误
          const isCtxLengthError = isContextLengthError(errorMsg);
          
          if (isCtxLengthError && this.enableCompression && this.autoRetryOnLength) {
            // 上下文过长，尝试压缩并重试
            this.emit('context:length-error-detected', {
              iteration: i,
              error: errorMsg,
              historyLength: this.conversationHistory.length,
            });
            
            await this.compressConversationHistory();
            
            this.emit('context:retrying-after-compression', {
              iteration: i,
              newHistoryLength: this.conversationHistory.length,
            });
            
            // 重试 LLM 调用
            try {
              response = await this.llm.chat(this.conversationHistory, {
                system: this.systemPrompt,
                tools: this.getAllToolDefinitions(),
                toolChoice: 'auto',
              });
            } catch (retryError) {
              const retryErrorMsg = retryError instanceof Error ? retryError.message : 'Unknown LLM error';
              this.emit('react:error', {
                iteration: i,
                error: `Retry after compression failed: ${retryErrorMsg}`,
                errorDetails: retryError,
              });
              throw retryError;
            }
          } else {
            // 其他错误，直接抛出
            this.emit('react:error', {
              iteration: i,
              error: errorMsg,
              errorDetails: error,
            });
            throw error;
          }
        }
        
        
        // 注意：finishReason === 'length' 通常表示输出被截断，不是输入过长
        // 输入过长时 LLM API 会抛出错误，已在上面的 catch 块中处理
        
        // 记录思考过程
        const step: ReActStep = {
          thought: response.text,
        };
        
        // 如果有工具调用，执行并收集结果
        if (response.toolCalls && response.toolCalls.length > 0) {
          // 构建助手消息（包含 tool-call）
          // 注意：必须手动构建，因为 response.content 可能包含错误的 args 结构
          const simplifiedToolCalls = response.toolCalls.map(tc => ({
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            input: tc.input,
          }));
          
          // 构建助手消息，包含文本（如果有）和工具调用
          const assistantMessage = this.llm.buildAssistantMessage(
            simplifiedToolCalls,
            response.text // 传入文本内容（推理/思考过程）
          );
          
          this.conversationHistory.push(assistantMessage);
          
          // 执行所有工具调用，收集结果
          const toolResults: any[] = [];
          for (const toolCall of response.toolCalls) {
            step.action = toolCall.toolName;
            step.actionInput = toolCall.input;
            
            this.emit('react:action', { 
              action: toolCall.toolName, 
              input: toolCall.input 
            });
            
            try {
              let toolResult: any;
              
              // 特殊处理：compressContext 工具
              if (toolCall.toolName === 'compressContext') {
                this.emit('context:tool-triggered', {
                  iteration: i,
                  input: toolCall.input,
                });
                
                try {
                  // 支持手动指定 keepRounds，否则使用自动策略
                  const keepRounds = toolCall.input?.keepRecentRounds;
                  const options = keepRounds ? { keepRounds } : undefined;
                  
                  const lengthBefore = this.conversationHistory.length;
                  await this.compressConversationHistory(options);
                  const lengthAfter = this.conversationHistory.length;
                  
                  toolResult = {
                    success: true,
                    message: '对话历史已压缩',
                    originalLength: lengthBefore,
                    newLength: lengthAfter,
                    summary: this.compressionSummary,
                  };
                } catch (error) {
                  const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                  toolResult = {
                    success: false,
                    message: '压缩失败',
                    error: errorMsg,
                    reason: errorMsg.includes('Not enough') ? '消息数量不足，无需压缩' : '压缩过程中出现错误',
                  };
                }
              } else {
                // 手动执行工具（Agent 完全控制执行流程）
                // 工具定义中不包含 execute 函数，所以 AI SDK 不会自动执行
                toolResult = await this.executeToolCall(
                  toolCall.toolName, 
                  toolCall.input
                );
              }
              
              step.observation = JSON.stringify(toolResult);
              
              this.emit('react:observation', { 
                action: toolCall.toolName, 
                result: toolResult 
              });
              
              // 收集工具结果（稍后统一添加到对话历史）
              toolResults.push({
                toolCall,
                result: toolResult,
                isError: false,
              });
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              step.observation = `Error: ${errorMsg}`;
              
              this.emit('react:error', { 
                action: toolCall.toolName, 
                error: errorMsg 
              });
              
              // 收集错误结果
              toolResults.push({
                toolCall,
                result: { error: errorMsg },
                isError: true,
              });
            }
          }
          
          // 将所有工具结果合并到一条消息中
          // 这符合 Claude/Anthropic API 的要求
          if (toolResults.length > 0) {
            const toolResultMessage: ModelMessage = {
              role: 'tool',
              content: toolResults.map(({ toolCall, result, isError }) => {
                // 使用 buildToolResultMessage 构建每个结果部分
                const msg = this.llm.buildToolResultMessage(toolCall, result, isError);
                return msg.content[0]; // 提取 tool-result 部分
              }) as any,
            };
            this.conversationHistory.push(toolResultMessage);
          }
          
          steps.push(step);
          
          // 继续下一轮循环，让 LLM 根据工具结果继续推理
          continue;
        }
        
        // 没有工具调用，检查是否有有效的文本回复
        if (response.text && response.text.trim().length > 0) {
          // 有文本回复，说明得到了最终答案
          finalAnswer = response.text;
          steps.push(step);
          
          // 添加最终回复到对话历史
          this.conversationHistory.push({
            role: 'assistant',
            content: response.text,
          });
          
          this.emit('react:final-answer', { answer: finalAnswer });
          break;
        }
        
        // 既没有工具调用，也没有文本回复，记录这个空步骤并继续
        steps.push(step);
        this.emit('react:warning', { 
          iteration: i, 
          message: 'LLM returned empty response with no tool calls',
          responseText: response.text,
          responseFinishReason: response.finishReason,
        });
      }
      
      // 构建结果
      const result: TaskResult = {
        success: true,
        data: {
          answer: finalAnswer,
          steps,
        },
        metadata: {
          taskId: task.id,
          iterations: steps.length,
          duration: Date.now() - startTime,
        },
        duration: Date.now() - startTime,
      };
      
      // 触发完成事件
      this.emit('task:complete', result);
      
      // 可选：反思
      if (this.enableReflection) {
        const reflection = await this.reflect(result);
        this.emit('task:reflect', reflection);
      }
      
      return result;
      
    } catch (error) {
      const result: TaskResult = {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
        metadata: {
          taskId: task.id,
          duration: Date.now() - startTime,
        },
        duration: Date.now() - startTime,
      };
      
      this.emit('task:error', result);
      return result;
    }
  }

  /**
   * 规划任务（使用 LLM 生成计划）
   */
  async plan(goal: Goal): Promise<Plan> {
    const planningPrompt = this.formatGoalAsPlanningPrompt(goal);
    
    const response = await this.llm.chat([
      {
        role: 'user',
        content: planningPrompt,
      },
    ], {
      system: `You are a planning assistant. Break down the goal into concrete steps.
Return the plan in JSON format:
{
  "steps": [
    {
      "description": "step description",
      "dependencies": ["previous_step_id"]
    }
  ]
}`,
    });
    
    try {
      const planData = JSON.parse(response.text);
      
      return {
        id: `plan-${Date.now()}`,
        goal,
        steps: planData.steps.map((step: any, index: number) => ({
          id: `step-${Date.now()}-${index}`,
          description: step.description,
          agentId: this.id,
          dependencies: step.dependencies,
        })),
      };
    } catch (error) {
      // 降级到默认实现
      return {
        id: `plan-${Date.now()}`,
        goal,
        steps: [
          {
            id: `step-${Date.now()}`,
            description: goal.description,
            agentId: this.id,
          },
        ],
      };
    }
  }

  /**
   * 反思执行结果（使用 LLM 生成反思）
   */
  async reflect(result: TaskResult): Promise<Reflection> {
    if (!this.enableReflection) {
      // 简单反思
      return {
        taskId: result.metadata?.taskId || 'unknown',
        success: result.success,
        learnings: result.success 
          ? ['Task completed successfully'] 
          : [`Task failed: ${result.error?.message}`],
        timestamp: new Date(),
      };
    }
    
    // 使用 LLM 进行深度反思
    const reflectionPrompt = `
Please reflect on the task execution:

Task ID: ${result.metadata?.taskId}
Success: ${result.success}
${result.error ? `Error: ${result.error.message}` : ''}
${result.data ? `Result: ${JSON.stringify(result.data, null, 2)}` : ''}

Provide:
1. Key learnings from this task
2. Potential improvements for future similar tasks

Return in JSON format:
{
  "learnings": ["learning 1", "learning 2"],
  "improvements": ["improvement 1", "improvement 2"]
}
`;
    
    try {
      const response = await this.llm.chat([
        {
          role: 'user',
          content: reflectionPrompt,
        },
      ]);
      
      const reflectionData = JSON.parse(response.text);
      
      return {
        taskId: result.metadata?.taskId || 'unknown',
        success: result.success,
        learnings: reflectionData.learnings || [],
        improvements: reflectionData.improvements || [],
        timestamp: new Date(),
      };
    } catch (error) {
      // 降级到简单反思
      return {
        taskId: result.metadata?.taskId || 'unknown',
        success: result.success,
        learnings: result.success 
          ? ['Task completed successfully'] 
          : [`Task failed: ${result.error?.message}`],
        timestamp: new Date(),
      };
    }
  }

  // ============ 抽象方法（子类实现） ============

  /**
   * 获取 Agent 可用的工具定义（不含 execute 函数）
   * 
   * 子类必须实现此方法，定义自己的工具。
   * 
   * 重要：工具定义中不应包含 execute 函数，这样 AI SDK 只会返回工具调用信息，
   * 不会自动执行工具。工具的实际执行由 executeToolCall() 方法处理。
   * 
   * @returns 工具定义集合（不含 execute 函数）
   * 
   * @example
   * ```typescript
   * protected getToolDefinitions(): ToolSet {
   *   return {
   *     searchWeb: tool({
   *       description: 'Search the web',
   *       parameters: z.object({
   *         query: z.string(),
   *       }),
   *       // 不提供 execute 函数
   *     }),
   *   };
   * }
   * ```
   */
  protected abstract getToolDefinitions(): ToolSet;

  /**
   * 获取所有工具定义（包括内置的压缩工具）
   * 
   * @returns 完整的工具集合
   */
  protected getAllToolDefinitions(): ToolSet {
    const userTools = this.getToolDefinitions();
    
    // 如果启用了压缩工具，添加到工具集合中
    if (this.enableCompressionTool && this.enableCompression) {
      return {
        ...userTools,
        compressContext: createCompressionTool(),
      };
    }
    
    return userTools;
  }

  /**
   * 执行工具调用（由 Agent 完全控制）
   * 
   * 子类必须实现此方法来处理工具执行逻辑。
   * 这个方法在 ReAct 循环中被调用，让 Agent 完全控制执行流程。
   * 
   * 架构优势：
   * 1. LLM Client 只负责通信，返回工具调用信息
   * 2. Agent 控制何时、如何执行工具
   * 3. 方便集成 MCP 工具（统一的执行接口）
   * 4. 支持执行前验证、缓存、重试等逻辑
   * 
   * @param toolName 工具名称
   * @param input 工具输入参数
   * @returns 工具执行结果
   * 
   * @example
   * ```typescript
   * protected async executeToolCall(toolName: string, input: any): Promise<any> {
   *   switch (toolName) {
   *     case 'searchWeb':
   *       // 可以在这里添加验证、缓存、重试等逻辑
   *       return await this.searchWebAPI(input.query);
   *     
   *     case 'mcpTool':
   *       // 可以无缝集成 MCP 工具
   *       return await this.mcpClient.callTool(toolName, input);
   *     
   *     default:
   *       throw new Error(`Unknown tool: ${toolName}`);
   *   }
   * }
   * ```
   */
  protected abstract executeToolCall(toolName: string, input: any): Promise<any>;

  // ============ 辅助方法 ============

  /**
   * 构建系统提示词
   */
  protected buildSystemPrompt(): string {
    return `You are ${this.name}, ${this.description}

Your capabilities include:
${this.capabilities.map(c => `- ${c}`).join('\n')}

When solving tasks, follow the ReAct (Reasoning + Acting) pattern:
1. Think: Analyze the task and decide what to do
2. Act: Use available tools to gather information or take actions
3. Observe: Analyze the results
4. Repeat until you have enough information to provide a final answer

Available tools will be provided in each conversation.
Use them wisely to accomplish the task.

IMPORTANT: After using tools and getting results, you MUST provide a final answer in natural language.
Do NOT just call tools and stop - always summarize the information and answer the user's question.`;
  }

  /**
   * 将任务格式化为提示词
   */
  protected formatTaskAsPrompt(task: Task): string {
    let prompt = `Task: ${task.description}\n\n`;
    
    if (Object.keys(task.parameters).length > 0) {
      prompt += `Parameters:\n${JSON.stringify(task.parameters, null, 2)}\n\n`;
    }
    
    if (task.context) {
      prompt += `Context:\n${JSON.stringify(task.context, null, 2)}\n\n`;
    }
    
    prompt += 'Please complete this task step by step.';
    
    return prompt;
  }

  /**
   * 将目标格式化为规划提示词
   */
  protected formatGoalAsPlanningPrompt(goal: Goal): string {
    let prompt = `Goal: ${goal.description}\n\n`;
    
    if (goal.constraints && goal.constraints.length > 0) {
      prompt += `Constraints:\n${goal.constraints.map(c => `- ${c}`).join('\n')}\n\n`;
    }
    
    if (goal.successCriteria && goal.successCriteria.length > 0) {
      prompt += `Success Criteria:\n${goal.successCriteria.map(c => `- ${c}`).join('\n')}\n\n`;
    }
    
    prompt += 'Please create a detailed plan to achieve this goal.';
    
    return prompt;
  }

  /**
   * 验证任务参数
   */
  protected validateTask(task: Task, requiredParams: string[]): void {
    for (const param of requiredParams) {
      if (!(param in task.parameters)) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }
  }

  /**
   * 创建任务结果
   */
  protected createResult(
    success: boolean,
    data?: any,
    error?: Error,
    metadata?: Record<string, any>
  ): TaskResult {
    return {
      success,
      data,
      error,
      metadata,
    };
  }

  /**
   * 获取对话历史
   */
  public getConversationHistory(): ModelMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * 清除对话历史
   */
  public clearConversationHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * 获取 LLM 客户端（用于高级用法）
   */
  public getLLMClient(): LLMClient {
    return this.llm;
  }

  // ============ 上下文压缩方法 ============

  /**
   * 压缩对话历史
   * 将早期消息总结成摘要，使用混合策略自动选择压缩方式
   * 
   * 重要：确保保留完整的消息轮次，避免破坏 toolUse/toolResult 的配对关系
   * 
   * @param options 可选，手动指定压缩选项（优先级高于自动策略）
   */
  protected async compressConversationHistory(options?: CompressionOptions): Promise<void> {
    // 如果没有手动指定选项，使用智能推荐
    let compressionOptions: CompressionOptions;
    
    if (options) {
      compressionOptions = options;
    } else {
      // 使用混合策略获取推荐选项
      const result = shouldCompress(this.conversationHistory, {
        maxMessages: this.compressionMaxMessages,
        maxTokens: this.compressionMaxTokens,
        keepRecentRounds: this.compressionKeepRecentRounds,
        keepRecentMessages: this.compressionKeepRecentMessages,
      });
      
      if (!result.recommendedOptions) {
        // 不应该到这里，因为调用前已经检查过 shouldCompress
        return;
      }
      
      compressionOptions = result.recommendedOptions;
      
      this.emit('context:compression-strategy', {
        reason: result.reason,
        options: compressionOptions,
      });
    }
    
    // if (this.conversationHistory.length <= 5) {
    //   this.emit('context:skip-compression', {
    //     reason: 'Not enough messages',
    //     totalMessages: this.conversationHistory.length,
    //     threshold: 5,
    //   });
    //   return;
    // }
    
    this.emit('context:compressing', {
      totalMessages: this.conversationHistory.length,
      compressionOptions,
    });
    
    try {
      // 使用压缩工具模块进行压缩
      const result = await compressHistory(
        this.conversationHistory,
        compressionOptions,
        this.llm
      );
      
      // 使用压缩函数返回的要保留的消息（已经过边界调整）
      // 这样确保不会破坏工具调用配对
      this.conversationHistory = buildCompressedHistory(result.summary, result.keptMessages);
      
      this.compressionSummary = result.summary;
      
      this.emit('context:compressed', {
        summary: result.summary,
        originalLength: result.originalLength,
        newHistoryLength: this.conversationHistory.length,
        compressedCount: result.compressedCount,
      });
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      // 如果是"消息不够"的错误，触发跳过事件
      if (
        error instanceof InsufficientMessagesError ||
        errorMsg.includes('Not enough') ||
        errorMsg.includes('Cannot compress')
      ) {
        this.emit('context:skip-compression', {
          reason: errorMsg,
          totalMessages: this.conversationHistory.length,
        });
        return;
      }
      
      // 其他错误，触发错误事件
      this.emit('context:compression-error', {
        error: errorMsg,
        errorDetails: error,
      });
      // 压缩失败，继续使用原历史
    }
  }

  /**
   * 检查是否需要主动压缩（混合策略）
   */
  protected shouldProactivelyCompress(): boolean {
    if (!this.enableCompression) {
      return false;
    }
    
    const result = shouldCompress(this.conversationHistory, {
      maxMessages: this.compressionMaxMessages,
      maxTokens: this.compressionMaxTokens,
      keepRecentRounds: this.compressionKeepRecentRounds,
      keepRecentMessages: this.compressionKeepRecentMessages,
    });
    
    return result.shouldCompress;
  }

  /**
   * 获取当前压缩摘要
   */
  public getCompressionSummary(): string | undefined {
    return this.compressionSummary;
  }
}
