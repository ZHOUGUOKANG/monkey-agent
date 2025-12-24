/**
 * 工作流执行器
 */

import EventEmitter from 'eventemitter3';
import type { IAgent, AgentNode } from '@monkey-agent/types';
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
    // 检查是否已取消
    if (context.isCancelled) {
      throw new Error(`Workflow ${context.workflowId} was cancelled`);
    }

    const agentState = context.getAgentState(agentNode.id);
    agentState.status = 'running';
    agentState.startTime = Date.now();

    this.emit('agent:start', { 
      nodeId: agentNode.id,  // workflow 节点 ID
      agentId: agentNode.id,  // 保持兼容
      type: agentNode.type 
    });

    try {
      // 1. 获取对应的 Agent 实例（通过 ID 或 name）
      const agent = this.getAgentByIdOrName(agentNode.type);
      if (!agent) {
        throw new Error(`No agent found for identifier: ${agentNode.type}`);
      }

      // 2. 监听 Agent 的事件并转发
      // 注意：监听 agent:* 外部事件，而不是 react:* 内部事件
      // 这样保持 Orchestrator 层与 Agent 实现细节的解耦
      const thinkingListener = (data: any) => {
        this.emit('agent:thinking', {
          ...data,  // 已经包含 agentId、iteration 等信息
          nodeId: agentNode.id  // 添加节点 ID，区分 workflow 节点和实际 agent
        });
      };
      
      const toolCallListener = (data: any) => {
        this.emit('agent:tool-call', {
          ...data,  // 已经包含 toolName、input 等信息
          nodeId: agentNode.id
        });
      };
      
      const toolResultListener = (data: any) => {
        this.emit('agent:tool-result', {
          ...data,  // 已经包含 result、success 等信息
          nodeId: agentNode.id
        });
      };

      const taskCompleteListener = (result: any) => {
        this.emit('agent:task-complete', {
          nodeId: agentNode.id,
          result,
        });
      };

      const reflectionListener = (reflection: any) => {
        this.emit('agent:reflection', {
          nodeId: agentNode.id,
          reflection,
        });
      };

      const toolErrorListener = (data: any) => {
        this.emit('agent:tool-error', {
          ...data,
          nodeId: agentNode.id
        });
      };

      const compressedListener = (data: any) => {
        this.emit('agent:compressed', {
          ...data,
          nodeId: agentNode.id
        });
      };

      const warningListener = (data: any) => {
        this.emit('agent:warning', {
          ...data,
          nodeId: agentNode.id
        });
      };
      
      const streamTextListener = (data: any) => {
        this.emit('agent:stream-text', {
          ...data,
          nodeId: agentNode.id
        });
      };
      
      const streamFinishListener = (data: any) => {
        this.emit('agent:stream-finish', {
          ...data,
          nodeId: agentNode.id
        });
      };
      
      const contextLengthErrorListener = (data: any) => {
        this.emit('agent:context-length-error', {
          ...data,
          nodeId: agentNode.id
        });
      };
      
      const maxIterationsListener = (data: any) => {
        this.emit('agent:max-iterations', {
          ...data,
          nodeId: agentNode.id
        });
      };

      agent.on('agent:thinking', thinkingListener);
      agent.on('agent:tool-call', toolCallListener);
      agent.on('agent:tool-result', toolResultListener);
      agent.on('agent:tool-error', toolErrorListener);
      agent.on('agent:compressed', compressedListener);
      agent.on('agent:warning', warningListener);
      agent.on('agent:stream-text', streamTextListener);
      agent.on('agent:stream-finish', streamFinishListener);
      agent.on('agent:context-length-error', contextLengthErrorListener);
      agent.on('agent:max-iterations', maxIterationsListener);
      agent.on('task:complete', taskCompleteListener);
      agent.on('task:reflect', reflectionListener);

      // 3. 执行 Agent（使用新接口：task, context, options）并添加超时控制
      // 默认超时时间：5分钟，可通过 options.agentTimeout 配置
      const timeout = options?.agentTimeout || 5 * 60 * 1000; // 5分钟
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Agent ${agentNode.id} execution timeout after ${timeout}ms`));
        }, timeout);
      });

      const result = await Promise.race([
        agent.execute(
          agentNode.desc,  // 任务描述
          context,         // 执行上下文
          {
            agentNode: agentNode,  // 传递完整的 node 信息（包含 steps、dependencies）
            ...options  // 传递额外的执行选项
          }
        ),
        timeoutPromise
      ]);

      // 执行后再次检查是否已取消
      if (context.isCancelled) {
        throw new Error(`Workflow ${context.workflowId} was cancelled during execution`);
      }

      // 4. 清理事件监听器
      agent.off('agent:thinking', thinkingListener);
      agent.off('agent:tool-call', toolCallListener);
      agent.off('agent:tool-result', toolResultListener);
      agent.off('agent:tool-error', toolErrorListener);
      agent.off('agent:compressed', compressedListener);
      agent.off('agent:warning', warningListener);
      agent.off('agent:stream-text', streamTextListener);
      agent.off('agent:stream-finish', streamFinishListener);
      agent.off('agent:context-length-error', contextLengthErrorListener);
      agent.off('agent:max-iterations', maxIterationsListener);
      agent.off('task:complete', taskCompleteListener);
      agent.off('task:reflect', reflectionListener);

      // 5. 保存结果到上下文
      agentState.status = 'completed';
      agentState.result = result;
      context.setOutput(agentNode.id, result);

      this.emit('agent:complete', { 
        ...result,  // 包含 duration, iterations 等信息
        nodeId: agentNode.id,  // workflow 节点 ID（放在后面确保不被覆盖）
        agentId: agentNode.id,  // 保持兼容
      });

    } catch (error) {
      agentState.status = 'failed';
      agentState.error = error as Error;

      this.emit('agent:error', { 
        nodeId: agentNode.id,  // workflow 节点 ID
        agentId: agentNode.id,  // 保持兼容
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
   * 根据 ID 或名称查找 Agent（模糊匹配）
   * 
   * @param identifier Agent 标识符（通常是 agentNode.type）
   * @returns Agent 实例或 undefined
   */
  private getAgentByIdOrName(identifier: string): IAgent | undefined {
    // 1. 精确匹配 ID
    const exactMatch = this.agents.get(identifier);
    if (exactMatch) return exactMatch;
    
    // 2. 模糊匹配 ID 或 name
    for (const agent of this.agents.values()) {
      const idLower = agent.id.toLowerCase();
      const nameLower = agent.name.toLowerCase();
      const identifierLower = identifier.toLowerCase();
      
      if (idLower.includes(identifierLower) || nameLower.includes(identifierLower)) {
        return agent;
      }
    }
    
    return undefined;
  }
}

