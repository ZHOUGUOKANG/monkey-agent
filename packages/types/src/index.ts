/**
 * 核心类型定义
 */

// ============ Agent 核心接口 ============

export interface IAgent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  
  execute(task: Task): Promise<TaskResult>;
  plan(goal: Goal): Promise<Plan>;
  reflect(result: TaskResult): Promise<Reflection>;
}

// ============ Task 相关 ============

export interface Task {
  id: string;
  type: string;
  description: string;
  parameters: Record<string, any>;
  context?: Context;
  priority?: number;
  deadline?: Date;
}

export interface TaskResult {
  success: boolean;
  data?: any;
  error?: Error;
  metadata?: Record<string, any>;
  duration?: number;
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
  /** Agent 类型 */
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
  /** 预估执行时间（毫秒） */
  estimatedDuration?: number;
}

// ============ Goal & Plan ============

export interface Goal {
  id: string;
  description: string;
  constraints?: string[];
  successCriteria?: string[];
}

export interface Plan {
  id: string;
  goal: Goal;
  steps: PlanStep[];
  estimatedDuration?: number;
}

export interface PlanStep {
  id: string;
  description: string;
  agentId: string;
  dependencies?: string[];
  parameters?: Record<string, any>;
}

// ============ Context ============

export interface Context {
  sessionId: string;
  userId?: string;
  environment: 'browser' | 'node';
  metadata?: Record<string, any>;
}

// ============ Reflection ============

export interface Reflection {
  taskId: string;
  success: boolean;
  learnings: string[];
  improvements?: string[];
  timestamp: Date;
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

// ============ Storage ============

export interface IStorage {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

// ============ Event Emitter ============

export interface IEventEmitter {
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

// ============ LLM 相关 ============

import type { ModelMessage, ToolSet, ToolChoice, StreamTextResult, GenerateTextResult } from 'ai';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
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
