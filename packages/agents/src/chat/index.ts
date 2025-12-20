export * from './ChatAgent';
export { ChatAgent, IntentType } from './ChatAgent';
export type {
  IntentRecognitionResult,
  ChatAgentConfig,
} from './ChatAgent';

// Re-export types from @monkey-agent/types for convenience
export type { Workflow, AgentNode, AgentNodeStep, AgentExecutionResult } from '@monkey-agent/types';

// Re-export context tools from @monkey-agent/context for convenience
export {
  createContextTools,
  executeContextTool,
  isContextTool,
  buildContextInjectionPrompt,
  type WorkflowExecutionContext,
  type ParentNodeInfo,
  type AgentNodeStep as AgentNodeStepFromContext,
} from '@monkey-agent/context';
