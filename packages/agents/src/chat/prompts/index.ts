/**
 * Prompt 模板集合
 */

export { buildSystemPrompt, type AgentInfo as AgentInfoForSystem } from './system';
export { buildIntentPrompt } from './intent';
export {
  buildWorkflowSystemPrompt,
  buildWorkflowUserPrompt,
  buildWorkflowPrompt,
  type AgentInfo as AgentInfoForWorkflow,
} from './workflow';

