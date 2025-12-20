# Report Agent

Report Agent 负责从工作流上下文中提取数据，并生成美观的、交互式的 React 报告。

## 功能特性

- 📊 **多种可视化组件**: 图表、表格、卡片、时间轴、Markdown
- 🎨 **现代化设计**: 使用 Tailwind CSS 和 Recharts
- 🔒 **安全沙箱**: 代码在 iframe 中隔离运行
- ✏️ **可编辑**: 支持实时编辑和预览
- 💾 **持久化**: 自动保存到 localStorage

## 工作流集成

WorkflowGenerator 会在需要生成报告时，自动在工作流末尾添加 `report-agent` 节点：

```typescript
{
  id: 'report-node',
  type: 'report-agent',
  name: 'Generate Report',
  desc: 'Generate visual report from workflow results',
  dependencies: ['data-collection-node', 'analysis-node'], // 依赖所有数据节点
  steps: [
    { stepNumber: 1, desc: 'Extract data from workflow context' },
    { stepNumber: 2, desc: 'Analyze data structure and visualization needs' },
    { stepNumber: 3, desc: 'Generate React report code' }
  ]
}
```

## 工具定义

### 1. extractWorkflowData
从工作流上下文中提取数据。

**输入:**
```typescript
{
  keys?: string[];  // 可选，指定要提取的键
}
```

**输出:**
```typescript
{
  data: Record<string, any>;  // 提取的数据
  summary: string;             // 数据摘要
}
```

### 2. analyzeDataStructure
分析数据结构，推荐合适的可视化方式。

**输入:**
```typescript
{
  data: Record<string, any>;  // 要分析的数据
}
```

**输出:**
```typescript
{
  recommendations: Array<{
    dataKey: string;
    suggestedComponents: string[];
    reason: string;
  }>;
}
```

### 3. generateReport
生成最终的 React 报告代码。

**输入:**
```typescript
{
  title: string;
  description?: string;
  components: Array<{
    type: 'chart' | 'table' | 'card' | 'cardGrid' | 'timeline' | 'markdown';
    props: Record<string, any>;
    layout?: {
      width?: string;
      height?: string;
      className?: string;
    };
  }>;
}
```

**输出:**
```typescript
{
  code: string;      // 完整的 React 代码
  artifactId: string; // Artifact ID
}
```

## 预定义组件

### Chart
图表组件（线图、柱状图、饼图）

```typescript
<Chart 
  type="line"
  data={[{ month: 'Jan', value: 100 }, ...]}
  xKey="month"
  yKey="value"
  title="Monthly Trend"
/>
```

### Table
表格组件（支持排序、分页）

```typescript
<Table
  data={[{ id: 1, name: 'Item 1' }, ...]}
  columns={[
    { key: 'id', title: 'ID' },
    { key: 'name', title: 'Name' }
  ]}
  pageSize={10}
/>
```

### Card / CardGrid
指标卡片

```typescript
<CardGrid
  cards={[
    { title: 'Total', value: '1,234', color: 'blue', icon: '📊' },
    { title: 'Growth', value: '+12%', color: 'green', icon: '📈' }
  ]}
  columns={3}
/>
```

### Timeline
时间轴

```typescript
<Timeline
  items={[
    { title: 'Step 1', description: 'Completed', status: 'completed' },
    { title: 'Step 2', description: 'In progress', status: 'active' }
  ]}
/>
```

### Markdown
富文本内容

```typescript
<Markdown content="# Title\n\nContent here..." />
```

## 使用示例

```typescript
import { ReportAgent } from '@monkey-agent/agents';

const reportAgent = new ReportAgent({
  llmClient: myLLMClient,
});

// 在工作流中执行
const result = await reportAgent.execute(
  'Generate report from workflow data',
  workflowContext
);

// result.data 包含生成的报告代码
```

## 安全性

- ✅ 代码在 iframe 沙箱中运行
- ✅ 仅允许预定义的组件和 API
- ✅ 自动过滤危险模式（eval、innerHTML 等）
- ✅ CSP 策略防止 XSS 攻击

