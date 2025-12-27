import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium, Browser, Page } from 'playwright';
import type { ILLMClient } from '@monkey-agent/types';
import { BrowserAgent } from '@monkey-agent/agents';

/**
 * Browser Adapter
 * 
 * 职责：
 * - 管理 Playwright Browser 实例生命周期
 * - 提供两种连接模式：CDP 连接 / 独立启动
 * - 创建 PlaywrightBrowserAgent
 * 
 * ❌ 不包含 Agent 实现（在 @monkey-agent/agents 中）
 */
@Injectable()
export class BrowserAdapter implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserAdapter.name);
  private browser?: Browser;
  private page?: Page;

  constructor(private config: ConfigService) {}

  /**
   * 连接到用户浏览器（CDP 模式）
   */
  async connectToBrowser(): Promise<void> {
    const cdpUrl = this.config.get('BROWSER_CDP_URL', 'http://localhost:9222');
    
    try {
      this.logger.log(`Connecting to browser via CDP: ${cdpUrl}`);
      this.browser = await chromium.connectOverCDP(cdpUrl);
      
      const contexts = this.browser.contexts();
      if (contexts.length > 0) {
        const pages = contexts[0].pages();
        this.page = pages.length > 0 ? pages[0] : await contexts[0].newPage();
      } else {
        const context = await this.browser.newContext();
        this.page = await context.newPage();
      }
      
      this.logger.log('Connected to browser successfully');
    } catch (error: any) {
      this.logger.error(`Failed to connect to browser: ${error.message}`);
      throw new Error(`Failed to connect to browser via CDP. Make sure Chrome is running with --remote-debugging-port=9222`);
    }
  }

  /**
   * 启动独立浏览器
   */
  async launchBrowser(): Promise<void> {
    const headless = this.config.get('BROWSER_HEADLESS', 'false') === 'true';
    
    try {
      this.logger.log(`Launching browser (headless: ${headless})`);
      this.browser = await chromium.launch({ 
        headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      
      const context = await this.browser.newContext();
      this.page = await context.newPage();
      
      this.logger.log('Browser launched successfully');
    } catch (error: any) {
      this.logger.error(`Failed to launch browser: ${error.message}`);
      throw error;
    }
  }

  /**
   * 创建 BrowserAgent
   * 
   * @param llmClient LLM 客户端实例
   * @returns BrowserAgent 实例（来自 @monkey-agent/agents）
   */
  async createBrowserAgent(llmClient: ILLMClient): Promise<BrowserAgent> {
    // 如果还没有连接，先连接
    if (!this.browser || !this.page) {
      const mode = this.config.get('BROWSER_MODE', 'cdp');
      
      if (mode === 'cdp') {
        await this.connectToBrowser();
      } else {
        await this.launchBrowser();
      }
    }

    // 创建 Agent（来自 @monkey-agent/agents）
    return new BrowserAgent({
      llmClient,
      browser: this.browser!,
      page: this.page!,
    });
  }

  /**
   * 获取当前 Page 实例
   */
  getPage(): Page | undefined {
    return this.page;
  }

  /**
   * 获取当前 Browser 实例
   */
  getBrowser(): Browser | undefined {
    return this.browser;
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      this.logger.log('Closing browser');
      await this.browser.close();
      this.browser = undefined;
      this.page = undefined;
    }
  }

  /**
   * 模块销毁时清理
   */
  async onModuleDestroy() {
    await this.cleanup();
  }
}

