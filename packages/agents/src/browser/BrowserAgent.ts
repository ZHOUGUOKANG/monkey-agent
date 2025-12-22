import { BaseAgent, BaseAgentConfig } from '@monkey-agent/base';
import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { z } from 'zod';

/**
 * 浏览器 Agent 配置
 */
export interface BrowserAgentConfig extends Partial<BaseAgentConfig> {
  /**
   * 默认操作的标签页 ID
   * 如果未指定，将使用当前活动标签页
   */
  defaultTabId?: number;

  /**
   * 是否总是使用活动标签页（忽略 defaultTabId）
   */
  alwaysUseActiveTab?: boolean;
}

/**
 * 浏览器 Agent
 * 
 * 核心能力：
 * - 页面导航和历史控制
 * - DOM 元素操作（点击、输入、滚动）
 * - 内容提取和截图
 * - 表单填写和提交
 * 
 * 执行环境：Chrome Extension (Content Script + Background)
 */
export class BrowserAgent extends BaseAgent {
  private defaultTabId?: number;
  private alwaysUseActiveTab: boolean;

  constructor(config?: BrowserAgentConfig) {
    super({
      id: config?.id || 'browser-agent',
      name: config?.name || 'Browser Agent',
      description: config?.description || '浏览器自动化 Agent，负责页面导航、DOM 操作和内容提取',
      capabilities: config?.capabilities || [
        'navigate',
        'click',
        'type',
        'scroll',
        'screenshot',
        'extract-content',
        'fill-form',
        'wait-for-element',
        'tab-management',
      ],
      llmClient: config?.llmClient,
      llmConfig: config?.llmConfig,
      systemPrompt: config?.systemPrompt,
      maxIterations: config?.maxIterations,
      enableReflection: config?.enableReflection,
      contextCompression: config?.contextCompression,
    });
    
    this.defaultTabId = config?.defaultTabId;
    this.alwaysUseActiveTab = config?.alwaysUseActiveTab ?? false;
  }

  /**
   * 构建系统提示词
   */
  protected buildSystemPrompt(): string {
    return `You are Browser Agent, an intelligent web browser automation assistant.

Your capabilities:
- Navigate web pages and control browser history
- Find and interact with DOM elements (click, type, scroll)
- Extract content and take screenshots
- Fill forms and submit data
- Wait for elements to appear or conditions to be met
- Manage multiple tabs (create, close, switch, list)

When automating browser tasks:
1. Always verify element existence before interacting
2. Use appropriate selectors (CSS, XPath) for reliability
3. Wait for dynamic content to load when needed
4. Extract relevant information efficiently
5. Handle errors gracefully and provide clear feedback
6. Use tabId parameter to target specific tabs when working with multiple tabs

Available tools will help you interact with the browser. Use them step by step to accomplish user tasks.
Always provide clear explanations of what you're doing and what results you observe.`;
  }

  /**
   * 定义浏览器操作工具
   */
  protected getToolDefinitions(): ToolSet {
    return {
      navigate: tool({
        description: 'Navigate to a URL in a tab',
        inputSchema: z.object({
          url: z.string().describe('The URL to navigate to'),
          tabId: z.number().optional().describe('Tab ID to navigate (defaults to current active tab)'),
        }),
      }),

      click: tool({
        description: 'Click an element on the page',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector or XPath for the element'),
          waitForElement: z.boolean().optional().describe('Wait for element to appear if not immediately found'),
          tabId: z.number().optional().describe('Tab ID to execute in (defaults to current active tab)'),
        }),
      }),

