# Code Agent - E2B Sandbox 集成

Code Agent 是一个 **LLM 驱动的智能代码执行 Agent**，支持通过 E2B Sandbox 安全执行代码，提供多语言代码执行、依赖管理、文件操作和 Shell 命令执行能力。

## 工作原理

Code Agent 继承自 `BaseAgent`，采用 **ReAct (Reasoning + Acting)** 模式工作：

1. **接收任务**：通过 `execute(task: Task)` 方法接收任务
   - `task.description`：任务的自然语言描述
   - `task.parameters`：提供给 LLM 的上下文信息（非直接参数）

2. **LLM 推理**：LLM 分析任务描述和参数，决定调用哪些工具

3. **工具执行**：自动调用相应的工具（如 `executeCode`、`installDependency` 等）

4. **返回结果**：将执行结果返回给用户

**重要提示：** `task.parameters` 中的内容是提供给 LLM 的**上下文信息**，而不是直接传递给工具函数的参数。LLM 会根据描述和上下文自动决定如何调用工具。

## 快速开始

### 安装依赖

```bash
yarn add @monkey-agent/agents @e2b/code-interpreter
```

### 基础使用

```typescript
import { CodeAgent } from '@monkey-agent/agents';

const codeAgent = new CodeAgent({
  llmConfig: {
    provider: 'openai',
    apiKey: 'sk-...',
    model: 'gpt-4',
  },
  executionEnvironment: 'e2b',
  e2bApiKey: process.env.E2B_API_KEY, // 或直接传入 'e2b-...'
  e2bTemplateId: 'base', // 可选，默认为 'base'
});

// 执行 Python 代码（方式一：通过自然语言描述）
const result = await codeAgent.execute({
  id: 'task-1',
  type: 'code-execution',
  description: '使用 Python pandas 创建一个包含姓名和年龄的数据框，并输出统计信息',
  parameters: {}, // Agent 会通过 LLM 自动生成代码并执行
});

// 执行 Python 代码（方式二：提供代码作为上下文）
const result2 = await codeAgent.execute({
  id: 'task-2',
  type: 'code-execution',
  description: '执行以下 Python 代码并返回结果',
  parameters: {
    code: `
import pandas as pd
data = {'name': ['Alice', 'Bob'], 'age': [25, 30]}
df = pd.DataFrame(data)
print(df.describe())
    `,
  },
});

console.log(result); // { success: true, data: { ... } }

// 清理 Sandbox（重要！）
await codeAgent.cleanup();
```

## 配置选项

### CodeAgentConfig

```typescript
interface CodeAgentConfig extends Partial<BaseAgentConfig> {
  /** 代码执行环境类型 */
  executionEnvironment?: 'local' | 'e2b' | 'docker';
  
  /** E2B API Key */
  e2bApiKey?: string;
  
  /** E2B Template ID（默认：'base'） */
  e2bTemplateId?: string;
  
  /** 允许执行的语言 */
  allowedLanguages?: string[];
  
  /** 执行超时时间（毫秒，默认：30000） */
  executionTimeout?: number;
  
  /** 自定义 Sandbox 客户端 */
  sandboxClient?: BaseSandboxClient;
}
```

### 环境变量

```bash
# E2B API Key
E2B_API_KEY=your-e2b-api-key

# OpenAI API Key（用于 LLM）
OPENAI_API_KEY=your-openai-api-key
```

## 核心功能

Code Agent 是一个 **LLM 驱动的 ReAct Agent**，通过自然语言理解任务需求，自动选择合适的工具来完成任务。

**工作原理：**
1. 接收任务描述（`description`）和参数（`parameters`）
2. LLM 分析任务，决定调用哪些工具
3. 执行工具并获取结果
4. 将结果返回给用户

**注意：** `parameters` 中的内容是提供给 LLM 的上下文信息，而不是直接传递给工具的参数。LLM 会根据描述和参数自动调用相应的工具。

### 支持的工具

| 工具名称 | 描述 | 执行环境 |
|---------|------|---------|
| `executeCode` | 执行代码（Python, JS, etc.） | E2B Sandbox |
| `installDependency` | 安装包依赖 | E2B Sandbox/TODO |
| `runShellCommand` | 执行 Shell 命令 | E2B Sandbox |
| `readFile` | 读取文件 | E2B Sandbox |
| `writeFile` | 写入文件 | E2B Sandbox |

### 使用示例

#### 1. 代码执行

