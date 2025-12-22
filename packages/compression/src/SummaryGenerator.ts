/**
 * 摘要生成工具
 * 
 * 使用 LLM 生成对话历史的简洁摘要
 */

import type { ModelMessage } from 'ai';
import type { LLMClient } from '@monkey-agent/llm';

/**
 * 摘要生成器
 */
export class SummaryGenerator {
  constructor(private llmClient: LLMClient) {}

  /**
   * 使用 LLM 总结消息列表
   * 
   * @param messages 要总结的消息列表
   * @returns 摘要文本
   */
  async summarizeMessages(messages: ModelMessage[]): Promise<string> {
    const messagesText = this.formatMessagesForSummary(messages);
    
    const summaryPrompt = `Please provide a concise summary of the following conversation history, preserving key information, decisions, and results.
Note: This is an early part of a multi-turn conversation and needs to provide context for subsequent dialogue.

Conversation history:
${messagesText}

Please summarize concisely (within 200 words), focusing on:
1. Main tasks or operations completed
2. Key information or data obtained
3. Important decisions made

Summary:`;
    
    const response = await this.llmClient.chat([
      { role: 'user', content: summaryPrompt },
    ], {
      maxSteps: 1, // 不使用工具
    });
    
    return response.text;
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
  llmClient: LLMClient
): Promise<string> {
  const generator = new SummaryGenerator(llmClient);
  return generator.summarizeMessages(messages);
}
