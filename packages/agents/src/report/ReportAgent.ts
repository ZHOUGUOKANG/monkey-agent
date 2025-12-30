/**
 * Report Agent
 * 
 * 从工作流上下文生成可视化报告（三阶段架构）
 * 
 * Phase 1: 数据总结（使用 ReactLoop）
 * Phase 2: React 代码生成（流式输出）
 * Phase 3: HTML 兜底（按需触发）
 */

import { BaseAgent, BaseAgentConfig, ReactLoop } from '@monkey-agent/base';
import type { ILLMClient, AgentContext, AgentExecutionResult } from '@monkey-agent/types';
import { createContextTools } from '@monkey-agent/context';
import { tool } from 'ai';
import { z } from 'zod';

/**
 * Report Agent 配置
 */
export interface ReportAgentConfig {
  /** Agent ID */
  id?: string;
  /** Agent 名称 */
  name?: string;
  /** Agent 描述 */
  description?: string;
  /** Agent 能力列表 */
  capabilities?: string[];
  /** 最大迭代次数 */
  maxIterations?: number;
  /** 上下文压缩配置 */
  contextCompression?: BaseAgentConfig['contextCompression'];
  /** 流式文本回调 */
  onStreamChunk?: (chunk: string) => void;
  /** LLM 客户端（必需） */
  llmClient: ILLMClient;
}

/**
 * Report Agent（三阶段架构）
 * 
 * Phase 1: 数据总结
 *   - 使用 ReactLoop 进行真正的 ReAct 循环
 *   - 智能地理解和总结 context 中的数据
 *   - 输出文本形式的数据总结和报告规划
 * 
 * Phase 2: React 代码生成
 *   - 基于 Phase 1 的总结
 *   - 流式生成 React 可视化代码
 * 
 * Phase 3: HTML 兜底
 *   - 前端渲染失败时触发
 *   - 生成纯 HTML 版本
 */
export class ReportAgent extends BaseAgent {
  private savedDataSummary?: string;  // 保存 Phase 1 的数据总结

  constructor(config: ReportAgentConfig) {
    super({
      id: config.id || 'report-agent',
      name: config.name || 'Report Agent',
      description:
        config.description ||
        '报告生成 Agent，从工作流数据生成可视化报告',
      capabilities: config.capabilities || [
        'data-extraction',
        'data-visualization',
        'report-generation',
        'react-code-generation',
        'html-fallback',
      ],
      llmClient: config.llmClient,
      systemPrompt: '', // 动态生成
      maxIterations: config.maxIterations ?? 10, // 允许多次工具调用来查询数据
      contextCompression: config.contextCompression,
      enableStreaming: false, // Phase 1 不需要流式
      onStreamChunk: config.onStreamChunk,
    });
  }

  /**
   * 定义工具
   * @deprecated 不再使用，保留用于向后兼容
   */
  public getToolDefinitions() {
    return {
      confirmDataReady: tool({
        description: 'Call this when you have collected all necessary data for report generation',
        inputSchema: z.object({
          dataKeys: z.array(z.string()).describe('List of variable keys that were collected'),
          dataSummary: z.string().describe('Brief summary of the collected data')
        }),
      }),
    };
  }

