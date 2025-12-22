# Chat Agent

智能对话 Agent，具备意图识别和 DAG 多智能体工作流生成能力。

## 核心功能

### 1. 意图识别

自动分析用户输入，识别以下意图类型：

- **simple_chat**: 简单对话（闲聊、问候、一般性提问）
- **single_task**: 单一任务（可由单个 Agent 完成）
- **complex_workflow**: 复杂工作流（需要多个 Agent 协作）
- **information_query**: 信息查询
- **uncertain**: 意图不明确

### 2. DAG 工作流生成

当检测到复杂任务时，使用 **Tool Use** 方式自动生成结构化的多智能体 DAG 工作流：

- **DAG 结构**: Agent 节点通过 `dependencies` 建立显式依赖关系
- **并行执行**: 自动识别无依赖节点，支持并发执行
- **全局步骤编号**: 所有 steps 跨 agent 连续编号（1, 2, 3...N）
- **Tool Use 生成**: 通过严格的 Zod schema 确保生成稳定性
- **共享上下文**: 所有节点共享执行上下文，可访问之前任意节点的输出

### 3. 智能 Agent 发现

ChatAgent 从 Orchestrator 中动态提取 Agent 信息：

- **自动发现**: 从 orchestrator 获取所有已注册的 agent
- **能力感知**: 提取每个 agent 的 description 和 capabilities
- **智能匹配**: 根据任务需求和 agent 能力生成最优工作流
- **动态更新**: 支持在运行时更新可用 agent 列表

### 4. 智能对话

对于简单场景，提供自然流畅的对话能力。

## 快速开始

### 与 Orchestrator 集成

ChatAgent 必须与 `WorkflowOrchestrator` 集成使用，从 orchestrator 动态获取可用的 Agent 类型：

**重要特性**:

1. **自动发现 Agent**: ChatAgent 会从 orchestrator 中提取所有已注册 agent 的完整信息
2. **智能提示词**: 使用每个 agent 的 `description` 和 `capabilities` 构建智能 prompt
3. **能力感知**: 根据实际 agent 能力而非硬编码信息生成工作流
4. **动态更新**: 支持运行时添加新 agent 并自动更新

```typescript
import { ChatAgent } from '@monkey-agent/agents';
import { WorkflowOrchestrator } from '@monkey-agent/orchestrator';
import { BrowserAgent, CrawlerAgent, CodeAgent, FileAgent } from '@monkey-agent/agents';

// 1. 创建 Orchestrator 并注册 Agents
const orchestrator = new WorkflowOrchestrator();
orchestrator.registerAgent(new BrowserAgent({ id: 'browser-agent' }));
orchestrator.registerAgent(new CrawlerAgent({ id: 'crawler-agent' }));
orchestrator.registerAgent(new CodeAgent({ id: 'code-agent' }));
orchestrator.registerAgent(new FileAgent({ id: 'file-agent' }));

// 2. 创建 ChatAgent（从 orchestrator 获取可用的 Agent 类型）
const chatAgent = new ChatAgent({
  llmConfig: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
  },
  orchestrator: orchestrator, // 传入 orchestrator（必需）
});

// 3. 生成并执行工作流
const workflow = await chatAgent.createWorkflow(
  '帮我爬取这个网站的数据，用Python分析后生成可视化图表，并保存到本地'
);

const result = await orchestrator.executeWorkflow(workflow);
console.log(result);
```

### 简单对话示例

```typescript
import { ChatAgent } from '@monkey-agent/agents';
import { WorkflowOrchestrator } from '@monkey-agent/orchestrator';

const orchestrator = new WorkflowOrchestrator();
orchestrator.registerAgent(new BrowserAgent({ id: 'browser-agent' }));

const chatAgent = new ChatAgent({
  llmConfig: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
  },
  orchestrator: orchestrator,
});

// 简单对话
const result1 = await chatAgent.execute({
  id: 'task-1',
  type: 'chat',
  description: '你好，今天天气怎么样？',
  parameters: {},
});
console.log(result1.data.answer);

// 复杂任务 - 自动生成 DAG 工作流
const result2 = await chatAgent.execute({
  id: 'task-2',
  type: 'chat',
  description: '帮我爬取这个网站的数据，用Python分析后生成可视化图表，并保存到本地',
  parameters: {},
});
console.log(result2.data);
```

