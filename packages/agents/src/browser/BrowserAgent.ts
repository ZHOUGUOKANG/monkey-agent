import { BaseAgent } from '@monkey-agent/base';
import { tool } from 'ai';
import { z } from 'zod';
import type { Browser, Page } from 'playwright';
import type { ILLMClient } from '@monkey-agent/types';

/**
 * Browser Agent 配置
 */
export interface BrowserAgentConfig {
  llmClient: ILLMClient;
  browser: Browser;
  page: Page;
  id?: string;
  name?: string;
  description?: string;
}

/**
 * Browser Agent
 * 
 * 使用 Playwright API 操作浏览器，替代 Chrome Extension APIs
 * 
 * 核心能力：
 * - 页面导航
 * - 元素操作（点击、填写）
 * - 内容提取
 * - 截图
 * - 等待元素
 */
export class BrowserAgent extends BaseAgent {
  private page: Page;
  private readonly DEFAULT_TIMEOUT = 10000; // 默认10秒，更合理
  private readonly NAVIGATION_TIMEOUT = 30000; // 导航操作保持30秒

  constructor(config: BrowserAgentConfig) {
    super({
      id: config.id || 'browser-agent',
      name: config.name || 'Browser Agent',
      description: config.description || 'Playwright 浏览器自动化 Agent，负责页面导航、元素操作、表单填写和数据提取',
      capabilities: [
        'navigate', 'go-back', 'reload', // 导航
        'click', 'fill', 'select', 'check', 'hover', 'press', // 交互
        'screenshot', 'extract', 'extract-table', 'extract-list', 'wait' // 提取与等待
      ],
      llmClient: config.llmClient,
      maxIterations: 30,
      systemPrompt: `You are a browser automation expert using Playwright with 18 powerful tools.

## 🎯 Tool Categories

### 📍 Navigation (3 tools)
- **navigate**: Go to URL
- **goBack**: Browser back button  
- **reload**: Refresh page (supports hard reload)

### 🖱️ Interaction (6 tools)
- **click**: Click elements (supports double-click, right-click, force click)
- **fill**: Fill input fields
- **selectOption**: Select dropdown options (single/multiple)
- **check**: Check/uncheck checkboxes and radio buttons
- **hover**: Trigger hover effects, dropdowns, tooltips
- **press**: Press keyboard keys (Enter, Escape, Tab, arrows, etc.)

### 📊 Data Extraction (7 tools)
**Best Practices - Use in this order:**
1. **getPageSummary** - Fast structured overview (title, headings, stats)
2. **getPageText** - Clean text only (no HTML, efficient)
3. **getText** - Single element text
4. **getTexts** - Multiple elements (returns array)
5. **extractTable** - Table → JSON array with headers
6. **extractList** - List items → array
7. **getAttribute** - Get href, src, data-* attributes
8. ⚠️ **getContent** - HTML (LAST RESORT, max 10K chars, slow)

### ⏱️ Waiting (1 tool)
- **waitForSelector**: Wait for element to appear

### 🔧 Advanced (2 tools)
- **screenshot**: Visual verification
- **evaluate**: Execute custom JavaScript

## 📖 Best Practices

### 1. Wait Strategy
- Always use **waitForSelector** before interacting with dynamic elements
- Navigation tools auto-wait for networkidle

### 2. Form Automation
Complete form workflow:
  waitForSelector → fill → selectOption → check → press('Enter')

### 3. Data Extraction Strategy
RECOMMENDED ORDER:
  1. getPageSummary()      // Understand structure (fast)
  2. getTexts('.product')   // Batch extract (efficient)
  3. extractTable('table')  // Structured data (automatic)
  4. getText('.price')      // Specific values

AVOID:
  getContent()              // Slow, truncated, inefficient

### 4. Error Recovery
All errors include:
- **errorType**: TIMEOUT | ELEMENT_NOT_FOUND | ELEMENT_NOT_VISIBLE | etc.
- **suggestion**: How to fix the issue

If tool fails:
1. Check errorType and suggestion
2. Use **screenshot** or **getPageSummary** to inspect
3. Adjust selector or use force: true for click

### 5. ⚠️ CRITICAL: Data Sharing in Workflows
When working with other agents:

CORRECT FLOW:
  1. Extract data (navigate, extractTable, etc.)
  2. IMMEDIATELY call valSet ← Do this NOW, not later!
     valSet({ key: 'salesData', value: tableData })
  3. Return summary: "Extracted sales data and stored as 'salesData'"

WRONG: Waiting until end or forgetting valSet
Result: Downstream agents won't have the data!

Variable naming: Use descriptive keys like "userInfo", "productList", "searchResults"

## 🎭 Common Workflows

Login:
  navigate → waitForSelector → fill(username) → fill(password) → 
  press('Enter') OR click(submit) → waitForSelector(success)

Dropdown Navigation:
  hover(menu) → waitForSelector(submenu) → click(item)

Form with Dropdown & Checkbox:
  fill(input) → selectOption(dropdown) → check(checkbox) → 
  click(submit) → waitForSelector(confirmation)

Data Scraping:
  navigate → getPageSummary → extractTable OR getTexts → 
  valSet(data) → return

Table Data Collection:
  navigate → waitForSelector('table') → extractTable('table') →
  valSet({ key: 'tableData', value: data }) →
  return "Stored as 'tableData'"

## 🚀 Advanced Features

### Enhanced Click
- **Double-click**: clickCount: 2
- **Right-click**: button: 'right'
- **Force click** (bypass checks): force: true

### Keyboard Interaction
- **press('Enter')** - Submit forms
- **press('Escape')** - Close modals
- **press('Tab')** - Navigate fields
- **press('ArrowDown')** - Navigate dropdowns

### Batch Extraction
- **getTexts('.item')** - All matching elements → array
- **extractTable('table')** - Auto-parse headers → JSON
- **extractList('.list', 'li')** - Container + items → array

## ⚡ Performance Tips
- Use **getPageSummary** to understand before extracting
- Use **extractTable** instead of manual getText loops
- Use **getTexts** for multiple elements (1 call vs many)
- Avoid **getContent** - always truncated to 10K chars

Remember:
- Wait before interacting (waitForSelector)
- Extract efficiently (structured tools > raw HTML)
- **Store data immediately** (valSet right after extraction)
- Check error suggestions when tools fail`,
    });
    
    this.page = config.page;
  }

