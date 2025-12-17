/**
 * Token 估算工具
 * 
 * 提供智能的 token 数量估算功能，支持中英文区分和结果缓存
 */

import type { ModelMessage } from 'ai';

/**
 * Token 估算器配置
 */
export interface TokenEstimatorConfig {
  /** 默认字符到 token 的转换比例（默认 0.5） */
  defaultRatio?: number;
  /** 中文字符的转换比例（默认 1.5） */
  chineseRatio?: number;
  /** 英文字符的转换比例（默认 0.4） */
  englishRatio?: number;
  /** 是否启用智能语言检测（默认 true） */
  enableSmartDetection?: boolean;
  /** 是否启用缓存（默认 true） */
  enableCache?: boolean;
  /** 缓存最大条目数（默认 1000） */
  maxCacheSize?: number;
}

/**
 * Token 估算器
 */
export class TokenEstimator {
  private readonly config: Required<TokenEstimatorConfig>;
  private cache: Map<string, number>;

  constructor(config: TokenEstimatorConfig = {}) {
    this.config = {
      defaultRatio: config.defaultRatio ?? 0.5,
      chineseRatio: config.chineseRatio ?? 1.5,
      englishRatio: config.englishRatio ?? 0.4,
      enableSmartDetection: config.enableSmartDetection ?? true,
      enableCache: config.enableCache ?? true,
      maxCacheSize: config.maxCacheSize ?? 1000,
    };
    this.cache = new Map();
  }

  /**
   * 估算消息的 Token 数量
   * 
   * @param messages 消息列表
   * @returns 估算的 token 总数
   */
  estimateTokens(messages: ModelMessage[]): number {
    let totalTokens = 0;
    
    for (const msg of messages) {
      totalTokens += this.estimateMessageTokens(msg);
    }
    
    return totalTokens;
  }

  /**
   * 估算单条消息的 token 数
   * 
   * @param msg 消息
   * @returns 估算的 token 数
   */
  estimateMessageTokens(msg: ModelMessage): number {
    const charCount = this.countMessageChars(msg);
    return Math.ceil(charCount * this.config.defaultRatio);
  }

  /**
   * 估算文本的 token 数（支持智能语言检测）
   * 
   * @param text 文本
   * @returns 估算的 token 数
   */
  estimateTextTokens(text: string): number {
    if (!text) return 0;
    
    // 检查缓存
    if (this.config.enableCache && this.cache.has(text)) {
      return this.cache.get(text)!;
    }
    
    let tokens: number;
    
    if (this.config.enableSmartDetection) {
      // 智能语言检测
      const language = this.detectLanguage(text);
      tokens = this.estimateByLanguage(text, language);
    } else {
      // 使用默认比例
      tokens = Math.ceil(text.length * this.config.defaultRatio);
    }
    
    // 更新缓存
    if (this.config.enableCache) {
      this.updateCache(text, tokens);
    }
    
    return tokens;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
    };
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
   * 检测文本的主要语言
   * 
   * @param text 文本
   * @returns 语言类型
   */
  private detectLanguage(text: string): 'chinese' | 'english' | 'mixed' {
    if (!text) return 'english';
    
    let chineseChars = 0;
    let englishChars = 0;
    let totalChars = 0;
    
    for (const char of text) {
      const code = char.charCodeAt(0);
      
      // 中文字符范围（简化版）
      if (
        (code >= 0x4e00 && code <= 0x9fff) ||  // CJK Unified Ideographs
        (code >= 0x3400 && code <= 0x4dbf) ||  // CJK Extension A
        (code >= 0x20000 && code <= 0x2a6df)   // CJK Extension B
      ) {
        chineseChars++;
        totalChars++;
      }
      // 英文字符
      else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
        englishChars++;
        totalChars++;
      }
      // 数字和其他字符也计入总数
      else if (code > 32) {
        totalChars++;
      }
    }
    
    if (totalChars === 0) return 'english';
    
    const chineseRatio = chineseChars / totalChars;
    const englishRatio = englishChars / totalChars;
    
    // 中文占比超过 30%
    if (chineseRatio > 0.3) {
      return englishRatio > 0.3 ? 'mixed' : 'chinese';
    }
    
    return 'english';
  }

  /**
   * 根据语言类型估算 token 数
   * 
   * @param text 文本
   * @param language 语言类型
   * @returns 估算的 token 数
   */
  private estimateByLanguage(
    text: string,
    language: 'chinese' | 'english' | 'mixed'
  ): number {
    const length = text.length;
    
    switch (language) {
      case 'chinese':
        // 中文通常每个字符消耗更多 token
        return Math.ceil(length * this.config.chineseRatio);
      
      case 'english':
        // 英文通常每个字符消耗较少 token
        return Math.ceil(length * this.config.englishRatio);
      
      case 'mixed':
        // 混合语言使用默认比例
        return Math.ceil(length * this.config.defaultRatio);
      
      default:
        return Math.ceil(length * this.config.defaultRatio);
    }
  }

  /**
   * 更新缓存（LRU 策略）
   * 
   * @param key 缓存键
   * @param value 缓存值
   */
  private updateCache(key: string, value: number): void {
    // 如果已存在，先删除（移到最后）
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // 如果超过最大容量，删除最旧的条目
    if (this.cache.size >= this.config.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    
    // 添加新条目
    this.cache.set(key, value);
  }
}

/**
 * 创建默认的 token 估算器实例
 */
export function createTokenEstimator(config?: TokenEstimatorConfig): TokenEstimator {
  return new TokenEstimator(config);
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
