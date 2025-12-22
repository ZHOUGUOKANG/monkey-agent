import { tool } from 'ai';
import { z } from 'zod';
import type { WorkflowExecutionContext } from './types';

/**
 * 创建上下文工具集
 * 提供 valSet 和 valGet 功能，让 Agent 可以在共享上下文中存储和读取变量
 */
export function createContextTools(context: WorkflowExecutionContext) {
  return {
    /**
     * 设置共享变量
     * Agent 可以使用此工具在共享上下文中保存 key-value 数据
     */
    valSet: tool({
      description: `Set a variable in the shared workflow context. 
      
Use this to save data that other agents or future steps might need.
Examples:
- valSet({ key: "productData", value: [...array of products...] })
- valSet({ key: "analysisResult", value: { summary: "...", insights: [...] } })
- valSet({ key: "filePath", value: "/path/to/output.csv" })

The value can be any JSON-serializable data: string, number, boolean, object, or array.`,
      parameters: z.object({
        key: z.string().min(1).describe('Variable name/key'),
        value: z.any().describe('Value to store (any JSON-serializable data)'),
      }),
    }),

    /**
     * 获取共享变量
     * Agent 可以使用此工具读取其他 Agent 保存的变量
     */
    valGet: tool({
      description: `Get a variable from the shared workflow context.

Use this to retrieve data that was set by previous agents or steps.
Returns the value if the key exists, or null if not found.

Examples:
- valGet({ key: "productData" })
- valGet({ key: "analysisResult" })
- valGet({ key: "filePath" })`,
      parameters: z.object({
        key: z.string().min(1).describe('Variable name/key to retrieve'),
      }),
    }),

    /**
     * 列出所有可用的共享变量
     * Agent 可以查看当前上下文中有哪些变量可用
     */
    valList: tool({
      description: `List all available variables in the shared workflow context.

Use this to discover what data is available from previous agents.
Returns an array of key names.`,
      parameters: z.object({}),
    }),
  };
}

/**
 * 检查是否是上下文工具
 */
export function isContextTool(toolName: string): boolean {
  return ['valSet', 'valGet', 'valList'].includes(toolName);
}

/**
 * 执行上下文工具
 * 如果不是上下文工具，返回 null
 */
export async function executeContextTool(
  toolName: string,
  input: any,
  context: WorkflowExecutionContext
): Promise<any> {
  switch (toolName) {
    case 'valSet':
      context.vals.set(input.key, input.value);
      return {
        success: true,
        message: `Variable '${input.key}' has been set successfully`,
      };

    case 'valGet':
      const value = context.vals.get(input.key);
      if (value === undefined) {
        return {
          success: false,
          message: `Variable '${input.key}' not found`,
          value: null,
        };
      }
      return {
        success: true,
        value,
      };

    case 'valList':
      const keys = Array.from(context.vals.keys());
      return {
        success: true,
        keys,
        count: keys.length,
      };

    default:
      throw new Error(`Unknown context tool: ${toolName}`);
  }
}

