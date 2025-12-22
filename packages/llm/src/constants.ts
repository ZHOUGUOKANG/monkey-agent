import type { ReasoningConfig } from '@monkey-agent/types';

/**
 * 默认模型配置
 * 
 * 每个提供商的推荐默认模型
 */
export const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20241022',
  google: 'gemini-1.5-pro',
  openrouter: 'openai/gpt-4o',
  bedrock: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  azure: 'gpt-4o',
  vertex: 'gemini-1.5-pro',
  deepseek: 'deepseek-chat',
} as const;

/**
 * 推理预设配置
 * 
 * 预定义的推理配置，适用于不同场景
 */
export const REASONING_PRESETS: Record<string, ReasoningConfig> = {
  /**
   * 禁用推理
   * 适用于简单任务，节省 tokens
   */
  none: {
    disabled: true,
  },
  
  /**
   * 快速推理
   * 适用于需要快速响应的场景
   */
  fast: {
    effort: 'low',
    thinking: false,
  },
  
  /**
   * 平衡推理
   * 适用于大多数场景的默认配置
   */
  balanced: {
    effort: 'medium',
    thinking: true,
  },
  
  /**
   * 深度推理
   * 适用于复杂问题，需要深入思考
   */
  deep: {
    effort: 'high',
    thinking: 5000, // 5000 tokens 预算
  },
  
  /**
   * 标签提取模式
   * 适用于使用 <think> 标签的模型（如 DeepSeek-R1）
   */
  tagExtraction: {
    tagName: 'think',
  },
} as const;

/**
 * 配置限制
 * 
 * LLM 配置参数的有效范围
 */
export const CONFIG_LIMITS = {
  /**
   * Temperature 范围 [min, max]
   * 控制输出的随机性
   */
  temperature: [0, 2] as const,
  
  /**
   * TopP 范围 [min, max]
   * 核采样参数
   */
  topP: [0, 1] as const,
  
  /**
   * 推理预算 tokens 范围（Bedrock Claude）
   */
  bedrockBudgetTokens: [1024, 64000] as const,
} as const;

/**
 * 支持的提供商列表
 */
export const SUPPORTED_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'openrouter',
  'bedrock',
  'azure',
  'vertex',
  'deepseek',
] as const;

/**
 * 不需要 API key 的提供商
 * 这些提供商使用其他认证方式（如 AWS 凭证、Google Cloud 认证）
 */
export const PROVIDERS_WITHOUT_API_KEY = [
  'bedrock',
  'vertex',
] as const;

/**
 * 推理努力程度选项
 */
export const REASONING_EFFORT_OPTIONS = ['low', 'medium', 'high'] as const;

/**
 * 常用模型别名
 * 提供更友好的模型名称
 */
export const MODEL_ALIASES: Record<string, string> = {
  // OpenAI
  'gpt4': 'gpt-4o',
  'gpt4o': 'gpt-4o',
  'gpt4-turbo': 'gpt-4-turbo',
  'gpt35': 'gpt-3.5-turbo',
  
  // Anthropic
  'claude': 'claude-3-5-sonnet-20241022',
  'claude-sonnet': 'claude-3-5-sonnet-20241022',
  'claude-opus': 'claude-3-opus-20240229',
  'claude-haiku': 'claude-3-5-haiku-20241022',
  
  // Google
  'gemini': 'gemini-1.5-pro',
  'gemini-pro': 'gemini-1.5-pro',
  'gemini-flash': 'gemini-1.5-flash',
} as const;

/**
 * 解析模型别名
 * 
 * @param modelName 模型名称或别名
 * @returns 实际模型名称
 * 
 * @example
 * ```typescript
 * resolveModelAlias('gpt4') // 返回: 'gpt-4o'
 * resolveModelAlias('claude') // 返回: 'claude-3-5-sonnet-20241022'
 * resolveModelAlias('gpt-4o') // 返回: 'gpt-4o' (原样返回)
 * ```
 */
export function resolveModelAlias(modelName: string): string {
  return MODEL_ALIASES[modelName] ?? modelName;
}
