# Chat Agent

智能对话 Agent，负责理解用户意图并生成多智能体 DAG 工作流。

## 核心能力

| 功能 | 说明 |
|------|------|
| **意图识别** | 自动区分简单对话和复杂任务 |
| **工作流生成** | 使用 Tool Use 生成结构化的 DAG 工作流 |
| **Agent 发现** | 从 Orchestrator 动态获取可用 Agent |
| **并行调度** | 自动识别可并行执行的节点 |
| **共享上下文** | 所有 Agent 可访问之前节点的输出 |

## 快速开始

### 简单聊天（无需 Orchestrator）

对于纯对话场景，ChatAgent 可以独立工作，不需要配置 orchestrator：

```typescript
import { ChatAgent } from '@monkey-agent/agents';
import { LLMClient } from '@monkey-agent/llm';

// 创建 ChatAgent - 只需要 LLM 客户端
const chatAgent = new ChatAgent({
  llmClient: new LLMClient({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
  }),
});

// 普通对话
const result = await chatAgent.execute({
  id: 'chat-1',
  type: 'chat',
  description: '你好，介绍一下你自己',
  parameters: {},
} as any);

console.log(result.data);

// 意图识别
const intent = await chatAgent.analyzeIntent('帮我查一下天气');
console.log(intent); // { intent: 'information_query', confidence: 0.85, ... }
```

### 完整工作流生成（需要 Orchestrator）

当需要生成复杂的多智能体工作流时，需要配置 orchestrator 或 getAgentsInfo：

```typescript
import { ChatAgent } from '@monkey-agent/agents';
import { WorkflowOrchestrator } from '@monkey-agent/orchestrator';
import { PlaywrightBrowserAgent, CodeAgent } from '@monkey-agent/agents';

// 1. 创建 Orchestrator 并注册 Agents
const orchestrator = new WorkflowOrchestrator();
orchestrator.registerAgent(new PlaywrightBrowserAgent({ id: 'browser', /* ... */ }));
orchestrator.registerAgent(new CodeAgent({ id: 'code' }));

// 2. 创建 ChatAgent（函数注入 - 自动感知 Agent 变化）
const chatAgent = new ChatAgent({
  llmClient: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
  },
  getAgentsInfo: () => orchestrator.getAllAgentInfo(), // 动态获取
});

// 3. 生成并执行工作流
const workflow = await chatAgent.createWorkflow(
  '从网站爬取数据，用Python分析并生成可视化图表'
);

const result = await orchestrator.executeWorkflow(workflow);
console.log(result);
```

**核心设计**：
- ✅ **灵活配置**: 简单聊天不需要 orchestrator
- ✅ **职责分离**: ChatAgent 只生成 Workflow，不执行
- ✅ **完全解耦**: agents 包不依赖 orchestrator 包
- ✅ **动态发现**: 自动感知新注册的 Agent

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
      type: 'browser',
      name: '浏览器',
      desc: '导航到网页并提取数据',
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
  agentGraph: [
    {
      id: 'agent-1',
      type: 'browser',
      desc: '从网站A提取数据',
      dependencies: [], // 无依赖
      steps: [{ stepNumber: 1, desc: '获取网站A数据' }],
    },
    {
      id: 'agent-2',
      type: 'code',
      desc: '调用API B获取数据',
      dependencies: [], // 无依赖
      steps: [{ stepNumber: 2, desc: '请求API B数据' }],
    },
    {
      id: 'agent-3',
      type: 'code',
      desc: '合并所有来源的数据',
      dependencies: ['agent-1', 'agent-2'], // 等待前两个完成
      steps: [
        { stepNumber: 3, desc: '合并数据' },
        { stepNumber: 4, desc: '分析数据' },
      ],
    },
  ],
};
```

**执行流程**:
- **Level 0**: agent-1, agent-2（并行执行）
- **Level 1**: agent-3（等待前两个完成）

## DAG 验证

ChatAgent 内置 DAG 验证，确保生成的 workflow 有效：

1. **检测环**：确保没有循环依赖
2. **依赖引用**：所有 dependencies 引用的 ID 都存在
3. **起始节点**：至少有一个无依赖的节点
4. **步骤编号**：全局唯一且连续（从 1 开始）

## 共享变量系统

Agent 可以通过共享变量系统传递数据：

```typescript
// Agent 1 (Browser) 保存数据
await valSet({ key: 'productData', value: products });

// Agent 2 (Analyzer) 读取数据
const products = await valGet({ key: 'productData' });

// 查看所有可用变量
const vars = await valList({}); // { keys: ['productData'], count: 1 }
```

## 配置选项

```typescript
interface ChatAgentConfig {
  /** LLM 客户端（必需） */
  llmClient: ILLMClient;
  
  /** 获取可用 Agent 信息的函数（生成工作流时必需） */
  getAgentsInfo?: () => AgentInfo[];
  
  /** Orchestrator 实例（便利选项，生成工作流时必需） */
  orchestrator?: { getAgentsInfo(): AgentInfo[]; };
  
  /** Agent 基础配置 */
  id?: string;
  name?: string;
  description?: string;
  systemPrompt?: string;
  maxIterations?: number;
  contextCompression?: ContextCompressionConfig;
}
```

## 最佳实践

### 1. 提供清晰的任务描述

```typescript
// ❌ 不好
await chatAgent.createWorkflow('处理数据');

// ✅ 好
await chatAgent.createWorkflow(
  '从 data.csv 读取销售数据，计算每月总销售额，生成柱状图保存为 chart.png'
);
```

### 2. 根据场景选择配置

```typescript
// 纯对话场景
const chatOnly = new ChatAgent({
  llmClient: myLLMClient,
});

// 工作流生成场景
const fullFeatured = new ChatAgent({
  llmClient: myLLMClient,
  orchestrator: myOrchestrator,
});
```

## 相关资源

- [BaseAgent 文档](../../../base/README.md)
- [WorkflowOrchestrator 文档](../../../orchestrator/README.md)
- [LLM Client 文档](../../../llm/README.md)
