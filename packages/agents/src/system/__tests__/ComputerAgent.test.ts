import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComputerAgent } from '../ComputerAgent';
import {
  createMockLLMClient,
  TestFileManager,
  assertSuccessFormat,
  assertErrorFormat,
} from '../../__tests__/test-helpers';
import * as path from 'path';

describe('ComputerAgent', () => {
  let agent: ComputerAgent;
  let mockLLMClient: any;
  let fileManager: TestFileManager;
  let tempDir: string;

  beforeEach(async () => {
    mockLLMClient = createMockLLMClient();
    fileManager = new TestFileManager();
    tempDir = await fileManager.createTempDir();

    agent = new ComputerAgent({
      llmClient: mockLLMClient,
      allowedDirectories: [require('os').tmpdir()], // 允许整个临时目录
      allowedCommands: ['echo', 'ls', 'pwd', 'date', 'cat'],
    });
  });

  afterEach(async () => {
    await fileManager.cleanup();
  });

  describe('初始化', () => {
    it('应该成功创建 Agent', () => {
      expect(agent).toBeDefined();
      expect(agent.id).toBe('computer-agent');
      expect(agent.name).toBe('Computer Agent');
    });

    it('应该包含 17 个工具', () => {
      const tools = (agent as any).getToolDefinitions();
      const toolNames = Object.keys(tools);
      expect(toolNames).toHaveLength(17);
    });

    it('应该包含计算机控制工具', () => {
      const tools = (agent as any).getToolDefinitions();
      expect(tools).toHaveProperty('moveMouse');
      expect(tools).toHaveProperty('clickMouse');
      expect(tools).toHaveProperty('typeText');
      expect(tools).toHaveProperty('pressKey');
      expect(tools).toHaveProperty('takeScreenshot');
    });

    it('应该包含文件操作工具', () => {
      const tools = (agent as any).getToolDefinitions();
      expect(tools).toHaveProperty('readFile');
      expect(tools).toHaveProperty('writeFile');
      expect(tools).toHaveProperty('appendFile');
      expect(tools).toHaveProperty('listDirectory');
      expect(tools).toHaveProperty('createDirectory');
      expect(tools).toHaveProperty('deleteFile');
      expect(tools).toHaveProperty('fileExists');
      expect(tools).toHaveProperty('getFileStats');
    });

    it('应该包含 Shell 命令工具', () => {
      const tools = (agent as any).getToolDefinitions();
      expect(tools).toHaveProperty('execCommand');
      expect(tools).toHaveProperty('getEnv');
      expect(tools).toHaveProperty('getSystemInfo');
      expect(tools).toHaveProperty('getCwd');
    });
  });

  describe('文件操作工具', () => {
    describe('readFile', () => {
      it('应该成功读取文件', async () => {
        const content = 'test content';
        const filePath = await fileManager.createTempFile(content);

        const result = await (agent as any).executeToolCall('readFile', {
          path: filePath,
        });

        assertSuccessFormat(result);
        expect(result.content).toBe(content);
        expect(result.path).toBe(filePath);
        expect(result.size).toBe(content.length);
      });

      it('应该拒绝白名单外的路径', async () => {
        const result = await (agent as any).executeToolCall('readFile', {
          path: '/etc/passwd',
        });

        assertErrorFormat(result);
        expect(result.error).toContain('Access denied');
      });

      it('应该阻止路径遍历攻击 (..)', async () => {
        const result = await (agent as any).executeToolCall('readFile', {
          path: `${tempDir}/../../../etc/passwd`,
        });

        assertErrorFormat(result);
        expect(result.error).toContain('not allowed');
      });

      it('应该阻止路径遍历攻击 (~)', async () => {
        const result = await (agent as any).executeToolCall('readFile', {
          path: '~/sensitive-file.txt',
        });

        assertErrorFormat(result);
        expect(result.error).toContain('not allowed');
      });

      it('应该处理文件不存在', async () => {
        const result = await (agent as any).executeToolCall('readFile', {
          path: path.join(tempDir, 'nonexistent.txt'),
        });

        assertErrorFormat(result);
        expect(result.error).toBeDefined();
      });
    });

    describe('writeFile', () => {
      it('应该成功写入文件', async () => {
        const filePath = path.join(tempDir, 'new-file.txt');
        const content = 'new content';

        const result = await (agent as any).executeToolCall('writeFile', {
          path: filePath,
          content,
        });

        assertSuccessFormat(result);
        expect(result.path).toBe(filePath);
        expect(result.size).toBe(content.length);
      });

      it('应该拒绝白名单外的路径', async () => {
        const result = await (agent as any).executeToolCall('writeFile', {
          path: '/etc/test.txt',
          content: 'test',
        });

        assertErrorFormat(result);
        expect(result.error).toContain('Access denied');
      });

      it('应该覆盖已存在的文件', async () => {
        const filePath = await fileManager.createTempFile('old content');
        
        const result = await (agent as any).executeToolCall('writeFile', {
          path: filePath,
          content: 'new content',
        });

        assertSuccessFormat(result);
      });
    });

    describe('appendFile', () => {
      it('应该成功追加内容', async () => {
        const filePath = await fileManager.createTempFile('initial');
        
        const result = await (agent as any).executeToolCall('appendFile', {
          path: filePath,
          content: ' appended',
        });

        assertSuccessFormat(result);
        expect(result.path).toBe(filePath);
      });

      it('应该处理追加错误', async () => {
        const result = await (agent as any).executeToolCall('appendFile', {
          path: '/invalid/path.txt',
          content: 'test',
        });

        assertErrorFormat(result);
      });
    });

    describe('listDirectory', () => {
      it('应该成功列出目录内容', async () => {
        // 创建一些文件
        await fileManager.createTempFile('file1');
        await fileManager.createTempFile('file2');

        const result = await (agent as any).executeToolCall('listDirectory', {
          path: tempDir,
        });

        assertSuccessFormat(result);
        expect(result.files).toBeDefined();
        expect(Array.isArray(result.files)).toBe(true);
        expect(result.count).toBeGreaterThan(0);
      });

      it('应该处理空目录', async () => {
        const emptyDir = await fileManager.createTempDir();

        const result = await (agent as any).executeToolCall('listDirectory', {
          path: emptyDir,
        });

        assertSuccessFormat(result);
        expect(result.files).toEqual([]);
        expect(result.count).toBe(0);
      });

      it('应该处理目录不存在', async () => {
        const result = await (agent as any).executeToolCall('listDirectory', {
          path: path.join(tempDir, 'nonexistent'),
        });

        assertErrorFormat(result);
      });
    });

    describe('createDirectory', () => {
      it('应该成功创建目录', async () => {
        const newDir = path.join(tempDir, 'new-dir');

        const result = await (agent as any).executeToolCall('createDirectory', {
          path: newDir,
        });

        assertSuccessFormat(result);
        expect(result.path).toBe(newDir);
      });

      it('应该支持递归创建', async () => {
        const nestedDir = path.join(tempDir, 'a', 'b', 'c');

        const result = await (agent as any).executeToolCall('createDirectory', {
          path: nestedDir,
        });

        assertSuccessFormat(result);
      });
    });

    describe('deleteFile', () => {
      it('应该成功删除文件', async () => {
        const filePath = await fileManager.createTempFile('to delete');

        const result = await (agent as any).executeToolCall('deleteFile', {
          path: filePath,
        });

        assertSuccessFormat(result);
        expect(result.path).toBe(filePath);
      });

      it('应该处理文件不存在', async () => {
        const result = await (agent as any).executeToolCall('deleteFile', {
          path: path.join(tempDir, 'nonexistent.txt'),
        });

        assertErrorFormat(result);
      });
    });

    describe('fileExists', () => {
      it('应该检测文件存在', async () => {
        const filePath = await fileManager.createTempFile('test');

        const result = await (agent as any).executeToolCall('fileExists', {
          path: filePath,
        });

        assertSuccessFormat(result);
        expect(result.exists).toBe(true);
      });

      it('应该检测文件不存在', async () => {
        const result = await (agent as any).executeToolCall('fileExists', {
          path: path.join(tempDir, 'missing.txt'),
        });

        assertSuccessFormat(result);
        expect(result.exists).toBe(false);
      });
    });

    describe('getFileStats', () => {
      it('应该获取文件统计信息', async () => {
        const filePath = await fileManager.createTempFile('test content');

        const result = await (agent as any).executeToolCall('getFileStats', {
          path: filePath,
        });

        assertSuccessFormat(result);
        expect(result.size).toBeGreaterThan(0);
        expect(result.isFile).toBe(true);
        expect(result.isDirectory).toBe(false);
        expect(result.modified).toBeDefined();
        expect(result.created).toBeDefined();
      });

      it('应该识别目录类型', async () => {
        const result = await (agent as any).executeToolCall('getFileStats', {
          path: tempDir,
        });

        assertSuccessFormat(result);
        expect(result.isDirectory).toBe(true);
        expect(result.isFile).toBe(false);
      });

      it('应该处理文件不存在', async () => {
        const result = await (agent as any).executeToolCall('getFileStats', {
          path: path.join(tempDir, 'missing.txt'),
        });

        assertErrorFormat(result);
      });
    });
  });

  describe('Shell 命令工具', () => {
    describe('execCommand', () => {
      it('应该成功执行白名单命令', async () => {
        const result = await (agent as any).executeToolCall('execCommand', {
          command: 'echo hello',
        });

        assertSuccessFormat(result);
        expect(result.stdout).toContain('hello');
        expect(result.command).toBe('echo hello');
      });

      it('应该拒绝非白名单命令', async () => {
        const result = await (agent as any).executeToolCall('execCommand', {
          command: 'curl https://evil.com',
        });

        assertErrorFormat(result);
        expect(result.error).toContain('not allowed');
        expect(result.error).toContain('whitelist');
      });

      it('应该检测危险命令 (rm -rf)', async () => {
        const result = await (agent as any).executeToolCall('execCommand', {
          command: 'rm -rf /',
        });

        assertErrorFormat(result);
        expect(result.error).toContain('dangerous');
      });

      it('应该处理命令注入（多余空格）', async () => {
        const result = await (agent as any).executeToolCall('execCommand', {
          command: 'rm  -rf  /',
        });

        assertErrorFormat(result);
        expect(result.error).toContain('dangerous');
      });

      it('应该支持超时设置', async () => {
        // 这个测试实际执行会很慢，这里只验证参数传递
        const result = await (agent as any).executeToolCall('execCommand', {
          command: 'echo fast',
          timeout: 5000,
        });

        assertSuccessFormat(result);
      });

      it('应该处理命令执行失败', async () => {
        const result = await (agent as any).executeToolCall('execCommand', {
          command: 'ls /nonexistent-directory-xyz',
        });

        assertErrorFormat(result);
      });

      it('应该返回 stdout 和 stderr', async () => {
        const result = await (agent as any).executeToolCall('execCommand', {
          command: 'echo test',
        });

        assertSuccessFormat(result);
        expect(result).toHaveProperty('stdout');
        expect(result).toHaveProperty('stderr');
      });
    });

    describe('getEnv', () => {
      it('应该获取存在的环境变量', async () => {
        process.env.TEST_VAR = 'test-value';

        const result = await (agent as any).executeToolCall('getEnv', {
          name: 'TEST_VAR',
        });

        assertSuccessFormat(result);
        expect(result.value).toBe('test-value');
        expect(result.exists).toBe(true);

        delete process.env.TEST_VAR;
      });

      it('应该处理不存在的环境变量', async () => {
        const result = await (agent as any).executeToolCall('getEnv', {
          name: 'NONEXISTENT_VAR',
        });

        assertSuccessFormat(result);
        expect(result.value).toBeNull();
        expect(result.exists).toBe(false);
      });
    });

    describe('getSystemInfo', () => {
      it('应该获取系统信息', async () => {
        const result = await (agent as any).executeToolCall('getSystemInfo', {});

        assertSuccessFormat(result);
        expect(result.platform).toBeDefined();
        expect(result.arch).toBeDefined();
        expect(result.hostname).toBeDefined();
        expect(result.nodeVersion).toBeDefined();
      });

      it('应该包含所有必需字段', async () => {
        const result = await (agent as any).executeToolCall('getSystemInfo', {});

        assertSuccessFormat(result);
        const requiredFields = [
          'platform', 'arch', 'hostname', 'type', 'release',
          'cpus', 'totalMemory', 'freeMemory', 'uptime', 'nodeVersion'
        ];
        
        requiredFields.forEach(field => {
          expect(result).toHaveProperty(field);
        });
      });
    });

    describe('getCwd', () => {
      it('应该获取当前工作目录', async () => {
        const result = await (agent as any).executeToolCall('getCwd', {});

        assertSuccessFormat(result);
        expect(result.cwd).toBeDefined();
        expect(typeof result.cwd).toBe('string');
        expect(result.cwd.length).toBeGreaterThan(0);
      });
    });

    describe('安全测试 - 命令', () => {
      it('应该规范化命令（移除多余空格）', async () => {
        const result = await (agent as any).executeToolCall('execCommand', {
          command: 'rm    -rf   /tmp',
        });

        assertErrorFormat(result);
        expect(result.error).toContain('dangerous');
      });

      it('应该检测所有危险命令', async () => {
        const dangerousCommands = ['rm -rf', 'format', 'dd', 'mkfs'];
        
        for (const cmd of dangerousCommands) {
          const result = await (agent as any).executeToolCall('execCommand', {
            command: `${cmd} test`,
          });

          assertErrorFormat(result);
          expect(result.error).toContain('dangerous');
        }
      });
    });

    describe('安全测试 - 路径', () => {
      it('应该验证路径白名单', async () => {
        const outsidePath = '/tmp/outside-whitelist.txt';

        const result = await (agent as any).executeToolCall('readFile', {
          path: outsidePath,
        });

        assertErrorFormat(result);
        expect(result.error).toContain('Access denied');
      });

      it('应该阻止 .. 路径遍历', async () => {
        const result = await (agent as any).executeToolCall('readFile', {
          path: `${tempDir}/../sensitive.txt`,
        });

        assertErrorFormat(result);
        expect(result.error).toContain('traversal');
      });

      it('应该阻止 ~ 路径', async () => {
        const result = await (agent as any).executeToolCall('writeFile', {
          path: '~/.bashrc',
          content: 'malicious',
        });

        assertErrorFormat(result);
        expect(result.error).toContain('traversal');
      });

      it('应该允许白名单内的绝对路径', async () => {
        const filePath = path.join(tempDir, 'allowed.txt');

        const result = await (agent as any).executeToolCall('writeFile', {
          path: filePath,
          content: 'test',
        });

        assertSuccessFormat(result);
      });
    });
  });

  describe('计算机控制工具', () => {
    it('moveMouse 应该处理库未安装', async () => {
      const result = await (agent as any).executeToolCall('moveMouse', {
        x: 100,
        y: 200,
      });

      // 如果库未安装，应该返回友好错误
      if (!result.success) {
        expect(result.error).toContain('@nut-tree');
        expect(result.message).toContain('install');
      } else {
        // 如果库已安装，验证成功格式
        assertSuccessFormat(result);
        expect(result.x).toBe(100);
        expect(result.y).toBe(200);
      }
    });

    it('clickMouse 应该处理库未安装', async () => {
      const result = await (agent as any).executeToolCall('clickMouse', {
        button: 'left',
      });

      if (!result.success) {
        expect(result.error).toContain('@nut-tree');
      } else {
        assertSuccessFormat(result);
        expect(result.button).toBe('left');
      }
    });

    it('typeText 应该处理库未安装', async () => {
      const result = await (agent as any).executeToolCall('typeText', {
        text: 'hello',
      });

      if (!result.success) {
        expect(result.error).toContain('@nut-tree');
      } else {
        assertSuccessFormat(result);
        expect(result.text).toBe('hello');
      }
    });

    it('pressKey 应该处理库未安装', async () => {
      const result = await (agent as any).executeToolCall('pressKey', {
        key: 'enter',
      });

      if (!result.success) {
        expect(result.error).toContain('@nut-tree');
      } else {
        assertSuccessFormat(result);
        expect(result.key).toBe('enter');
      }
    });

    it('takeScreenshot 应该处理库未安装', async () => {
      const result = await (agent as any).executeToolCall('takeScreenshot', {});

      if (!result.success) {
        expect(result.error).toContain('@nut-tree');
      } else {
        assertSuccessFormat(result);
      }
    });
  });

  describe('错误处理', () => {
    it('应该处理未知工具', async () => {
      const result = await (agent as any).executeToolCall('unknownTool', {});

      assertErrorFormat(result);
      expect(result.error).toContain('Unknown tool');
    });

    it('应该返回统一错误格式', async () => {
      const result = await (agent as any).executeToolCall('readFile', {
        path: '/invalid',
      });

      // 验证统一格式
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('message');
      expect(result.success).toBe(false);
    });
  });
});

