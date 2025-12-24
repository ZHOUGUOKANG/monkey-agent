/**
 * 执行上下文管理
 */

import type { AgentContext, AgentExecutionResult } from '@monkey-agent/types';
import type { WorkflowExecutionContext } from '@monkey-agent/context';
import type { AgentExecutionState } from '../types';

/**
 * 执行上下文
 * 
 * 负责管理工作流执行过程中的状态:
 * - Agent 输出结果
 * - Agent 执行状态
 * - 当前执行层级
 * - 整体工作流状态
 * - 取消控制
 */
export class ExecutionContext implements AgentContext {
  private context: WorkflowExecutionContext;
  private agentStates: Map<string, AgentExecutionState> = new Map();
  private abortController = new AbortController();  // 新增：取消控制器
  public workflowContext: any = {}; // 存储 workflow 级别的上下文（如 pageInfo, tabId）

  constructor(workflowId: string, workflowTask: string = '') {
    this.context = {
      workflowId,
      workflowTask,
      outputs: new Map(),
      vals: new Map(),
      startTime: Date.now(),
      status: 'running',
      currentLevel: 0,
    } as WorkflowExecutionContext;
  }

  get workflowId(): string {
    return this.context.workflowId || '';
  }

  get workflowTask(): string {
    return this.context.workflowTask || '';
  }

  get outputs(): Map<string, AgentExecutionResult> {
    return this.context.outputs;
  }

  get vals(): Map<string, any> {
    return this.context.vals || new Map();
  }

  get startTime(): number {
    return this.context.startTime;
  }

  get status(): 'running' | 'completed' | 'failed' {
    // 将内部状态映射到 AgentContext 要求的状态
    const internalStatus = this.context.status;
    if (internalStatus === 'pending' || internalStatus === 'paused' || internalStatus === 'cancelled') {
      return 'running'; // 这些状态对外部来说都是"运行中"
    }
    return internalStatus as 'running' | 'completed' | 'failed';
  }

  get currentLevel(): number {
    return this.context.currentLevel || 0;
  }

  set currentLevel(level: number) {
    this.context.currentLevel = level;
  }

  /**
   * 获取取消信号
   */
  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  /**
   * 检查是否已取消
   */
  get isCancelled(): boolean {
    return this.signal.aborted;
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
  setOutput(agentId: string, result: AgentExecutionResult): void {
    this.context.outputs.set(agentId, result);
  }

  /**
   * 获取 Agent 输出
   */
  getOutput(agentId: string): AgentExecutionResult | undefined {
    return this.context.outputs.get(agentId);
  }

  /**
   * 获取所有输出
   */
  getAllOutputs(): Map<string, AgentExecutionResult> {
    return this.context.outputs;
  }

  /**
   * 设置共享值
   */
  setValue(key: string, value: any): void {
    if (!this.context.vals) {
      this.context.vals = new Map();
    }
    this.context.vals.set(key, value);
  }

  /**
   * 获取共享值
   */
  getValue(key: string): any {
    return this.context.vals?.get(key);
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
   * 取消工作流执行
   */
  cancel(): void {
    this.context.status = 'cancelled';
    this.abortController.abort();
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

