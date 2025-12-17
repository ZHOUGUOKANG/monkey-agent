# @monkey-agent/compression

> 智能对话历史压缩模块

## 📋 概述

`@monkey-agent/compression` 提供强大的对话历史压缩功能，帮助管理 LLM 的上下文长度限制。当对话历史过长时，该模块能够智能地保留最近的重要对话，同时用 LLM 生成的摘要替换早期对话，从而节省 token 使用并避免上下文溢出错误。

### 核心特性

- ✅ **双策略支持**：基于轮次或基于消息数的压缩
- ✅ **工具调用保护**：自动保持 tool-call/tool-result 配对完整性
- ✅ **智能边界查找**：确保不会在对话轮次中间截断
- ✅ **LLM 摘要生成**：使用 LLM 生成高质量的对话摘要
- ✅ **Token 估算**：快速估算对话历史的 token 数量
- ✅ **配置验证**：自动检查配置的合理性
- ✅ **完整的类型支持**：TypeScript 类型安全

---

## 📦 安装

```bash
# 在 monorepo 中，compression 包已经是工作空间的一部分
yarn workspace @monkey-agent/compression build
```

---

## 🚀 快速开始

### 基本用法

```typescript
import { CompressionOrchestrator } from '@monkey-agent/compression';
import { LLMClient } from '@monkey-agent/llm';
import type { ModelMessage } from 'ai';

// 1. 创建 LLM 客户端
const llmClient = new LLMClient({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
});

// 2. 创建压缩编排器
const orchestrator = new CompressionOrchestrator();

// 3. 准备对话历史
const history: ModelMessage[] = [
  { role: 'user', content: '第一轮提问' },
  { role: 'assistant', content: '第一轮回答' },
  { role: 'user', content: '第二轮提问' },
  { role: 'assistant', content: '第二轮回答' },
  // ... 更多消息
];

// 4. 压缩对话历史（保留最近 3 轮）
const result = await orchestrator.compressHistory(
  history,
  { keepRounds: 3 },
  llmClient
);

// 5. 使用压缩后的历史
console.log('原始长度:', result.originalLength);
console.log('新长度:', result.newLength);
console.log('压缩了:', result.compressedCount, '条消息');
console.log('摘要:', result.summary);

// 使用完整的压缩历史（已包含摘要）
const newHistory = result.compressedHistory;
```

---

## 📖 核心概念

### 压缩策略

#### 1. 基于轮次的压缩（推荐用于多轮对话）

保留最近的 N 轮完整对话。一"轮"对话包括：
- 1 个 user 消息
- 1 个或多个 assistant 消息
- 0 个或多个 tool 消息

```typescript
const result = await orchestrator.compressHistory(
  history,
  { keepRounds: 3 },  // 保留最近 3 轮
  llmClient
);
```

**适用场景：**
- 多轮对话场景
- 需要保持对话连贯性
- 每轮消息数量相对稳定

#### 2. 基于消息数的压缩（推荐用于单轮多工具调用）

保留最近的 N 条消息，确保不破坏工具调用配对。

```typescript
const result = await orchestrator.compressHistory(
  history,
  { keepMessages: 10 },  // 保留最近 10 条消息
  llmClient
);
```

**适用场景：**
- 单轮对话中调用多个工具
- 工具调用链较长
- 需要精确控制保留的消息数

---

## 🎯 高级用法

### 主动压缩检查

使用 `shouldCompress` 方法检查是否需要压缩：

```typescript
const check = orchestrator.shouldCompress(history, {
  maxMessages: 20,     // 消息数阈值
  maxTokens: 8000,     // Token 数阈值
  keepRecentRounds: 3, // 保留轮数
  keepRecentMessages: 10, // 保留消息数
});

if (check.shouldCompress) {
  console.log('需要压缩:', check.reason);
  console.log('推荐策略:', check.recommendedOptions);
  
  const result = await orchestrator.compressHistory(
    history,
    check.recommendedOptions!,
    llmClient
  );
}
```

### 上下文长度错误检测

检测 LLM 错误是否为上下文长度错误：

```typescript
try {
  const response = await llmClient.chat(history);
} catch (error: any) {
  if (orchestrator.isContextLengthError(error.message)) {
    console.log('上下文过长，开始压缩...');
    
    const result = await orchestrator.compressHistory(
      history,
      { keepMessages: 5 },  // 使用更激进的压缩
      llmClient
    );
    
    // 使用压缩后的历史重试
    const response = await llmClient.chat(result.compressedHistory);
  }
}
```

