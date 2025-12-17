# @monkey-agent/context

工作流上下文管理和工具注入，为多 Agent 协作提供共享状态和通信机制。

## 📦 安装

```bash
yarn add @monkey-agent/context
```

## 📖 概述

`@monkey-agent/context` 提供了三个核心功能：

1. **ContextManager** - 智能上下文管理和压缩
2. **Context Tools** - Agent 间共享数据的工具集
3. **Context Injection** - 自动注入上下文提示到 Agent

## 🎯 核心功能

### 1. ContextManager - 上下文管理器

智能管理对话历史，自动压缩以避免 token 超限。

#### 基本用法

```typescript
import { ContextManager } from '@monkey-agent/context';
import type { ModelMessage } from 'ai';
import { LLMClient } from '@monkey-agent/llm';

const llmClient = new LLMClient({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o',
});

const contextManager = new ContextManager(llmClient, {
  enabled: true,
  maxMessages: 20,     // 消息数阈值
  maxTokens: 8000,     // Token 数阈值
  checkInterval: 5,    // 每 5 次迭代检查一次
});

// 管理上下文
let history: ModelMessage[] = [...];
let iteration = 0;

history = await contextManager.manageContext(history, iteration++);
```

#### 配置选项

```typescript
interface ContextCompressionConfig {
  enabled?: boolean;           // 是否启用压缩，默认 true
  maxMessages?: number;        // 消息数阈值，默认 20
  maxTokens?: number;          // Token 数阈值，默认 8000
  checkInterval?: number;      // 检查间隔，默认 5
  keepRecentRounds?: number;   // 保留最近轮数，默认 3
  keepRecentMessages?: number; // 保留最近消息数，默认 10
}
```

#### 错误恢复

当 LLM 返回上下文过长错误时，自动压缩并重试：

```typescript
try {
  const response = await llmClient.chat(history);
} catch (error: any) {
  if (contextManager.isContextLengthError(error.message)) {
    console.log('⚠️ 上下文过长，自动压缩...');
    history = await contextManager.handleContextLengthError(history);
    // 重试
    const response = await llmClient.chat(history);
  }
}
```

### 2. Context Tools - 上下文工具

提供 Agent 间共享数据的标准工具集。

#### 可用工具

| 工具 | 描述 | 参数 |
|------|------|------|
| `valGet` | 获取共享变量 | `key: string` |
| `valSet` | 设置共享变量 | `key: string, value: any` |
| `valList` | 列出所有变量 | - |
| `getDependencyOutput` | 获取依赖节点输出 | `agentId: string` |

#### 使用示例

```typescript
import { createContextTools, executeContextTool } from '@monkey-agent/context';
import type { AgentContext } from '@monkey-agent/types';

// 创建工具集
const contextTools = createContextTools();

// 在 Agent 中使用
class MyAgent extends BaseAgent {
  protected getToolDefinitions() {
    return {
      ...contextTools,  // 添加上下文工具
      myTool: tool({...}),
    };
  }
  
  protected async executeToolCall(toolName: string, input: any) {
    // 检查是否为上下文工具
    if (isContextTool(toolName)) {
      return executeContextTool(toolName, input, this.context);
    }
    
    // 处理自定义工具
    // ...
  }
}
```

#### 工具详细说明

**valSet - 设置变量**

```typescript
// 在 Agent A 中设置
await executeContextTool('valSet', {
  key: 'userData',
  value: { name: 'John', age: 30 },
}, context);
```

**valGet - 获取变量**

```typescript
// 在 Agent B 中获取
const result = await executeContextTool('valGet', {
  key: 'userData',
}, context);

console.log(result);  // { name: 'John', age: 30 }
```

**valList - 列出所有变量**

```typescript
const result = await executeContextTool('valList', {}, context);
console.log(result);  // ['userData', 'config', ...]
```

**getDependencyOutput - 获取依赖输出**

```typescript
// 获取前置 Agent 的输出
const result = await executeContextTool('getDependencyOutput', {
  agentId: 'agent-1',
}, context);

console.log(result.summary);  // Agent 1 的执行摘要
console.log(result.data);     // Agent 1 的输出数据
```

### 3. Context Injection - 上下文注入

自动构建包含上下文信息的提示词。

#### 基本用法

```typescript
import { buildContextInjectionPrompt } from '@monkey-agent/context';
import type { AgentContext, AgentNode } from '@monkey-agent/types';

const prompt = buildContextInjectionPrompt(context, currentNode);

// 使用生成的提示词
const fullPrompt = `
${systemPrompt}

${prompt}  // 注入上下文信息

现在执行任务：${currentNode.desc}
`;
```

#### 生成的提示词示例

```
## 工作流上下文

当前工作流: data-pipeline
工作流任务: 数据采集和分析

## 共享变量

可用的共享变量：
- config: { apiUrl: "...", timeout: 5000 }
- userData: { name: "John", age: 30 }

使用 valGet 工具获取变量值。

## 前置 Agent 输出

Agent: browser-agent
状态: 已完成
摘要: 成功从网页提取了 100 条数据记录

使用 getDependencyOutput 工具获取详细输出。

## 可用的上下文工具

- valGet(key): 获取共享变量
- valSet(key, value): 设置共享变量
- valList(): 列出所有变量
- getDependencyOutput(agentId): 获取依赖输出
```