```typescript
// 方式一：纯自然语言描述（LLM 自动生成代码）
const result = await agent.execute({
  id: 'task-1',
  type: 'code-execution',
  description: '使用 Python 计算斐波那契数列的前 10 项',
  parameters: {}, // LLM 会自动生成代码
});

// 方式二：提供代码让 Agent 执行
const result2 = await agent.execute({
  id: 'task-1b',
  type: 'code-execution',
  description: '执行提供的 Python 代码',
  parameters: {
    code: `
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        print(a, end=' ')
        a, b = b, a + b

fibonacci(10)
    `,
  },
});
```

#### 2. 依赖安装

```typescript
const result = await agent.execute({
  id: 'task-2',
  type: 'dependency-installation',
  description: '安装 pandas 库',
  parameters: {
    language: 'python',
    packageName: 'pandas',
    version: '2.0.0', // 可选
  },
});
// LLM 会调用 installDependency 工具
```

#### 3. 文件操作

```typescript
// 写入文件
const writeResult = await agent.execute({
  id: 'task-3',
  type: 'file-write',
  description: '创建一个包含 JSON 数据的文件',
  parameters: {
    path: '/home/user/data.json',
    content: JSON.stringify({ message: 'Hello' }),
  },
});

// 读取文件
const readResult = await agent.execute({
  id: 'task-4',
  type: 'file-read',
  description: '读取刚才创建的文件',
  parameters: {
    path: '/home/user/data.json',
  },
});
```

#### 4. Shell 命令

```typescript
const result = await agent.execute({
  id: 'task-5',
  type: 'shell-command',
  description: '查看当前目录内容',
  parameters: {
    command: 'ls',
    args: ['-la'],
  },
});
```

## Sandbox 生命周期管理

### 自动创建（懒加载）

Sandbox 在首次执行代码时自动创建，无需手动初始化：

```typescript
const agent = new CodeAgent({
  executionEnvironment: 'e2b',
  e2bApiKey: 'your-key',
});

// 首次执行时会自动创建 Sandbox
await agent.execute({ /* task */ });

// 后续执行复用同一个 Sandbox
await agent.execute({ /* another task */ });
```

### 手动清理

**重要**：任务完成后应该清理 Sandbox 以释放资源：

```typescript
try {
  await agent.execute({ /* task */ });
} finally {
  await agent.cleanup(); // 关闭并销毁 Sandbox
}
```

### 自定义 Sandbox 客户端

可以预先创建 Sandbox 客户端，实现更精细的控制：

```typescript
import { E2BSandboxClient } from '@monkey-agent/agents';

// 创建自定义客户端
const sandboxClient = new E2BSandboxClient('your-api-key');
await sandboxClient.create('custom-template-id', 'user-123', 'task-456');

// 使用自定义客户端
const agent = new CodeAgent({
  executionEnvironment: 'e2b',
  sandboxClient,
});

// 使用完毕后清理
await sandboxClient.close();
```

## E2B Sandbox 客户端

### 直接使用 E2BSandboxClient

如果只需要代码执行功能而不需要 LLM，可以直接使用 `E2BSandboxClient`：

```typescript
import { E2BSandboxClient } from '@monkey-agent/agents';

const client = new E2BSandboxClient(process.env.E2B_API_KEY);

// 创建 Sandbox
await client.create('base');

// 执行代码
const result = await client.runCode('print("Hello")', 'python');
console.log(result.stdout); // "Hello"

// 执行命令
const cmdResult = await client.runCommand('echo "test"');
console.log(cmdResult.stdout); // "test"

// 清理
await client.close();
```

### 流式输出

支持流式获取代码执行结果：

```typescript
// 流式代码执行
const stream = await client.runCode(`
for i in range(5):
    print(f"Line {i}")
`, 'python', true); // 第三个参数 stream=true

for await (const chunk of stream) {
  console.log(`[${chunk.type}] ${chunk.content}`);
  // [stdout] Line 0
  // [stdout] Line 1
  // ...
}
```

### Sandbox 管理

```typescript
// 列出所有 Sandbox
const sandboxes = await client.list();

// 按元数据过滤
const userSandboxes = await client.list('user-123');

// 连接到现有 Sandbox
await client.connect('sandbox-id-xxx');

// 关闭 Sandbox
await client.close();
```

### 文件操作

```typescript
// 上传文件
await client.uploadFile('./local-file.txt', '/home/user/remote-file.txt');

// 下载文件
const content = await client.downloadFile('/home/user/remote-file.txt');
const text = new TextDecoder().decode(content);
console.log(text);
```

## BaseSandboxClient 接口

如需实现自定义 Sandbox 客户端（如 Docker），可以继承 `BaseSandboxClient`：