### 动态更新可用 Agents

当在 Orchestrator 中添加新的 Agent 后，可以更新 ChatAgent：

```typescript
// 初始化
const orchestrator = new WorkflowOrchestrator();
orchestrator.registerAgent(new BrowserAgent({ id: 'browser-agent' }));

const chatAgent = new ChatAgent({
  llmConfig: { /* ... */ },
  orchestrator: orchestrator,
});

// 稍后添加新的 Agent
orchestrator.registerAgent(new ImageAgent({ id: 'image-agent' }));

// 更新 ChatAgent 的可用 Agent 列表
chatAgent.updateAvailableAgents();
```

**工作原理**:

```typescript
// ChatAgent 构造时会调用：
// 1. orchestrator.getAvailableAgentTypes() - 获取 agent 类型列表
// 2. orchestrator.getAllAgentInfo() - 获取每个 agent 的详细信息

// 返回的 agent 信息包括：
interface AgentInfo {
  type: string;              // agent 类型，如 'browser', 'code'
  description: string;       // agent 描述，来自 agent.description
  capabilities: string[];    // agent 能力列表，来自 agent.capabilities
}

// ChatAgent 使用这些信息构建智能 prompt：
// "Available Agents:
//  - browser: Web page interaction, navigation, form filling
//    Capabilities: web-navigation, form-filling, page-interaction
//  - code: Code execution, data processing, analysis
//    Capabilities: code-execution, data-processing, analysis"
```

### 直接使用意图识别

```typescript
const intentResult = await chatAgent.analyzeIntent(
  '爬取产品数据并生成报告',
  { source: 'user-input' }
);

console.log(intentResult);
// {
//   intent: 'complex_workflow',
//   confidence: 0.95,
//   explanation: 'Task requires web scraping, data analysis, and report generation',
//   needsMultiAgent: true
// }
```

### 直接生成 DAG 工作流

```typescript
const workflow = await chatAgent.createWorkflow(
  '从电商网站爬取产品信息，分析价格趋势，生成可视化图表',
  {
    requirements: ['数据需要保存为CSV格式', '图表使用matplotlib生成'],
  }
);

console.log(workflow);
```

## DAG 工作流结构

### 核心设计原则

1. **DAG 结构简单明了**: 通过 `dependencies` 数组显式声明依赖关系
2. **带编号的 steps**: `{ stepNumber, desc }` - 有全局编号的描述性指导
3. **单一数据流**: 所有 Agent 共享执行上下文，自动访问依赖输出

### Workflow 接口

```typescript
/**
 * 工作流定义（DAG 版本）
 */
interface Workflow {
  /** 工作流 ID */
  id: string;
  /** 工作流名称 */
  name: string;
  /** 工作流描述 */
  description: string;
  /** Agent DAG - 节点之间通过 dependencies 建立关系 */
  agentGraph: AgentNode[];
  /** 预估执行时间（毫秒） */
  estimatedDuration?: number;
}
```

### AgentNode 接口

```typescript
/**
 * Agent 节点（DAG 版本）
 */
interface AgentNode {
  /** Agent ID */
  id: string;
  /** Agent 类型 */
  type: string;
  /** Agent 名称 */
  name: string;
  /** Agent 描述 - 描述 Agent 的职责和目标，为 Agent 提供执行指导 */
  desc: string;
  /** 带全局编号的步骤 */
  steps: AgentNodeStep[];
  /** 依赖的其他 Agent ID 列表 */
  dependencies: string[];
}
```

### AgentNodeStep 接口

```typescript
/**
 * Agent 步骤（带全局编号）
 */
interface AgentNodeStep {
  /** 全局步骤编号（跨所有 Agent 的唯一编号） */
  stepNumber: number;
  /** 步骤描述 - 为 Agent 提供执行指导 */
  desc: string;
}
```

### 简单顺序执行示例

