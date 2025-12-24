import type { Tool } from 'ai';
import type { ToolMetadata } from './types';

/**
 * 为 Tool 添加元数据
 * 
 * @param tool 原始 Tool
 * @param metadata 元数据
 * @returns 增强的 Tool
 */
export function withMetadata<T extends Tool>(
  tool: T,
  metadata: ToolMetadata
): T & { metadata: ToolMetadata } {
  return { ...tool, metadata };
}

/**
 * 批量创建 ToolSet（类型安全）
 * 
 * 提供更好的类型推导和 IDE 支持
 * 
 * @param tools Tool 对象
 * @returns 相同的 Tool 对象（类型安全）
 */
export function createToolSet<T extends Record<string, Tool>>(
  tools: T
): T {
  return tools;
}

