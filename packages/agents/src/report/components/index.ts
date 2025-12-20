/**
 * Report Component Templates
 * 
 * 这些模板作为字符串导出，会在运行时注入到 iframe 中
 */

import { ChartComponentTemplate } from './ChartComponent';
import { TableComponentTemplate } from './TableComponent';
import { CardComponentTemplate } from './CardComponent';
import { TimelineComponentTemplate } from './TimelineComponent';
import { MarkdownRendererTemplate } from './MarkdownRenderer';

export { ChartComponentTemplate, TableComponentTemplate, CardComponentTemplate, TimelineComponentTemplate, MarkdownRendererTemplate };

/**
 * 获取所有组件模板的完整代码
 */
export function getAllComponentTemplates(): string {
  return `
${ChartComponentTemplate}

${TableComponentTemplate}

${CardComponentTemplate}

${TimelineComponentTemplate}

${MarkdownRendererTemplate}
  `.trim();
}

