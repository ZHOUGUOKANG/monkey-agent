# Browser Agent

浏览器自动化 Agent，支持页面导航、DOM 操作、表单填写、内容提取和多标签页管理。

## 核心特性

- ✅ **导航操作**：前进、后退、刷新、URL跳转
- ✅ **表单交互**：填写、选择下拉框、勾选复选框
- ✅ **高级交互**：悬停、按键、双击、右键
- ✅ **智能提取**：结构化表格、列表批量提取
- ✅ **内容提取**：文本、HTML、截图、元素属性
- ✅ **智能等待**：等待元素出现
- ✅ **错误恢复**：自动分类错误并提供修复建议

## 工具列表 (18个)

### 📍 导航类 (3个)

| 工具 | 参数 | 描述 |
|------|------|------|
| `navigate` | `url` | 导航到指定URL |
| `goBack` | `waitUntil?` | 浏览器后退 |
| `reload` | `hard?` | 刷新页面（支持硬刷新） |

### 🖱️ 交互类 (6个)

| 工具 | 参数 | 描述 |
|------|------|------|
| `click` | `selector`, `timeout?`, `force?`, `clickCount?`, `button?` | 点击元素（支持双击、右键、强制点击） |
| `fill` | `selector`, `value` | 填写输入框 |
| `selectOption` | `selector`, `value`, `timeout?` | 选择下拉框选项（支持单选/多选） |
| `check` | `selector`, `checked?`, `timeout?` | 勾选/取消复选框 |
| `hover` | `selector`, `timeout?` | 悬停元素（触发下拉菜单/提示） |
| `press` | `key`, `selector?`, `timeout?` | 按键操作（Enter、Tab、Escape等） |

### 📊 数据提取类 (7个)

| 工具 | 参数 | 描述 |
|------|------|------|
| `getPageSummary` | - | ⭐ 获取页面结构化摘要（推荐首选） |
| `getPageText` | `maxLength?` | 获取纯文本内容（无HTML标签） |
| `getText` | `selector` | 获取单个元素文本 |
| `getTexts` | `selector`, `limit?` | ⭐ 批量获取多个元素文本 |
| `extractTable` | `selector`, `includeHeader?` | ⭐ 提取表格为JSON数组 |
| `extractList` | `selector`, `itemSelector`, `limit?` | ⭐ 提取列表为数组 |
| `getAttribute` | `selector`, `attribute` | 获取元素属性值 |
| `getContent` | `maxLength?`, `cleanHtml?` | ⚠️ 获取HTML（不推荐，始终截断至10K） |

### ⏱️ 等待类 (1个)

| 工具 | 参数 | 描述 |
|------|------|------|
| `waitForSelector` | `selector`, `timeout?` | 等待元素出现 |

### 🔧 高级类 (2个)

| 工具 | 参数 | 描述 |
|------|------|------|
| `screenshot` | `fullPage?` | 截图 |
| `evaluate` | `script` | 执行JavaScript |

## 基础使用

```typescript
import { BrowserAgent } from '@monkey-agent/agents';

// 创建 Agent 实例
const agent = new BrowserAgent({
  llmClient: {
    provider: 'openai',
    apiKey: 'sk-...',
    model: 'gpt-4',
  },
  browser: browser,
  page: page,
});

// 执行任务
const result = await agent.execute({
  goal: '导航到 Google 并搜索 "TypeScript"',
});
```

## 常见使用场景

### 场景 1: 表单自动填写

```typescript
await agent.execute({
  goal: `
    填写登录表单：
    1. 填写用户名：admin@example.com
    2. 填写密码：password123
    3. 勾选"记住我"
    4. 点击登录按钮
  `
});

// Agent会自动调用：
// fill → fill → check → click → waitForSelector
```

### 场景 2: 下拉菜单导航

```typescript
await agent.execute({
  goal: `
    从顶部菜单选择"产品 > 企业版 > 定价"
  `
});

// Agent会自动：
// hover(产品) → waitForSelector(子菜单) → click(企业版) → click(定价)
```

### 场景 3: 表格数据提取

```typescript
await agent.execute({
  goal: `
    提取销售数据表格，并存储为'salesData'
  `
});

// Agent会自动：
// 1. extractTable('table.sales')
// 2. valSet({ key: 'salesData', value: tableData })
// 3. 返回："已提取50行数据并存储为'salesData'"
```

### 场景 4: 批量链接采集

```typescript
await agent.execute({
  goal: `
    提取所有产品链接和价格
  `
});

// Agent会自动：
// 1. getTexts('.product-name') → 获取所有产品名
// 2. getTexts('.product-price') → 获取所有价格
// 3. valSet存储数据
```

### 场景 5: 复杂表单（下拉框+复选框）

```typescript
await agent.execute({
  goal: `
    填写注册表单：
    - 姓名：张三
    - 国家：中国
    - 兴趣爱好：编程、阅读（多选）
    - 同意条款
    - 提交
  `
});

// Agent会自动：
// fill(姓名) → selectOption(国家, '中国') → 
// selectOption(兴趣, ['编程','阅读']) → check(条款) → 
// press('Enter') 或 click(提交)
```

## 最佳实践

### 1. 数据提取优先级

```typescript
// ✅ 推荐顺序
1. getPageSummary()         // 了解页面结构（快速、结构化）
2. extractTable('.table')    // 表格数据自动解析
3. getTexts('.item')         // 批量提取多个元素
4. getText('.price')         // 单个精确值
5. getPageText()            // 纯文本（如果需要完整内容）

// ❌ 避免
getContent()                // 慢、截断至10K、难以解析
```

### 2. 表单填写工作流

```typescript
// 标准流程
waitForSelector → fill → selectOption → check → press('Enter')

// 复杂表单
for each field:
  waitForSelector(field) → 根据类型选择工具
```

### 3. 动态内容处理

```typescript
// 下拉菜单
hover('.menu') → waitForSelector('.submenu') → click('.item')

// 动态加载
click('.load-more') → waitForSelector('.new-content') → extract
```

### 4. 错误恢复策略

所有工具错误都包含：
- `errorType`: TIMEOUT | ELEMENT_NOT_FOUND | ELEMENT_NOT_VISIBLE | ...
- `suggestion`: 具体修复建议

```typescript
// 错误示例
{
  success: false,
  error: "Timeout 30000ms exceeded",
  errorType: "TIMEOUT",
  suggestion: "Try increasing timeout or use waitForSelector first"
}

// 恢复步骤
1. 查看errorType和suggestion
2. 使用screenshot或getPageSummary检查页面
3. 调整选择器或使用force: true
```

### 5. 超时设置优化

**默认超时时间：**
- **导航工具** (`navigate`, `goBack`, `reload`): 30秒
  - 网络请求可能较慢，保留较长超时
- **交互/等待工具** (`click`, `fill`, `select`, `check`, `hover`, `press`, `waitForSelector`): **10秒** ⚡
  - **优化理由**：避免长时间等待，提供更快的反馈
  - 可通过 `timeout` 参数自定义

```typescript
// 自定义超时示例
await agent.execute({
  goal: '点击加载较慢的按钮',
  context: {
    click: { selector: '.slow-btn', timeout: 20000 } // 自定义20秒
  }
});

// 快速失败，提前发现问题
await agent.execute({
  goal: '快速检查元素是否存在',
  context: {
    waitForSelector: { selector: '.target', timeout: 3000 } // 3秒快速检查
  }
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
