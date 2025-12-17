/**
 * 消息边界查找工具
 * 
 * 负责在压缩对话历史时找到合适的截断点，确保不会破坏工具调用的配对关系
 */

import type { ModelMessage } from 'ai';

/**
 * 轮次边界查找结果
 */
export interface RoundBoundaryResult {
  /** 保留消息的起始索引 */
  index: number;
  /** 找到的轮次数量 */
  roundCount: number;
}

/**
 * 消息边界查找器配置
 */
export interface MessageBoundaryFinderConfig {
  /** 是否启用缓存（默认 true） */
  enableCache?: boolean;
  /** 缓存最大条目数（默认 100） */
  maxCacheSize?: number;
}

/**
 * 消息边界查找器
 */
export class MessageBoundaryFinder {
  private config: Required<MessageBoundaryFinderConfig>;
  private roundBoundaryCache: Map<string, RoundBoundaryResult>;
  private messageBoundaryCache: Map<string, number>;

  constructor(config: MessageBoundaryFinderConfig = {}) {
    this.config = {
      enableCache: config.enableCache ?? true,
      maxCacheSize: config.maxCacheSize ?? 100,
    };
    this.roundBoundaryCache = new Map();
    this.messageBoundaryCache = new Map();
  }

  /**
   * 查找基于轮次的边界
   * 
   * 从后往前找到完整的轮次边界，确保不会在 assistant(toolUse) 和 tool(toolResult) 之间截断
   * 
   * @param history 对话历史
   * @param keepRounds 要保留的轮数
   * @returns 边界查找结果
   */
  findRoundBoundary(history: ModelMessage[], keepRounds: number): RoundBoundaryResult {
    // 检查缓存
    if (this.config.enableCache) {
      const cacheKey = this.getRoundBoundaryCacheKey(history.length, keepRounds);
      const cached = this.roundBoundaryCache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }
    
    // 快速路径：如果历史为空或 keepRounds <= 0
    if (history.length === 0 || keepRounds <= 0) {
      return { index: 0, roundCount: 0 };
    }
    
    let keepStartIndex = 0;
    let roundCount = 0;
    
    // 从后往前遍历，统计轮次
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      
      // 当遇到 user 消息时，标志着一个新轮次的开始
      if (msg.role === 'user') {
        roundCount++;
        if (roundCount === keepRounds && keepStartIndex === 0) {
          // 找到了要保留的轮次的起点（从后往前数第 keepRounds 个 user 消息）
          keepStartIndex = i; // 从这个 user 消息开始保留
          // 继续遍历以统计总轮数，不提前 break
        }
      }
    }
    
    // 快速路径：如果整个历史的轮次数 < keepRounds
    if (roundCount < keepRounds) {
      keepStartIndex = 0; // 保留所有消息
    }
    
    const result = { index: keepStartIndex, roundCount };
    
    // 更新缓存
    if (this.config.enableCache) {
      const cacheKey = this.getRoundBoundaryCacheKey(history.length, keepRounds);
      this.updateRoundBoundaryCache(cacheKey, result);
    }
    
