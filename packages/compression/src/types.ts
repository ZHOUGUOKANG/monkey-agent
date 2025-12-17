/**
 * 上下文压缩类型定义
 */

import type { ModelMessage } from 'ai';

/**
 * 上下文压缩配置
 */
export interface ContextCompressionConfig {
  /** 是否启用压缩（默认 true） */
  enabled?: boolean;
  /** 触发主动压缩的消息数阈值（默认 20） */
  maxMessages?: number;
  /** 触发主动压缩的 Token 数阈值（默认 8000） */
  maxTokens?: number;
  /** 压缩时保留最近的轮数（默认 3） */
  keepRecentRounds?: number;
  /** 压缩时保留最近的消息数（默认 10，用于单轮多工具调用场景） */
  keepRecentMessages?: number;
  /** 上下文长度错误时自动压缩并重试（默认 true） */
  autoRetryOnLength?: boolean;
  /** 是否启用工具触发方式（默认 true） */
  enableTool?: boolean;
}

/**
 * 压缩结果
 */
export interface CompressionResult {
  success: boolean;
  summary: string;
  originalLength: number;
  newLength: number;
  compressedCount: number;
  /** 要保留的消息（已经过边界调整，不包含摘要） */
  keptMessages: ModelMessage[];
  /** 包含摘要的完整压缩历史（可直接使用） */
  compressedHistory: ModelMessage[];
  /** 压缩过程中的警告信息 */
  warnings?: string[];
}

/**
 * 压缩策略选项
 */
export interface CompressionOptions {
  /** 保留的最近轮数（用于多轮对话场景） */
  keepRounds?: number;
  /** 保留的最近消息数（用于单轮多工具调用场景） */
  keepMessages?: number;
  /** 静默模式：压缩失败时返回原历史而不抛出错误（默认 false） */
  silent?: boolean;
}

/**
 * 配置验证结果
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * 工具调用配对验证结果
 */
export interface ToolPairingValidationResult {
  valid: boolean;
  issues?: string[];
}