```typescript
const workflow = {
  id: 'workflow-1234',
  name: '网页数据采集',
  description: 'Scrape and process web data',
  agentGraph: [
    {
      id: 'agent-1',
      type: 'crawler',
      name: '爬虫',
      desc: '爬取网页数据，提取所需信息',
      dependencies: [], // 无依赖，立即执行
      steps: [
        { stepNumber: 1, desc: '导航到目标网页' },
        { stepNumber: 2, desc: '提取页面数据' },
      ],
    },
    {
      id: 'agent-2',
      type: 'code',
      name: '处理器',
      desc: '处理和清洗爬取的数据',
      dependencies: ['agent-1'], // 依赖 agent-1
      steps: [
        { stepNumber: 3, desc: '清洗数据格式' },
        { stepNumber: 4, desc: '转换数据结构' },
      ],
    },
  ],
  estimatedDuration: 60000,
};
```

**执行**: agent-1 → agent-2（顺序执行）

**全局步骤编号**: 1-4 连续编号，便于追踪整个 workflow 执行进度

### 并行执行示例

```typescript
const workflow = {
  id: 'workflow-5678',
  name: '多源数据聚合',
  description: 'Aggregate data from multiple sources',
  agentGraph: [
    {
      id: 'agent-1',
      type: 'crawler',
      name: '爬虫A',
      desc: '从网站A爬取数据',
      dependencies: [], // 无依赖
      steps: [{ stepNumber: 1, desc: '获取网站A数据' }],
    },
    {
      id: 'agent-2',
      type: 'code',
      name: 'API调用器',
      desc: '调用API B获取数据',
      dependencies: [], // 无依赖
      steps: [{ stepNumber: 2, desc: '请求API B数据' }],
    },
    {
      id: 'agent-3',
      type: 'file',
      name: '文件读取器',
      desc: '读取本地文件C的数据',
      dependencies: [], // 无依赖
      steps: [{ stepNumber: 3, desc: '读取本地文件C' }],
    },
    {
      id: 'agent-4',
      type: 'code',
      name: '数据合并器',
      desc: '合并所有来源的数据并进行分析',
      dependencies: ['agent-1', 'agent-2', 'agent-3'], // 等待前三个完成
      steps: [
        { stepNumber: 4, desc: '合并三个数据源' },
        { stepNumber: 5, desc: '分析合并后的数据' },
      ],
    },
  ],
};
```

**执行**:

- **Level 0**: agent-1, agent-2, agent-3（并行执行）
- **Level 1**: agent-4（等待前三个完成）

**全局步骤编号**: 1-5，体现了执行顺序

### 复杂 DAG 示例

```typescript
const workflow = {
  id: 'workflow-9999',
  name: '电商数据分析',
  description: 'Comprehensive e-commerce data analysis',
  agentGraph: [
    {
      id: 'agent-1',
      type: 'crawler',
      name: '产品爬虫',
      desc: '爬取电商网站的产品列表页面',
      dependencies: [],
      steps: [
        { stepNumber: 1, desc: '导航到产品列表页' },
        { stepNumber: 2, desc: '提取产品基础信息' },
      ],
    },
    {
      id: 'agent-2',
      type: 'crawler',
      name: '评论爬虫',
      desc: '爬取产品的用户评论数据',
      dependencies: ['agent-1'],
      steps: [
        { stepNumber: 3, desc: '进入产品详情页' },
        { stepNumber: 4, desc: '提取用户评论' },
      ],
    },
    {
      id: 'agent-3',
      type: 'code',
      name: '数据清洗器',
      desc: '清洗和标准化产品数据',
      dependencies: ['agent-1'],
      steps: [
        { stepNumber: 5, desc: '清洗产品数据' },
        { stepNumber: 6, desc: '标准化数据格式' },
      ],
    },
    {
      id: 'agent-4',
      type: 'code',
      name: '价格分析器',
      desc: '分析产品价格趋势和竞争力',
      dependencies: ['agent-3'],
      steps: [
        { stepNumber: 7, desc: '分析价格趋势' },
        { stepNumber: 8, desc: '生成价格可视化' },
      ],
    },
    {
      id: 'agent-5',
      type: 'code',
      name: '情感分析器',
      desc: '对用户评论进行情感分析',
      dependencies: ['agent-2'],
      steps: [{ stepNumber: 9, desc: '分析评论情感倾向' }],
    },
    {
      id: 'agent-6',
      type: 'file',
      name: '报告生成器',
      desc: '汇总所有分析结果生成综合报告',
      dependencies: ['agent-4', 'agent-5'],
      steps: [
        { stepNumber: 10, desc: '编译分析结果' },
        { stepNumber: 11, desc: '导出报告文件' },
      ],
    },
  ],
};
```

