import { describe, it, expect, beforeEach, vi } from 'vitest';
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

    it('应该包含所有 18 个工具', () => {
      const tools = (agent as any).getToolDefinitions();
      const toolNames = Object.keys(tools);
      expect(toolNames).toHaveLength(18);
      
      // 导航工具
      expect(toolNames).toContain('navigate');
      expect(toolNames).toContain('goBack');
      expect(toolNames).toContain('reload');
      
      // 交互工具
      expect(toolNames).toContain('click');
      expect(toolNames).toContain('fill');
      expect(toolNames).toContain('selectOption');
      expect(toolNames).toContain('check');
      expect(toolNames).toContain('hover');
      expect(toolNames).toContain('press');
      
      // 等待工具
      expect(toolNames).toContain('waitForSelector');
      
      // 提取工具
      expect(toolNames).toContain('getContent');
      expect(toolNames).toContain('getPageText');
      expect(toolNames).toContain('getPageSummary');
      expect(toolNames).toContain('getText');
      expect(toolNames).toContain('getTexts');
      expect(toolNames).toContain('getAttribute');
      expect(toolNames).toContain('extractTable');
      expect(toolNames).toContain('extractList');
      
      // 其他工具
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

  // ============ 新增工具测试 ============
  
  describe('goBack 工具', () => {
    it('应该成功后退', async () => {
      mockPage.goBack.mockResolvedValue(undefined);
      mockPage.title.mockResolvedValue('Previous Page');

      const result = await (agent as any).executeToolCall('goBack', {});

      assertSuccessFormat(result);
      expect(result.title).toBe('Previous Page');
      expect(mockPage.goBack).toHaveBeenCalled();
    });

    it('应该处理后退错误', async () => {
      mockPage.goBack.mockRejectedValue(new Error('No history'));

      const result = await (agent as any).executeToolCall('goBack', {});

      assertErrorFormat(result);
      expect(result.errorType).toBeDefined();
      expect(result.suggestion).toBeDefined();
    });
  });

  describe('reload 工具', () => {
    it('应该成功刷新页面', async () => {
      mockPage.reload.mockResolvedValue(undefined);
      mockPage.title.mockResolvedValue('Reloaded Page');

      const result = await (agent as any).executeToolCall('reload', {});

      assertSuccessFormat(result);
      expect(result.title).toBe('Reloaded Page');
      expect(mockPage.reload).toHaveBeenCalled();
    });

    it('应该支持硬刷新', async () => {
      mockPage.reload.mockResolvedValue(undefined);
      mockPage.title.mockResolvedValue('Hard Reloaded');

      const result = await (agent as any).executeToolCall('reload', { hard: true });

      assertSuccessFormat(result);
      expect(result.hard).toBe(true);
    });
  });

  describe('selectOption 工具', () => {
    it('应该成功选择单个选项', async () => {
      mockPage.selectOption.mockResolvedValue(['option1']);

      const result = await (agent as any).executeToolCall('selectOption', {
        selector: 'select#country',
        value: 'option1'
      });

      assertSuccessFormat(result);
      expect(result.selectedValues).toEqual(['option1']);
      expect(mockPage.selectOption).toHaveBeenCalledWith('select#country', ['option1'], expect.any(Object));
    });

    it('应该支持多选', async () => {
      mockPage.selectOption.mockResolvedValue(['opt1', 'opt2']);

      const result = await (agent as any).executeToolCall('selectOption', {
        selector: 'select#languages',
        value: ['opt1', 'opt2']
      });

      assertSuccessFormat(result);
      expect(result.selectedValues).toEqual(['opt1', 'opt2']);
    });
  });

  describe('check 工具', () => {
    it('应该成功勾选复选框', async () => {
      mockPage.check.mockResolvedValue(undefined);

      const result = await (agent as any).executeToolCall('check', {
        selector: 'input#agree'
      });

      assertSuccessFormat(result);
      expect(result.checked).toBe(true);
      expect(mockPage.check).toHaveBeenCalledWith('input#agree', expect.any(Object));
    });

    it('应该成功取消勾选', async () => {
      mockPage.uncheck.mockResolvedValue(undefined);

      const result = await (agent as any).executeToolCall('check', {
        selector: 'input#agree',
        checked: false
      });

      assertSuccessFormat(result);
      expect(result.checked).toBe(false);
      expect(mockPage.uncheck).toHaveBeenCalled();
    });
  });

  describe('hover 工具', () => {
    it('应该成功悬停元素', async () => {
      mockPage.hover.mockResolvedValue(undefined);

      const result = await (agent as any).executeToolCall('hover', {
        selector: '.menu-item'
      });

      assertSuccessFormat(result);
      expect(result.selector).toBe('.menu-item');
      expect(mockPage.hover).toHaveBeenCalledWith('.menu-item', expect.any(Object));
    });
  });

  describe('press 工具', () => {
    it('应该在页面级别按键', async () => {
      mockPage.keyboard = { press: vi.fn().mockResolvedValue(undefined) };

      const result = await (agent as any).executeToolCall('press', {
        key: 'Enter'
      });

      assertSuccessFormat(result);
      expect(result.key).toBe('Enter');
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
    });

    it('应该在元素上按键', async () => {
      mockPage.focus.mockResolvedValue(undefined);
      mockPage.keyboard = { press: vi.fn().mockResolvedValue(undefined) };

      const result = await (agent as any).executeToolCall('press', {
        selector: 'input#search',
        key: 'Tab'
      });

      assertSuccessFormat(result);
      expect(mockPage.focus).toHaveBeenCalledWith('input#search', expect.any(Object));
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Tab');
    });
  });

  describe('getTexts 工具', () => {
    it('应该获取多个元素的文本', async () => {
      mockPage.evaluate.mockResolvedValue(['Item 1', 'Item 2', 'Item 3']);

      const result = await (agent as any).executeToolCall('getTexts', {
        selector: '.list-item'
      });

      assertSuccessFormat(result);
      expect(result.texts).toEqual(['Item 1', 'Item 2', 'Item 3']);
      expect(result.count).toBe(3);
    });

    it('应该支持限制数量', async () => {
      mockPage.evaluate.mockResolvedValue(['Item 1', 'Item 2']);

      const result = await (agent as any).executeToolCall('getTexts', {
        selector: '.item',
        limit: 2
      });

      assertSuccessFormat(result);
      expect(result.count).toBe(2);
    });
  });

  describe('extractTable 工具', () => {
    it('应该提取表格数据为JSON数组', async () => {
      const mockTableData = [
        { Name: 'Alice', Age: '25' },
        { Name: 'Bob', Age: '30' }
      ];
      mockPage.evaluate.mockResolvedValue(mockTableData);

      const result = await (agent as any).executeToolCall('extractTable', {
        selector: 'table.data'
      });

      assertSuccessFormat(result);
      expect(result.data).toEqual(mockTableData);
      expect(result.rowCount).toBe(2);
    });

    it('应该处理表格不存在', async () => {
      mockPage.evaluate.mockResolvedValue(null);

      const result = await (agent as any).executeToolCall('extractTable', {
        selector: 'table.missing'
      });

      assertErrorFormat(result);
      expect(result.errorType).toBe('ELEMENT_NOT_FOUND');
      expect(result.suggestion).toContain('selector');
    });
  });

  describe('extractList 工具', () => {
    it('应该提取列表项为数组', async () => {
      const mockItems = ['Product 1', 'Product 2', 'Product 3'];
      mockPage.evaluate.mockResolvedValue(mockItems);

      const result = await (agent as any).executeToolCall('extractList', {
        selector: 'ul.products',
        itemSelector: 'li'
      });

      assertSuccessFormat(result);
      expect(result.items).toEqual(mockItems);
      expect(result.count).toBe(3);
    });

    it('应该处理容器不存在', async () => {
      mockPage.evaluate.mockResolvedValue(null);

      const result = await (agent as any).executeToolCall('extractList', {
        selector: 'ul.missing',
        itemSelector: 'li'
      });

      assertErrorFormat(result);
      expect(result.errorType).toBe('ELEMENT_NOT_FOUND');
    });
  });

  describe('增强的 click 工具', () => {
    it('应该支持双击', async () => {
      mockPage.click.mockResolvedValue(undefined);
      mockPage.$.mockResolvedValue(null);

      const result = await (agent as any).executeToolCall('click', {
        selector: '.item',
        clickCount: 2
      });

      assertSuccessFormat(result);
      expect(result.meta.clickCount).toBe(2);
      expect(mockPage.click).toHaveBeenCalledWith('.item', expect.objectContaining({ clickCount: 2 }));
    });

    it('应该支持右键点击', async () => {
      mockPage.click.mockResolvedValue(undefined);
      mockPage.$.mockResolvedValue(null);

      const result = await (agent as any).executeToolCall('click', {
        selector: '.item',
        button: 'right'
      });

      assertSuccessFormat(result);
      expect(result.meta.button).toBe('right');
      expect(mockPage.click).toHaveBeenCalledWith('.item', expect.objectContaining({ button: 'right' }));
    });

    it('应该支持强制点击', async () => {
      mockPage.click.mockResolvedValue(undefined);
      mockPage.$.mockResolvedValue(null);

      const result = await (agent as any).executeToolCall('click', {
        selector: '.hidden',
        force: true
      });

      assertSuccessFormat(result);
      expect(mockPage.click).toHaveBeenCalledWith('.hidden', expect.objectContaining({ force: true }));
    });
  });

  describe('错误处理增强', () => {
    it('应该分类超时错误', async () => {
      mockPage.click.mockRejectedValue(new Error('Timeout 30000ms exceeded'));

      const result = await (agent as any).executeToolCall('click', {
        selector: '.slow'
      });

      assertErrorFormat(result);
      expect(result.errorType).toBe('TIMEOUT');
      expect(result.suggestion).toContain('timeout');
    });

    it('应该分类元素未找到错误', async () => {
      mockPage.click.mockRejectedValue(new Error('Element not found'));

      const result = await (agent as any).executeToolCall('click', {
        selector: '.missing'
      });

      assertErrorFormat(result);
      expect(result.errorType).toBe('ELEMENT_NOT_FOUND');
      expect(result.suggestion).toContain('getPageSummary');
    });

    it('应该分类元素不可见错误', async () => {
      mockPage.click.mockRejectedValue(new Error('Element is not visible'));

      const result = await (agent as any).executeToolCall('click', {
        selector: '.hidden'
      });

      assertErrorFormat(result);
      expect(result.errorType).toBe('ELEMENT_NOT_VISIBLE');
      expect(result.suggestion).toContain('force');
    });

    it('应该分类网络错误', async () => {
      mockPage.goto.mockRejectedValue(new Error('net::ERR_CONNECTION_REFUSED'));

      const result = await (agent as any).executeToolCall('navigate', {
        url: 'http://invalid.local'
      });

      assertErrorFormat(result);
      expect(result.errorType).toBe('NETWORK_ERROR');
      expect(result.suggestion).toContain('Network');
    });
  });
});