### Token 估算

快速估算对话历史的 token 数量：

```typescript
import { estimateTokens } from '@monkey-agent/compression';

const tokenCount = estimateTokens(history);
console.log(`估算 token 数: ${tokenCount}`);
```

---

## 🔧 API 参考

### CompressionOrchestrator

主要的压缩编排类。

#### `compressHistory(history, options, llmClient)`

压缩对话历史。

**参数：**
- `history: ModelMessage[]` - 对话历史
- `options: CompressionOptions` - 压缩选项
  - `keepRounds?: number` - 保留的轮数
  - `keepMessages?: number` - 保留的消息数
- `llmClient: ILLMClient` - LLM 客户端

**返回：** `Promise<CompressionResult>`

```typescript
interface CompressionResult {
  success: boolean;              // 压缩是否成功
  summary: string;               // 生成的摘要
  originalLength: number;        // 原始消息数量
  newLength: number;            // 压缩后消息数量
  compressedCount: number;      // 被压缩的消息数
  keptMessages: ModelMessage[];  // 保留的原始消息
  compressedHistory: ModelMessage[];  // 包含摘要的完整历史
  warnings?: string[];          // 警告信息
}
```

#### `shouldCompress(history, config)`

检查是否需要压缩。

**参数：**
- `history: ModelMessage[]` - 对话历史
- `config` - 配置选项
  - `maxMessages?: number` - 消息数阈值（默认 20）
  - `maxTokens?: number` - Token 数阈值（默认 8000）
  - `keepRecentRounds?: number` - 保留轮数（默认 3）
  - `keepRecentMessages?: number` - 保留消息数（默认 10）

**返回：**
```typescript
{
  shouldCompress: boolean;
  reason?: string;
  recommendedOptions?: CompressionOptions;
}
```

#### `buildCompressedHistory(summary, recentMessages)`

手动构建压缩后的历史。

**参数：**
- `summary: string` - 摘要文本
- `recentMessages: ModelMessage[]` - 要保留的消息

**返回：** `ModelMessage[]`

#### `isContextLengthError(errorMessage)`

检查错误是否为上下文长度错误。

**参数：**
- `errorMessage: string` - 错误信息

**返回：** `boolean`

---

## 🛠️ 工具函数

### 验证函数

```typescript
import { 
  validateConfig,
  validateToolCallPairing,
  validateCompressionOptions 
} from '@monkey-agent/compression';

// 验证压缩配置
const configResult = validateConfig({
  maxMessages: 20,
  maxTokens: 8000,
});

// 验证工具调用配对
const pairingResult = validateToolCallPairing(messages);

// 验证压缩选项
const optionsResult = validateCompressionOptions({
  keepRounds: 3,
});
```

### Token 估算

```typescript
import { 
  TokenEstimator,
  estimateTokens 
} from '@monkey-agent/compression';

// 使用快捷函数
const tokens = estimateTokens(messages);

// 使用估算器实例（可配置）
const estimator = new TokenEstimator(0.6); // 自定义转换比例
const tokens = estimator.estimateTokens(messages);
```

---

## 💡 最佳实践

### 1. 选择合适的压缩策略

```typescript
// 多轮对话：使用基于轮次的压缩
const multiRoundResult = await orchestrator.compressHistory(
  history,
  { keepRounds: 3 },
  llmClient
);

// 单轮多工具：使用基于消息数的压缩
const singleRoundResult = await orchestrator.compressHistory(
  history,
  { keepMessages: 10 },
  llmClient
);
```

### 2. 定期检查并压缩

```typescript
let history: ModelMessage[] = [];
let iterationCount = 0;

async function chat(userMessage: string) {
  history.push({ role: 'user', content: userMessage });
  iterationCount++;
  
  // 每 5 次迭代检查一次
  if (iterationCount % 5 === 0) {
    const check = orchestrator.shouldCompress(history, {
      maxMessages: 20,
      maxTokens: 8000,
    });
    
    if (check.shouldCompress && check.recommendedOptions) {
      const result = await orchestrator.compressHistory(
        history,
        check.recommendedOptions,
        llmClient
      );
      history = result.compressedHistory;
      
      console.log(`✓ 压缩完成: ${result.compressedCount} 条消息`);
    }
  }
  
  const response = await llmClient.chat(history);
  history.push(...response.messages);
  
  return response;
}
```