**执行**:

- **Level 0**: agent-1
- **Level 1**: agent-2, agent-3（并行）
- **Level 2**: agent-4, agent-5（并行）
- **Level 3**: agent-6

**全局步骤编号**: 1-11，完整展示了复杂 DAG 的执行流程

## DAG 验证

ChatAgent 内置 DAG 验证工具，确保生成的 workflow 有效：

```typescript
// 自动验证
// 1. 检测环：确保没有循环依赖
// 2. 依赖引用：所有 dependencies 引用的 ID 都存在
// 3. 起始节点：至少有一个无依赖的节点
// 4. 步骤编号：全局唯一且连续（从 1 开始）
```

如果验证失败，会抛出详细的错误信息：

```typescript
// 示例错误
throw new Error('Invalid workflow DAG: Workflow contains circular dependencies');
throw new Error('Invalid workflow DAG: Agent agent-2 depends on non-existent agent agent-99');
throw new Error('Invalid workflow DAG: Workflow must have at least one agent with no dependencies');
```

## Tool Use 生成

ChatAgent 使用 AI SDK 的 `tool` 功能和 Zod schema 确保稳定的结构化输出：

### Zod Schema 定义

```typescript
const workflowSchema = z.object({
  id: z.string().regex(/^workflow-\d+$/),
  name: z.string().min(1).max(100),
  description: z.string().min(10).max(300),
  agentGraph: z.array(agentNodeSchema).min(1).max(10),
  estimatedDuration: z.number().positive().optional(),
}).refine(
  (data) => {
    // 验证 dependencies 引用的 ID 都存在
    const allIds = new Set(data.agentGraph.map(a => a.id));
    for (const agent of data.agentGraph) {
      for (const dep of agent.dependencies) {
        if (!allIds.has(dep)) return false;
      }
    }
    return true;
  },
  { message: 'All dependency IDs must reference existing agents' }
).refine(
  (data) => {
    // 验证全局 stepNumber 唯一且连续
    const allStepNumbers = data.agentGraph
      .flatMap(agent => agent.steps.map(s => s.stepNumber))
      .sort((a, b) => a - b);
    
    for (let i = 0; i < allStepNumbers.length; i++) {
      if (allStepNumbers[i] !== i + 1) return false;
    }
    return true;
  },
  { message: 'Step numbers must be unique and sequential starting from 1' }
);
```

### 工具定义

```typescript
generateWorkflow: tool({
  description: `Generate a DAG-based multi-agent workflow with globally numbered steps.
  
Key concepts:
- Agents form a Directed Acyclic Graph (DAG)
- Use 'dependencies' array to define execution order
- Empty dependencies = runs immediately
- Steps have global sequential numbers (1, 2, 3... across all agents)
- Each step has a desc field providing guidance for agent execution
- All agents access shared context with previous outputs`,
  parameters: workflowSchema,
})
```

### 强制工具调用

```typescript
const result = await this.getLLMClient().chat(
  [
    { role: 'system', content: systemMessage },
    { role: 'user', content: userMessage },
  ],
  {
    tools: this.getToolDefinitions(),
    toolChoice: 'required', // 强制 LLM 使用 tool
  }
);
```

## Orchestrator 工作流执行

ChatAgent 生成的 DAG workflow 可由 Orchestrator 执行：

### 完整上下文注入

Orchestrator 在执行每个 Agent 时会注入完整的上下文信息：

