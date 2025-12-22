/**
 * Context 工具集
 * 
 * 提供工作流执行过程中的上下文管理和共享变量功能
 */

// 类型导出
export type {
  WorkflowExecutionContext,
  AgentNodeStep,
  ParentNodeInfo,
} from './types';

// 工具函数导出
export {
  createContextTools,
  isContextTool,
  executeContextTool,
} from './context-tools';

export {
  buildContextInjectionPrompt,
} from './context-injection';

