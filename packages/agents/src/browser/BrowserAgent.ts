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

  constructor(config: BrowserAgentConfig) {
    super({
      id: config.id || 'browser-agent',
      name: config.name || 'Browser Agent',
      description: config.description || 'Playwright 浏览器自动化 Agent，负责页面导航、元素操作和内容提取',
      capabilities: ['navigate', 'click', 'fill', 'screenshot', 'extract', 'wait'],
      llmClient: config.llmClient,
      maxIterations: 30, // 增加迭代次数，确保有足够时间调用 valSet
      systemPrompt: `You are a browser automation expert using Playwright.

Best Practices:
1. **Wait Strategy**: Always use waitForSelector before interacting with elements that may not be immediately available
2. **Selector Strategy**: 
   - Prefer specific selectors (id, data-testid, aria-labels)
   - Use CSS selectors like: #id, .class, [data-testid="value"]
   - Avoid overly complex selectors that may break easily
3. **Navigation**: 
   - After navigate, wait for the page to be fully loaded before proceeding
   - Check the returned title to verify successful navigation
4. **Error Handling**:
   - If an element is not found, try getting the page summary first to understand the structure
   - Consider that pages may have dynamic content or require scrolling
5. **Data Extraction** (⚠️ IMPORTANT - Avoid Context Overflow):
   - **PREFER getPageSummary**: Best for understanding page structure without overwhelming context
   - **USE getPageText**: When you need content without HTML tags (much more efficient than getContent)
   - **AVOID getContent**: Strongly discouraged! Always truncated to max 10000 chars. Use only when HTML structure is absolutely necessary.
   - Use getText for specific element text content
   - Use getAttribute for data attributes, href, src, etc.
   - **CRITICAL**: getContent is ALWAYS truncated to 10000 chars maximum, regardless of input
   - **WARNING**: Even with cleaning, HTML can be verbose. Always prefer getPageText or getPageSummary.
6. **Screenshots**: Take screenshots when visual verification is needed or to help debug issues

7. **⚠️ CRITICAL: Data Sharing in Workflows**:
   When working in a workflow with other agents:
   - **IMMEDIATELY after extracting data, call valSet to store it** - This should be your NEXT step after extraction
   - **DON'T wait** - Store data as soon as you have it, before doing anything else
   - Use descriptive variable names: "userInfo", "salesData", "searchResults", etc.
   - **MUST mention the variable name in your summary**: e.g., "Extracted user data and stored as 'userInfo'"
   - This allows downstream agents (like ReportAgent) to access your data
   - Example workflow:
     * Step 1: Extract data (navigate, getText, etc.)
     * Step 2: **IMMEDIATELY call valSet** → \`valSet({ key: 'productList', value: products })\`
     * Step 3: Return summary mentioning "stored as 'productList'"
   
   **TIMING IS CRITICAL**: Store data early in your execution, not at the end. 
   If you hit max iterations before calling valSet, downstream agents won't have the data!

Content Extraction Strategy:
- For understanding what's on the page → use getPageSummary (BEST)
- For reading text content → use getPageText (RECOMMENDED)
- For extracting specific data → use getText with selectors (EFFICIENT)
- For analyzing HTML structure → use getContent with cleanHtml=true (LAST RESORT, max 10K chars)
- **NEVER** use getContent without a specific reason - it's always truncated and inefficient

Common Workflows:
- Login: navigate → waitForSelector → fill username → fill password → click submit → waitForSelector (success indicator)
- Data Scraping: navigate → getPageSummary → getText/getAttribute → **IMMEDIATELY valSet** → return summary
- Form Filling: waitForSelector → fill fields → click submit → verify success
- Content Analysis: navigate → getPageText/getPageSummary → **valSet to store** → return

Remember: 
- Modern web pages are dynamic. Always wait for elements before interacting with them. 
- ALWAYS prefer efficient content extraction tools to avoid context overflow. 
- getContent is ALWAYS limited to 10000 chars - use it only as last resort.
- **IN WORKFLOWS: Extract data → valSet IMMEDIATELY → then continue with other tasks**`,
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
      navigate: tool({
        description: 'Navigate to a URL',
        inputSchema: z.object({ 
          url: z.string().describe('The URL to navigate to') 
        }),
      }),
      
      click: tool({
        description: 'Click an element by CSS selector',
        inputSchema: z.object({ 
          selector: z.string().describe('CSS selector of the element to click') 
        }),
      }),
      
      fill: tool({
        description: 'Fill an input field',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector of the input field'),
          value: z.string().describe('Value to fill in the field'),
        }),
      }),
      
      waitForSelector: tool({
        description: 'Wait for an element to appear on the page',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector to wait for'),
          timeout: z.number().optional().describe('Timeout in milliseconds (default: 5000)'),
        }),
      }),
      
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
        description: 'Get text content of an element',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector of the element'),
        }),
      }),
      
      getAttribute: tool({
        description: 'Get an attribute value of an element',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector of the element'),
          attribute: z.string().describe('Name of the attribute'),
        }),
      }),
      
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
   * 执行工具调用
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async executeToolCall(toolName: string, input: any): Promise<any> {
    try {
      switch (toolName) {
        case 'navigate': {
          await this.page.goto(input.url, { waitUntil: 'networkidle', timeout: 30000 });
          const title = await this.page.title();
          return { 
            success: true, 
            url: input.url, 
            title,
            message: `Navigated to ${title}` 
          };
        }
          
        case 'click':
          await this.page.click(input.selector, { timeout: 5000 });
          return { 
            success: true, 
            selector: input.selector,
            message: `Clicked element: ${input.selector}` 
          };
          
        case 'fill':
          await this.page.fill(input.selector, input.value, { timeout: 5000 });
          return { 
            success: true, 
            selector: input.selector,
            value: input.value,
            message: `Filled ${input.selector} with value` 
          };
          
        case 'waitForSelector': {
          const timeout = input.timeout || 5000;
          await this.page.waitForSelector(input.selector, { timeout });
          return { 
            success: true, 
            selector: input.selector,
            message: `Element ${input.selector} appeared` 
          };
        }
          
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
      // 返回错误信息而不是抛出异常，让 LLM 可以处理
      return {
        success: false,
        error: error.message,
        message: `Error in ${toolName}: ${error.message}`
      };
    }
  }
}

