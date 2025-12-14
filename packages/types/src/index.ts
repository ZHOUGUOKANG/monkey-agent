/**
 * 核心类型定义
 */

// ============ Event Emitter ============

export interface IEventEmitter {
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

// ============ Agent 核心接口（重构版）============

/**
 * Agent 信息（用于工作流生成和展示）
 */
export interface AgentInfo {
  /** Agent 类型（如 'browser', 'code', 'file' 等） */
  type: string;
  /** Agent 描述 */
  description: string;
  /** Agent 能力列表 */
  capabilities: string[];
  /** 可选：Agent 可用的工具列表 */
  tools?: string[];
}

/**
 * Agent 核心接口
 * 重构后只保留必需的方法
 */
export interface IAgent extends IEventEmitter {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  
  /**
   * 执行任务
   * 
   * @param task 任务描述（可选，默认使用 agent 描述）
   * @param context 执行上下文（可选，自动创建）
   * @param options 执行选项
   * 
   * 使用场景：
   * 1. 简单独立执行: execute('打开百度')
   * 2. 结构化执行: execute('任务', null, { agentNode: { steps: [...] } })
   * 3. Workflow调度: execute(task, context, { agentNode: fullNode })
   * 
   * @returns 执行结果
   */
  execute(task?: string, context?: AgentContext, options?: any): Promise<AgentExecutionResult>;
  
  /**
   * 获取 Agent 的工具定义（可选）
   * 用于 ChatAgent 生成 workflow 时提供更详细的能力描述
   */
  getToolDefinitions?(): Record<string, any>;
}

/**
 * Agent 执行结果
 */
export interface AgentExecutionResult {
  agentId: string;
  data: any;
  summary: string;
  status: 'success' | 'failed';
  error?: Error;
  duration?: number;
  iterations?: number;  // 实际执行的迭代次数
}

/**
 * Agent 执行上下文（WorkflowOrchestrator 提供）
 */
export interface AgentContext {
  workflowId: string;
  workflowTask: string;
  outputs: Map<string, AgentExecutionResult>;  // 其他节点的输出
  vals: Map<string, any>;  // 共享变量
  workflowContext?: any;   // Workflow 级别的上下文（如 tabId）
  currentLevel: number;
  status: 'running' | 'completed' | 'failed';
  startTime: number;
  