1. **工作流完整任务**: 让 Agent 了解整体目标
2. **当前节点任务**: Agent 自己的任务描述
3. **执行步骤**: 带编号的执行指导
4. **父节点信息**: 所有依赖节点的任务、总结和输出
5. **共享变量**: 跨 Agent 的 key-value 存储

### 共享变量系统

Agent 可以使用三个通用工具来共享数据：

- **valSet**: 设置共享变量
- **valGet**: 获取共享变量
- **valList**: 列出所有可用变量

**示例**:

```typescript
// Agent 1 (Crawler) 保存数据
await valSet({ key: 'productData', value: products });
await valSet({ key: 'totalCount', value: products.length });

// Agent 2 (Analyzer) 读取数据
const products = await valGet({ key: 'productData' });
const count = await valGet({ key: 'totalCount' });

// 查看所有可用变量
const availableVars = await valList({});
// 返回: { keys: ['productData', 'totalCount'], count: 2 }
```

### 使用示例

```typescript
import { ChatAgent } from '@monkey-agent/agents';
import { WorkflowOrchestrator } from '@monkey-agent/orchestrator';

const chatAgent = new ChatAgent({ /* config */ });
const orchestrator = new WorkflowOrchestrator();

// 用户输入
const userInput = '从网站爬取数据，分析后保存到文件';

// 1. 生成 DAG workflow
const workflow = await chatAgent.createWorkflow(userInput);

// 2. Orchestrator 执行（支持拓扑排序和并行执行）
const context = await orchestrator.executeWorkflow(workflow);

console.log('Workflow execution completed:', context.outputs);
```

### 上下文结构

```typescript
interface WorkflowExecutionContext {
  /** 工作流的完整任务描述 */
  workflowTask: string;
  
  /** 所有已完成节点的输出（包含完整结果和 summary） */
  outputs: Map<string, AgentExecutionResult>;
  
  /** Agent 之间共享的变量存储（key-value pairs） */
  vals: Map<string, any>;
  
  /** 开始时间 */
  startTime: number;
  
  /** 当前状态 */
  status: 'running' | 'completed' | 'failed';
  
  /** 错误信息（如果失败） */
  error?: Error;
}

interface AgentExecutionResult {
  /** Agent ID */
  agentId: string;
  
  /** 执行结果数据 */
  data: any;
  
  /** ReAct 循环结束后的总结 */
  summary: string;
  
  /** 执行状态 */
  status: 'success' | 'failed';
  
  /** 错误信息 */
  error?: Error;
}
```

### Agent 接收的上下文

每个 Agent 执行时会收到完整的上下文信息：

```typescript
interface AgentNodeExecutionContext {
  /** 工作流的完整任务 */
  workflowTask: string;
  
  /** 当前节点的任务描述 */
  currentTask: string;
  
  /** 当前节点的执行步骤 */
  steps: AgentNodeStep[];
  
  /** 父节点信息（依赖的节点） */
  parentNodes: Array<{
    agentId: string;
    task: string;
    summary: string;  // ReAct 结束后的总结，会告知数据保存在哪个 key
    // 注意：不包含 output，Agent 应通过 valGet 从 vals 中获取数据
  }>;
  
  /** 共享上下文（所有已完成节点的输出） */
  sharedContext: WorkflowExecutionContext;
}
```

**重要设计**:
- `parentNodes[].summary` 会告诉 Agent 数据保存在哪个共享变量中
- Agent 不会被动接收 `output` 数据，而是主动使用 `valGet` 工具获取
- 这避免了 prompt 过长，符合 ReAct 的主动工具使用模式

这确保每个 Agent 都能：

- 了解整体工作流的目标
- 看到自己需要完成的任务和步骤
- 从父节点的 summary 中了解数据位置
- 使用 `valGet` 工具主动获取需要的数据
- 使用共享变量系统传递数据给下游 Agent

### Orchestrator 执行流程

