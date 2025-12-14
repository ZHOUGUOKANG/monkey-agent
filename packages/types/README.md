# @monkey-agent/types

TypeScript 类型定义包，为 Monkey Agent 生态系统提供统一的类型接口。

## 📦 安装

```bash
yarn add @monkey-agent/types
```

## 📖 概述

本包提供了 Monkey Agent 框架中所有核心类型定义，包括：

- **Agent 接口** - Agent 核心抽象和执行接口
- **Workflow 类型** - DAG 工作流和任务编排
- **LLM 接口** - 统一的 LLM 客户端接口
- **Memory 类型** - 记忆系统类型
- **Event 类型** - 事件系统枚举和接口

## 🎯 核心类型

### Agent 相关

#### `IAgent`

Agent 核心接口，所有 Agent 必须实现：

```typescript
import type { IAgent, AgentExecutionResult, AgentContext } from '@monkey-agent/types';

interface IAgent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  
  execute(
    task?: string, 
    context?: AgentContext, 
    options?: any
  ): Promise<AgentExecutionResult>;
  
  getToolDefinitions?(): Record<string, any>;
}
```

#### `AgentExecutionResult`

Agent 执行结果：

```typescript
interface AgentExecutionResult {
  agentId: string;
  data: any;
  summary: string;
  status: 'success' | 'failed';
  error?: Error;
  duration?: number;
  iterations?: number;
}
```

#### `AgentContext`

执行上下文，由 WorkflowOrchestrator 提供：

```typescript
interface AgentContext {
  workflowId: string;
  workflowTask: string;
  outputs: Map<string, AgentExecutionResult>;  // 其他节点的输出
  vals: Map<string, any>;  // 共享变量
  workflowContext?: any;
  currentLevel: number;
  status: 'running' | 'completed' | 'failed';
  startTime: number;
  
  getOutput(agentId: string): AgentExecutionResult | undefined;
  getValue(key: string): any;
  setValue(key: string, value: any): void;
  toJSON(): any;
}
```

### Workflow 相关

#### `Workflow`

DAG 工作流定义：

```typescript
interface Workflow {
  id: string;
  name: string;
  description: string;
  agentGraph: AgentNode[];  // DAG 节点
  context?: any;
  estimatedDuration?: number;
}
```

#### `AgentNode`

工作流中的 Agent 节点：

```typescript
interface AgentNode {
  id: string;
  type: string;  // Agent 标识符
  name: string;
  desc: string;  // 任务描述
  steps: AgentNodeStep[];
  dependencies: string[];  // 依赖的其他节点 ID
}

interface AgentNodeStep {
  stepNumber: number;  // 全局步骤编号
  desc: string;  // 步骤描述
}
```

### LLM 相关

#### `ILLMClient`

统一的 LLM 客户端接口：

```typescript
import type { ModelMessage, ToolSet } from 'ai';

interface ILLMClient {
  chat<TOOLS extends Record<string, any>>(
    messages: ModelMessage[],
    options?: {
      system?: string;
      tools?: TOOLS;
      temperature?: number;
      maxTokens?: number;
      maxSteps?: number;
    }
  ): Promise<IChatResult>;
  
  stream<TOOLS extends Record<string, any>>(
    messages: ModelMessage[],
    options?: {...}
  ): any;  // StreamTextResult
  
  streamText(
    messages: ModelMessage[],
    options?: {...}
  ): AsyncIterableIterator<string>;
}
```

#### `LLMConfig`

LLM 客户端配置：

```typescript
interface LLMConfig {
  provider?: 'openai' | 'anthropic' | 'google' | 'openrouter' | 'bedrock' | 'azure' | 'vertex' | 'deepseek';
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  baseURL?: string;
  
  // Provider 特定配置
  region?: string;  // Bedrock
  resourceName?: string;  // Azure
  project?: string;  // Vertex
  
  // 推理配置
  reasoning?: ReasoningConfig;
  
  // 高级选项
  languageModel?: LanguageModel;
}
```

#### `ReasoningConfig`

推理模型配置（OpenAI o1, Claude Extended Thinking, DeepSeek R1 等）：

```typescript
interface ReasoningConfig {
  disabled?: boolean;
  effort?: 'low' | 'medium' | 'high';  // OpenAI o1
  thinking?: boolean | number;  // Claude
  tagName?: string;  // DeepSeek R1
  budgetTokens?: number;  // Bedrock Anthropic
  maxReasoningEffort?: 'low' | 'medium' | 'high';  // Bedrock Nova
  includeThoughts?: boolean;  // Vertex Gemini
  thinkingBudget?: number;  // Vertex Gemini
}
```

### Memory 相关

#### `Memory`

记忆单元：

