/**
 * Token 估算工具
 * 
 * 提供简单但快速的 token 数量估算功能
 */

import type { ModelMessage } from 'ai';

/**
 * Token 估算器
 */
export class TokenEstimator {
  /**
   * 字符到 token 的转换比例
   * 1 个字符 ≈ 0.5 个 token（适用于英文和中文混合）
   */
  private readonly charToTokenRatio: number;

  constructor(charToTokenRatio: number = 0.5) {
    this.charToTokenRatio = charToTokenRatio;
  }

  /**
   * 估算消息的 Token 数量
   * 
   * 使用简单的规则：1 个字符 ≈ 0.5 个 token（适用于英文和中文混合）
   * 
   * @param messages 消息列表
   * @returns 估算的 token 总数
   */
  estimateTokens(messages: ModelMessage[]): number {
    let totalChars = 0;
    
    for (const msg of messages) {
      totalChars += this.countMessageChars(msg);
    }
    
    // 字符数 * 转换比例
    return Math.ceil(totalChars * this.charToTokenRatio);
  }

  /**
   * 计算单条消息的字符数
   * 
   * @param msg 消息
   * @returns 字符总数
   */
  private countMessageChars(msg: ModelMessage): number {
    let charCount = 0;
    
    // 处理字符串内容
    if (typeof msg.content === 'string') {
      charCount += msg.content.length;
    } 
    // 处理数组内容
    else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        charCount += this.countContentPartChars(part);
      }
    }
    
    // 添加角色的开销（约 10 个字符）
    charCount += 10;
    
    return charCount;
  }

  /**
   * 计算内容部分的字符数
   * 
   * @param part 内容部分
   * @returns 字符数
   */
  private countContentPartChars(part: any): number {
    if (part.type === 'text') {
      // 文本内容
      return part.text?.length || 0;
    } 
    else if (part.type === 'tool-call') {
      // 工具调用：估算工具名和参数的长度
      let charCount = 0;
      charCount += part.toolName?.length || 0;
      charCount += JSON.stringify(part.args || {}).length;
      return charCount;
    } 
    else if (part.type === 'tool-result') {
      // 工具结果：估算输出的长度
      const output = part.output;
      if (typeof output === 'string') {
        return output.length;
      } else if (output?.value) {
        return String(output.value).length;
      } else {
        return JSON.stringify(output || {}).length;
      }
    }
    
    return 0;
  }

  /**
   * 估算单条消息的 token 数
   * 
   * @param msg 消息
   * @returns 估算的 token 数
   */
  estimateMessageTokens(msg: ModelMessage): number {
    const charCount = this.countMessageChars(msg);
    return Math.ceil(charCount * this.charToTokenRatio);
  }

  /**
   * 估算文本的 token 数
   * 
   * @param text 文本
   * @returns 估算的 token 数
   */
  estimateTextTokens(text: string): number {
    return Math.ceil(text.length * this.charToTokenRatio);
  }
}

/**
 * 创建默认的 token 估算器实例
 */
export function createTokenEstimator(): TokenEstimator {
  return new TokenEstimator();
}

/**
 * 快捷函数：估算消息的 token 数量
 * 
 * @param messages 消息列表
 * @returns 估算的 token 总数
 */
export function estimateTokens(messages: ModelMessage[]): number {
  const estimator = createTokenEstimator();
  return estimator.estimateTokens(messages);
}
