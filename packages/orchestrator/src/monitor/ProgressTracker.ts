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

  /**
   * 初始化追踪器
   */
  init(workflow: Workflow, levels: string[][]): void {
    this.workflow = workflow;
    this.levels = levels;
    this.events = [];
    this.agentDurations = [];
    
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
  }
}

