import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createAzure } from '@ai-sdk/azure';
import { createVertex } from '@ai-sdk/google-vertex';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateText, streamText, wrapLanguageModel, embed, embedMany, cosineSimilarity } from 'ai';
import type { 
  ModelMessage, 
  ToolSet, 
  StreamTextResult, 
  LanguageModel, 
  GenerateTextResult,
  EmbeddingModel
} from 'ai';
import { 
  LLMProvider, 
  LLMConfig, 
  LLMCallOptions, 
  ReasoningConfig,
  EmbeddingOptions,
  EmbedManyOptions,
  EmbedResult,
  EmbedManyResult
} from '@monkey-agent/types';
import { ReasoningConfigBuilder } from './ReasoningConfigBuilder';
import { 
  DEFAULT_MODELS, 
  CONFIG_LIMITS, 
  SUPPORTED_PROVIDERS, 
  PROVIDERS_WITHOUT_API_KEY,
  resolveModelAlias 
} from './constants';

/**
 * LLM 客户端
 * 统一的 LLM 调用接口（使用 Vercel AI SDK）
 * 
 * 设计原则：
 * 1. 专注于 LLM 调用，不处理工具执行逻辑
 * 2. 提供完整的 tool call 事件，由调用者决定如何处理
 * 3. 提供辅助方法简化常见操作
 * 4. 统一的推理配置接口
 * 
 * @see README.md 查看详细使用文档
 */
export class LLMClient implements LLMProvider {
  private languageModel: LanguageModel;
  private temperature?: number;
  private maxOutputTokens?: number;
  private reasoningConfig?: ReasoningConfig;
  
  // 存储 provider 和 config，用于创建 embedding model
  private provider?: string;
  private providerConfig?: any;

  constructor(config: LLMConfig) {
    // 验证配置
    this.validateConfig(config);
    
    this.temperature = config.temperature;
    this.maxOutputTokens = config.maxTokens;
    this.reasoningConfig = config.reasoning;
    
    // 保存 provider 信息用于 embedding
    this.provider = config.provider ?? 'openai';
    
    // 优先使用传入的 languageModel，否则创建新的
    const baseModel = config.languageModel ?? this.createLanguageModel(config);
    
    // 应用推理配置
    this.languageModel = this.applyReasoningConfig(baseModel, this.reasoningConfig);
  }

  /**
   * 验证 LLM 配置
   * 
   * @param config LLM 配置
   * @throws Error 如果配置无效
   */
  private validateConfig(config: LLMConfig): void {
    // 验证 temperature 范围
    if (config.temperature !== undefined) {
      const [min, max] = CONFIG_LIMITS.temperature;
      if (config.temperature < min || config.temperature > max) {
        throw new Error(
          `Invalid temperature: ${config.temperature}. Must be between ${min} and ${max}. ` +
          `Lower values make output more deterministic, higher values more random.`
        );
      }
    }
    
    // 验证 maxTokens 为正数
    if (config.maxTokens !== undefined) {
      if (config.maxTokens <= 0) {
        throw new Error(
          `Invalid maxTokens: ${config.maxTokens}. Must be a positive number.`
        );
      }
    }
    
    // 如果提供了 languageModel，不需要验证 provider 相关配置
    if (config.languageModel) {
      return;
    }
    
    const provider = config.provider ?? 'openai';
    
    // 验证 API key（部分提供商不需要）
    if (!PROVIDERS_WITHOUT_API_KEY.includes(provider as any) && !config.apiKey) {
      throw new Error(
        `API key is required for provider "${provider}". ` +
        `Please provide config.apiKey.`
      );
    }
    
    // 验证 Azure 特定配置
    if (provider === 'azure') {
      if (!config.resourceName) {
        throw new Error(
          `Azure OpenAI requires resourceName. ` +
          `Please provide config.resourceName (your Azure deployment name).`
        );
      }
    }
    
    // 验证 Bedrock 配置（至少需要 region 或完整的 AWS 凭证）
    if (provider === 'bedrock') {
      const hasCredentials = config.accessKeyId && config.secretAccessKey;
      if (!config.region && !hasCredentials) {
        throw new Error(
          `Amazon Bedrock requires either config.region or AWS credentials ` +
          `(config.accessKeyId and config.secretAccessKey). ` +
          `Alternatively, ensure AWS credentials are configured in your environment.`
        );
      }
    }
    
    // 验证 Vertex AI 配置
    if (provider === 'vertex') {
      if (!config.project) {
        throw new Error(
          `Google Vertex AI requires config.project (your Google Cloud project ID).`
        );
      }
    }
    
    // 验证推理配置
    if (config.reasoning) {
      this.validateReasoningConfig(config.reasoning);
    }
  }

