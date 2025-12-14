/**
 * ReAct 循环执行器
 * 
 * 负责执行标准的 ReAct（Reasoning + Acting）循环
 */

import type { ModelMessage, ToolSet } from 'ai';
import type { ILLMClient, IChatResult } from '@monkey-agent/types';
import EventEmitter from 'eventemitter3';
import type { ContextManager } from '@monkey-agent/context';
import { buildAssistantMessage, buildToolResultMessage } from '@monkey-agent/llm';
import { Logger } from '@monkey-agent/logger';

const logger = new Logger('ReactLoop');

/**
 * ReAct 循环选项
 */
export interface ReactLoopOptions {
  systemPrompt: string;
  userMessage: string;
  tools: ToolSet;
  toolExecutor: (toolName: string, input: any) => Promise<any>;
  llmClient: ILLMClient;
  contextManager: ContextManager;
  maxIterations: number;
  /** 是否启用流式输出（默认 false） */
  enableStreaming?: boolean;
  /** 流式文本回调 */
  onStreamChunk?: (chunk: string) => void;
}

/**
 * ReAct 循环结果
 */
export interface ReactResult {
  data: any;
  summary: string;
  finishReason: string;
  iterations?: number;  // 实际执行的迭代次数
}

/**
 * ReAct 循环执行器
 * 
 * 实现标准的 ReAct 循环：Think → Act → Observe → Think...
 */
