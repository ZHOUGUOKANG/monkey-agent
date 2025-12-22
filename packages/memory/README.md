# @monkey-agent/memory

Monkey Agent 的记忆系统，提供多层次的记忆管理和向量搜索能力。

## 特性

- 🧠 **多层次记忆架构**：短期记忆、长期记忆、工作记忆、语义记忆
- 🔍 **向量搜索**：基于余弦相似度的语义搜索
- 💾 **多种存储后端**：SQLite-vec（内存版）、Milvus、pgvector
- 🎯 **智能重要性判断**：自动将重要记忆转存到长期记忆
- 📊 **统计信息**：实时查看各类记忆的数量

## 安装

```bash
yarn add @monkey-agent/memory
```

## 快速开始

### 基础使用

```typescript
import { MemorySystem } from '@monkey-agent/memory';

// 创建记忆系统
const memory = new MemorySystem();

// 记录新记忆
await memory.remember({
  id: '1',
  type: 'short-term',
  content: 'Hello, world!',
  createdAt: new Date(),
});

// 获取记忆
const retrieved = await memory.get('1');
console.log(retrieved?.content); // 'Hello, world!'

// 获取统计信息
const stats = memory.getStats();
console.log(stats); // { shortTerm: 1, longTerm: 0, working: 0, semantic: 0 }
```

### 使用向量存储

```typescript
import { MemorySystem, SqliteVecStorage } from '@monkey-agent/memory';

// 创建向量存储
const vectorStorage = new SqliteVecStorage(':memory:');
await vectorStorage.init();

// 创建带向量搜索的记忆系统
const memory = new MemorySystem({
  shortTermMaxSize: 100,
  longTermVectorStorage: vectorStorage,
  importanceThreshold: 3,
});

// 添加带 embedding 的记忆
await memory.remember({
  id: '1',
  type: 'long-term',
  content: 'apple is a fruit',
  embedding: new Float32Array([0.9, 0.1, 0.1]),
  createdAt: new Date(),
  accessCount: 5, // 超过阈值，会自动存入长期记忆
});

// 使用向量搜索
const results = await memory.recall(
  new Float32Array([0.95, 0.05, 0.05]), // 查询向量
  10, // 返回数量
  0.7 // 相似度阈值
);

console.log(results[0].content); // 'apple is a fruit'
```

### 工作记忆

```typescript
// 存储当前任务上下文
memory.working.set('currentTask', 'analyzing data');
memory.working.set('userId', 'user-123');

// 读取上下文
console.log(memory.working.get('currentTask')); // 'analyzing data'

// 获取所有上下文
const context = memory.working.getAll();
console.log(context); // { currentTask: 'analyzing data', userId: 'user-123' }

// 清空上下文
memory.working.clear();
```

### 语义记忆

```typescript
import { SemanticMemory, SqliteVecStorage } from '@monkey-agent/memory';

const vectorStorage = new SqliteVecStorage(':memory:');
await vectorStorage.init();

const semantic = new SemanticMemory(vectorStorage);

// 存储知识
await semantic.store(
  'ai-concept',
  { 
    name: 'Artificial Intelligence',
    description: '...',
  },
  new Float32Array([0.8, 0.2, 0.1]) // embedding
);

// 搜索知识
const results = await semantic.search(
  new Float32Array([0.85, 0.15, 0.1]),
  5
);

console.log(results[0]); 
// { key: 'ai-concept', value: { name: 'Artificial Intelligence', ... }, score: 0.95 }
```

## 向量存储

### SQLite-vec（内存版本）

适合开发和测试：

```typescript
import { SqliteVecStorage } from '@monkey-agent/memory';

const storage = new SqliteVecStorage(':memory:');
await storage.init();

// 插入向量
await storage.insert({
  id: '1',
  vector: new Float32Array([0.1, 0.2, 0.3]),
  metadata: { text: 'hello' },
});

// 搜索向量
const results = await storage.search({
  vector: new Float32Array([0.15, 0.25, 0.35]),
  limit: 10,
  threshold: 0.7,
});
```

