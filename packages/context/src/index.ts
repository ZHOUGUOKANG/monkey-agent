/**
 * Context 工具集
 * 
 * 提供工作流执行过程中的上下文管理和共享变量功能
 */

// ============ Context Manager ============
export { ContextManager } from './ContextManager';
export type { ContextManagerConfig } from './ContextManager';

// ============ Types ============
export type {
  WorkflowExecutionContext,
  AgentNodeStep,
  ParentNodeInfo,
} from './types';

// ============ Context Tools ============
export {
  createContextTools,
  isContextTool,
  executeContextTool,
} from './context-tools';

export {
  buildContextInjectionPrompt,
} from './context-injection';