```typescript
class WorkflowOrchestrator {
  async executeWorkflow(workflow: Workflow): Promise<WorkflowExecutionContext> {
    // 1. 初始化上下文
    const context: WorkflowExecutionContext = {
      workflowTask: workflow.description,
      outputs: new Map(),
      vals: new Map(),  // 共享变量存储
      startTime: Date.now(),
      status: 'running',
    };
    
    // 2. 拓扑排序
    const levels = DAGValidator.topologicalSort(workflow.agentGraph);
    
    // 3. 按层级执行（每层内并行）
    for (const level of levels) {
      await Promise.all(
        level.map(async (agentId) => {
          const agentNode = workflow.agentGraph.find(n => n.id === agentId)!;
          
          // 构建完整上下文
          const agentContext = {
            workflowTask: context.workflowTask,
            currentTask: agentNode.desc,
            steps: agentNode.steps,
            parentNodes: agentNode.dependencies.map(depId => ({
              agentId: depId,
              task: getNodeTask(depId),
              summary: context.outputs.get(depId)?.summary,
              // 不包含 output - Agent 通过 valGet 主动获取数据
            })),
            sharedContext: context,
          };
          
          // 执行 Agent（Agent 使用 valGet 从 context.vals 获取数据）
          const result = await agent.execute({
            ...agentNode,
            context: agentContext,
          });
          
          // 保存输出到共享上下文
          context.outputs.set(agentId, {
            agentId,
            data: result.data,
            summary: result.summary || 'Task completed',
            status: result.success ? 'success' : 'failed',
          });
        })
      );
    }
    
    context.status = 'completed';
    return context;
  }
}
```

### 使用共享变量工具

在你的 Agent 中，可以使用共享变量工具：

```typescript
import { 
  createContextTools, 
  executeContextTool, 
  isContextTool 
} from '@monkey-agent/agents/chat';
import type { WorkflowExecutionContext } from '@monkey-agent/agents/chat';

class MyAgent extends BaseAgent {
  private context?: WorkflowExecutionContext;

  protected getToolDefinitions(): ToolSet {
    const baseTools = {
      // 你的其他工具...
      myTool: tool({ /* ... */ }),
    };
    
    // 如果有 workflow context，添加共享变量工具
    if (this.context) {
      const contextTools = createContextTools(this.context);
      return { ...baseTools, ...contextTools };
    }
    
    return baseTools;
  }
  
  protected async executeToolCall(toolName: string, input: any): Promise<any> {
    // 方式 1：使用 isContextTool 辅助函数（推荐）
    if (isContextTool(toolName) && this.context) {
      return await executeContextTool(toolName, input, this.context);
    }
    
    // 处理其他工具...
    switch (toolName) {
      case 'myTool':
        return await this.myToolImpl(input);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
  
  async execute(task: Task): Promise<TaskResult> {
    // 从 task.parameters 中提取 context
    this.context = task.parameters?.context?.sharedContext;
    
    // 调用父类的 execute（会进入 ReAct 循环）
    return await super.execute(task);
  }
}
```

### 方式 2：更简洁的处理（推荐用于大型 Agent）

```typescript
class MyAgent extends BaseAgent {
  private context?: WorkflowExecutionContext;

  protected async executeToolCall(toolName: string, input: any): Promise<any> {
    // 优先尝试执行上下文工具
    if (this.context && isContextTool(toolName)) {
      return executeContextTool(toolName, input, this.context);
    }
    
    // 处理业务工具
    return await this.executeBusinessTool(toolName, input);
  }
  
  private async executeBusinessTool(toolName: string, input: any): Promise<any> {
    switch (toolName) {
      case 'myTool':
        return await this.myToolImpl(input);
      case 'anotherTool':
        return await this.anotherToolImpl(input);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}
```

## 配置选项

```typescript
interface ChatAgentConfig {
  /** Agent ID */
  id?: string;
  /** Agent 名称 */
  name?: string;
  /** 描述 */
  description?: string;
  /** LLM 客户端 */
  llmClient?: LLMClient;
  /** LLM 配置 */
  llmConfig?: LLMConfig;
  /** 意图识别置信度阈值 */
  intentConfidenceThreshold?: number;  // 默认: 0.7
  /** 是否启用上下文记忆 */
  enableContextMemory?: boolean;       // 默认: true
  /** WorkflowOrchestrator 实例（必需，用于获取可用的 Agent 类型） */
  orchestrator: WorkflowOrchestrator;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 最大 ReAct 循环次数 */
  maxIterations?: number;
  /** 是否启用反思 */
  enableReflection?: boolean;
}
```