  /**
   * 验证推理配置
   * 
   * @param reasoning 推理配置
   * @throws Error 如果配置无效
   */
  private validateReasoningConfig(reasoning: ReasoningConfig): void {
    // 验证 budgetTokens 范围（Bedrock Claude 限制）
    if (reasoning.budgetTokens !== undefined) {
      const [min, max] = CONFIG_LIMITS.bedrockBudgetTokens;
      if (reasoning.budgetTokens < min || reasoning.budgetTokens > max) {
        throw new Error(
          `Invalid budgetTokens: ${reasoning.budgetTokens}. ` +
          `For Amazon Bedrock Claude models, must be between ${min} and ${max}.`
        );
      }
    }
    
    // 验证 thinking 配置（Claude）
    if (reasoning.thinking !== undefined) {
      if (typeof reasoning.thinking === 'number' && reasoning.thinking <= 0) {
        throw new Error(
          `Invalid thinking budget: ${reasoning.thinking}. ` +
          `Must be a positive number.`
        );
      }
    }
    
    // 验证 thinkingBudget（Vertex Gemini）
    if (reasoning.thinkingBudget !== undefined && reasoning.thinkingBudget <= 0) {
      throw new Error(
        `Invalid thinkingBudget: ${reasoning.thinkingBudget}. ` +
        `Must be a positive number.`
      );
    }
  }

  /**
   * 应用推理配置到模型
   */
  private applyReasoningConfig(
    model: LanguageModel, 
    reasoning?: ReasoningConfig
  ): LanguageModel {
    // 使用 ReasoningConfigBuilder 构建 middleware
    const middleware = ReasoningConfigBuilder.buildMiddleware(reasoning);
    
    if (middleware) {
      // wrapLanguageModel 接受 LanguageModel 类型并返回相同类型
      return wrapLanguageModel({
        model: model as any, // 类型断言以避免内部类型不匹配
        middleware
      }) as LanguageModel;
    }
    
    // 其他推理配置通过 providerOptions 传递，不需要 middleware
    return model;
  }

  /**
   * 创建 LanguageModel 实例
   * 
   * @param config LLM 配置
   * @returns LanguageModel 实例
   * @throws Error 如果配置无效或提供商不支持
   */
  private createLanguageModel(config: LLMConfig): LanguageModel {
    const provider = config.provider ?? 'openai';
    // 解析模型别名并使用默认模型（如果未指定）
    const model = config.model 
      ? resolveModelAlias(config.model) 
      : this.getDefaultModel(provider);
    
    const providerConfig = {
      apiKey: config.apiKey,
      ...(config.baseURL && { baseURL: config.baseURL }),
    };
    
    // 保存 provider config 用于创建 embedding model
    this.providerConfig = { ...config, providerConfig };
    
    switch (provider) {
      case 'openai':
        const openai = createOpenAI(providerConfig);
        return openai(model);
      
      case 'anthropic':
        const anthropic = createAnthropic(providerConfig);
        return anthropic(model);
      
      case 'google':
        const google = createGoogleGenerativeAI(providerConfig);
        return google(model);
      
      case 'openrouter':
        const openrouter = createOpenRouter(providerConfig);
        return openrouter(model);
      
      case 'bedrock': {
        // Amazon Bedrock 使用 AWS 凭证而非 API key
        const bedrockConfig: any = {
          ...(config.region && { region: config.region }),
          ...(config.accessKeyId && { accessKeyId: config.accessKeyId }),
          ...(config.secretAccessKey && { secretAccessKey: config.secretAccessKey }),
          ...(config.sessionToken && { sessionToken: config.sessionToken }),
        };
        const bedrock = createAmazonBedrock(bedrockConfig);
        return bedrock(model);
      }
      
      case 'azure': {
        // Azure OpenAI 需要 resourceName 和 apiKey
        const azureConfig: any = {
          ...(config.resourceName && { resourceName: config.resourceName }),
          ...(config.apiKey && { apiKey: config.apiKey }),
          ...(config.baseURL && { baseURL: config.baseURL }),
        };
        const azure = createAzure(azureConfig);
        return azure(model);
      }
      
      case 'vertex': {
        // Google Vertex AI 使用 Google Cloud 认证
        const vertexConfig: any = {
          ...(config.project && { project: config.project }),
          ...(config.location && { location: config.location }),
          ...(config.googleAuthOptions && { googleAuthOptions: config.googleAuthOptions }),
        };
        const vertex = createVertex(vertexConfig);
        return vertex(model);
      }
      
      case 'deepseek':
        const deepseek = createDeepSeek(providerConfig);
        return deepseek(model);
      
      default:
        throw new Error(
          `Unsupported provider: "${provider}". ` +
          `Supported providers are: ${SUPPORTED_PROVIDERS.join(', ')}. ` +
          `Please check your config.provider value.`
        );
    }
  }

