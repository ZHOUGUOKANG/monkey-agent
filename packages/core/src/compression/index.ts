/**
 * 上下文压缩模块
 * 
 * 提供对话历史压缩功能，支持基于轮次和消息数的压缩策略
 */

// ============================================
// 类型导出
// ============================================

export type {
  ContextCompressionConfig,
  CompressionResult,
  CompressionOptions,
  TypedModelMessage,
  MessageContent,
  TextContent,
  ToolCallContent,
  ToolResultContent,
  ConfigValidationResult,
  ToolPairingValidationResult,
} from './types';

// ============================================
// 错误类导出
// ============================================

export {
  CompressionError,
  InsufficientMessagesError,
  InvalidStrategyError,
  ToolPairingError,
  ConfigValidationError,
} from './errors';

// ============================================
// 核心类导出
// ============================================

export { CompressionOrchestrator } from './CompressionOrchestrator';
export { MessageBoundaryFinder } from './MessageBoundaryFinder';
export { TokenEstimator } from './TokenEstimator';
export { SummaryGenerator } from './SummaryGenerator';

// ============================================
// 工具函数导出
// ============================================

export {
  validateConfig,
  validateConfigOrThrow,
  validateToolCallPairing,
  validateCompressionOptions,
  hasEnoughMessagesToCompress,
} from './ValidationUtils';

// ============================================
// 向后兼容的函数导出
// ============================================

export {
  createCompressionTool,
  compressHistory,
  buildCompressedHistory,
  summarizeMessages,
  isContextLengthError,
  shouldCompress,
  estimateTokens,
} from './CompressionOrchestrator';