## 设计理念

### Agent 自主性优先

Steps 描述提供指导，不是详细指令。Agent 看到 steps 后，根据自己的能力自主决定如何执行。

```typescript
// 具有指导意义的步骤描述
steps: [
  { stepNumber: 1, desc: '导航到目标网页并等待加载完成' },
  { stepNumber: 2, desc: '提取所有产品的名称、价格和库存信息' },
  { stepNumber: 3, desc: '验证数据完整性，处理异常情况' },
]

// Agent 自主决定：
// - Navigate: 如何导航？使用什么配置？如何判断加载完成？
// - Extract: 提取什么数据？用什么选择器？如何处理分页？
// - Validate: 验证什么？如何处理错误？是否需要重试？
```

相当于项目经理告诉你："1. 调研需求 2. 设计方案 3. 实现功能"，具体怎么做由你自己决定。desc 字段提供了清晰的目标和期望，但不限制实现细节。

### 共享执行上下文

所有 Agent 共享一个执行上下文，可以访问任意之前节点的输出：

```typescript
// agent-2 可以访问 agent-1 的输出
const agent1Output = context.outputs.get('agent-1');

// agent-4 可以访问 agent-1, agent-2, agent-3 的输出
const data1 = context.outputs.get('agent-1');
const data2 = context.outputs.get('agent-2');
const data3 = context.outputs.get('agent-3');
```

不需要显式的 input 映射，数据流自然流动。

## 事件监听

ChatAgent 继承自 BaseAgent，支持以下事件：

```typescript
// 意图识别事件
chatAgent.on('intent:recognition-start', ({ userMessage }) => {
  console.log('开始识别意图:', userMessage);
});

chatAgent.on('intent:recognized', (result) => {
  console.log('意图识别结果:', result);
});

// 工作流生成事件
chatAgent.on('workflow:generation-start', ({ taskDescription }) => {
  console.log('开始生成工作流:', taskDescription);
});

chatAgent.on('workflow:generated', (workflow) => {
  console.log('工作流生成完成:', workflow);
});
```

## 最佳实践

### 1. 提供清晰的任务描述

```typescript
// ❌ 不好
const result = await chatAgent.execute({
  id: 'task-1',
  type: 'chat',
  description: '处理数据',
  parameters: {},
});

// ✅ 好
const result = await chatAgent.execute({
  id: 'task-1',
  type: 'chat',
  description: '从 data.csv 读取销售数据，计算每月总销售额，生成柱状图保存为 chart.png',
  parameters: {},
});
```

### 2. 监听 Orchestrator 的 Agent 变更

```typescript
const orchestrator = new WorkflowOrchestrator();
const chatAgent = new ChatAgent({
  llmConfig: { /* ... */ },
  orchestrator: orchestrator,
});

// 动态添加新 Agent 时自动更新
orchestrator.registerAgent(new ImageAgent({ id: 'image-agent' }));
chatAgent.updateAvailableAgents();
```

### 3. 调整置信度阈值

```typescript
const chatAgent = new ChatAgent({
  llmConfig: { /* ... */ },
  // 降低阈值以更激进地生成工作流
  intentConfidenceThreshold: 0.6,
});
```

## 故障排查

### 意图识别不准确

1. 检查用户输入是否足够清晰
2. 调整 `intentConfidenceThreshold`
3. 提供更多上下文信息

### 工作流生成失败

1. 确认 `availableAgentTypes` 配置正确
2. 检查 LLM 配置是否有效
3. 查看日志中的详细错误信息
4. 检查 LLM 是否支持 tool calling

### DAG 验证失败

1. 检查是否存在循环依赖
2. 确认所有 dependencies 引用的 ID 都存在
3. 验证至少有一个无依赖的起始节点
4. 检查步骤编号是否连续且唯一

## 相关资源

- [BaseAgent 文档](../../../base/README.md)
- [AgentOrchestrator 文档](../../../orchestrator/README.md)
- [LLM Client 文档](../../../llm/README.md)
