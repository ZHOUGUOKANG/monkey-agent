import { IStorage, IEventEmitter } from '../types';
import { BrowserStorage } from './storage/BrowserStorage';
import { NodeFSStorage } from './storage/NodeFSStorage';
import EventEmitter from 'eventemitter3';

/**
 * 运行时适配器
 * 提供跨环境的统一接口
 */
export class RuntimeAdapter {
  /**
   * 判断是否在 Node.js 环境
   */
  static isNode(): boolean {
    return (
      typeof process !== 'undefined' &&
      process.versions != null &&
      process.versions.node != null
    );
  }

  /**
   * 判断是否在浏览器环境
   */
  static isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  /**
   * 获取存储实例
   */
  static async getStorage(): Promise<IStorage> {
    if (this.isNode()) {
      return new NodeFSStorage();
    } else if (this.isBrowser()) {
      return new BrowserStorage();
    }
    throw new Error('Unsupported runtime environment');
  }

  /**
   * 获取事件发射器实例
   */
  static getEventEmitter(): IEventEmitter {
    const emitter = new EventEmitter();
    return {
      on: (event: string, handler: (...args: any[]) => void) => {
        emitter.on(event, handler);
      },
      off: (event: string, handler: (...args: any[]) => void) => {
        emitter.off(event, handler);
      },
      emit: (event: string, ...args: any[]) => {
        emitter.emit(event, ...args);
      },
    };
  }

  /**
   * 获取环境信息
   */
  static getEnvironment(): 'browser' | 'node' {
    return this.isNode() ? 'node' : 'browser';
  }
}
