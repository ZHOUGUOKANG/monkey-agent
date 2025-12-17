import type { ReasoningConfig } from '@monkey-agent/types';

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

