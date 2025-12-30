/**
 * 工作流生成器
 * 
 * 负责使用 LLM 生成 DAG 工作流
 */

import type { ILLMClient, Workflow } from '@monkey-agent/types';
import { DAGValidator } from '@monkey-agent/orchestrator';
import { tool } from 'ai';
import { workflowSchema } from './schema';
import { buildWorkflowPrompt } from '../prompts/workflow';

export interface AgentInfo {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
}

export class WorkflowGenerator {
  constructor(
    private llmClient: ILLMClient,
    private getAgentsInfo: () => AgentInfo[]
  ) {}

  /**
   * 生成工作流
   */
  async generate(
    taskDescription: string,
    intent: string,
    requirements?: string[]
  ): Promise<Workflow> {
    const agentsInfo = this.getAgentsInfo();
    const { systemPrompt, userPrompt } = buildWorkflowPrompt(
      agentsInfo,
      taskDescription,
      intent,
      requirements
    );

    const result = await this.llmClient.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      {
        tools: {
          generateWorkflow: tool({
            description: `Generate a DAG-based multi-agent workflow with globally numbered steps.
        
Key concepts:
- Agents form a Directed Acyclic Graph (DAG)
- Use 'dependencies' array to define execution order
- Empty dependencies = runs immediately
- Steps have global sequential numbers (1, 2, 3... across all agents)
- All agents access shared context with previous outputs`,
            inputSchema: workflowSchema,
          }),
        },
        toolChoice: 'required', // 强制 LLM 使用 tool
      }
    );

    // 提取 workflow
    const workflow = this.extractWorkflow(result);
    
    // 验证 DAG
    const validation = DAGValidator.validate(workflow);
    if (!validation.valid) {
      throw new Error(`Invalid workflow DAG: ${validation.error}`);
    }

    return workflow;
  }

  /**
   * 从 LLM 响应中提取 workflow
   */
  private extractWorkflow(result: any): Workflow {
    if (!result.toolCalls || result.toolCalls.length === 0) {
      throw new Error('LLM did not generate workflow tool call');
    }

    const workflowCall = result.toolCalls.find(
      (tc: any) => tc.toolName === 'generateWorkflow'
    );

    if (!workflowCall) {
      throw new Error('No generateWorkflow tool call found');
    }

    // Tool call 的参数已经过 Zod 验证
    // Vercel AI SDK 使用 'args' 或 'input' 字段，取决于版本
    let workflowArgs = (workflowCall as any).args || (workflowCall as any).input;
    
    // 调试信息
    if (!workflowArgs) {
      console.error('Available tool call keys:', Object.keys(workflowCall));
      console.error('Tool calls structure:', JSON.stringify(result.toolCalls, null, 2));
      throw new Error('Workflow args not found. Please check LLM tool call format.');
    }

    // 🔧 修复：如果 agentGraph 是字符串，解析为数组
    // 某些 LLM（如 Gemini）可能会将复杂结构序列化为字符串
    if (workflowArgs.agentGraph && typeof workflowArgs.agentGraph === 'string') {
      try {
        console.log('⚠️ WorkflowGenerator: agentGraph is a string, attempting to parse...');
        
        // 修复策略：处理字符串值内部的中文引号
        let jsonStr = workflowArgs.agentGraph;
        
        // 先把中文引号替换为临时标记
        jsonStr = jsonStr.replace(/"/g, '<<<LEFT_QUOTE>>>').replace(/"/g, '<<<RIGHT_QUOTE>>>');
        
        // 然后把临时标记替换为转义的英文引号
        jsonStr = jsonStr.replace(/<<<LEFT_QUOTE>>>/g, '\\"').replace(/<<<RIGHT_QUOTE>>>/g, '\\"');
        
        // 尝试解析
        workflowArgs = {
          ...workflowArgs,
          agentGraph: JSON.parse(jsonStr)
        };
        console.log('✅ WorkflowGenerator: Successfully parsed agentGraph');
      } catch (error) {
        console.error('❌ WorkflowGenerator: Failed to parse agentGraph string:', error);
        console.error('agentGraph content (first 500 chars):', workflowArgs.agentGraph.substring(0, 500));
        throw new Error(`Failed to parse agentGraph: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // 验证 agentGraph 是数组
    if (!Array.isArray(workflowArgs.agentGraph)) {
      console.error('❌ WorkflowGenerator: agentGraph is not an array after parsing', {
        agentGraphType: typeof workflowArgs.agentGraph,
        agentGraph: workflowArgs.agentGraph
      });
      throw new Error('agentGraph must be an array');
    }

    return workflowArgs as Workflow;
  }
}

