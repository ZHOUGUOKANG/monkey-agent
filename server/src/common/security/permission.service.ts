import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

/**
 * Permission Service
 * 
 * 职责：
 * - 验证文件路径访问权限
 * - 验证命令执行权限
 * - 检测危险操作
 */
@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);
  
  private allowedDirectories: string[];
  private allowedCommands: string[];
  private dangerousOperations: string[];

  constructor(private config: ConfigService) {
    this.allowedDirectories = this.config
      .get('ALLOWED_DIRECTORIES', '')
      .split(',')
      .filter(Boolean)
      .map(dir => path.resolve(dir.trim()));
    
    this.allowedCommands = this.config
      .get('ALLOWED_COMMANDS', 'npm,yarn,git,python,node,ls,cat,pwd')
      .split(',')
      .filter(Boolean)
      .map(cmd => cmd.trim());
    
    this.dangerousOperations = this.config
      .get('DANGEROUS_OPERATIONS', 'rm -rf,format,dd,mkfs')
      .split(',')
      .filter(Boolean)
      .map(op => op.trim());

    this.logger.log(`Allowed directories: ${this.allowedDirectories.join(', ')}`);
    this.logger.log(`Allowed commands: ${this.allowedCommands.join(', ')}`);
  }

  /**
   * 验证文件路径访问
   */
  validateFileAccess(filePath: string): boolean {
    const resolved = path.resolve(filePath);
    const allowed = this.allowedDirectories.some(dir => resolved.startsWith(dir));
    
    if (!allowed) {
      this.logger.warn(`Access denied: ${filePath}`);
    }
    
    return allowed;
  }

  /**
   * 验证命令执行
   */
  validateCommand(command: string): boolean {
    // 检查危险操作
    if (this.isDangerous(command)) {
      this.logger.warn(`Dangerous command blocked: ${command}`);
      return false;
    }
    
    // 检查命令白名单
    const commandName = command.trim().split(' ')[0];
    const allowed = this.allowedCommands.some(allowedCmd => 
      commandName === allowedCmd || command.startsWith(allowedCmd + ' ')
    );
    
    if (!allowed) {
      this.logger.warn(`Command not in whitelist: ${commandName}`);
    }
    
    return allowed;
  }

  /**
   * 检测危险操作
   */
  isDangerous(operation: string): boolean {
    return this.dangerousOperations.some(dangerous => 
      operation.includes(dangerous)
    );
  }

  /**
   * 获取允许的目录列表
   */
  getAllowedDirectories(): string[] {
    return this.allowedDirectories;
  }

  /**
   * 获取允许的命令列表
   */
  getAllowedCommands(): string[] {
    return this.allowedCommands;
  }
}

