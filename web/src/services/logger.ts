import type { LogEntry } from '../types';

class LoggerService {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private listeners: Set<(logs: LogEntry[]) => void> = new Set();

  log(level: LogEntry['level'], message: string, source?: string) {
    const entry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      level,
      message,
      timestamp: Date.now(),
      source,
    };

    this.logs.push(entry);

    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // 通知监听者
    this.notifyListeners();
  }

  debug(message: string, source?: string) {
    this.log('debug', message, source);
  }

  info(message: string, source?: string) {
    this.log('info', message, source);
  }

  warn(message: string, source?: string) {
    this.log('warn', message, source);
  }

  error(message: string, source?: string) {
    this.log('error', message, source);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
    this.notifyListeners();
  }

  subscribe(callback: (logs: LogEntry[]) => void) {
    this.listeners.add(callback);
    // 立即发送当前日志
    callback(this.getLogs());

    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners() {
    const logs = this.getLogs();
    this.listeners.forEach((callback) => callback(logs));
  }
}

export const logger = new LoggerService();

