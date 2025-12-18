# LLM Client 使用指南

基于 Vercel AI SDK 的统一 LLM 客户端，提供简洁的 API 调用接口。

## 📋 目录

- [快速开始](#快速开始)
- [初始化方式](#初始化方式)
- [基础用法](#基础用法)
- [推理模型配置](#推理模型配置)
- [工具调用](#工具调用)
- [流式输出](#流式输出)
- [API 参考](#api-参考)

---

## 快速开始

```typescript
import { LLMClient } from '@monkey-agent/core';

// 创建客户端
const client = new LLMClient({
  provider: 'openai',
  apiKey: 'sk-...',
  model: 'gpt-4',
});

// 发送消息
const response = await client.chat([
  { role: 'user', content: 'Hello!' }
]);

console.log(response.text);
```

---

## 初始化方式

### 方式 1: 标准配置（推荐）

```typescript
const client = new LLMClient({
  provider: 'openai',     // 'openai' | 'anthropic' | 'google' | 'openrouter'
  apiKey: 'sk-...',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2000,
});
```

**支持的 Provider：**

| Provider | 说明 | 示例模型 |
|---------|------|---------|
| `openai` | OpenAI 官方 API | `gpt-4`, `gpt-4o`, `gpt-3.5-turbo` |
| `anthropic` | Anthropic 官方 API | `claude-3-5-sonnet`, `claude-3-opus` |
| `google` | Google AI Studio | `gemini-2.0-flash-exp`, `gemini-1.5-pro` |
| `openrouter` | OpenRouter 统一接口 | `openai/gpt-4o`, `anthropic/claude-3.5-sonnet` |
| `bedrock` | Amazon Bedrock | `anthropic.claude-3-5-sonnet`, `meta.llama3-70b` |
| `azure` | Azure OpenAI | `gpt-4o` (部署名称) |
| `vertex` | Google Vertex AI | `gemini-1.5-pro`, `gemini-2.0-flash` |
| `deepseek` | DeepSeek API | `deepseek-chat`, `deepseek-reasoner` |

> 📚 详细的新提供商使用指南请查看 [NEW_PROVIDERS.md](./NEW_PROVIDERS.md)

### 方式 2: 传入 LanguageModel（最灵活）

```typescript
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: 'sk-...',
  baseURL: 'https://custom-endpoint.com',
});

const client = new LLMClient({
  languageModel: openai('gpt-4'),
  temperature: 0.7,
});
```

---

## 基础用法

### 普通对话

```typescript
const response = await client.chat([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What is the capital of France?' },
]);

// chat() 直接返回 AI SDK 的 GenerateTextResult
console.log(response.text);        // 响应文本
console.log(response.usage);       // Token 使用统计
console.log(response.finishReason); // 结束原因
console.log(response.toolCalls);    // 工具调用（如果有）
```

### 调用选项

```typescript
const response = await client.chat(messages, {
  system: 'You are a helpful assistant.',
  temperature: 0.8,
  maxTokens: 1000,
  topP: 0.9,
  presencePenalty: 0.5,
  frequencyPenalty: 0.5,
  stopSequences: ['\n\n'],
  seed: 42,
});
```

---

## 推理模型配置

### OpenAI o1 系列

```typescript
const o1Client = new LLMClient({
  provider: 'openai',
  apiKey: 'sk-...',
  model: 'o1-preview',
  reasoning: { 
    effort: 'high'  // 'low' | 'medium' | 'high'
  }
});

const response = await o1Client.chat([
  { role: 'user', content: 'Solve this complex problem...' }
]);

// 访问推理信息
console.log(response.reasoning);                // 推理内容
console.log(response.usage.reasoningTokens);    // 推理 token 数

// 调用时覆盖配置
const result = await o1Client.chat(messages, {
  reasoning: { effort: 'high' }
});
```

### Claude Extended Thinking

```typescript
const claudeClient = new LLMClient({
  provider: 'anthropic',
  apiKey: 'sk-ant-...',
  model: 'claude-sonnet-4-5-20250929',
  reasoning: {
    thinking: 5000  // Token 预算
    // 或 thinking: true (自动模式)
  }
});

const response = await claudeClient.chat(messages);
console.log(response.reasoningText);    // 推理文本
console.log(response.reasoningDetails); // 推理详情
```

### DeepSeek-R1（标签提取）

```typescript
import { createAzure } from '@ai-sdk/azure';

const azure = createAzure({ 
  resourceName: '...', 
  apiKey: '...' 
});

const deepseekClient = new LLMClient({
  languageModel: azure('deepseek-r1'),
  reasoning: { 
    tagName: 'think'  // 提取 <think>...</think> 标签
  }
});

const response = await deepseekClient.chat(messages);
console.log(response.reasoning);      // 提取的推理内容
```

---

## 工具调用

### 定义和使用工具

```typescript
import { tool, z } from 'ai';

// 1. 定义工具
const weatherTool = tool({
  description: 'Get the current weather',
  parameters: z.object({
    location: z.string().describe('City name'),
  }),
  execute: async ({ location }) => {
    return { location, temp: 22, conditions: 'Sunny' };
  },
});

const tools = {
  getWeather: weatherTool,
};

// 2. 调用 LLM
const messages = [
  { role: 'user', content: 'What is the weather in Paris?' }
];

const response = await client.chat(messages, {
  tools,
  toolChoice: 'auto', // 'auto' | 'required' | 'none'
});

// 3. 手动执行工具
if (response.toolCalls) {
  for (const toolCall of response.toolCalls) {
    const toolResult = await tools[toolCall.toolName].execute(toolCall.input);
    const toolMessage = client.buildToolResultMessage(toolCall, toolResult);
    messages.push(toolMessage);
  }
  
  // 4. 继续对话
  const nextResponse = await client.chat(messages);
  console.log(nextResponse.text);
}
```

### 辅助方法

```typescript
// 构建助手消息
const assistantMessage = client.buildAssistantMessage(response.toolCalls);

// 构建工具结果消息
const toolMessage = client.buildToolResultMessage(toolCall, result);

// 构建错误消息
const errorMessage = client.buildToolResultMessage(
  toolCall, 
  { error: 'Tool execution failed' },
  true  // isError
);
```

---

## 流式输出

### 方式 1: 纯文本流（最常用）

```typescript
const result = client.stream(messages, { tools });

for await (const text of result.textStream) {
  process.stdout.write(text);
}
```

### 方式 2: 完整事件流

```typescript
const result = client.stream(messages, { tools });

for await (const event of result.fullStream) {
  switch (event.type) {
    case 'text-delta':
      console.log('Text:', event.textDelta);
      break;
    case 'tool-call':
      console.log('Calling tool:', event.toolName, event.input);
      break;
    case 'tool-result':
      console.log('Tool result:', event.result);
      break;
  }
}
```

### 方式 3: 等待最终结果

```typescript
const result = client.stream(messages);

const finalText = await result.text;
const usage = await result.usage;
const finishReason = await result.finishReason;
```

### 便捷方法：streamText

```typescript
for await (const text of client.streamText(messages)) {
  process.stdout.write(text);
}
```

---

## API 参考

### LLMConfig

```typescript
interface LLMConfig {
  // 方式 1: 标准配置
  provider?: 'openai' | 'anthropic' | 'google';
  apiKey?: string;
  model?: string;
  baseURL?: string;
  
  // 方式 2: 直接传入 LanguageModel（优先级最高）
  languageModel?: LanguageModel;
  
  // 通用参数
  temperature?: number;
  maxTokens?: number;
  
  // 推理配置
  reasoning?: ReasoningConfig;
}
```

### ReasoningConfig

```typescript
interface ReasoningConfig {
  disabled?: boolean;  // 禁用推理
  
  // OpenAI o1 系列
  effort?: 'low' | 'medium' | 'high';
  
  // Claude Extended Thinking
  thinking?: boolean | number;  // true/false 或 token 预算
  
  // DeepSeek-R1 等（标签提取）
  tagName?: string;  // 如 'think'
}
```

### LLMCallOptions

```typescript
interface LLMCallOptions<TOOLS extends ToolSet> {
  // 系统提示
  system?: string;
  
  // 生成参数
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stopSequences?: string[];
  seed?: number;
  
  // 工具相关
  tools?: TOOLS;
  toolChoice?: 'auto' | 'required' | 'none' | { type: 'tool'; toolName: string };
  activeTools?: string[];
  
  // 推理配置（覆盖初始化配置）
  reasoning?: ReasoningConfig;
  
  // 高级参数
  maxRetries?: number;
  abortSignal?: AbortSignal;
  headers?: Record<string, string>;
}
```

### LLMChatResult

`LLMChatResult` 是 AI SDK `GenerateTextResult` 的类型别名：

```typescript
interface GenerateTextResult<TOOLS extends ToolSet> {
  // 基础内容
  text: string;                // 生成的文本
  content: Array<any>;         // 完整内容数组
  
  // 工具调用
  toolCalls?: Array<{
    toolCallId: string;
    toolName: keyof TOOLS & string;
    args: any;
  }>;
  
  // 执行信息
  finishReason: string;        // 结束原因
  usage: {                     // Token 统计
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    reasoningTokens?: number;  // 推理 tokens
  };
  
  // 推理相关
  reasoning?: Array<any>;      // 推理输出
  reasoningText?: string;      // 推理文本
  reasoningDetails?: Array<any>; // Anthropic 推理详情
}
```

---

## 最佳实践

### 1. 环境变量管理

```typescript
// .env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

// 使用
import 'dotenv/config';

const client = new LLMClient({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
});
```

### 2. Token 使用监控

```typescript
const response = await client.chat(messages);

console.log(`Input tokens: ${response.usage.inputTokens}`);
console.log(`Output tokens: ${response.usage.outputTokens}`);
console.log(`Total tokens: ${response.usage.totalTokens}`);
```

### 3. 工具调用循环保护

```typescript
let response = await client.chat(messages, { tools });
let iteration = 0;
const maxIterations = 10;

while (response.toolCalls && iteration < maxIterations) {
  iteration++;
  // 处理工具调用...
  response = await client.chat(messages, { tools });
}

if (iteration >= maxIterations) {
  console.warn('Max iterations reached');
}
```

---

## 常见问题

### Q: 如何使用本地模型？

```typescript
import { createOpenAI } from '@ai-sdk/openai';

// Ollama
const ollama = createOpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama',
});

const client = new LLMClient({
  languageModel: ollama('llama2'),
});
```

### Q: 如何处理超时？

```typescript
const controller = new AbortController();
setTimeout(() => controller.abort(), 30000);

try {
  const response = await client.chat(messages, {
    abortSignal: controller.signal,
  });
} catch (error) {
  if (error.name === 'AbortError') {
    console.error('Request timeout');
  }
}
```

---

## 相关资源

- [Vercel AI SDK 文档](https://sdk.vercel.ai/docs)
- [OpenAI API 文档](https://platform.openai.com/docs)
- [Anthropic API 文档](https://docs.anthropic.com)

---

## License

MIT
