import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { E2BSandboxClient } from '../E2BSandboxClient';
import type { CommandResult, CodeExecutionResult } from '../BaseSandboxClient';
import { initTestEnv } from './test-helpers';

/**
 * E2B Sandbox 客户端集成测试
 * 
 * 注意：这些测试需要真实的 E2B API Key 才能运行
 * 
 * 配置方式：
 * 1. 在项目根目录创建 .env 文件，添加: E2B_API_KEY=your-key
 * 2. 或设置环境变量: export E2B_API_KEY=your-key
 * 
 * 运行测试：
 * yarn test:integration
 */

// 初始化测试环境（加载 .env）
initTestEnv();

// 跳过测试如果没有 API Key
const skipIfNoApiKey = () => {
  if (!process.env.E2B_API_KEY) {
    console.warn('⚠️  Skipping E2B integration tests: E2B_API_KEY not set');
    console.warn('💡 提示: 在项目根目录创建 .env 文件，添加: E2B_API_KEY=your-key');
    return true;
  }
  return false;
};

describe('E2BSandboxClient Integration Tests', () => {
  let client: E2BSandboxClient;
  const TEMPLATE_ID = 'base'; // 使用 E2B 的 base 模板

  beforeAll(() => {
    if (skipIfNoApiKey()) {
      return;
    }
  });

  beforeEach(async () => {
    if (skipIfNoApiKey()) {
      return;
    }
    client = new E2BSandboxClient(process.env.E2B_API_KEY);
  });

  afterAll(async () => {
    if (skipIfNoApiKey()) {
      return;
    }
    // 清理所有测试创建的 sandbox
    if (client) {
      await client.close();
    }
  });

  describe('Sandbox 生命周期管理', () => {
    it('应该能够创建新的 Sandbox', async () => {
      if (skipIfNoApiKey()) return;

      await client.create(TEMPLATE_ID, 'test-user', 'test-task-1', {
        test: 'integration',
      });

      expect(client.sandboxId).toBeDefined();
      expect(typeof client.sandboxId).toBe('string');
    });

    it('应该能够关闭 Sandbox', async () => {
      if (skipIfNoApiKey()) return;

      await client.create(TEMPLATE_ID);
      const sandboxId = client.sandboxId;
      expect(sandboxId).toBeDefined();

      await client.close();
      expect(client.sandboxId).toBeNull();
    });

    it('应该能够列出 Sandbox', async () => {
      if (skipIfNoApiKey()) return;

      // 创建一个测试 sandbox
      await client.create(TEMPLATE_ID, 'test-user', 'test-task-list', {
        test: 'list-test',
      });

      // 列出所有 sandbox
      const sandboxes = await client.list();
      expect(Array.isArray(sandboxes)).toBe(true);
      expect(sandboxes.length).toBeGreaterThan(0);

      // 验证返回的数据结构
      const firstSandbox = sandboxes[0];
      expect(firstSandbox).toHaveProperty('sandbox_id');
      expect(firstSandbox).toHaveProperty('template_id');
    });

    it('应该能够使用元数据过滤 Sandbox', async () => {
      if (skipIfNoApiKey()) return;

      const uniqueTaskId = `task-${Date.now()}`;
      
      // 创建一个带特定元数据的 sandbox
      await client.create(TEMPLATE_ID, 'test-user', uniqueTaskId, {
        test: 'filter-test',
      });

      // 使用 task_id 过滤
      const filteredSandboxes = await client.list('test-user', uniqueTaskId);
      expect(filteredSandboxes.length).toBeGreaterThan(0);
    });
  });

  describe('命令执行', () => {
    beforeEach(async () => {
      if (skipIfNoApiKey()) return;
      await client.create(TEMPLATE_ID);
    });

    it('应该能够执行简单的 Shell 命令', async () => {
      if (skipIfNoApiKey()) return;

      const result = await client.runCommand('echo "Hello, E2B!"') as CommandResult;

      expect(result.stdout).toContain('Hello, E2B!');
      expect(result.exit_code).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it('应该能够处理命令执行失败', async () => {
      if (skipIfNoApiKey()) return;

      const result = await client.runCommand('nonexistent-command') as CommandResult;

      expect(result.exit_code).not.toBe(0);
      expect(result.stderr || result.error).toBeDefined();
    });

    it('应该能够执行多行命令', async () => {
      if (skipIfNoApiKey()) return;

      const command = 'pwd && ls -la';
      const result = await client.runCommand(command) as CommandResult;

      expect(result.exit_code).toBe(0);
      expect(result.stdout).toBeTruthy();
    });

    it('应该能够流式执行命令', async () => {
      if (skipIfNoApiKey()) return;

      const chunks: any[] = [];
      const stream = await client.runCommand('echo "line 1" && echo "line 2"', true);

      for await (const chunk of stream as AsyncIterableIterator<any>) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      const hasStdout = chunks.some((c) => c.type === 'stdout');
      expect(hasStdout).toBe(true);
    });
  });

  describe('代码执行', () => {
    beforeEach(async () => {
      if (skipIfNoApiKey()) return;
      await client.create(TEMPLATE_ID);
    });

    it('应该能够执行 Python 代码', async () => {
      if (skipIfNoApiKey()) return;

      const code = 'print("Hello from Python!")';
      const result = await client.runCode(code, 'python') as CodeExecutionResult;

      expect(result.stdout || result.result).toContain('Hello from Python!');
      expect(result.error).toBeUndefined();
    });

    it('应该能够执行 JavaScript 代码', async () => {
      if (skipIfNoApiKey()) return;

      const code = 'console.log("Hello from JavaScript!")';
      const result = await client.runCode(code, 'javascript') as CodeExecutionResult;

      expect(result.stdout || result.result).toContain('Hello from JavaScript!');
      expect(result.error).toBeUndefined();
    });

    it('应该能够执行数学计算', async () => {
      if (skipIfNoApiKey()) return;

      const code = `
result = 42 + 58
print(f"The answer is {result}")
`;
      const result = await client.runCode(code, 'python') as CodeExecutionResult;

      expect(result.stdout || result.result).toContain('100');
      expect(result.error).toBeUndefined();
    });

    it('应该能够处理代码执行错误', async () => {
      if (skipIfNoApiKey()) return;

      const code = 'print(undefined_variable)'; // Python 中未定义的变量
      const result = await client.runCode(code, 'python') as CodeExecutionResult;

      expect(result.error).toBeDefined();
      expect(result.error?.name).toBeTruthy();
    });

    it('应该能够流式执行代码', async () => {
      if (skipIfNoApiKey()) return;

      const code = `
for i in range(3):
    print(f"Line {i}")
`;
      const chunks: any[] = [];
      const stream = await client.runCode(code, 'python', true);

      for await (const chunk of stream as AsyncIterableIterator<any>) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      const hasOutput = chunks.some((c) => c.type === 'stdout' || c.type === 'result');
      expect(hasOutput).toBe(true);
    });

    it('应该能够执行复杂的 Python 脚本', async () => {
      if (skipIfNoApiKey()) return;

      const code = `
import json
import math

data = {
    "values": [1, 2, 3, 4, 5],
    "sum": sum([1, 2, 3, 4, 5]),
    "sqrt_of_16": math.sqrt(16)
}

print(json.dumps(data, indent=2))
`;
      const result = await client.runCode(code, 'python') as CodeExecutionResult;

      expect(result.stdout || result.result).toContain('"values"');
      expect(result.stdout || result.result).toContain('15'); // sum
      expect(result.stdout || result.result).toContain('4'); // sqrt(16)
      expect(result.error).toBeUndefined();
    });
  });

  describe('文件操作', () => {
    beforeEach(async () => {
      if (skipIfNoApiKey()) return;
      await client.create(TEMPLATE_ID);
    });

    it('应该能够上传和下载文件', async () => {
      if (skipIfNoApiKey()) return;

      // 创建临时文件
      const fs = await import('fs/promises');
      const os = await import('os');
      const path = await import('path');

      const tmpDir = os.tmpdir();
      const localFile = path.join(tmpDir, `e2b-test-${Date.now()}.txt`);
      const testContent = 'Hello, E2B File System!';

      await fs.writeFile(localFile, testContent);

      try {
        // 上传文件
        const remotePath = '/tmp/test-file.txt';
        await client.uploadFile(localFile, remotePath);

        // 下载文件
        const downloaded = await client.downloadFile(remotePath);
        const decoder = new TextDecoder();
        const downloadedContent = decoder.decode(downloaded);

        expect(downloadedContent).toBe(testContent);
      } finally {
        // 清理临时文件
        await fs.unlink(localFile).catch(() => {});
      }
    });

    it('应该能够通过命令创建和读取文件', async () => {
      if (skipIfNoApiKey()) return;

      const testFile = '/tmp/command-test.txt';
      const testContent = 'Created by command';

      // 使用命令创建文件
      const createResult = await client.runCommand(
        `echo "${testContent}" > ${testFile}`
      ) as CommandResult;
      expect(createResult.exit_code).toBe(0);

      // 读取文件
      const readResult = await client.runCommand(`cat ${testFile}`) as CommandResult;
      expect(readResult.stdout).toContain(testContent);
      expect(readResult.exit_code).toBe(0);
    });

    it('应该能够处理二进制文件', async () => {
      if (skipIfNoApiKey()) return;

      const fs = await import('fs/promises');
      const os = await import('os');
      const path = await import('path');

      const tmpDir = os.tmpdir();
      const localFile = path.join(tmpDir, `e2b-binary-${Date.now()}.bin`);
      
      // 创建二进制数据
      const binaryData = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello" in ASCII
      await fs.writeFile(localFile, binaryData);

      try {
        const remotePath = '/tmp/binary-test.bin';
        await client.uploadFile(localFile, remotePath);

        const downloaded = await client.downloadFile(remotePath);
        expect(downloaded).toEqual(binaryData);
      } finally {
        await fs.unlink(localFile).catch(() => {});
      }
    });
  });

  describe('真实场景测试', () => {
    beforeEach(async () => {
      if (skipIfNoApiKey()) return;
      await client.create(TEMPLATE_ID);
    });

    it('应该能够安装 Python 包并使用', async () => {
      if (skipIfNoApiKey()) return;

      // 安装包（使用 requests 作为示例）
      const installCmd = 'pip install requests -q';
      const installResult = await client.runCommand(installCmd) as CommandResult;
      expect(installResult.exit_code).toBe(0);

      // 使用已安装的包
      const code = `
import requests
print(f"requests version: {requests.__version__}")
print("Package imported successfully!")
`;
      const result = await client.runCode(code, 'python') as CodeExecutionResult;
      expect(result.stdout || result.result).toContain('Package imported successfully!');
      expect(result.error).toBeUndefined();
    });

    it('应该能够执行数据处理任务', async () => {
      if (skipIfNoApiKey()) return;

      const code = `
import json

# 模拟数据处理任务
data = [
    {"name": "Alice", "age": 30, "score": 85},
    {"name": "Bob", "age": 25, "score": 92},
    {"name": "Charlie", "age": 35, "score": 78}
]

# 计算平均分
average_score = sum(item["score"] for item in data) / len(data)

# 找出最高分
top_scorer = max(data, key=lambda x: x["score"])

result = {
    "total_people": len(data),
    "average_score": average_score,
    "top_scorer": top_scorer["name"]
}

print(json.dumps(result, indent=2))
`;
      const result = await client.runCode(code, 'python') as CodeExecutionResult;

      const output = result.stdout || result.result;
      expect(output).toContain('"total_people": 3');
      expect(output).toContain('"average_score"');
      expect(output).toContain('"top_scorer": "Bob"');
      expect(result.error).toBeUndefined();
    });

    it('应该能够创建和执行 Python 脚本文件', async () => {
      if (skipIfNoApiKey()) return;

      // 创建脚本文件
      const scriptContent = `
#!/usr/bin/env python3
import sys
print(f"Arguments: {sys.argv[1:]}")
print("Script executed successfully!")
`;
      const createResult = await client.runCommand(
        `cat > /tmp/script.py << 'EOF'${scriptContent}EOF`
      ) as CommandResult;
      expect(createResult.exit_code).toBe(0);

      // 执行脚本
      const execResult = await client.runCommand(
        'python3 /tmp/script.py arg1 arg2'
      ) as CommandResult;
      expect(execResult.stdout).toContain("Arguments: ['arg1', 'arg2']");
      expect(execResult.stdout).toContain('Script executed successfully!');
      expect(execResult.exit_code).toBe(0);
    });

    it('应该能够处理长时间运行的任务', async () => {
      if (skipIfNoApiKey()) return;

      const code = `
import time

for i in range(3):
    print(f"Step {i+1}/3")
    time.sleep(0.5)

print("Task completed!")
`;
      const result = await client.runCode(code, 'python') as CodeExecutionResult;

      expect(result.stdout || result.result).toContain('Step 1/3');
      expect(result.stdout || result.result).toContain('Step 2/3');
      expect(result.stdout || result.result).toContain('Step 3/3');
      expect(result.stdout || result.result).toContain('Task completed!');
      expect(result.error).toBeUndefined();
    }, 30000); // 增加超时时间

    it('应该能够执行环境信息查询', async () => {
      if (skipIfNoApiKey()) return;

      const code = `
import sys
import os
import platform

print(f"Python version: {sys.version}")
print(f"Platform: {platform.platform()}")
print(f"Current directory: {os.getcwd()}")
print(f"Environment: {os.environ.get('HOME', 'N/A')}")
`;
      const result = await client.runCode(code, 'python') as CodeExecutionResult;

      expect(result.stdout || result.result).toContain('Python version:');
      expect(result.stdout || result.result).toContain('Platform:');
      expect(result.stdout || result.result).toContain('Current directory:');
      expect(result.error).toBeUndefined();
    });
  });

  describe('错误处理和边界情况', () => {
    it('应该在没有 API Key 时抛出错误', () => {
      expect(() => {
        new E2BSandboxClient('');
      }).toThrow('E2B API key is required');
    });

    it('应该在 Sandbox 未创建时抛出错误', async () => {
      if (skipIfNoApiKey()) return;

      const uninitializedClient = new E2BSandboxClient(process.env.E2B_API_KEY);
      
      await expect(
        uninitializedClient.runCommand('echo "test"')
      ).rejects.toThrow('Sandbox not created');
    });

    it('应该在读取不存在的文件时处理错误', async () => {
      if (skipIfNoApiKey()) return;

      await client.create(TEMPLATE_ID);

      await expect(
        client.downloadFile('/nonexistent/path/file.txt')
      ).rejects.toThrow();
    });

    it('应该能够处理空代码执行', async () => {
      if (skipIfNoApiKey()) return;

      await client.create(TEMPLATE_ID);

      const result = await client.runCode('', 'python') as CodeExecutionResult;
      
      // 空代码应该成功执行（什么都不输出）
      expect(result.error).toBeUndefined();
    });

    it('应该能够处理代码中的语法错误', async () => {
      if (skipIfNoApiKey()) return;

      await client.create(TEMPLATE_ID);

      const code = `
def broken_function(
    print("Missing closing parenthesis")
`;
      const result = await client.runCode(code, 'python') as CodeExecutionResult;

      expect(result.error).toBeDefined();
      expect(result.error?.name).toContain('Error');
    });

    it('应该能够处理运行时错误', async () => {
      if (skipIfNoApiKey()) return;

      await client.create(TEMPLATE_ID);

      const code = `
def divide_by_zero():
    return 1 / 0

divide_by_zero()
`;
      const result = await client.runCode(code, 'python') as CodeExecutionResult;

      expect(result.error).toBeDefined();
      expect(result.error?.name).toContain('ZeroDivisionError');
    });
  });

  describe('并发和性能测试', () => {
    beforeEach(async () => {
      if (skipIfNoApiKey()) return;
      await client.create(TEMPLATE_ID);
    });

    it('应该能够处理快速连续的命令执行', async () => {
      if (skipIfNoApiKey()) return;

      const commands = [
        'echo "Command 1"',
        'echo "Command 2"',
        'echo "Command 3"',
      ];

      const results = await Promise.all(
        commands.map(cmd => client.runCommand(cmd))
      );

      results.forEach((result, index) => {
        const cmdResult = result as CommandResult;
        expect(cmdResult.exit_code).toBe(0);
        expect(cmdResult.stdout).toContain(`Command ${index + 1}`);
      });
    });

    it('应该能够处理快速连续的代码执行', async () => {
      if (skipIfNoApiKey()) return;

      const codes = [
        'print("Test 1")',
        'print("Test 2")',
        'print("Test 3")',
      ];

      const results = await Promise.all(
        codes.map(code => client.runCode(code, 'python'))
      );

      results.forEach((result, index) => {
        const codeResult = result as CodeExecutionResult;
        expect(codeResult.stdout || codeResult.result).toContain(`Test ${index + 1}`);
        expect(codeResult.error).toBeUndefined();
      });
    });

    it('应该能够处理大量输出', async () => {
      if (skipIfNoApiKey()) return;

      const code = `
for i in range(100):
    print(f"Line {i}: " + "x" * 50)
`;
      const result = await client.runCode(code, 'python') as CodeExecutionResult;

      const output = result.stdout || result.result;
      expect(output).toContain('Line 0:');
      expect(output).toContain('Line 99:');
      expect(result.error).toBeUndefined();
    });
  });

  describe('多语言支持测试', () => {
    beforeEach(async () => {
      if (skipIfNoApiKey()) return;
      await client.create(TEMPLATE_ID);
    });

    it('应该能够执行 TypeScript 代码', async () => {
      if (skipIfNoApiKey()) return;

      const code = `
const message: string = "Hello from TypeScript!";
console.log(message);
`;
      const result = await client.runCode(code, 'typescript') as CodeExecutionResult;

      expect(result.stdout || result.result).toContain('Hello from TypeScript!');
      expect(result.error).toBeUndefined();
    });

    it('应该能够执行 Bash 脚本', async () => {
      if (skipIfNoApiKey()) return;

      const code = `
#!/bin/bash
echo "Bash script execution"
VAR="test"
echo "Variable: $VAR"
`;
      const result = await client.runCode(code, 'bash') as CodeExecutionResult;

      expect(result.stdout || result.result).toContain('Bash script execution');
      expect(result.stdout || result.result).toContain('Variable: test');
      expect(result.error).toBeUndefined();
    });

    it('应该能够执行 R 代码', async () => {
      if (skipIfNoApiKey()) return;

      const code = `
x <- c(1, 2, 3, 4, 5)
print(paste("Sum:", sum(x)))
print(paste("Mean:", mean(x)))
`;
      const result = await client.runCode(code, 'r') as CodeExecutionResult;

      expect(result.stdout || result.result).toContain('Sum: 15');
      expect(result.stdout || result.result).toContain('Mean: 3');
      expect(result.error).toBeUndefined();
    });
  });

  describe('高级场景测试', () => {
    beforeEach(async () => {
      if (skipIfNoApiKey()) return;
      await client.create(TEMPLATE_ID);
    });

    it('应该能够执行多步骤工作流', async () => {
      if (skipIfNoApiKey()) return;

      // 步骤 1: 创建数据文件 (使用 printf 或 echo -e 来正确处理换行符)
      const step1 = await client.runCommand(
        'printf "name,age,score\\nAlice,30,85\\nBob,25,92\\n" > /tmp/data.csv'
      ) as CommandResult;
      expect(step1.exit_code).toBe(0);

      // 步骤 2: 处理数据
      const step2Code = `
import csv

with open('/tmp/data.csv', 'r') as f:
    reader = csv.DictReader(f)
    data = list(reader)

# 计算统计信息
total_score = sum(int(row['score']) for row in data)
avg_score = total_score / len(data)

print(f"Total records: {len(data)}")
print(f"Average score: {avg_score}")

# 写入结果
with open('/tmp/result.txt', 'w') as f:
    f.write(f"Average: {avg_score}\\n")
`;
      const step2 = await client.runCode(step2Code, 'python') as CodeExecutionResult;
      expect(step2.stdout || step2.result).toContain('Total records: 2');
      expect(step2.stdout || step2.result).toContain('Average score: 88.5');

      // 步骤 3: 验证结果文件
      const step3 = await client.runCommand('cat /tmp/result.txt') as CommandResult;
      expect(step3.stdout).toContain('Average: 88.5');
    });

    it('应该能够处理内存密集型任务', async () => {
      if (skipIfNoApiKey()) return;

      const code = `
# 创建大型数据结构
import sys

# 创建一个较大的列表
data = list(range(1000000))

# 执行一些计算
result = sum(data)
average = result / len(data)

print(f"Sum: {result}")
print(f"Average: {average}")
print(f"Data size: {sys.getsizeof(data)} bytes")
`;
      const result = await client.runCode(code, 'python') as CodeExecutionResult;

      expect(result.stdout || result.result).toContain('Sum:');
      expect(result.stdout || result.result).toContain('Average:');
      expect(result.error).toBeUndefined();
    }, 60000); // 增加超时时间

    it('应该能够使用多个 Python 包协同工作', async () => {
      if (skipIfNoApiKey()) return;

      // 安装包
      const install = await client.runCommand(
        'pip install numpy pandas -q'
      ) as CommandResult;
      expect(install.exit_code).toBe(0);

      // 使用包
      const code = `
import numpy as np
import pandas as pd

# 创建 NumPy 数组
arr = np.array([1, 2, 3, 4, 5])

# 创建 Pandas DataFrame
df = pd.DataFrame({
    'values': arr,
    'squared': arr ** 2
})

print("NumPy array sum:", arr.sum())
print("\\nDataFrame:")
print(df)
`;
      const result = await client.runCode(code, 'python') as CodeExecutionResult;

      expect(result.stdout || result.result).toContain('NumPy array sum: 15');
      expect(result.stdout || result.result).toContain('values');
      expect(result.stdout || result.result).toContain('squared');
      expect(result.error).toBeUndefined();
    }, 90000); // 安装包需要更长时间

    it('应该能够处理异步操作', async () => {
      if (skipIfNoApiKey()) return;

      const code = `
import asyncio

async def async_task(name, delay):
    await asyncio.sleep(delay)
    return f"{name} completed after {delay}s"

# E2B 环境已经在事件循环中，使用 await 而不是 asyncio.run()
async def main():
    # 并发执行多个任务
    tasks = [
        async_task("Task 1", 0.1),
        async_task("Task 2", 0.1),
        async_task("Task 3", 0.1)
    ]
    
    results = await asyncio.gather(*tasks)
    for result in results:
        print(result)

# 直接调用 await（在 E2B 的 Jupyter 环境中）
await main()
print("All tasks completed!")
`;
      const result = await client.runCode(code, 'python') as CodeExecutionResult;

      expect(result.stdout || result.result).toContain('Task 1 completed');
      expect(result.stdout || result.result).toContain('Task 2 completed');
      expect(result.stdout || result.result).toContain('Task 3 completed');
      expect(result.stdout || result.result).toContain('All tasks completed!');
      expect(result.error).toBeUndefined();
    });

    it('应该能够处理环境变量', async () => {
      if (skipIfNoApiKey()) return;

      // 设置环境变量
      const setEnv = await client.runCommand(
        'export MY_VAR="test_value" && export MY_NUM="42"'
      ) as CommandResult;
      expect(setEnv.exit_code).toBe(0);

      // 读取环境变量（同一个会话中）
      const code = `
import os

var = os.environ.get('HOME', 'Not set')
print(f"HOME: {var}")

# 尝试设置并读取环境变量
os.environ['PYTHON_VAR'] = 'python_value'
print(f"PYTHON_VAR: {os.environ['PYTHON_VAR']}")
`;
      const result = await client.runCode(code, 'python') as CodeExecutionResult;

      expect(result.stdout || result.result).toContain('HOME:');
      expect(result.stdout || result.result).toContain('PYTHON_VAR: python_value');
      expect(result.error).toBeUndefined();
    });
  });

  describe('Sandbox 重连和恢复测试', () => {
    it('应该能够重新连接到现有的 Sandbox', async () => {
      if (skipIfNoApiKey()) return;

      // 创建 Sandbox
      await client.create(TEMPLATE_ID);
      const originalId = client.sandboxId;
      expect(originalId).toBeDefined();

      // 在 Sandbox 中创建文件
      const createFile = await client.runCommand(
        'echo "persistent data" > /tmp/persistent.txt'
      ) as CommandResult;
      expect(createFile.exit_code).toBe(0);

      // 创建新客户端并重连
      const newClient = new E2BSandboxClient(process.env.E2B_API_KEY);
      await newClient.connect(originalId!);

      // 验证数据持久性
      const readFile = await newClient.runCommand(
        'cat /tmp/persistent.txt'
      ) as CommandResult;
      expect(readFile.stdout).toContain('persistent data');

      // 清理
      await newClient.close();
    });

    it('应该能够在关闭后创建新的 Sandbox', async () => {
      if (skipIfNoApiKey()) return;

      // 创建并关闭第一个 Sandbox
      await client.create(TEMPLATE_ID);
      const firstId = client.sandboxId;
      await client.close();
      expect(client.sandboxId).toBeNull();

      // 创建第二个 Sandbox
      await client.create(TEMPLATE_ID);
      const secondId = client.sandboxId;

      expect(secondId).toBeDefined();
      expect(secondId).not.toBe(firstId); // 应该是不同的 Sandbox
    });
  });

  describe('资源管理和清理测试', () => {
    it('应该能够管理多个并发 Sandbox', async () => {
      if (skipIfNoApiKey()) return;

      const clients: E2BSandboxClient[] = [];
      const clientCount = 3;

      try {
        // 创建多个客户端
        for (let i = 0; i < clientCount; i++) {
          const c = new E2BSandboxClient(process.env.E2B_API_KEY);
          await c.create(TEMPLATE_ID, 'test-user', `multi-test-${i}`);
          clients.push(c);
        }

        // 验证所有客户端都已创建
        expect(clients.length).toBe(clientCount);
        clients.forEach((c) => {
          expect(c.sandboxId).toBeDefined();
        });

        // 在每个 Sandbox 中执行任务
        const results = await Promise.all(
          clients.map((c, i) => 
            c.runCommand(`echo "Sandbox ${i}"`)
          )
        );

        results.forEach((result, i) => {
          const cmdResult = result as CommandResult;
          expect(cmdResult.stdout).toContain(`Sandbox ${i}`);
        });
      } finally {
        // 清理所有客户端
        await Promise.all(clients.map(c => c.close()));
      }
    }, 120000); // 需要更长的超时时间

    it('应该能够正确处理清理失败的情况', async () => {
      if (skipIfNoApiKey()) return;

      await client.create(TEMPLATE_ID);
      
      // 第一次关闭
      await client.close();
      expect(client.sandboxId).toBeNull();

      // 再次关闭不应该抛出错误
      await expect(client.close()).resolves.not.toThrow();
    });
  });
});
