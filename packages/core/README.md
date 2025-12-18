# @monkey-agent/core

Monkey Agent 核心框架，提供 LLM 集成、ReAct Agent 基类、上下文压缩和跨环境支持。

## 特性

- 🧠 **LLM Client** - 基于 [Vercel AI SDK](https://sdk.vercel.ai)，支持 OpenAI/Anthropic/Google 等
- 🔄 **ReAct Agent** - 内置"推理 → 行动 → 观察"循环的 BaseAgent 基类
- 🛠️ **Tool Calling** - 完整的工具调用支持，自动执行或手动控制
- 💬 **上下文压缩** - 混合策略智能压缩，解决长对话 token 限制
- 🌐 **跨环境** - 统一 API 支持 Node.js 和浏览器
- 💭 **推理配置** - 支持 Claude Extended Thinking、OpenAI o1 等

## 安装

```bash
yarn add @monkey-agent/core
```

## 快速开始

### 1. LLM Client

```typescript
import { LLMClient } from '@monkey-agent/core';

const client = new LLMClient({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
});

// 对话
const result = await client.chat([
  { role: 'user', content: '你好！' }
]);
console.log(result.text);

// 流式
for await (const chunk of client.streamText(messages)) {
  process.stdout.write(chunk);
}
```

### 2. Tool Calling

```typescript
import { tool, z } from 'ai';

const weatherTool = tool({
  description: '查询天气',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => {
    return { city, temperature: 15, conditions: '晴' };
  },
});

const result = await client.chat(
  [{ role: 'user', content: '北京天气?' }],
  { tools: { getWeather: weatherTool }, maxSteps: 5 }
);

console.log(result.text);         // "北京今天晴，15°C"
console.log(result.steps.length); // 2 (工具调用 + 最终回答)
```

### 3. 创建自定义 Agent

```typescript
import { BaseAgent } from '@monkey-agent/core';
import { tool, z } from 'ai';

class WeatherAgent extends BaseAgent {
  constructor() {
    super({
      id: 'weather-agent',
      name: 'Weather Assistant',
      description: '智能天气助手',
      capabilities: ['查询天气'],
      llmConfig: {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4',
      },
    });
  }

  // 定义工具（不含 execute）
  protected getToolDefinitions() {
    return {
      getWeather: tool({
        description: '查询城市天气',
        inputSchema: z.object({
          city: z.string(),
        }),
      }),
    };
  }

  // 手动处理工具执行
  protected async executeToolCall(toolName: string, input: any) {
    if (toolName === 'getWeather') {
      // Agent 完全控制执行流程
      return { city: input.city, temperature: 15 };
    }
    throw new Error(`未知工具: ${toolName}`);
  }
}

// 使用
const agent = new WeatherAgent();

agent.on('react:action', ({ action, input }) => {
  console.log(`执行: ${action}`, input);
});

const result = await agent.execute({
  id: 'task-1',
  type: 'query',
  description: '北京和上海哪个更热？',
  parameters: {},
});

console.log(result.data.answer); // Agent 的最终回答
console.log(result.data.steps);  // ReAct 步骤详情
```

### 4. 上下文压缩

```typescript
const agent = new WeatherAgent({
  // ...
  contextCompression: {
    enabled: true,
    maxMessages: 20,        // 消息数阈值
    maxTokens: 8000,        // Token 数阈值
    keepRecentRounds: 3,    // 多轮对话：保留 3 轮
    keepRecentMessages: 10, // 单轮多工具：保留 10 条消息
    autoRetryOnLength: true,
  },
});

// 监听压缩事件
agent.on('context:compressed', ({ summary, newHistoryLength }) => {
  console.log('已压缩:', summary);
});

// 混合策略自动选择：
// - 多轮对话 (≥5轮) → 基于轮次
// - 单轮多工具 (1轮) → 基于消息数
// - 边界情况 (2-4轮) → 智能选择
```

### 5. 推理能力配置

```typescript
// Claude Extended Thinking
const client = new LLMClient({
  provider: 'anthropic',
  model: 'claude-sonnet-4.5',
  reasoning: {
    thinking: true, // 或设置 token 预算: thinking: 10000
  },
});

// OpenAI o1
const o1Client = new LLMClient({
  provider: 'openai',
  model: 'o1-preview',
  reasoning: {
    effort: 'high', // 'low' | 'medium' | 'high'
  },
});
```

## API 参考

### LLMClient

```typescript
// 构造函数
new LLMClient(config: {
  provider?: 'openai' | 'anthropic' | 'google' | ...;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  reasoning?: ReasoningConfig;
})

// 方法
client.chat(messages, options?)          // 普通对话
client.stream(messages, options?)        // 流式对话（返回 StreamTextResult）
client.streamText(messages, options?)    // 便捷流式（直接迭代文本）
client.buildAssistantMessage(toolCalls, text?) // 构建助手消息
client.buildToolResultMessage(toolCall, result) // 构建工具结果
```

### BaseAgent

```typescript
// 构造函数
new BaseAgent(config: {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  llmConfig: LLMConfig;
  maxIterations?: number;      // 默认 25
  contextCompression?: { ... };
})

// 抽象方法（子类实现）
protected abstract getToolDefinitions(): ToolSet;
protected abstract executeToolCall(toolName: string, input: any): Promise<any>;

// 主要方法
agent.execute(task): Promise<TaskResult>  // 执行任务（ReAct 循环）
agent.plan(goal): Promise<Plan>           // 规划任务
agent.reflect(result): Promise<Reflection> // 反思

// 工具方法
agent.getConversationHistory()
agent.clearConversationHistory()
agent.getLLMClient()
agent.getCompressionSummary()
```

### 事件系统

```typescript
// 任务生命周期
agent.on('task:start', (task) => {})
agent.on('task:complete', (result) => {})

// ReAct 循环
agent.on('react:iteration', ({ iteration }) => {})
agent.on('react:action', ({ action, input }) => {})
agent.on('react:observation', ({ action, result }) => {})
agent.on('react:final-answer', ({ answer }) => {})

// 上下文压缩
agent.on('context:compressed', ({ summary, newHistoryLength }) => {})
agent.on('context:proactive-compression-triggered', ({ messageCount }) => {})
agent.on('context:length-error-detected', ({ error }) => {})
```

## 类型定义

```typescript
import type {
  LLMConfig,
  LLMCallOptions,
  ReasoningConfig,
  IAgent,
  Task,
  TaskResult,
  Goal,
  Plan,
  Reflection,
  ToolSet,
  ModelMessage,
} from '@monkey-agent/core';
```

## 环境变量

```bash
# .env 文件
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1  # 可选

ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
```

使用环境工具函数：

```typescript
import { initEnv, getLLMConfig } from '@monkey-agent/core';

initEnv();  // 加载并验证环境变量
const config = getLLMConfig('openai'); // 自动读取配置
const client = new LLMClient(config);
```

## 测试

```bash
yarn test:llm           # LLM Client 测试
yarn test:weather-agent # Weather Agent 示例
yarn test:compression   # 上下文压缩测试

# 指定模型
OPENAI_MODEL=gpt-4 yarn test:llm
```

## 架构设计

```
BaseAgent (ReAct 循环控制)
    ↓
LLMClient (LLM 通信)
    ↓
Vercel AI SDK (多提供商支持)
```

**设计原则：**
- LLM Client 专注于通信，不执行工具
- BaseAgent 控制工具执行流程
- 工具定义与执行分离（方便集成 MCP）

## 依赖

- [Vercel AI SDK](https://sdk.vercel.ai) - 统一 AI SDK
- [@ai-sdk/openai](https://www.npmjs.com/package/@ai-sdk/openai) - OpenAI
- [@ai-sdk/anthropic](https://www.npmjs.com/package/@ai-sdk/anthropic) - Anthropic
- [@ai-sdk/google](https://www.npmjs.com/package/@ai-sdk/google) - Google
- [EventEmitter3](https://github.com/primus/eventemitter3) - 事件系统
- [Zod](https://zod.dev) - 类型验证

## 详细文档

- [LLM Tool Calling](./src/llm/README.md) - 工具调用详细指南
- [上下文压缩](./src/compression/README.md) - 压缩策略详解
- [工具函数](./src/utils/README.md) - 环境配置工具

## 许可证

MIT
