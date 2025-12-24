import type { ToolResult } from './types';

/**
 * Tool 执行器配置
 */
export interface ToolExecutorConfig {
  maxRetries?: number;         // 最大重试次数（默认 0）
  retryDelay?: number;         // 重试延迟（毫秒，默认 1000）
  continueOnError?: boolean;   // 失败后是否继续（默认 true）
}

/**
 * Tool 执行器
 * 
 * 提供增强的执行功能：
 * - 重试机制（指数退避）
 * - 错误处理
 * - 执行统计
 */
export class ToolExecutor {
  private config: Required<ToolExecutorConfig>;
  
  constructor(config?: ToolExecutorConfig) {
    this.config = {
      maxRetries: config?.maxRetries ?? 0,
      retryDelay: config?.retryDelay ?? 1000,
      continueOnError: config?.continueOnError ?? true,
    };
  }
  
  /**
   * 执行 Tool（带重试）
   * 
   * @param executor 执行函数
   * @returns 执行结果
   */
  async execute<T>(
    executor: () => Promise<T>
  ): Promise<ToolResult<T>> {
    let lastError: Error | null = null;
    
    for (let retry = 0; retry <= this.config.maxRetries; retry++) {
      try {
        const data = await executor();
        return { success: true, data };
      } catch (error: any) {
        lastError = error;
        
        // 如果还有重试次数，等待后重试
        if (retry < this.config.maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, retry);  // 指数退避
          await this.sleep(delay);
        }
      }
    }
    
    // 所有重试都失败
    return {
      success: false,
      error: lastError || new Error('Tool execution failed'),
      shouldContinue: this.config.continueOnError,
    };
  }
  
  /**
   * 包装工具执行函数（用于 Agent）
   * 
   * 将可能失败的函数包装成带重试的版本
   * 
   * @param executor 执行函数
   * @returns 包装后的函数
   */
  wrap<T>(
    executor: () => Promise<T>
  ): () => Promise<T> {
    return async () => {
      const result = await this.execute(executor);
      if (!result.success) {
        throw result.error!;
      }
      return result.data as T;
    };
  }
  
  /**
   * 配置重试次数（链式调用）
   */
  withRetry(maxRetries: number): ToolExecutor {
    this.config.maxRetries = maxRetries;
    return this;
  }
  
  /**
   * 配置重试延迟（链式调用）
   */
  withRetryDelay(retryDelay: number): ToolExecutor {
    this.config.retryDelay = retryDelay;
    return this;
  }
  
  /**
   * 配置失败后是否继续（链式调用）
   */
  withContinueOnError(continueOnError: boolean): ToolExecutor {
    this.config.continueOnError = continueOnError;
    return this;
  }
  
  /**
   * 辅助函数：延迟
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

