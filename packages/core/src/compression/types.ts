/**
 * 上下文压缩类型定义
 */

import type { ModelMessage } from 'ai';

/**
 * 文本内容
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * 工具调用内容
 */
export interface ToolCallContent {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

/**
 * 工具结果内容
 */
export interface ToolResultContent {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: unknown;
}

/**
 * 消息内容联合类型
 */
export type MessageContent = TextContent | ToolCallContent | ToolResultContent;

/**
 * 类型化的模型消息
 */
export interface TypedModelMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string | MessageContent[];
}

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
  /** 要保留的消息（已经过边界调整） */
  keptMessages: ModelMessage[];
}

/**
 * 压缩策略选项
 */
export interface CompressionOptions {
  /** 保留的最近轮数（用于多轮对话场景） */
  keepRounds?: number;
  /** 保留的最近消息数（用于单轮多工具调用场景） */
  keepMessages?: number;
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