  /**
   * 获取默认模型名称
   * 
   * @param provider Provider 类型
   * @returns 默认模型名称
   */
  private getDefaultModel(provider: string): string {
    return DEFAULT_MODELS[provider] ?? DEFAULT_MODELS.openai;
  }

  /**
   * 从推理配置构建 providerOptions
   * 
   * 使用 ReasoningConfigBuilder 来处理不同提供商的推理配置
   * 
   * @param reasoning 推理配置
   * @returns Provider-specific options
   */
  private buildProviderOptions(reasoning?: ReasoningConfig): Record<string, any> {
    return ReasoningConfigBuilder.buildProviderOptions(reasoning);
  }

  /**
   * 构建 LLM 调用的配置对象
   * 
   * 统一的配置构建逻辑，用于 chat() 和 stream()。
   * 处理参数合并、推理配置转换等。
   * 
   * @param messages 对话消息列表
   * @param options 调用选项（可选）
   * @returns AI SDK 的配置对象
   * 
   * @example
   * ```typescript
   * const config = this.buildCallConfig(messages, {
   *   system: 'You are a helpful assistant',
   *   tools: { search: searchTool },
   *   reasoning: { effort: 'high' }
   * });
   * ```
   */
  private buildCallConfig<TOOLS extends ToolSet>(
    messages: ModelMessage[],
    options?: LLMCallOptions<TOOLS>
  ): any {
    // 合并推理配置（调用时配置优先）
    const reasoning = { ...this.reasoningConfig, ...options?.reasoning };
    
    // 从推理配置构建 providerOptions
    const reasoningProviderOptions = this.buildProviderOptions(reasoning);
    
    // 合并 providerOptions（显式传入的优先）
    const mergedProviderOptions = {
      ...reasoningProviderOptions,
      ...options?.providerOptions
    };
    
    // 构建配置对象，只在有值时传递参数
    return {
      model: this.languageModel,
      messages,
      // 基础参数
      ...(options?.system && { system: options.system }),
      ...(this.temperature !== undefined && { temperature: this.temperature }),
      ...(this.maxOutputTokens !== undefined && { maxOutputTokens: this.maxOutputTokens }),
      ...(options?.topP && { topP: options.topP }),
      ...(options?.topK && { topK: options.topK }),
      ...(options?.presencePenalty && { presencePenalty: options.presencePenalty }),
      ...(options?.frequencyPenalty && { frequencyPenalty: options.frequencyPenalty }),
      ...(options?.stopSequences && { stopSequences: options.stopSequences }),
      ...(options?.seed && { seed: options.seed }),
      ...(options?.maxRetries !== undefined && { maxRetries: options.maxRetries }),
      // 工具相关
      ...(options?.tools && { tools: options.tools }),
      ...(options?.toolChoice && { toolChoice: options.toolChoice }),
      ...(options?.activeTools && { activeTools: options.activeTools }),
      ...(options?.stopWhen && { stopWhen: options.stopWhen }),
      ...(options?.maxSteps !== undefined && { maxSteps: options.maxSteps }),
      // 高级参数
      ...(options?.abortSignal && { abortSignal: options.abortSignal }),
      ...(options?.headers && { headers: options.headers }),
      ...(Object.keys(mergedProviderOptions).length > 0 && { providerOptions: mergedProviderOptions }),
      ...(options?.experimental_telemetry && { experimental_telemetry: options.experimental_telemetry }),
      ...(options?.prepareStep && { prepareStep: options.prepareStep }),
      ...(options?.experimental_context !== undefined && { experimental_context: options.experimental_context }),
      ...(options?.experimental_download && { experimental_download: options.experimental_download }),
      ...(options?.experimental_repairToolCall && { experimental_repairToolCall: options.experimental_repairToolCall }),
      ...(options?.experimental_output !== undefined && { experimental_output: options.experimental_output }),
      ...(options?.onStepFinish && { onStepFinish: options.onStepFinish }),
    };
  }

