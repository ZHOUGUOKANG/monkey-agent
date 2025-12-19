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
 * 消息边界查找器
 */
export class MessageBoundaryFinder {
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
    
    // 如果整个历史的轮次数 < keepRounds，keepStartIndex 保持为 0
    // 这意味着所有消息都需要保留（没有足够的消息可以压缩）
    
    return { index: keepStartIndex, roundCount };
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
   * 
   * @example
   * ```
   * // 场景：希望保留最后 2 条消息
   * history = [
   *   user,                      // index 0  ← 安全截断点
   *   assistant(toolCall),       // index 1
   *   tool(result),              // index 2
   * ]
   * targetIndex = 3 - 2 = 1
   * 扫描从 index 1 开始：
   *   - index 1: assistant(toolCall) → 跳过
   *   - index 2: tool → 这是最后一条，需要向前找配对的 assistant
   * 最终返回 index 1（保留 assistant+tool 配对）
   * ```
   */
  findMessageBoundary(history: ModelMessage[], keepMessages: number): number {
    const targetIndex = Math.max(0, history.length - keepMessages);
    
    // 构建工具调用索引（O(n)）
    const toolCallIndex = this.buildToolCallIndex(history);
    
    // 从目标位置开始向后扫描，找到第一个安全的截断点
    for (let i = targetIndex; i < history.length; i++) {
      const msg = history[i];
      
      // 安全点 1: user 消息（对话轮次的开始）
      if (msg.role === 'user') {
        return i;
      }
      
      // 安全点 2: 不包含 tool-call 的 assistant 消息
      if (msg.role === 'assistant') {
        const hasToolCall = Array.isArray(msg.content) && 
          msg.content.some((part: any) => part.type === 'tool-call');
        
        if (!hasToolCall) {
          // 纯文本 assistant 消息是安全的截断点
          return i;
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
          return assistantIndex;
        }
        
        // 如果找不到配对的 assistant（孤立的 tool 消息，不应该发生）
        // 从 tool 本身开始保留
        return i;
      }
    }
    
    // 整个扫描范围都没有找到安全点
    // 保守策略：从 targetIndex 开始保留所有消息
    return targetIndex;
  }
}

/**
 * 创建默认的消息边界查找器实例
 */
export function createMessageBoundaryFinder(): MessageBoundaryFinder {
  return new MessageBoundaryFinder();
}
