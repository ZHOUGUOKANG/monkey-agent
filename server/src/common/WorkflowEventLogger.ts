/**
 * Workflow 事件日志记录器
 * 
 * 在 AgentGateway 层监听所有 workflow 事件并写入日志文件
 * 通过环境变量 ENABLE_WORKFLOW_LOGGING 控制是否启用
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '@nestjs/common';

export interface WorkflowLogEntry {
  timestamp: number;
  eventType: string;
  data: any;
}

export class WorkflowEventLogger {
  private readonly logger = new Logger(WorkflowEventLogger.name);
  private workflowId: string;
  private logFilePath: string;
  private logBuffer: WorkflowLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private isClosed = false;

  constructor(workflowId: string, logDir: string = './logs/workflows') {
    this.workflowId = workflowId;
    this.logFilePath = path.join(logDir, `${workflowId}.log`);
    
    // 初始化日志文件
    this.init().catch(err => {
      this.logger.error(`Failed to initialize workflow logger for ${workflowId}:`, err);
    });
    
    // 定期刷新缓冲区（每 2 秒）
    this.flushInterval = setInterval(() => {
      this.flush().catch(err => {
        this.logger.error('Failed to flush workflow log buffer:', err);
      });
    }, 2000);
  }

  private async init(): Promise<void> {
    try {
      // 确保目录存在
      const logDir = path.dirname(this.logFilePath);
      await fs.mkdir(logDir, { recursive: true });
      
      // 写入日志头
      const header: WorkflowLogEntry = {
        timestamp: Date.now(),
        eventType: 'workflow:init',
        data: {
          workflowId: this.workflowId,
          startTime: new Date().toISOString()
        }
      };
      
      await fs.writeFile(this.logFilePath, JSON.stringify(header, null, 2) + '\n');
      this.logger.debug(`Workflow log file created: ${this.logFilePath}`);
    } catch (error) {
      this.logger.error('Failed to init workflow log file:', error);
    }
  }

  /**
   * 记录事件
   */
  log(eventType: string, eventData: any): void {
    if (this.isClosed) return;
    
    const entry: WorkflowLogEntry = {
      timestamp: Date.now(),
      eventType,
      data: eventData
    };
    
    this.logBuffer.push(entry);
    
    // 如果缓冲区太大，立即刷新
    if (this.logBuffer.length >= 50) {
      this.flush().catch(err => {
        this.logger.error('Failed to flush workflow log:', err);
      });
    }
  }

  /**
   * 刷新缓冲区到文件
   */
  private async flush(): Promise<void> {
    if (this.logBuffer.length === 0) return;
    
    try {
      const entries = this.logBuffer.splice(0, this.logBuffer.length);
      const logLines = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
      
      await fs.appendFile(this.logFilePath, logLines);
    } catch (error) {
      this.logger.error('Failed to flush workflow log:', error);
      // 如果写入失败，将条目放回缓冲区头部
      this.logBuffer.unshift(...this.logBuffer);
    }
  }

  /**
   * 关闭日志记录器
   */
  async close(): Promise<void> {
    if (this.isClosed) return;
    this.isClosed = true;
    
    // 清除定时器
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // 最后一次刷新
    await this.flush();
    
    // 写入日志尾
    const footer: WorkflowLogEntry = {
      timestamp: Date.now(),
      eventType: 'workflow:close',
      data: {
        workflowId: this.workflowId,
        endTime: new Date().toISOString()
      }
    };
    
    try {
      await fs.appendFile(this.logFilePath, JSON.stringify(footer, null, 2) + '\n');
      this.logger.debug(`Workflow log file closed: ${this.logFilePath}`);
    } catch (error) {
      this.logger.error('Failed to write workflow log footer:', error);
    }
  }

  /**
   * 获取日志文件路径
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }
}

