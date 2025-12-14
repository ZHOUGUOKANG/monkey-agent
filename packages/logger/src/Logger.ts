/**
 * Logger - 统一日志组件
 * 
 * 支持分级日志、上下文标签、时间戳、彩色输出、结构化日志
 */

import chalk from 'chalk';
import { LogLevel, type LoggerConfig } from './types';

export class Logger {
  private config: Required<LoggerConfig>;
  
  constructor(context: string, config?: Partial<LoggerConfig>) {
    this.config = {
      level: this.parseEnvLogLevel() ?? LogLevel.INFO,
      context,
      enableColor: (typeof process !== 'undefined' && process.stdout?.isTTY) ?? true,
      enableTimestamp: true,
      structured: false,
      ...config,
    };
  }
  
  /**
   * 从环境变量解析日志级别
   */
  private parseEnvLogLevel(): LogLevel | undefined {
    if (typeof process === 'undefined' || !process.env) return undefined;
    
    const level = process.env.LOG_LEVEL?.toUpperCase();
    switch (level) {
      case 'DEBUG': return LogLevel.DEBUG;
      case 'INFO': return LogLevel.INFO;
      case 'WARN': return LogLevel.WARN;
      case 'ERROR': return LogLevel.ERROR;
      case 'SILENT': return LogLevel.SILENT;
      default: return undefined;
    }
  }
  
  /**
   * 格式化日志消息
   */
  private format(levelStr: string, message: string, data?: any): string {
    const parts: string[] = [];
    
    // 时间戳
    if (this.config.enableTimestamp) {
      const timestamp = this.config.enableColor 
        ? chalk.gray(`[${new Date().toISOString()}]`)
        : `[${new Date().toISOString()}]`;
      parts.push(timestamp);
    }
    
    // 上下文
    parts.push(`[${this.config.context}]`);
    
    // 级别
    parts.push(`[${levelStr}]`);
    
    // 消息
    parts.push(message);
    
    // 数据
    if (data !== undefined) {
      if (this.config.structured) {
        // 结构化输出（单行 JSON）
        parts.push(JSON.stringify(data));
      } else if (typeof data === 'object') {
        // 格式化输出（多行 JSON）
        parts.push('\n' + JSON.stringify(data, null, 2));
      } else {
        parts.push(String(data));
      }
    }
    
    return parts.join(' ');
  }
  
  /**
   * DEBUG 级别日志
   */
  debug(message: string, data?: any) {
    if (this.config.level <= LogLevel.DEBUG) {
      const formatted = this.format('DEBUG', message, data);
      console.log(this.config.enableColor ? chalk.blue(formatted) : formatted);
    }
  }
  
  /**
   * INFO 级别日志
   */
  info(message: string, data?: any) {
    if (this.config.level <= LogLevel.INFO) {
      const formatted = this.format('INFO', message, data);
      console.log(this.config.enableColor ? chalk.green(formatted) : formatted);
    }
  }
  
  /**
   * WARN 级别日志
   */
  warn(message: string, data?: any) {
    if (this.config.level <= LogLevel.WARN) {
      const formatted = this.format('WARN', message, data);
      console.warn(this.config.enableColor ? chalk.yellow(formatted) : formatted);
    }
  }
  
  /**
   * ERROR 级别日志
   */
  error(message: string, data?: any) {
    if (this.config.level <= LogLevel.ERROR) {
      const formatted = this.format('ERROR', message, data);
      console.error(this.config.enableColor ? chalk.red(formatted) : formatted);
    }
  }
  
  /**
   * 流式输出专用（DEBUG 级别）
   * 用于记录 AI SDK 的 stream parts
   */
  stream(part: any) {
    if (this.config.level <= LogLevel.DEBUG) {
      this.debug(`[STREAM] ${part.type}`, part);
    }
  }
  
  /**
   * 创建子 Logger（继承配置，使用新的 context）
   */
  child(context: string): Logger {
    return new Logger(context, this.config);
  }
  
  /**
   * 设置日志级别（运行时修改）
   */
  setLevel(level: LogLevel) {
    this.config.level = level;
  }
  
  /**
   * 获取当前日志级别
   */
  getLevel(): LogLevel {
    return this.config.level;
  }
}