  // 辅助方法
  getOutput(agentId: string): AgentExecutionResult | undefined;
  getValue(key: string): any;
  setValue(key: string, value: any): void;
  toJSON(): any;
}

// ============ Workflow 相关 ============

/**
 * Agent 节点步骤
 */
export interface AgentNodeStep {
  /** 全局步骤编号（跨所有 Agent 的唯一编号） */
  stepNumber: number;
  /** 步骤描述 - 为 Agent 提供执行指导 */
  desc: string;
}

/**
 * Agent 节点（工作流 DAG 中的节点）
 */
export interface AgentNode {
  /** Agent ID */
  id: string;
  /**
   * Agent 标识符（agent ID 或 name）
   * 用于在 WorkflowExecutor 中查找对应的 Agent 实例
   * 
   * 注意：虽然字段名是 'type'，但它存储的是 agent 的标识符（ID 或 name），
   * 而不是传统意义上的"类型"概念。这样设计是为了向后兼容。
   * 
   * @example 'browser-agent' | 'code-agent' | 'Browser Agent'
   */
  type: string;
  /** Agent 名称 */
  name: string;
  /** Agent 描述 - 描述 Agent 的职责和目标，为 Agent 提供执行指导 */
  desc: string;
  /** 带全局编号的步骤 */
  steps: AgentNodeStep[];
  /** 依赖的其他 Agent ID 列表 */
  dependencies: string[];
}

/**
 * 工作流定义（DAG 版本）
 */
export interface Workflow {
  /** 工作流 ID */
  id: string;
  /** 工作流名称 */
  name: string;
  /** 工作流描述 */
  description: string;
  /** Agent DAG - 节点之间通过 dependencies 建立关系 */
  agentGraph: AgentNode[];
  /** Workflow 上下文（如 pageInfo、tabId 等） */
  context?: any;
  /** 预估执行时间（毫秒） */
  estimatedDuration?: number;
}

/**
 * Workflow 执行选项
 */
export interface WorkflowExecutionOptions {
  timeout?: number;
  continueOnError?: boolean;
  maxRetries?: number;
  maxConcurrency?: number;
  errorHandler?: any;
}

/**
 * Workflow 执行结果
 */
export interface WorkflowExecutionResult {
  workflowId: string;
  status: 'completed' | 'failed' | 'partial';
  context: any;
  agentStates: Map<string, AgentExecutionState>;
  duration: number;
  successCount: number;
  failureCount: number;
  metrics?: ExecutionMetrics;
}

/**
 * Agent 执行状态
 */
export interface AgentExecutionState {
  agentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: number;
  endTime?: number;
  duration?: number;
  result?: AgentExecutionResult;
  error?: Error;
  retryCount: number;
}

/**
 * 执行指标
 */
export interface ExecutionMetrics {
  totalAgents: number;
  totalSteps: number;
  parallelLevels: number;
  averageAgentDuration: number;
  peakMemoryUsage?: number;
  events: ExecutionEvent[];
}

/**
 * 执行事件
 */
export interface ExecutionEvent {
  type: 'workflow:start' | 'workflow:complete' | 'workflow:error' |
        'level:start' | 'level:complete' |
        'agent:start' | 'agent:complete' | 'agent:error' | 'agent:retry' |
        'state:update';
  timestamp: number;
  data: any;
}

// ============ Memory ============

export interface Memory {
  id: string;
  type: 'short-term' | 'long-term' | 'working' | 'semantic';
  content: any;
  embedding?: Float32Array;
  metadata?: Record<string, any>;
  createdAt: Date;
  accessCount?: number;
}

// ============ LLM 相关 ============

import type { ModelMessage, ToolSet, ToolChoice, StreamTextResult, GenerateTextResult, LanguageModelUsage } from 'ai';

// ============ 跨环境 LLM 客户端接口 ============

/**
 * 工具调用信息（简化版本，兼容 AI SDK）
 */
export interface IToolCall {
  toolCallId: string;
  toolName: string;
  input: any;
}

/**
 * 对话结果（兼容 AI SDK 的 GenerateTextResult）
 */
export interface IChatResult {
  text: string;
  toolCalls?: Array<{ toolCallId: string; toolName: string; [key: string]: any }>;
  usage?: LanguageModelUsage;  // 使用 AI SDK 的类型
  finishReason?: string;
}

/**
 * LLM 客户端统一接口
 * 
 * 设计理念：
 * - LLMClient（Node.js 版本）实现此接口
 * - BaseAgent 依赖此接口，而非具体实现
 * - 直接使用 AI SDK 的 ModelMessage 类型
 * - 支持工具调用，但不自动执行（与当前设计一致）
 * 
 * @example
 * ```typescript
 * // Node.js 环境
 * import { LLMClient } from '@monkey-agent/llm';
 * import type { ModelMessage } from 'ai';
 * 
 * const llm: ILLMClient = new LLMClient({ ... });
 * const messages: ModelMessage[] = [{ role: 'user', content: 'Hello' }];
 * const result = await llm.chat(messages);
 * 
 * // BaseAgent 使用
 * const agent = new MyAgent({ llmClient: llm });
 * ```
 */
export interface ILLMClient {
  /**
   * 对话（支持工具调用，但不自动执行）
   * 
   * @param messages 消息列表（使用 AI SDK 的 ModelMessage 类型）
   * @param options 调用选项
   * @returns 对话结果（包含 text 和可选的 toolCalls）
   */
  chat<TOOLS extends Record<string, any> = Record<string, any>>(
    messages: ModelMessage[],
    options?: {
      system?: string;
      tools?: TOOLS;
      temperature?: number;
      maxTokens?: number;
      maxSteps?: number;
      [key: string]: any;
    }
  ): Promise<IChatResult>;

