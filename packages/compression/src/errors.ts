/**
 * 上下文压缩错误类
 */

/**
 * 压缩错误基类
 */
export class CompressionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CompressionError';
    
    // 确保 instanceof 正常工作
    Object.setPrototypeOf(this, CompressionError.prototype);
  }
}

/**
 * 消息数量不足错误
 */
export class InsufficientMessagesError extends CompressionError {
  constructor(messageCount: number, minRequired: number, context?: Record<string, unknown>) {
    super(
      `Cannot compress: only ${messageCount} messages available (need at least ${minRequired})`,
      'INSUFFICIENT_MESSAGES',
      { messageCount, minRequired, ...context }
    );
    this.name = 'InsufficientMessagesError';
    Object.setPrototypeOf(this, InsufficientMessagesError.prototype);
  }
}

/**
 * 无效策略错误
 */
export class InvalidStrategyError extends CompressionError {
  constructor(reason: string, context?: Record<string, unknown>) {
    super(
      `Invalid compression strategy: ${reason}`,
      'INVALID_STRATEGY',
      { reason, ...context }
    );
    this.name = 'InvalidStrategyError';
    Object.setPrototypeOf(this, InvalidStrategyError.prototype);
  }
}

/**
 * 工具调用配对错误
 */
export class ToolPairingError extends CompressionError {
  constructor(issues: string[], context?: Record<string, unknown>) {
    super(
      `Tool call pairing validation failed: ${issues.join('; ')}`,
      'TOOL_PAIRING_ERROR',
      { issues, ...context }
    );
    this.name = 'ToolPairingError';
    Object.setPrototypeOf(this, ToolPairingError.prototype);
  }
}

/**
 * 配置验证错误
 */
export class ConfigValidationError extends CompressionError {
  constructor(errors: string[], context?: Record<string, unknown>) {
    super(
      `Configuration validation failed: ${errors.join('; ')}`,
      'CONFIG_VALIDATION_ERROR',
      { errors, ...context }
    );
    this.name = 'ConfigValidationError';
    Object.setPrototypeOf(this, ConfigValidationError.prototype);
  }
}
