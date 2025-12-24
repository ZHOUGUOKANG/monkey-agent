/**
 * Orchestrator Package - 统一使用 WorkflowOrchestrator
 */

// 主要导出 WorkflowOrchestrator
export { WorkflowOrchestrator } from './WorkflowOrchestrator';

// 别名（更短的名称）
export { WorkflowOrchestrator as Orchestrator } from './WorkflowOrchestrator';

// 核心组件
export { ExecutionContext } from './state/ExecutionContext';
export { TopologicalScheduler } from './scheduler/TopologicalScheduler';
export { WorkflowExecutor } from './executor/WorkflowExecutor';
export {
  ErrorHandler,
  ExponentialBackoffRetry,
  ErrorType,
  ErrorSeverity,
  type EnhancedError,
} from './error/ErrorHandler';
export { ProgressTracker } from './monitor/ProgressTracker';
export { DAGValidator } from './validation/DAGValidator';

// 类型导出
export type {
  AgentExecutionState,
  WorkflowExecutionOptions,
  WorkflowExecutionResult,
  ExecutionMetrics,
  ExecutionEvent,
  IErrorHandler,
  IScheduler,
  IExecutor,
} from './types';

// 注意：
// 不再重导出 @monkey-agent/context 和 @monkey-agent/types 的内容
// 使用者应该直接从对应的包导入，以避免循环依赖和维护复杂性
// 
// 如需使用 context tools，请从 @monkey-agent/context 导入：
// import { createContextTools, isContextTool, executeContextTool } from '@monkey-agent/context';
//
// 如需使用 Workflow 类型，请从 @monkey-agent/types 导入：
// import type { Workflow, AgentNode, AgentContext } from '@monkey-agent/types';