      typeText: tool({
        description: 'Type text into an input element',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector for the input element'),
          text: z.string().describe('Text to type'),
          clear: z.boolean().optional().describe('Clear existing text before typing'),
          tabId: z.number().optional().describe('Tab ID to execute in (defaults to current active tab)'),
        }),
      }),

      scroll: tool({
        description: 'Scroll the page or an element',
        inputSchema: z.object({
          direction: z.enum(['up', 'down', 'top', 'bottom']).describe('Scroll direction'),
          selector: z.string().optional().describe('CSS selector for element to scroll (defaults to page)'),
          amount: z.number().optional().describe('Scroll amount in pixels (for up/down)'),
          tabId: z.number().optional().describe('Tab ID to execute in (defaults to current active tab)'),
        }),
      }),

      getContent: tool({
        description: 'Extract text content from the page or an element',
        inputSchema: z.object({
          selector: z.string().optional().describe('CSS selector for element (defaults to body)'),
          includeHtml: z.boolean().optional().describe('Include HTML markup in addition to text'),
          tabId: z.number().optional().describe('Tab ID to extract from (defaults to current active tab)'),
        }),
      }),

      screenshot: tool({
        description: 'Take a screenshot of a tab',
        inputSchema: z.object({
          fullPage: z.boolean().optional().describe('Capture full page or just visible area'),
          tabId: z.number().optional().describe('Tab ID to capture (defaults to current active tab)'),
        }),
      }),

      waitForElement: tool({
        description: 'Wait for an element to appear on the page',
        inputSchema: z.object({
          selector: z.string().describe('CSS selector for the element'),
          timeout: z.number().optional().describe('Maximum wait time in milliseconds (default: 5000)'),
          tabId: z.number().optional().describe('Tab ID to wait in (defaults to current active tab)'),
        }),
      }),

      back: tool({
        description: 'Go back in browser history',
        inputSchema: z.object({
          tabId: z.number().optional().describe('Tab ID to go back in (defaults to current active tab)'),
        }),
      }),

      forward: tool({
        description: 'Go forward in browser history',
        inputSchema: z.object({
          tabId: z.number().optional().describe('Tab ID to go forward in (defaults to current active tab)'),
        }),
      }),

      reload: tool({
        description: 'Reload a tab',
        inputSchema: z.object({
          hard: z.boolean().optional().describe('Perform hard reload (bypass cache)'),
          tabId: z.number().optional().describe('Tab ID to reload (defaults to current active tab)'),
        }),
      }),

      executeScript: tool({
        description: 'Execute JavaScript code on the page (use with caution)',
        inputSchema: z.object({
          code: z.string().describe('JavaScript code to execute'),
          tabId: z.number().optional().describe('Tab ID to execute in (defaults to current active tab)'),
        }),
      }),

      // 标签页管理工具
      createTab: tool({
        description: 'Create a new tab',
        inputSchema: z.object({
          url: z.string().optional().describe('URL to open in the new tab'),
          active: z.boolean().optional().describe('Whether to activate the new tab (default: true)'),
        }),
      }),

      closeTab: tool({
        description: 'Close a tab',
        inputSchema: z.object({
          tabId: z.number().describe('Tab ID to close'),
        }),
      }),

      switchTab: tool({
        description: 'Switch to a specific tab',
        inputSchema: z.object({
          tabId: z.number().describe('Tab ID to switch to'),
        }),
      }),

      listTabs: tool({
        description: 'List all open tabs',
        inputSchema: z.object({
          currentWindowOnly: z.boolean().optional().describe('Only list tabs in current window (default: true)'),
        }),
      }),

      getActiveTab: tool({
        description: 'Get the currently active tab',
        inputSchema: z.object({}),
      }),
    };
  }

  /**
   * 执行工具调用
   */
  protected async executeToolCall(toolName: string, input: any): Promise<any> {
    switch (toolName) {
      case 'navigate':
        return await this.navigate(input.url, input.tabId);

      case 'click':
        return await this.clickElement(input.selector, input.waitForElement, input.tabId);

      case 'typeText':
        return await this.typeText(input.selector, input.text, input.clear, input.tabId);

      case 'scroll':
        return await this.scrollPage(input.direction, input.selector, input.amount, input.tabId);

      case 'getContent':
        return await this.extractContent(input.selector, input.includeHtml, input.tabId);

      case 'screenshot':
        return await this.takeScreenshot(input.fullPage, input.tabId);

      case 'waitForElement':
        return await this.waitForElement(input.selector, input.timeout, input.tabId);

      case 'back':
        return await this.goBack(input.tabId);

      case 'forward':
        return await this.goForward(input.tabId);

      case 'reload':
        return await this.reloadPage(input.hard, input.tabId);

      case 'executeScript':
        return await this.runScript(input.code, input.tabId);

      // 标签页管理
      case 'createTab':
        return await this.createTab(input.url, input.active);

      case 'closeTab':
        return await this.closeTab(input.tabId);

      case 'switchTab':
        return await this.switchTab(input.tabId);

      case 'listTabs':
        return await this.listTabs(input.currentWindowOnly);

      case 'getActiveTab':
        return await this.getActiveTab();

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // ============ 辅助方法 ============

  /**
   * 获取目标标签页 ID
   * 优先级：指定的 tabId > 配置的 defaultTabId > 当前活动标签页
   */
  private async getTargetTabId(specifiedTabId?: number): Promise<number> {
    // 如果指定了 tabId，直接使用
    if (specifiedTabId !== undefined) {
      return specifiedTabId;
    }

    // 如果配置了总是使用活动标签页，获取活动标签页
    if (this.alwaysUseActiveTab) {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab.id) return tab.id;
      }
    }

    // 如果配置了默认 tabId，使用它
    if (this.defaultTabId !== undefined) {
      return this.defaultTabId;
    }

    // fallback 到当前活动标签页
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.id) return tab.id;
    }

    throw new Error('Unable to determine target tab ID');
  }

  /**
   * 在指定标签页中执行脚本
   */
  private async executeScriptInTab<T>(
    tabId: number,
    func: (...args: any[]) => T,
    args: any[] = []
  ): Promise<T> {
    if (typeof chrome !== 'undefined' && chrome.scripting) {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func,
        args,
      });
      
      if (results && results[0]) {
        if (results[0].result !== undefined) {
          return results[0].result as T;
        }
      }
      
      throw new Error('Script execution failed: no result returned');
    }

    throw new Error('Chrome scripting API not available');
  }

  // ============ 工具实现方法 ============

  /**
   * 导航到指定 URL
   */
  private async navigate(url: string, tabId?: number): Promise<any> {
    this.emit('navigate:start', { url, tabId });

    // 在浏览器环境中实现（当前页面）
    if (typeof window !== 'undefined' && !tabId) {
      window.location.href = url;
      return { success: true, url };
    }

    // 在扩展环境中通过 chrome API
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const targetTabId = await this.getTargetTabId(tabId);
      await chrome.tabs.update(targetTabId, { url });
      return { success: true, url, tabId: targetTabId };
    }

    throw new Error('Unable to navigate: not in browser or extension context');
  }

  /**
   * 点击元素
   */
  private async clickElement(selector: string, waitForElement?: boolean, tabId?: number): Promise<any> {
    this.emit('click:start', { selector, tabId });

    // 在当前页面执行（content script 环境）
    if (typeof document !== 'undefined' && !tabId) {
      let element = document.querySelector(selector);

      // 如果需要等待元素出现
      if (!element && waitForElement) {
        await this.waitForElement(selector);
        element = document.querySelector(selector);
      }

      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      (element as HTMLElement).click();
      return { success: true, selector };
    }

    // 在指定标签页执行（extension 环境）
    if (typeof chrome !== 'undefined' && chrome.scripting) {
      const targetTabId = await this.getTargetTabId(tabId);
      
      return await this.executeScriptInTab(
        targetTabId,
        (sel: string, wait: boolean) => {
          const element = document.querySelector(sel);
          if (!element) {
            throw new Error(`Element not found: ${sel}`);
          }
          (element as HTMLElement).click();
          return { success: true, selector: sel };
        },
        [selector, waitForElement || false]
      );
    }

    throw new Error('Document not available');
  }

  /**
   * 输入文本
   */
  private async typeText(selector: string, text: string, clear?: boolean, tabId?: number): Promise<any> {
    this.emit('type:start', { selector, text, tabId });

    // 在当前页面执行（content script 环境）
    if (typeof document !== 'undefined' && !tabId) {
      const element = document.querySelector(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        if (clear) {
          element.value = '';
        }
        element.value = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true, selector, text };
      }

      throw new Error('Element is not an input or textarea');
    }

    // 在指定标签页执行（extension 环境）
    if (typeof chrome !== 'undefined' && chrome.scripting) {
      const targetTabId = await this.getTargetTabId(tabId);
      
      return await this.executeScriptInTab(
        targetTabId,
        (sel: string, txt: string, clr: boolean) => {
          const element = document.querySelector(sel);
          if (!element) {
            throw new Error(`Element not found: ${sel}`);
          }

          if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            if (clr) {
              element.value = '';
            }
            element.value = txt;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, selector: sel, text: txt };
          }

          throw new Error('Element is not an input or textarea');
        },
        [selector, text, clear || false]
      );
    }

    throw new Error('Document not available');
  }

  /**
   * 滚动页面或元素
   */
  private async scrollPage(
    direction: 'up' | 'down' | 'top' | 'bottom',
    selector?: string,
    amount?: number,
    tabId?: number
  ): Promise<any> {
    this.emit('scroll:start', { direction, selector, tabId });

    // 在当前页面执行（content script 环境）
    if (typeof window !== 'undefined' && !tabId) {
      const target = selector ? document.querySelector(selector) : window;
      if (!target) {
        throw new Error(`Scroll target not found: ${selector}`);
      }

      switch (direction) {
        case 'top':
          target.scrollTo(0, 0);
          break;
        case 'bottom':
          target.scrollTo(0, document.body.scrollHeight);
          break;
        case 'up':
          target.scrollBy(0, -(amount || 300));
          break;
        case 'down':
          target.scrollBy(0, amount || 300);
          break;
      }

      return { success: true, direction, selector };
    }

    // 在指定标签页执行（extension 环境）
    if (typeof chrome !== 'undefined' && chrome.scripting) {
      const targetTabId = await this.getTargetTabId(tabId);
      
      return await this.executeScriptInTab(
        targetTabId,
        (dir: string, sel: string | undefined, amt: number | undefined) => {
          const target = sel ? document.querySelector(sel) : window;
          if (!target) {
            throw new Error(`Scroll target not found: ${sel}`);
          }

          switch (dir) {
            case 'top':
              target.scrollTo(0, 0);
              break;
            case 'bottom':
              target.scrollTo(0, document.body.scrollHeight);
              break;
            case 'up':
              target.scrollBy(0, -(amt || 300));
              break;
            case 'down':
              target.scrollBy(0, amt || 300);
              break;
          }

          return { success: true, direction: dir, selector: sel };
        },
        [direction, selector, amount]
      );
    }

    throw new Error('Window not available');
  }

  /**
   * 提取内容
   */
  private async extractContent(selector?: string, includeHtml?: boolean, tabId?: number): Promise<any> {
    this.emit('get-content:start', { selector, tabId });

    // 在当前页面执行（content script 环境）
    if (typeof document !== 'undefined' && !tabId) {
      const element = selector ? document.querySelector(selector) : document.body;
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }

      const result: any = {
        text: (element as HTMLElement).innerText,
      };

      if (includeHtml) {
        result.html = (element as HTMLElement).outerHTML;
      }

      if (!selector) {
        result.title = document.title;
        result.url = window.location.href;
      }

      return result;
    }

    // 在指定标签页执行（extension 环境）
    if (typeof chrome !== 'undefined' && chrome.scripting) {
      const targetTabId = await this.getTargetTabId(tabId);
      
      return await this.executeScriptInTab(
        targetTabId,
        (sel: string | undefined, html: boolean) => {
          const element = sel ? document.querySelector(sel) : document.body;
          if (!element) {
            throw new Error(`Element not found: ${sel}`);
          }

          const result: any = {
            text: (element as HTMLElement).innerText,
          };

          if (html) {
            result.html = (element as HTMLElement).outerHTML;
          }

          if (!sel) {
            result.title = document.title;
            result.url = window.location.href;
          }

          return result;
        },
        [selector, includeHtml || false]
      );
    }

    throw new Error('Document not available');
  }

  /**
   * 截图
   */
  private async takeScreenshot(fullPage?: boolean, tabId?: number): Promise<any> {
    this.emit('screenshot:start', { fullPage, tabId });

    // 在扩展环境中实现
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const targetTabId = await this.getTargetTabId(tabId);
      
      // 如果需要截取特定标签页，先激活它
      if (tabId) {
        await chrome.tabs.update(targetTabId, { active: true });
      }
      
      const dataUrl = await chrome.tabs.captureVisibleTab();
      return { success: true, dataUrl, fullPage: fullPage || false, tabId: targetTabId };
    }

    throw new Error('Screenshot not available in this context');
  }

  /**
   * 等待元素出现
   */
  private async waitForElement(selector: string, timeout: number = 5000, tabId?: number): Promise<any> {
    this.emit('wait-for-element:start', { selector, timeout, tabId });

    // 在当前页面执行（content script 环境）
    if (typeof document !== 'undefined' && !tabId) {
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        const element = document.querySelector(selector);
        if (element) {
          return { success: true, selector, found: true };
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      throw new Error(`Element not found within timeout: ${selector}`);
    }

    // 在指定标签页执行（extension 环境）
    if (typeof chrome !== 'undefined' && chrome.scripting) {
      const targetTabId = await this.getTargetTabId(tabId);
      
      return await this.executeScriptInTab(
        targetTabId,
        async (sel: string, time: number) => {
          const startTime = Date.now();

          while (Date.now() - startTime < time) {
            const element = document.querySelector(sel);
            if (element) {
              return { success: true, selector: sel, found: true };
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          throw new Error(`Element not found within timeout: ${sel}`);
        },
        [selector, timeout]
      );
    }

    throw new Error('Document not available');
  }

  /**
   * 后退
   */
  private async goBack(tabId?: number): Promise<any> {
    // 在当前页面执行
    if (typeof window !== 'undefined' && window.history && !tabId) {
      window.history.back();
      return { success: true };
    }

    // 在指定标签页执行
    if (typeof chrome !== 'undefined' && chrome.scripting) {
      const targetTabId = await this.getTargetTabId(tabId);
      
      return await this.executeScriptInTab(
        targetTabId,
        () => {
          window.history.back();
          return { success: true };
        }
      );
    }

    throw new Error('Navigation not available');
  }

  /**
   * 前进
   */
  private async goForward(tabId?: number): Promise<any> {
    // 在当前页面执行
    if (typeof window !== 'undefined' && window.history && !tabId) {
      window.history.forward();
      return { success: true };
    }

    // 在指定标签页执行
    if (typeof chrome !== 'undefined' && chrome.scripting) {
      const targetTabId = await this.getTargetTabId(tabId);
      
      return await this.executeScriptInTab(
        targetTabId,
        () => {
          window.history.forward();
          return { success: true };
        }
      );
    }

    throw new Error('Navigation not available');
  }

  /**
   * 重新加载页面
   */
  private async reloadPage(hard?: boolean, tabId?: number): Promise<any> {
    // 在当前页面执行
    if (typeof window !== 'undefined' && !tabId) {
      window.location.reload();
      return { success: true, hard: hard || false };
    }

    // 在指定标签页执行
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const targetTabId = await this.getTargetTabId(tabId);
      await chrome.tabs.reload(targetTabId, { bypassCache: hard });
      return { success: true, hard: hard || false, tabId: targetTabId };
    }

    throw new Error('Window not available');
  }

  /**
   * 执行脚本
   */
  private async runScript(code: string, tabId?: number): Promise<any> {
    this.emit('execute-script:start', { code, tabId });

    // 在当前页面执行（content script 环境）
    if (typeof window !== 'undefined' && !tabId) {
      try {
        // eslint-disable-next-line no-eval
        const result = eval(code);
        return { success: true, result };
      } catch (error) {
        throw new Error(`Script execution failed: ${error}`);
      }
    }

    // 在指定标签页执行（extension 环境）
    if (typeof chrome !== 'undefined' && chrome.scripting) {
      const targetTabId = await this.getTargetTabId(tabId);
      
      return await this.executeScriptInTab(
        targetTabId,
        (codeStr: string) => {
          try {
            // eslint-disable-next-line no-eval
            const result = eval(codeStr);
            return { success: true, result };
          } catch (error) {
            throw new Error(`Script execution failed: ${error}`);
          }
        },
        [code]
      );
    }

    throw new Error('Window not available');
  }

  // ============ 标签页管理方法 ============

  /**
   * 创建新标签页
   */
  private async createTab(url?: string, active: boolean = true): Promise<any> {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const tab = await chrome.tabs.create({ url, active });
      return { 
        success: true, 
        tabId: tab.id, 
        url: tab.url,
        active: tab.active 
      };
    }

    throw new Error('Tab creation not available in this context');
  }

  /**
   * 关闭标签页
   */
  private async closeTab(tabId: number): Promise<any> {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      await chrome.tabs.remove(tabId);
      return { success: true, tabId };
    }

    throw new Error('Tab closure not available in this context');
  }

  /**
   * 切换到指定标签页
   */
  private async switchTab(tabId: number): Promise<any> {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      await chrome.tabs.update(tabId, { active: true });
      
      // 获取标签页所在窗口并激活
      const tab = await chrome.tabs.get(tabId);
      if (tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
      
      return { 
        success: true, 
        tabId,
        url: tab.url,
        title: tab.title 
      };
    }

    throw new Error('Tab switching not available in this context');
  }

  /**
   * 列出所有标签页
   */
  private async listTabs(currentWindowOnly: boolean = true): Promise<any> {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const query: chrome.tabs.QueryInfo = currentWindowOnly 
        ? { currentWindow: true } 
        : {};
      
      const tabs = await chrome.tabs.query(query);
      
      return {
        success: true,
        count: tabs.length,
        tabs: tabs.map(tab => ({
          id: tab.id,
          url: tab.url,
          title: tab.title,
          active: tab.active,
          windowId: tab.windowId,
        })),
      };
    }

    throw new Error('Tab listing not available in this context');
  }

  /**
   * 获取当前活动标签页
   */
  private async getActiveTab(): Promise<any> {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab) {
        return {
          success: true,
          tabId: tab.id,
          url: tab.url,
          title: tab.title,
          windowId: tab.windowId,
        };
      }
      
      throw new Error('No active tab found');
    }

    throw new Error('Tab query not available in this context');
  }
}
