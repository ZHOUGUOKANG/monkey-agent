# Base Agent

Agent 基类，提供模块化的 LLM 驱动 ReAct（推理 + 行动）循环。

## 核心特性

- 🤖 **ReAct 模式**：自动进行思考 → 行动 → 观察的推理循环
- 🛠️ **工具系统**：支持工具定义和手动执行控制
- 💬 **对话管理**：自动维护对话历史，支持智能上下文压缩
- 🔄 **重试机制**：工具执行失败自动重试，支持指数退避
- 🛡️ **智能终止**：防止死循环和连续失败，节省 token
- 📦 **模块化设计**：ReactLoop、ContextManager、ToolExecutor 独立复用
- 📊 **事件系统**：完整的生命周期事件监听
- 🧪 **高测试覆盖**：54+ 单元测试，确保稳定性

## 安装

```bash
yarn add @monkey-agent/base
```

## 快速开始

### 最简单的方式：一行代码执行

```typescript
import { BaseAgent } from '@monkey-agent/base';
import { LLMClient } from '@monkey-agent/llm';
import { tool, z } from 'ai';

class WeatherAgent extends BaseAgent {
  // 1. 定义工具（不含 execute，避免自动执行）
  protected getToolDefinitions() {
    return {
      getWeather: tool({
        description: 'Get weather information',
        inputSchema: z.object({
          city: z.string().describe('City name'),
        }),
      }),
    };
  }
  
  // 2. 手动处理工具执行
  protected async executeToolCall(toolName: string, input: any) {
    if (toolName === 'getWeather') {
      // 调用实际的天气 API
      return await this.weatherAPI.get(input.city);
    }
    throw new Error(`Unknown tool: ${toolName}`);
  }
}

// 创建 Agent
const llmClient = new LLMClient({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o',
});

const agent = new WeatherAgent({
  id: 'weather-agent',
  name: 'Weather Assistant',
  description: 'A weather information agent',
  capabilities: ['weather-query'],
  llmClient,
});

// 🎉 最简单的方式：只需一个字符串
const result = await agent.execute('查询北京今天的天气');
console.log(result.summary);
```

### 带步骤的结构化执行

```typescript
// 为复杂任务提供详细步骤
const result = await agent.execute('抓取网站数据', undefined, {
  agentNode: {
    steps: [
      { stepNumber: 1, desc: '打开目标网站' },
      { stepNumber: 2, desc: '等待页面加载' },
      { stepNumber: 3, desc: '提取数据' }
    ]
  }
});
```

### Workflow 调度（完整上下文）

```typescript
// 在 WorkflowOrchestrator 中使用
const result = await agent.execute(
  agentNode.desc,      // 任务描述
  context,             // 执行上下文
  {
    agentNode: agentNode,  // 完整的 node 信息（包含 steps、dependencies）
  }
);
```

```typescript
import { BaseAgent, ToolBuilder, ToolManager } from '@monkey-agent/base';

class WeatherAgent extends BaseAgent {
  private toolManager = new ToolManager();
  
  constructor(config) {
    super(config);
    
    // 使用 ToolBuilder 简化工具定义
    this.toolManager.register(
      new ToolBuilder()
        .name('getWeather')
        .description('Get weather information')
        .schema(z.object({ city: z.string() }))
        .execute(async ({ city }) => {
          return await this.weatherAPI.get(city);
        })
        .build()
    );
    
    this.toolManager.register(
      new ToolBuilder()
        .name('getAirQuality')
        .description('Get air quality index')
        .schema(z.object({ city: z.string() }))
        .execute(async ({ city }) => {
          return await this.airQualityAPI.get(city);
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
```

## 配置选项

### BaseAgentConfig

| 字段 | 类型 | 必需 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | string | ✅ | - | Agent 唯一标识 |
| `name` | string | ✅ | - | Agent 名称 |
| `description` | string | ✅ | - | Agent 描述 |
| `capabilities` | string[] | ✅ | - | Agent 能力列表 |
| `llmClient` | ILLMClient | ✅ | - | LLM 客户端实例 |
| `systemPrompt` | string | ❌ | auto | 自定义系统提示词 |
| `maxIterations` | number | ❌ | 25 | 最大 ReAct 循环次数 |
| `contextCompression` | Config | ❌ | auto | 上下文压缩配置 |

