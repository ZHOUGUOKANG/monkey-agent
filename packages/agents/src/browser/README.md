# Browser Agent

浏览器自动化 Agent，支持页面导航、DOM 操作、内容提取和多标签页管理。

## 核心特性

- ✅ **页面操作**：导航、点击、输入、滚动
- ✅ **内容提取**：文本、HTML、截图
- ✅ **多标签页支持**：在指定标签页执行操作
- ✅ **标签页管理**：创建、关闭、切换、列表
- ✅ **智能等待**：等待元素出现
- ✅ **脚本执行**：在页面中执行自定义 JavaScript

## 基础使用

```typescript
import { BrowserAgent } from '@monkey-agent/agents';

// 创建 Agent 实例
const agent = new BrowserAgent({
  llmConfig: {
    provider: 'openai',
    apiKey: 'sk-...',
    model: 'gpt-4',
  },
});

// 执行任务
const result = await agent.execute({
  goal: '导航到 Google 并搜索 "TypeScript"',
});
```

## 多标签页操作

### 配置默认标签页

```typescript
// 方式 1：指定默认标签页 ID
const agent = new BrowserAgent({
  defaultTabId: 12345, // 默认在这个标签页执行操作
});

// 方式 2：总是使用活动标签页
const agent = new BrowserAgent({
  alwaysUseActiveTab: true, // 忽略 defaultTabId，总是操作当前活动标签页
});
```

### 在特定标签页执行操作

所有页面操作都支持可选的 `tabId` 参数：

```typescript
// 在标签页 123 中导航
await agent.execute({
  goal: '在标签页 123 中打开 GitHub',
  tools: {
    navigate: { url: 'https://github.com', tabId: 123 }
  }
});

// 在标签页 456 中点击按钮
await agent.execute({
  goal: '点击登录按钮',
  tools: {
    click: { selector: '.login-btn', tabId: 456 }
  }
});

// 从标签页 789 提取内容
await agent.execute({
  goal: '获取页面标题',
  tools: {
    getContent: { tabId: 789 }
  }
});
```

### 标签页管理

```typescript
// 创建新标签页
await agent.execute({
  goal: '打开新标签页并访问 Google',
  context: {
    steps: [
      'createTab with url: https://google.com',
    ]
  }
});

// 列出所有标签页
await agent.execute({
  goal: '列出当前窗口的所有标签页',
  context: {
    steps: ['listTabs']
  }
});

// 切换到指定标签页
await agent.execute({
  goal: '切换到标签页 123',
  context: {
    steps: ['switchTab with tabId: 123']
  }
});

// 关闭标签页
await agent.execute({
  goal: '关闭标签页 456',
  context: {
    steps: ['closeTab with tabId: 456']
  }
});

// 获取当前活动标签页
await agent.execute({
  goal: '获取当前标签页信息',
  context: {
    steps: ['getActiveTab']
  }
});
```

## 实际应用场景

### 场景 1：多标签页并行数据采集

```typescript
const agent = new BrowserAgent();

await agent.execute({
  goal: `
    打开三个标签页，分别访问以下网站并提取标题：
    1. https://github.com
    2. https://stackoverflow.com
    3. https://reddit.com
  `,
});

// Agent 会自动：
// 1. 创建三个标签页
// 2. 在各自标签页导航到目标网址
// 3. 提取每个标签页的标题
// 4. 返回汇总结果
```

### 场景 2：后台标签页自动化

```typescript
const agent = new BrowserAgent();

await agent.execute({
  goal: `
    在后台标签页填写表单：
    1. 创建新标签页（不激活）
    2. 导航到表单页面
    3. 填写表单字段
    4. 提交表单
    5. 返回原标签页
  `,
});
```

### 场景 3：跨标签页数据对比

```typescript
const agent = new BrowserAgent();

await agent.execute({
  goal: `
    比较两个商品页面的价格：
    1. 在标签页 A 打开商品 1
    2. 在标签页 B 打开商品 2
    3. 从两个标签页提取价格
    4. 返回价格对比结果
  `,
});
```

## 可用工具

### 页面操作

| 工具 | 参数 | 描述 |
|------|------|------|
| `navigate` | `url`, `tabId?` | 导航到指定 URL |
| `click` | `selector`, `waitForElement?`, `tabId?` | 点击元素 |
| `type` | `selector`, `text`, `clear?`, `tabId?` | 输入文本 |
| `scroll` | `direction`, `selector?`, `amount?`, `tabId?` | 滚动页面 |
| `back` | `tabId?` | 后退 |
| `forward` | `tabId?` | 前进 |
| `reload` | `hard?`, `tabId?` | 重新加载 |

### 内容提取

| 工具 | 参数 | 描述 |
|------|------|------|
| `getContent` | `selector?`, `includeHtml?`, `tabId?` | 提取文本内容 |
| `screenshot` | `fullPage?`, `tabId?` | 截图 |
| `waitForElement` | `selector`, `timeout?`, `tabId?` | 等待元素出现 |

### 脚本执行

| 工具 | 参数 | 描述 |
|------|------|------|
| `executeScript` | `code`, `tabId?` | 执行 JavaScript 代码 |

### 标签页管理

| 工具 | 参数 | 描述 |
|------|------|------|
| `createTab` | `url?`, `active?` | 创建新标签页 |
| `closeTab` | `tabId` | 关闭标签页 |
| `switchTab` | `tabId` | 切换到标签页 |
| `listTabs` | `currentWindowOnly?` | 列出所有标签页 |
| `getActiveTab` | - | 获取活动标签页 |

## 优先级说明

`tabId` 参数的优先级顺序：

1. **工具调用中指定的 `tabId`**（最高优先级）
2. **配置的 `defaultTabId`**
3. **当前活动标签页**（默认行为）

如果设置了 `alwaysUseActiveTab: true`，将忽略 `defaultTabId`，始终使用当前活动标签页。

## 执行环境

Browser Agent 支持两种执行环境：

### 1. Content Script 环境

在页面中注入的脚本，可以直接访问 `document` 和 `window`：

```typescript
// 不指定 tabId，在当前页面执行
await agent.click({ selector: '.button' });
```

### 2. Extension Background 环境

在 Service Worker 中运行，通过 `chrome.scripting` API 在指定标签页执行：

```typescript
// 指定 tabId，通过 chrome.scripting 在目标标签页执行
await agent.click({ selector: '.button', tabId: 123 });
```

## 注意事项

1. **权限要求**：标签页操作需要 Chrome Extension 的 `tabs` 和 `scripting` 权限
2. **跨域限制**：某些网站可能限制脚本执行
3. **性能考虑**：频繁切换标签页会影响用户体验
4. **安全性**：`executeScript` 工具应谨慎使用，避免执行不受信任的代码

## 示例代码

完整示例请参考：
- [基础操作示例](../../examples/browser-agent-basic.ts)
- [多标签页示例](../../examples/browser-agent-multi-tab.ts)
- [数据采集示例](../../examples/browser-agent-crawling.ts)
