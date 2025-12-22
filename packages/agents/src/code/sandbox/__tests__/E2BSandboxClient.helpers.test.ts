import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  initTestEnv,
  skipIfNoApiKey,
  TestSandboxManager,
  assertions,
  testCode,
  testData,
  retry,
  withTimeout,
} from './test-helpers';
import type { CommandResult, CodeExecutionResult } from '../BaseSandboxClient';

/**
 * 测试辅助工具使用示例
 * 
 * 这些测试展示了如何使用 test-helpers.ts 中的工具函数
 * 
 * 配置方式：
 * 1. 在项目根目录创建 .env 文件，添加: E2B_API_KEY=your-key
 * 2. 或设置环境变量: export E2B_API_KEY=your-key
 */

// 初始化测试环境（加载 .env）
initTestEnv();

describe('Test Helpers Usage Examples', () => {
  const manager = new TestSandboxManager();

  beforeAll(() => {
    if (skipIfNoApiKey()) {
      return;
    }
  });

  afterEach(async () => {
    if (skipIfNoApiKey()) {
      return;
    }
    await manager.cleanup();
  });

  describe('TestSandboxManager 使用示例', () => {
    it('应该能够使用 TestSandboxManager 创建和清理 Sandbox', async () => {
      if (skipIfNoApiKey()) return;

      // 创建单个 Sandbox
      const client = await manager.createSandbox();
      expect(client.sandboxId).toBeDefined();

      // 验证可以使用
      const result = await client.runCommand('echo "test"') as CommandResult;
      expect(result.exit_code).toBe(0);

      // 清理会在 afterEach 中自动执行
    });

    it('应该能够创建多个 Sandbox', async () => {
      if (skipIfNoApiKey()) return;

      const clients = await manager.createMultipleSandboxes(2);
      
      expect(clients.length).toBe(2);
      expect(manager.getCount()).toBe(2);

      // 验证所有 Sandbox 都可用
      const results = await Promise.all(
        clients.map(c => c.runCommand('echo "test"'))
      );

      results.forEach(result => {
        expect((result as CommandResult).exit_code).toBe(0);
      });
    }, 60000);
  });

  describe('断言辅助函数使用示例', () => {
    it('应该能够使用 assertCommandSuccess', async () => {
      if (skipIfNoApiKey()) return;

      const client = await manager.createSandbox();
      const result = await client.runCommand('echo "Hello, Test!"') as CommandResult;

      // 使用断言辅助函数
      assertions.assertCommandSuccess(result, 'Hello, Test!');
    });

    it('应该能够使用 assertCodeSuccess', async () => {
      if (skipIfNoApiKey()) return;

      const client = await manager.createSandbox();
      const result = await client.runCode(
        'print("Success!")', 
        'python'
      ) as CodeExecutionResult;

      // 使用断言辅助函数
      assertions.assertCodeSuccess(result, 'Success!');
    });

    it('应该能够使用 assertCodeError', async () => {
      if (skipIfNoApiKey()) return;

      const client = await manager.createSandbox();
      const result = await client.runCode(
        testCode.python.errorExample,
        'python'
      ) as CodeExecutionResult;

      // 使用断言辅助函数
      assertions.assertCodeError(result, 'NameError');
    });
  });

  describe('预定义测试代码使用示例', () => {
    it('应该能够使用预定义的 Python 代码', async () => {
      if (skipIfNoApiKey()) return;

      const client = await manager.createSandbox();

      // 使用 helloWorld
      const result1 = await client.runCode(
        testCode.python.helloWorld,
        'python'
      ) as CodeExecutionResult;
      assertions.assertCodeSuccess(result1, 'Hello, World!');

      // 使用 mathCalculation
      const result2 = await client.runCode(
        testCode.python.mathCalculation,
        'python'
      ) as CodeExecutionResult;
      assertions.assertCodeSuccess(result2, 'Result: 100');

      // 使用 dataProcessing
      const result3 = await client.runCode(
        testCode.python.dataProcessing,
        'python'
      ) as CodeExecutionResult;
      assertions.assertCodeSuccess(result3, 'average');
    });

    it('应该能够使用预定义的 JavaScript 代码', async () => {
      if (skipIfNoApiKey()) return;

      const client = await manager.createSandbox();

      const result = await client.runCode(
        testCode.javascript.helloWorld,
        'javascript'
      ) as CodeExecutionResult;

      assertions.assertCodeSuccess(result, 'Hello, World!');
    });

    it('应该能够使用预定义的 Bash 代码', async () => {
      if (skipIfNoApiKey()) return;

      const client = await manager.createSandbox();

      const result = await client.runCode(
        testCode.bash.helloWorld,
        'bash'
      ) as CodeExecutionResult;

      assertions.assertCodeSuccess(result, 'Hello, World!');
    });
  });

  describe('测试数据生成使用示例', () => {
    it('应该能够生成和使用 CSV 数据', async () => {
      if (skipIfNoApiKey()) return;

      const client = await manager.createSandbox();

      // 生成 CSV 数据
      const csvData = testData.generateCSV(5);
      expect(csvData).toContain('id,name,value');

      // 在 Sandbox 中使用
      const code = `
csv_data = """${csvData}"""

lines = csv_data.strip().split('\\n')
print(f"Total rows: {len(lines) - 1}")  # 减去标题行
`;

      const result = await client.runCode(code, 'python') as CodeExecutionResult;
      assertions.assertCodeSuccess(result, 'Total rows: 5');
    });

    it('应该能够生成和使用 JSON 数据', async () => {
      if (skipIfNoApiKey()) return;

      const client = await manager.createSandbox();

      // 生成 JSON 数据
      const jsonData = testData.generateJSON(3);
      expect(jsonData).toContain('id');

      // 在 Sandbox 中使用
      const code = `
import json

json_data = '''${jsonData}'''
data = json.loads(json_data)

print(f"Total items: {len(data)}")
print(f"First item: {data[0]['name']}")
`;

      const result = await client.runCode(code, 'python') as CodeExecutionResult;
      assertions.assertCodeSuccess(result, 'Total items: 3');
      assertions.assertCodeSuccess(result, 'item_0');
    });

    it('应该能够生成随机字符串', async () => {
      if (skipIfNoApiKey()) return;

      const str1 = testData.randomString(10);
      const str2 = testData.randomString(10);

      expect(str1.length).toBe(10);
      expect(str2.length).toBe(10);
      expect(str1).not.toBe(str2); // 应该是不同的随机字符串
    });
  });

  describe('重试和超时工具使用示例', () => {
    it('应该能够使用 retry 重试失败的操作', async () => {
      if (skipIfNoApiKey()) return;

      let attempts = 0;
      const unstableOperation = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      const result = await retry(unstableOperation, 3, 100);
      
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('应该能够使用 withTimeout 设置超时', async () => {
      if (skipIfNoApiKey()) return;

      const client = await manager.createSandbox();

      // 快速操作应该成功
      const quickOp = client.runCommand('echo "quick"');
      const result = await withTimeout(quickOp, 5000);
      
      expect((result as CommandResult).exit_code).toBe(0);

      // 慢速操作应该超时
      const slowOp = client.runCommand('sleep 10');
      await expect(
        withTimeout(slowOp, 1000, 'Operation took too long')
      ).rejects.toThrow('Operation took too long');
    });
  });

  describe('综合使用示例', () => {
    it('应该能够组合使用多个辅助工具完成复杂测试', async () => {
      if (skipIfNoApiKey()) return;

      // 使用 TestSandboxManager 创建 Sandbox
      const client = await manager.createSandbox();

      // 步骤 1: 创建测试数据
      const csvData = testData.generateCSV(10);
      const fileName = `/tmp/${testData.randomString(8)}.csv`;

      // 写入数据到文件
      const writeCmd = await client.runCommand(
        `cat > ${fileName} << 'EOF'\n${csvData}\nEOF`
      ) as CommandResult;
      assertions.assertCommandSuccess(writeCmd);

      // 步骤 2: 处理数据
      const processCode = `
import csv

with open('${fileName}', 'r') as f:
    reader = csv.DictReader(f)
    data = list(reader)

print(f"Processed {len(data)} records")
`;

      const processResult = await client.runCode(
        processCode,
        'python'
      ) as CodeExecutionResult;
      assertions.assertCodeSuccess(processResult, 'Processed 10 records');

      // 步骤 3: 验证结果
      const verifyCmd = await client.runCommand(
        `wc -l ${fileName}`
      ) as CommandResult;
      assertions.assertCommandSuccess(verifyCmd);

      expect(processResult.result).toContain('Processed 10 records');
    });
  });
});
