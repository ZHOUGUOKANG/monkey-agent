// 导出类型
export type { ToolResult, ToolMetadata, EnhancedTool } from './types';

// 导出执行器
export { ToolExecutor } from './ToolExecutor';
export type { ToolExecutorConfig } from './ToolExecutor';

// 导出辅助函数
export { withMetadata, createToolSet } from './helpers';

// 重新导出 AI SDK 的 tool
export { tool } from 'ai';
export type { Tool } from 'ai';

