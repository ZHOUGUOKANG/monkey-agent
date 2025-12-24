# @monkey-agent/tools

Tool 系统 - 为 Monkey Agent 提供工具定义、执行和管理功能。

## 设计理念

**极简原则**：Tool 是一等公民，但不过度抽象
- ✅ 直接使用 Vercel AI SDK 的 `tool()` 函数
- ✅ 提供必要的类型定义和辅助函数
- ✅ ToolExecutor 提供重试、错误处理等增强功能

## 安装

```bash
yarn add @monkey-agent/tools
```

## 快速开始

### 定义工具

```typescript
import { tool } from '@monkey-agent/tools';
import { z } from 'zod';

// 直接使用 AI SDK 的 tool() 函数
const searchTool = tool({
  description: 'Search files',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
  }),
  execute: async ({ query }) => {
    // 实现逻辑
    return { results: [...] };
  },
});
```

### 在 Agent 中使用

```typescript
import { BaseAgent } from '@monkey-agent/base';
import { tool } from '@monkey-agent/tools';
import { z } from 'zod';

class MyAgent extends BaseAgent {
  protected getToolDefinitions() {
    return {
      search: tool({
        description: 'Search files',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => {
          // 实现逻辑
          return { results: [] };
        },
      }),
      
      analyze: tool({
        description: 'Analyze data',
        inputSchema: z.object({ data: z.string() }),
        execute: async ({ data }) => {
          // 实现逻辑
          return { summary: '...' };
        },
      }),
    };
  }
}
```

### 使用 ToolExecutor（增强功能）

```typescript
import { ToolExecutor } from '@monkey-agent/tools';

// 创建执行器（带重试）
const executor = new ToolExecutor({
  maxRetries: 3,
  retryDelay: 1000,
  continueOnError: true,
});

// 执行可能失败的操作
const result = await executor.execute(async () => {
  // 可能失败的操作
  return await fetch('https://api.example.com');
});

if (result.success) {
  console.log('成功:', result.data);
} else {
  console.error('失败:', result.error);
}

// 包装函数（自动抛出错误）
const safeFetch = executor.wrap(async () => {
  return await fetch('https://api.example.com');
});

const data = await safeFetch(); // 失败时自动抛出错误
```

## API 参考

### 类型定义

#### ToolResult

```typescript
interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  shouldContinue?: boolean;  // 失败后是否继续 ReAct 循环
}
```

#### ToolMetadata

```typescript
interface ToolMetadata {
  category?: string;      // 'file' | 'network' | 'system'
  tags?: string[];
  version?: string;
}
```

### ToolExecutor

提供增强的工具执行功能：
- 重试机制（指数退避）
- 错误处理
- 链式配置

```typescript
class ToolExecutor {
  constructor(config?: ToolExecutorConfig);
  
  // 执行（返回结果对象）
  execute<T>(executor: () => Promise<T>): Promise<ToolResult<T>>;
  
  // 包装（失败时抛出错误）
  wrap<T>(executor: () => Promise<T>): () => Promise<T>;
  
  // 链式配置
  withRetry(maxRetries: number): ToolExecutor;
  withRetryDelay(retryDelay: number): ToolExecutor;
  withContinueOnError(continueOnError: boolean): ToolExecutor;
}
```

### 辅助函数

#### withMetadata

为工具添加元数据：

```typescript
import { tool, withMetadata } from '@monkey-agent/tools';

const searchTool = withMetadata(
  tool({
    description: 'Search files',
    parameters: z.object({ query: z.string() }),
    execute: async ({ query }) => ({ results: [] }),
  }),
  {
    category: 'file',
    tags: ['search', 'read'],
    version: '1.0.0',
  }
);
```

#### createToolSet

创建类型安全的工具集：

```typescript
import { createToolSet, tool } from '@monkey-agent/tools';

const tools = createToolSet({
  search: tool({ ... }),
  analyze: tool({ ... }),
});
```

## 与旧版本的区别

### 旧版本（使用 ToolBuilder）

```typescript
import { ToolBuilder, ToolManager } from '@monkey-agent/base';

class MyAgent extends BaseAgent {
  private toolManager = new ToolManager();
  
  constructor(config) {
    super(config);
    
    this.toolManager.register(
      new ToolBuilder()
        .name('search')
        .description('Search files')
        .schema(z.object({ query: z.string() }))
        .execute(async ({ query }) => { ... })
        .build()
    );
  }
  
  protected getToolDefinitions() {
    return this.toolManager.getDefinitions();
  }
  
  protected async executeToolCall(toolName, input) {
    return this.toolManager.execute(toolName, input);
  }
}
```

### 新版本（直接使用 tool）

```typescript
import { BaseAgent } from '@monkey-agent/base';
import { tool } from '@monkey-agent/tools';
import { z } from 'zod';

class MyAgent extends BaseAgent {
  protected getToolDefinitions() {
    return {
      search: tool({
        description: 'Search files',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => {
          // 实现逻辑
          return { results: [] };
        },
      }),
    };
  }
}
```

**改进**：
- ✅ 代码减少 ~50%
- ✅ 更少的抽象层
- ✅ 直接使用 AI SDK API
- ✅ 更好的类型推导

## 迁移指南

### 步骤 1：更新导入

**之前：**
```typescript
import { ToolBuilder, ToolManager } from '@monkey-agent/base';
```

**之后：**
```typescript
import { tool } from '@monkey-agent/tools';
// 或
import { tool } from 'ai';
```

### 步骤 2：简化工具定义

将工具定义从 ToolBuilder 迁移到直接使用 `tool()`：

**之前：**
```typescript
new ToolBuilder()
  .name('search')
  .description('Search files')
  .schema(z.object({ query: z.string() }))
  .execute(async ({ query }) => { ... })
  .build()
```

**之后：**
```typescript
tool({
  description: 'Search files',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => { ... },
})
```

### 步骤 3：移除 ToolManager

**之前：**
```typescript
class MyAgent extends BaseAgent {
  private toolManager = new ToolManager();
  
  constructor(config) {
    super(config);
    this.toolManager.register(...);
  }
  
  protected getToolDefinitions() {
    return this.toolManager.getDefinitions();
  }
  
  protected async executeToolCall(toolName, input) {
    return this.toolManager.execute(toolName, input);
  }
}
```

**之后：**
```typescript
class MyAgent extends BaseAgent {
  protected getToolDefinitions() {
    return {
      search: tool({ ... }),
      analyze: tool({ ... }),
    };
  }
}
```

### 步骤 4：更新 package.json

```json
{
  "dependencies": {
    "@monkey-agent/tools": "workspace:*",
    "ai": "^5.0.0",
    "zod": "^3.22.4"
  }
}
```

## 许可证

MIT

