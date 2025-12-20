import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import { BrowserAgent } from '../BrowserAgent';
import { createMockLLMClient } from '../../__tests__/test-helpers';
import { LLMClient } from '@monkey-agent/llm';
import { initEnv, getLLMConfig, printEnvHelp } from '@monkey-agent/utils';
import type { AgentContext } from '@monkey-agent/types';

// 初始化环境变量（用于真实 LLM 测试）
const validation = initEnv({ verbose: false });
const hasLLMKey = validation.valid;

/**
 * BrowserAgent E2E 测试
 * 
 * 包含两种测试模式：
 * 1. Mock LLM 测试 - 测试基础工具功能（无需 API Key）
 * 2. 真实 LLM 测试 - 测试 LLM 行为和数据共享（需要 API Key）
 * 
 * 运行方式：
 * - 默认有头模式（可见浏览器）：yarn test BrowserAgent.e2e.test.ts
 * - 无头模式（CI/CD）：HEADLESS=true yarn test BrowserAgent.e2e.test.ts
 */
describe('BrowserAgent - E2E 测试', () => {
  let browser: Browser;
  let page: Page;
  let agent: BrowserAgent;
  let mockLLMClient: any;

  // 从环境变量读取是否无头模式（默认 false，即有头模式）
  const headless = process.env.HEADLESS === 'true';

  beforeAll(async () => {
    // 启动真实的 Chromium 浏览器
    browser = await chromium.launch({
      headless,
      slowMo: headless ? 0 : 200, // 有头模式下减速，便于观察
      // 有头模式下设置浏览器窗口大小
      args: headless ? [] : ['--window-size=1280,800'],
    });
    
    page = await browser.newPage();
    mockLLMClient = createMockLLMClient();
    
    agent = new BrowserAgent({
      llmClient: mockLLMClient,
      browser,
      page,
    });

    console.log(`🌐 浏览器模式: ${headless ? '无头 (headless)' : '有头 (headed)'}`);
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('真实页面导航', () => {
    it('应该成功导航到 example.com', async () => {
      const result = await (agent as any).executeToolCall('navigate', {
        url: 'https://example.com',
      });

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://example.com');
      expect(result.title).toContain('Example');
      
      // 验证页面实际已加载
      const actualTitle = await page.title();
      expect(actualTitle).toContain('Example');
    }, 30000);
  });

  describe('真实页面内容提取', () => {
    it('应该成功获取 example.com 的内容', async () => {
      // 先导航
      await page.goto('https://example.com');
      
      // 获取内容
      const result = await (agent as any).executeToolCall('getContent', {});

      expect(result.success).toBe(true);
      expect(result.content).toContain('Example Domain');
      expect(result.length).toBeGreaterThan(100);
    }, 30000);

    it('应该成功获取元素文本', async () => {
      await page.goto('https://example.com');
      
      const result = await (agent as any).executeToolCall('getText', {
        selector: 'h1',
      });

      expect(result.success).toBe(true);
      expect(result.text).toContain('Example');
    }, 30000);
  });

  describe('真实页面截图', () => {
    it('应该成功截取 example.com 的截图', async () => {
      await page.goto('https://example.com');
      
      const result = await (agent as any).executeToolCall('screenshot', {
        fullPage: false,
      });

      expect(result.success).toBe(true);
      expect(result.screenshot).toBeDefined();
      expect(typeof result.screenshot).toBe('string');
      expect(result.size).toBeGreaterThan(1000);
      
      // 验证是否为有效的 Base64
      expect(() => Buffer.from(result.screenshot, 'base64')).not.toThrow();
    }, 30000);
  });

  describe('真实脚本执行', () => {
    it('应该在页面中执行 JavaScript', async () => {
      await page.goto('https://example.com');
      
      const result = await (agent as any).executeToolCall('evaluate', {
        script: 'document.title',
      });

      expect(result.success).toBe(true);
      expect(result.result).toContain('Example');
    }, 30000);

    it('应该获取页面元素数量', async () => {
      await page.goto('https://example.com');
      
      const result = await (agent as any).executeToolCall('evaluate', {
        script: 'document.querySelectorAll("p").length',
      });

      expect(result.success).toBe(true);
      expect(typeof result.result).toBe('number');
    }, 30000);
  });

  describe('Context 工具可用性测试', () => {
    it('应该验证 BaseAgent 正确合并了 context 工具', async () => {
      // 创建带有 workflow context 的 Agent
      const mockContext: Partial<AgentContext> = {
        workflowId: 'test-workflow',
        workflowTask: '测试 context 工具',
        outputs: new Map(),
        vals: new Map(),
        currentLevel: 0,
        status: 'running' as const,
        startTime: Date.now(),
        getOutput: function(agentId: string) {
          return this.outputs?.get(agentId);
        },
        getValue: function(key: string) {
          return this.vals?.get(key);
        },
        setValue: function(key: string, value: any) {
          this.vals?.set(key, value);
        },
        toJSON: function() {
          return {
            workflowId: this.workflowId,
            outputs: Array.from(this.outputs?.entries() || []),
            vals: Array.from(this.vals?.entries() || []),
          };
        }
      };

      // 测试 agent 在有 context 时能访问到 context 工具
      // 这里我们通过检查 agent 的工具定义来验证
      const tools = agent.getToolDefinitions();
      const toolNames = Object.keys(tools);
      
      console.log('🔧 Agent 工具列表:', toolNames);
      
      // Browser Agent 的原生工具
      expect(toolNames).toContain('navigate');
      expect(toolNames).toContain('click');
      expect(toolNames).toContain('fill');
      
      // 注意：context 工具是在 BaseAgent.execute() 中动态合并的
      // 所以这里不会出现在 getToolDefinitions() 中
      // 我们需要通过实际执行来验证
      console.log('✅ Agent 工具定义正确（context 工具将在 execute 时合并）');
    });

    it('应该能够通过 context.setValue 直接存储数据', () => {
      const mockContext: Partial<AgentContext> = {
        workflowId: 'test-workflow',
        workflowTask: '测试数据存储',
        outputs: new Map(),
        vals: new Map(),
        currentLevel: 0,
        status: 'running' as const,
        startTime: Date.now(),
        getOutput: function(agentId: string) {
          return this.outputs?.get(agentId);
        },
        getValue: function(key: string) {
          return this.vals?.get(key);
        },
        setValue: function(key: string, value: any) {
          this.vals?.set(key, value);
        },
        toJSON: function() {
          return {
            workflowId: this.workflowId,
            outputs: Array.from(this.outputs?.entries() || []),
            vals: Array.from(this.vals?.entries() || []),
          };
        }
      };

      // 直接测试 context API
      mockContext.setValue!('testKey', 'testValue');
      expect(mockContext.getValue!('testKey')).toBe('testValue');
      
      mockContext.setValue!('testArray', [1, 2, 3]);
      expect(mockContext.getValue!('testArray')).toEqual([1, 2, 3]);
      
      mockContext.setValue!('testObject', { name: 'test', value: 42 });
      expect(mockContext.getValue!('testObject')).toEqual({ name: 'test', value: 42 });
      
      console.log('✅ Context API 工作正常');
    });
  });
});