  /**
   * 普通对话（非流式）
   * 
   * 发送消息并等待完整响应。支持工具调用、推理配置等高级功能。
   * 
   * @param messages 消息列表
   * @param options 调用选项（可选）
   * @returns GenerateTextResult - 包含响应文本、工具调用、使用统计等
   * 
   * @example
   * ```typescript
   * // 简单对话
   * const result = await client.chat([
   *   { role: 'user', content: 'Hello!' }
   * ]);
   * console.log(result.text);
   * 
   * // 使用工具
   * const result = await client.chat(messages, {
   *   tools: { getWeather: weatherTool },
   *   toolChoice: 'auto'
   * });
   * 
   * // 启用推理
   * const result = await client.chat(messages, {
   *   reasoning: { effort: 'high' }
   * });
   * ```
   */
  async chat<TOOLS extends ToolSet = ToolSet>(
    messages: ModelMessage[], 
    options?: LLMCallOptions<TOOLS>
  ): Promise<GenerateTextResult<TOOLS, any>> {
    const config = this.buildCallConfig(messages, options);
    return await generateText(config);
  }

  /**
   * 流式对话（标准方法）
   * 
   * 返回完整的 StreamTextResult 对象，提供多种使用方式：
   * - `textStream`: AsyncIterable<string> - 纯文本流
   * - `fullStream`: AsyncIterable<TextStreamPart> - 完整事件流（包括工具调用、推理等）
   * - `text`: Promise<string> - 等待完整文本
   * - `usage`: Promise<LanguageModelUsage> - 等待 token 使用统计
   * 
   * @param messages 消息列表
   * @param options 调用选项（可选）
   * @returns StreamTextResult 对象
   * 
   * @example
   * ```typescript
   * // 使用 textStream（推荐）
   * const result = client.stream(messages);
   * for await (const chunk of result.textStream) {
   *   process.stdout.write(chunk);
   * }
   * 
   * // 使用 fullStream（高级）
   * for await (const part of result.fullStream) {
   *   if (part.type === 'text-delta') {
   *     console.log(part.textDelta);
   *   } else if (part.type === 'tool-call') {
   *     console.log('Tool:', part.toolName);
   *   }
   * }
   * 
   * // 等待完整结果
   * const text = await result.text;
   * const usage = await result.usage;
   * ```
   */
  stream<TOOLS extends ToolSet = ToolSet>(
    messages: ModelMessage[], 
    options?: LLMCallOptions<TOOLS>
  ): StreamTextResult<TOOLS, any> {
    const config = this.buildCallConfig(messages, options);
    return streamText(config);
  }

  /**
   * 便捷方法：直接迭代文本流
   * 
   * 最简单的流式用法，只返回文本内容。
   * 适合不需要工具调用、事件处理等高级功能的简单场景。
   * 
   * @param messages 消息列表
   * @param options 调用选项（可选）
   * @returns 文本流迭代器
   * 
   * @example
   * ```typescript
   * // 简单的流式输出
   * for await (const chunk of client.streamText(messages)) {
   *   process.stdout.write(chunk);
   * }
   * 
   * // 收集所有文本
   * let fullText = '';
   * for await (const chunk of client.streamText(messages)) {
   *   fullText += chunk;
   * }
   * console.log(fullText);
   * ```
   */
  async *streamText<TOOLS extends ToolSet = ToolSet>(
    messages: ModelMessage[], 
    options?: LLMCallOptions<TOOLS>
  ): AsyncIterableIterator<string> {
    const result = this.stream(messages, options);
    for await (const text of result.textStream) {
      yield text;
    }
  }

  // ============ 辅助方法 ============

