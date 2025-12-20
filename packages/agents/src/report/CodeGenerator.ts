/**
 * Code Generator
 * 
 * 负责生成完整的、可执行的 React 代码
 */

import { getAllComponentTemplates } from './components';

export interface ReportConfig {
  title: string;
  description?: string;
  components: ComponentConfig[];
}

export interface ComponentConfig {
  type: 'chart' | 'table' | 'card' | 'cardGrid' | 'timeline' | 'markdown';
  props: Record<string, any>;
  layout?: {
    width?: string;
    height?: string;
    className?: string;
  };
}

/**
 * 代码生成器类
 */
export class CodeGenerator {
  /**
   * 生成完整的 React 报告代码
   */
  static generateReport(config: ReportConfig): string {
    const { title, description, components } = config;

    // 安全检查：确保 components 是数组
    if (!Array.isArray(components)) {
      throw new Error(`components must be an array, got ${typeof components}`);
    }

    // 生成导入语句
    const imports = this.generateImports(components);

    // 生成组件模板
    const componentTemplates = getAllComponentTemplates();

    // 生成主报告组件
    const reportComponent = this.generateReportComponent(title, description, components);

    // 组合完整代码
    return `
${imports}

${componentTemplates}

${reportComponent}

// 渲染到 root
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Report />);
    `.trim();
  }

  /**
   * 生成导入语句
   */
  private static generateImports(components: ComponentConfig[]): string {
    // 安全检查：确保 components 是数组
    if (!Array.isArray(components)) {
      console.error('generateImports: components is not an array', { components, type: typeof components });
      components = [];
    }

    const imports = new Set<string>([
      "import React, { useState, useMemo } from 'react';",
      "import ReactDOM from 'react-dom/client';",
    ]);

    // 检查是否需要 recharts
    if (components.some(c => c.type === 'chart')) {
      imports.add("import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';");
    }

    // 检查是否需要 react-markdown
    if (components.some(c => c.type === 'markdown')) {
      imports.add("import ReactMarkdown from 'react-markdown';");
    }

    return Array.from(imports).join('\n');
  }

  /**
   * 生成主报告组件
   */
  private static generateReportComponent(
    title: string,
    description: string | undefined,
    components: ComponentConfig[]
  ): string {
    // 安全检查：确保 components 是数组
    if (!Array.isArray(components)) {
      console.error('generateReportComponent: components is not an array', { components, type: typeof components });
      components = [];
    }

    // 生成组件渲染代码
    const componentRenders = components.map((comp, idx) => {
      return this.generateComponentRender(comp, idx);
    }).join('\n\n');

    return `
function Report() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">${this.escapeString(title)}</h1>
          ${description ? `<p className="text-gray-600">${this.escapeString(description)}</p>` : ''}
        </div>

        {/* Content */}
        <div className="space-y-8">
          ${componentRenders}
        </div>
      </div>
    </div>
  );
}
    `.trim();
  }

  /**
   * 生成单个组件的渲染代码
   */
  private static generateComponentRender(comp: ComponentConfig, idx: number): string {
    const { type, props, layout } = comp;
    const { width = '100%', height = '400px', className = '' } = layout || {};

    // 安全地序列化 props
    const propsStr = this.serializeProps(props);

    let componentJSX = '';

    switch (type) {
      case 'chart':
        componentJSX = `<Chart {...${propsStr}} />`;
        break;
      case 'table':
        componentJSX = `<Table {...${propsStr}} />`;
        break;
      case 'card':
        componentJSX = `<Card {...${propsStr}} />`;
        break;
      case 'cardGrid':
        componentJSX = `<CardGrid {...${propsStr}} />`;
        break;
      case 'timeline':
        componentJSX = `<Timeline {...${propsStr}} />`;
        break;
      case 'markdown':
        componentJSX = `<Markdown {...${propsStr}} />`;
        break;
      default:
        componentJSX = `<div>Unknown component type: ${type}</div>`;
    }

    return `
          {/* Component ${idx + 1}: ${type} */}
          <div className="bg-white rounded-lg shadow p-6 ${className}" style={{ width: '${width}', minHeight: '${height}' }}>
            ${componentJSX}
          </div>
    `.trim();
  }

  /**
   * 序列化 props 为 JavaScript 对象字符串
   */
  private static serializeProps(props: Record<string, any>): string {
    try {
      // 使用 JSON.stringify 但处理特殊情况
      return JSON.stringify(props, null, 0);
    } catch (error) {
      console.error('Failed to serialize props:', error);
      return '{}';
    }
  }

  /**
   * 转义字符串（防止注入）
   */
  private static escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  /**
   * 验证生成的代码是否安全
   */
  static validateCode(code: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查危险模式
    const dangerousPatterns = [
      /eval\(/,
      /Function\(/,
      /document\.write/,
      /innerHTML\s*=/,
      /<script/i,
      /on\w+\s*=/i, // onclick, onload, etc.
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        errors.push(`Dangerous pattern detected: ${pattern}`);
      }
    }

    // 检查是否包含必要的导入
    if (!code.includes('import React')) {
      errors.push('Missing React import');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

