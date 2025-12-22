/**
 * 工作流上下文类型定义
 */

import type { TaskResult } from '@monkey-agent/types';

/**
 * 工作流执行上下文
 * 
 * 用于在工作流执行过程中传递和共享数据：
 * - 管理 Agent 执行结果（outputs）
 * - 提供 Agent 间共享变量（vals）
 * - 跟踪工作流状态和元数据
 */
export interface WorkflowExecutionContext {
  /** 工作流 ID */
  workflowId?: string;
  /** 工作流的完整任务描述 */
  workflowTask: string;
  /** 所有已完成节点的输出（包含完整结果和 summary） */
  outputs: Map<string, TaskResult>;
  /** Agent 之间共享的变量存储（key-value pairs）
   * 用于 valSet/valGet/valList 工具 */
  vals: Map<string, any>;
  /** 开始时间 */
  startTime: number;
  /** 当前状态 */
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  /** 当前执行的层级 */
  currentLevel?: number;
  /** 错误信息 */
  error?: Error;
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * Agent 节点步骤
 */
export interface AgentNodeStep {
  stepNumber: number;
  desc: string;
}

/**
 * 父节点信息（用于上下文注入）
 */
export interface ParentNodeInfo {
  agentId: string;
  task: string;
  summary: string;
  // 注意：不包含 output，Agent 应该通过 valGet 从 sharedContext.vals 中获取数据
}

