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
  private activeContexts: Map<string, ExecutionContext> = new Map();  // 新增：跟踪活动的执行上下文

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
      // 记录 Agent 完成
      this.tracker.recordAgentComplete();
    });
    this.executor.on('agent:error', (data) => this.emit('agent:error', data));
    this.executor.on('agent:retry', (data) => this.emit('agent:retry', data));
    
    // 转发思考和工具调用事件
    this.executor.on('agent:thinking', (data) => this.emit('agent:thinking', data));
    this.executor.on('agent:tool-call', (data) => this.emit('agent:tool-call', data));
    this.executor.on('agent:tool-result', (data) => this.emit('agent:tool-result', data));
    this.executor.on('agent:tool-error', (data) => this.emit('agent:tool-error', data));
    
    // 转发流式事件
    this.executor.on('agent:stream-text', (data) => this.emit('agent:stream-text', data));
    this.executor.on('agent:stream-finish', (data) => this.emit('agent:stream-finish', data));
    
    // 转发其他 agent 事件
    this.executor.on('agent:compressed', (data) => this.emit('agent:compressed', data));
    this.executor.on('agent:warning', (data) => this.emit('agent:warning', data));
    this.executor.on('agent:context-length-error', (data) => this.emit('agent:context-length-error', data));
    this.executor.on('agent:max-iterations', (data) => this.emit('agent:max-iterations', data));
    this.executor.on('agent:reflection', (data) => this.emit('agent:reflection', data));
    this.executor.on('agent:task-complete', (data) => this.emit('agent:task-complete', data));
    this.executor.on('agent:tool-input-start', (data) => this.emit('agent:tool-input-start', data));
    this.executor.on('agent:tool-input-progress', (data) => this.emit('agent:tool-input-progress', data));
    this.executor.on('agent:tool-input-complete', (data) => this.emit('agent:tool-input-complete', data));
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
   * 根据 ID 或名称查找 Agent（模糊匹配）
   * 用于 WorkflowExecutor 根据 agentNode.type 查找对应的 Agent
   */
  getAgentByIdOrName(identifier: string): IAgent | undefined {
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

  /**
   * 获取所有 Agents
   */
  getAllAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * 获取所有 Agent 的基本信息（供 ChatAgent 使用）
   * 返回简化的信息：id, name, description, capabilities
   */
  getAgentsInfo(): Array<{
    id: string;
    name: string;
    description: string;
    capabilities: string[];
  }> {
    return this.getAllAgents().map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities,
    }));
  }

  /**
   * 取消正在执行的工作流
   * 
   * @param workflowId 工作流 ID
   * @returns 是否成功取消
   */
  cancelWorkflow(workflowId: string): boolean {
    const context = this.activeContexts.get(workflowId);
    if (!context) {
      return false;  // 工作流不存在或已完成
    }

    context.cancel();
    this.emit('workflow:cancel-requested', { workflowId });
    return true;
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
    
    // 注入 workflow 的上下文信息（如 pageInfo, tabId）
    if (workflow.context) {
      context.workflowContext = workflow.context;
    }
    
    // 跟踪活动的执行上下文
    this.activeContexts.set(workflow.id, context);
    
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
      
      // 构建最终结果
      const finalResult = this.buildResult(workflow, context);
      
      this.emit('workflow:complete', { 
        workflowId: workflow.id,
        duration: Date.now() - context.startTime,
        result: finalResult,  // 包含完整的执行结果
        context: context.toJSON(),  // 包含所有 agent 的输出
      });

      this.tracker.recordEvent('workflow:complete', {
        workflowId: workflow.id,
        duration: Date.now() - context.startTime,
      });

      // 清理活动的执行上下文
      this.activeContexts.delete(workflow.id);

      return finalResult;

    } catch (error) {
      context.fail(error as Error);
      
      // 检查是否为取消操作
      if (context.isCancelled) {
        this.emit('workflow:cancelled', { 
          workflowId: workflow.id,
          context: context.toJSON(),
        });
      } else {
        this.emit('workflow:error', { 
          workflowId: workflow.id, 
          error 
        });
      }

      this.tracker.recordEvent('workflow:error', {
        workflowId: workflow.id,
        error: (error as Error).message,
      });

      if (options?.errorHandler) {
        options.errorHandler.handle(error as Error, { workflow, context });
      } else {
        this.errorHandler.handle(error as Error, { workflow, context });
      }

      // 清理活动的执行上下文
      this.activeContexts.delete(workflow.id);

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

