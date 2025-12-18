# 环境变量工具

统一的环境变量加载和验证工具。

## 快速开始

```typescript
import { initEnv, getLLMConfig } from '@monkey-agent/core/utils';

// 初始化并验证
const validation = initEnv();
if (!validation.valid) {
  console.error(validation.error);
  process.exit(1);
}

// 获取配置并使用
const client = new LLMClient(getLLMConfig());
```

## API

### initEnv(options?)

加载并验证环境变量。

```typescript
interface EnvLoaderOptions {
  envPath?: string;      // 默认 '../../.env'
  verbose?: boolean;     // 默认 true
  override?: boolean;    // 默认 false
}

// 返回
interface ApiKeyValidation {
  valid: boolean;
  provider?: 'openai' | 'anthropic' | 'google';
  apiKey?: string;
  error?: string;
}
```

### getLLMConfig(provider?)

获取 LLM 配置对象，直接传给 `LLMClient`。

```typescript
const config = getLLMConfig();
// { provider: 'openai', apiKey: 'sk-...', model: 'gpt-4o-mini', ... }
```

### loadEnvFile(options?)

仅加载 `.env` 文件，不验证。返回 `boolean`。

### validateApiKey(provider?)

验证 API Key 是否有效。返回 `ApiKeyValidation`。

### printEnvHelp()

打印环境变量配置帮助信息。

## 环境变量

在项目根目录创建 `.env`：

```bash
# OpenAI
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-4o-mini              # 可选
OPENAI_BASE_URL=https://...           # 可选
OPENAI_TEMPERATURE=0.7                # 可选
OPENAI_MAX_TOKENS=2000                # 可选

# Anthropic
ANTHROPIC_API_KEY=sk-ant-your-key
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Google
GOOGLE_API_KEY=your-key
GOOGLE_MODEL=gemini-1.5-flash
```

**Provider 优先级**：OpenAI > Anthropic > Google

## 使用示例

### 测试脚本

```typescript
import { initEnv, getLLMConfig } from '@monkey-agent/core/utils';
import { LLMClient } from '@monkey-agent/core';

const validation = initEnv();
if (!validation.valid) {
  console.error(validation.error);
  process.exit(1);
}

const client = new LLMClient(getLLMConfig());
const result = await client.chat([
  { role: 'user', content: 'Hello!' }
]);
```

### Agent

```typescript
import { BaseAgent } from '@monkey-agent/core';
import { initEnv, getLLMConfig } from '@monkey-agent/core/utils';

const validation = initEnv({ verbose: false });
if (!validation.valid) {
  console.error(validation.error);
  process.exit(1);
}

const agent = new MyAgent({
  id: 'my-agent',
  name: 'My Agent',
  llmConfig: getLLMConfig(),
});
```

### 自定义配置

```typescript
const config = {
  ...getLLMConfig(),
  temperature: 0.9,
  maxTokens: 4000,
};
const client = new LLMClient(config);
```

## 错误处理

```typescript
const validation = initEnv();
if (!validation.valid) {
  console.error(`❌ ${validation.error}`);
  printEnvHelp();
  process.exit(1);
}
```

**常见错误**：
- 未找到 `.env` 文件 → 创建 `.env` 或使用环境变量
- 未找到有效的 API Key → 设置至少一个 Provider 的 API Key
- API Key 无效 → 检查 Key 格式，不能是占位符（如 `sk-xxx`）