  /**
   * 构建助手消息（包含文本和工具调用）
   * 
   * 用于在工具调用后构建助手消息，方便添加到对话历史。
   * 
   * 注意：
   * - AI SDK 5.x 的 tool-call content 包含 input 字段（不是 args）
   * - 当 LLM 同时返回文本和工具调用时，必须将文本部分也包含在助手消息中。
   * 
   * @param toolCalls 工具调用列表
   * @param text 可选的文本内容（推理/思考过程）
   * @returns 助手消息
   */
  buildAssistantMessage(
    toolCalls: Array<{ toolCallId: string; toolName: string; input?: any }>,
    text?: string
  ): ModelMessage {
    // 构建 content 数组
    type TextContent = { type: 'text'; text: string };
    type ToolCallContent = { 
      type: 'tool-call'; 
      toolCallId: string; 
      toolName: string; 
      input: Record<string, any> 
    };
    
    const content: Array<TextContent | ToolCallContent> = [];
    
    // 如果有文本内容，先添加文本部分
    if (text && text.trim().length > 0) {
      content.push({
        type: 'text',
        text: text.trim(),
      });
    }
    
    // 添加工具调用部分
    // 注意：AI SDK 5.x 使用 input 字段，不是 args
    content.push(...toolCalls.map(tc => ({
      type: 'tool-call' as const,
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      // 确保 input 始终是一个对象（即使为空）
      // 这对于某些提供商（如 LiteLLM/OpenRouter）是必需的
      input: tc.input ?? {},
    })));
    
    return {
      role: 'assistant',
      content,
    } as ModelMessage;
  }

  /**
   * 构建工具结果消息
   * 
   * 简化工具执行结果的消息构建
   * 
   * @param toolCall 工具调用信息
   * @param result 工具执行结果
   * @param isError 是否为错误结果
   * @returns 工具结果消息
   */
  buildToolResultMessage(
    toolCall: { toolCallId: string; toolName: string },
    result: any,
    isError: boolean = false
  ): ModelMessage {
    // AI SDK 5.x 要求 tool-result 的 output 必须是包含 type 和 value 字段的对象
    // 注意：使用 value 字段，不是 text
    type ToolOutput = { type: string; value: string };
    
    let output: ToolOutput;
    if (typeof result === 'string') {
      output = { type: 'text', value: result };
    } else if (result && typeof result === 'object') {
      // 如果已经有 type 和 value 字段，直接使用
      if ('type' in result && 'value' in result) {
        output = result as ToolOutput;
      } else {
        // 否则包装成 text 类型，使用 JSON 字符串
        output = { type: 'text', value: JSON.stringify(result) };
      }
    } else {
      // 其他类型（number, boolean等），转换为 text
      output = { type: 'text', value: String(result) };
    }
    
    type ToolResultContent = {
      type: 'tool-result';
      toolCallId: string;
      toolName: string;
      output: ToolOutput;
      isError?: boolean;
    };
    
    const content: ToolResultContent = {
      type: 'tool-result',
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      output,
      ...(isError && { isError: true }),
    };
    
    return {
      role: 'tool',
      content: [content],
    } as ModelMessage;
  }

  // ============ Embedding 方法 ============

  /**
   * 创建 EmbeddingModel 实例
   * 
   * @param modelName embedding 模型名称（可选）
   * @returns EmbeddingModel 实例
   * @throws Error 如果提供商不支持 embedding
   */
  private createEmbeddingModel(modelName?: string): EmbeddingModel<string> {
    if (!this.providerConfig) {
      throw new Error('Cannot create embedding model: provider config not initialized');
    }

    const provider = this.provider ?? 'openai';
    const config = this.providerConfig;
    
    // 默认 embedding 模型
    const DEFAULT_EMBEDDING_MODELS: Record<string, string> = {
      openai: 'text-embedding-3-small',
      google: 'text-embedding-004',
      bedrock: 'amazon.titan-embed-text-v1',
      azure: 'text-embedding-3-small',
      vertex: 'text-embedding-004',
    };

    const model = modelName ?? DEFAULT_EMBEDDING_MODELS[provider];
    
    if (!model) {
      throw new Error(
        `Provider "${provider}" does not have a default embedding model configured. ` +
        `Please specify a model name explicitly.`
      );
    }

    switch (provider) {
      case 'openai': {
        const openai = createOpenAI(config.providerConfig);
        return openai.textEmbeddingModel(model);
      }
      
      case 'google': {
        const google = createGoogleGenerativeAI(config.providerConfig);
        return google.textEmbeddingModel(model);
      }
      
      case 'bedrock': {
        const bedrockConfig = {
          ...(config.region && { region: config.region }),
          ...(config.accessKeyId && { accessKeyId: config.accessKeyId }),
          ...(config.secretAccessKey && { secretAccessKey: config.secretAccessKey }),
          ...(config.sessionToken && { sessionToken: config.sessionToken }),
        };
        const bedrock = createAmazonBedrock(bedrockConfig);
        return bedrock.textEmbeddingModel(model);
      }
      
      case 'azure': {
        const azureConfig = {
          ...(config.resourceName && { resourceName: config.resourceName }),
          ...(config.apiKey && { apiKey: config.apiKey }),
          ...(config.baseURL && { baseURL: config.baseURL }),
        };
        const azure = createAzure(azureConfig);
        return azure.textEmbeddingModel(model);
      }
      
      case 'vertex': {
        const vertexConfig = {
          ...(config.project && { project: config.project }),
          ...(config.location && { location: config.location }),
          ...(config.googleAuthOptions && { googleAuthOptions: config.googleAuthOptions }),
        };
        const vertex = createVertex(vertexConfig);
        return vertex.textEmbeddingModel(model);
      }
      
      default:
        throw new Error(
          `Provider "${provider}" does not support embeddings. ` +
          `Supported providers: openai, google, bedrock, azure, vertex`
        );
    }
  }

