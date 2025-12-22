# @monkey-agent/llm

统一的 LLM 客户端，基于 Vercel AI SDK，支持多种 LLM 提供商和 embedding 功能。

## 特性

- 🎯 **统一接口** - 支持 OpenAI、Anthropic、Google、DeepSeek 等多个提供商
- 🔄 **流式输出** - 支持流式对话和完整的事件流
- 🛠️ **工具调用** - 完整支持 Function Calling（自动和手动模式）
- 🧠 **推理模式** - 支持 OpenAI o1、Claude Extended Thinking、DeepSeek R1 等推理模型
- 📊 **Embedding** - 文本嵌入向量生成，支持语义搜索
- ⚙️ **灵活配置** - 丰富的配置选项，支持自定义模型和参数

## 安装

```bash
yarn add @monkey-agent/llm
```

## 快速开始

### 基础对话

```typescript
import { LLMClient } from '@monkey-agent/llm';

const client = new LLMClient({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o',
});

// 普通对话
const result = await client.chat([
  { role: 'user', content: 'Hello!' }
]);
console.log(result.text);

// 流式对话
for await (const chunk of client.streamText([
  { role: 'user', content: 'Tell me a story' }
])) {
  process.stdout.write(chunk);
}
```

### Embedding 功能

#### 单个文本 Embedding

```typescript
const client = new LLMClient({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

// 生成单个文本的 embedding
const result = await client.embed('sunny day at the beach');

console.log(result.embedding);        // [0.1, 0.2, ...] (1536 维)
console.log(result.usage.tokens);     // Token 使用量
console.log(result.value);            // 原始输入文本
```

#### 批量 Embedding

```typescript
// 批量生成 embeddings
const result = await client.embedMany([
  'sunny day at the beach',
  'rainy afternoon in the city',
  'snowy night in the mountains',
]);

console.log(result.embeddings);       // [[...], [...], [...]]
console.log(result.usage.tokens);     // 总 Token 使用量
console.log(result.values);           // 原始输入数组
```

#### 语义搜索

```typescript
// 1. 生成查询和文档的 embeddings
const [queryResult, docsResult] = await Promise.all([
  client.embed('What is the weather like?'),
  client.embedMany([
    'The weather is sunny today',
    'It is raining heavily',
    'Machine learning is a subset of AI',
  ]),
]);

// 2. 计算相似度
const similarities = docsResult.embeddings.map(docEmb =>
  client.cosineSimilarity(queryResult.embedding, docEmb)
);

// 3. 排序并获取最相关的文档
const ranked = docsResult.values
  .map((doc, i) => ({ doc, similarity: similarities[i] }))
  .sort((a, b) => b.similarity - a.similarity);

console.log(ranked[0]); // 最相关: "The weather is sunny today"
```

#### 高级选项

```typescript
// 使用自定义模型
const result = await client.embed('text', {
  model: 'text-embedding-3-large',
});

// 减少维度（节省存储空间）
const result = await client.embed('text', {
  providerOptions: {
    openai: {
      dimensions: 512,  // 从 1536 减少到 512
    },
  },
});

// 批量处理时限制并行请求
const result = await client.embedMany(texts, {
  maxParallelCalls: 3,  // 最多 3 个并行请求
});

// 设置超时
const result = await client.embed('text', {
  abortSignal: AbortSignal.timeout(5000),  // 5秒超时
});
```

### 工具调用（Function Calling）

```typescript
import { tool, z } from '@monkey-agent/llm';

// 定义工具
const weatherTool = tool({
  description: 'Get the current weather',
  parameters: z.object({
    location: z.string().describe('City name'),
  }),
  execute: async ({ location }) => {
    // 调用天气 API
    return { location, temp: 22, conditions: 'Sunny' };
  },
});

// 使用工具（自动执行 - 默认）
const result = await client.chat(
  [{ role: 'user', content: 'What is the weather in Paris?' }],
  {
    tools: { getWeather: weatherTool },
    toolChoice: 'auto',
  }
);

console.log(result.text); // "The weather in Paris is sunny with a temperature of 22°C"
```

### 推理模式

```typescript
// OpenAI o1 系列
const client = new LLMClient({
  provider: 'openai',
  model: 'o1-preview',
  reasoning: { effort: 'high' },
});

// Claude Extended Thinking
const client = new LLMClient({
  provider: 'anthropic',
  model: 'claude-3-7-sonnet-20250219',
  reasoning: { thinking: 5000 },  // 5000 tokens 推理预算
});

// DeepSeek R1 (标签提取)
const client = new LLMClient({
  provider: 'deepseek',
  model: 'deepseek-reasoner',
  reasoning: { tagName: 'think' },
});
```

## 支持的提供商

| 提供商 | Provider | 默认模型 | Embedding 支持 |
|--------|----------|----------|---------------|
| OpenAI | `openai` | gpt-4o | ✅ text-embedding-3-small |
| Anthropic | `anthropic` | claude-3-5-sonnet | ❌ |
| Google Gemini | `google` | gemini-1.5-pro | ✅ text-embedding-004 |
| DeepSeek | `deepseek` | deepseek-chat | ❌ |
| Amazon Bedrock | `bedrock` | claude-3-5-sonnet | ✅ amazon.titan-embed-text-v1 |
| Azure OpenAI | `azure` | gpt-4o | ✅ text-embedding-3-small |
| Google Vertex | `vertex` | gemini-1.5-pro | ✅ text-embedding-004 |
| OpenRouter | `openrouter` | gpt-4o | ❌ |

## Embedding 模型

### OpenAI

