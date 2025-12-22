/**
 * 错误处理器
 */

import type { IErrorHandler } from '../types';

/**
 * 默认错误处理器
 * 
 * 提供基础的错误处理和日志记录
 */
export class ErrorHandler implements IErrorHandler {
  /**
   * 处理错误
   * 
   * @param error 错误对象
   * @param context 错误上下文
   */
  handle(error: Error, context?: any): void {
    console.error('[ErrorHandler] Error occurred:', {
      message: error.message,
      stack: error.stack,
      context,
    });
  }

  /**
   * 判断错误是否可重试
   * 
   * @param error 错误对象
   * @returns 是否可重试
   */
  isRetryable(error: Error): boolean {
    // 网络错误通常可重试
    if (error.message.includes('ECONNREFUSED') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ENOTFOUND')) {
      return true;
    }

    // 超时错误可重试
    if (error.message.includes('timeout') ||
        error.message.includes('Timeout')) {
      return true;
    }

    // 临时错误可重试
    if (error.message.includes('temporarily unavailable') ||
        error.message.includes('try again')) {
      return true;
    }

    return false;
  }
}

/**
 * 重试策略
 */
export interface RetryStrategy {
  /** 最大重试次数 */
  maxRetries: number;
  /** 初始延迟(毫秒) */
  initialDelay: number;
  /** 最大延迟(毫秒) */
  maxDelay: number;
  /** 退避因子 */
  backoffFactor: number;
}

/**
 * 指数退避重试策略
 */
export class ExponentialBackoffRetry {
  private strategy: RetryStrategy;

  constructor(strategy?: Partial<RetryStrategy>) {
    this.strategy = {
      maxRetries: strategy?.maxRetries ?? 3,
      initialDelay: strategy?.initialDelay ?? 1000,
      maxDelay: strategy?.maxDelay ?? 30000,
      backoffFactor: strategy?.backoffFactor ?? 2,
    };
  }

  /**
   * 计算延迟时间
   * 
   * @param attempt 当前尝试次数(从 1 开始)
   * @returns 延迟时间(毫秒)
   */
  calculateDelay(attempt: number): number {
    const delay = this.strategy.initialDelay * Math.pow(this.strategy.backoffFactor, attempt - 1);
    return Math.min(delay, this.strategy.maxDelay);
  }

  /**
   * 执行带重试的操作
   * 
   * @param operation 要执行的操作
   * @param errorHandler 错误处理器
   * @returns 操作结果
   */
  async execute<T>(
    operation: () => Promise<T>,
    errorHandler?: ErrorHandler
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.strategy.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // 如果是最后一次尝试,直接抛出错误
        if (attempt === this.strategy.maxRetries) {
          break;
        }

        // 检查是否可重试
        if (errorHandler && !errorHandler.isRetryable(lastError)) {
          throw lastError;
        }

        // 计算延迟并等待
        const delay = this.calculateDelay(attempt);
        console.log(`[RetryStrategy] Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * 睡眠指定时间
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

