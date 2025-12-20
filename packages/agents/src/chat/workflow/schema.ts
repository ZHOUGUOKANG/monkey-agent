/**
 * Workflow 生成相关的 Zod Schema
 */

import { z } from 'zod';

/**
 * Agent Node Step Schema - 简化版，兼容所有 LLM providers
 */
export const agentNodeStepSchema = z.object({
  stepNumber: z.number().describe('Global step number across all agents (1, 2, 3...)'),
  desc: z.string().describe('Step description providing execution guidance'),
});

/**
 * Agent Node Schema（DAG 版本）- 简化版，兼容所有 LLM providers
 */
export const agentNodeSchema = z.object({
  id: z.string().describe('Agent unique ID, format: agent-{number}'),
  type: z.string().describe('Agent type: browser, code, file, shell, computer, or image'),
  name: z.string().describe('Agent name'),
  desc: z.string().describe('Clear description of agent responsibility and what it does'),
  steps: z.array(agentNodeStepSchema).describe('1-5 steps with global sequential numbering'),
  dependencies: z.array(z.string()).describe('IDs of agents this agent depends on. Empty array = no dependencies'),
});

/**
 * Workflow Schema（DAG 版本，含验证）
 * 
 * 用于 generateWorkflow tool 的参数验证
 */
export const workflowSchema = z.object({
  id: z.string()
    .regex(/^workflow-\d+$/)
    .describe('Workflow unique ID, format: workflow-{timestamp}'),
  
  name: z.string()
    .min(1)
    .max(100)
    .describe('Descriptive workflow name in user language'),
  
  description: z.string()
    .min(10)
    .max(300)
    .describe('Brief description of what this workflow accomplishes'),
  
  agentGraph: z.array(agentNodeSchema)
    .min(1)
    .max(10)
    .describe('Array of 1-10 agents forming a DAG with globally numbered steps'),
  
  estimatedDuration: z.number()
    .positive()
    .optional()
    .describe('Estimated duration in milliseconds'),
}).refine(
  (data) => {
    // 验证 1: dependencies 引用的 ID 都存在
    const allIds = new Set(data.agentGraph.map(a => a.id));
    for (const agent of data.agentGraph) {
      for (const dep of agent.dependencies) {
        if (!allIds.has(dep)) {
          return false;
        }
      }
    }
    return true;
  },
  { message: 'All dependency IDs must reference existing agents' }
).refine(
  (data) => {
    // 验证 2: 全局 stepNumber 必须唯一且连续
    const allStepNumbers = data.agentGraph
      .flatMap(agent => agent.steps.map(s => s.stepNumber))
      .sort((a, b) => a - b);
    
    // 检查是否从 1 开始连续
    for (let i = 0; i < allStepNumbers.length; i++) {
      if (allStepNumbers[i] !== i + 1) {
        return false;
      }
    }
    return true;
  },
  { message: 'Step numbers must be unique and sequential starting from 1' }
);

