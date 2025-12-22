/**
 * 工作流编排器
 */

import EventEmitter from 'eventemitter3';
import type { IAgent } from '@monkey-agent/types';
import type { Workflow } from '@monkey-agent/types';
import { TopologicalScheduler } from './scheduler/TopologicalScheduler';
import { WorkflowExecutor } from './executor/WorkflowExecutor';
import { ExecutionContext } from './state/ExecutionContext';
import { ErrorHandler } from './error/ErrorHandler';
import { ProgressTracker } from './monitor/ProgressTracker';
import type { WorkflowExecutionOptions, WorkflowExecutionResult } from './types';

/**
 * 工作流编排器
 * 
 * 核心功能:
 * - 注册和管理 Agents
 * - 拓扑排序工作流
 * - 执行工作流(支持并行)
 * - 状态管理和进度追踪
 * - 错误处理和重试
 * - 事件发射
 */
export class WorkflowOrchestrator extends EventEmitter {
  private agents: Map<string, IAgent> = new Map();
  private scheduler: TopologicalScheduler;
  private executor: WorkflowExecutor;
  private errorHandler: ErrorHandler;
  private tracker: ProgressTracker;

  constructor() {
    super();
    this.scheduler = new TopologicalScheduler();
    this.executor = new WorkflowExecutor(this.agents);
    this.errorHandler = new ErrorHandler();
    this.tracker = new ProgressTracker();
    
    // 转发执行器事件
    this.executor.on('agent:start', (data) => this.emit('agent:start', data));
    this.executor.on('agent:complete', (data) => {
      this.emit('agent:complete', data);
      if (data.result?.duration) {
        this.tracker.recordAgentDuration(data.result.duration);
      }
    });
    this.executor.on('agent:error', (data) => this.emit('agent:error', data));
    this.executor.on('agent:retry', (data) => this.emit('agent:retry', data));
  }

  /**
   * 注册 Agent
   */
  registerAgent(agent: IAgent): void {
    this.agents.set(agent.id, agent);
    this.emit('agent:registered', { agentId: agent.id });
  }

  /**
   * 注销 Agent
   */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
    this.emit('agent:unregistered', { agentId });
  }

  /**
   * 获取 Agent
   */
  getAgent(agentId: string): IAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * 根据类型获取 Agent
   */
  getAgentByType(type: string): IAgent | undefined {
    // 精确匹配
    const exactMatch = this.agents.get(`${type}-agent`);
    if (exactMatch) {
      return exactMatch;
    }

    // 模糊匹配
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
   * 获取所有 Agents
   */
  getAllAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * 获取所有已注册的 Agent 类型
   * 从 Agent ID 或 name 中提取类型信息
   */
  getAvailableAgentTypes(): string[] {
    const types = new Set<string>();
    const knownTypes = ['browser', 'crawler', 'code', 'file', 'shell', 'computer', 'image'];
    
    for (const agent of this.agents.values()) {
      const idLower = agent.id.toLowerCase();
      const nameLower = agent.name.toLowerCase();
      
      // 尝试从 ID 或 name 中提取已知类型
      for (const type of knownTypes) {
        if (idLower.includes(type) || nameLower.includes(type)) {
          types.add(type);
          break;
        }
      }
    }
    
    return Array.from(types);
  }

  /**
   * 执行 Workflow
   */
  async executeWorkflow(
    workflow: Workflow,
    options?: WorkflowExecutionOptions
  ): Promise<WorkflowExecutionResult> {
    this.emit('workflow:start', { workflowId: workflow.id });

    // 1. 验证工作流
    const validation = this.scheduler.validate(workflow.agentGraph);
    if (!validation.valid) {
      throw new Error(`Invalid workflow: ${validation.error}`);
    }

    // 2. 创建执行上下文
    const context = new ExecutionContext(workflow.id);
    
    // 3. 拓扑排序获取执行层级
    const levels = this.scheduler.schedule(workflow.agentGraph);
    this.emit('workflow:scheduled', { 
      workflowId: workflow.id, 
      levels: levels.length 
    });

    // 4. 初始化进度追踪
    this.tracker.init(workflow, levels);

    try {
      // 5. 按层级执行
      for (let levelIndex = 0; levelIndex < levels.length; levelIndex++) {
        const level = levels[levelIndex];
        context.currentLevel = levelIndex;

        this.emit('level:start', { 
          level: levelIndex, 
          agentCount: level.length 
        });

        this.tracker.recordEvent('level:start', {
          level: levelIndex,
          agents: level,
        });

        // 6. 并行执行同一层级的 Agents
        await this.executor.executeLevel(
          level,
          workflow.agentGraph,
          context,
          options
        );

        this.emit('level:complete', { 
          level: levelIndex 
        });

        this.tracker.recordEvent('level:complete', {
          level: levelIndex,
        });

        // 7. 检查是否需要提前终止
        if (context.status === 'failed' && !options?.continueOnError) {
          break;
        }
      }

      // 8. 标记完成
      if (context.status !== 'failed') {
        context.complete();
      }
      
      this.emit('workflow:complete', { 
        workflowId: workflow.id,
        duration: Date.now() - context.startTime 
      });

      this.tracker.recordEvent('workflow:complete', {
        workflowId: workflow.id,
        duration: Date.now() - context.startTime,
      });

      return this.buildResult(workflow, context);

    } catch (error) {
      context.fail(error as Error);
      
      this.emit('workflow:error', { 
        workflowId: workflow.id, 
        error 
      });

      this.tracker.recordEvent('workflow:error', {
        workflowId: workflow.id,
        error: (error as Error).message,
      });

      if (options?.errorHandler) {
        options.errorHandler.handle(error as Error, { workflow, context });
      } else {
        this.errorHandler.handle(error as Error, { workflow, context });
      }

      return this.buildResult(workflow, context);
    }
  }

  /**
   * 构建执行结果
   */
  private buildResult(
    workflow: Workflow,
    context: ExecutionContext
  ): WorkflowExecutionResult {
    const agentStates = context.getAgentStates();
    const successCount = Array.from(agentStates.values())
      .filter(s => s.status === 'completed').length;
    const failureCount = Array.from(agentStates.values())
      .filter(s => s.status === 'failed').length;

    let finalStatus: 'completed' | 'failed' | 'partial';
    if (context.status === 'completed' && failureCount === 0) {
      finalStatus = 'completed';
    } else if (successCount > 0 && failureCount > 0) {
      finalStatus = 'partial';
    } else {
      finalStatus = 'failed';
    }

    return {
      workflowId: workflow.id,
      status: finalStatus,
      context: context.toJSON(),
      agentStates,
      duration: Date.now() - context.startTime,
      successCount,
      failureCount,
      metrics: this.tracker.getMetrics(),
    };
  }
}

