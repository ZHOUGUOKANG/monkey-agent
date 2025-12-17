/**
 * AI SDK 消息构建工具函数
 * 
 * 这些函数用于构建符合 AI SDK v5 格式的消息，
 * 可以在 BaseAgent、LLMClient 和其他需要构造 AI SDK 消息的地方使用。
 */

import type { ModelMessage } from 'ai';

/**
 * 构建助手消息（包含文本和工具调用）
 * 
 * 用于在工具调用后构建助手消息，方便添加到对话历史。
 * 
 * 注意：
 * - AI SDK 5.x 的 tool-call content 包含 input 字段（不是 args）
 * - 当 LLM 同时返回文本和工具调用时，必须将文本部分也包含在助手消息中。
 * 
 * @param toolCalls 工具调用列表
 * @param text 可选的文本内容（推理/思考过程）
 * @returns 助手消息
 * 
 * @example
 * ```typescript
 * const message = buildAssistantMessage(
 *   [{ toolCallId: 'call_123', toolName: 'getWeather', input: { city: 'Beijing' } }],
 *   'Let me check the weather'
 * );
 * // 结果：
 * // {
 * //   role: 'assistant',
 * //   content: [
 * //     { type: 'text', text: 'Let me check the weather' },
 * //     { type: 'tool-call', toolCallId: 'call_123', toolName: 'getWeather', input: { city: 'Beijing' } }
 * //   ]
 * // }
 * ```
 */
export function buildAssistantMessage(
  toolCalls: Array<{ toolCallId: string; toolName: string; input?: any }>,
  text?: string
): ModelMessage {
  // 构建 content 数组
  type TextContent = { type: 'text'; text: string };
  type ToolCallContent = { 
    type: 'tool-call'; 
    toolCallId: string; 
    toolName: string; 
    input: Record<string, any> 
  };
  
  const content: Array<TextContent | ToolCallContent> = [];
  
  // 如果有文本内容，先添加文本部分
  if (text && text.trim().length > 0) {
    content.push({
      type: 'text',
      text: text.trim(),
    });
  }
  
  // 添加工具调用部分
  // 注意：AI SDK 5.x 使用 input 字段，不是 args
  content.push(...toolCalls.map(tc => ({
    type: 'tool-call' as const,
    toolCallId: tc.toolCallId,
    toolName: tc.toolName,
    // 确保 input 始终是一个对象（即使为空）
    // 这对于某些提供商（如 LiteLLM/OpenRouter）是必需的
    input: tc.input ?? {},
  })));
  
  return {
    role: 'assistant',
    content,
  } as ModelMessage;
}

/**
 * 构建工具结果消息
 * 
 * 简化工具执行结果的消息构建。
 * 
 * AI SDK 5.x 要求 tool-result 的 output 必须包含 type 和 value 字段：
 * - type: 内容类型，通常为 'text'
 * - value: 结果值（字符串）
 * 
 * @param toolCall 工具调用信息
 * @param result 工具执行结果
 * @param isError 是否为错误结果
 * @returns 工具结果消息
 * 
 * @example
 * ```typescript
 * const message = buildToolResultMessage(
 *   { toolCallId: 'call_123', toolName: 'getWeather' },
 *   { temperature: 22, conditions: 'Sunny' }
 * );
 * // 结果：
 * // {
 * //   role: 'tool',
 * //   content: [{
 * //     type: 'tool-result',
 * //     toolCallId: 'call_123',
 * //     toolName: 'getWeather',
 * //     output: { type: 'text', value: '{"temperature":22,"conditions":"Sunny"}' }
 * //   }]
 * // }
 * ```
 */
export function buildToolResultMessage(
  toolCall: { toolCallId: string; toolName: string },
  result: any,
  isError: boolean = false
): ModelMessage {
  // AI SDK 5.x 要求 tool-result 的 output 必须是包含 type 和 value 字段的对象
  // 注意：使用 value 字段，不是 text
  type ToolOutput = { type: string; value: string };
  
  let output: ToolOutput;
  if (typeof result === 'string') {
    output = { type: 'text', value: result };
  } else if (result && typeof result === 'object') {
    // 如果已经有 type 和 value 字段，直接使用
    if ('type' in result && 'value' in result) {
      output = result as ToolOutput;
    } else {
      // 否则包装成 text 类型，使用 JSON 字符串
      output = { type: 'text', value: JSON.stringify(result) };
    }
  } else {
    // 其他类型（number, boolean等），转换为 text
    output = { type: 'text', value: String(result) };
  }
  
  type ToolResultContent = {
    type: 'tool-result';
    toolCallId: string;
    toolName: string;
    output: ToolOutput;
    isError?: boolean;
  };
  
  const content: ToolResultContent = {
    type: 'tool-result',
    toolCallId: toolCall.toolCallId,
    toolName: toolCall.toolName,
    output,
    ...(isError && { isError: true }),
  };
  
  return {
    role: 'tool',
    content: [content],
  } as ModelMessage;
}

