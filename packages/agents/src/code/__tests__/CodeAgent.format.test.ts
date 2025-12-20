import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CodeAgent } from '../CodeAgent';
import { createMockLLMClient, assertSuccessFormat, assertErrorFormat } from '../../__tests__/test-helpers';
import { BaseSandboxClient } from '../sandbox';

// Mock Sandbox Client
class MockSandboxClient extends BaseSandboxClient {
  async create() {}
  async connect() {}
  async close() {}
  async uploadFile() {}
  async downloadFile() { return new Uint8Array(); }
  async list() { return []; }
  async runCommand() {
    return {
      stdout: 'test output',
      stderr: '',
      exit_code: 0,
      error: undefined,
    };
  }
  async runCode() {
    return {
      stdout: 'code output',
      stderr: '',
      result: 'success',
      error: undefined,
    };
  }
}

describe('CodeAgent - 错误格式测试', () => {
  let agent: CodeAgent;
  let mockLLMClient: any;
  let mockSandbox: MockSandboxClient;

  beforeEach(() => {
    mockLLMClient = createMockLLMClient();
    mockSandbox = new MockSandboxClient();

    agent = new CodeAgent({
      llmClient: mockLLMClient,
      e2bApiKey: 'test-key',
      sandboxClient: mockSandbox,
    });
  });

  describe('executeCode - 错误格式', () => {
    it('成功执行应该返回标准格式', async () => {
      const result = await (agent as any).executeCode({
        language: 'python',
        code: 'print("hello")',
      });

      assertSuccessFormat(result);
      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('exitCode');
    });

    it('执行失败应该返回错误格式', async () => {
      mockSandbox.runCode = vi.fn().mockResolvedValue({
        stdout: '',
        stderr: 'Error',
        result: null,
        error: {
          name: 'SyntaxError',
          value: 'invalid syntax',
          traceback: 'at line 1',
        },
      });

      const result = await (agent as any).executeCode({
        language: 'python',
        code: 'invalid code',
      });

      assertErrorFormat(result);
      expect(result.exitCode).toBe(1);
    });

    it('语言不允许应该返回错误', async () => {
      const result = await (agent as any).executeCode({
        language: 'cobol',
        code: 'test',
      });

      assertErrorFormat(result);
      expect(result.error).toContain('not allowed');
    });

    it('超时应该返回错误', async () => {
      mockSandbox.runCode = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100000))
      );

      const result = await (agent as any).executeCode({
        language: 'python',
        code: 'while True: pass',
        timeout: 100,
      });

      assertErrorFormat(result);
      expect(result.error).toContain('timeout');
    });

    it('所有成功响应应该有 message 字段', async () => {
      const result = await (agent as any).executeCode({
        language: 'python',
        code: 'print("test")',
      });

      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    });
  });

  describe('runShellCommand - 错误格式', () => {
    it('成功执行应该返回标准格式', async () => {
      const result = await (agent as any).runShellCommand({
        command: 'echo',
        args: ['test'],
      });

      assertSuccessFormat(result);
      expect(result).toHaveProperty('stdout');
      expect(result).toHaveProperty('stderr');
      expect(result).toHaveProperty('exitCode');
    });

    it('失败执行应该返回错误格式', async () => {
      mockSandbox.runCommand = vi.fn().mockResolvedValue({
        stdout: '',
        stderr: 'command not found',
        exit_code: 127,
        error: 'command not found',
      });

      const result = await (agent as any).runShellCommand({
        command: 'invalid-command',
      });

      assertErrorFormat(result);
      expect(result.exitCode).not.toBe(0);
    });

    it('所有响应应该有 message 字段', async () => {
      const result = await (agent as any).runShellCommand({
        command: 'echo',
        args: ['test'],
      });

      expect(result.message).toBeDefined();
      expect(typeof result.message).toBe('string');
    });
  });

  describe('readFile - 错误格式', () => {
    it('成功读取应该返回标准格式', async () => {
      mockSandbox.downloadFile = vi.fn().mockResolvedValue(
        new TextEncoder().encode('test content')
      );

      const result = await (agent as any).readFileInEnvironment({
        path: '/test.txt',
      });

      assertSuccessFormat(result);
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('path');
    });

    it('读取失败应该返回错误格式', async () => {
      mockSandbox.downloadFile = vi.fn().mockRejectedValue(new Error('File not found'));

      const result = await (agent as any).readFileInEnvironment({
        path: '/missing.txt',
      });

      assertErrorFormat(result);
    });

    it('所有响应应该有 message 字段', async () => {
      mockSandbox.downloadFile = vi.fn().mockResolvedValue(
        new TextEncoder().encode('test')
      );

      const result = await (agent as any).readFileInEnvironment({
        path: '/test.txt',
      });

      expect(result.message).toBeDefined();
    });
  });

  describe('writeFile - 错误格式', () => {
    it('成功写入应该返回标准格式', async () => {
      mockSandbox.uploadFile = vi.fn().mockResolvedValue(undefined);

      const result = await (agent as any).writeFileInEnvironment({
        path: '/test.txt',
        content: 'test',
      });

      assertSuccessFormat(result);
      expect(result).toHaveProperty('path');
    });

    it('写入失败应该返回错误格式', async () => {
      mockSandbox.uploadFile = vi.fn().mockRejectedValue(new Error('Permission denied'));

      const result = await (agent as any).writeFileInEnvironment({
        path: '/readonly.txt',
        content: 'test',
      });

      assertErrorFormat(result);
    });

    it('所有响应应该有 message 字段', async () => {
      mockSandbox.uploadFile = vi.fn().mockResolvedValue(undefined);

      const result = await (agent as any).writeFileInEnvironment({
        path: '/test.txt',
        content: 'test',
      });

      expect(result.message).toBeDefined();
    });
  });

  describe('installDependency - 错误格式', () => {
    it('未实现功能应该返回成功格式', async () => {
      const result = await (agent as any).installDependency({
        language: 'python',
        package: 'pandas',
      });

      assertSuccessFormat(result);
      expect(result.message).toContain('not yet implemented');
    });

    it('不存在的包应该返回错误格式', async () => {
      const result = await (agent as any).installDependency({
        language: 'python',
        package: 'definitely-does-not-exist-package-xyz',
      });

      assertErrorFormat(result);
      expect(result.error).toContain('not found');
    });
  });

  describe('message 字段一致性', () => {
    it('所有成功响应应该有清晰的 message', async () => {
      const result = await (agent as any).executeCode({
        language: 'python',
        code: 'print("test")',
      });

      if (result.success) {
        expect(result.message).toMatch(/success|executed|completed/i);
      }
    });

    it('所有错误响应应该有描述性 message', async () => {
      const result = await (agent as any).executeCode({
        language: 'invalid-lang',
        code: 'test',
      });

      expect(result.message).toContain('Error');
      expect(result.message).toContain('executeCode');
    });

    it('message 应该包含操作信息', async () => {
      mockSandbox.runCommand = vi.fn().mockResolvedValue({
        stdout: 'output',
        stderr: '',
        exit_code: 0,
      });

      const result = await (agent as any).runShellCommand({
        command: 'echo test',
      });

      expect(result.message).toContain('echo test');
    });

    it('message 格式应该一致', async () => {
      const results = await Promise.all([
        (agent as any).executeCode({ language: 'python', code: 'print(1)' }),
        (agent as any).runShellCommand({ command: 'echo test' }),
      ]);

      results.forEach(result => {
        expect(result.message).toBeDefined();
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Sandbox 初始化', () => {
    it('未初始化时应该返回友好错误', async () => {
      const agentWithoutSandbox = new CodeAgent({
        llmClient: mockLLMClient,
        // 不提供 sandboxClient 和 e2bApiKey
      });

      const result = await (agentWithoutSandbox as any).executeCode({
        language: 'python',
        code: 'print("test")',
      });

      assertErrorFormat(result);
      expect(result.error).toContain('not configured');
    });
  });
});