```typescript
const client = new LLMClient({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

// 默认: text-embedding-3-small (1536 维)
await client.embed('text');

// 大模型: text-embedding-3-large (3072 维)
await client.embed('text', { model: 'text-embedding-3-large' });

// 旧版: text-embedding-ada-002 (1536 维)
await client.embed('text', { model: 'text-embedding-ada-002' });
```

### Google Gemini

```typescript
const client = new LLMClient({
  provider: 'google',
  apiKey: process.env.GOOGLE_API_KEY,
});

// text-embedding-004 (768 维)
await client.embed('text');
```

### Amazon Bedrock

```typescript
const client = new LLMClient({
  provider: 'bedrock',
  region: 'us-east-1',
});

// amazon.titan-embed-text-v1 (1536 维)
await client.embed('text');

// amazon.titan-embed-text-v2:0 (1024 维)
await client.embed('text', { model: 'amazon.titan-embed-text-v2:0' });
```

## API 参考

### `embed(value, options?)`

生成单个文本的 embedding。

**参数:**
- `value: string` - 输入文本
- `options?`:
  - `model?: string` - 自定义 embedding 模型
  - `maxRetries?: number` - 最大重试次数（默认 2）
  - `abortSignal?: AbortSignal` - 中止信号
  - `headers?: Record<string, string>` - 自定义请求头
  - `providerOptions?: Record<string, any>` - Provider 特定选项

**返回:** `Promise<EmbedResult>`
- `embedding: number[]` - Embedding 向量
- `usage: { tokens: number }` - Token 使用统计
- `value: string` - 原始输入值
- `response?: object` - 原始 provider 响应

### `embedMany(values, options?)`

批量生成 embeddings。

**参数:**
- `values: string[]` - 输入文本数组
- `options?`:
  - 所有 `embed()` 的选项
  - `maxParallelCalls?: number` - 最大并行请求数

**返回:** `Promise<EmbedManyResult>`
- `embeddings: number[][]` - Embedding 向量数组
- `usage: { tokens: number }` - Token 使用统计
- `values: string[]` - 原始输入数组
- `response?: object` - 原始 provider 响应

### `cosineSimilarity(embedding1, embedding2)`

计算两个 embedding 向量的余弦相似度。

**参数:**
- `embedding1: number[]` - 第一个 embedding 向量
- `embedding2: number[]` - 第二个 embedding 向量

**返回:** `number` - 相似度分数（-1 到 1，越接近 1 越相似）

## 使用场景

### 1. 语义搜索

在文档库中找到与查询最相关的内容。

```typescript
const docs = ['doc1', 'doc2', 'doc3'];
const query = 'user query';

const [queryEmb, docsEmb] = await Promise.all([
  client.embed(query),
  client.embedMany(docs),
]);

const similarities = docsEmb.embeddings.map(doc =>
  client.cosineSimilarity(queryEmb.embedding, doc)
);
```

### 2. 文本聚类

根据语义相似度对文本进行分组。

```typescript
const texts = ['text1', 'text2', 'text3'];
const result = await client.embedMany(texts);

// 计算所有文本之间的相似度矩阵
const matrix = result.embeddings.map((emb1, i) =>
  result.embeddings.map((emb2, j) =>
    i === j ? 1 : client.cosineSimilarity(emb1, emb2)
  )
);
```

### 3. 推荐系统

根据用户历史推荐相似内容。

```typescript
// 用户喜欢的内容
const userLikes = await client.embedMany(['item1', 'item2']);

// 计算平均 embedding
const avgEmb = userLikes.embeddings[0].map((_, i) =>
  userLikes.embeddings.reduce((sum, emb) => sum + emb[i], 0) / userLikes.embeddings.length
);

// 在候选项中找最相似的
const candidates = await client.embedMany(['candidate1', 'candidate2']);
const similarities = candidates.embeddings.map(emb =>
  client.cosineSimilarity(avgEmb, emb)
);
```

### 4. 向量数据库集成

配合向量数据库实现高效检索。

```typescript
import { createVectorStorage } from '@monkey-agent/memory';

const storage = await createVectorStorage({
  type: 'sqlite-vec',
  path: './embeddings.db',
});

// 插入文档
const docs = ['doc1', 'doc2', 'doc3'];
const result = await client.embedMany(docs);

for (let i = 0; i < docs.length; i++) {
  await storage.insert({
    id: `doc-${i}`,
    vector: new Float32Array(result.embeddings[i]),
    metadata: { text: docs[i] },
  });
}

// 搜索
const query = await client.embed('search query');
const results = await storage.search({
  vector: new Float32Array(query.embedding),
  limit: 5,
});
```

## 错误处理

```typescript
try {
  const result = await client.embed('text');
} catch (error) {
  if (error.message.includes('Provider')) {
    console.error('不支持的提供商');
  } else if (error.message.includes('API key')) {
    console.error('API key 错误');
  } else {
    console.error('生成 embedding 失败:', error);
  }
}
```

## 性能优化

### 批量处理

```typescript
// ❌ 慢：逐个处理
for (const text of texts) {
  await client.embed(text);
}

// ✅ 快：批量处理
await client.embedMany(texts);
```

### 并行控制

```typescript
// 大量文本时限制并行数
await client.embedMany(manyTexts, {
  maxParallelCalls: 5,  // 避免过载
});
```

### 维度压缩

```typescript
// 减少维度节省存储和计算
await client.embed(text, {
  providerOptions: {
    openai: { dimensions: 512 },  // 原本 1536 → 512
  },
});
```

## 完整示例

查看 `examples/embedding-example.ts` 获取更多完整示例。

## 许可证

MIT
