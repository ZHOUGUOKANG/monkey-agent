/**
 * Orchestrator 核心类型定义
 */

import type { IAgent, TaskResult, AgentNode, Workflow } from '@monkey-agent/types';
import type { WorkflowExecutionContext } from '@monkey-agent/context';

/**
 * Agent 执行状态
 */
export interface AgentExecutionState {
  agentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: number;
  endTime?: number;
  duration?: number;
  result?: TaskResult;
  error?: Error;
  retryCount: number;
}

/**
 * 错误处理器接口
 */
export interface IErrorHandler {
  handle(error: Error, context: any): Promise<void> | void;
}

/**
 * 执行选项
 */
export interface WorkflowExecutionOptions {
  /** 超时时间(毫秒) */
  timeout?: number;
  /** 失败时是否继续 */
  continueOnError?: boolean;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 是否启用回滚 */
  enableRollback?: boolean;
  /** 并行度限制 */
  maxConcurrency?: number;
  /** 自定义错误处理器 */
  errorHandler?: IErrorHandler;
}

/**
 * 执行结果
 */
export interface WorkflowExecutionResult {
  workflowId: string;
  status: 'completed' | 'failed' | 'partial';
  context: WorkflowExecutionContext;
  agentStates: Map<string, AgentExecutionState>;
  duration: number;
  successCount: number;
  failureCount: number;
  metrics?: ExecutionMetrics;
}

/**
 * 执行指标
 */
export interface ExecutionMetrics {
  totalAgents: number;
  totalSteps: number;
  parallelLevels: number;
  averageAgentDuration: number;
  peakMemoryUsage?: number;
  events: ExecutionEvent[];
}

/**
 * 执行事件
 */
export interface ExecutionEvent {
  type: 'workflow:start' | 'workflow:complete' | 'workflow:error' |
        'level:start' | 'level:complete' |
        'agent:start' | 'agent:complete' | 'agent:error' | 'agent:retry' |
        'state:update';
  timestamp: number;
  data: any;
}

/**
 * 调度器接口
 */
export interface IScheduler {
  schedule(agentGraph: AgentNode[]): string[][];
}

/**
 * 执行器接口
 */
export interface IExecutor {
  executeLevel(
    levelAgentIds: string[],
    agentGraph: AgentNode[],
    context: any,
    options?: WorkflowExecutionOptions
  ): Promise<void>;
}

