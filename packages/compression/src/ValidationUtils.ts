/**
 * 验证工具
 * 
 * 提供配置验证和工具调用配对验证功能
 */

import type { ModelMessage } from 'ai';
import type { 
  ContextCompressionConfig, 
  ConfigValidationResult,
  ToolPairingValidationResult 
} from './types';
import { ConfigValidationError } from './errors';

/**
 * 验证上下文压缩配置
 * 
 * 检查配置参数的有效性和一致性
 * 
 * @param config 压缩配置
 * @returns 验证结果
 */
export function validateConfig(config: ContextCompressionConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 检查数值范围
  if (config.maxMessages !== undefined) {
    if (config.maxMessages < 2) {
      errors.push('maxMessages must be at least 2');
    }
    if (config.maxMessages > 10000) {
      warnings.push('maxMessages is very large (>10000), may impact performance');
    }
    // 新增：检查是否过小
    if (config.maxMessages < 10) {
      warnings.push('maxMessages is very small (<10), compression may be triggered too frequently');
    }
  }
  
  if (config.maxTokens !== undefined) {
    if (config.maxTokens < 100) {
      errors.push('maxTokens must be at least 100');
    }
    if (config.maxTokens > 1000000) {
      warnings.push('maxTokens is very large (>1M), may exceed model limits');
    }
    // 新增：检查常见模型限制
    if (config.maxTokens > 128000) {
      warnings.push('maxTokens exceeds most model limits (typically 32k-128k)');
    }
  }
  
  if (config.keepRecentMessages !== undefined) {
    if (config.keepRecentMessages < 1) {
      errors.push('keepRecentMessages must be at least 1');
    }
    // 新增：检查是否过大
    if (config.keepRecentMessages > 50) {
      warnings.push('keepRecentMessages is very large (>50), compression may not be effective');
    }
  }
  
  if (config.keepRecentRounds !== undefined) {
    if (config.keepRecentRounds < 1) {
      errors.push('keepRecentRounds must be at least 1');
    }
    // 新增：检查是否过大
    if (config.keepRecentRounds > 10) {
      warnings.push('keepRecentRounds is very large (>10), compression may not be effective');
    }
  }
  
  // 检查配置一致性
  if (config.maxMessages !== undefined && config.keepRecentMessages !== undefined) {
    if (config.keepRecentMessages >= config.maxMessages) {
      warnings.push(
        `keepRecentMessages (${config.keepRecentMessages}) should be less than maxMessages (${config.maxMessages})`
      );
    }
    
    // 检查是否有足够的空间进行压缩
    const minCompressibleMessages = 2;
    const gap = config.maxMessages - config.keepRecentMessages;
    if (gap < minCompressibleMessages) {
      warnings.push(
        `Gap between maxMessages and keepRecentMessages is too small (${gap} < ${minCompressibleMessages}), may not compress effectively`
      );
    }
    
    // 新增：检查压缩比例是否合理
    const keepRatio = config.keepRecentMessages / config.maxMessages;
    if (keepRatio > 0.8) {
      warnings.push(
        `keepRecentMessages is very close to maxMessages (${(keepRatio * 100).toFixed(0)}%), compression will be minimal`
      );
    }
  }
  
  // 检查 maxMessages 和 keepRecentRounds 的关系
  if (config.maxMessages !== undefined && config.keepRecentRounds !== undefined) {
    // 假设每轮平均 3-5 条消息
    const estimatedMessagesPerRound = 4;
    const estimatedKeptMessages = config.keepRecentRounds * estimatedMessagesPerRound;
    
    if (estimatedKeptMessages >= config.maxMessages * 0.8) {
      warnings.push(
        `keepRecentRounds (${config.keepRecentRounds}) may keep too many messages relative to maxMessages (${config.maxMessages})`
      );
    }
  }
  
  // 检查策略参数的合理性
  if (config.keepRecentMessages !== undefined && config.keepRecentRounds !== undefined) {
    // 假设每轮平均 3-5 条消息
    const estimatedMessagesPerRound = 4;
    const estimatedMessages = config.keepRecentRounds * estimatedMessagesPerRound;
    const ratio = config.keepRecentMessages / estimatedMessages;
    
    if (ratio < 0.3 || ratio > 3) {
      warnings.push(
        `keepRecentMessages (${config.keepRecentMessages}) and keepRecentRounds (${config.keepRecentRounds}) may be inconsistent (ratio: ${ratio.toFixed(2)})`
      );
    }
  }
  
  // 新增：检查 maxTokens 和 maxMessages 的关系
  if (config.maxTokens !== undefined && config.maxMessages !== undefined) {
    // 假设每条消息平均 50-200 tokens
    const avgTokensPerMessage = 100;
    const estimatedTokens = config.maxMessages * avgTokensPerMessage;
    
    if (estimatedTokens < config.maxTokens * 0.5) {
      warnings.push(
        `maxMessages (${config.maxMessages}) may trigger compression before maxTokens (${config.maxTokens}) threshold is reached`
      );
    }
  }
  
  // 新增：检查是否启用了压缩
  if (config.enabled === false) {
    warnings.push('Compression is disabled (enabled: false)');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * 验证并抛出配置错误
 * 
 * 如果配置无效，抛出 ConfigValidationError
 * 
 * @param config 压缩配置
 * @throws {ConfigValidationError} 配置无效时抛出
 */
export function validateConfigOrThrow(config: ContextCompressionConfig): void {
  const result = validateConfig(config);
  
  if (!result.valid && result.errors) {
    throw new ConfigValidationError(result.errors, { config });
  }
  
  // 警告信息已包含在 result 中，由调用者决定如何处理
}

/**
 * 验证消息列表的工具调用配对完整性
 * 
 * 检查 assistant 消息中的 tool-call 是否都有对应的 tool-result
 * 
 * @param messages 要验证的消息列表
 * @returns 验证结果
 */
export function validateToolCallPairing(messages: ModelMessage[]): ToolPairingValidationResult {
  const issues: string[] = [];
  const pendingToolCalls = new Map<string, number>(); // toolCallId -> message index
  
  messages.forEach((msg, index) => {
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      // 收集所有 tool-call
      msg.content.forEach((part: any) => {
        if (part.type === 'tool-call') {
          if (pendingToolCalls.has(part.toolCallId)) {
            issues.push(`Duplicate toolCallId: ${part.toolCallId} at index ${index}`);
          }
          pendingToolCalls.set(part.toolCallId, index);
        }
      });
    }
    
    if (msg.role === 'tool' && Array.isArray(msg.content)) {
      // 检查对应的 tool-result
      msg.content.forEach((part: any) => {
        if (part.type === 'tool-result') {
          if (!pendingToolCalls.has(part.toolCallId)) {
            issues.push(`Orphan tool-result: ${part.toolCallId} at index ${index} (no matching tool-call)`);
          } else {
            pendingToolCalls.delete(part.toolCallId);
          }
        }
      });
    }
  });
  
  // 检查未配对的 tool-call
  if (pendingToolCalls.size > 0) {
    pendingToolCalls.forEach((msgIndex, toolCallId) => {
      issues.push(`Unmatched tool-call: ${toolCallId} at index ${msgIndex} (no tool-result)`);
    });
  }
  
  return {
    valid: issues.length === 0,
    issues: issues.length > 0 ? issues : undefined,
  };
}

/**
 * 验证压缩选项
 * 
 * @param options 压缩选项
 * @returns 验证结果
 */
export function validateCompressionOptions(options: {
  keepRounds?: number;
  keepMessages?: number;
}): { valid: boolean; error?: string } {
  const { keepRounds, keepMessages } = options;
  
  // 必须指定至少一种策略
  if (keepRounds === undefined && keepMessages === undefined) {
    return {
      valid: false,
      error: 'Must specify either keepRounds or keepMessages',
    };
  }
  
  // 检查参数有效性
  if (keepRounds !== undefined && keepRounds <= 0) {
    return {
      valid: false,
      error: `keepRounds must be positive, got ${keepRounds}`,
    };
  }
  
  if (keepMessages !== undefined && keepMessages <= 0) {
    return {
      valid: false,
      error: `keepMessages must be positive, got ${keepMessages}`,
    };
  }
  
  return { valid: true };
}

/**
 * 检查是否有足够的消息可以压缩
 * 
 * @param totalMessages 总消息数
 * @param keepStartIndex 保留消息的起始索引
 * @param minCompressCount 最小压缩消息数（默认 2）
 * @returns 是否有足够的消息可以压缩
 */
export function hasEnoughMessagesToCompress(
  _totalMessages: number,
  keepStartIndex: number,
  minCompressCount: number = 2
): { sufficient: boolean; error?: string } {
  if (keepStartIndex === 0) {
    return {
      sufficient: false,
      error: 'No messages to compress (keepStartIndex is 0)',
    };
  }
  
  if (keepStartIndex < minCompressCount) {
    return {
      sufficient: false,
      error: `Not enough messages to compress: only ${keepStartIndex} available (need at least ${minCompressCount})`,
    };
  }
  
  return { sufficient: true };
}
