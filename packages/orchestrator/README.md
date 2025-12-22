# @monkey-agent/orchestrator

多智能体编排系统，提供工作流调度、任务分解、并行执行和状态管理能力。

## 📋 目录

- [核心特性](#核心特性)
- [架构设计](#架构设计)
- [快速开始](#快速开始)
- [API 文档](#api-文档)
- [高级用法](#高级用法)

## 核心特性

### 🔀 两种编排器

| 编排器 | 适用场景 | 核心能力 |
|--------|---------|---------|
| **AgentOrchestrator** | 简单任务协作 | Agent 注册、任务分解、顺序/并行执行 |
| **WorkflowOrchestrator** | 复杂 DAG 工作流 | 拓扑排序、状态管理、进度追踪、错误处理 |

### ✨ 核心能力

- ✅ **DAG 工作流执行** - 基于拓扑排序的依赖调度
- ✅ **并行执行** - 同层级 Agent 自动并行
- ✅ **状态管理** - 完整的执行上下文和状态追踪
- ✅ **错误处理** - 自动重试、指数退避、错误传播
- ✅ **进度追踪** - 实时监控、指标收集、事件发射
- ✅ **上下文注入** - 集成 `@monkey-agent/context`，支持上下文工具

## 架构设计

### 整体架构

```
┌────────────────────────────────────────────────┐
│         WorkflowOrchestrator                   │
│  • Agent 注册管理                               │
│  • 工作流执行协调                               │
│  • 事件发射                                     │
└───────────┬────────────────────────────────────┘
            │
    ┌───────┼───────┬──────────┬──────────┐
    │       │       │          │          │
┌───▼───┐ ┌▼──────▼┐ ┌───────▼┐ ┌──────▼──┐
│Schedu-│ │Executor│ │  State │ │  Error  │
│ ler   │ │        │ │Context │ │ Handler │
└───────┘ └────────┘ └────────┘ └─────────┘
```

### 核心组件

| 组件 | 职责 | 关键方法 |
|------|------|---------|
| **TopologicalScheduler** | 拓扑排序、环检测 | `schedule()`, `validate()` |
| **WorkflowExecutor** | Agent 执行、重试逻辑 | `executeLevel()`, `executeAgent()` |
| **ExecutionContext** | 状态管理、输出存储 | `getAgentState()`, `setOutput()` |
| **ErrorHandler** | 错误处理、重试判断 | `handle()`, `isRetryable()` |
| **ProgressTracker** | 进度追踪、指标收集 | `recordEvent()`, `getMetrics()` |

## 快速开始

### 安装

```bash
yarn add @monkey-agent/orchestrator
```

### 基础示例 - AgentOrchestrator

```typescript
import { AgentOrchestrator } from '@monkey-agent/orchestrator';
import { BrowserAgent, CodeAgent } from '@monkey-agent/agents';

// 1. 创建编排器
const orchestrator = new AgentOrchestrator();

// 2. 注册 Agents
orchestrator.registerAgent(new BrowserAgent());
orchestrator.registerAgent(new CodeAgent());

// 3. 顺序执行任务
const results = await orchestrator.executeSequential([
  {
    id: 'task-1',
    type: 'browser',
    description: '访问网页',
    parameters: { url: 'https://example.com' }
  },
  {
    id: 'task-2',
    type: 'code',
    description: '处理数据',
    parameters: { script: '...' }
  }
]);
```

### 高级示例 - WorkflowOrchestrator

```typescript
import { WorkflowOrchestrator } from '@monkey-agent/orchestrator';
import type { Workflow } from '@monkey-agent/types';

// 1. 创建编排器
const orchestrator = new WorkflowOrchestrator();

// 2. 注册 Agents
orchestrator.registerAgent(browserAgent);
orchestrator.registerAgent(codeAgent);
orchestrator.registerAgent(fileAgent);

// 3. 定义 DAG 工作流
const workflow: Workflow = {
  id: 'data-pipeline',
  name: '数据处理流程',
  description: '采集网页数据并分析',
  agentGraph: [
    {
      id: 'fetch',
      type: 'browser',
      name: '数据采集',
      desc: '访问网页提取数据',
      steps: [
        { stepNumber: 1, desc: '打开目标网页' },
        { stepNumber: 2, desc: '提取所需数据' }
      ],
      dependencies: [] // 无依赖，第一层执行
    },
    {
      id: 'process',
      type: 'code',
      name: '数据处理',
      desc: '清洗和转换数据',
      steps: [
        { stepNumber: 1, desc: '读取采集的数据' },
        { stepNumber: 2, desc: '执行数据转换' }
      ],
      dependencies: ['fetch'] // 依赖 fetch 节点
    },
    {
      id: 'save',
      type: 'file',
      name: '保存结果',
      desc: '将结果保存到文件',
      steps: [
        { stepNumber: 1, desc: '格式化输出' },
        { stepNumber: 2, desc: '写入文件' }
      ],
      dependencies: ['process'] // 依赖 process 节点
    }
  ]
};

// 4. 执行工作流
const result = await orchestrator.executeWorkflow(workflow, {
  timeout: 60000,           // 60秒超时
  maxRetries: 3,            // 最多重试3次
  continueOnError: false,   // 失败时停止
  maxConcurrency: 5         // 最多5个并发
});

// 5. 查看结果
console.log('执行状态:', result.status);
console.log('成功数量:', result.successCount);
console.log('失败数量:', result.failureCount);
console.log('总耗时:', result.duration, 'ms');
console.log('执行指标:', result.metrics);
```

### 事件监听

```typescript
// 监听工作流事件
orchestrator.on('workflow:start', ({ workflowId }) => {
  console.log('工作流开始:', workflowId);
});

orchestrator.on('agent:start', ({ agentId, type }) => {
  console.log(`Agent ${agentId} (${type}) 开始执行`);
});

orchestrator.on('agent:complete', ({ agentId, result }) => {
  console.log(`Agent ${agentId} 完成:`, result);
});

orchestrator.on('agent:error', ({ agentId, error }) => {
  console.error(`Agent ${agentId} 失败:`, error);
});

orchestrator.on('agent:retry', ({ agentId, attempt }) => {
  console.log(`Agent ${agentId} 重试第 ${attempt} 次`);
});

orchestrator.on('workflow:complete', ({ workflowId, duration }) => {
  console.log(`工作流完成: ${workflowId}, 耗时: ${duration}ms`);
});
```

## API 文档

### WorkflowOrchestrator

#### 构造函数

```typescript
constructor()
```

创建工作流编排器实例。

#### 方法

##### registerAgent(agent: IAgent): void

注册 Agent 到编排器。

```typescript
orchestrator.registerAgent(new BrowserAgent());
```

##### unregisterAgent(agentId: string): void

注销指定 Agent。

```typescript
orchestrator.unregisterAgent('browser-agent');
```

##### getAgent(agentId: string): IAgent | undefined

根据 ID 获取 Agent 实例。

```typescript
const agent = orchestrator.getAgent('browser-agent');
```

##### getAgentByType(type: string): IAgent | undefined

根据类型获取 Agent 实例（支持模糊匹配）。

```typescript
const browserAgent = orchestrator.getAgentByType('browser');
```

##### getAllAgents(): IAgent[]

获取所有已注册的 Agent。

```typescript
const agents = orchestrator.getAllAgents();
```

##### getAvailableAgentTypes(): string[]

获取所有可用的 Agent 类型。

```typescript
const types = orchestrator.getAvailableAgentTypes();
// => ['browser', 'code', 'file', ...]
```

##### executeWorkflow(workflow: Workflow, options?: WorkflowExecutionOptions): Promise\<WorkflowExecutionResult\>

执行 DAG 工作流。

**参数：**
- `workflow: Workflow` - 工作流定义
- `options?: WorkflowExecutionOptions` - 执行选项

**返回：** `Promise<WorkflowExecutionResult>`

**示例：**

```typescript
const result = await orchestrator.executeWorkflow(workflow, {
  timeout: 60000,
  maxRetries: 3,
  continueOnError: false,
  maxConcurrency: 5,
  errorHandler: customErrorHandler
});
```

### AgentOrchestrator

#### 构造函数

```typescript
constructor()
```

#### 方法

##### registerAgent(agent: IAgent): void

注册 Agent。

##### getAgent(id: string): IAgent | undefined

获取 Agent。

##### selectAgent(task: Task): IAgent | undefined

根据任务选择合适的 Agent。

##### executeSequential(tasks: Task[]): Promise\<TaskResult[]\>

顺序执行任务列表。

```typescript
const results = await orchestrator.executeSequential(tasks);
```

##### executeParallel(tasks: Task[]): Promise\<TaskResult[]\>

并行执行任务列表。

```typescript
const results = await orchestrator.executeParallel(tasks);
```

##### executeHierarchical(plan: Plan): Promise\<TaskResult[]\>

层级执行（带依赖关系）。

```typescript
const results = await orchestrator.executeHierarchical(plan);
```

##### executePlan(plan: Plan): Promise\<TaskResult[]\>

执行计划（自动选择顺序或并行）。

```typescript
const results = await orchestrator.executePlan(plan);
```

##### executeGoal(goal: Goal): Promise\<TaskResult[]\>

执行复杂目标（自动规划和执行）。

```typescript
const results = await orchestrator.executeGoal({
  id: 'goal-1',
  description: '完成复杂任务',
  criteria: {...}
});
```

##### executeWorkflow(workflow: Workflow): Promise\<WorkflowExecutionContext\>

执行 DAG 工作流（支持完整上下文注入）。

```typescript
const context = await orchestrator.executeWorkflow(workflow);
```

### 类型定义

#### WorkflowExecutionOptions

```typescript
interface WorkflowExecutionOptions {
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
```

#### WorkflowExecutionResult

```typescript
interface WorkflowExecutionResult {
  workflowId: string;
  status: 'completed' | 'failed' | 'partial';
  context: WorkflowExecutionContext;
  agentStates: Map<string, AgentExecutionState>;
  duration: number;
  successCount: number;
  failureCount: number;
  metrics?: ExecutionMetrics;
}
```

#### AgentExecutionState

```typescript
interface AgentExecutionState {
  agentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: number;
  endTime?: number;
  duration?: number;
  result?: TaskResult;
  error?: Error;
  retryCount: number;
}
```

#### ExecutionMetrics

```typescript
interface ExecutionMetrics {
  totalAgents: number;
  totalSteps: number;
  parallelLevels: number;
  averageAgentDuration: number;
  peakMemoryUsage?: number;
  events: ExecutionEvent[];
}
```

#### ExecutionEvent

```typescript
interface ExecutionEvent {
  type: 'workflow:start' | 'workflow:complete' | 'workflow:error' |
        'level:start' | 'level:complete' |
        'agent:start' | 'agent:complete' | 'agent:error' | 'agent:retry' |
        'state:update';
  timestamp: number;
  data: any;
}
```

## 高级用法

### 自定义错误处理器

```typescript
import { IErrorHandler } from '@monkey-agent/orchestrator';

class CustomErrorHandler implements IErrorHandler {
  handle(error: Error, context: any): void {
    // 自定义错误处理逻辑
    console.error('Custom error handling:', error);
    
    // 发送告警
    sendAlert(error, context);
    
    // 记录日志
    logError(error);
  }
}

// 使用自定义错误处理器
const result = await orchestrator.executeWorkflow(workflow, {
  errorHandler: new CustomErrorHandler()
});
```

### 指数退避重试策略

```typescript
import { ExponentialBackoffRetry, ErrorHandler } from '@monkey-agent/orchestrator';

// 创建重试策略
const retry = new ExponentialBackoffRetry({
  maxRetries: 5,
  initialDelay: 1000,     // 1秒
  maxDelay: 30000,        // 30秒
  backoffFactor: 2        // 指数因子
});

const errorHandler = new ErrorHandler();

// 执行带重试的操作
const result = await retry.execute(
  async () => {
    return await agent.execute(task);
  },
  errorHandler
);
```

### 进度追踪

```typescript
import { ProgressTracker } from '@monkey-agent/orchestrator';

const tracker = new ProgressTracker();

// 初始化
tracker.init(workflow, levels);

// 记录事件
tracker.recordEvent('agent:start', { agentId: 'agent-1' });
tracker.recordAgentDuration(1500);

// 获取指标
const metrics = tracker.getMetrics();
console.log('总 Agent 数:', metrics.totalAgents);
console.log('总步骤数:', metrics.totalSteps);
console.log('并行层级:', metrics.parallelLevels);
console.log('平均执行时间:', metrics.averageAgentDuration);
```

### 上下文工具集成

```typescript
import { 
  WorkflowOrchestrator,
  createContextTools,
  buildContextInjectionPrompt
} from '@monkey-agent/orchestrator';

// 创建上下文工具
const contextTools = createContextTools();

// 在 Agent 中使用上下文工具
class MyAgent extends BaseAgent {
  async execute(task: Task): Promise<TaskResult> {
    const context = task.parameters.context;
    
    // 使用上下文工具
    const value = await contextTools.valGet.execute({
      key: 'someData',
      context: context.sharedContext
    });
    
    // 保存结果
    await contextTools.valSet.execute({
      key: 'result',
      value: processedData,
      context: context.sharedContext
    });
    
    return { success: true, data: processedData };
  }
}

// 构建上下文注入 Prompt
const prompt = buildContextInjectionPrompt(context, currentTask);
```

### 拓扑排序与 DAG 验证

```typescript
import { TopologicalScheduler } from '@monkey-agent/orchestrator';

const scheduler = new TopologicalScheduler();

// 验证 DAG
const validation = scheduler.validate(workflow.agentGraph);
if (!validation.valid) {
  console.error('工作流无效:', validation.error);
}

// 拓扑排序
const levels = scheduler.schedule(workflow.agentGraph);
console.log('执行层级:', levels);
// => [
//   ['agent1', 'agent2'],  // 第一层（并行）
//   ['agent3'],            // 第二层
//   ['agent4', 'agent5']   // 第三层（并行）
// ]
```

### 执行上下文管理

```typescript
import { ExecutionContext } from '@monkey-agent/orchestrator';

const context = new ExecutionContext('workflow-123');

// 获取 Agent 状态
const state = context.getAgentState('agent-1');
state.status = 'running';
state.startTime = Date.now();

// 设置输出
context.setOutput('agent-1', {
  success: true,
  data: { result: '...' }
});

// 获取输出
const output = context.getOutput('agent-1');

// 标记完成/失败
context.complete();
context.fail(new Error('Something went wrong'));

// 序列化
const json = context.toJSON();
```

## 最佳实践

### 1. 工作流设计原则

- ✅ **单一职责** - 每个 Agent 节点只做一件事
- ✅ **明确依赖** - 清晰定义节点间的依赖关系
- ✅ **避免环** - 确保 DAG 无循环依赖
- ✅ **合理分层** - 利用并行能力提升效率

### 2. 错误处理策略

```typescript
// ❌ 错误做法：捕获后不处理
try {
  await agent.execute(task);
} catch (error) {
  // 什么都不做
}

// ✅ 正确做法：使用编排器的错误处理
const result = await orchestrator.executeWorkflow(workflow, {
  continueOnError: true,  // 允许部分失败
  maxRetries: 3,          // 自动重试
  errorHandler: customHandler
});

if (result.status === 'partial') {
  // 处理部分失败的情况
  handlePartialFailure(result);
}
```

### 3. 性能优化

```typescript
// ✅ 最大化并行度
const workflow: Workflow = {
  agentGraph: [
    // 无依赖的节点会在同一层并行执行
    { id: 'fetch1', dependencies: [] },
    { id: 'fetch2', dependencies: [] },
    { id: 'fetch3', dependencies: [] },
    // 依赖节点在下一层执行
    { id: 'merge', dependencies: ['fetch1', 'fetch2', 'fetch3'] }
  ]
};

// ✅ 限制并发数避免资源耗尽
await orchestrator.executeWorkflow(workflow, {
  maxConcurrency: 5  // 最多5个并发
});
```

### 4. 监控和调试

```typescript
// ✅ 完整的事件监听
const events = [
  'workflow:start',
  'workflow:complete',
  'workflow:error',
  'agent:start',
  'agent:complete',
  'agent:error',
  'agent:retry'
];

events.forEach(event => {
  orchestrator.on(event, (data) => {
    logger.info(event, data);
    metrics.record(event, data);
  });
});

// ✅ 获取详细指标
const result = await orchestrator.executeWorkflow(workflow);
console.log('执行指标:', result.metrics);
```

## 与其他包的集成

### 与 @monkey-agent/agents 集成

```typescript
import { WorkflowOrchestrator } from '@monkey-agent/orchestrator';
import { 
  BrowserAgent, 
  CodeAgent, 
  FileAgent 
} from '@monkey-agent/agents';

const orchestrator = new WorkflowOrchestrator();
orchestrator.registerAgent(new BrowserAgent());
orchestrator.registerAgent(new CodeAgent());
orchestrator.registerAgent(new FileAgent());
```

### 与 @monkey-agent/context 集成

```typescript
import { 
  createContextTools,
  buildContextInjectionPrompt 
} from '@monkey-agent/orchestrator';

// 在 Agent 执行时注入上下文
const contextTools = createContextTools();
const prompt = buildContextInjectionPrompt(context, task);
```

### 与 @monkey-agent/memory 集成

```typescript
import { MemorySystem } from '@monkey-agent/memory';
import { WorkflowOrchestrator } from '@monkey-agent/orchestrator';

const memory = new MemorySystem();
const orchestrator = new WorkflowOrchestrator();

// 在工作流执行前检索记忆
orchestrator.on('workflow:start', async ({ workflowId }) => {
  const memories = await memory.retrieve(workflowId);
  // 使用记忆优化执行
});

// 执行后存储记忆
orchestrator.on('workflow:complete', async (data) => {
  await memory.store(data.workflowId, data);
});
```

## 相关资源

- [Agent 开发指南](../agents/README.md)
- [上下文系统](../context/README.md)
- [类型定义](../types/README.md)
- [主项目 README](../../README.md)

## 许可证

MIT

