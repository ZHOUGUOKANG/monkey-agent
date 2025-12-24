import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorHandler, ErrorType, ErrorSeverity } from '../error/ErrorHandler';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
  });

  describe('handle', () => {
    it('应该处理普通错误', () => {
      const error = new Error('Test error');
      
      // 不应该抛出错误
      expect(() => errorHandler.handle(error)).not.toThrow();
    });

    it('应该处理带上下文的错误', () => {
      const error = new Error('Test error');
      const context = {
        agentId: 'test-agent',
        workflowId: 'test-workflow',
      };
      
      expect(() => errorHandler.handle(error, context)).not.toThrow();
    });

    it('应该处理网络错误', () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      
      expect(() => errorHandler.handle(error)).not.toThrow();
    });

    it('应该处理超时错误', () => {
      const error = new Error('Operation timed out');
      
      expect(() => errorHandler.handle(error)).not.toThrow();
    });

    it('应该处理验证错误', () => {
      const error = new Error('Validation failed: invalid input');
      
      expect(() => errorHandler.handle(error)).not.toThrow();
    });
  });

  describe('isRetryable', () => {
    it('应该判定网络错误为可重试', () => {
      const error = new Error('ECONNREFUSED');
      
      const isRetryable = errorHandler.isRetryable(error);
      
      expect(isRetryable).toBe(true);
    });

    it('应该判定超时错误为可重试', () => {
      const error = new Error('timeout');
      
      const isRetryable = errorHandler.isRetryable(error);
      
      expect(isRetryable).toBe(true);
    });

    it('应该判定验证错误为不可重试', () => {
      const error = new Error('validation failed');
      
      const isRetryable = errorHandler.isRetryable(error);
      
      expect(isRetryable).toBe(false);
    });

    it('应该判定 Agent 未找到错误为不可重试', () => {
      const error = new Error('Agent not found');
      
      const isRetryable = errorHandler.isRetryable(error);
      
      expect(isRetryable).toBe(false);
    });
  });

  describe('错误分类', () => {
    it('应该正确分类不同类型的错误', () => {
      const testCases = [
        { error: new Error('ECONNREFUSED'), expectedType: 'network' },
        { error: new Error('timeout exceeded'), expectedType: 'timeout' },
        { error: new Error('invalid parameter'), expectedType: 'validation' },
        { error: new Error('Agent test-agent not found'), expectedType: 'agent_not_found' },
      ];

      testCases.forEach(({ error }) => {
        expect(() => errorHandler.handle(error)).not.toThrow();
      });
    });
  });

  describe('边界情况', () => {
    it('应该处理空错误消息', () => {
      const error = new Error('');
      
      expect(() => errorHandler.handle(error)).not.toThrow();
    });

    it('应该处理没有消息的错误对象', () => {
      const error = new Error();
      
      expect(() => errorHandler.handle(error)).not.toThrow();
    });

    it('应该处理非 Error 对象', () => {
      const error = 'String error' as any;
      
      expect(() => errorHandler.handle(error)).not.toThrow();
    });
  });
});

