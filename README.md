# Monkey Agent - 智能 Agent 系统

> 基于 BaseAgent 架构的模块化 LLM 驱动 Agent 框架

## ✨ 核心特性

- 🤖 **ReAct 模式**：自动进行思考 → 行动 → 观察的推理循环
- 🛠️ **模块化设计**：BaseAgent、ReactLoop、ContextManager 等独立组件
- 🎯 **统一调度**：WorkflowOrchestrator 执行 DAG 工作流
- 💬 **智能上下文管理**：自动压缩对话历史，避免 token 超限
- 🔄 **自动重试**：工具执行失败自动重试，支持指数退避
- 🛡️ **智能终止**：防止死循环和连续失败
- 🌐 **Playwright 驱动**：可靠的浏览器自动化
- 📦 **独立核心包**：可在任何 Node.js 环境使用
- 🚀 **前后端分离**：NestJS 服务端 + Chrome 插件 UI

## 快速开始

### 方式 1：直接使用核心包（推荐）

```typescript
import { BaseAgent, ToolBuilder, ToolManager } from '@monkey-agent/base';
import { LLMClient } from '@monkey-agent/llm';
import { WorkflowOrchestrator } from '@monkey-agent/orchestrator';
import { z } from 'zod';

// 1. 创建自定义 Agent
class WeatherAgent extends BaseAgent {
  private toolManager = new ToolManager();
  
  constructor(config) {
    super(config);
    
    // 使用 ToolBuilder 定义工具
    this.toolManager.register(
      new ToolBuilder()
        .name('getWeather')
        .description('获取城市天气信息')
        .schema(z.object({ city: z.string() }))
        .execute(async ({ city }) => {
          // 调用实际的天气 API
          return { city, temp: 22, conditions: '晴天' };
        })
        .build()
    );
  }
  
  protected getToolDefinitions() {
    return this.toolManager.getDefinitions();
  }
  
  protected async executeToolCall(toolName: string, input: any) {
    return this.toolManager.execute(toolName, input);
  }
}

// 2. 创建 LLMClient
const llmClient = new LLMClient({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o',
});

// 3. 创建 Agent 实例
const weatherAgent = new WeatherAgent({
  id: 'weather-agent',
  name: '天气助手',
  description: '查询天气信息的智能助手',
  capabilities: ['weather-query'],
  llmClient,
});

// 4. 创建 WorkflowOrchestrator
const orchestrator = new WorkflowOrchestrator();
orchestrator.registerAgent(weatherAgent);

// 5. 执行任务
const result = await weatherAgent.execute(
  {
    id: 'task-1',
    type: 'weather',
    name: '天气查询',
    desc: '查询北京今天的天气',
    steps: [{ stepNumber: 1, desc: '获取天气数据' }],
    dependencies: []
  },
  { workflowId: 'wf-1', workflowTask: '天气查询' }
);

console.log(result.summary); // Agent 自动完成 ReAct 循环
```

### 方式 2：使用 NestJS 服务端 + Chrome 插件

#### 1. 安装依赖

```bash
yarn install
```

#### 2. 配置环境

复制配置文件模板：

```bash
cp server/env.example server/.env
```

编辑 `server/.env`，配置 OpenRouter（推荐）：

```bash
# LLM 配置
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
LLM_MODEL=anthropic/claude-3.5-sonnet

# 其他推荐模型：
# LLM_MODEL=openai/gpt-4o              # GPT-4o
# LLM_MODEL=google/gemini-2.0-flash-exp:free  # Gemini 2.0 (免费)
# LLM_MODEL=deepseek/deepseek-chat     # DeepSeek V3 (性价比高)

# 浏览器配置
BROWSER_MODE=cdp
BROWSER_CDP_URL=http://localhost:9222

# 安全配置
ALLOWED_DIRECTORIES=/Users/yourusername/Documents,/tmp
ALLOWED_COMMANDS=npm,git,python,ls,cat
```

