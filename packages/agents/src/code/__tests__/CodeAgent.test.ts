import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { CodeAgent } from '../CodeAgent';
import {
  initTestEnv,
  skipIfNoApiKey,
  TestSandboxManager,
  testCode,
  assertions,
} from '../sandbox/__tests__/test-helpers';
import { initEnv, getLLMConfig } from '@monkey-agent/utils';

// 初始化测试环境
initTestEnv();

// 获取 LLM 配置
let llmConfig: any;
try {
  const validation = initEnv({ verbose: false });
  if (validation.valid) {
    llmConfig = getLLMConfig();
  } else {
    // 如果没有 LLM API Key，使用 mock 配置
    llmConfig = {
      provider: 'openai' as const,
      apiKey: 'sk-mock-key-for-testing',
      model: 'gpt-4',
    };
  }
} catch (error) {
  // 出错时使用 mock 配置
  llmConfig = {
    provider: 'openai' as const,
    apiKey: 'sk-mock-key-for-testing',
    model: 'gpt-4',
  };
}

describe('CodeAgent', () => {
  let sandboxManager: TestSandboxManager;

  beforeAll(() => {
    skipIfNoApiKey();
    sandboxManager = new TestSandboxManager();
  });

  afterEach(async () => {
    await sandboxManager.cleanupAll();
  });

  describe('基础功能', () => {
    it('应该成功创建 CodeAgent 实例', () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig,
      });

      expect(agent).toBeDefined();
      expect(agent.name).toBe('Code Agent');
      expect(agent.description).toContain('代码执行');
    });

    it('应该提供正确的工具定义', () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig,
      });

      const tools = agent.getToolDefinitions();
      const toolNames = Object.keys(tools);
      expect(toolNames).toHaveLength(5);
      
      expect(toolNames).toContain('executeCode');
      expect(toolNames).toContain('installDependency');
      expect(toolNames).toContain('runShellCommand');
      expect(toolNames).toContain('readFile');
      expect(toolNames).toContain('writeFile');
    });
  });

  describe('代码执行', () => {
    it('应该成功执行 Python 代码', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
      });

      const result = await agent['executeCode']({
        language: 'python',
        code: testCode.python.hello,
      });

      assertions.assertCodeSuccess(result);
      expect(result.output).toContain('Hello from Python');

      await agent.cleanup();
    }, 60000);

    it('应该成功执行 JavaScript 代码', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
      });

      const result = await agent['executeCode']({
        language: 'javascript',
        code: testCode.javascript.hello,
      });

      assertions.assertCodeSuccess(result);
      expect(result.output).toContain('Hello from JavaScript');

      await agent.cleanup();
    }, 60000);

    it('应该成功执行 Bash 代码', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
      });

      const result = await agent['executeCode']({
        language: 'bash',
        code: testCode.bash.hello,
      });

      assertions.assertCodeSuccess(result);
      expect(result.output).toContain('Hello from Bash');

      await agent.cleanup();
    }, 60000);

    it('应该处理代码执行错误', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
      });

      const result = await agent['executeCode']({
        language: 'python',
        code: testCode.python.error,
      });

      assertions.assertCodeError(result);
      expect(result.error).toContain('NameError');

      await agent.cleanup();
    }, 60000);

    it('应该支持超时设置', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
        executionTimeout: 5000,
      });

      const result = await agent['executeCode']({
        language: 'python',
        code: 'import time\ntime.sleep(10)',
      });

      expect(result.success).toBe(false);
      expect(result.error || '').toMatch(/timeout|超时/i);

      await agent.cleanup();
    }, 60000);
  });

  describe('依赖管理', () => {
    it('应该成功安装 Python 依赖', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
      });

      const result = await agent['installDependency']({
        language: 'python',
        package: 'requests',
      });

      expect(result.success).toBe(true);

      await agent.cleanup();
    }, 60000);

    it('应该成功安装 JavaScript 依赖', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
      });

      const result = await agent['installDependency']({
        language: 'javascript',
        package: 'lodash',
      });

      expect(result.success).toBe(true);

      await agent.cleanup();
    }, 60000);

    it('应该处理不存在的包', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
      });

      const result = await agent['installDependency']({
        language: 'python',
        package: 'this-package-definitely-does-not-exist-12345',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      await agent.cleanup();
    }, 60000);
  });

  describe('Shell 命令执行', () => {
    it('应该成功执行简单命令', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
      });

      const result = await agent['runShellCommand']({
        command: 'echo "test"',
      });

      assertions.assertCommandSuccess(result);
      expect(result.output).toContain('test');

      await agent.cleanup();
    }, 60000);

    it('应该成功执行多行命令', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
      });

      const result = await agent['runShellCommand']({
        command: 'ls -la && pwd',
      });

      assertions.assertCommandSuccess(result);

      await agent.cleanup();
    }, 60000);

    it('应该处理命令执行错误', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
      });

      const result = await agent['runShellCommand']({
        command: 'this-command-does-not-exist',
      });

      expect(result.success).toBe(false);

      await agent.cleanup();
    }, 60000);
  });

  describe('文件操作', () => {
    it('应该成功写入和读取文件', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
      });

      const testContent = 'Hello, World!';
      const testPath = '/tmp/test-file.txt';

      // 写入文件
      const writeResult = await agent['writeFileInEnvironment']({
        path: testPath,
        content: testContent,
      });

      expect(writeResult.success).toBe(true);

      // 读取文件
      const readResult = await agent['readFileInEnvironment']({
        path: testPath,
      });

      expect(readResult.success).toBe(true);
      expect(readResult.content).toBe(testContent);

      await agent.cleanup();
    }, 60000);

    it('应该处理读取不存在的文件', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
      });

      const result = await agent['readFileInEnvironment']({
        path: '/tmp/this-file-does-not-exist.txt',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      await agent.cleanup();
    }, 60000);

    it('应该支持创建嵌套目录', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
      });

      const testPath = '/tmp/nested/directory/test.txt';
      const testContent = 'Nested file content';

      const writeResult = await agent['writeFileInEnvironment']({
        path: testPath,
        content: testContent,
      });

      expect(writeResult.success).toBe(true);

      // 验证文件存在
      const readResult = await agent['readFileInEnvironment']({
        path: testPath,
      });

      expect(readResult.success).toBe(true);
      expect(readResult.content).toBe(testContent);

      await agent.cleanup();
    }, 60000);
  });

  describe('沙箱生命周期管理', () => {
    it('应该正确初始化沙箱', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
      });

      await agent['initializeSandbox']();
      expect(agent['sandboxClient']).toBeDefined();

      await agent.cleanup();
    }, 60000);

    it('应该正确清理沙箱', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
      });

      await agent['initializeSandbox']();
      expect(agent['sandboxClient']).toBeDefined();

      await agent.cleanup();
      expect(agent['sandboxClient']).toBeUndefined();
    }, 60000);

    it('应该支持自定义沙箱客户端', async () => {
      const customSandbox = await sandboxManager.createSandbox();
      
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
        sandboxClient: customSandbox,
      });

      await agent['initializeSandbox']();
      expect(agent['sandboxClient']).toBe(customSandbox);

      // 不调用 cleanup，因为 sandboxManager 会管理
    }, 60000);
  });

  describe('语言限制', () => {
    it('应该尊重 allowedLanguages 配置', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
        allowedLanguages: ['python'],
      });

      // Python 应该可以执行
      const pythonResult = await agent['executeCode']({
        language: 'python',
        code: 'print("test")',
      });
      expect(pythonResult.success).toBe(true);

      // JavaScript 应该被拒绝
      const jsResult = await agent['executeCode']({
        language: 'javascript',
        code: 'console.log("test")',
      });
      expect(jsResult.success).toBe(false);
      expect(jsResult.error).toContain('not allowed');

      await agent.cleanup();
    }, 60000);
  });

  describe('复杂场景', () => {
    it('应该支持安装依赖后执行代码', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
      });

      // 安装依赖
      const installResult = await agent['installDependency']({
        language: 'python',
        package: 'requests',
      });
      expect(installResult.success).toBe(true);

      // 使用依赖执行代码
      const codeResult = await agent['executeCode']({
        language: 'python',
        code: 'import requests\nprint(requests.__version__)',
      });

      assertions.assertCodeSuccess(codeResult);
      expect(codeResult.output).toMatch(/\d+\.\d+\.\d+/);

      await agent.cleanup();
    }, 90000);

    it('应该支持写入文件后执行代码读取', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
      });

      const testData = { message: 'Hello from JSON' };
      const filePath = '/tmp/test-data.json';

      // 写入 JSON 文件
      const writeResult = await agent['writeFileInEnvironment']({
        path: filePath,
        content: JSON.stringify(testData),
      });
      expect(writeResult.success).toBe(true);

      // 用 Python 读取文件
      const codeResult = await agent['executeCode']({
        language: 'python',
        code: `
import json
with open('${filePath}', 'r') as f:
    data = json.load(f)
    print(data['message'])
        `.trim(),
      });

      assertions.assertCodeSuccess(codeResult);
      expect(codeResult.output).toContain('Hello from JSON');

      await agent.cleanup();
    }, 60000);
  });

  describe('错误处理', () => {
    it('应该处理无效的语言类型', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
      });

      const result = await agent['executeCode']({
        language: 'invalid-language' as any,
        code: 'print("test")',
      });

      expect(result.success).toBe(false);

      await agent.cleanup();
    }, 60000);

    it('应该处理空代码', async () => {
      const agent = new CodeAgent({
        e2bApiKey: process.env.E2B_API_KEY!,
        llmConfig: llmConfig,
      });

      const result = await agent['executeCode']({
        language: 'python',
        code: '',
      });

      // 空代码应该不会报错，但也不会有输出
      expect(result.success).toBe(true);

      await agent.cleanup();
    }, 60000);

    it('应该处理沙箱初始化失败', async () => {
      const agent = new CodeAgent({
        e2bApiKey: 'invalid-api-key',
        llmConfig: llmConfig,
      });

      const result = await agent['executeCode']({
        language: 'python',
        code: 'print("test")',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, 60000);
  });
});