  /**
   * 流式对话（完整流，包含工具调用）
   * 
   * @param messages 消息列表（使用 AI SDK 的 ModelMessage 类型）
   * @param options 调用选项
   * @returns StreamTextResult 对象（来自 AI SDK）
   */
  stream<TOOLS extends Record<string, any> = Record<string, any>>(
    messages: ModelMessage[],
    options?: {
      system?: string;
      tools?: TOOLS;
      temperature?: number;
      maxTokens?: number;
      maxSteps?: number;
      [key: string]: any;
    }
  ): any; // 使用 any 避免直接依赖 AI SDK 的 StreamTextResult 类型

  /**
   * 流式对话（纯文本流）
   * 
   * @param messages 消息列表（使用 AI SDK 的 ModelMessage 类型）
   * @param options 调用选项
   * @returns 文本流迭代器
   */
  streamText(
    messages: ModelMessage[],
    options?: {
      system?: string;
      [key: string]: any;
    }
  ): AsyncIterableIterator<string>;
}

/**
 * LLM 调用选项（每次调用时传递）
 */
export interface LLMCallOptions<TOOLS extends ToolSet = ToolSet> {
  // ============ 基础参数 ============
  /** 系统提示词 */
  system?: string;
  /** Nucleus sampling (0-1)。建议只设置 temperature 或 topP 之一 */
  topP?: number;
  /** Top-K sampling。高级用例，通常只需要 temperature */
  topK?: number;
  /** 存在惩罚 (presence penalty)。影响模型重复已有信息的概率 */
  presencePenalty?: number;
  /** 频率惩罚 (frequency penalty)。影响模型重复使用相同词语的概率 */
  frequencyPenalty?: number;
  /** 停止序列。如果生成这些序列，将停止生成 */
  stopSequences?: string[];
  /** 随机种子。设置后可以生成确定性结果（如果模型支持） */
  seed?: number;
  /** 最大重试次数。设置为 0 禁用重试，默认 2 */
  maxRetries?: number;
  
  // ============ 工具相关 ============
  /** 可用的工具集 */
  tools?: TOOLS;
  /** 工具选择策略 */
  toolChoice?: ToolChoice<TOOLS>;
  /** 限制可用工具 */
  activeTools?: Array<keyof TOOLS>;
  /** 停止条件（当有工具结果时） */
  stopWhen?: any; // StopCondition from ai SDK
  /** 工具调用的最大步骤数。默认为 1，设置更大的值支持多轮工具调用 */
  maxSteps?: number;
  
  // ============ 高级参数 ============
  /** 中止信号 */
  abortSignal?: AbortSignal;
  /** 自定义请求头（仅 HTTP provider） */
  headers?: Record<string, string>;
  
  /**
   * 推理配置（调用时覆盖）
   * 会与 LLMConfig 中的 reasoning 配置合并，调用时的配置优先级更高
   * 
   * @example
   * ```typescript
   * // 提高推理努力
   * await client.chat(messages, {
   *   reasoning: { effort: 'high' }
   * });
   * 
   * // 临时禁用推理（节省 tokens）
   * await client.chat(messages, {
   *   reasoning: { disabled: true }
   * });
   * ```
   */
  reasoning?: ReasoningConfig;
  