### Milvus（Mock 实现）

生产环境建议使用真实的 Milvus：

```typescript
import { MilvusStorage } from '@monkey-agent/memory';

const storage = new MilvusStorage({
  address: 'localhost:19530',
  collection: 'agent_memory',
  dimension: 1536,
  username: 'user',
  password: 'pass',
});

await storage.init();
```

### pgvector（Mock 实现）

PostgreSQL + pgvector 扩展：

```typescript
import { PgVectorStorage } from '@monkey-agent/memory';

const storage = new PgVectorStorage({
  connectionString: 'postgresql://localhost:5432/agentdb',
  tableName: 'vectors',
  dimension: 1536,
});

await storage.init();
```

### 工厂函数

使用 `createVectorStorage` 动态创建存储：

```typescript
import { createVectorStorage } from '@monkey-agent/memory';

const storage = await createVectorStorage({
  type: 'sqlite-vec',
  path: ':memory:',
});

// 或
const storage = await createVectorStorage({
  type: 'milvus',
  address: 'localhost:19530',
  collection: 'test',
  dimension: 128,
});
```

## API 文档

### MemorySystem

主要的记忆管理接口。

#### 构造函数

```typescript
new MemorySystem(config?: MemorySystemConfig)
```

- `config.shortTermMaxSize` - 短期记忆最大容量（默认 100）
- `config.longTermVectorStorage` - 长期记忆的向量存储
- `config.semanticVectorStorage` - 语义记忆的向量存储
- `config.importanceThreshold` - 重要性阈值（默认 3）

#### 方法

- `remember(memory: Memory)` - 记录新记忆
- `recall(queryEmbedding, limit?, threshold?)` - 检索相关记忆
- `get(id: string)` - 根据 ID 获取记忆
- `forget(id: string)` - 删除记忆
- `clear()` - 清空所有记忆
- `getStats()` - 获取统计信息

### ShortTermMemory

短期记忆管理。

- `add(memory: Memory)` - 添加记忆
- `get(id: string)` - 获取记忆
- `getRecent(limit: number)` - 获取最近的记忆
- `getAll()` - 获取所有记忆
- `clear()` - 清空记忆
- `size()` - 获取记忆数量

### LongTermMemory

长期记忆管理，支持向量搜索。

- `add(memory: Memory)` - 添加记忆
- `get(id: string)` - 获取记忆
- `search(queryEmbedding, limit?, threshold?)` - 向量搜索
- `delete(id: string)` - 删除记忆
- `clear()` - 清空记忆
- `size()` - 获取记忆数量

### WorkingMemory

工作记忆管理。

- `set(key: string, value: any)` - 设置值
- `get(key: string)` - 获取值
- `has(key: string)` - 检查键是否存在
- `delete(key: string)` - 删除键
- `clear()` - 清空所有数据
- `getAll()` - 获取所有键值对
- `keys()` - 获取所有键
- `size()` - 获取数量

### SemanticMemory

语义记忆管理。

- `store(key, value, embedding?)` - 存储知识
- `retrieve(key: string)` - 检索知识
- `search(queryEmbedding, limit?, threshold?)` - 搜索知识
- `delete(key: string)` - 删除知识
- `clear()` - 清空知识
- `size()` - 获取知识数量

## 测试

```bash
# 运行测试
yarn test

# 监听模式
yarn test:watch

# 测试覆盖率
yarn test:coverage

# UI 模式
yarn test:ui
```

## 开发计划

- [ ] 真实的 SQLite-vec 实现（WASM + OPFS）
- [ ] 真实的 Milvus 客户端集成
- [ ] 真实的 pgvector 实现
- [ ] 记忆压缩和归档
- [ ] 记忆重要性自动评估算法
- [ ] 记忆衰减机制
- [ ] 跨会话持久化

## 许可证

MIT
