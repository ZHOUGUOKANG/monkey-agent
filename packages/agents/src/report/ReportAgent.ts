/**
 * Report Agent
 * 
 * 从工作流上下文生成可视化报告（流式输出版本）
 */

import { BaseAgent, BaseAgentConfig } from '@monkey-agent/base';
import type { ILLMClient, AgentContext, AgentExecutionResult } from '@monkey-agent/types';
import { CodeGenerator } from './CodeGenerator';
import { buildStreamingSystemPrompt } from './prompts/system';

/**
 * Report Agent 配置
 */
export interface ReportAgentConfig extends Partial<BaseAgentConfig> {
  /** LLM 客户端（必需） */
  llmClient: ILLMClient;
}

/**
 * 数据分析结果
 */
interface DataAnalysis {
  dataKeys: string[];
  extractedData: Record<string, any>;
  recommendations: Array<{
    dataKey: string;
    dataType: string;
    suggestedComponents: string[];
    reason: string;
    sampleData?: any;
  }>;
}

/**
 * Report Agent（流式版本）
 * 
 * 核心能力：
 * 1. 从上游 Agent 的 summary 中提取数据变量 key
 * 2. 从 context.vals 读取实际数据
 * 3. 分析数据结构
 * 4. 流式生成 React 报告代码
 * 5. 编译失败时支持 HTML 降级
 */