```typescript
import { BaseSandboxClient } from '@monkey-agent/agents';

class DockerSandboxClient extends BaseSandboxClient {
  async create(template_id: string, ...): Promise<void> {
    // 实现 Docker 容器创建逻辑
  }

  async runCode(code: string, language?: string, ...): Promise<...> {
    // 实现代码执行逻辑
  }

  // 实现其他抽象方法...
}
```

**必须实现的方法**：

- `create()` - 创建 Sandbox
- `connect()` - 连接到现有 Sandbox
- `close()` - 关闭 Sandbox
- `uploadFile()` - 上传文件
- `downloadFile()` - 下载文件
- `list()` - 列出 Sandbox
- `runCommand()` - 执行命令
- `runCode()` - 执行代码

## 最佳实践

### 1. 资源清理

始终在 `finally` 块中清理 Sandbox：

```typescript
const agent = new CodeAgent({ executionEnvironment: 'e2b', e2bApiKey: 'xxx' });

try {
  await agent.execute({ /* task */ });
} finally {
  await agent.cleanup(); // 确保资源被释放
}
```

### 2. 错误处理

```typescript
const result = await agent.execute({
  id: 'task-1',
  type: 'code-execution',
  parameters: { language: 'python', code: 'print("test")' },
});

if (!result.success) {
  console.error('执行失败:', result.error);
} else {
  console.log('执行成功:', result.data);
}
```

### 3. 超时设置

```typescript
const agent = new CodeAgent({
  executionEnvironment: 'e2b',
  e2bApiKey: 'xxx',
  executionTimeout: 300000, // 5 分钟（对于长时间运行的任务）
});
```

### 4. 自定义模板

使用包含特定依赖的自定义 E2B 模板：

```typescript
const agent = new CodeAgent({
  executionEnvironment: 'e2b',
  e2bApiKey: 'xxx',
  e2bTemplateId: 'my-ml-template', // 包含 ML 库的自定义模板
});
```

## 支持的语言

默认支持以下编程语言：

- JavaScript
- TypeScript
- Python
- Bash / Shell
- Ruby
- Go
- Rust

可通过 `allowedLanguages` 配置自定义：

```typescript
const agent = new CodeAgent({
  allowedLanguages: ['python', 'javascript'], // 只允许 Python 和 JavaScript
});
```

## 常见问题

### Q: 如何获取 E2B API Key？

访问 [E2B Dashboard](https://e2b.dev/dashboard) 创建账号并获取 API Key。

### Q: Sandbox 何时被创建和销毁？

Sandbox 在首次执行代码时自动创建（懒加载），并在调用 `agent.cleanup()` 时销毁。

### Q: 如何处理大文件？

E2B Sandbox 支持文件上传和下载。对于大文件，建议使用流式处理或分块操作。

### Q: 是否支持持久化存储？

E2B Sandbox 默认是临时的。如需持久化，可以在任务完成后下载结果文件到本地或云存储。

### Q: 如何调试代码执行？

可以启用流式输出来实时查看代码执行过程：

```typescript
const client = new E2BSandboxClient('xxx');
const stream = await client.runCode(code, 'python', true);
for await (const chunk of stream) {
  console.log(chunk); // 实时输出
}
```

## 测试

Code Agent 和 E2B Sandbox 客户端拥有完整的测试套件：

### 快速开始测试

```bash
# 设置 E2B API Key
export E2B_API_KEY=your-api-key

# 运行集成测试
yarn test:integration

# 运行性能测试
yarn test:performance

# 运行使用示例
yarn example:e2b
```

### 测试文档

- 📖 [快速入门指南](./sandbox/__tests__/QUICKSTART.md) - 5 分钟快速上手测试
- 📊 [测试覆盖报告](./sandbox/__tests__/TEST_COVERAGE.md) - 详细的测试覆盖信息
- 📚 [完整测试文档](./sandbox/__tests__/README.md) - 详细的测试说明和指南
- 🎉 [测试总结](./sandbox/__tests__/SUMMARY.md) - 测试套件完成总结

### 测试统计

- ✅ **60+** 个集成测试
- ✅ **16** 个性能测试
- ✅ **100%** API 覆盖率
- ✅ **2,675+** 行测试代码
- ✅ 完整的文档和示例

## 参考资料

- [E2B 官方文档](https://e2b.dev/docs)
- [E2B SDK 参考](https://e2b.dev/docs/sdk-reference/code-interpreter-js-sdk/v2.3.3/sandbox)
- [Monkey Agent 主文档](../../../../CLAUDE.md)
- [测试文档](./sandbox/__tests__/README.md) - E2B Sandbox 测试套件

## 许可证

MIT License
