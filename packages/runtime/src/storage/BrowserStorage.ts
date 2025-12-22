import { IStorage } from '@monkey-agent/types';

/**
 * 浏览器存储实现
 * 使用 localStorage 或 chrome.storage
 */
export class BrowserStorage implements IStorage {
  private storage: Storage;

  constructor() {
    if (typeof localStorage !== 'undefined') {
      this.storage = localStorage;
    } else {
      throw new Error('localStorage is not available');
    }
  }

  async get(key: string): Promise<any> {
    const value = this.storage.getItem(key);
    if (value === null) {
      return undefined;
    }
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  async set(key: string, value: any): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    this.storage.setItem(key, stringValue);
  }

  async delete(key: string): Promise<void> {
    this.storage.removeItem(key);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }

  async keys(): Promise<string[]> {
    return Object.keys(this.storage);
  }
}
