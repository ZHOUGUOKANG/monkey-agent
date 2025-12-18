/**
 * Mock LLM Client for Testing
 * 
 * 提供快速、可预测的 LLM 客户端模拟实现，用于单元测试
 */

import type { ModelMessage } from 'ai';
import type { LLMClient, ChatResult, StreamChunk } from '../../llm/LLMClient';
import type { LLMConfig } from '../../types';

/**
 * Mock 响应配置
 */
export interface MockResponseConfig {
  /** 固定响应文本 */
  text?: string;
  /** 响应生成函数 */
  textGenerator?: (messages: ModelMessage[]) => string;
  /** 模拟的 token 使用量 */
  totalTokens?: number;
  /** 模拟延迟（毫秒） */
  delay?: number;
  /** 是否抛出错误 */
  shouldError?: boolean;
  /** 错误信息 */
  errorMessage?: string;
}

/**
 * Mock LLM 客户端
 */
export class MockLLMClient implements Partial<LLMClient> {
  private responseConfig: MockResponseConfig;
  private callHistory: ModelMessage[][] = [];

  constructor(config?: MockResponseConfig) {
    this.responseConfig = {
      text: '这是一个模拟响应',
      totalTokens: 100,
      delay: 0,
      shouldError: false,
      ...config,
    };
  }

  /**
   * 模拟聊天调用
   */
  async chat(messages: ModelMessage[], options?: any): Promise<ChatResult> {
    // 记录调用历史
    this.callHistory.push(messages);

    // 模拟延迟
    if (this.responseConfig.delay && this.responseConfig.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.responseConfig.delay));
    }

    // 模拟错误
    if (this.responseConfig.shouldError) {
      throw new Error(this.responseConfig.errorMessage || 'Mock error');
    }

    // 生成响应文本
    let responseText: string;
    if (this.responseConfig.textGenerator) {
      responseText = this.responseConfig.textGenerator(messages);
    } else {
      responseText = this.responseConfig.text || '这是一个模拟响应';
    }

    return {
      text: responseText,
      usage: {
        totalTokens: this.responseConfig.totalTokens || 100,
        promptTokens: Math.floor((this.responseConfig.totalTokens || 100) * 0.7),
        completionTokens: Math.floor((this.responseConfig.totalTokens || 100) * 0.3),
      },
      finishReason: 'stop',
    };
  }

  /**
   * 模拟流式聊天
   */
  async *stream(messages: ModelMessage[], options?: any): AsyncGenerator<StreamChunk> {
    this.callHistory.push(messages);

    if (this.responseConfig.delay && this.responseConfig.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.responseConfig.delay));
    }

    if (this.responseConfig.shouldError) {
      throw new Error(this.responseConfig.errorMessage || 'Mock error');
    }

    const responseText = this.responseConfig.textGenerator 
      ? this.responseConfig.textGenerator(messages)
      : (this.responseConfig.text || '这是一个模拟响应');

    // 逐字返回
    for (const char of responseText) {
      yield {
        type: 'text-delta' as const,
        textDelta: char,
      };
    }

    yield {
      type: 'finish' as const,
      finishReason: 'stop',
      usage: {
        totalTokens: this.responseConfig.totalTokens || 100,
        promptTokens: Math.floor((this.responseConfig.totalTokens || 100) * 0.7),
        completionTokens: Math.floor((this.responseConfig.totalTokens || 100) * 0.3),
      },
    };
  }

  /**
   * 获取调用历史
   */
  getCallHistory(): ModelMessage[][] {
    return this.callHistory;
  }

  /**
   * 清空调用历史
   */
  clearCallHistory(): void {
    this.callHistory = [];
  }

  /**
   * 获取调用次数
   */
  getCallCount(): number {
    return this.callHistory.length;
  }

  /**
   * 更新响应配置
   */
  setResponseConfig(config: MockResponseConfig): void {
    this.responseConfig = { ...this.responseConfig, ...config };
  }
}

/**
 * 创建摘要生成 Mock
 * 
 * 专门用于测试压缩功能的 Mock
 */
export function createSummaryMockClient(options?: {
  summaryPrefix?: string;
  includeMessageCount?: boolean;
}): MockLLMClient {
  const { summaryPrefix = '[摘要]', includeMessageCount = true } = options || {};

  return new MockLLMClient({
    textGenerator: (messages) => {
      const count = messages.length;
      if (includeMessageCount) {
        return `${summaryPrefix} 共处理 ${count} 条消息`;
      }
      return summaryPrefix;
    },
    totalTokens: 50,
  });
}

/**
 * 创建会抛出上下文长度错误的 Mock
 */
export function createContextLengthErrorMock(): MockLLMClient {
  return new MockLLMClient({
    shouldError: true,
    errorMessage: "This model's maximum context length is 8192 tokens",
  });
}

/**
 * 创建通用错误 Mock
 */
export function createErrorMock(errorMessage: string): MockLLMClient {
  return new MockLLMClient({
    shouldError: true,
    errorMessage,
  });
}
