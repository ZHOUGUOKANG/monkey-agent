/**
 * 错误处理器
 */

import type { IErrorHandler } from '../types';

/**
 * 错误类型枚举
 */
export enum ErrorType {
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  VALIDATION = 'validation',
  EXECUTION = 'execution',
  AGENT_NOT_FOUND = 'agent_not_found',
  UNKNOWN = 'unknown',
}

/**
 * 错误严重程度枚举
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * 增强的错误信息
 */
export interface EnhancedError {
  type: ErrorType;
  severity: ErrorSeverity;
  originalError: Error;
  context?: any;
  timestamp: number;
  recoverable: boolean;
}

/**
 * 默认错误处理器
 * 
 * 提供增强的错误分类、日志记录和处理策略
 */
export class ErrorHandler implements IErrorHandler {
  /**
   * 处理错误
   * 
   * @param error 错误对象
   * @param context 错误上下文
   */
  handle(error: Error, context?: any): void {
    const enhancedError = this.classifyError(error, context);
    this.logError(enhancedError);
  }

  /**
   * 对错误进行分类
   * 
   * @param error 原始错误对象
   * @param context 错误上下文
   * @returns 增强的错误信息
   */
  private classifyError(error: Error, context?: any): EnhancedError {
    let type = ErrorType.UNKNOWN;
    let severity = ErrorSeverity.MEDIUM;
    
    // 错误分类逻辑
    if (this.isNetworkError(error)) {
      type = ErrorType.NETWORK;
      severity = ErrorSeverity.MEDIUM;
    } else if (this.isTimeoutError(error)) {
      type = ErrorType.TIMEOUT;
      severity = ErrorSeverity.LOW;
    } else if (this.isValidationError(error)) {
      type = ErrorType.VALIDATION;
      severity = ErrorSeverity.HIGH;
    } else if (this.isAgentNotFoundError(error)) {
      type = ErrorType.AGENT_NOT_FOUND;
      severity = ErrorSeverity.HIGH;
    } else if (this.isExecutionError(error)) {
      type = ErrorType.EXECUTION;
      severity = ErrorSeverity.MEDIUM;
    }
    
    return {
      type,
      severity,
      originalError: error,
      context,
      timestamp: Date.now(),
      recoverable: this.isRetryable(error),
    };
  }

  /**
   * 记录错误日志（结构化格式）
   * 
   * @param error 增强的错误信息
   */
  private logError(error: EnhancedError): void {
    const logEntry = {
      type: error.type,
      severity: error.severity,
      message: error.originalError.message,
      timestamp: new Date(error.timestamp).toISOString(),
      recoverable: error.recoverable,
      stack: error.originalError.stack,
      context: error.context,
    };

    // 根据严重程度使用不同的日志级别
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        console.error('[ErrorHandler]', logEntry);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn('[ErrorHandler]', logEntry);
        break;
      case ErrorSeverity.LOW:
        console.log('[ErrorHandler]', logEntry);
        break;
    }
  }
  
  /**
   * 判断是否为网络错误
   */
  private isNetworkError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('econnrefused') ||
           message.includes('etimedout') ||
           message.includes('enotfound') ||
           message.includes('network') ||
           message.includes('fetch failed');
  }
  
  /**
   * 判断是否为超时错误
   */
  private isTimeoutError(error: Error): boolean {
    return error.message.toLowerCase().includes('timeout');
  }

  /**
   * 判断是否为验证错误
   */
  private isValidationError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('invalid') ||
           message.includes('validation') ||
           message.includes('circular dependency');
  }

  /**
   * 判断是否为 Agent 未找到错误
   */
  private isAgentNotFoundError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (message.includes('agent') && message.includes('not found')) ||
           message.includes('no agent found');
  }

  /**
   * 判断是否为执行错误
   */
  private isExecutionError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('execution') ||
           message.includes('failed to execute') ||
           message.includes('runtime error');
  }

  /**
   * 判断错误是否可重试
   * 
   * @param error 错误对象
   * @returns 是否可重试
   */
  isRetryable(error: Error): boolean {
    // 网络错误和超时错误通常可重试
    return this.isNetworkError(error) || this.isTimeoutError(error);
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

