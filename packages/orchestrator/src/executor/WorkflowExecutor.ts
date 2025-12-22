/**
 * 工作流执行器
 */

import EventEmitter from 'eventemitter3';
import type { IAgent, Task, AgentNode } from '@monkey-agent/types';
import type { ExecutionContext } from '../state/ExecutionContext';
import type { WorkflowExecutionOptions, IExecutor } from '../types';

/**
 * 工作流执行器
 * 
 * 负责执行工作流中的 Agent:
 * - 按层级并行执行
 * - 构建 Task 并传递依赖输出
 * - 错误处理和重试
 * - 事件发射
 */
export class WorkflowExecutor extends EventEmitter implements IExecutor {
  constructor(private agents: Map<string, IAgent>) {
    super();
  }

  /**
   * 执行一个层级的 Agents
   * 
   * @param levelAgentIds 当前层级的 Agent IDs
   * @param agentGraph 完整的 Agent 图
   * @param context 执行上下文
   * @param options 执行选项
   */
  async executeLevel(
    levelAgentIds: string[],
    agentGraph: AgentNode[],
    context: ExecutionContext,
    options?: WorkflowExecutionOptions
  ): Promise<void> {
    // 并行执行当前层级的所有 Agents
    const promises = levelAgentIds.map(async (agentId) => {
      const agentNode = agentGraph.find(n => n.id === agentId);
      if (!agentNode) {
        throw new Error(`Agent node not found: ${agentId}`);
      }

      return this.executeAgent(agentNode, context, options);
    });

    // 等待所有 Agent 完成
    await Promise.all(promises);
  }

  /**
   * 执行单个 Agent
   * 
   * @param agentNode Agent 节点
   * @param context 执行上下文
   * @param options 执行选项
   */
  private async executeAgent(
    agentNode: AgentNode,
    context: ExecutionContext,
    options?: WorkflowExecutionOptions
  ): Promise<void> {
    const agentState = context.getAgentState(agentNode.id);
    agentState.status = 'running';
    agentState.startTime = Date.now();

    this.emit('agent:start', { 
      agentId: agentNode.id, 
      type: agentNode.type 
    });

    try {
      // 1. 获取对应类型的 Agent 实例
      const agent = this.getAgentByType(agentNode.type);
      if (!agent) {
        throw new Error(`No agent found for type: ${agentNode.type}`);
      }

      // 2. 构建 Task
      const task = this.buildTask(agentNode, context);

      // 3. 执行 Agent
      const result = await agent.execute(task);

      // 4. 保存结果到上下文
      agentState.status = 'completed';
      agentState.result = result;
      context.setOutput(agentNode.id, result);

      this.emit('agent:complete', { 
        agentId: agentNode.id, 
        result 
      });

    } catch (error) {
      agentState.status = 'failed';
      agentState.error = error as Error;

      this.emit('agent:error', { 
        agentId: agentNode.id, 
        error 
      });

      // 重试逻辑
      if (options?.maxRetries && agentState.retryCount < options.maxRetries) {
        agentState.retryCount++;
        agentState.status = 'pending'; // 重置状态
        
        this.emit('agent:retry', { 
          agentId: agentNode.id, 
          attempt: agentState.retryCount 
        });
        
        // 递归重试
        return this.executeAgent(agentNode, context, options);
      }

      // 如果不允许继续执行,抛出错误
      if (!options?.continueOnError) {
        throw error;
      }
    } finally {
      agentState.endTime = Date.now();
      agentState.duration = agentState.endTime - (agentState.startTime || 0);
    }
  }

  /**
   * 根据类型获取 Agent 实例
   * 
   * @param type Agent 类型
   * @returns Agent 实例或 undefined
   */
  private getAgentByType(type: string): IAgent | undefined {
    // 策略 1: 精确匹配 agent id (例如: 'code-agent')
    const exactMatch = this.agents.get(`${type}-agent`);
    if (exactMatch) {
      return exactMatch;
    }

    // 策略 2: 包含类型的 id 或 name
    for (const agent of this.agents.values()) {
      const idLower = agent.id.toLowerCase();
      const nameLower = agent.name.toLowerCase();
      const typeLower = type.toLowerCase();
      
      if (idLower.includes(typeLower) || nameLower.includes(typeLower)) {
        return agent;
      }
    }

    return undefined;
  }

  /**
   * 构建 Task
   * 
   * @param agentNode Agent 节点
   * @param context 执行上下文
   * @returns Task 对象
   */
  private buildTask(agentNode: AgentNode, context: ExecutionContext): Task {
    // 收集依赖输出
    const dependencyOutputs: Record<string, any> = {};
    for (const depId of agentNode.dependencies) {
      const output = context.getOutput(depId);
      if (output) {
        dependencyOutputs[depId] = output;
      }
    }

    return {
      id: `task-${agentNode.id}`,
      type: agentNode.type,
      description: agentNode.desc,
      parameters: {
        steps: agentNode.steps,
        dependencies: dependencyOutputs,
        agentNode, // 传递完整的节点信息
      },
      context: {
        sessionId: context.workflowId,
        environment: 'node',
        metadata: {
          agentId: agentNode.id,
          agentName: agentNode.name,
          workflowId: context.workflowId,
        },
      },
    };
  }
}