  /**
   * 清理 HTML 内容，移除脚本、样式等无用标签
   * 更激进的清理策略，只保留有用的文本内容
   */
  private cleanHtmlContent(html: string): string {
    return html
      // 移除 script 标签及其内容
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // 移除 style 标签及其内容
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // 移除 SVG 标签及其内容（通常很大且不包含有用文本）
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      // 移除注释
      .replace(/<!--[\s\S]*?-->/g, '')
      // 移除 head 标签及其内容（meta、link 等）
      .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, '')
      // 移除常见的无用标签
      .replace(/<(noscript|iframe|object|embed|applet|link|meta)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '')
      .replace(/<(link|meta|base|noscript|iframe)[^>]*>/gi, '')
      // 移除 data 属性（通常很长）
      .replace(/\s+data-[a-z-]+="[^"]*"/gi, '')
      // 移除 class 属性（通常很长，特别是 Tailwind）
      .replace(/\s+class="[^"]*"/gi, '')
      // 移除 style 属性
      .replace(/\s+style="[^"]*"/gi, '')
      // 移除 id 属性（保留语义标签即可）
      .replace(/\s+id="[^"]*"/gi, '')
      // 移除 aria 和 role 属性
      .replace(/\s+(aria-[a-z-]+|role)="[^"]*"/gi, '')
      // 移除多余的空白
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim();
  }

  /**
   * 截断内容并添加提示信息
   * 强制限制最大长度为 10000 字符
   */
  private truncateContent(content: string, maxLength: number): { content: string; truncated: boolean; originalLength: number } {
    const originalLength = content.length;
    // 强制最大长度不超过 10000
    const effectiveMaxLength = Math.min(maxLength, 10000);
    
    if (originalLength <= effectiveMaxLength) {
      return { content, truncated: false, originalLength };
    }
    
    const truncated = content.substring(0, effectiveMaxLength);
    return {
      content: truncated + '\n\n[Content truncated to prevent context overflow. Original: ' + originalLength + ' chars, Returned: ' + effectiveMaxLength + ' chars. Consider using getPageText or getPageSummary instead.]',
      truncated: true,
      originalLength
    };
  }

  /**
   * 定义工具
   */
  public getToolDefinitions() {
    return {
      // ============ 导航类工具 ============
      navigate: tool({
        description: 'Navigate to a URL',
        inputSchema: z.object({ 
          url: z.string().describe('The URL to navigate to') 
        }),
      }),

      goBack: tool({
        description: 'Navigate back in browser history',
        inputSchema: z.object({
          waitUntil: z.enum(['load', 'networkidle']).optional().describe('Wait until condition (default: networkidle)'),
        }),
      }),

      reload: tool({
        description: 'Reload the current page',
        inputSchema: z.object({
          hard: z.boolean().optional().describe('Hard reload, clear cache (default: false)'),
        }),
      }),
      
      // ============ 交互类工具 ============
      click: tool({
        description: 'Click an element. Supports left/right/middle click, double-click, and force click. Default timeout: 10s.',
        inputSchema: z.object({ 
          selector: z.string().describe('CSS selector of the element to click'),
          timeout: z.number().optional().describe('Timeout in milliseconds (default: 10000)'),
          force: z.boolean().optional().describe('Bypass visibility and actionability checks (default: false)'),
          clickCount: z.number().optional().describe('Number of clicks (2 = double-click, default: 1)'),
          button: z.enum(['left', 'right', 'middle']).optional().describe('Mouse button (default: left)'),
        }),
      }),
      
      fill: tool({
        description: 'Fill an input field',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector of the input field'),
          value: z.string().describe('Value to fill in the field'),
        }),
      }),

      selectOption: tool({
        description: 'Select option(s) from a dropdown/select element. Supports single and multiple selection. Default timeout: 10s.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector of the select element'),
          value: z.union([z.string(), z.array(z.string())]).describe('Option value(s) to select'),
          timeout: z.number().optional().describe('Timeout in milliseconds (default: 10000)'),
        }),
      }),

      check: tool({
        description: 'Check or uncheck a checkbox or radio button. Default timeout: 10s.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector of the checkbox/radio'),
          checked: z.boolean().optional().describe('true to check, false to uncheck (default: true)'),
          timeout: z.number().optional().describe('Timeout in milliseconds (default: 10000)'),
        }),
      }),

      hover: tool({
        description: 'Hover over an element to trigger dropdown menus, tooltips, etc. Default timeout: 10s.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector of the element to hover over'),
          timeout: z.number().optional().describe('Timeout in milliseconds (default: 10000)'),
        }),
      }),

      press: tool({
        description: 'Press a keyboard key. Useful for Enter, Escape, Tab, arrow keys, etc. Default timeout: 10s.',
        inputSchema: z.object({
          key: z.string().describe('Key to press (e.g., "Enter", "Escape", "Tab", "ArrowDown", "a")'),
          selector: z.string().optional().describe('Element to focus before pressing (optional, omit for page-level)'),
          timeout: z.number().optional().describe('Timeout in milliseconds (default: 10000)'),
        }),
      }),
      
      // ============ 等待类工具 ============
      waitForSelector: tool({
        description: 'Wait for an element to appear on the page. Default timeout: 10s.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector to wait for'),
          timeout: z.number().optional().describe('Timeout in milliseconds (default: 10000)'),
        }),
      }),
      
      // ============ 内容提取类工具 ============
      getContent: tool({
        description: 'Get the HTML content of the current page. ⚠️ STRONGLY DISCOURAGED - use getPageText or getPageSummary instead. Always truncated to max 10000 chars.',
        inputSchema: z.object({
          maxLength: z.number().optional().describe('Maximum length of content to return (max: 10000 characters, default: 5000).'),
          cleanHtml: z.boolean().optional().describe('Remove scripts, styles, SVG, and unnecessary attributes (default: true, RECOMMENDED)'),
        }),
      }),
      
      getPageText: tool({
        description: 'Get only the visible text content of the page (without HTML tags). Much more efficient than getContent for understanding page content.',
        inputSchema: z.object({
          maxLength: z.number().optional().describe('Maximum length of text to return (default: 30000 characters)'),
        }),
      }),
      
      getPageSummary: tool({
        description: 'Get a structured summary of the page including title, meta info, and main content sections. Best for understanding page structure without overwhelming context.',
        inputSchema: z.object({}),
      }),
      
      getText: tool({
        description: 'Get text content of a single element',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector of the element'),
        }),
      }),

      getTexts: tool({
        description: 'Get text content from multiple elements matching selector. Returns array of text strings.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector to match multiple elements'),
          limit: z.number().optional().describe('Maximum number of elements to extract (default: 100)'),
        }),
      }),
      
      getAttribute: tool({
        description: 'Get an attribute value of an element',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector of the element'),
          attribute: z.string().describe('Name of the attribute'),
        }),
      }),

      extractTable: tool({
        description: 'Extract table data as JSON array. Each row becomes an object with column headers as keys.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector of the table element'),
          includeHeader: z.boolean().optional().describe('Use first row as headers (default: true)'),
        }),
      }),

      extractList: tool({
        description: 'Extract list items as an array. Useful for ul/ol lists or any repeated elements.',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector of list container (e.g., "ul", ".product-list")'),
          itemSelector: z.string().describe('CSS selector for items within container (e.g., "li", ".item")'),
          limit: z.number().optional().describe('Maximum number of items (default: 100)'),
        }),
      }),
      
      // ============ 其他工具 ============
      screenshot: tool({
        description: 'Take a screenshot of the page',
        inputSchema: z.object({
          fullPage: z.boolean().optional().describe('Take full page screenshot (default: false)'),
        }),
      }),
      
      evaluate: tool({
        description: 'Execute JavaScript in the page context',
        inputSchema: z.object({
          script: z.string().describe('JavaScript code to execute'),
        }),
      }),
    };
  }

  /**
   * 分类错误类型
   */
  private categorizeError(error: any): {
    errorType: string;
    suggestion: string;
  } {
    const errorMsg = error.message || '';
    
    if (errorMsg.includes('Timeout') || errorMsg.includes('timeout')) {
      return {
        errorType: 'TIMEOUT',
        suggestion: 'Element may load slowly. Try increasing timeout or use waitForSelector first.'
      };
    }
    
    if (errorMsg.includes('not found') || errorMsg.includes('Unable to find')) {
      return {
        errorType: 'ELEMENT_NOT_FOUND',
        suggestion: 'Use getPageSummary or screenshot to inspect page structure. Verify selector is correct.'
      };
    }
    
    if (errorMsg.includes('not visible') || errorMsg.includes('hidden')) {
      return {
        errorType: 'ELEMENT_NOT_VISIBLE',
        suggestion: 'Element exists but is hidden. Try scrolling into view or use force: true for click.'
      };
    }
    
    if (errorMsg.includes('not enabled') || errorMsg.includes('disabled')) {
      return {
        errorType: 'ELEMENT_NOT_ENABLED',
        suggestion: 'Element is disabled. Check if there are prerequisites or use force: true.'
      };
    }
    
    if (errorMsg.includes('network') || errorMsg.includes('net::ERR')) {
      return {
        errorType: 'NETWORK_ERROR',
        suggestion: 'Network issue. Check URL validity and internet connection.'
      };
    }
    
    if (errorMsg.includes('selector') || errorMsg.includes('invalid')) {
      return {
        errorType: 'SELECTOR_INVALID',
        suggestion: 'Selector syntax is invalid. Use valid CSS selector format.'
      };
    }
    
    return {
      errorType: 'UNKNOWN_ERROR',
      suggestion: 'Try using screenshot or getPageSummary to debug the issue.'
    };
  }

  /**
   * 执行工具调用
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async executeToolCall(toolName: string, input: any): Promise<any> {
    try {
      switch (toolName) {
        // ============ 导航类工具 ============
        case 'navigate': {
          await this.page.goto(input.url, { waitUntil: 'networkidle', timeout: this.NAVIGATION_TIMEOUT });
          const title = await this.page.title();
          return { 
            success: true, 
            url: input.url, 
            title,
            message: `Navigated to ${title}` 
          };
        }

        case 'goBack': {
          const waitUntil = input.waitUntil || 'networkidle';
          await this.page.goBack({ waitUntil, timeout: this.NAVIGATION_TIMEOUT });
          const title = await this.page.title();
          return {
            success: true,
            title,
            message: `Navigated back to: ${title}`
          };
        }

        case 'reload': {
          const hard = input.hard || false;
          await this.page.reload({ 
            waitUntil: 'networkidle', 
            timeout: this.NAVIGATION_TIMEOUT 
          });
          // Hard reload is handled by Playwright automatically when cache is cleared
          const title = await this.page.title();
          return {
            success: true,
            hard,
            title,
            message: `Page reloaded${hard ? ' (hard)' : ''}: ${title}`
          };
        }
          
        // ============ 交互类工具 ============
        case 'click': {
          const timeout = input.timeout || this.DEFAULT_TIMEOUT;
          const force = input.force || false;
          const clickCount = input.clickCount || 1;
          const button = input.button || 'left';
          
          await this.page.click(input.selector, { 
            timeout, 
            force, 
            clickCount, 
            button 
          });
          
          // 尝试获取元素信息
          let elementInfo: any = {};
          try {
            const element = await this.page.$(input.selector);
            if (element) {
              elementInfo = {
                text: await element.textContent(),
                visible: await element.isVisible(),
                enabled: await element.isEnabled(),
              };
            }
          } catch (e) {
            // 忽略获取元素信息时的错误
          }
          
          return { 
            success: true, 
            selector: input.selector,
            meta: {
              selector: input.selector,
              clickCount,
              button,
              elementInfo
            },
            message: clickCount > 1 
              ? `Double-clicked element: ${input.selector}` 
              : `Clicked element: ${input.selector}${elementInfo.text ? ` ('${elementInfo.text}')` : ''}`
          };
        }
          
        case 'fill':
          await this.page.fill(input.selector, input.value, { timeout: this.DEFAULT_TIMEOUT });
          return { 
            success: true, 
            selector: input.selector,
            value: input.value,
            message: `Filled ${input.selector} with value` 
          };

        case 'selectOption': {
          const timeout = input.timeout || this.DEFAULT_TIMEOUT;
          const values = Array.isArray(input.value) ? input.value : [input.value];
          
          const selectedValues = await this.page.selectOption(input.selector, values, { timeout });
          
          return {
            success: true,
            selector: input.selector,
            selectedValues,
            message: `Selected ${selectedValues.length} option(s) in ${input.selector}`
          };
        }

        case 'check': {
          const timeout = input.timeout || this.DEFAULT_TIMEOUT;
          const checked = input.checked !== false; // default true
          
          if (checked) {
            await this.page.check(input.selector, { timeout });
          } else {
            await this.page.uncheck(input.selector, { timeout });
          }
          
          return {
            success: true,
            selector: input.selector,
            checked,
            message: `${checked ? 'Checked' : 'Unchecked'} element: ${input.selector}`
          };
        }

        case 'hover': {
          const timeout = input.timeout || this.DEFAULT_TIMEOUT;
          await this.page.hover(input.selector, { timeout });
          
          return {
            success: true,
            selector: input.selector,
            message: `Hovered over element: ${input.selector}`
          };
        }

        case 'press': {
          const timeout = input.timeout || this.DEFAULT_TIMEOUT;
          
          if (input.selector) {
            // Focus element first, then press
            await this.page.focus(input.selector, { timeout });
            await this.page.keyboard.press(input.key);
          } else {
            // Press at page level
            await this.page.keyboard.press(input.key);
          }
          
          return {
            success: true,
            key: input.key,
            selector: input.selector,
            message: input.selector 
              ? `Pressed '${input.key}' on ${input.selector}`
              : `Pressed '${input.key}' on page`
          };
        }
          
        // ============ 等待类工具 ============
        case 'waitForSelector': {
          const timeout = input.timeout || this.DEFAULT_TIMEOUT;
          await this.page.waitForSelector(input.selector, { timeout });
          return { 
            success: true, 
            selector: input.selector,
            message: `Element ${input.selector} appeared` 
          };
        }
          
        // ============ 内容提取类工具 ============
        case 'getContent': {
          let htmlContent = await this.page.content();
          const cleanHtml = input.cleanHtml !== false; // 默认为 true
          const requestedMaxLength = input.maxLength || 5000; // 降低默认值到 5000
          
          if (cleanHtml) {
            htmlContent = this.cleanHtmlContent(htmlContent);
          }
          
          // 强制限制：无论用户输入什么，都不超过 10000
          const { content: finalContent, truncated, originalLength } = this.truncateContent(htmlContent, requestedMaxLength);
          
          return { 
            success: true,
            content: finalContent,
            length: finalContent.length,
            originalLength,
            truncated,
            cleaned: cleanHtml,
            hardLimit: 10000,
            message: truncated 
              ? `⚠️ Content truncated: ${originalLength} → ${finalContent.length} chars (hard limit: 10000). RECOMMENDATION: Use getPageText (text only) or getPageSummary (structured data) instead.`
              : `Retrieved ${finalContent.length} characters of HTML (cleaned: ${cleanHtml})`
          };
        }
          
        case 'getPageText': {
          const pageText = await this.page.evaluate(() => {
            // 移除不可见元素和脚本
            const clone = document.body.cloneNode(true) as HTMLElement;
            clone.querySelectorAll('script, style, noscript, iframe').forEach(el => el.remove());
            return clone.innerText || clone.textContent || '';
          });
          
          const textMaxLength = input.maxLength || 30000;
          const { content: finalText, truncated: textTruncated, originalLength: textOriginalLength } = 
            this.truncateContent(pageText, textMaxLength);
          
          return {
            success: true,
            text: finalText,
            length: finalText.length,
            originalLength: textOriginalLength,
            truncated: textTruncated,
            message: textTruncated
              ? `Retrieved ${finalText.length} characters of text (truncated from ${textOriginalLength})`
              : `Retrieved ${finalText.length} characters of text`
          };
        }
          
        case 'getPageSummary': {
          const summary = await this.page.evaluate(() => {
            // 获取标题
            const title = document.title;
            
            // 获取 meta 信息
            const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
            const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';
            
            // 获取主要标题
            const h1Elements = Array.from(document.querySelectorAll('h1')).map(h => h.textContent?.trim()).filter(Boolean);
            const h2Elements = Array.from(document.querySelectorAll('h2')).slice(0, 10).map(h => h.textContent?.trim()).filter(Boolean);
            
            // 获取主要段落（前 5 个）
            const paragraphs = Array.from(document.querySelectorAll('p'))
              .map(p => p.textContent?.trim())
              .filter(text => text && text.length > 50)
              .slice(0, 5);
            
            // 获取链接数量
            const linkCount = document.querySelectorAll('a').length;
            
            // 获取图片数量
            const imageCount = document.querySelectorAll('img').length;
            
            // 获取表单数量
            const formCount = document.querySelectorAll('form').length;
            
            return {
              title,
              description,
              keywords,
              h1: h1Elements,
              h2: h2Elements,
              mainParagraphs: paragraphs,
              stats: {
                links: linkCount,
                images: imageCount,
                forms: formCount
              }
            };
          });
          
          return {
            success: true,
            summary,
            message: `Retrieved page summary: ${summary.title}`
          };
        }
          
        case 'getText': {
          const text = await this.page.textContent(input.selector);
          return { 
            success: true,
            text,
            selector: input.selector,
            message: text ? `Got text from ${input.selector}` : `No text found at ${input.selector}`
          };
        }

        case 'getTexts': {
          const limit = input.limit || 100;
          const texts = await this.page.$$eval(input.selector, (elements, lim) => {
            return elements
              .slice(0, lim as number)
              .map(el => el.textContent?.trim())
              .filter(Boolean) as string[];
          }, limit);
          
          return {
            success: true,
            texts,
            count: texts.length,
            selector: input.selector,
            message: `Retrieved ${texts.length} text items from ${input.selector}`
          };
        }
          
        case 'getAttribute': {
          const attrValue = await this.page.getAttribute(input.selector, input.attribute);
          return { 
            success: true,
            value: attrValue,
            selector: input.selector,
            attribute: input.attribute,
            message: attrValue ? `Got ${input.attribute} attribute` : `Attribute ${input.attribute} not found`
          };
        }

        case 'extractTable': {
          const includeHeader = input.includeHeader !== false; // default true
          
          const tableData = await this.page.$eval(input.selector, (table, withHeader) => {
            const rows = Array.from(table.querySelectorAll('tr'));
            if (rows.length === 0) return [];
            
            let headers: string[] = [];
            let dataRows = rows;
            
            if (withHeader && rows.length > 0) {
              // Use first row as headers
              const headerCells = (rows[0] as Element).querySelectorAll('th, td');
              headers = Array.from(headerCells).map((cell: Element) => 
                cell.textContent?.trim() || `Column${headers.length + 1}`
              );
              dataRows = rows.slice(1);
            } else {
              // Generate column names
              const firstRowCells = (rows[0] as Element).querySelectorAll('th, td');
              headers = Array.from(firstRowCells).map((_, i) => `Column${i + 1}`);
            }
            
            // Extract data rows
            return dataRows.map((row) => {
              const cells = Array.from((row as Element).querySelectorAll('td, th'));
              const rowData: Record<string, string> = {};
              cells.forEach((cell, i) => {
                if (i < headers.length) {
                  rowData[headers[i]] = (cell as Element).textContent?.trim() || '';
                }
              });
              return rowData;
            });
          }, includeHeader).catch(() => null);
          
          if (tableData === null) {
            return {
              success: false,
              error: `Table not found: ${input.selector}`,
              message: `Table not found: ${input.selector}`,
              errorType: 'ELEMENT_NOT_FOUND',
              suggestion: 'Verify the table selector is correct. Use getPageSummary to inspect page structure.'
            };
          }
          
          return {
            success: true,
            data: tableData,
            rowCount: tableData.length,
            selector: input.selector,
            message: `Extracted ${tableData.length} rows from table ${input.selector}`
          };
        }

        case 'extractList': {
          const limit = input.limit || 100;
          
          const listData = await this.page.$eval(input.selector, (container, args) => {
            const items = Array.from(container.querySelectorAll(args.itemSel));
            return items
              .slice(0, args.lim)
              .map((item) => (item as Element).textContent?.trim())
              .filter(Boolean) as string[];
          }, { itemSel: input.itemSelector, lim: limit }).catch(() => null);
          
          if (listData === null) {
            return {
              success: false,
              error: `List container not found: ${input.selector}`,
              message: `List container not found: ${input.selector}`,
              errorType: 'ELEMENT_NOT_FOUND',
              suggestion: 'Verify the container selector is correct. Use getPageSummary to inspect page structure.'
            };
          }
          
          return {
            success: true,
            items: listData,
            count: listData.length,
            selector: input.selector,
            itemSelector: input.itemSelector,
            message: `Extracted ${listData.length} items from ${input.selector}`
          };
        }
          
        // ============ 其他工具 ============
        case 'screenshot': {
          const screenshot = await this.page.screenshot({ 
            fullPage: input.fullPage || false 
          });
          return { 
            success: true,
            screenshot: screenshot.toString('base64'),
            size: screenshot.length,
            message: `Screenshot taken (${screenshot.length} bytes)` 
          };
        }
          
        case 'evaluate': {
          const result = await this.page.evaluate(input.script);
          return { 
            success: true,
            result,
            script: input.script,
            message: `Script executed successfully` 
          };
        }
          
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // 分类错误并提供建议
      const { errorType, suggestion } = this.categorizeError(error);
      
      return {
        success: false,
        error: error.message,
        message: `Error in ${toolName}: ${error.message}`,
        errorType,
        suggestion
      };
    }
  }
}

