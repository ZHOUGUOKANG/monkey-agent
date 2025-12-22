/**
 * 上下文压缩编排器
 * 
 * 整合所有压缩功能，提供统一的压缩接口
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ModelMessage } from 'ai';
import type { LLMClient } from '@monkey-agent/llm';

import type { 
  CompressionResult, 
  CompressionOptions} from './types';
import { 
  InsufficientMessagesError, 
  InvalidStrategyError 
} from './errors';
import { MessageBoundaryFinder } from './MessageBoundaryFinder';
import { TokenEstimator } from './TokenEstimator';
import { SummaryGenerator } from './SummaryGenerator';
import { 
  validateToolCallPairing, 
  validateCompressionOptions,
  hasEnoughMessagesToCompress 
} from './ValidationUtils';

/**
 * 压缩编排器
 */
export class CompressionOrchestrator {
  private boundaryFinder: MessageBoundaryFinder;
  private tokenEstimator: TokenEstimator;

  constructor() {
    this.boundaryFinder = new MessageBoundaryFinder();
    this.tokenEstimator = new TokenEstimator();
  }

  /**
   * 压缩对话历史
   * 
   * 支持两种压缩策略：
   * 1. 基于轮次：保留最近 N 轮完整对话（适合多轮对话）
   * 2. 基于消息数：保留最近 N 条消息（适合单轮多工具调用）
   * 
   * @param history 对话历史
   * @param options 压缩选项
   * @param llmClient LLM 客户端（用于生成摘要）
   * @returns 压缩结果
   */
  async compressHistory(
    history: ModelMessage[],
    options: CompressionOptions,
    llmClient: LLMClient
  ): Promise<CompressionResult> {
    const { keepRounds, keepMessages } = options;
    
    // 验证压缩选项
    const validation = validateCompressionOptions(options);
    if (!validation.valid) {
      throw new InvalidStrategyError(validation.error || 'Invalid compression options');
    }
    
    // 确定使用哪种策略并找到边界
    let keepStartIndex: number;
    let strategyUsed: string;
    
    if (keepRounds !== undefined && keepRounds > 0) {
      // 策略 1: 基于轮次（保留完整的 user → assistant → tool 对话轮）
      const result = this.boundaryFinder.findRoundBoundary(history, keepRounds);
      keepStartIndex = result.index;
      strategyUsed = `rounds (${result.roundCount} rounds found)`;
    } else if (keepMessages !== undefined && keepMessages > 0) {
      // 策略 2: 基于消息数（保留最近 N 条消息，确保不破坏工具调用配对）
      keepStartIndex = this.boundaryFinder.findMessageBoundary(history, keepMessages);
      strategyUsed = 'messages';
    } else {
      throw new InvalidStrategyError('Must specify either keepRounds or keepMessages');
    }
    
    // 检查是否有足够的消息可以压缩
    const sufficiency = hasEnoughMessagesToCompress(history.length, keepStartIndex);
    if (!sufficiency.sufficient) {
      throw new InsufficientMessagesError(
        keepStartIndex,
        2,
        { 
          strategy: strategyUsed, 
          totalMessages: history.length,
          reason: sufficiency.error 
        }
      );
    }
    
    // 分割：要压缩的 vs 要保留的
    const toCompress = history.slice(0, keepStartIndex);
    const toKeep = history.slice(keepStartIndex);
    
    // 使用 LLM 总结早期对话
    const summaryGenerator = new SummaryGenerator(llmClient);
    const summary = await summaryGenerator.summarizeMessages(toCompress);
    
    return {
      success: true,
      summary,
      originalLength: history.length,
      newLength: toKeep.length + 1, // +1 for summary message
      compressedCount: toCompress.length,
      keptMessages: toKeep,
    };
  }

  /**
   * 构建压缩后的新历史
   * 
   * @param summary 压缩摘要
   * @param recentMessages 要保留的最近消息
   * @returns 新的对话历史
   */
  buildCompressedHistory(
    summary: string,
    recentMessages: ModelMessage[]
  ): ModelMessage[] {
    // 验证保留消息的完整性
    const validation = validateToolCallPairing(recentMessages);
    if (!validation.valid) {
      console.warn('[压缩警告] 保留的消息存在配对问题:');
      validation.issues?.forEach(issue => console.warn(`  - ${issue}`));
    }
    
    return [
      {
        role: 'user',
        content: `[前期对话摘要]\n${summary}\n\n[以下是最近的对话，继续当前任务]`,
      },
      ...recentMessages,
    ];
  }

