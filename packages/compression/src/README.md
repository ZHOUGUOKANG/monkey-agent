# 上下文压缩工具

智能压缩对话历史，避免超出 LLM 上下文限制，同时保证工具调用配对完整。

## 核心特性

- **两种压缩策略**: 基于轮次（多轮对话）或基于消息数（单轮多工具）
- **工具调用配对保护**: 确保 `assistant(tool-call)` 和 `tool(result)` 不被拆分

## 快速开始

### 基本用法

```typescript
import { compressHistory } from '@monkey-agent/core';

// 压缩历史
const result = await compressHistory(
  conversationHistory,
  { keepRounds: 3 },  // 或 { keepMessages: 10 }
  llmClient
);

// 构建新历史
const newHistory = buildCompressedHistory(
  result.summary,
  result.keptMessages
);
```

### 集成到 Agent

```typescript
const agent = new MyAgent({
  contextCompression: {
    enabled: true,
    maxMessages: 20,
    keepRecentRounds: 3,
    autoRetryOnLength: true,
  },
});

// 监听压缩事件
agent.on('context:compressed', (data) => {
  console.log('压缩摘要:', data.summary);
});
```

## 工具调用配对

```typescript
// 正确的配对（不会被拆分）
[
  user: "查天气",
  assistant: [tool-call: getWeather],  // ← 配对
  tool: {result: "晴天"},              // ← 配对
  assistant: "今天是晴天"
]
```

**安全截断点**:
- ✅ `user` 消息
- ✅ 纯文本 `assistant` 消息
- ✅ `tool` 消息之后（会向前查找配对）

**不安全截断**:
- ❌ `assistant(tool-call)` 和 `tool(result)` 之间

## 配置选项

```typescript
contextCompression: {
  enabled: true,
  maxMessages: 20,        // 消息数阈值
  maxTokens: 8000,        // Token 阈值
  keepRecentRounds: 3,    // 保留轮次
  keepRecentMessages: 10, // 保留消息数
  autoRetryOnLength: true,// 自动重试
  enableTool: true,       // LLM 主动压缩
}
```

## 验证

```typescript
const validation = validateToolCallPairing(messages);
if (!validation.valid) {
  console.warn('配对问题:', validation.issues);
}
```

## 测试

```bash
yarn workspace @monkey-agent/core test:boundary
```