  /**
   * 生成单个文本的 embedding
   * 
   * @param value 要生成 embedding 的文本
   * @param options 调用选项（可选）
   * @returns Embedding 结果
   * 
   * @example
   * ```typescript
   * const result = await client.embed('sunny day at the beach');
   * console.log(result.embedding); // [0.1, 0.2, ...]
   * console.log(result.usage.tokens); // 6
   * ```
   */
  async embed(
    value: string,
    options?: EmbeddingOptions & { model?: string }
  ): Promise<EmbedResult<string>> {
    const embeddingModel = this.createEmbeddingModel(options?.model);
    
    const result = await embed({
      model: embeddingModel,
      value,
      ...(options?.maxRetries !== undefined && { maxRetries: options.maxRetries }),
      ...(options?.abortSignal && { abortSignal: options.abortSignal }),
      ...(options?.headers && { headers: options.headers }),
      ...(options?.providerOptions && { providerOptions: options.providerOptions }),
    });

    return {
      embedding: result.embedding,
      usage: result.usage,
      value,
      ...(result.response && { response: result.response }),
    };
  }

  /**
   * 批量生成 embeddings
   * 
   * @param values 要生成 embedding 的文本数组
   * @param options 调用选项（可选）
   * @returns 批量 Embedding 结果
   * 
   * @example
   * ```typescript
   * const result = await client.embedMany([
   *   'sunny day at the beach',
   *   'rainy afternoon in the city'
   * ]);
   * console.log(result.embeddings); // [[0.1, ...], [0.2, ...]]
   * console.log(result.usage.tokens); // 12
   * ```
   */
  async embedMany(
    values: string[],
    options?: EmbedManyOptions & { model?: string }
  ): Promise<EmbedManyResult<string>> {
    const embeddingModel = this.createEmbeddingModel(options?.model);
    
    const result = await embedMany({
      model: embeddingModel,
      values,
      ...(options?.maxParallelCalls !== undefined && { maxParallelCalls: options.maxParallelCalls }),
      ...(options?.maxRetries !== undefined && { maxRetries: options.maxRetries }),
      ...(options?.abortSignal && { abortSignal: options.abortSignal }),
      ...(options?.headers && { headers: options.headers }),
      ...(options?.providerOptions && { providerOptions: options.providerOptions }),
    });

    return {
      embeddings: result.embeddings,
      usage: result.usage,
      values,
      ...(result.responses && { response: result.responses[0] }),
    };
  }

  /**
   * 计算两个 embedding 向量的余弦相似度
   * 
   * @param embedding1 第一个 embedding 向量
   * @param embedding2 第二个 embedding 向量
   * @returns 相似度分数（-1 到 1 之间，越接近 1 越相似）
   * 
   * @example
   * ```typescript
   * const result1 = await client.embed('sunny day');
   * const result2 = await client.embed('rainy day');
   * const similarity = client.cosineSimilarity(
   *   result1.embedding,
   *   result2.embedding
   * );
   * console.log(similarity); // 0.85
   * ```
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    return cosineSimilarity(embedding1, embedding2);
  }
}