### 3. 错误恢复

```typescript
async function chatWithRetry(history: ModelMessage[]) {
  try {
    return await llmClient.chat(history);
  } catch (error: any) {
    if (orchestrator.isContextLengthError(error.message)) {
      console.log('⚠️ 上下文过长，自动压缩并重试...');
      
      const result = await orchestrator.compressHistory(
        history,
        { keepMessages: 5 },  // 激进压缩
        llmClient
      );
      
      return await llmClient.chat(result.compressedHistory);
    }
    throw error;
  }
}
```

### 4. 处理警告

```typescript
const result = await orchestrator.compressHistory(
  history,
  { keepMessages: 10 },
  llmClient
);

if (result.warnings && result.warnings.length > 0) {
  console.warn('⚠️ 压缩警告:');
  result.warnings.forEach(warning => {
    console.warn(`  - ${warning}`);
  });
}
```

---

## 🧪 测试

运行单元测试：

```bash
cd packages/compression
yarn test
```

运行特定测试：

```bash
yarn test:unit              # 单元测试
yarn test:watch            # 监听模式
yarn test:coverage         # 覆盖率报告
```

---

## 🔍 性能考虑

### Token 估算性能

Token 估算使用简单的字符计数算法（1 字符 ≈ 0.5 token），速度非常快：
- 10,000 条消息: ~10ms
- 适合频繁调用

### 压缩性能

压缩主要耗时在 LLM 摘要生成：
- 边界查找: O(n)，通常 <1ms
- LLM 摘要: 取决于 LLM 速度，通常 1-3 秒

**优化建议：**
- 使用定期检查策略（每 5-10 次迭代检查一次）
- 避免过于频繁的压缩
- 考虑使用更快的 LLM 模型生成摘要

### 内存使用

- 边界查找: O(1) 额外空间
- 压缩结果: O(n) 空间（n = 保留的消息数）

---

## 🐛 故障排除

### 错误：InsufficientMessagesError

**原因：** 消息数量不足以进行压缩。

**解决方案：**
```typescript
// 检查消息数量
if (history.length < 5) {
  console.log('消息太少，暂不压缩');
  return history;
}

const result = await orchestrator.compressHistory(
  history,
  { keepMessages: Math.min(10, history.length - 2) },
  llmClient
);
```

### 错误：InvalidStrategyError

**原因：** 未指定 `keepRounds` 或 `keepMessages`。

**解决方案：**
```typescript
// 必须指定其中一个
const result = await orchestrator.compressHistory(
  history,
  { keepRounds: 3 },  // 或 { keepMessages: 10 }
  llmClient
);
```

### 警告：Tool pairing issues

**原因：** 工具调用和结果配对不完整。

**解决方案：**
- 检查对话历史的完整性
- 确保每个 tool-call 都有对应的 tool-result
- 考虑使用基于轮次的压缩策略

---

## 📝 集成示例

### 与 ContextManager 集成

```typescript
import { ContextManager } from '@monkey-agent/context';
import { LLMClient } from '@monkey-agent/llm';

const llmClient = new LLMClient({ /* ... */ });
const contextManager = new ContextManager(llmClient, {
  enabled: true,
  maxMessages: 20,
  maxTokens: 8000,
  checkInterval: 5,
});

let history: ModelMessage[] = [];
let iteration = 0;

async function chat(userMessage: string) {
  history.push({ role: 'user', content: userMessage });
  
  // 自动管理上下文（定期检查 + 压缩）
  history = await contextManager.manageContext(history, iteration++);
  
  try {
    const response = await llmClient.chat(history);
    history.push(...response.messages);
    return response;
  } catch (error: any) {
    if (contextManager.isContextLengthError(error.message)) {
      // 强制压缩并重试
      history = await contextManager.handleContextLengthError(history);
      return await llmClient.chat(history);
    }
    throw error;
  }
}
```

---

## 📄 许可证

MIT License

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 🔗 相关包

- [`@monkey-agent/llm`](../llm) - LLM 客户端
- [`@monkey-agent/context`](../context) - 上下文管理器
- [`@monkey-agent/types`](../types) - 类型定义