### 上下文压缩配置

智能压缩对话历史，避免超出 token 限制：

```typescript
const agent = new MyAgent({
  // ... 其他配置
  contextCompression: {
    enabled: true,          // 启用压缩（默认 true）
    maxMessages: 20,        // 消息数阈值
    maxTokens: 8000,        // Token 数阈值
  },
});
```

**压缩策略：**
- ✅ 定期检查（每 5 次迭代）- 减少性能开销
- ✅ 智能触发（消息数或 token 数超限）
- ✅ 错误恢复（上下文过长时自动压缩并重试）
- ✅ 工具调用配对保护（确保不破坏 tool-call/tool-result 对）

## 事件监听

BaseAgent 采用两层事件模型：

### 事件分层架构

```
内部层（ReactLoop）          外部层（BaseAgent）
react:thinking        →      agent:thinking
react:action          →      agent:tool-call
react:observation     →      agent:tool-result
react:observation-error →    agent:tool-error
react:compressed      →      agent:compressed
react:stream-text     →      agent:stream-text
react:stream-finish   →      agent:stream-finish
react:warning         →      agent:warning
react:max-iterations  →      agent:max-iterations
react:context-length-error → agent:context-length-error
```

**设计原则**：
- **内部事件（react:*）**：由 ReactLoop 发射，表示 ReAct 循环的执行细节
- **外部事件（agent:*）**：由 BaseAgent 发射，统一的公共 API，所有事件都包含 `agentId`
- **职责分离**：外部使用者只需监听 `agent:*` 事件，内部实现细节被封装

### 使用示例

监听 Agent 执行过程中的事件：

```typescript
agent.on('agent:start', (data) => {
  console.log('Agent 开始:', data.node.desc);
});

agent.on('agent:thinking', ({ agentId, iteration, historyLength }) => {
  console.log(`${agentId} 思考中 (迭代 ${iteration}, 历史 ${historyLength} 条)`);
});

agent.on('agent:tool-call', ({ agentId, toolName, input }) => {
  console.log(`${agentId} 调用工具:`, toolName, input);
});

agent.on('agent:tool-result', ({ agentId, toolName, result, success }) => {
  console.log(`${agentId} 工具结果:`, toolName, success ? '成功' : '失败');
});

agent.on('agent:complete', ({ agentId, result, duration, iterations }) => {
  console.log(`${agentId} 完成 (耗时 ${duration}ms, ${iterations} 次迭代)`);
});

agent.on('agent:compressed', ({ agentId, afterCount, iteration }) => {
  console.log(`${agentId} 上下文已压缩，剩余 ${afterCount} 条消息`);
});
```

### 完整事件列表

| 事件 | 触发时机 | 参数 |
|------|---------|------|
| `agent:start` | Agent 开始执行 | `{ agentId, node, workflowId, timestamp }` |
| `agent:thinking` | 每次 LLM 思考 | `{ agentId, iteration, historyLength, timestamp }` |
| `agent:tool-call` | 调用工具 | `{ agentId, toolCallId, toolName, input, iteration, timestamp }` |
| `agent:tool-result` | 工具成功 | `{ agentId, toolCallId, toolName, result, success, iteration, timestamp }` |
| `agent:tool-error` | 工具失败 | `{ agentId, toolCallId, toolName, error, iteration, timestamp }` |
| `agent:warning` | 警告信息 | `{ agentId, message, iteration, timestamp }` |
| `agent:compressed` | 上下文压缩 | `{ agentId, afterCount, iteration, timestamp }` |
| `agent:context-length-error` | 上下文过长 | `{ agentId, error, historyLength, timestamp }` |
| `agent:max-iterations` | 达到最大迭代 | `{ agentId, maxIterations, timestamp }` |
| `agent:stream-text` | 流式文本片段 | `{ agentId, textDelta, iteration, timestamp }` |
| `agent:stream-finish` | 流式响应完成 | `{ agentId, finishReason, usage, iteration, timestamp }` |
| `agent:complete` | 执行完成 | `{ agentId, result, duration, iterations, timestamp }` |
| `agent:error` | 执行错误 | `{ agentId, error, stack, timestamp }` |