  /** Provider 特定选项（高级用法，通常使用 reasoning 配置即可） */
  providerOptions?: Record<string, Record<string, any>>;
  /** 遥测配置（实验性功能） */
  experimental_telemetry?: {
    isEnabled?: boolean;
    recordInputs?: boolean;
    recordOutputs?: boolean;
    functionId?: string;
    metadata?: Record<string, string | number | boolean | Array<null | undefined | string | number | boolean>>;
  };
  /** 步骤准备函数。可以为每个步骤提供不同的设置 */
  prepareStep?: (options: any) => any;
  /** 传递到工具执行的上下文（实验性功能） */
  experimental_context?: unknown;
  /** 自定义下载函数。控制如何获取 URL（实验性功能） */
  experimental_download?: (requestedDownloads: Array<{ url: URL; isUrlSupportedByModel: boolean }>) => Promise<Array<null | { data: Uint8Array; mediaType?: string }>>;
  /** 尝试修复解析失败的工具调用（实验性功能） */
  experimental_repairToolCall?: (options: any) => Promise<any>;
  /** 生成结构化输出（实验性功能） */
  experimental_output?: any;
  /** 步骤完成回调 */
  onStepFinish?: (result: any) => Promise<void> | void;
}

/**
 * LLM 响应结果类型别名
 * 直接使用 AI SDK 的 GenerateTextResult，无需自定义包装
 */
export type LLMChatResult<TOOLS extends ToolSet = ToolSet> = GenerateTextResult<TOOLS, any>;

/**
 * LLM Provider 接口
 */
export interface LLMProvider {
  /**
   * 普通对话（等待完整响应）
   * 
   * @returns GenerateTextResult - AI SDK 原始结果，包含所有字段
   */
  chat<TOOLS extends ToolSet = ToolSet>(
    messages: ModelMessage[], 
    options?: LLMCallOptions<TOOLS>
  ): Promise<GenerateTextResult<TOOLS, any>>;
  
  /**
   * 流式对话（返回 StreamTextResult）
   * 
   * 返回完整的 StreamTextResult 对象，包含：
   * - textStream: 纯文本流
   * - fullStream: 完整事件流
   * - text/usage/finishReason: Promise 属性
   */
  stream<TOOLS extends ToolSet = ToolSet>(
    messages: ModelMessage[], 
    options?: LLMCallOptions<TOOLS>
  ): StreamTextResult<TOOLS, any>;
  
  /**
   * 便捷方法：直接迭代文本流
   */
  streamText<TOOLS extends ToolSet = ToolSet>(
    messages: ModelMessage[], 
    options?: LLMCallOptions<TOOLS>
  ): AsyncIterableIterator<string>;
}

// 导入 LanguageModel 类型
import type { LanguageModel } from 'ai';

/**
 * 推理配置（简化版）
 * 
 * 设计原则：
 * 1. 配置了推理参数就自动启用，无需显式 enabled: true
 * 2. 使用 disabled: true 临时禁用推理
 * 3. 每个字段对应一个模型特性，语义清晰
 * 
 * @example
 * ```typescript
 * // OpenAI o1 - 只需一个字段
 * { effort: 'high' }
 * 
 * // Claude - 简化为 thinking
 * { thinking: 5000 }  // budgetTokens
 * { thinking: true }  // 启用，自动决定 budget
 * 
 * // DeepSeek-R1 - 标签提取
 * { tagName: 'think' }
 * 
 * // Amazon Bedrock - Anthropic models
 * { budgetTokens: 12000 }
 * 
 * // Amazon Bedrock - Nova models
 * { maxReasoningEffort: 'medium' }
 * 
 * // Google Vertex - Gemini models
 * { includeThoughts: true, thinkingBudget: 2048 }
 * 
 * // 临时禁用
 * { disabled: true }
 * ```
 */
export interface ReasoningConfig {
  /**
   * 禁用推理（用于临时覆盖）
   * 
   * @example
   * ```typescript
   * // 客户端启用推理
   * const client = new LLMClient({ reasoning: { effort: 'high' } });
   * 
   * // 对于简单问题临时禁用
   * await client.chat(messages, { reasoning: { disabled: true } });
   * ```
   */
  disabled?: boolean;
  
  /**
   * 推理努力程度（OpenAI o1 系列）
   * 
   * 配置此字段自动启用推理
   * @example 'low' | 'medium' | 'high'
   */
  effort?: 'low' | 'medium' | 'high';
  
  /**
   * 推理思考配置（Claude Extended Thinking）
   * 
   * - `true`: 启用推理，模型自动决定预算
   * - `false`: 禁用推理（等同于 disabled: true）
   * - `number`: 指定推理预算 tokens
   * 
   * @example
   * ```typescript
   * { thinking: true }     // 自动模式
   * { thinking: false }    // 禁用
   * { thinking: 5000 }     // 指定 5000 tokens 预算
   * ```
   */
  thinking?: boolean | number;
  