> 💡 **获取 API Key**：访问 [OpenRouter](https://openrouter.ai/keys) 获取免费额度

#### 3. 启动 Chrome（CDP 模式）

使用提供的脚本一键启动（推荐）：

```bash
./scripts/start-chrome-debug.sh
```

或者手动启动：

```bash
# 先关闭所有 Chrome 窗口
killall "Google Chrome"

# 启动 Chrome 并开启 CDP 调试端口
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 &

# 验证 CDP 是否正常
curl http://localhost:9222/json/version
```

> 💡 **提示**：启动脚本会自动检测端口占用、关闭旧进程，并验证启动结果

#### 4. 启动服务端

```bash
cd server && yarn start:dev
```

或使用一键启动脚本：

```bash
./scripts/start-dev.sh  # 自动启动 Chrome + 服务端
```

#### 5. 加载 Chrome 插件（可选）

1. 构建插件：
   ```bash
   cd chrome-extension && yarn build
   ```

2. 加载到 Chrome：
   - 打开 `chrome://extensions/`
   - 开启"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择 `chrome-extension/dist` 目录

3. 使用插件：
   - 点击插件图标打开侧边栏
   - 配置服务端地址（默认 `ws://localhost:3000`）
   - 开始对话

## BaseAgent 架构

### 核心设计理念

BaseAgent 采用 **ReAct (Reasoning + Acting)** 模式，Agent 通过反复思考和行动来完成任务：

```
用户输入 → LLM 思考 → 调用工具 → 观察结果 → 继续思考 → ... → 完成任务
```

### 模块化组件

BaseAgent 由以下独立模块组成，每个模块职责单一、可独立使用：

```
BaseAgent (协调器)
  ├── ReactLoop (ReAct 循环执行器)
  ├── ContextManager (上下文管理 + 压缩)
  └── ToolBuilder (工具构建器)
```

#### 1. ReactLoop - ReAct 循环执行器

自动执行思考 → 行动 → 观察循环：

```typescript
import { ReactLoop } from '@monkey-agent/base';

const loop = new ReactLoop();
const result = await loop.run({
  systemPrompt: '你是一个智能助手...',
  userMessage: '查询北京天气',
  tools: toolDefinitions,
  toolExecutor: (name, input) => executeToolCall(name, input),
  llmClient,
  contextManager,
  eventEmitter,
  maxIterations: 25,
});
```

#### 2. ContextManager - 智能上下文管理

自动压缩对话历史，避免超出 token 限制：

```typescript
import { ContextManager } from '@monkey-agent/base';

const contextManager = new ContextManager(llmClient, {
  enabled: true,
  maxMessages: 20,     // 消息数阈值
  maxTokens: 8000,     // Token 数阈值
  checkInterval: 5,    // 每 5 次迭代检查一次（性能优化）
});

// 自动管理上下文
const managed = await contextManager.manageContext(history, iteration);

// 处理上下文过长错误
const recovered = await contextManager.handleContextLengthError(history);
```

**压缩策略：**
- ✅ 定期检查（减少 ~60% 性能开销）
- ✅ 智能触发（消息数或 token 数超限）
- ✅ 错误恢复（上下文过长时自动压缩并重试）
- ✅ 工具调用配对保护（不破坏 tool-call/tool-result）

#### 3. ToolExecutor - 工具执行 + 重试

带重试机制的工具执行器：

```typescript
import { ToolExecutor } from '@monkey-agent/base';

const executor = new ToolExecutor(
  (name, input) => actualExecutor(name, input),
  {
    maxRetries: 3,          // 最大重试次数
    retryDelay: 1000,       // 重试延迟（ms）
    continueOnError: true,  // 失败后是否继续
  }
);

const result = await executor.execute('toolName', input);
if (result.success) {
  console.log('成功:', result.data);
} else {
  console.log('失败:', result.error);
}
```

**重试策略：** 指数退避（1s → 2s → 4s → ...）

#### 4. ToolBuilder - 流式工具定义

简化工具定义和管理：

```typescript
import { ToolBuilder, ToolManager } from '@monkey-agent/base';

// 定义工具
const weatherTool = new ToolBuilder()
  .name('getWeather')
  .description('获取天气信息')
  .schema(z.object({ city: z.string() }))
  .execute(async ({ city }) => {
    return { city, temp: 20, conditions: '晴天' };
  })
  .build();

// 工具管理器
const manager = new ToolManager();
manager.register(weatherTool);
manager.register(airQualityTool);

// 获取所有工具定义
const definitions = manager.getDefinitions();

// 执行工具
const result = await manager.execute('getWeather', { city: '北京' });
```

### 事件系统

完整的生命周期事件监听：

```typescript
agent.on('agent:start', (data) => {
  console.log('Agent 开始:', data.node.desc);
});

agent.on('agent:thinking', ({ iteration, historyLength }) => {
  console.log(`思考中 (迭代 ${iteration}, 历史 ${historyLength} 条)`);
});

agent.on('agent:tool-call', ({ toolName, input }) => {
  console.log('调用工具:', toolName, input);
});

agent.on('agent:tool-result', ({ toolName, result, success }) => {
  console.log('工具结果:', toolName, success ? '成功' : '失败');
});

agent.on('agent:compressed', ({ afterCount, iteration }) => {
  console.log(`上下文已压缩，剩余 ${afterCount} 条消息`);
});

agent.on('agent:complete', ({ result, duration, iterations }) => {
  console.log(`完成 (耗时 ${duration}ms, ${iterations} 次迭代)`);
});
```

**完整事件列表：**
- `agent:start` - Agent 开始执行
- `agent:thinking` - 每次 LLM 思考
- `agent:tool-call` - 调用工具
- `agent:tool-result` - 工具成功
- `agent:tool-error` - 工具失败
- `agent:warning` - 警告信息
- `agent:compressed` - 上下文压缩
- `agent:context-length-error` - 上下文过长
- `agent:max-iterations` - 达到最大迭代
- `agent:complete` - 执行完成
- `agent:error` - 执行错误

## 系统架构

### 三层架构

```
Chrome Extension (UI 层)
       ↓ WebSocket
NestJS Server (API 层)
       ↓ 调用
Core Packages (业务逻辑层)
```

### 核心组件

| 组件 | 职责 | 位置 |
|------|------|------|
| **BaseAgent** | Agent 基类（ReAct 循环） | @monkey-agent/base |
| **WorkflowOrchestrator** | 工作流调度（DAG 执行） | @monkey-agent/orchestrator |
| **LLMClient** | LLM 调用（支持 Function Calling） | @monkey-agent/llm |
| **BrowserAgent** | 浏览器控制 | @monkey-agent/agents |
| **ComputerAgent** | 系统控制（文件+Shell+计算机） | @monkey-agent/agents |
| **ChatAgent** | 自然语言理解 + Workflow 生成 | @monkey-agent/agents |
| **AgentAdapter** | NestJS 适配器 | server/src/adapters |
| **AgentGateway** | WebSocket 路由 | server/src/gateway |

### 内置 Agents

| Agent | 类型 | 核心能力 | 工具数量 |
|-------|------|---------|---------|
| **BrowserAgent** | 浏览器 | 页面导航、元素操作、内容提取 | 9 |
| **ComputerAgent** | 系统 | 计算机控制 + 文件操作 + Shell 命令 | 17 |
| **ChatAgent** | 对话 | 自然语言理解、Workflow 生成 | 3 |
| **CodeAgent** | 代码 | 代码执行（E2B Sandbox） | 5 |

## 项目结构

```
monkey-agent/
├── packages/              # 核心业务逻辑（独立可复用）
│   ├── types/            # 类型定义
│   ├── base/             # ⭐ BaseAgent + 模块化组件
│   │   ├── BaseAgent.ts          # Agent 基类
│   │   ├── ReactLoop.ts          # ReAct 循环执行器
│   │   ├── ContextManager.ts     # 上下文管理 + 压缩
│   │   ├── ToolExecutor.ts       # 工具执行 + 重试
│   │   └── ToolBuilder.ts        # 工具构建器
│   │
│   ├── llm/              # LLM 客户端（Vercel AI SDK）
│   ├── orchestrator/     # 工作流编排（WorkflowOrchestrator）
│   ├── agents/           # Agent 实现（都继承 BaseAgent）
│   │   ├── browser/      # BrowserAgent
│   │   ├── system/       # ComputerAgent
│   │   └── chat/         # ChatAgent
│   │
│   ├── memory/           # 记忆系统
│   ├── compression/      # 对话历史压缩
│   └── tools/            # 共享工具函数
│
├── server/               # NestJS API 层（薄层）
│   ├── src/
│   │   ├── gateway/      # WebSocket 路由
│   │   ├── adapters/     # 核心包适配器
│   │   │   ├── agent.adapter.ts   # 管理 Agents 和 Orchestrator
│   │   │   └── browser.adapter.ts # 管理 Playwright Browser
│   │   └── common/       # 安全、日志
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── chrome-extension/     # Chrome 插件（纯 UI）
│   ├── background/       # service-worker（简化）
│   ├── sidepanel/        # UI + ServerClient（WebSocket）
│   └── manifest.json
│
├── scripts/
│   └── start-dev.sh      # 开发启动脚本
│
└── docs/
    ├── ARCHITECTURE.md   # 详细架构说明
    └── DEPLOYMENT.md     # 部署指南
```

## Workflow 执行模型

### 统一的 Workflow

所有任务都表示为 Workflow（DAG 有向无环图）：

```typescript
interface Workflow {
  id: string;
  name: string;
  description: string;
  agentGraph: AgentNode[];  // DAG 节点
}

interface AgentNode {
  id: string;
  type: string;           // agent 类型（browser、file、shell 等）
  name: string;           // 节点名称
  desc: string;           // 任务描述
  steps: AgentNodeStep[]; // 执行步骤
  dependencies: string[]; // 依赖的其他节点 ID
}
```

### 简单任务（单节点）

```typescript
const workflow = {
  id: 'task-1',
  name: '打开网页',
  description: '导航到百度首页',
  agentGraph: [
    {
      id: 'browser-1',
      type: 'browser',
      name: '浏览器操作',
      desc: '打开 https://www.baidu.com',
      steps: [
        { stepNumber: 1, desc: '导航到百度' }
      ],
      dependencies: []  // 无依赖
    }
  ]
};

// 执行
const orchestrator = new WorkflowOrchestrator();
orchestrator.registerAgent(browserAgent);
const result = await orchestrator.executeWorkflow(workflow);
```

### 复杂任务（多节点 DAG）

```typescript
const workflow = {
  id: 'task-2',
  name: '数据采集和保存',
  description: '爬取网页数据并保存到文件',
  agentGraph: [
    // 节点 1: 爬取数据
    {
      id: 'browser-1',
      type: 'browser',
      name: '数据采集',
      desc: '访问页面并提取产品信息',
      steps: [
        { stepNumber: 1, desc: '打开目标页面' },
        { stepNumber: 2, desc: '提取产品列表' }
      ],
      dependencies: []
    },
    
    // 节点 2: 保存数据（依赖节点 1）
    {
      id: 'file-1',
      type: 'file',
      name: '数据存储',
      desc: '将数据保存到 products.json',
      steps: [
        { stepNumber: 1, desc: '写入文件' }
      ],
      dependencies: ['browser-1']  // 依赖浏览器节点的输出
    },
    
    // 节点 3: 生成报告（依赖节点 2）
    {
      id: 'file-2',
      type: 'file',
      name: '报告生成',
      desc: '生成数据摘要报告',
      steps: [
        { stepNumber: 1, desc: '读取数据' },
        { stepNumber: 2, desc: '生成报告' }
      ],
      dependencies: ['file-1']
    }
  ]
};

// WorkflowOrchestrator 自动处理：
// 1. 拓扑排序（TopologicalScheduler）
// 2. 并行执行（同层节点自动并行）
// 3. 状态管理（ExecutionContext）
// 4. 错误处理和重试
const result = await orchestrator.executeWorkflow(workflow);
```

### 依赖传递

子节点可以访问父节点的输出：

```typescript
// 在 BaseAgent 中
protected buildUserMessage(node: AgentNode, context: ExecutionContext): string {
  // 获取依赖节点的输出
  const parentOutputs = node.dependencies.map(depId => {
    const output = context.getOutput(depId);
    return `${depId}: ${output?.summary}`;
  }).join('\n');
  
  return `前置任务已完成：\n${parentOutputs}\n\n现在执行：${node.desc}`;
}
```

## 开发指南

### 环境准备

```bash
# 安装依赖
yarn install

# 构建核心包
yarn build

# 运行测试
yarn test
```

### 创建自定义 Agent

#### 方式 1：使用 ToolManager（推荐）

```typescript
import { BaseAgent, ToolBuilder, ToolManager } from '@monkey-agent/base';
import { LLMClient } from '@monkey-agent/llm';
import { z } from 'zod';

class MyCustomAgent extends BaseAgent {
  private toolManager = new ToolManager();
  
  constructor(config) {
    super(config);
    
    // 注册多个工具
    this.toolManager.register(
      new ToolBuilder()
        .name('tool1')
        .description('第一个工具')
        .schema(z.object({ param: z.string() }))
        .execute(async ({ param }) => {
          // 工具逻辑
          return { result: 'success' };
        })
        .build()
    );
    
    this.toolManager.register(
      new ToolBuilder()
        .name('tool2')
        .description('第二个工具')
        .schema(z.object({ input: z.number() }))
        .execute(async ({ input }) => {
          return { output: input * 2 };
        })
        .build()
    );
  }
  
  protected getToolDefinitions() {
    return this.toolManager.getDefinitions();
  }
  
  protected async executeToolCall(toolName: string, input: any) {
    return this.toolManager.execute(toolName, input);
  }
}

// 使用
const agent = new MyCustomAgent({
  id: 'my-agent',
  name: 'My Agent',
  description: 'A custom agent',
  capabilities: ['custom-capability'],
  llmClient: new LLMClient({ ... }),
});
```

#### 方式 2：传统方式（完全控制）

```typescript
import { BaseAgent } from '@monkey-agent/base';
import { tool, z } from 'ai';

class MyAgent extends BaseAgent {
  // 定义工具（不含 execute，避免自动执行）
  protected getToolDefinitions() {
    return {
      myTool: tool({
        description: 'My custom tool',
        parameters: z.object({
          input: z.string(),
        }),
      }),
    };
  }
  
  // 手动处理工具执行
  protected async executeToolCall(toolName: string, input: any) {
    switch (toolName) {
      case 'myTool':
        // 执行实际逻辑
        return { result: 'success' };
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
  
  // 可选：自定义系统提示词
  protected buildSystemPrompt(node: AgentNode, context: ExecutionContext): string {
    return `你是专业的 ${this.name}，当前任务：${node.desc}`;
  }
  
  // 可选：自定义用户消息
  protected buildUserMessage(node: AgentNode, context: ExecutionContext): string {
    const parentOutputs = node.dependencies
      .map(depId => context.getOutput(depId)?.summary)
      .join('\n');
    return `前置任务完成：\n${parentOutputs}\n\n现在执行：${node.desc}`;
  }
}
```

### 使用独立模块

#### 单独使用 ReactLoop

```typescript
import { ReactLoop } from '@monkey-agent/base';

const loop = new ReactLoop();
const result = await loop.run({
  systemPrompt: '你是一个助手',
  userMessage: '查询天气',
  tools: toolDefinitions,
  toolExecutor: (name, input) => executeToolCall(name, input),
  llmClient,
  contextManager,
  eventEmitter,
  maxIterations: 25,
});
```

#### 单独使用 ContextManager

```typescript
import { ContextManager } from '@monkey-agent/base';

const manager = new ContextManager(llmClient, {
  enabled: true,
  maxMessages: 20,
  maxTokens: 8000,
  checkInterval: 5,
});

// 管理上下文
const managed = await manager.manageContext(history, iteration);

// 处理错误
const recovered = await manager.handleContextLengthError(history);
```

#### 单独使用 ToolExecutor

```typescript
import { ToolExecutor } from '@monkey-agent/base';

const executor = new ToolExecutor(
  (name, input) => actualExecutor(name, input),
  {
    maxRetries: 3,
    retryDelay: 1000,
    continueOnError: true,
  }
);

const result = await executor.execute('toolName', input);
```

### 在 NestJS 中注册 Agent

```typescript
// server/src/adapters/agent.adapter.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { WorkflowOrchestrator } from '@monkey-agent/orchestrator';
import { MyCustomAgent } from './my-custom-agent';

@Injectable()
export class AgentAdapter implements OnModuleInit {
  private orchestrator: WorkflowOrchestrator;
  
  async onModuleInit() {
    this.orchestrator = new WorkflowOrchestrator();
    
    // 注册自定义 Agent
    const myAgent = new MyCustomAgent({
      id: 'my-agent',
      name: 'My Agent',
      description: 'My custom agent',
      capabilities: ['custom'],
      llmClient: this.llmClient,
    });
    
    this.orchestrator.registerAgent(myAgent);
  }
  
  async executeWorkflow(workflow: Workflow) {
    return this.orchestrator.executeWorkflow(workflow);
  }
}
```

## 测试

### 核心包测试

```bash
# 运行所有测试
yarn test

# 运行特定包的测试
cd packages/base && yarn test

# 监听模式
yarn test --watch

# 测试覆盖率
yarn test --coverage
```

**测试覆盖情况：**

| 模块 | 测试数量 | 状态 |
|------|---------|------|
| BaseAgent | 10+ | ✅ |
| ToolExecutor | 8 | ✅ |
| ToolBuilder | 15 | ✅ |
| ReactLoop | 8+ | ✅ |
| ContextManager | 6+ | ✅ |

### 服务端测试

```bash
cd server

# 单元测试
yarn test

# E2E 测试
yarn test:e2e

# 监听模式
yarn test:watch
```

### 集成测试

```bash
# 启动服务端
./scripts/start-dev.sh

# 在另一个终端运行集成测试
yarn test:integration
```

## 性能优化

### 1. 上下文压缩

ContextManager 采用定期检查策略，显著减少性能开销：

```typescript
const contextManager = new ContextManager(llmClient, {
  checkInterval: 5,  // 每 5 次迭代才检查一次
});
```

**性能提升：** 压缩检查开销降低 ~60%

### 2. 工具重试

ToolExecutor 支持指数退避重试：

```typescript
const executor = new ToolExecutor(actualExecutor, {
  maxRetries: 3,     // 最多重试 3 次
  retryDelay: 1000,  // 重试延迟：1s → 2s → 4s
});
```

### 3. 并行执行

WorkflowOrchestrator 自动并行执行同层节点：

```typescript
// 这两个节点会并行执行（无依赖关系）
const workflow = {
  agentGraph: [
    { id: 'node-1', dependencies: [] },
    { id: 'node-2', dependencies: [] },  // 与 node-1 并行
    { id: 'node-3', dependencies: ['node-1', 'node-2'] }  // 等待前两个完成
  ]
};
```

## 配置参考

### BaseAgent 配置

```typescript
const agent = new MyAgent({
  id: 'agent-1',                   // 必需：Agent ID
  name: 'My Agent',                // 必需：Agent 名称
  description: 'Description',      // 必需：Agent 描述
  capabilities: ['cap1', 'cap2'],  // 必需：能力列表
  llmClient,                       // 必需：LLM 客户端
  
  // 可选配置
  systemPrompt: '自定义提示词',      // 可选：覆盖默认系统提示词
  maxIterations: 25,               // 可选：最大 ReAct 循环次数（默认 25）
  
  contextCompression: {            // 可选：上下文压缩配置
    enabled: true,                 // 启用压缩（默认 true）
    maxMessages: 20,               // 消息数阈值（默认 20）
    maxTokens: 8000,               // Token 数阈值（默认 8000）
    checkInterval: 5,              // 检查间隔（默认 5）
  },
});
```

### LLMClient 配置

```typescript
import { LLMClient } from '@monkey-agent/llm';

const llmClient = new LLMClient({
  provider: 'openai',              // 'openai' | 'anthropic' | 'local'
  apiKey: 'sk-...',                // API Key
  model: 'gpt-4o',                 // 模型名称
  temperature: 0.7,                // 温度（0-1）
  maxTokens: 2000,                 // 最大 token 数
  
  // 可选：本地模型配置
  baseURL: 'http://localhost:11434/v1',  // Ollama 等
});
```

### WorkflowOrchestrator 配置

```typescript
import { WorkflowOrchestrator } from '@monkey-agent/orchestrator';

const orchestrator = new WorkflowOrchestrator({
  maxParallelTasks: 5,             // 最大并行任务数（默认 5）
  taskTimeout: 300000,             // 任务超时时间（ms，默认 5 分钟）
});

// 注册 Agents
orchestrator.registerAgent(agent1);
orchestrator.registerAgent(agent2);

// 执行 Workflow
const result = await orchestrator.executeWorkflow(workflow, {
  timeout: 60000,                  // 可选：覆盖全局超时
});
```

## 部署

### 本地开发

```bash
# 自动启动（Chrome + 服务端）
./scripts/start-dev.sh

# 手动启动
# 1. 启动 Chrome（CDP 模式）
open -a "Google Chrome" --args --remote-debugging-port=9222

# 2. 启动服务端
cd server && yarn start:dev
```

### Docker 部署

```bash
cd server

# 构建镜像
docker build -t monkey-agent-server .

# 启动服务
docker-compose up -d
```

**docker-compose.yml 配置：**

```yaml
version: '3.8'

services:
  server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - LLM_PROVIDER=openai
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - LLM_MODEL=gpt-4o
      - BROWSER_MODE=launch
    volumes:
      - ./data:/app/data
```

### 云端部署

详见 [部署指南](docs/DEPLOYMENT.md)

## 常见问题

### 1. 如何避免 token 超限？

使用 ContextManager 自动压缩：

```typescript
const agent = new MyAgent({
  // ...其他配置
  contextCompression: {
    enabled: true,
    maxMessages: 20,
    maxTokens: 8000,
  },
});
```

### 2. 工具调用失败怎么办？

ToolExecutor 自动重试：

```typescript
const executor = new ToolExecutor(actualExecutor, {
  maxRetries: 3,          // 最多重试 3 次
  continueOnError: true,  // 失败后继续
});
```

### 3. 如何防止死循环？

限制最大迭代次数：

```typescript
const agent = new MyAgent({
  // ...其他配置
  maxIterations: 25,  // 限制最大迭代次数
});
```

### 4. 如何监听 Agent 执行过程？

使用事件系统：

```typescript
agent.on('agent:thinking', ({ iteration }) => {
  console.log(`思考中 (第 ${iteration} 次)`);
});

agent.on('agent:tool-call', ({ toolName, input }) => {
  console.log('调用工具:', toolName);
});

agent.on('agent:compressed', ({ afterCount }) => {
  console.log(`上下文已压缩，剩余 ${afterCount} 条消息`);
});
```

### 5. 如何自定义 Agent 行为？

重写 BaseAgent 的钩子方法：

```typescript
class MyAgent extends BaseAgent {
  // 自定义系统提示词
  protected buildSystemPrompt(node, context): string {
    return `你是专业的 ${this.name}...`;
  }
  
  // 自定义用户消息
  protected buildUserMessage(node, context): string {
    return `任务：${node.desc}`;
  }
}
```

## 技术栈

### 核心包
- **TypeScript 5** - 类型安全
- **Vercel AI SDK 5** - LLM 调用和 Function Calling
- **Zod** - 运行时类型验证
- **EventEmitter3** - 事件系统

### 服务端
- **NestJS 11** - Web 框架
- **Socket.IO** - WebSocket 通信
- **Playwright 1.49** - 浏览器自动化
- **@nut-tree/nut-js** - 计算机控制（可选）

### 插件
- **React 18** - UI 框架
- **TailwindCSS** - 样式

## 相关文档

### 核心包文档
- [BaseAgent](packages/base/README.md) - Agent 基类和模块化组件
- [LLMClient](packages/llm/README.md) - LLM 客户端使用指南
- [WorkflowOrchestrator](packages/orchestrator/README.md) - 工作流编排器
- [上下文压缩](packages/compression/README.md) - 对话历史压缩详解

### 系统文档
- [架构设计](docs/ARCHITECTURE.md) - 详细架构说明
- [部署指南](docs/DEPLOYMENT.md) - 部署和配置
- [重构进度](docs/REFACTOR_PROGRESS.md) - 项目重构历史

### Agent 文档
- [BrowserAgent](packages/agents/src/browser/README.md) - 浏览器控制
- [ChatAgent](packages/agents/src/chat/README.md) - 自然语言理解
- [CodeAgent](packages/agents/src/code/README.md) - 代码执行

## 贡献

欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 开发规范

- 使用 TypeScript 编写代码
- 遵循现有代码风格
- 为新功能添加测试
- 更新相关文档

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 联系方式

- 项目链接: [https://github.com/yourusername/monkey-agent](https://github.com/yourusername/monkey-agent)
- 问题反馈: [https://github.com/yourusername/monkey-agent/issues](https://github.com/yourusername/monkey-agent/issues)

---

**架构版本**：v2.0（基于 BaseAgent）  
**重构日期**：2025年12月  
**核心特性**：模块化、ReAct 模式、智能上下文管理