export class ReactLoop extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * 发射事件（自动添加 timestamp）
   */
  private emitEvent(type: string, payload: Record<string, any>) {
    this.emit(type, { ...payload, timestamp: Date.now() });
  }

  /**
   * 运行 ReAct 循环
   * 
   * @param options 循环选项
   * @returns 执行结果
   */
  async run(options: ReactLoopOptions): Promise<ReactResult> {
    const {
      systemPrompt,
      userMessage,
      tools,
      toolExecutor,
      llmClient,
      contextManager,
      maxIterations,
    } = options;

    // 初始化对话历史
    const conversationHistory: ModelMessage[] = [
      { role: 'user', content: userMessage } as ModelMessage
    ];

    let result: ReactResult | null = null;
    let iteration = 0;

    // ReAct 循环
    while (iteration < maxIterations) {
      iteration++;

      this.emitEvent('react:thinking', {
        iteration,
        historyLength: conversationHistory.length
      });

      // 管理上下文（定期压缩检查）
      const managedHistory = await contextManager.manageContext(
        conversationHistory,
        iteration
      );
      
      // 如果历史被压缩，更新引用
      if (managedHistory !== conversationHistory) {
        conversationHistory.length = 0;
        conversationHistory.push(...managedHistory);
        
        this.emitEvent('react:compressed', {
          afterCount: conversationHistory.length,
          iteration
        });
      }

      // 调用 LLM（支持流式输出）
      let llmResult: IChatResult;
      try {
        // 调试：打印传递给 LLM 的工具列表
        logger.debug(`Iteration ${iteration}: Calling LLM`, {
          toolsCount: Object.keys(tools).length,
          tools: Object.keys(tools)
        });
        
        // 如果启用流式输出，使用 stream API
        if (options.enableStreaming) {
          const streamResult = llmClient.stream(
            conversationHistory,
            {
              system: systemPrompt,
              tools,
              // 移除 maxSteps 限制，允许 LLM 一次返回多个工具调用
            }
          );

          // 收集流式数据
          let fullText = '';
          let toolCalls: any[] = [];
          let finishReason: string | undefined;

          // 遍历完整事件流
          for await (const part of streamResult.fullStream) {
            logger.stream(part);
            
            if (part.type === 'text-delta') {
              const textDelta = (part as any).text ?? part.textDelta ?? '';
              if (textDelta) {
                fullText += textDelta;
                this.emitEvent('react:stream-text', {
                  textDelta,
                  iteration
                });
                options.onStreamChunk?.(textDelta);
              }
            } else if (part.type === 'tool-call') {
              toolCalls.push({
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                input: part.input
              });
            } else if (part.type === 'finish') {
              finishReason = part.finishReason;
              
              if (part.totalUsage) {
                this.emitEvent('react:stream-finish', {
                  finishReason,
                  usage: part.totalUsage,
                  iteration
                });
              }
            }
          }

          logger.debug(`Stream complete: ${fullText.length} chars, ${toolCalls.length} tool calls, finish: ${finishReason}`);

          // 等待 usage 信息
          const usage = await streamResult.usage;

          // 构建完整结果
          llmResult = {
            text: fullText,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            finishReason: finishReason || 'stop',
            usage,
          };
        } else {
          // 非流式调用
          logger.debug('Non-streaming call', {
            toolsCount: Object.keys(tools).length
          });
          llmResult = await llmClient.chat(
            conversationHistory,
            {
              system: systemPrompt,
              tools,
              // 移除 maxSteps 限制，允许 LLM 一次返回多个工具调用
            }
          );
        }
      } catch (error: any) {
        // 处理上下文长度错误
        if (contextManager.isContextLengthError(error.message)) {
          this.emitEvent('react:context-length-error', {
            error: error.message,
            historyLength: conversationHistory.length
          });

          // 强制压缩
          const compressedHistory = await contextManager.handleContextLengthError(
            conversationHistory
          );
          conversationHistory.length = 0;
          conversationHistory.push(...compressedHistory);

          // 重试（使用非流式以简化错误处理）
          llmResult = await llmClient.chat(
            conversationHistory,
            {
              system: systemPrompt,
              tools,
              // 移除 maxSteps 限制
            }
          );
        } else {
          throw error;
        }
      }

      // 检查是否有工具调用
      if (llmResult.toolCalls && llmResult.toolCalls.length > 0) {
        // 处理所有工具调用（顺序执行）
        const toolCalls = llmResult.toolCalls;
        
        logger.debug(`LLM returned ${toolCalls.length} tool call(s)`);

        // 1. 添加 assistant 消息（包含所有工具调用）
        conversationHistory.push(
          buildAssistantMessage(
            toolCalls.map(tc => ({
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              input: tc.input
            })),
            llmResult.text
          ) as ModelMessage
        );

        // 2. 顺序执行所有工具调用
        let foundFinalResult = false;  // 标记是否找到最终结果
        
        for (const toolCall of toolCalls) {
          // 发射工具调用事件
          this.emitEvent('react:action', {
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            input: toolCall.input,
            iteration,
            totalCalls: toolCalls.length
          });

          // 执行工具
          let toolResult: { success: boolean; data?: any; error?: string };
          try {
            const data = await toolExecutor(toolCall.toolName, toolCall.input);
            toolResult = { success: true, data };
            
            // 检查是否是最终结果（特殊标记）
            if (data && typeof data === 'object' && data.__final_result__) {
              // 工具返回了最终结果，立即停止循环
              this.emitEvent('react:observation', {
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                result: 'Final result generated',
                iteration,
                isFinal: true
              });
              
              // 移除特殊标记
              const { __final_result__, ...finalData } = data;
              
              result = {
                data: finalData,
                summary: `Task completed: ${toolCall.toolName} generated final result`,
                finishReason: 'stop',
                iterations: iteration
              };
              
              foundFinalResult = true;
              break; // 跳出 for 循环
            }
          } catch (error: any) {
            toolResult = { success: false, error: error.message };
          }

          // 3. 添加工具结果到对话历史
          if (toolResult.success) {
            this.emitEvent('react:observation', {
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              result: toolResult.data,
              success: true,
              iteration
            });

            conversationHistory.push(
              buildToolResultMessage(
                { toolCallId: toolCall.toolCallId, toolName: toolCall.toolName },
                toolResult.data,
                false
              ) as ModelMessage
            );
          } else {
            this.emitEvent('react:observation-error', {
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              error: toolResult.error,
              iteration
            });

            conversationHistory.push(
              buildToolResultMessage(
                { toolCallId: toolCall.toolCallId, toolName: toolCall.toolName },
                `Error executing tool: ${toolResult.error}`,
                true  // isError
              ) as ModelMessage
            );

            // 注意：工具失败后默认继续执行剩余工具和 ReAct 循环
          }
        }
        
        // 如果找到最终结果，跳出 while 循环
        if (foundFinalResult) {
          break;
        }
      } else {
        // 没有工具调用：任务完成
        conversationHistory.push({
          role: 'assistant',
          content: llmResult.text || ''
        } as ModelMessage);

        const hasText = llmResult.text && llmResult.text.trim().length > 0;
        const finishReason = llmResult.finishReason || 'stop';

        if (hasText) {
          result = {
            data: { response: llmResult.text },
            summary: llmResult.text || 'Task completed',
            finishReason,
            iterations: iteration
          };
        } else {
          // 无工具调用且无文本响应：异常情况
          this.emitEvent('react:warning', {
            message: 'No tool calls and no text response',
            finishReason,
            iteration
          });

          result = {
            data: { response: '' },
            summary: 'Task completed without response',
            finishReason,
            iterations: iteration
          };
        }

        break;
      }
    }

    // 达到最大迭代次数
    if (!result) {
      this.emitEvent('react:max-iterations', {
        maxIterations
      });

      result = {
        data: { response: 'Max iterations reached' },
        summary: 'Task completed with max iterations',
        finishReason: 'max-iterations',
        iterations: maxIterations
      };
    }

    return result;
  }
}

