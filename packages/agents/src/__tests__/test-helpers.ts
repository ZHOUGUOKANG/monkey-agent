import type { ILLMClient } from '@monkey-agent/types';
import type { Page, Browser } from 'playwright';
import { vi, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * 创建 Mock LLM Client
 */
export function createMockLLMClient(): ILLMClient {
  return {
    chat: vi.fn().mockResolvedValue({
      text: 'Mock response',
      usage: { promptTokens: 10, completionTokens: 20 },
    }),
    stream: vi.fn(),
    embeddings: vi.fn(),
  } as any;
}

/**
 * 创建 Mock Playwright Page
 */
export function createMockPage(): Page {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    title: vi.fn().mockResolvedValue('Test Page'),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    content: vi.fn().mockResolvedValue('<html><body>Test</body></html>'),
    textContent: vi.fn().mockResolvedValue('Test text'),
    getAttribute: vi.fn().mockResolvedValue('test-value'),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
    evaluate: vi.fn().mockResolvedValue('result'),
  } as any;
}

/**
 * 创建 Mock Playwright Browser
 */
export function createMockBrowser(page?: Page): Browser {
  return {
    newPage: vi.fn().mockResolvedValue(page || createMockPage()),
    close: vi.fn().mockResolvedValue(undefined),
  } as any;
}

/**
 * 临时文件/目录管理
 */
export class TestFileManager {
  private tempPaths: string[] = [];
  private defaultTempDir?: string;

  async createTempDir(): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'));
    this.tempPaths.push(tempDir);
    if (!this.defaultTempDir) {
      this.defaultTempDir = tempDir;
    }
    return tempDir;
  }

  async createTempFile(content: string, filename?: string, dir?: string): Promise<string> {
    // 如果没有指定目录，使用默认临时目录（如果有的话）
    const targetDir = dir || this.defaultTempDir;
    
    if (!targetDir) {
      // 如果没有默认目录，创建一个新的
      const tempDir = await this.createTempDir();
      const filePath = path.join(tempDir, filename || 'test-file.txt');
      await fs.writeFile(filePath, content, 'utf-8');
      return filePath;
    }
    
    // 在指定目录中创建文件
    const filePath = path.join(targetDir, filename || `test-file-${Date.now()}.txt`);
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  /**
   * 获取所有创建的临时目录列表（用于白名单）
   */
  getAllTempDirs(): string[] {
    return [...this.tempPaths];
  }

  async cleanup(): Promise<void> {
    for (const p of this.tempPaths) {
      try {
        await fs.rm(p, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    this.tempPaths = [];
    this.defaultTempDir = undefined;
  }
}

/**
 * 验证成功返回格式
 */
export function assertSuccessFormat(result: any): void {
  expect(result).toBeDefined();
  expect(result.success).toBe(true);
  expect(result.message).toBeDefined();
  expect(typeof result.message).toBe('string');
}

/**
 * 验证错误返回格式
 */
export function assertErrorFormat(result: any): void {
  expect(result).toBeDefined();
  expect(result.success).toBe(false);
  expect(result.error).toBeDefined();
  expect(typeof result.error).toBe('string');
  expect(result.message).toBeDefined();
  expect(typeof result.message).toBe('string');
}

