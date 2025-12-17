/**
 * 上下文管理器
 * 
 * 负责管理对话历史的压缩和优化
 */

import type { ModelMessage } from 'ai';
import type { ILLMClient } from '@monkey-agent/types';
import { Logger } from '@monkey-agent/logger';
import {
  compressHistory,
  shouldCompress,
  isContextLengthError,
  type CompressionResult,
} from '@monkey-agent/compression';

/**
 * 上下文管理器配置
 */
export interface ContextManagerConfig {
  enabled: boolean;
  maxMessages: number;
  maxTokens: number;
  checkInterval?: number;  // 压缩检查间隔（迭代次数）
}

/**
 * 上下文管理器
 * 
 * 提供智能的上下文压缩和管理功能
 */
export class ContextManager {
  private config: ContextManagerConfig;
  private llmClient: ILLMClient;
  private lastCheckIteration: number = 0;
  private checkInterval: number;
  private logger: Logger;

  constructor(llmClient: ILLMClient, config: ContextManagerConfig) {
    this.llmClient = llmClient;
    this.config = config;
    this.checkInterval = config.checkInterval ?? 5;  // 默认每 5 次迭代检查一次
    this.logger = new Logger('ContextManager');
  }

  /**
   * 管理上下文（主动检查 + 定期压缩）
   * 
   * @param history 当前对话历史
   * @param iteration 当前迭代次数
   * @returns 处理后的对话历史
   */
  async manageContext(
    history: ModelMessage[],
    iteration: number
  ): Promise<ModelMessage[]> {
    if (!this.config.enabled) {
      return history;
    }

    // 策略：定期检查（减少性能开销）
    if (iteration - this.lastCheckIteration >= this.checkInterval) {
      const check = shouldCompress(history, {
        maxMessages: 16,  // 提高阈值到 16 条消息
        maxTokens: this.config.maxTokens,
      });
      
      if (check.shouldCompress) {
        const compressed = await this.compress(history, false);
        this.lastCheckIteration = iteration;
        return compressed;
      }
      
      this.lastCheckIteration = iteration;
    }
    
    return history;
  }

  /**
   * 处理上下文长度错误（强制压缩）
   * 
   * @param history 当前对话历史
   * @returns 压缩后的对话历史
   */
  async handleContextLengthError(
    history: ModelMessage[]
  ): Promise<ModelMessage[]> {
    // 强制压缩，使用更激进的策略
    return this.compress(history, true);
  }

  /**
   * 执行压缩
   * 
   * @param history 对话历史
   * @param aggressive 是否使用激进策略
   * @returns 压缩后的历史
   */
  private async compress(
    history: ModelMessage[],
    aggressive: boolean
  ): Promise<ModelMessage[]> {
    try {
      // 优化策略：使用基于轮次的压缩，保证 system、user、assistant+tool 成对保留
      const keepRounds = aggressive ? 2 : 8;  // 保留 8 轮完整对话（约 16 条消息）
      
      const result: CompressionResult = await compressHistory(
        history,
        { keepRounds },  // 改用 keepRounds 策略
        this.llmClient
      );
      
      return result.keptMessages as ModelMessage[];
    } catch (error: any) {
      // 压缩失败，返回原历史
      this.logger.warn('Compression failed', {
        error: error.message
      });
      return history;
    }
  }

  /**
   * 检查错误是否为上下文长度错误
   */
  isContextLengthError(errorMessage: string): boolean {
    return isContextLengthError(errorMessage);
  }

  /**
   * 重置检查状态
   */
  reset(): void {
    this.lastCheckIteration = 0;
  }
}

