import { describe, it, expect, beforeEach } from 'vitest';
import { BrowserAgent } from '../BrowserAgent';
import {
  createMockLLMClient,
  createMockPage,
  createMockBrowser,
  assertSuccessFormat,
  assertErrorFormat,
} from '../../__tests__/test-helpers';

describe('BrowserAgent', () => {
  let agent: BrowserAgent;
  let mockPage: any;
  let mockBrowser: any;
  let mockLLMClient: any;

  beforeEach(() => {
    mockPage = createMockPage();
    mockBrowser = createMockBrowser(mockPage);
    mockLLMClient = createMockLLMClient();

    agent = new BrowserAgent({
      llmClient: mockLLMClient,
      browser: mockBrowser,
      page: mockPage,
    });
  });

  describe('初始化', () => {
    it('应该成功创建 Agent', () => {
      expect(agent).toBeDefined();
      expect(agent.id).toBe('browser-agent');
      expect(agent.name).toBe('Browser Agent');
      expect(agent.capabilities).toContain('navigate');
    });

    it('应该包含所有 9 个工具', () => {
      const tools = (agent as any).getToolDefinitions();
      const toolNames = Object.keys(tools);
      expect(toolNames).toHaveLength(9);
      expect(toolNames).toContain('navigate');
      expect(toolNames).toContain('click');
      expect(toolNames).toContain('fill');
      expect(toolNames).toContain('waitForSelector');
      expect(toolNames).toContain('getContent');
      expect(toolNames).toContain('getText');
      expect(toolNames).toContain('getAttribute');
      expect(toolNames).toContain('screenshot');
      expect(toolNames).toContain('evaluate');
    });
  });

  describe('navigate 工具', () => {
    it('应该成功导航到 URL', async () => {
      const result = await (agent as any).executeToolCall('navigate', {
        url: 'https://example.com',
      });

      assertSuccessFormat(result);
      expect(result.url).toBe('https://example.com');
      expect(result.title).toBe('Test Page');
      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({ waitUntil: 'networkidle' })
      );
    });

    it('应该处理导航错误', async () => {
      mockPage.goto.mockRejectedValue(new Error('Network error'));

      const result = await (agent as any).executeToolCall('navigate', {
        url: 'https://invalid.com',
      });

      assertErrorFormat(result);
      expect(result.error).toContain('Network error');
    });

    it('应该处理超时', async () => {
      mockPage.goto.mockRejectedValue(new Error('Timeout exceeded'));

      const result = await (agent as any).executeToolCall('navigate', {
        url: 'https://slow.com',
      });

      assertErrorFormat(result);
      expect(result.error).toContain('Timeout');
    });
  });

  describe('click 工具', () => {
    it('应该成功点击元素', async () => {
      const result = await (agent as any).executeToolCall('click', {
        selector: '.button',
      });

      assertSuccessFormat(result);
      expect(result.selector).toBe('.button');
      expect(mockPage.click).toHaveBeenCalledWith('.button', expect.any(Object));
    });

    it('应该处理元素不存在', async () => {
      mockPage.click.mockRejectedValue(new Error('Element not found'));

      const result = await (agent as any).executeToolCall('click', {
        selector: '.nonexistent',
      });

      assertErrorFormat(result);
      expect(result.error).toContain('Element not found');
    });

    it('应该处理点击超时', async () => {
      mockPage.click.mockRejectedValue(new Error('Timeout 5000ms exceeded'));

      const result = await (agent as any).executeToolCall('click', {
        selector: '.slow-button',
      });

      assertErrorFormat(result);
      expect(result.error).toContain('Timeout');
    });
  });

  describe('fill 工具', () => {
    it('应该成功填写输入框', async () => {
      const result = await (agent as any).executeToolCall('fill', {
        selector: 'input[name="email"]',
        value: 'test@example.com',
      });

      assertSuccessFormat(result);
      expect(result.selector).toBe('input[name="email"]');
      expect(result.value).toBe('test@example.com');
      expect(mockPage.fill).toHaveBeenCalledWith(
        'input[name="email"]',
        'test@example.com',
        expect.any(Object)
      );
    });

    it('应该处理元素不存在', async () => {
      mockPage.fill.mockRejectedValue(new Error('Element not found'));

      const result = await (agent as any).executeToolCall('fill', {
        selector: 'input[name="missing"]',
        value: 'test',
      });

      assertErrorFormat(result);
      expect(result.error).toContain('Element not found');
    });

    it('应该处理只读元素', async () => {
      mockPage.fill.mockRejectedValue(new Error('Element is not editable'));

      const result = await (agent as any).executeToolCall('fill', {
        selector: 'input[readonly]',
        value: 'test',
      });

      assertErrorFormat(result);
      expect(result.error).toContain('not editable');
    });
  });

  describe('waitForSelector 工具', () => {
    it('应该成功等待元素出现', async () => {
      const result = await (agent as any).executeToolCall('waitForSelector', {
        selector: '.dynamic-content',
        timeout: 5000,
      });

      assertSuccessFormat(result);
      expect(result.selector).toBe('.dynamic-content');
      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        '.dynamic-content',
        expect.objectContaining({ timeout: 5000 })
      );
    });

    it('应该处理等待超时', async () => {
      mockPage.waitForSelector.mockRejectedValue(new Error('Timeout exceeded'));

      const result = await (agent as any).executeToolCall('waitForSelector', {
        selector: '.never-appears',
        timeout: 1000,
      });

      assertErrorFormat(result);
      expect(result.error).toContain('Timeout');
    });
  });

  describe('getContent 工具', () => {
    it('应该成功获取页面内容', async () => {
      const mockContent = '<html><body><h1>Test</h1></body></html>';
      mockPage.content.mockResolvedValue(mockContent);

      const result = await (agent as any).executeToolCall('getContent', {});

      assertSuccessFormat(result);
      expect(result.content).toBe(mockContent);
      expect(result.length).toBe(mockContent.length);
    });

    it('应该处理获取内容错误', async () => {
      mockPage.content.mockRejectedValue(new Error('Page not loaded'));

      const result = await (agent as any).executeToolCall('getContent', {});

      assertErrorFormat(result);
      expect(result.error).toContain('Page not loaded');
    });
  });

  describe('getText 工具', () => {
    it('应该成功获取元素文本', async () => {
      mockPage.textContent.mockResolvedValue('Button Text');

      const result = await (agent as any).executeToolCall('getText', {
        selector: '.button',
      });

      assertSuccessFormat(result);
      expect(result.text).toBe('Button Text');
      expect(result.selector).toBe('.button');
    });

    it('应该处理元素不存在', async () => {
      mockPage.textContent.mockRejectedValue(new Error('Element not found'));

      const result = await (agent as any).executeToolCall('getText', {
        selector: '.missing',
      });

      assertErrorFormat(result);
      expect(result.error).toContain('Element not found');
    });

    it('应该处理空文本', async () => {
      mockPage.textContent.mockResolvedValue(null);

      const result = await (agent as any).executeToolCall('getText', {
        selector: '.empty',
      });

      assertSuccessFormat(result);
      expect(result.text).toBeNull();
    });
  });

  describe('getAttribute 工具', () => {
    it('应该成功获取元素属性', async () => {
      mockPage.getAttribute.mockResolvedValue('https://example.com');

      const result = await (agent as any).executeToolCall('getAttribute', {
        selector: 'a.link',
        attribute: 'href',
      });

      assertSuccessFormat(result);
      expect(result.value).toBe('https://example.com');
      expect(result.attribute).toBe('href');
    });

    it('应该处理属性不存在', async () => {
      mockPage.getAttribute.mockResolvedValue(null);

      const result = await (agent as any).executeToolCall('getAttribute', {
        selector: '.element',
        attribute: 'data-missing',
      });

      assertSuccessFormat(result);
      expect(result.value).toBeNull();
    });

    it('应该处理元素不存在', async () => {
      mockPage.getAttribute.mockRejectedValue(new Error('Element not found'));

      const result = await (agent as any).executeToolCall('getAttribute', {
        selector: '.missing',
        attribute: 'href',
      });

      assertErrorFormat(result);
      expect(result.error).toContain('Element not found');
    });
  });

  describe('screenshot 工具', () => {
    it('应该成功截取全屏', async () => {
      const fakeScreenshot = Buffer.from('fake-image-data');
      mockPage.screenshot.mockResolvedValue(fakeScreenshot);

      const result = await (agent as any).executeToolCall('screenshot', {
        fullPage: true,
      });

      assertSuccessFormat(result);
      expect(result.screenshot).toBe(fakeScreenshot.toString('base64'));
      expect(result.size).toBe(fakeScreenshot.length);
    });

    it('应该验证 Base64 格式', async () => {
      const fakeScreenshot = Buffer.from('test-image');
      mockPage.screenshot.mockResolvedValue(fakeScreenshot);

      const result = await (agent as any).executeToolCall('screenshot', {});

      assertSuccessFormat(result);
      // 验证是有效的 base64
      expect(result.screenshot).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('应该处理截图错误', async () => {
      mockPage.screenshot.mockRejectedValue(new Error('Screenshot failed'));

      const result = await (agent as any).executeToolCall('screenshot', {});

      assertErrorFormat(result);
      expect(result.error).toContain('Screenshot failed');
    });
  });

  describe('evaluate 工具', () => {
    it('应该成功执行脚本', async () => {
      mockPage.evaluate.mockResolvedValue({ count: 5 });

      const result = await (agent as any).executeToolCall('evaluate', {
        script: 'document.querySelectorAll("div").length',
      });

      assertSuccessFormat(result);
      expect(result.result).toEqual({ count: 5 });
    });

    it('应该处理脚本返回值', async () => {
      mockPage.evaluate.mockResolvedValue('string result');

      const result = await (agent as any).executeToolCall('evaluate', {
        script: 'document.title',
      });

      assertSuccessFormat(result);
      expect(result.result).toBe('string result');
    });

    it('应该处理脚本执行错误', async () => {
      mockPage.evaluate.mockRejectedValue(new Error('Script execution failed'));

      const result = await (agent as any).executeToolCall('evaluate', {
        script: 'invalid.code()',
      });

      assertErrorFormat(result);
      expect(result.error).toContain('Script execution failed');
    });
  });

  describe('错误处理', () => {
    it('应该处理未知工具', async () => {
      const result = await (agent as any).executeToolCall('unknownTool', {});

      assertErrorFormat(result);
      expect(result.error).toContain('Unknown tool');
    });

    it('应该返回统一错误格式', async () => {
      mockPage.click.mockRejectedValue(new Error('Test error'));

      const result = await (agent as any).executeToolCall('click', {
        selector: '.test',
      });

      // 验证统一格式
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('message');
      expect(result.success).toBe(false);
      expect(typeof result.error).toBe('string');
      expect(typeof result.message).toBe('string');
    });

    it('应该捕获所有异常', async () => {
      mockPage.goto.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await (agent as any).executeToolCall('navigate', {
        url: 'https://test.com',
      });

      assertErrorFormat(result);
      expect(result.error).toBeDefined();
    });
  });
});