  /**
   * 检查是否需要主动压缩（混合策略）
   * 
   * 同时考虑三个维度：
   * 1. 消息数量
   * 2. Token 数量
   * 3. 轮次数量
   * 
   * 策略选择逻辑：
   * - 多轮对话（>= keepRecentRounds+2 轮）：优先使用基于轮次的策略
   * - 单轮多工具调用：使用基于消息数的策略
   * - 边界情况：智能选择能保留更多上下文的策略
   * 
   * @param history 当前对话历史
   * @param config 压缩配置
   * @returns 是否需要压缩和推荐的压缩选项
   */
  shouldCompress(
    history: ModelMessage[],
    config: {
      maxMessages?: number;
      maxTokens?: number;
      keepRecentRounds?: number;
      keepRecentMessages?: number;
    }
  ): { 
    shouldCompress: boolean; 
    reason?: string;
    recommendedOptions?: CompressionOptions;
  } {
    const {
      maxMessages = 20,
      maxTokens = 8000,
      keepRecentRounds = 3,
      keepRecentMessages = 10,
    } = config;
    
    const messageCount = history.length;
    const tokenCount = this.tokenEstimator.estimateTokens(history);
    
    // 统计轮次数（user 消息的数量）
    const roundCount = history.filter(msg => msg.role === 'user').length;
    
    // 判断是否超过阈值
    const exceedsMessages = messageCount >= maxMessages;
    const exceedsTokens = tokenCount >= maxTokens;
    
    // 如果都没超过阈值，不需要压缩
    if (!exceedsMessages && !exceedsTokens) {
      return { shouldCompress: false };
    }
    
    // 构建原因说明
    const reasons: string[] = [];
    if (exceedsMessages) {
      reasons.push(`messages: ${messageCount}/${maxMessages}`);
    }
    if (exceedsTokens) {
      reasons.push(`tokens: ~${tokenCount}/${maxTokens}`);
    }
    
    // 决定使用哪种策略
    let recommendedOptions: CompressionOptions;
    let strategyReason: string;
    
    // 策略 1: 多轮对话场景（有足够的轮次可以压缩）
    if (roundCount >= keepRecentRounds + 2) {
      // 有足够的轮次，使用基于轮次的策略
      strategyReason = `Multi-round conversation (${roundCount} rounds), using round-based strategy`;
      recommendedOptions = { keepRounds: keepRecentRounds };
    } 
    // 策略 2: 单轮多工具调用场景
    else if (roundCount <= 1) {
      // 只有 1 轮或更少，明确使用基于消息数的策略
      strategyReason = `Single round with ${messageCount} messages, using message-based strategy`;
      recommendedOptions = { keepMessages: keepRecentMessages };
    }
    // 策略 3: 边界情况（2-4 轮）- 智能选择
    else {
      // 计算两种策略各自会保留多少消息
      const roundBoundary = this.boundaryFinder.findRoundBoundary(history, keepRecentRounds);
      const messagesKeptByRounds = history.length - roundBoundary.index;
      const messagesKeptByCount = keepRecentMessages;
      
      // 选择能保留更多上下文的策略
      if (messagesKeptByRounds >= messagesKeptByCount && roundBoundary.index > 0) {
        strategyReason = `${roundCount} rounds detected, round-based strategy keeps more context (${messagesKeptByRounds} vs ${messagesKeptByCount} messages)`;
        recommendedOptions = { keepRounds: keepRecentRounds };
      } else {
        strategyReason = `${roundCount} rounds detected, but message-based strategy is more efficient (keeps ${messagesKeptByCount} messages)`;
        recommendedOptions = { keepMessages: keepRecentMessages };
      }
    }
    
    const finalReason = `${reasons.join(', ')} - ${strategyReason}`;
    
    return {
      shouldCompress: true,
      reason: finalReason,
      recommendedOptions,
    };
  }

  /**
   * 检查错误是否为上下文长度错误
   * 
   * 不同 LLM 提供商的错误信息：
   * - OpenAI: "This model's maximum context length is..."
   * - Anthropic: "prompt is too long"
   * - Google: "context length exceeded"
   * 
   * @param errorMessage 错误信息
   * @returns 是否为上下文长度错误
   */
  isContextLengthError(errorMessage: string): boolean {
    const errorPatterns = [
      /maximum context length/i,
      /context length/i,
      /prompt is too long/i,
      /token limit/i,
      /too many tokens/i,
      /exceeds.*token/i,
      /context.*exceed/i,
    ];
    
    return errorPatterns.some(pattern => pattern.test(errorMessage));
  }
}

// ============================================
// 向后兼容的函数导出
// ============================================

const defaultOrchestrator = new CompressionOrchestrator();

/**
 * 创建压缩工具定义
 */
export function createCompressionTool() {
  return tool({
    description: '压缩对话历史以节省 token。当对话历史过长时，可以调用此工具来总结并压缩早期对话内容，保留最近的对话。',
    inputSchema: z.object({
      keepRecentRounds: z.number().optional().describe('要保留的最近轮数（可选，默认为配置值）'),
    }),
  });
}

/**
 * 压缩对话历史（向后兼容函数）
 */
export async function compressHistory(
  history: ModelMessage[],
  options: CompressionOptions,
  llmClient: LLMClient
): Promise<CompressionResult> {
  return defaultOrchestrator.compressHistory(history, options, llmClient);
}

/**
 * 构建压缩后的新历史（向后兼容函数）
 */
export function buildCompressedHistory(
  summary: string,
  recentMessages: ModelMessage[]
): ModelMessage[] {
  return defaultOrchestrator.buildCompressedHistory(summary, recentMessages);
}

/**
 * 使用 LLM 总结消息列表（向后兼容函数）
 */
export async function summarizeMessages(
  messages: ModelMessage[],
  llmClient: LLMClient
): Promise<string> {
  const generator = new SummaryGenerator(llmClient);
  return generator.summarizeMessages(messages);
}

/**
 * 检查错误是否为上下文长度错误（向后兼容函数）
 */
export function isContextLengthError(errorMessage: string): boolean {
  return defaultOrchestrator.isContextLengthError(errorMessage);
}

/**
 * 检查是否需要主动压缩（向后兼容函数）
 */
export function shouldCompress(
  history: ModelMessage[],
  config: {
    maxMessages?: number;
    maxTokens?: number;
    keepRecentRounds?: number;
    keepRecentMessages?: number;
  }
): { 
  shouldCompress: boolean; 
  reason?: string;
  recommendedOptions?: CompressionOptions;
} {
  return defaultOrchestrator.shouldCompress(history, config);
}

/**
 * 估算消息的 Token 数量（向后兼容函数）
 */
export function estimateTokens(messages: ModelMessage[]): number {
  const estimator = new TokenEstimator();
  return estimator.estimateTokens(messages);
}
