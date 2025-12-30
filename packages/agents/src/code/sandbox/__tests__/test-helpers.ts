/**
 * E2B Sandbox 测试辅助工具
 * 
 * 提供测试中常用的工具函数和辅助类
 */

import { E2BSandboxClient } from '../E2BSandboxClient';
import type { CommandResult, CodeExecutionResult } from '../BaseSandboxClient';
import { loadEnvFile } from '@monkey-agent/utils';

/**
 * 测试环境配置
 */
export const TEST_CONFIG = {
  TEMPLATE_ID: 'base',
  DEFAULT_TIMEOUT: 60000,
  LONG_TIMEOUT: 120000,
};

/**
 * 初始化测试环境
 * 尝试从 .env 文件加载环境变量
 */
export function initTestEnv(): void {
  // 从项目根目录加载 .env（相对于 process.cwd()，向上两级到达 monorepo 根目录）
  loadEnvFile({ 
    envPath: '../../.env',
    verbose: false, // 测试时不显示加载信息
  });
}

/**
 * 检查是否设置了 E2B API Key
 */
export function hasApiKey(): boolean {
  return !!process.env.E2B_API_KEY;
}

/**
 * 跳过测试的辅助函数
 */
export function skipIfNoApiKey(): boolean {
  if (!hasApiKey()) {
    console.warn('⚠️  Skipping test: E2B_API_KEY not set');
    console.warn('💡 提示: 在项目根目录创建 .env 文件，添加: E2B_API_KEY=your-key');
    return true;
  }
  return false;
}

/**
 * 等待指定时间
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 创建临时文件名
 */
export function createTempFileName(prefix: string = 'test', ext: string = 'txt'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
}

/**
 * 测试用的 Sandbox 管理器
 * 自动处理创建和清理
 */
export class TestSandboxManager {
  private clients: E2BSandboxClient[] = [];

  /**
   * 创建一个新的测试 Sandbox
   */
  async createSandbox(
    apiKey: string = process.env.E2B_API_KEY || '',
    templateId: string = TEST_CONFIG.TEMPLATE_ID
  ): Promise<E2BSandboxClient> {
    const client = new E2BSandboxClient(apiKey);
    await client.create(templateId, 'test-user', `test-${Date.now()}`);
    this.clients.push(client);
    return client;
  }

  /**
   * 创建多个测试 Sandbox
   */
  async createMultipleSandboxes(
    count: number,
    apiKey: string = process.env.E2B_API_KEY || ''
  ): Promise<E2BSandboxClient[]> {
    const clients: E2BSandboxClient[] = [];
    for (let i = 0; i < count; i++) {
      const client = await this.createSandbox(apiKey);
      clients.push(client);
    }
    return clients;
  }

  /**
   * 清理所有创建的 Sandbox
   */
  async cleanup(): Promise<void> {
    await Promise.all(this.clients.map(client => client.close()));
    this.clients = [];
  }

  /**
   * 清理所有创建的 Sandbox（别名）
   */
  async cleanupAll(): Promise<void> {
    return this.cleanup();
  }

  /**
   * 获取已创建的 Sandbox 数量
   */
  getCount(): number {
    return this.clients.length;
  }
}

/**
 * 断言辅助函数
 */
export const assertions = {
  /**
   * 断言命令执行成功
   */
  assertCommandSuccess(result: CommandResult, expectedOutput?: string): void {
    if (result.exit_code !== 0) {
      throw new Error(`Command failed with exit code ${result.exit_code}: ${result.stderr || result.error}`);
    }
    if (expectedOutput && !result.stdout.includes(expectedOutput)) {
      throw new Error(`Expected output to contain "${expectedOutput}", got: ${result.stdout}`);
    }
  },

  /**
   * 断言代码执行成功
   */
  assertCodeSuccess(result: CodeExecutionResult, expectedOutput?: string): void {
    if (result.error) {
      throw new Error(`Code execution failed: ${result.error.name}: ${result.error.value}`);
    }
    if (expectedOutput) {
      const output = result.stdout || result.result;
      if (!output.includes(expectedOutput)) {
        throw new Error(`Expected output to contain "${expectedOutput}", got: ${output}`);
      }
    }
  },

  /**
   * 断言代码执行失败
   */
  assertCodeError(result: CodeExecutionResult, expectedErrorType?: string): void {
    if (!result.error) {
      throw new Error('Expected code execution to fail, but it succeeded');
    }
    if (expectedErrorType && !result.error.name.includes(expectedErrorType)) {
      throw new Error(`Expected error type to contain "${expectedErrorType}", got: ${result.error.name}`);
    }
  },
};

/**
 * 常用测试代码片段
 */
export const testCode = {
  python: {
    hello: 'print("Hello from Python")',
    helloWorld: 'print("Hello, World!")',
    error: 'print(undefined_variable)',
    
    mathCalculation: `
result = 42 + 58
print(f"Result: {result}")
`,
    
    fileOperation: `
with open('/tmp/test.txt', 'w') as f:
    f.write('Test content')

with open('/tmp/test.txt', 'r') as f:
    content = f.read()
    print(f"Content: {content}")
`,
    
    errorExample: 'print(undefined_variable)',
    
    asyncExample: `
import asyncio

async def main():
    print("Async start")
    await asyncio.sleep(0.1)
    print("Async end")

asyncio.run(main())
`,
    
    dataProcessing: `
import json

data = [
    {"name": "Alice", "score": 85},
    {"name": "Bob", "score": 92}
]

avg_score = sum(item["score"] for item in data) / len(data)
print(json.dumps({"average": avg_score}, indent=2))
`,
  },

  javascript: {
    hello: 'console.log("Hello from JavaScript")',
    helloWorld: 'console.log("Hello, World!")',
    
    mathCalculation: `
const result = 42 + 58;
console.log(\`Result: \${result}\`);
`,
  },

  bash: {
    hello: 'echo "Hello from Bash"',
    helloWorld: 'echo "Hello, World!"',
    
    fileOperation: `
echo "Test content" > /tmp/test.txt
cat /tmp/test.txt
`,
  },
};

/**
 * 生成测试数据
 */
export const testData = {
  /**
   * 生成随机字符串
   */
  randomString(length: number = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * 生成测试 CSV 数据
   */
  generateCSV(rows: number = 10): string {
    let csv = 'id,name,value\n';
    for (let i = 0; i < rows; i++) {
      csv += `${i},name_${i},${Math.random() * 100}\n`;
    }
    return csv;
  },

  /**
   * 生成测试 JSON 数据
   */
  generateJSON(items: number = 10): string {
    const data = Array.from({ length: items }, (_, i) => ({
      id: i,
      name: `item_${i}`,
      value: Math.random() * 100,
    }));
    return JSON.stringify(data, null, 2);
  },
};

/**
 * 重试辅助函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await sleep(delayMs);
      }
    }
  }
  
  throw lastError || new Error('Retry failed');
}

/**
 * 超时包装器
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ]);
}
