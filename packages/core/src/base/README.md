# Base Agent

Agent 基类，提供 LLM 驱动的 ReAct（推理 + 行动）循环。

## 核心特性

- 🤖 **ReAct 模式**：自动进行思考 → 行动 → 观察的推理循环
- 🛠️ **工具系统**：支持工具定义和手动执行控制
- 💬 **对话管理**：自动维护对话历史，支持上下文压缩
- 🧠 **反思能力**：可选的执行结果反思和经验学习
- 📊 **事件系统**：完整的生命周期事件监听

## 快速开始

### 基础使用

```typescript
import { BaseAgent, tool, z } from '@monkey-agent/core';

class MyAgent extends BaseAgent {
  // 1. 定义工具（不含 execute，避免自动执行）
  protected getToolDefinitions() {
    return {
      searchWeb: tool({
        description: 'Search the web',
        parameters: z.object({
          query: z.string(),
        }),
      }),
    };
  }
  
  // 2. 手动处理工具执行
  protected async executeToolCall(toolName: string, input: any) {
    if (toolName === 'searchWeb') {
      return await this.searchAPI(input.query);
    }
    throw new Error(`Unknown tool: ${toolName}`);
  }
}

// 创建 Agent
const agent = new MyAgent({
  id: 'my-agent',
  name: 'My Agent',
  description: 'A helpful agent',
  capabilities: ['search'],
  llmConfig: {
    provider: 'openai',
    apiKey: 'sk-...',
    model: 'gpt-4',
  },
});

// 执行任务
const result = await agent.execute({
  id: 'task-1',
  type: 'search',
  description: 'Find information about AI',
  parameters: {},
});
```

## 配置选项

### BaseAgentConfig

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | Agent 唯一标识 |
| `name` | string | Agent 名称 |
| `description` | string | Agent 描述 |
| `capabilities` | string[] | Agent 能力列表 |
| `llmClient` | LLMClient | LLM 客户端实例（优先） |
| `llmConfig` | LLMConfig | LLM 配置（当 llmClient 未提供时使用） |
| `systemPrompt` | string | 自定义系统提示词 |
| `maxIterations` | number | 最大 ReAct 循环次数（默认 25） |
| `enableReflection` | boolean | 是否启用反思（默认 true） |
| `contextCompression` | ContextCompressionConfig | 上下文压缩配置 |

### 上下文压缩

自动压缩过长的对话历史，避免超出 token 限制：

```typescript
const agent = new MyAgent({
  // ... 其他配置
  contextCompression: {
    enabled: true,                // 启用压缩（默认 true）
    maxMessages: 20,              // 消息数超过此值时触发压缩
    maxTokens: 8000,              // Token 数超过此值时触发压缩
    keepRecentRounds: 3,          // 保留最近 N 轮对话
    keepRecentMessages: 10,       // 保留最近 N 条消息
    autoRetryOnLength: true,      // 上下文过长时自动压缩并重试
    enableTool: true,             // 允许 LLM 主动调用压缩工具
  },
});
```

## 事件监听

监听 Agent 执行过程中的事件：

```typescript
agent.on('task:start', (task) => {
  console.log('任务开始:', task);
});

agent.on('react:action', ({ action, input }) => {
  console.log('执行操作:', action, input);
});

agent.on('react:observation', ({ action, result }) => {
  console.log('观察结果:', action, result);
});

agent.on('task:complete', (result) => {
  console.log('任务完成:', result);
});

agent.on('context:compressed', ({ summary, originalLength, newHistoryLength }) => {
  console.log(`上下文已压缩: ${originalLength} -> ${newHistoryLength}`);
});
```

### 完整事件列表

| 事件 | 触发时机 | 参数 |
|------|---------|------|
| `task:start` | 任务开始 | task |
| `task:complete` | 任务完成 | result |
| `task:error` | 任务失败 | result |
| `task:reflect` | 反思生成 | reflection |
| `react:iteration` | 每次 ReAct 循环 | { iteration, task } |
| `react:action` | 执行工具 | { action, input } |
| `react:observation` | 工具结果 | { action, result } |
| `react:final-answer` | 得到最终答案 | { answer } |
| `react:error` | 执行错误 | { action, error } |
| `context:compressed` | 上下文已压缩 | { summary, originalLength, newHistoryLength } |
| `context:compression-error` | 压缩失败 | { error } |
| `context:length-error-detected` | 检测到上下文过长 | { error, historyLength } |

## 高级用法

### 自定义系统提示词

```typescript
class MyAgent extends BaseAgent {
  protected buildSystemPrompt(): string {
    return `你是专业的搜索助手...`;
  }
}
```

### 继续对话

```typescript
// 第一次对话
await agent.execute({
  id: 'task-1',
  description: '今天天气怎么样？',
  parameters: {},
});

// 继续对话，保持历史
await agent.execute({
  id: 'task-2',
  description: '明天呢？',
  parameters: {
    continueConversation: true, // 保持对话历史
  },
});
```

### 访问对话历史

```typescript
// 获取对话历史
const history = agent.getConversationHistory();

// 清除对话历史
agent.clearConversationHistory();
```

### 直接使用 LLM 客户端

```typescript
// 获取底层 LLM 客户端
const llm = agent.getLLMClient();

// 直接调用
const result = await llm.chat([
  { role: 'user', content: 'Hello' }
]);
```

## 设计理念

### 工具执行控制

BaseAgent 采用**手动工具执行**的设计：

1. `getToolDefinitions()` 返回**不含 execute 函数**的工具定义
2. LLM Client 只返回工具调用信息，不自动执行
3. Agent 通过 `executeToolCall()` 完全控制执行流程

**优势**：

- ✅ 完全控制执行时机和方式
- ✅ 方便添加验证、缓存、重试逻辑
- ✅ 无缝集成 MCP 工具
- ✅ 支持执行前的权限检查

### ReAct 循环

自动执行 **思考 → 行动 → 观察** 的循环：

```
用户请求
  ↓
LLM 推理（思考）
  ↓
调用工具（行动）
  ↓
获取结果（观察）
  ↓
继续推理或返回答案
```

## 相关文档

- [LLM Client](../llm/README.md) - LLM 客户端使用指南
- [上下文压缩](../compression/README.md) - 对话历史压缩详解
- [类型定义](../types/index.ts) - 完整类型定义
