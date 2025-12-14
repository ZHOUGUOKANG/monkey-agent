/**
 * Logger 类型定义
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 99
}

export interface LoggerConfig {
  level?: LogLevel;
  context?: string;
  enableColor?: boolean;
  enableTimestamp?: boolean;
  structured?: boolean;
}

