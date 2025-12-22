import { IStorage } from '@monkey-agent/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Node.js 文件系统存储实现
 */
export class NodeFSStorage implements IStorage {
  private storageDir: string;

  constructor(storageDir?: string) {
    this.storageDir = storageDir || path.join(os.homedir(), '.monkey-agent');
    this.ensureStorageDir();
  }

  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create storage directory:', error);
    }
  }

  private getFilePath(key: string): string {
    return path.join(this.storageDir, `${key}.json`);
  }

  async get(key: string): Promise<any> {
    try {
      const filePath = this.getFilePath(key);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return undefined;
    }
  }

  async set(key: string, value: any): Promise<void> {
    const filePath = this.getFilePath(key);
    const content = JSON.stringify(value, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore error if file doesn't exist
    }
  }

  async clear(): Promise<void> {
    const files = await fs.readdir(this.storageDir);
    await Promise.all(
      files.map((file) => fs.unlink(path.join(this.storageDir, file)))
    );
  }

  async keys(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.storageDir);
      return files
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.replace('.json', ''));
    } catch {
      return [];
    }
  }
}