```typescript
interface Memory {
  id: string;
  type: 'short-term' | 'long-term' | 'working' | 'semantic';
  content: any;
  embedding?: Float32Array;
  metadata?: Record<string, any>;
  createdAt: Date;
  accessCount?: number;
}
```

### Event 相关

#### `AgentEventType`

Agent 事件类型枚举：

```typescript
enum AgentEventType {
  START = 'agent:start',
  THINKING = 'agent:thinking',
  COMPLETE = 'agent:complete',
  ERROR = 'agent:error',
  
  STREAM_TEXT = 'agent:stream-text',
  STREAM_FINISH = 'agent:stream-finish',
  
  TOOL_CALL = 'agent:tool-call',
  TOOL_RESULT = 'agent:tool-result',
  TOOL_ERROR = 'agent:tool-error',
  
  COMPRESSED = 'agent:compressed',
  CONTEXT_LENGTH_ERROR = 'agent:context-length-error',
  WARNING = 'agent:warning',
  MAX_ITERATIONS = 'agent:max-iterations',
}
```

## 📚 使用示例

### 实现自定义 Agent

```typescript
import { IAgent, AgentExecutionResult, AgentContext } from '@monkey-agent/types';
import EventEmitter from 'eventemitter3';

class MyAgent extends EventEmitter implements IAgent {
  public readonly id = 'my-agent';
  public readonly name = 'My Agent';
  public readonly description = 'A custom agent';
  public readonly capabilities = ['custom-task'];
  
  async execute(
    task: string,
    context?: AgentContext
  ): Promise<AgentExecutionResult> {
    // 实现逻辑
    return {
      agentId: this.id,
      data: {},
      summary: 'Task completed',
      status: 'success',
    };
  }
}
```

### 创建 Workflow

```typescript
import type { Workflow, AgentNode } from '@monkey-agent/types';

const workflow: Workflow = {
  id: 'my-workflow',
  name: 'Data Processing Pipeline',
  description: 'Fetch, process, and save data',
  agentGraph: [
    {
      id: 'fetch',
      type: 'browser',
      name: 'Data Fetcher',
      desc: 'Fetch data from website',
      steps: [
        { stepNumber: 1, desc: 'Navigate to URL' },
        { stepNumber: 2, desc: 'Extract data' },
      ],
      dependencies: [],
    },
    {
      id: 'process',
      type: 'code',
      name: 'Data Processor',
      desc: 'Process fetched data',
      steps: [
        { stepNumber: 3, desc: 'Clean data' },
        { stepNumber: 4, desc: 'Transform data' },
      ],
      dependencies: ['fetch'],
    },
  ],
};
```

### 使用 LLM 接口

```typescript
import type { ILLMClient, LLMConfig } from '@monkey-agent/types';
import { LLMClient } from '@monkey-agent/llm';

const config: LLMConfig = {
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o',
  temperature: 0.7,
};

const llm: ILLMClient = new LLMClient(config);

const result = await llm.chat([
  { role: 'user', content: 'Hello!' },
]);

console.log(result.text);
```

## 🔗 相关包

- [`@monkey-agent/base`](../base) - Agent 基类实现
- [`@monkey-agent/llm`](../llm) - LLM 客户端实现
- [`@monkey-agent/orchestrator`](../orchestrator) - Workflow 编排器
- [`@monkey-agent/agents`](../agents) - 内置 Agent 实现

## 📝 类型导出

### 从 AI SDK

本包重新导出以下 AI SDK 类型供使用：

```typescript
export type { 
  ModelMessage,
  ToolSet,
  ToolChoice,
  StreamTextResult,
  GenerateTextResult,
  LanguageModelUsage,
  LanguageModel,
  EmbeddingModel,
} from 'ai';
```

### 完整导出列表

```typescript
// Agent
export type { 
  IAgent,
  AgentInfo,
  AgentExecutionResult,
  AgentContext,
  AgentNode,
  AgentNodeStep,
}

// Workflow
export type {
  Workflow,
  WorkflowExecutionOptions,
  WorkflowExecutionResult,
  AgentExecutionState,
  ExecutionMetrics,
  ExecutionEvent,
}

// LLM
export type {
  ILLMClient,
  IToolCall,
  IChatResult,
  LLMConfig,
  LLMCallOptions,
  LLMChatResult,
  LLMProvider,
  ReasoningConfig,
}

// Embedding
export type {
  EmbeddingOptions,
  EmbedManyOptions,
  EmbedResult,
  EmbedManyResult,
}

// Memory
export type { Memory }

// Events
export { AgentEventType, ReactEventType }

// Event Emitter
export type { IEventEmitter }
```

## 📄 许可证

MIT