  /**
   * 推理标签名（用于标签提取）
   * 
   * 适用于在输出中使用特定标签包裹推理内容的模型（如 DeepSeek-R1）
   * 配置此字段自动启用推理提取
   * 
   * @default 'think'
   * @example 'think' | 'reasoning' | 'thoughts'
   */
  tagName?: string;
  
  /**
   * 推理预算 tokens（Amazon Bedrock Anthropic models）
   * 
   * 适用于 Bedrock 上的 Claude 3.7 Sonnet 等支持推理的模型
   * 最小值：1024，最大值：64000
   * 
   * @example
   * ```typescript
   * { budgetTokens: 12000 }
   * ```
   */
  budgetTokens?: number;
  
  /**
   * 最大推理努力程度（Amazon Bedrock Nova models）
   * 
   * 适用于 Amazon Nova 系列模型
   * 
   * @example 'low' | 'medium' | 'high'
   */
  maxReasoningEffort?: 'low' | 'medium' | 'high';
  
  /**
   * 是否包含思考内容（Google Vertex Gemini models）
   * 
   * 启用后，模型的推理过程会被标记为 thought: true
   * 
   * @example
   * ```typescript
   * { includeThoughts: true }
   * ```
   */
  includeThoughts?: boolean;
  
  /**
   * 思考预算（Google Vertex Gemini models）
   * 
   * 可选，限制推理过程使用的 tokens 数量
   * 
   * @example
   * ```typescript
   * { includeThoughts: true, thinkingBudget: 2048 }
   * ```
   */
  thinkingBudget?: number;
}

/**
 * LLM 客户端配置（创建时传递）
 */
export interface LLMConfig {
  /** Provider 类型（用于自动创建 model 和默认值） */
  provider?: 'openai' | 'anthropic' | 'google' | 'openrouter' | 'bedrock' | 'azure' | 'vertex' | 'deepseek';
  /** API Key（当 languageModel 未提供时使用） */
  apiKey?: string;
  /** 模型名称（当 languageModel 未提供时使用） */
  model?: string;
  /** 温度参数 */
  temperature?: number;
  /** 最大输出 tokens */
  maxTokens?: number;
  /** 自定义 API 端点 */
  baseURL?: string;
  
  // ============ Amazon Bedrock 专用配置 ============
  /** AWS Region (Bedrock) */
  region?: string;
  /** AWS Access Key ID (Bedrock) */
  accessKeyId?: string;
  /** AWS Secret Access Key (Bedrock) */
  secretAccessKey?: string;
  /** AWS Session Token (Bedrock, optional) */
  sessionToken?: string;
  
  // ============ Azure OpenAI 专用配置 ============
  /** Azure Resource Name (Azure) */
  resourceName?: string;
  
  // ============ Google Vertex AI 专用配置 ============
  /** Google Cloud Project ID (Vertex) */
  project?: string;
  /** Google Cloud Location (Vertex) */
  location?: string;
  /** Google Auth Options (Vertex, for Node.js) */
  googleAuthOptions?: {
    authClient?: any;
    keyFilename?: string;
    keyFile?: string;
    credentials?: {
      client_email?: string;
      private_key?: string;
    };
    clientOptions?: any;
    scopes?: string | string[];
    projectId?: string;
    universeDomain?: string;
  };
  /** 
   * 直接传入 LanguageModel 实例（优先级最高）
   * 如果提供，将优先使用此实例，忽略 provider/apiKey/model/baseURL 参数
   * 
   * @example
   * ```typescript
   * import { createOpenAI } from '@ai-sdk/openai';
   * const openai = createOpenAI({ apiKey: 'sk-...' });
   * const config = {
   *   languageModel: openai('gpt-4'),
   * };
   * ```
   */
  languageModel?: LanguageModel;
  
