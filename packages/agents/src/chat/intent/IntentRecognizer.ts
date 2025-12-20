/**
 * 意图识别器
 * 
 * 负责分析用户输入并识别意图类型
 */

import type { ILLMClient } from '@monkey-agent/types';
import { IntentRecognitionResult, IntentType } from './types';
import { intentSchema } from './schema';
import { buildIntentPrompt } from '../prompts/intent';

export class IntentRecognizer {
  constructor(private llmClient: ILLMClient) {}

  /**
   * 识别用户消息的意图
   */
  async recognize(
    userMessage: string,
    context?: Record<string, any>
  ): Promise<IntentRecognitionResult> {
    const prompt = buildIntentPrompt(userMessage, context);
    
    const result = await this.llmClient.chat([
      { role: 'user', content: prompt }
    ]);

    try {
      return this.parseResponse(result.text);
    } catch (error) {
      // 降级处理：无法识别时返回不确定
      return {
        intent: IntentType.UNCERTAIN,
        confidence: 0.5,
        explanation: 'Unable to clearly identify the intent',
        needsMultiAgent: false,
      };
    }
  }

  /**
   * 解析 LLM 响应并提取意图信息
   */
  private parseResponse(responseText: string): IntentRecognitionResult {
    const json = this.extractJSON(responseText);
    return intentSchema.parse(json);
  }

  /**
   * 从文本中提取 JSON（支持多种格式）
   */
  private extractJSON(text: string): any {
    // 尝试 1: 提取 markdown 代码块中的 JSON
    const markdownMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
      try {
        return JSON.parse(markdownMatch[1]);
      } catch {
        // 继续尝试其他方式
      }
    }

    // 尝试 2: 提取纯 JSON 对象
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // 继续尝试其他方式
      }
    }

    // 尝试 3: 整个文本就是 JSON
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('No valid JSON found in response');
    }
  }
}

