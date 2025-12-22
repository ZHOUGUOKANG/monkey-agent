import { IAgent, Task, TaskResult, Goal, Plan, PlanStep } from '@monkey-agent/types';

// 定义必要的类型（避免循环依赖）
interface Workflow {
  id: string;
  name: string;
  description: string;
  agentGraph: AgentNode[];
  estimatedDuration?: number;
}

interface AgentNode {
  id: string;
  type: string;
  name: string;
  desc: string;
  steps: AgentNodeStep[];
  dependencies: string[];
}

interface AgentNodeStep {
  stepNumber: number;
  desc: string;
}

interface WorkflowExecutionContext {
  workflowTask: string;
  outputs: Map<string, AgentExecutionResult>;
  vals: Map<string, any>;
  startTime: number;
  status: 'running' | 'completed' | 'failed';
  error?: Error;
}

interface AgentExecutionResult {
  agentId: string;
  data: any;
  summary: string;
  status: 'success' | 'failed';
  error?: Error;
}

interface AgentNodeExecutionContext {
  workflowTask: string;
  currentTask: string;
  steps: AgentNodeStep[];
  parentNodes: Array<{
    agentId: string;
    task: string;
    summary: string;
  }>;
  sharedContext: WorkflowExecutionContext;
}

/**
 * Agent 编排器
 * 负责多智能体协作和任务调度
 */
export class AgentOrchestrator {
  private agents: Map<string, IAgent> = new Map();

  /**
   * 注册 Agent
   */
  registerAgent(agent: IAgent): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * 获取 Agent
   */
  getAgent(id: string): IAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * 获取所有 Agent
   */
  getAllAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * 获取可用的 Agent 类型列表
   */
  getAvailableAgentTypes(): string[] {
    return Array.from(this.agents.values()).map(agent => {
      // 从 agent id 中提取类型，如 'browser-agent' -> 'browser'
      // 或使用 agent 的 name/type 字段
      const id = agent.id;
      const match = id.match(/^(\w+)-agent$/);
      return match ? match[1] : id;
    });
  }

  /**
   * 获取 Agent 的详细信息（用于生成 prompt）
   */
  getAgentInfo(agentId: string): { type: string; description: string; capabilities: string[] } | undefined {
    const agent = this.agents.get(agentId);
    if (!agent) return undefined;

    const type = agentId.match(/^(\w+)-agent$/)?.[1] || agentId;
    return {
      type,
      description: agent.description || 'No description available',
      capabilities: agent.capabilities || [],
    };
  }

  /**
   * 获取所有 Agent 的详细信息
   */
  getAllAgentInfo(): Array<{ type: string; description: string; capabilities: string[] }> {
    return Array.from(this.agents.values()).map(agent => {
      const type = agent.id.match(/^(\w+)-agent$/)?.[1] || agent.id;
      return {
        type,
        description: agent.description || 'No description available',
        capabilities: agent.capabilities || [],
      };
    });
  }

  /**
   * 分解任务
   */
  decomposeTask(task: Task): Task[] {
    // 简单实现：根据任务类型分解
    const subTasks: Task[] = [];
    
    // TODO: 使用 LLM 智能分解任务
    
    return subTasks;
  }

  /**
   * 选择合适的 Agent
   */
  selectAgent(task: Task): IAgent | undefined {
    // 根据任务类型和 Agent 能力选择
    for (const agent of this.agents.values()) {
      if (this.canHandleTask(agent, task)) {
        return agent;
      }
    }
    return undefined;
  }

  /**
   * 判断 Agent 是否能处理任务
   */
  private canHandleTask(agent: IAgent, task: Task): boolean {
    // 简单匹配：任务类型在 Agent 能力列表中
    return agent.capabilities.includes(task.type);
  }

  /**
   * 顺序执行任务
   */
  async executeSequential(tasks: Task[]): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    
    for (const task of tasks) {
      const agent = this.selectAgent(task);
      if (!agent) {
        results.push({
          success: false,
          error: new Error(`No agent found for task: ${task.type}`),
        });
        continue;
      }
      
      const result = await agent.execute(task);
      results.push(result);
      
      // 如果失败，可以选择停止或继续
      if (!result.success) {
        console.error(`Task ${task.id} failed:`, result.error);
      }
    }
    
