import type { Tool } from 'ai';
import type { z } from 'zod';

/**
 * Tool 执行结果
 */
export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  shouldContinue?: boolean;  // 失败后是否继续 ReAct 循环
}

/**
 * Tool 元数据（可选，用于增强）
 */
export interface ToolMetadata {
  category?: string;      // 'file' | 'network' | 'system'
  tags?: string[];
  version?: string;
}

/**
 * 增强的 Tool 类型（兼容 AI SDK，添加元数据）
 */
export type EnhancedTool<TParameters extends z.ZodTypeAny = any, TResult = any> = 
  Tool<TParameters, TResult> & {
    metadata?: ToolMetadata;
  };

