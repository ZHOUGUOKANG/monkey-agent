/**
 * 执行上下文管理
 */

import type { WorkflowExecutionContext } from '@monkey-agent/context';
import type { AgentExecutionState } from '../types';
import type { TaskResult } from '@monkey-agent/types';

/**
 * 执行上下文
 * 
 * 负责管理工作流执行过程中的状态:
 * - Agent 输出结果
 * - Agent 执行状态
 * - 当前执行层级
 * - 整体工作流状态
 */
export class ExecutionContext {
  private context: WorkflowExecutionContext;
  private agentStates: Map<string, AgentExecutionState> = new Map();

  constructor(workflowId: string) {
    this.context = {
      workflowId,
      outputs: new Map(),
      startTime: Date.now(),
      status: 'running',
      currentLevel: 0,
    };
  }

  get workflowId(): string {
    return this.context.workflowId;
  }

  get startTime(): number {
    return this.context.startTime;
  }

  get status(): WorkflowExecutionContext['status'] {
    return this.context.status;
  }

  set currentLevel(level: number) {
    this.context.currentLevel = level;
  }

  /**
   * 获取或创建 Agent 状态
   */
  getAgentState(agentId: string): AgentExecutionState {
    if (!this.agentStates.has(agentId)) {
      this.agentStates.set(agentId, {
        agentId,
        status: 'pending',
        retryCount: 0,
      });
    }
    return this.agentStates.get(agentId)!;
  }

  /**
   * 获取所有 Agent 状态
   */
  getAgentStates(): Map<string, AgentExecutionState> {
    return this.agentStates;
  }

  /**
   * 设置 Agent 输出
   */
  setOutput(agentId: string, result: TaskResult): void {
    this.context.outputs.set(agentId, result);
  }

  /**
   * 获取 Agent 输出
   */
  getOutput(agentId: string): TaskResult | undefined {
    return this.context.outputs.get(agentId);
  }

  /**
   * 获取所有输出
   */
  getAllOutputs(): Map<string, TaskResult> {
    return this.context.outputs;
  }

  /**
   * 标记完成
   */
  complete(): void {
    this.context.status = 'completed';
  }

  /**
   * 标记失败
   */
  fail(error: Error): void {
    this.context.status = 'failed';
    this.context.error = error;
  }

  /**
   * 标记暂停
   */
  pause(): void {
    this.context.status = 'paused';
  }

  /**
   * 标记取消
   */
  cancel(): void {
    this.context.status = 'cancelled';
  }

  /**
   * 设置元数据
   */
  setMetadata(key: string, value: any): void {
    if (!this.context.metadata) {
      this.context.metadata = {};
    }
    this.context.metadata[key] = value;
  }

  /**
   * 获取元数据
   */
  getMetadata(key: string): any {
    return this.context.metadata?.[key];
  }

  /**
   * 序列化为 JSON
   */
  toJSON(): WorkflowExecutionContext {
    return {
      ...this.context,
      outputs: this.context.outputs,
    };
  }
}