    return results;
  }

  /**
   * 并行执行任务
   */
  async executeParallel(tasks: Task[]): Promise<TaskResult[]> {
    const promises = tasks.map(async (task) => {
      const agent = this.selectAgent(task);
      if (!agent) {
        return {
          success: false,
          error: new Error(`No agent found for task: ${task.type}`),
        };
      }
      return agent.execute(task);
    });
    
    return Promise.all(promises);
  }

  /**
   * 层级执行（带依赖）
   */
  async executeHierarchical(plan: Plan): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    const completed = new Set<string>();
    const pending = [...plan.steps];
    
    while (pending.length > 0) {
      // 找出可以执行的步骤（依赖已完成）
      const executable = pending.filter((step) => {
        if (!step.dependencies) return true;
        return step.dependencies.every((dep) => completed.has(dep));
      });
      
      if (executable.length === 0) {
        // 没有可执行的步骤，可能存在循环依赖
        console.error('No executable steps found, possible circular dependency');
        break;
      }
      
      // 并行执行这些步骤
      const tasks = executable.map((step) => this.stepToTask(step));
      const stepResults = await this.executeParallel(tasks);
      
      // 记录结果
      executable.forEach((step, index) => {
        results.push(stepResults[index]);
        completed.add(step.id);
      });
      
      // 从待处理列表中移除已执行的步骤
      pending.splice(
        0,
        pending.length,
        ...pending.filter((s) => !completed.has(s.id))
      );
    }
    
    return results;
  }

  /**
   * 执行计划
   */
  async executePlan(plan: Plan): Promise<TaskResult[]> {
    // 检查是否有依赖关系
    const hasDependencies = plan.steps.some((step) => step.dependencies?.length);
    
    if (hasDependencies) {
      return this.executeHierarchical(plan);
    } else {
      // 没有依赖，可以并行执行
      const tasks = plan.steps.map((step) => this.stepToTask(step));
      return this.executeParallel(tasks);
    }
  }

  /**
   * 将计划步骤转换为任务
   */
  private stepToTask(_step: PlanStep): Task {
    return {
      id: _step.id,
      type: _step.description,
      description: _step.description,
      parameters: _step.parameters || {},
    };
  }

  /**
   * 协作执行复杂目标
   */
  async executeGoal(goal: Goal): Promise<TaskResult[]> {
    // 1. 选择主 Agent 来规划任务
    const plannerAgent = this.selectPlannerAgent(goal);
    if (!plannerAgent) {
      throw new Error('No suitable planner agent found');
    }
    
    // 2. 创建计划
    const plan = await plannerAgent.plan(goal);
    
    // 3. 执行计划
    const results = await this.executePlan(plan);
    
    // 4. 反思和学习
    for (const result of results) {
      if (plannerAgent.reflect) {
        await plannerAgent.reflect(result);
      }
    }
    
    return results;
  }

  /**
   * 选择规划 Agent
   */
  private selectPlannerAgent(_goal: Goal): IAgent | undefined {
    // 简单策略：选择第一个 Agent
    // TODO: 根据 goal 类型选择最合适的 Agent
    return this.agents.values().next().value;
  }

  /**
   * 执行 DAG 工作流（新方法，支持完整上下文注入）
   * @param workflow ChatAgent 生成的 DAG 工作流
   * @returns 执行上下文（包含所有节点的输出）
   */
  async executeWorkflow(workflow: Workflow): Promise<WorkflowExecutionContext> {
    // 1. 初始化执行上下文
    const context: WorkflowExecutionContext = {
      workflowTask: workflow.description,
      outputs: new Map(),
      vals: new Map(),
      startTime: Date.now(),
      status: 'running',
    };

    // 2. 拓扑排序，获取执行层级
    const levels = this.topologicalSortAgents(workflow.agentGraph);

    // 3. 按层级执行（每层内并行）
    for (const level of levels) {
      await Promise.all(
        level.map(async (agentId) => {
          const agentNode = workflow.agentGraph.find(n => n.id === agentId)!;
          
          try {
            const result = await this.executeAgentNode(agentNode, context);
            context.outputs.set(agentId, result);
          } catch (error) {
            context.status = 'failed';
            context.error = error instanceof Error ? error : new Error(String(error));
            throw error;
          }
        })
      );
    }

    context.status = 'completed';
    return context;
  }

  /**
   * 执行单个 Agent 节点
   */
  private async executeAgentNode(
    agentNode: AgentNode,
    context: WorkflowExecutionContext
  ): Promise<AgentExecutionResult> {
    // 1. 从 agent type 找到对应的 agent 实例
    const agent = this.findAgentByType(agentNode.type);
    if (!agent) {
      throw new Error(`No agent found for type: ${agentNode.type}`);
    }

    // 2. 构建父节点信息（不包含 output，只包含 summary）
    const parentNodes = agentNode.dependencies.map(depId => {
      const depResult = context.outputs.get(depId);
      const depNode = this.getAgentNodeById(depId, context);
      
      return {
        agentId: depId,
        task: depNode?.desc || 'Unknown task',
        summary: depResult?.summary || 'No summary available',
        // 不包含 output - Agent 应该通过 valGet 从 context.vals 获取数据
      };
    });

    // 3. 构建 Agent 执行上下文
    const agentContext: AgentNodeExecutionContext = {
      workflowTask: context.workflowTask,
      currentTask: agentNode.desc,
      steps: agentNode.steps,
      parentNodes,
      sharedContext: context,
    };

    // 4. 创建任务对象
    const task: Task = {
      id: agentNode.id,
      type: agentNode.type,
      description: agentNode.desc,
      parameters: {
        context: agentContext,
        steps: agentNode.steps,
      },
    };

    // 5. 执行 Agent
    const taskResult = await agent.execute(task);

    // 6. 提取 summary（假设 agent 在结果中提供了 summary）
    const summary = taskResult.data?.summary || 
                   taskResult.data?.conclusion || 
                   'Task completed successfully';

    // 7. 返回结构化结果
    return {
      agentId: agentNode.id,
      data: taskResult.data,
      summary,
      status: taskResult.success ? 'success' : 'failed',
      error: taskResult.error,
    };
  }

  /**
   * 根据类型查找 Agent
   */
  private findAgentByType(type: string): IAgent | undefined {
    for (const agent of this.agents.values()) {
      // 匹配规则：agent.id 格式为 "type-agent"
      const agentType = agent.id.match(/^(\w+)-agent$/)?.[1];
      if (agentType === type) {
        return agent;
      }
    }
    return undefined;
  }

  /**
   * 根据 ID 获取 AgentNode（从当前工作流中）
   */
  private getAgentNodeById(_nodeId: string, _context: WorkflowExecutionContext): AgentNode | undefined {
    // 注意：这里需要从外部传入 workflow 或在 context 中保存
    // 简化实现：暂时返回 undefined
    // TODO: 在 context 中添加对 workflow 的引用
    return undefined;
  }

  /**
   * 对 Agent 节点进行拓扑排序
   */
  private topologicalSortAgents(nodes: AgentNode[]): string[][] {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    // 构建图和入度表
    nodes.forEach(node => {
      graph.set(node.id, []);
      inDegree.set(node.id, node.dependencies.length);
    });
    
    // 建立反向边
    nodes.forEach((node: AgentNode) => {
      node.dependencies.forEach((dep: string) => {
        graph.get(dep)?.push(node.id);
      });
    });

    const levels: string[][] = [];
    const queue: string[] = [];
    
    // 找到所有入度为 0 的节点
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) queue.push(nodeId);
    });

    while (queue.length > 0) {
      const currentLevel: string[] = [...queue];
      levels.push(currentLevel);
      queue.length = 0;

      for (const nodeId of currentLevel) {
        const neighbors = graph.get(nodeId) || [];
        for (const neighbor of neighbors) {
          const newDegree = (inDegree.get(neighbor) || 0) - 1;
          inDegree.set(neighbor, newDegree);
          if (newDegree === 0) {
            queue.push(neighbor);
          }
        }
      }
    }

    return levels;
  }
}
