/**
 * 进度追踪器
 */

import type { Workflow } from '@monkey-agent/types';
import type { ExecutionMetrics, ExecutionEvent } from '../types';

/**
 * 进度追踪器
 * 
 * 负责追踪工作流执行进度和收集指标
 */
export class ProgressTracker {
  private workflow?: Workflow;
  private levels?: string[][];
  private events: ExecutionEvent[] = [];
  private agentDurations: number[] = [];
  private completedAgents = 0;  // 新增：已完成的 Agent 数量
  private initialMemory?: number;  // 新增：初始内存使用
  private peakMemory?: number;   // 新增：峰值内存使用

  /**
   * 初始化追踪器
   */
  init(workflow: Workflow, levels: string[][]): void {
    this.workflow = workflow;
    this.levels = levels;
    this.events = [];
    this.agentDurations = [];
    this.completedAgents = 0;
    this.initialMemory = this.getMemoryUsage();
    this.peakMemory = this.initialMemory;
    
    this.recordEvent('workflow:start', {
      workflowId: workflow.id,
      totalAgents: workflow.agentGraph.length,
      totalLevels: levels.length,
    });
  }

  /**
   * 记录事件
   */
  recordEvent(type: ExecutionEvent['type'], data: any): void {
    this.events.push({
      type,
      timestamp: Date.now(),
      data,
    });
  }

  /**
   * 记录 Agent 执行时间
   */
  recordAgentDuration(duration: number): void {
    this.agentDurations.push(duration);
  }

  /**
   * 记录 Agent 完成
   */
  recordAgentComplete(): void {
    this.completedAgents++;
    this.updatePeakMemory();
  }

  /**
   * 获取执行进度（百分比）
   */
  getProgress(): number {
    if (!this.workflow) return 0;
    return Math.round((this.completedAgents / this.workflow.agentGraph.length) * 100);
  }

  /**
   * 估算剩余时间（毫秒）
   */
  getEstimatedTimeRemaining(): number {
    if (this.agentDurations.length === 0 || !this.workflow) {
      return 0;
    }
    const avgDuration = this.agentDurations.reduce((a, b) => a + b, 0) / this.agentDurations.length;
    const remainingAgents = this.workflow.agentGraph.length - this.completedAgents;
    return Math.round(avgDuration * remainingAgents);
  }

  /**
   * 获取当前内存使用（字节）
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  /**
   * 更新峰值内存
   */
  private updatePeakMemory(): void {
    const current = this.getMemoryUsage();
    if (!this.peakMemory || current > this.peakMemory) {
      this.peakMemory = current;
    }
  }

  /**
   * 获取执行指标
   */
  getMetrics(): ExecutionMetrics | undefined {
    if (!this.workflow || !this.levels) {
      return undefined;
    }

    const totalSteps = this.workflow.agentGraph.reduce(
      (sum, agent) => sum + agent.steps.length,
      0
    );

    const averageAgentDuration = this.agentDurations.length > 0
      ? this.agentDurations.reduce((sum, d) => sum + d, 0) / this.agentDurations.length
      : 0;

    return {
      totalAgents: this.workflow.agentGraph.length,
      totalSteps,
      parallelLevels: this.levels.length,
      averageAgentDuration,
      peakMemoryUsage: this.peakMemory,
      events: this.events,
    };
  }

  /**
   * 重置追踪器
   */
  reset(): void {
    this.workflow = undefined;
    this.levels = undefined;
    this.events = [];
    this.agentDurations = [];
    this.completedAgents = 0;
    this.initialMemory = undefined;
    this.peakMemory = undefined;
  }
}

