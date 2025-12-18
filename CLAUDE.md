# Monkey Agent - Chrome 插件 Agent 系统

> 一个跨环境的智能 Agent 框架，支持浏览器插件和本地系统操作的无缝集成

## 📋 目录

- [1. 项目概述](#1-项目概述)
- [2. 系统架构](#2-系统架构)
- [3. 智能体系统](#3-智能体系统)
- [4. 核心技术模块](#4-核心技术模块)
- [5. Chrome 插件](#5-chrome-插件)
- [6. Computer Use Agent 系统](#6-computer-use-agent-系统)
- [7. 开发指南](#7-开发指南)
- [附录：项目信息](#附录项目信息)

---

## 1. 项目概述

### 1.1 核心定位

Monkey Agent 是一个基于 TypeScript 实现的智能 Agent 系统，专注于：

- **跨环境兼容**：统一的 API 同时支持 Node.js 和浏览器环境
- **Chrome 插件集成**：深度集成浏览器能力，增强用户体验
- **多智能体协作**：专业化智能体协同完成复杂任务
- **系统级扩展**：通过 Computer Use Agent 突破浏览器限制，访问本地系统能力

### 1.2 核心能力

```
🌐 浏览器操作    → DOM 操作、页面自动化、数据采集
🖥️ 系统控制      → 文件管理、Shell 命令、鼠标键盘控制
💻 代码执行      → 多语言支持、沙箱隔离、依赖管理
🎨 图像处理      → AI 生成、编辑、分析
🧠 智能决策      → LLM 驱动、记忆系统、经验学习
```

### 1.3 应用场景

| 场景 | 描述 | 涉及智能体 |
|------|------|-----------|
| 网页自动化 | 表单填写、数据采集、自动化测试 | Browser, Crawler |
| 数据处理 | 跨页面数据收集、分析、导出 | Browser, Crawler, Code, File |
| 内容创作 | 自动生成文章配图、代码文档 | Image, File, Code |
| 系统任务 | 文件整理、日志分析、环境配置 | File, Shell, Computer |

---

## 2. 系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Agent 层 (Browser/Crawler/Orchestrator)         │  │
│  │  • 直接执行：DOM 操作、网页爬取、任务调度       │  │
│  └──────────────┬───────────────────────────────────┘  │
│                 │ 需要系统能力时                        │
└─────────────────┼───────────────────────────────────────┘
                  │
                  │ WebSocket/HTTP
                  ↓
┌─────────────────────────────────────────────────────────┐
│                 Computer Use Agent Server                │
│  处理浏览器无法完成的系统级操作：                       │
│  • 文件系统操作 (读写、搜索、监控)                      │
│  • Shell 命令执行、进程管理                             │
│  • 鼠标键盘控制、屏幕截图                               │
│  • 严格的权限控制和安全审计                             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     外部服务集成                         │
│  • LLM 服务 (OpenAI, Anthropic, Local)                  │
│  • 代码执行 (E2B 沙箱)                                   │
│  • 图像处理 (Replicate, Banana)                         │
│  • 向量存储 (Milvus, pgvector, Qdrant)                  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Agent 执行流程

```
用户请求
  ↓
Goal 分析 → Planning → Memory 检索
  ↓
Task 分解 → Agent 选择 → Execution
  ↓
Reflection → Memory 更新
  ↓
返回结果
```

### 2.3 数据流

```
用户 ↔ Chrome UI (Popup/Sidepanel)
       ↓
    Service Worker (Agent 管理器)
       ↓
    Content Script (页面注入)
       ↓
    Agent 执行层
       ↓
    ├─→ 本地操作 (Computer Use Agent)
    ├─→ LLM 调用
    ├─→ 向量检索 (Memory)
    └─→ 外部 API
```

---

## 3. 智能体系统

### 3.1 智能体能力分布

| 类别 | Agent | 执行环境 | 核心能力 |
|------|-------|---------|---------|
| **浏览器** | Browser Agent | Chrome 插件 | DOM 操作、页面导航、表单处理 |
| | Crawler Agent | Chrome 插件 | 数据采集、列表爬取、分页处理 |
| **系统** | Computer Agent | Computer Use Agent | 鼠标键盘、截图、窗口管理 |
| | Shell Agent | Computer Use Agent | 命令执行、进程管理、系统信息 |
| | File Agent | Computer Use Agent | 文件读写、搜索、监控 |
| **计算** | Code Agent | 本地/E2B | 代码执行、分析、测试 |
| | Image Agent | API | 图像生成、编辑、分析 |
| **协调** | Orchestrator | Chrome 插件 | 任务调度、Agent 协作 |

### 3.2 核心 Agent 接口

```typescript
// 基础 Agent 接口
interface IAgent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  
  execute(task: Task): Promise<TaskResult>;
  plan(goal: Goal): Promise<Plan>;
  reflect(result: TaskResult): Promise<Reflection>;
}

// 任务定义
interface Task {
  id: string;
  type: string;
  description: string;
  parameters: Record<string, any>;
  context?: Context;
}

// 执行结果
interface TaskResult {
  success: boolean;
  data?: any;
  error?: Error;
  metadata?: Record<string, any>;
}
```

### 3.3 浏览器智能体

#### Browser Agent
专注于页面级操作和自动化。

**核心方法：**
```typescript
interface BrowserAgent {
  // 导航
  navigate(url: string): Promise<void>;
  back(): Promise<void>;
  forward(): Promise<void>;
  
  // 元素操作
  click(selector: string): Promise<void>;
  type(selector: string, text: string): Promise<void>;
  
  // 内容提取
  getContent(): Promise<string>;
  screenshot(): Promise<Buffer>;
}
```

#### Crawler Agent
专注于结构化数据采集。

**核心方法：**
```typescript
interface CrawlerAgent {
  // 数据提取
  extract(url: string, schema: Schema): Promise<any>;
  
  // 列表处理
  crawlList(config: {
    url: string;
    itemSelector: string;
    maxItems?: number;
  }): Promise<any[]>;
  
  // 分页处理
  followPagination(startUrl: string, maxPages?: number): Promise<any[]>;
}
```

### 3.4 系统智能体（Go CLI 集成）

系统智能体通过 CLI Bridge 与 Go CLI 通信：

```typescript
// CLI Bridge 客户端
class CLIBridge {
  async request(operation: {
    operation: string;  // 'file' | 'shell' | 'computer'
    action: string;     // 具体操作
    parameters: any;
  }): Promise<any>;
}

// File Agent 示例
class FileAgent {
  async read(path: string): Promise<string> {
    return await cliBridge.request({
      operation: 'file',
      action: 'read',
      parameters: { path }
    });
  }
}
```

**支持的操作类型：**

| Agent | 主要操作 |
|-------|---------|
| File Agent | read, write, delete, search, watch |
| Shell Agent | exec, spawn, kill, getEnv |
| Computer Agent | click, type, screenshot, focusWindow |

### 3.5 多智能体协作

#### 协作模式

```typescript
class AgentOrchestrator {
  // 任务分解
  decomposeTask(task: ComplexTask): SubTask[];
  
  // Agent 选择
  selectAgent(subTask: SubTask): Agent;
  
  // 执行策略
  async executeSequential(tasks: SubTask[]): Promise<Result[]>;
  async executeParallel(tasks: SubTask[]): Promise<Result[]>;
  async executeHierarchical(tasks: SubTask[]): Promise<Result[]>;
}
```

#### 协作示例：智能数据采集

```typescript
// 1. Browser Agent 导航
await browserAgent.navigate('https://example.com/data');

// 2. Crawler Agent 提取数据
const data = await crawlerAgent.extract(pageUrl, schema);

// 3. File Agent 保存结果 (通过 Computer Use Agent)
await fileAgent.write('./data/result.json', JSON.stringify(data));

// 4. Code Agent 处理数据
const processed = await codeAgent.execute(`
  const data = require('./data/result.json');
  return processData(data);
`);
```

---

## 4. 核心技术模块

### 4.1 跨环境运行时

**Runtime Adapter** 统一 Node.js 和浏览器环境：

```typescript
class RuntimeAdapter {
  static async getStorage(): Promise<IStorage> {
    return this.isNode() 
      ? new NodeFSStorage() 
      : new BrowserStorage();
  }
  
  static async getEventEmitter(): Promise<IEventEmitter> {
    return this.isNode() 
      ? new NodeEventEmitter() 
      : new BrowserEventEmitter();
  }
}
```

### 4.2 LLM 集成层

统一的 LLM 提供商接口：

```typescript
interface LLMProvider {
  chat(messages: Message[]): Promise<string>;
  stream(messages: Message[]): AsyncIterator<string>;
  embeddings(text: string): Promise<number[]>;
}

// 支持的提供商
const providers = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  local: new LocalLLMProvider()
};
```

### 4.3 记忆系统

#### 多层次记忆架构

```typescript
interface MemorySystem {
  shortTerm: ShortTermMemory;    // 会话级别
  longTerm: LongTermMemory;      // 持久化
  working: WorkingMemory;        // 当前任务上下文
  semantic: SemanticMemory;      // 知识库
}
```

#### 向量存储

**统一接口：**
```typescript
interface VectorStorage {
  insert(item: { id: string; vector: Float32Array; metadata?: any }): Promise<void>;
  search(query: { vector: Float32Array; limit?: number }): Promise<SearchResult[]>;
  delete(id: string): Promise<void>;
}
```

**配置示例：**

```typescript
// 浏览器环境：sqlite-vec (WASM)
const storage = await createVectorStorage({
  type: 'sqlite-vec',
  path: '/agent-memory.db'  // 使用 OPFS
});

// 远程 Milvus
const storage = await createVectorStorage({
  type: 'milvus',
  config: {
    address: 'https://milvus.example.com',
    collection: 'agent_memory',
    dimension: 1536
  }
});
```

**存储选择指南：**

| 场景 | 推荐方案 |
|------|---------|
| 浏览器轻量级 | sqlite-vec (WASM) |
| 浏览器企业级 | 远程 Milvus/Qdrant |
| Node.js 单机 | sqlite-vec (本地文件) |
| Node.js 分布式 | Milvus/pgvector |

> 详细配置请参考 [向量存储配置指南](docs/vector-storage-guide.md)

### 4.4 经验系统

```typescript
interface ExperienceSystem {
  // 记录经验
  record(action: Action, result: Result, context: Context): void;
  
  // 检索相似经验
  retrieve(context: Context): Experience[];
  
  // 应用经验
  apply(experience: Experience, task: Task): Task;
}
```

### 4.5 MCP 集成

将 Model Context Protocol 服务器转换为 Agent 能力：

```typescript
class MCPAdapter {
  convertTools(mcpTools: MCPTool[]): AgentCapability[];
  convertResources(mcpResources: MCPResource[]): Knowledge[];
}
```

---

## 5. Chrome 插件

### 5.1 插件架构

```
chrome-extension/
├── manifest.json           # Manifest V3 配置
├── background/             # Service Worker
│   └── service-worker.ts   # Agent 管理器、CLI 客户端
├── content/                # Content Scripts
│   └── content-script.ts   # 页面注入、DOM 分析
├── popup/                  # 弹出窗口 UI
├── sidepanel/              # 侧边栏 UI
└── options/                # 设置页面
```

### 5.2 核心功能

| 功能 | 描述 | 实现位置 |
|------|------|---------|
| 页面分析 | 理解页面结构和内容 | Content Script |
| 自动化操作 | 模拟用户交互 | Content Script |
| 数据提取 | 结构化数据采集 | Content Script + Background |
| 对话界面 | 自然语言交互 | Sidepanel |
| 任务执行 | 多步骤任务协调 | Background Service Worker |

### 5.3 权限配置

```json
{
  "permissions": [
    "activeTab",
    "storage",
    "scripting",
    "webNavigation"
  ],
  "host_permissions": [
    "http://*/*",
    "https://*/*"
  ]
}
```

### 5.4 使用场景

**场景 1：智能表单填写**
```typescript
// 用户指令："帮我填写这个注册表单"
const formAgent = new FormFiller();
await formAgent.analyzeForm();
await formAgent.fillWithUserProfile();
await formAgent.submit();
```

**场景 2：跨页面数据收集**
```typescript
// 用户指令："收集这个分类下的所有产品"
const crawler = new CrawlerAgent();
const products = await crawler.crawlList({
  url: currentUrl,
  itemSelector: '.product-item',
  followPagination: true
});
```

---

## 6. Go CLI 系统

### 6.1 设计理念

Go CLI 是一个**纯粹的操作执行器**，不包含 Agent 逻辑，只负责：
- ✅ 接收指令
- ✅ 执行系统操作
- ✅ 返回结果
- ✅ 安全审计

### 6.2 核心架构

```go
// 操作请求
type OperationRequest struct {
    Operation  string                 `json:"operation"`   // file/shell/computer
    Action     string                 `json:"action"`      // read/exec/click
    Parameters map[string]interface{} `json:"parameters"`
    RequestID  string                 `json:"request_id"`
}

// 操作响应
type OperationResponse struct {
    RequestID string      `json:"request_id"`
    Success   bool        `json:"success"`
    Data      interface{} `json:"data"`
    Error     string      `json:"error,omitempty"`
}
```

### 6.3 支持的操作

| 操作类型 | 主要功能 | 关键库 |
|---------|---------|--------|
| **文件操作** | 读写、搜索、监控、压缩 | os, fsnotify |
| **Shell 执行** | 命令执行、进程管理、环境变量 | os/exec, go-ps |
| **计算机控制** | 鼠标键盘、截图、窗口管理 | robotgo, screenshot |

### 6.4 安全机制

```go
type SecurityConfig struct {
    // 操作白名单
    AllowedOperations []string
    
    // 路径沙箱
    AllowedPaths []string
    DeniedPaths  []string
    
    // 命令白名单
    AllowedCommands []string
    
    // 超时保护
    CommandTimeout  time.Duration
    
    // 用户确认
    RequireConfirmation map[string]bool
}
```

**安全特性：**
- 🔐 基于白名单的权限控制
- 🛡️ 路径沙箱限制文件访问
- 📝 完整的操作审计日志
- 🚫 危险命令自动拦截
- ⏱️ 操作超时保护
- 👤 敏感操作需用户确认

### 6.5 通信协议

```
Chrome 插件                    Computer Use Agent
    │                            │
    │  WebSocket 连接建立        │
    ├────────────────────────────>│
    │                            │
    │  发送操作请求              │
    │  {operation, action, ...}  │
    ├────────────────────────────>│
    │                            │
    │         权限检查 + 执行     │
    │                            │
    │  返回结果                  │
    │<────────────────────────────┤
    │                            │
```

**错误码：**
```go
const (
    ErrPermissionDenied  = "PERMISSION_DENIED"
    ErrInvalidOperation  = "INVALID_OPERATION"
    ErrTimeout           = "TIMEOUT"
    ErrPathNotAllowed    = "PATH_NOT_ALLOWED"
    ErrCommandBlocked    = "COMMAND_BLOCKED"
)
```

---

## 7. 开发指南

### 7.1 环境准备

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm --filter @monkey-agent/core dev
pnpm --filter chrome-extension dev

# 构建
pnpm build

# 测试
pnpm test
```

### 7.2 项目结构

```
monkey-agent/
├── packages/
│   ├── core/              # Agent 框架核心
│   ├── agents/            # Agent 实现
│   ├── orchestrator/      # 多智能体调度
│   ├── memory/            # 记忆系统
│   ├── experience/        # 经验系统
│   └── mcp/               # MCP 集成
├── computer-use-agent/    # Computer Use Agent 服务器
├── chrome-extension/      # Chrome 插件
├── examples/              # 示例代码
└── docs/                  # 文档
```

> 完整项目结构请参考 [详细目录结构](docs/project-structure.md)

### 7.3 快速开始

#### 创建自定义 Agent

```typescript
import { BaseAgent } from '@monkey-agent/core';

class MyAgent extends BaseAgent {
  async execute(task: Task): Promise<TaskResult> {
    // 实现你的逻辑
    return {
      success: true,
      data: { /* 结果数据 */ }
    };
  }
}
```

#### 配置向量存储

```typescript
import { createVectorStorage } from '@monkey-agent/memory';

const storage = await createVectorStorage({
  type: 'sqlite-vec',
  path: '/agent-memory.db'
});
```

#### Agent 协作示例

```typescript
// 智能网页摘要
const browserAgent = new BrowserAgent();
await browserAgent.navigate(url);
const content = await browserAgent.getContent();

const summaryAgent = new SummaryAgent();
const summary = await summaryAgent.summarize(content);

const fileAgent = new FileAgent();
await fileAgent.write('./summary.md', summary);
```

> 更多示例请参考 [Agent 协作示例](docs/agent-examples.md)

### 7.4 技术栈

#### 核心技术
- **TypeScript** - Agent 框架和插件
- **Go** - Computer Use Agent 系统操作执行器
- **Vite** + **pnpm** - 构建工具链

#### Web 技术
- **React** + **TailwindCSS** - UI 框架
- **OPFS (Origin Private File System)** - 浏览器持久化存储
- **WebSocket** - 实时通信

#### AI/ML
- **LangChain.js** - LLM 应用框架
- **sqlite-vec** - 向量存储（本地）
- **Milvus/pgvector** - 向量存储（远程）

#### Go 生态
- **Fiber/Gin** - Web 框架
- **robotgo** - 计算机控制
- **fsnotify** - 文件监控

### 7.5 开发路线图

| 阶段 | 时间 | 主要任务 |
|------|------|---------|
| Phase 1 | 2-3周 | 基础框架、跨环境适配、LLM 集成 |
| Phase 2 | 3-4周 | 多智能体调度、记忆系统、向量存储 |
| Phase 3 | 2-3周 | Chrome 插件、UI 界面、页面操作 |
| Phase 4 | 2-3周 | 性能优化、安全加固、文档完善 |

### 7.6 安全性考虑

- ✅ 权限最小化原则
- ✅ 本地数据存储，不上传服务器
- ✅ API Key 加密存储
- ✅ 严格的 CSP 配置
- ✅ 输入验证防注入
- ✅ 代码沙箱隔离执行

### 7.7 性能优化

- ⚡ 懒加载 Agent 和工具
- ⚡ LLM 响应缓存
- ⚡ Web Workers 处理计算密集任务
- ⚡ 流式输出 LLM 响应
- ⚡ 向量检索索引优化
- ⚡ API 请求批处理

---

## 附录：项目信息

### 许可证

MIT License

### 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 联系方式

- 项目地址：https://github.com/yourusername/monkey-agent
- Issue 追踪：https://github.com/yourusername/monkey-agent/issues

### 补充文档

- [详细项目结构](docs/project-structure.md) - 完整的目录树和文件说明
- [Agent 协作示例](docs/agent-examples.md) - 更多实际应用场景
- [向量存储配置指南](docs/vector-storage-guide.md) - 各种向量数据库的详细配置

---

**注意**：本项目仍在积极开发中，API 可能会有变动。建议在生产环境使用前等待稳定版本发布。
