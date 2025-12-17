/**
 * 摘要生成工具
 * 
 * 使用 LLM 生成对话历史的简洁摘要
 */

import type { ModelMessage } from 'ai';
import type { ILLMClient } from '@monkey-agent/types';

/**
 * 摘要生成器配置
 */
export interface SummaryGeneratorConfig {
  /** 摘要最大字数（默认 200） */
  maxWords?: number;
  /** 输出语言（默认 'auto'，自动检测） */
  language?: 'chinese' | 'english' | 'auto';
  /** 自定义 prompt 模板（可选） */
  promptTemplate?: string;
  /** 摘要策略（默认 'balanced'） */
  strategy?: 'concise' | 'balanced' | 'detailed';
}

/**
 * 摘要生成器
 */
export class SummaryGenerator {
  private config: Required<SummaryGeneratorConfig>;

  constructor(
    private llmClient: ILLMClient,
    config: SummaryGeneratorConfig = {}
  ) {
    this.config = {
      maxWords: config.maxWords ?? 200,
      language: config.language ?? 'auto',
      promptTemplate: config.promptTemplate ?? this.getDefaultPromptTemplate(),
      strategy: config.strategy ?? 'balanced',
    };
  }

  /**
   * 使用 LLM 总结消息列表
   * 
   * @param messages 要总结的消息列表
   * @returns 摘要文本
   */
  async summarizeMessages(messages: ModelMessage[]): Promise<string> {
    const messagesText = this.formatMessagesForSummary(messages);
    
    // 使用自定义或默认 prompt
    const summaryPrompt = this.buildSummaryPrompt(messagesText);
    
    const response = await this.llmClient.chat([
      { role: 'user', content: summaryPrompt },
    ], {
      maxSteps: 1, // 不使用工具
    });
    
    return response.text;
  }

  /**
   * 构建摘要 prompt
   * 
   * @param messagesText 格式化的消息文本
   * @returns prompt 文本
   */
  private buildSummaryPrompt(messagesText: string): string {
    const languageInstruction = this.getLanguageInstruction();
    const strategyInstruction = this.getStrategyInstruction();
    
    // 如果有自定义模板，使用占位符替换
    if (this.config.promptTemplate !== this.getDefaultPromptTemplate()) {
      return this.config.promptTemplate
        .replace('{messages}', messagesText)
        .replace('{maxWords}', String(this.config.maxWords))
        .replace('{language}', languageInstruction)
        .replace('{strategy}', strategyInstruction);
    }
    
    // 使用默认模板
    return `Please provide a ${strategyInstruction} summary of the following conversation history, preserving key information, decisions, and results.
Note: This is an early part of a multi-turn conversation and needs to provide context for subsequent dialogue.

Conversation history:
${messagesText}

Please summarize concisely (within ${this.config.maxWords} words)${languageInstruction}, focusing on:
1. Main tasks or operations completed
2. Key information or data obtained
3. Important decisions made

Summary:`;
  }

  /**
   * 获取语言指令
   */
  private getLanguageInstruction(): string {
    switch (this.config.language) {
      case 'chinese':
        return ' in Chinese';
      case 'english':
        return ' in English';
      case 'auto':
        return ''; // 让 LLM 自动选择
      default:
        return '';
    }
  }

  /**
   * 获取策略指令
   */
  private getStrategyInstruction(): string {
    switch (this.config.strategy) {
      case 'concise':
        return 'brief';
      case 'detailed':
        return 'comprehensive';
      case 'balanced':
      default:
        return 'concise';
    }
  }

  /**
   * 获取默认 prompt 模板
   */
  private getDefaultPromptTemplate(): string {
    return 'DEFAULT_TEMPLATE';
  }

  /**
   * 格式化消息列表为文本（用于摘要）
   * 
   * @param messages 消息列表
   * @returns 格式化后的文本
   */
  private formatMessagesForSummary(messages: ModelMessage[]): string {
    return messages.map(msg => {
      const role = this.getRoleLabel(msg.role);
      const content = this.extractMessageContent(msg);
      return `${role}: ${content}`;
    }).join('\n');
  }

  /**
   * 获取角色标签
   * 
   * @param role 角色
   * @returns 英文标签
   */
  private getRoleLabel(role: string): string {
    switch (role) {
      case 'user':
        return 'User';
      case 'assistant':
        return 'Assistant';
      case 'tool':
        return 'Tool Result';
      case 'system':
        return 'System';
      default:
        return role;
    }
  }

  /**
   * 提取消息内容（用于摘要）
   * 
   * @param msg 消息
   * @returns 提取的文本内容
   */
  private extractMessageContent(msg: ModelMessage): string {
    if (typeof msg.content === 'string') {
      return msg.content;
    }
    
    if (Array.isArray(msg.content)) {
      // 提取关键信息
      return msg.content.map((part: any) => {
        if (part.type === 'text') {
          return part.text;
        }
        
        if (part.type === 'tool-call') {
          const args = JSON.stringify(part.args);
          return `[Called ${part.toolName}(${args})]`;
        }
        
        if (part.type === 'tool-result') {
          const output = part.output;
          const outputText = typeof output === 'string' 
            ? output 
            : output?.value || JSON.stringify(output);
          
          // 截断过长的输出
          const maxLength = 100;
          if (outputText.length > maxLength) {
            return `[Tool result: ${outputText.substring(0, maxLength)}...]`;
          }
          return `[Tool result: ${outputText}]`;
        }
        
        return '';
      }).join(' ');
    }
    
    return '';
  }
}

/**
 * 快捷函数：使用 LLM 总结消息列表
 * 
 * @param messages 要总结的消息列表
 * @param llmClient LLM 客户端
 * @returns 摘要文本
 */
export async function summarizeMessages(
  messages: ModelMessage[],
  llmClient: ILLMClient
): Promise<string> {
  const generator = new SummaryGenerator(llmClient);
  return generator.summarizeMessages(messages);
}