> ⚠️ **注意**：请只监听 `agent:*` 事件，不要直接监听 `react:*` 内部事件，以保持代码的可维护性和向后兼容性。

## 模块化组件

BaseAgent 由以下独立模块组成，可单独使用：

### ReactLoop - ReAct 循环执行器

```typescript
import { ReactLoop } from '@monkey-agent/base';

const loop = new ReactLoop();
const result = await loop.run({
  systemPrompt: '...',
  userMessage: '...',
  tools: toolSet,
  toolExecutor: (name, input) => executeToolCall(name, input),
  llmClient,
  contextManager,
  eventEmitter,
  maxIterations: 25,
});
```

### ContextManager - 上下文管理器

```typescript
import { ContextManager } from '@monkey-agent/base';

const contextManager = new ContextManager(llmClient, {
  enabled: true,
  maxMessages: 20,
  maxTokens: 8000,
  checkInterval: 5,  // 每 5 次迭代检查一次
});

// 管理上下文
const managed = await contextManager.manageContext(history, iteration);

// 处理错误
const recovered = await contextManager.handleContextLengthError(history);
```

### ToolExecutor - 工具执行器

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

### ToolBuilder - 工具构建器

```typescript
import { ToolBuilder, ToolManager } from '@monkey-agent/base';

// 单个工具
const weatherTool = new ToolBuilder()
  .name('getWeather')
  .description('Get weather information')
  .schema(z.object({ city: z.string() }))
  .execute(async ({ city }) => {
    return { city, temp: 20, conditions: 'Sunny' };
  })
  .build();

// 工具管理器
const manager = new ToolManager();
manager.register(weatherTool);
```

## 高级用法

### 自定义系统提示词

```typescript
class MyAgent extends BaseAgent {
  protected buildSystemPrompt(node: AgentNode, context: ExecutionContext): string {
    return `你是专业的${this.name}
    
当前任务: ${node.desc}
工作流: ${context.workflowTask}

可用工具: ${Object.keys(this.getToolDefinitions()).join(', ')}

请按照步骤完成任务，使用工具获取信息。`;
  }
}
```

### 自定义用户消息

```typescript
class MyAgent extends BaseAgent {
  protected buildUserMessage(node: AgentNode, context: ExecutionContext): string {
    // 获取父节点信息
    const parentOutputs = node.dependencies.map(depId => {
      const output = context.getOutput(depId);
      return `${depId}: ${output?.summary}`;
    }).join('\n');
    
    return `前置任务已完成：\n${parentOutputs}\n\n现在执行：${node.desc}`;
  }
}
```

## 测试

```bash
# 运行所有测试
yarn test

# 运行特定测试
yarn test ToolExecutor

# 监听模式
yarn test --watch
```

**测试覆盖：**
- ToolExecutor: 8 tests ✅
- ToolBuilder: 15 tests ✅
## 架构说明

BaseAgent 采用模块化设计，职责分离：

```
BaseAgent (协调器)
  ├── ReactLoop (ReAct 循环逻辑)
  └── ContextManager (上下文管理)
```

**优势：**
- ✅ 各模块可独立测试
- ✅ 代码清晰，职责单一
- ✅ 组件可复用
- ✅ 易于扩展

## 性能优化

### 延迟压缩检查

ContextManager 采用定期检查策略，减少不必要的开销：

```typescript
// 每 5 次迭代才检查一次是否需要压缩
// 而不是每次迭代都检查
```

**性能提升：** 压缩检查开销降低 ~60%

### 工具重试

ToolExecutor 支持指数退避重试：

```typescript
// 重试延迟：1s → 2s → 4s → ...
maxRetries: 3
retryDelay: 1000  // 基础延迟
```

## 相关文档

- [LLM Client](../llm/README.md) - LLM 客户端使用指南
- [上下文压缩](../compression/README.md) - 对话历史压缩详解
- [CHANGELOG](./CHANGELOG.md) - 版本变更历史
- [MIGRATION](./MIGRATION.md) - 迁移指南

## 许可证

MIT