export class ReportAgent extends BaseAgent {
  private savedDataAnalysis?: DataAnalysis;

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
      maxIterations: config.maxIterations ?? 1, // 不需要迭代，直接流式输出
      contextCompression: config.contextCompression,
      enableStreaming: true, // 强制启用流式
      onStreamChunk: config.onStreamChunk,
    });
  }

  /**
   * 覆盖 execute 方法，实现流式生成逻辑
   */
  async execute(
    task?: string,
    context?: AgentContext,
    options?: any
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();

    try {
      // 简化数据提取：直接从 context.vals 读取所有共享变量
      // 不再依赖复杂的 summary 解析和 outputs 提取
      const extractedData = this.extractDataFromContextVals(context);
      
      // 即使没有数据，也继续生成报告（生成一个空状态的报告）
      // 这样用户可以看到一个友好的"无数据"提示界面

      // 分析数据结构
      const dataAnalysis = this.analyzeExtractedData(extractedData);
      
      // 保存数据分析结果，供 HTML 降级使用
      this.savedDataAnalysis = dataAnalysis;

      // 构建流式生成 prompt
      const systemPrompt = buildStreamingSystemPrompt(dataAnalysis);
      const userMessage = this.buildStreamingUserMessage(task || 'Generate a comprehensive data report', dataAnalysis);

      // 流式生成 React 代码
      let fullCode = '';
      const artifactId = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const streamResult = this.llm.stream([
        { role: 'user', content: userMessage }
      ], {
        system: systemPrompt,
        temperature: 0.7,
      });

      // 处理流式输出
      for await (const chunk of streamResult.textStream) {
        fullCode += chunk;
        // 发送到前端（通过 options 传入的回调）
        if (options?.onStreamChunk) {
          options.onStreamChunk(chunk);
        }
      }

      // 返回 artifact
      const artifact = {
        id: artifactId,
        type: 'react',
        title: this.extractTitleFromTask(task),
        description: `基于工作流数据生成的可视化报告`,
        code: fullCode,
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
        summary: `Generated interactive report with ${dataAnalysis.recommendations.length} visualizations from ${Object.keys(extractedData).length} data sources`,
        duration: Date.now() - startTime,
      };

    } catch (error: any) {
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
    if (!this.savedDataAnalysis) {
      throw new Error('No data analysis available for fallback');
    }

    // 构建 HTML 专用 prompt
    const systemPrompt = this.buildHtmlSystemPrompt(this.savedDataAnalysis, reactError);
    const userMessage = `Generate a pure HTML report with inline CSS and JavaScript. 
Use vanilla JavaScript for any interactivity. 
Data: ${JSON.stringify(this.savedDataAnalysis.extractedData, null, 2)}`;

    // 流式生成 HTML 代码
    let fullHtml = '';
    const streamResult = this.llm.stream([
      { role: 'user', content: userMessage }
    ], {
      system: systemPrompt,
      temperature: 0.5,
    });

    for await (const chunk of streamResult.textStream) {
      fullHtml += chunk;
      onStreamChunk?.(chunk);
    }

    return {
      artifact: {
        id: `html-report-${Date.now()}`,
        type: 'html',
        title: '数据报告 (HTML)',
        code: fullHtml,
        createdAt: Date.now(),
      }
    };
  }

  /**
   * 直接从 context.vals 提取所有共享变量数据
   * 简化版本：不再依赖 summary 解析
   */
  private extractDataFromContextVals(context: AgentContext | undefined): Record<string, any> {
    const extractedData: Record<string, any> = {};

    if (!context?.vals) {
      return extractedData;
    }

    // 提取所有共享变量
    for (const [key, value] of context.vals.entries()) {
      extractedData[key] = value;
    }

    return extractedData;
  }

  /**
   * 分析提取的数据
   */
  private analyzeExtractedData(data: Record<string, any>): DataAnalysis {
    const dataKeys = Object.keys(data);
    const recommendations = [];

    for (const [key, value] of Object.entries(data)) {
      const analysis = this.analyzeDataType(key, value);
      recommendations.push(analysis);
    }

    return {
      dataKeys,
      extractedData: data,
      recommendations,
    };
  }

  /**
   * 构建流式生成的用户消息
   */
  private buildStreamingUserMessage(task: string, dataAnalysis: DataAnalysis): string {
    return `${task}

Available Data:
${JSON.stringify(dataAnalysis.extractedData, null, 2)}

Data Analysis:
${dataAnalysis.recommendations.map(r => `- ${r.dataKey}: ${r.dataType} → ${r.suggestedComponents.join(', ')}`).join('\n')}

Generate a complete React report code following these rules:
1. Start directly with "import React..." (NO markdown code blocks, NO JSON)
2. Include ALL component definitions (Chart, Table, Card, Timeline, Markdown)
3. Create a Report function that uses these components
4. Embed the data shown above
5. End with "root.render(<Report />);"
6. Output ONLY JavaScript code, nothing else

Begin generating the code now:`;
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
  private buildHtmlSystemPrompt(dataAnalysis: DataAnalysis, reactError: string): string {
    return `You are generating a fallback HTML report because the React version failed to compile.

React Error: ${reactError}

Your task:
1. Generate a complete, self-contained HTML document
2. Use inline CSS (with Tailwind CDN) for styling
3. Use vanilla JavaScript for any interactivity (no frameworks)
4. Include simple charts using Chart.js CDN
5. Make it responsive and visually appealing
6. Ensure the code is valid and will render without errors

Structure:
- <!DOCTYPE html> declaration
- Complete <head> with CDN links (Tailwind, Chart.js)
- <body> with embedded data and rendering logic
- Inline <script> tags for data visualization

Data Analysis:
${dataAnalysis.recommendations.map(r => `- ${r.dataKey}: ${r.dataType} → ${r.suggestedComponents.join(', ')}`).join('\n')}

Guidelines:
- Keep it simple and reliable
- Use tables instead of complex chart libraries if needed
- Ensure cross-browser compatibility
- Add error handling for all JavaScript code

Output the complete HTML code directly, without any markdown formatting.`;
  }

  /**
   * 生成数据摘要
   */
  private generateDataSummary(data: Record<string, any>): string {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return 'No data found in workflow context';
    }

    const summaryParts = keys.map(key => {
      const value = data[key];
      const type = Array.isArray(value) ? `array[${value.length}]` : typeof value;
      return `${key}: ${type}`;
    });

    return `Found ${keys.length} data entries: ${summaryParts.join(', ')}`;
  }

  /**
   * 分析数据类型
   */
  private analyzeDataType(key: string, value: any): {
    dataKey: string;
    dataType: string;
    suggestedComponents: string[];
    reason: string;
    sampleData?: any;
  } {
    // 数组数据
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return {
          dataKey: key,
          dataType: 'empty array',
          suggestedComponents: ['markdown'],
          reason: 'Empty array, use markdown to display a message',
        };
      }

      const firstItem = value[0];

      // 对象数组 - 可能是表格或图表数据
      if (typeof firstItem === 'object' && firstItem !== null) {
        const keys = Object.keys(firstItem);
        const hasTimeKey = keys.some(k => /time|date|month|day|year/i.test(k));
        const hasNumericKey = keys.some(k => {
          const val = firstItem[k];
          return typeof val === 'number';
        });

        if (hasTimeKey && hasNumericKey) {
          return {
            dataKey: key,
            dataType: 'time series data',
            suggestedComponents: ['chart (line)', 'table'],
            reason: 'Contains time-based keys and numeric values, suitable for line charts',
            sampleData: value.slice(0, 3),
          };
        }

        if (hasNumericKey) {
          return {
            dataKey: key,
            dataType: 'structured data with numbers',
            suggestedComponents: ['chart (bar)', 'table', 'cardGrid'],
            reason: 'Contains numeric values, can be visualized as bar chart or table',
            sampleData: value.slice(0, 3),
          };
        }

        return {
          dataKey: key,
          dataType: 'structured data',
          suggestedComponents: ['table', 'timeline'],
          reason: 'Structured object array, best displayed in a table',
          sampleData: value.slice(0, 3),
        };
      }

      // 原始值数组
      return {
        dataKey: key,
        dataType: 'simple array',
        suggestedComponents: ['markdown', 'table'],
        reason: 'Simple value array, can be displayed as list or simple table',
        sampleData: value.slice(0, 5),
      };
    }

    // 对象数据
    if (typeof value === 'object' && value !== null) {
      const keys = Object.keys(value);
      const numericKeys = keys.filter(k => typeof value[k] === 'number');

      if (numericKeys.length >= 3) {
        return {
          dataKey: key,
          dataType: 'metrics object',
          suggestedComponents: ['cardGrid', 'chart (pie)'],
          reason: 'Object with multiple numeric values, suitable for metric cards',
          sampleData: value,
        };
      }

      return {
        dataKey: key,
        dataType: 'object',
        suggestedComponents: ['card', 'markdown'],
        reason: 'Single object, display as card or formatted text',
        sampleData: value,
      };
    }

    // 原始值
    if (typeof value === 'number') {
      return {
        dataKey: key,
        dataType: 'number',
        suggestedComponents: ['card'],
        reason: 'Single numeric value, display as metric card',
        sampleData: value,
      };
    }

    if (typeof value === 'string') {
      // 长文本
      if (value.length > 100) {
        return {
          dataKey: key,
          dataType: 'long text',
          suggestedComponents: ['markdown'],
          reason: 'Long text content, best rendered as markdown',
          sampleData: value.substring(0, 100) + '...',
        };
      }

      return {
        dataKey: key,
        dataType: 'short text',
        suggestedComponents: ['card', 'markdown'],
        reason: 'Short text, display as card or inline text',
        sampleData: value,
      };
    }

    // 其他类型
    return {
      dataKey: key,
      dataType: typeof value,
      suggestedComponents: ['markdown'],
      reason: 'Generic data type, display as formatted text',
      sampleData: String(value),
    };
  }
}