## 📚 完整示例

### 多 Agent 协作示例

```typescript
import { WorkflowOrchestrator } from '@monkey-agent/orchestrator';
import { createContextTools } from '@monkey-agent/context';
import type { Workflow } from '@monkey-agent/types';

// 定义工作流
const workflow: Workflow = {
  id: 'data-pipeline',
  name: '数据处理管道',
  description: '采集、处理、保存数据',
  agentGraph: [
    {
      id: 'fetch',
      type: 'browser',
      name: '数据采集',
      desc: '从网页采集数据',
      steps: [{ stepNumber: 1, desc: '访问并提取数据' }],
      dependencies: [],
    },
    {
      id: 'process',
      type: 'code',
      name: '数据处理',
      desc: '清洗和转换数据',
      steps: [{ stepNumber: 2, desc: '处理采集的数据' }],
      dependencies: ['fetch'],
    },
    {
      id: 'save',
      type: 'file',
      name: '数据保存',
      desc: '保存处理后的数据',
      steps: [{ stepNumber: 3, desc: '写入文件' }],
      dependencies: ['process'],
    },
  ],
};

// 创建编排器并执行
const orchestrator = new WorkflowOrchestrator();

// Agent 会自动获得上下文工具
const result = await orchestrator.executeWorkflow(workflow);

// process Agent 可以访问 fetch Agent 的输出
// save Agent 可以访问 process Agent 的输出
```

### 自定义 Agent 集成

```typescript
import { BaseAgent } from '@monkey-agent/base';
import { 
  createContextTools, 
  isContextTool, 
  executeContextTool,
  buildContextInjectionPrompt,
} from '@monkey-agent/context';
import type { AgentContext, AgentNode } from '@monkey-agent/types';
import { tool, z } from 'ai';

class DataProcessorAgent extends BaseAgent {
  protected getToolDefinitions() {
    return {
      // 添加上下文工具
      ...createContextTools(),
      
      // 自定义工具
      processData: tool({
        description: 'Process data',
        parameters: z.object({
          data: z.array(z.any()),
        }),
      }),
    };
  }
  
  protected async executeToolCall(toolName: string, input: any) {
    // 处理上下文工具
    if (isContextTool(toolName)) {
      return executeContextTool(toolName, input, this.context);
    }
    
    // 处理自定义工具
    if (toolName === 'processData') {
      // 获取前置 Agent 的数据
      const fetchOutput = await executeContextTool(
        'getDependencyOutput',
        { agentId: 'fetch' },
        this.context
      );
      
      const processedData = this.processData(fetchOutput.data);
      
      // 保存到共享变量供后续 Agent 使用
      await executeContextTool(
        'valSet',
        { key: 'processedData', value: processedData },
        this.context
      );
      
      return { success: true, count: processedData.length };
    }
  }
  
  protected buildUserMessage(node: AgentNode, context: AgentContext): string {
    // 自动注入上下文信息
    const contextPrompt = buildContextInjectionPrompt(context, node);
    
    return `
${contextPrompt}

任务: ${node.desc}

步骤:
${node.steps.map(s => `${s.stepNumber}. ${s.desc}`).join('\n')}
`;
  }
}
```

## 🔧 API 参考

### ContextManager

#### 构造函数

```typescript
constructor(llmClient: ILLMClient, config?: ContextCompressionConfig)
```

#### 方法

- `manageContext(history, iteration)` - 管理上下文，必要时压缩
- `handleContextLengthError(history)` - 处理上下文过长错误
- `isContextLengthError(errorMessage)` - 检查是否为上下文错误

### Context Tools

#### createContextTools()

创建上下文工具集。

**返回:** `ToolSet` - 包含所有上下文工具的对象

#### isContextTool(toolName)

检查是否为上下文工具。

**参数:**
- `toolName: string` - 工具名称

**返回:** `boolean`

#### executeContextTool(toolName, input, context)

执行上下文工具。

**参数:**
- `toolName: string` - 工具名称
- `input: any` - 工具输入
- `context: AgentContext` - 执行上下文

**返回:** `Promise<any>` - 工具执行结果

### Context Injection

#### buildContextInjectionPrompt(context, node?)

构建上下文注入提示词。

**参数:**
- `context: AgentContext` - 执行上下文
- `node?: AgentNode` - 当前节点（可选）

**返回:** `string` - 格式化的上下文提示词

## 🔗 相关包

- [`@monkey-agent/compression`](../compression) - 对话历史压缩
- [`@monkey-agent/orchestrator`](../orchestrator) - 工作流编排
- [`@monkey-agent/base`](../base) - Agent 基类
- [`@monkey-agent/types`](../types) - 类型定义

## 📄 许可证

MIT