  /**
   * 执行工具调用
   * @deprecated 不再使用，保留用于向后兼容
   */
  protected async executeToolCall(toolName: string, input: any): Promise<any> {
    switch (toolName) {
      case 'confirmDataReady':
        // 保存收集到的数据键（已废弃，仅保留接口兼容性）
        return {
          success: true,
          message: 'Data collection confirmed. Ready to generate report.',
          dataKeys: input.dataKeys,
          dataSummary: input.dataSummary
        };
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * 执行报告生成（三阶段架构）
   * 
   * Phase 1: 数据总结（ReactLoop）
   * Phase 2: React 代码生成（流式）
   * Phase 3: HTML 兜底（按需）
   */
  async execute(
    task?: string,
    context?: AgentContext,
    options?: any
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();

    try {
      // ========== 诊断：检查 context 状态 ==========
      console.log('🔍 [ReportAgent] Context 诊断:', {
        hasContext: !!context,
        hasVals: !!context?.vals,
        valsSize: context?.vals?.size || 0,
        valsKeys: context?.vals ? Array.from(context.vals.keys()) : [],
        taskReceived: task || '(无 task)'
      });
      
      // ========== Phase 1: 数据总结（使用 ReactLoop）==========
      this.emit('agent:stream-text', {
        agentId: this.id,
        textDelta: '📊 阶段 1/2: 开始智能数据总结...\n\n',
        iteration: 1,
        timestamp: Date.now(),
      });
      
      // 获取前置 Agent 的 summary（如果有）
      const upstreamSummary = this.getUpstreamSummary(context, options);
      
      // 创建 ReactLoop 实例
      const reactLoop = new ReactLoop();
      
      // 转发 ReactLoop 的事件到 Agent 事件系统
      reactLoop.on('react:thinking', (data) => {
        this.emit('agent:thinking', {
          agentId: this.id,
          ...data
        });
      });
      
      reactLoop.on('react:action', (data) => {
        this.emit('agent:tool-call', {
          agentId: this.id,
          toolName: data.toolName,
          input: data.input,
          timestamp: data.timestamp,
        });
        
        // 流式显示工具调用
        this.emit('agent:stream-text', {
          agentId: this.id,
          textDelta: `  🔧 调用工具: ${data.toolName}\n`,
          iteration: data.iteration,
          timestamp: Date.now(),
        });
      });
      
      reactLoop.on('react:observation', (data) => {
        this.emit('agent:tool-result', {
          agentId: this.id,
          toolName: data.toolName,
          result: data.result,
          timestamp: data.timestamp,
        });
        
        // 流式显示工具结果摘要
        const resultPreview = typeof data.result === 'object' 
          ? `${Object.keys(data.result).length} 个字段`
          : String(data.result).substring(0, 50);
              this.emit('agent:stream-text', {
                agentId: this.id,
          textDelta: `  ✓ 结果: ${resultPreview}\n`,
          iteration: data.iteration,
                timestamp: Date.now(),
              });
      });
      
      reactLoop.on('react:stream-text', (data) => {
        // 转发思考过程的文本流（忽略 chunk 参数）
        this.emit('agent:stream-text', {
          agentId: this.id,
          textDelta: data.textDelta,
          iteration: data.iteration,
          timestamp: data.timestamp,
        });
      });
      
      // 执行数据总结 ReactLoop
      const dataSummaryResult = await reactLoop.run({
        systemPrompt: this.buildDataSummarySystemPrompt(task, upstreamSummary),
        userMessage: '请智能地收集和总结 context 中的数据，为生成报告做准备。',
        tools: createContextTools(context!),
        toolExecutor: async (toolName: string, input: any) => {
          if (toolName === 'valList') {
            const keys = Array.from(context?.vals?.keys() || []);
            console.log('📋 [ReportAgent] ReactLoop valList 返回:', keys);
            return keys;
          } else if (toolName === 'valGet') {
            const value = context?.vals?.get(input.key);
            console.log(`📦 [ReportAgent] ReactLoop valGet('${input.key}'):`, {
              hasValue: value !== undefined,
              valueType: typeof value,
            });
            return value;
          }
          throw new Error(`Unknown tool: ${toolName}`);
        },
        llmClient: this.llm,
        contextManager: this.contextManager,
        maxIterations: this.maxIterations,
        enableStreaming: true,  // 启用流式输出思考过程
        onStreamChunk: (_chunk: string) => {
          // ReactLoop 的流式文本已通过事件转发，这里不需要处理
        },
      });
      
      this.emit('agent:stream-text', {
        agentId: this.id,
        textDelta: '\n✅ 数据总结完成\n\n',
        iteration: 1,
        timestamp: Date.now(),
      });
      
      // 保存数据总结供 HTML 兜底使用
      this.savedDataSummary = dataSummaryResult.summary;
      
      console.log('📊 [ReportAgent] 数据总结结果:', {
        summaryLength: dataSummaryResult.summary?.length || 0,
        summaryPreview: dataSummaryResult.summary?.substring(0, 200) + '...',
        finishReason: dataSummaryResult.finishReason,
      });
      
      // 检查是否成功总结数据
      if (!dataSummaryResult.summary || 
          dataSummaryResult.summary.includes('没有数据') ||
          dataSummaryResult.summary.includes('no data')) {
        const errorMessage = '⚠️ 数据总结失败：未能从 context 中获取有效数据';
      
      this.emit('agent:stream-text', {
        agentId: this.id,
          textDelta: `\n${errorMessage}\n`,
        iteration: 1,
        timestamp: Date.now(),
      });
      
        console.warn('⚠️ [ReportAgent] 数据总结失败');
        
        return {
          agentId: this.id,
          status: 'failed',
          data: {
            error: 'NO_DATA_SUMMARIZED',
            message: errorMessage
          },
          summary: '数据总结失败：未能从 context 中获取有效数据',
          duration: Date.now() - startTime,
        };
      }
      
      // ========== Phase 2: React 代码生成（流式输出）==========
      this.emit('agent:stream-text', {
        agentId: this.id,
        textDelta: '🎨 阶段 2/2: 生成可视化报告代码...\n\n',
        iteration: 1,
        timestamp: Date.now(),
      });
      
      // 发出 tool-call 事件（代码生成）
      this.emit('agent:tool-call', {
        agentId: this.id,
        toolName: 'generateReactCode',
        timestamp: Date.now(),
      });
      
      // 构建代码生成 prompt（基于 Phase 1 的数据总结）
      const codeGenPrompt = this.buildCodeGenerationPrompt(task, dataSummaryResult.summary);
      
      // 流式生成代码
      let fullCode = '';
      const artifactId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const streamResult = this.llm.stream([
        { role: 'user', content: '请基于数据总结生成 React 可视化代码' }
      ], {
        system: codeGenPrompt,
      });
      
      // 处理流式输出
      for await (const chunk of streamResult.textStream) {
        fullCode += chunk;
        
        this.emit('agent:stream-text', {
          agentId: this.id,
          textDelta: chunk,
          iteration: 1,
          timestamp: Date.now(),
        });
        
        if (options?.onStreamChunk) {
          options.onStreamChunk(chunk);
        }
      }
      
      // 发出 stream-finish 事件
      this.emit('agent:stream-finish', {
        agentId: this.id,
        finishReason: 'stop',
        iteration: 1,
        timestamp: Date.now(),
      });
      
      // 发出 tool-result 事件（代码生成结果）
      this.emit('agent:tool-result', {
        agentId: this.id,
        toolName: 'generateReactCode',
        result: `Generated ${fullCode.length} characters of React code`,
        timestamp: Date.now(),
      });
      
      // 清理代码中的 markdown 标记
      let cleanedCode = fullCode;
      // 移除开头的 ```javascript 或 ```jsx 或 ```
      cleanedCode = cleanedCode.replace(/^```(?:javascript|jsx|js|react|typescript|tsx)?\s*\n?/i, '');
      // 移除结尾的 ```
      cleanedCode = cleanedCode.replace(/\n?```\s*$/g, '');
      
      // 返回 artifact
      const artifact = {
        id: artifactId,
        type: 'react',
        title: this.extractTitleFromTask(task),
        description: '基于工作流数据生成的可视化报告',
        code: cleanedCode,
        createdAt: Date.now(),
      };
      
      return {
        agentId: this.id,
        status: 'success',
        data: {
          __final_result__: true,
          type: 'artifact',
          artifact,
        },
        summary: dataSummaryResult.summary,  // 使用 Phase 1 的智能总结作为 summary
        duration: Date.now() - startTime,
      };

    } catch (error: any) {
      // 发出错误事件
      this.emit('agent:tool-error', {
        agentId: this.id,
        toolName: 'generateReactCode',
        error: error.message,
        timestamp: Date.now(),
      });

      return {
        agentId: this.id,
        status: 'failed',
        data: {},
        summary: `Failed to generate report: ${error.message}`,
        error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 生成 HTML 降级版本
   * 当 React 代码编译失败时调用
   */
  async generateHtmlFallback(
    reactError: string,
    onStreamChunk?: (chunk: string) => void
  ): Promise<{ artifact: any }> {
    if (!this.savedDataSummary) {
      throw new Error('No data summary available for fallback');
    }

    // 构建 HTML 专用 prompt（基于数据总结）
    const systemPrompt = this.buildHtmlSystemPrompt(this.savedDataSummary, reactError);
    const userMessage = `Generate a pure HTML report with inline CSS and JavaScript. 
Use vanilla JavaScript for any interactivity.`;

    // 流式生成 HTML 代码
    let fullHtml = '';
    const streamResult = this.llm.stream([
      { role: 'user', content: userMessage }
    ], {
      system: systemPrompt,
    });

    for await (const chunk of streamResult.textStream) {
      fullHtml += chunk;
      onStreamChunk?.(chunk);
    }

    // 清理 HTML 代码中的 markdown 标记
    let cleanedHtml = fullHtml;
    // 移除开头的 ```html 或 ```
    cleanedHtml = cleanedHtml.replace(/^```(?:html)?\s*\n?/i, '');
    // 移除结尾的 ```
    cleanedHtml = cleanedHtml.replace(/\n?```\s*$/g, '');

    return {
      artifact: {
        id: `html-report-${Date.now()}`,
        type: 'html',
        title: '数据报告 (HTML)',
        code: cleanedHtml,
        createdAt: Date.now(),
      }
    };
  }

  /**
   * 获取前置 Agent 的 summary
   */
  private getUpstreamSummary(context?: AgentContext, options?: any): string | undefined {
    // 从 options 中获取 agentNode 信息
    const agentNode = options?.agentNode;
    if (!agentNode || !agentNode.dependencies || agentNode.dependencies.length === 0) {
      return undefined;
    }
    
    // 获取第一个依赖节点的输出
    const upstreamNodeId = agentNode.dependencies[0];
    const upstreamOutput = context?.getOutput(upstreamNodeId);
    
    return upstreamOutput?.summary;
  }

  /**
   * Phase 1: 数据总结阶段的 system prompt
   */
  private buildDataSummarySystemPrompt(task?: string, upstreamSummary?: string): string {
    return `你是一个智能数据分析助手，负责理解和总结工作流 context 中的数据。

## 原始任务

${task || 'Generate a comprehensive data report'}

${upstreamSummary ? `## 前置 Agent 的总结

${upstreamSummary}

` : ''}## 你的任务

1. **理解上下文**：基于原始任务和前置 Agent 的总结，理解用户想要什么样的报告
2. **收集数据**：使用 valList 和 valGet 工具从 context 中获取相关数据
3. **智能分析**：分析数据的内容、结构和特点
4. **总结规划**：生成一份详细的数据总结，包括：
   - 数据的关键信息和亮点
   - 每个数据的类型和内容摘要
   - 建议的可视化方式（图表类型、表格、卡片等）
   - 报告的结构和章节规划
   - 如何最好地呈现这些数据

## 可用工具

- **valList()**: 返回 context 中所有可用的数据键（变量名）
- **valGet(key)**: 获取指定键的数据值

## 工作流程

1. 先调用 valList() 查看有哪些数据
2. 对每个相关的数据键调用 valGet(key) 获取数据
3. 分析数据内容
4. 生成详细的总结和规划

## 输出格式

请以自然语言生成一份详细的数据总结，包括：

### 数据概况
- 找到了哪些数据
- 数据的整体特点

### 详细分析
对每个数据：
- 数据名称和类型
- 关键内容摘要
- 建议的可视化方式
- 为什么这样呈现

### 报告结构规划
- 第一部分：xxx（使用 xxx 图表）
- 第二部分：xxx（使用 xxx 表格）
- ...

请使用 ReAct 模式：先思考 → 行动（调用工具）→ 观察结果 → 继续思考...

开始吧！`;
  }

  /**
   * Phase 2: 代码生成阶段的 system prompt
   */
  private buildCodeGenerationPrompt(task?: string, dataSummary?: string): string {
    return `你是一个 React 数据可视化专家，负责基于数据总结生成可视化报告代码。

## 原始任务

${task || 'Generate a comprehensive data report'}

## 数据总结和报告规划

${dataSummary || 'No data summary provided'}

## 你的任务

基于上述数据总结和规划，生成一个完整的 React 可视化报告。

## 代码要求

### 1. 结构规范
- 以 "import React from 'react';" 开头（不要使用 markdown 代码块）
- 定义必要的组件（Card, Chart, Table 等）
- 创建主 Report 组件
- 以 "root.render(<Report />);" 结尾

### 2. 数据处理
- 数据已在 context 中，LLM 在数据总结阶段已经看到了数据
- 在代码中定义 const REPORT_DATA = { ... }，包含真实数据
- 不要使用硬编码的示例数据

### 3. 可视化组件
根据数据总结中的建议，使用合适的可视化方式：
- 数字指标：使用 Card 组件展示
- 时间序列数据：使用 LineChart
- 分类数据：使用 BarChart 或 PieChart
- 结构化数据：使用 Table
- 文本内容：使用 Markdown 渲染

### 4. 可用的库
- React (18): 通过 UMD 加载
- Recharts (2): LineChart, BarChart, PieChart, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
- Tailwind CSS: 用于样式

### 5. 代码风格
- 使用 Tailwind 的实用类进行样式设置
- 创建可复用的组件
- 保持代码简洁和可读性
- 添加适当的标题和说明

## 示例结构

\`\`\`javascript
import React from 'react';
const { useState, useMemo } = React;
const { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = Recharts;

// 真实数据
const REPORT_DATA = {
  // ... 基于数据总结的真实数据
};

// 组件定义
const Card = ({ title, children }) => (
  <div className="bg-white rounded-lg shadow-md p-6">
    <h3 className="text-xl font-bold mb-4">{title}</h3>
    {children}
  </div>
);

// 主报告组件
const Report = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">数据报告</h1>
        
        {/* 根据数据总结生成相应的可视化 */}
        <Card title="...">
          {/* 图表或表格 */}
        </Card>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(<Report />);
\`\`\`

## 重要提示

- 只输出 JavaScript 代码，不要包含任何 markdown 标记
- 确保代码可以直接在浏览器中运行
- 基于数据总结中的规划生成报告结构
- 使用真实数据，不要编造数据

现在开始生成代码！`;
  }

  /**
   * 从任务中提取标题
   */
  private extractTitleFromTask(task?: string): string {
    if (!task) {
      return '数据报告';
    }
    // 简单提取，可以后续优化
    return task.length > 50 ? task.substring(0, 50) + '...' : task;
  }

  /**
   * 构建 HTML 降级 prompt
   */
  private buildHtmlSystemPrompt(dataSummary: string, reactError: string): string {
    return `你是一个 HTML/JavaScript 专家，负责生成纯 HTML 的数据可视化报告。

## 背景

React 版本编译失败：
\`\`\`
${reactError}
\`\`\`

需要生成一个纯 HTML 的降级版本。

## 数据总结

${dataSummary}

## 你的任务

基于数据总结，生成一个完整的、可独立运行的 HTML 文档。

## 要求

1. 完整的 HTML 文档（包含 <!DOCTYPE html>）
2. 使用 Tailwind CSS CDN 进行样式设置
3. 使用纯 JavaScript（不要用 React）
4. 可选：使用 Chart.js CDN 创建图表
5. 确保代码简单、可靠、易于调试
6. 在 <script> 标签中定义数据：const REPORT_DATA = { ... };
7. 使用 REPORT_DATA 生成可视化

## 结构

\`\`\`html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>数据报告</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
</head>
<body class="bg-gray-50">
  <div id="root" class="min-h-screen p-8">
    <!-- 内容将通过 JavaScript 生成 -->
  </div>
  
  <script>
    // 数据
    const REPORT_DATA = {
      // ... 真实数据
    };
    
    // 生成报告
    function generateReport() {
      // ... 创建 DOM 元素
    }
    
    // 初始化
    generateReport();
  </script>
</body>
</html>
\`\`\`

## 重要

- 保持简单可靠
- 使用表格展示数据（如果图表太复杂）
- 添加错误处理
- 确保跨浏览器兼容
- 直接输出 HTML 代码，不要包含 markdown 标记

现在开始生成 HTML！`;
  }

}