    return result;
  }

  /**
   * 构建工具调用索引（优化性能）
   * 
   * 一次遍历构建从 toolCallId 到消息索引的映射，避免后续的嵌套循环
   * 
   * @param messages 消息列表
   * @returns toolCallId -> 消息索引的映射
   */
  private buildToolCallIndex(messages: ModelMessage[]): Map<string, number> {
    const index = new Map<string, number>();
    
    messages.forEach((msg, idx) => {
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        msg.content.forEach((part: any) => {
          if (part.type === 'tool-call') {
            index.set(part.toolCallId, idx);
          }
        });
      }
    });
    
    return index;
  }

  /**
   * 查找基于消息数的边界（优化版本）
   * 
   * 确保不会在工具调用和工具结果之间截断
   * 
   * 配对规则：
   * - assistant(toolCall) 必须和后面的 tool(result) 一起保留或压缩
   * - 安全的截断点：user、assistant(非 toolCall)、tool(result) 之后
   * 
   * 优化：使用索引避免嵌套循环，时间复杂度从 O(n²) 降为 O(n)
   * 
   * @param history 对话历史
   * @param keepMessages 要保留的消息数
   * @returns 保留消息的起始索引
   */
  findMessageBoundary(history: ModelMessage[], keepMessages: number): number {
    // 检查缓存
    if (this.config.enableCache) {
      const cacheKey = this.getMessageBoundaryCacheKey(history.length, keepMessages);
      const cached = this.messageBoundaryCache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }
    
    const targetIndex = Math.max(0, history.length - keepMessages);
    
    // 快速路径：如果 targetIndex 为 0，直接返回
    if (targetIndex === 0) {
      return 0;
    }
    
    // 构建工具调用索引（O(n)）
    const toolCallIndex = this.buildToolCallIndex(history);
    
    let result = targetIndex;
    
    // 从目标位置开始向后扫描，找到第一个安全的截断点
    for (let i = targetIndex; i < history.length; i++) {
      const msg = history[i];
      
      // 安全点 1: user 消息（对话轮次的开始）
      if (msg.role === 'user') {
        result = i;
        break;
      }
      
      // 安全点 2: 不包含 tool-call 的 assistant 消息
      if (msg.role === 'assistant') {
        const hasToolCall = Array.isArray(msg.content) && 
          msg.content.some((part: any) => part.type === 'tool-call');
        
        if (!hasToolCall) {
          // 纯文本 assistant 消息是安全的截断点
          result = i;
          break;
        }
        // 如果包含 tool-call，需要确保后续的 tool 消息也被保留
        // 继续扫描，不能在这里截断
      }
      
      // 处理 tool 消息：使用索引快速查找配对的 assistant
      if (msg.role === 'tool') {
        // 提取 toolCallId
        let toolCallId: string | undefined;
        if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            const typedPart = part as any;
            if (typedPart.type === 'tool-result' && typedPart.toolCallId) {
              toolCallId = typedPart.toolCallId;
              break;
            }
          }
        }
        
        if (toolCallId && toolCallIndex.has(toolCallId)) {
          // 使用索引直接找到配对的 assistant（O(1)）
          const assistantIndex = toolCallIndex.get(toolCallId)!;
          
          // 从配对的 assistant 开始保留（保持完整的 tool-call + tool-result 对）
          result = assistantIndex;
          break;
        }
        
        // 如果找不到配对的 assistant（孤立的 tool 消息，不应该发生）
        // 从 tool 本身开始保留
        result = i;
        break;
      }
    }
    
    // 更新缓存
    if (this.config.enableCache) {
      const cacheKey = this.getMessageBoundaryCacheKey(history.length, keepMessages);
      this.updateMessageBoundaryCache(cacheKey, result);
    }
    
    return result;
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.roundBoundaryCache.clear();
    this.messageBoundaryCache.clear();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    roundBoundary: { size: number; maxSize: number };
    messageBoundary: { size: number; maxSize: number };
  } {
    return {
      roundBoundary: {
        size: this.roundBoundaryCache.size,
        maxSize: this.config.maxCacheSize,
      },
      messageBoundary: {
        size: this.messageBoundaryCache.size,
        maxSize: this.config.maxCacheSize,
      },
    };
  }

  /**
   * 生成轮次边界缓存键
   */
  private getRoundBoundaryCacheKey(historyLength: number, keepRounds: number): string {
    return `round:${historyLength}:${keepRounds}`;
  }

  /**
   * 生成消息边界缓存键
   */
  private getMessageBoundaryCacheKey(historyLength: number, keepMessages: number): string {
    return `message:${historyLength}:${keepMessages}`;
  }

  /**
   * 更新轮次边界缓存（LRU 策略）
   */
  private updateRoundBoundaryCache(key: string, value: RoundBoundaryResult): void {
    if (this.roundBoundaryCache.has(key)) {
      this.roundBoundaryCache.delete(key);
    }
    
    if (this.roundBoundaryCache.size >= this.config.maxCacheSize) {
      const firstKey = this.roundBoundaryCache.keys().next().value;
      if (firstKey !== undefined) {
        this.roundBoundaryCache.delete(firstKey);
      }
    }
    
    this.roundBoundaryCache.set(key, value);
  }

  /**
   * 更新消息边界缓存（LRU 策略）
   */
  private updateMessageBoundaryCache(key: string, value: number): void {
    if (this.messageBoundaryCache.has(key)) {
      this.messageBoundaryCache.delete(key);
    }
    
    if (this.messageBoundaryCache.size >= this.config.maxCacheSize) {
      const firstKey = this.messageBoundaryCache.keys().next().value;
      if (firstKey !== undefined) {
        this.messageBoundaryCache.delete(firstKey);
      }
    }
    
    this.messageBoundaryCache.set(key, value);
  }
}

/**
 * 创建默认的消息边界查找器实例
 */
export function createMessageBoundaryFinder(config?: MessageBoundaryFinderConfig): MessageBoundaryFinder {
  return new MessageBoundaryFinder(config);
}