  /**
   * 推理配置（统一入口）
   * 
   * **简化设计**：配置即启用，无需显式 enabled: true
   * 
   * @example
   * ```typescript
   * // OpenAI o1 - 只需一个字段
   * { reasoning: { effort: 'high' } }
   * 
   * // Claude Extended Thinking - 简化为 thinking
   * { reasoning: { thinking: 5000 } }  // 指定预算
   * { reasoning: { thinking: true } }   // 自动模式
   * 
   * // DeepSeek-R1 (标签提取)
   * { reasoning: { tagName: 'think' } }
   * 
   * // 临时禁用
   * { reasoning: { disabled: true } }
   * ```
   */
  reasoning?: ReasoningConfig;
  
}

// ============ Embedding 相关 ============

/**
 * Embedding 调用选项
 */
export interface EmbeddingOptions {
  /** Provider 特定选项 */
  providerOptions?: Record<string, Record<string, any>>;
  /** 最大重试次数。设置为 0 禁用重试，默认 2 */
  maxRetries?: number;
  /** 中止信号 */
  abortSignal?: AbortSignal;
  /** 自定义请求头（仅 HTTP provider） */
  headers?: Record<string, string>;
}

/**
 * EmbedMany 调用选项
 */
export interface EmbedManyOptions extends EmbeddingOptions {
  /** 最大并行请求数，默认不限制 */
  maxParallelCalls?: number;
}

/**
 * 单个 Embedding 结果
 */
export interface EmbedResult<VALUE> {
  /** Embedding 向量 */
  embedding: number[];
  /** Token 使用统计 */
  usage: {
    tokens: number;
  };
  /** 原始输入值 */
  value: VALUE;
  /** 原始 provider 响应（可选） */
  response?: {
    id?: string;
    model?: string;
    timestamp?: Date;
    headers?: Record<string, string>;
  };
}

/**
 * 批量 Embedding 结果
 */
export interface EmbedManyResult<VALUE> {
  /** Embedding 向量数组（与输入顺序一致） */
  embeddings: number[][];
  /** Token 使用统计 */
  usage: {
    tokens: number;
  };
  /** 原始输入值数组 */
  values: VALUE[];
  /** 原始 provider 响应（可选） */
  response?: {
    id?: string;
    model?: string;
    timestamp?: Date;
    headers?: Record<string, string>;
  };
}

// ============================================
// Agent Event System Types
// ============================================

/**
 * Agent 事件类型枚举
 */
export enum AgentEventType {
  // 状态事件
  START = 'agent:start',
  THINKING = 'agent:thinking',
  COMPLETE = 'agent:complete',
  ERROR = 'agent:error',
  
  // 流式事件
  STREAM_TEXT = 'agent:stream-text',
  STREAM_FINISH = 'agent:stream-finish',
  
  // 工具事件
  TOOL_CALL = 'agent:tool-call',
  TOOL_RESULT = 'agent:tool-result',
  TOOL_ERROR = 'agent:tool-error',
  
  // 其他
  COMPRESSED = 'agent:compressed',
  CONTEXT_LENGTH_ERROR = 'agent:context-length-error',
  WARNING = 'agent:warning',
  MAX_ITERATIONS = 'agent:max-iterations',
}

/**
 * ReactLoop 内部事件类型（仅供内部使用）
 * 这些事件由 ReactLoop 发射，由 BaseAgent 转换为 AgentEventType
 */
export enum ReactEventType {
  // ReAct 循环事件
  THINKING = 'react:thinking',
  ACTION = 'react:action',
  OBSERVATION = 'react:observation',
  OBSERVATION_ERROR = 'react:observation-error',
  
  // 流式事件
  STREAM_TEXT = 'react:stream-text',
  STREAM_FINISH = 'react:stream-finish',
  
  // 上下文管理
  COMPRESSED = 'react:compressed',
  CONTEXT_LENGTH_ERROR = 'react:context-length-error',
  
  // 其他
  WARNING = 'react:warning',
  MAX_ITERATIONS = 'react:max-iterations',
}
