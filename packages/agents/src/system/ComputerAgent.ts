import { BaseAgent } from '@monkey-agent/base';
import { tool } from 'ai';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ILLMClient } from '@monkey-agent/types';
import * as robot from 'robotjs';

const execAsync = promisify(exec);

/**
 * Computer Agent 配置
 */
export interface ComputerAgentConfig {
  llmClient: ILLMClient;
  allowedDirectories: string[];  // 文件操作白名单
  allowedCommands: string[];     // Shell 命令白名单
  id?: string;
  name?: string;
  description?: string;
}

/**
 * Computer Agent
 * 
 * 统一的系统控制 Agent (Node.js环境)，整合以下功能：
 * 1. 计算机控制（鼠标、键盘、截图） - 使用 robotjs
 * 2. 文件操作（文件读写、目录管理） - 使用 fs/promises
 * 3. Shell 命令（命令执行、系统信息） - 使用 child_process
 * 
 * 核心能力：
 * - 鼠标控制：移动、点击
 * - 键盘输入：输入文本、按键
 * - 屏幕截图
 * - 文件读写
 * - 目录管理
 * - Shell 命令执行
 * - 系统信息查询
 * 
 * 安全特性：
 * - 路径白名单验证（文件操作）
 * - 命令白名单验证（Shell 执行）
 * - 危险命令拦截
 * - 路径遍历防护
 */
export class ComputerAgent extends BaseAgent {
  private allowedDirectories: string[];
  private allowedCommands: string[];
  private dangerousCommands = ['rm -rf', 'format', 'dd', 'mkfs', ':(){', '>/dev/'];

  constructor(config: ComputerAgentConfig) {
    super({
      id: config.id || 'computer-agent',
      name: config.name || 'Computer Agent',
      description: config.description || '系统控制 Agent，负责计算机控制、文件操作和 Shell 命令执行',
      capabilities: [
        'mouse', 'keyboard', 'screenshot',  // 计算机控制
        'read', 'write', 'list', 'delete',  // 文件操作
        'exec', 'env', 'system-info'        // Shell 命令
      ],
      llmClient: config.llmClient,
      systemPrompt: `You are a computer automation and system operations expert with deep knowledge of file systems, shell commands, and desktop automation.

## 🖥️ Computer Control Capabilities
You have full control over the mouse, keyboard, and screen:
- **Mouse Control**: Move cursor, click (left/right/middle), precise positioning
- **Keyboard Input**: Type text, press special keys (Enter, Escape, Tab, etc.)
- **Screen Capture**: Take screenshots of full screen or specific regions

## 📁 File System Operations
You can perform comprehensive file and directory management:
- **Read/Write**: Read file contents (⚠️ use maxLength for large files), write/append to files
- **Directory Management**: List, create, and navigate directories
- **File Operations**: Check existence, get stats (size, modified time)
- **⚠️ IMPORTANT**: Always specify maxLength when reading potentially large files (logs, data files, etc.)
- **Large Files**: Files >1MB will fail without maxLength parameter to prevent context overflow

## 🔧 Shell Command Execution
Execute system commands with security constraints:
- **Allowed Commands**: Only whitelisted commands (${config.allowedCommands.join(', ')})
- **System Info**: Query platform, architecture, environment variables
- **Directory Context**: Get current working directory

## 🔗 Data Sharing in Workflows (⚠️ CRITICAL)
When working in a workflow with other agents:
- **ALWAYS store produced data** in the workflow context using \`valSet(key, data)\`
- Use descriptive variable names: "fileContent", "commandOutput", "systemInfo", etc.
- **MUST mention the variable name in your summary**: e.g., "Executed command and stored output as 'commandOutput'"
- This allows downstream agents (like ReportAgent) to access your data
- Examples:
  * Read file → \`valSet({ key: 'configData', value: content })\`
  * Summary: "Read config file and stored as 'configData'"
  * Execute command → \`valSet({ key: 'processInfo', value: output })\`
  * Summary: "Got process list and stored as 'processInfo'"

## 🛡️ Security & Best Practices

### Path Security
- ✅ **Allowed Directories**: ${config.allowedDirectories.join(', ')}
- ❌ **Path Traversal**: Never use ".." or "~" in paths
- ✅ **Absolute Paths**: Prefer absolute paths for clarity
- ❌ **Restricted Areas**: System directories are protected

### Command Safety
- ✅ **Whitelist Only**: Only use explicitly allowed commands
- ❌ **Dangerous Operations**: rm -rf, format, dd, mkfs are BLOCKED
- ✅ **Timeout**: Commands have execution timeouts (default: 10s)
- ✅ **Output Limits**: Command output is capped at 1MB

### Desktop Automation Tips
- 🎯 **Coordinates**: Ensure mouse coordinates are within screen bounds
- ⏱️ **Timing**: Add small delays between rapid actions if needed
- 📸 **Verification**: Use screenshots to verify UI state before/after actions
- ⌨️ **Key Names**: Use standard key names (ENTER, ESCAPE, A, B, etc.)

## 📋 Common Workflows

### File Management Workflow
1. Check if file/directory exists (fileExists)
2. Get file stats to check size (getFileStats) - ⚠️ Check size before reading!
3. Read contents with appropriate maxLength (readFile)
4. Perform operations (writeFile, createDirectory, deleteFile)
5. Verify results (getFileStats)
6. **Store data using valSet if needed by downstream agents**

### Reading Large Files Strategy
- **Always check file size first** with getFileStats
- For files >100KB, specify maxLength parameter
- For files >1MB, consider alternative approaches:
  - Use shell commands to process (head, tail, grep)
  - Read file metadata only
  - Ask user for specific sections to read

### Shell Command Workflow
1. Check current directory (getCwd)
2. Verify command is allowed
3. Execute command (execCommand)
4. Parse stdout/stderr in response
5. **Store important data using valSet for downstream agents**

### Desktop Automation Workflow
1. Take initial screenshot to understand UI state
2. Move mouse to target position
3. Perform click/type actions
4. Take verification screenshot
5. Extract data if needed

## ⚠️ Important Constraints
- File operations are restricted to: ${config.allowedDirectories.join(', ')}
- Shell commands are restricted to: ${config.allowedCommands.join(', ')}
- All paths are validated against security policies
- Dangerous commands are automatically blocked

## 🎯 Error Handling
- If a file operation fails, check permissions and path validity
- If a command is blocked, explain why and suggest alternatives
- If mouse/keyboard operations fail, verify system permissions
- Always provide clear error messages to help debugging

Remember: You operate with elevated privileges. Always validate inputs and follow security best practices. When producing data that might be needed by downstream agents, ALWAYS store it using valSet with descriptive variable names.`,
    });
    
    this.allowedDirectories = config.allowedDirectories.map(dir => path.resolve(dir));
    this.allowedCommands = config.allowedCommands;
  }

  /**
   * 定义工具
   */
  public getToolDefinitions() {
    return {
      // ============ 计算机控制工具 (5个) ============
      moveMouse: tool({
        description: 'Move mouse to specific coordinates',
        inputSchema: z.object({ 
          x: z.number().describe('X coordinate'),
          y: z.number().describe('Y coordinate'),
        }),
      }),
      
      clickMouse: tool({
        description: 'Click mouse button',
        inputSchema: z.object({
          button: z.enum(['left', 'right', 'middle']).optional().describe('Mouse button (default: left)'),
        }),
      }),
      
      typeText: tool({
        description: 'Type text using keyboard',
        inputSchema: z.object({
          text: z.string().describe('Text to type'),
        }),
      }),
      
      pressKey: tool({
        description: 'Press a keyboard key',
        inputSchema: z.object({
          key: z.string().describe('Key to press (e.g., "enter", "escape", "a")'),
        }),
      }),
      
      takeScreenshot: tool({
        description: 'Take a screenshot of the screen',
        inputSchema: z.object({
          region: z.object({
            x: z.number(),
            y: z.number(),
            width: z.number(),
            height: z.number(),
          }).optional().describe('Region to capture (optional, captures full screen if not provided)'),
        }),
      }),

      // ============ 文件操作工具 (8个) ============
      readFile: tool({
        description: 'Read content from a file. For large files, use maxLength to prevent context overflow.',
        inputSchema: z.object({ 
          path: z.string().describe('Path to the file to read'),
          maxLength: z.number().optional().describe('Maximum length of content to return (default: 50000 characters). Prevents context overflow for large files.'),
          encoding: z.enum(['utf-8', 'base64']).optional().describe('File encoding (default: utf-8)'),
        }),
      }),
      
      writeFile: tool({
        description: 'Write content to a file',
        inputSchema: z.object({
          path: z.string().describe('Path to the file to write'),
          content: z.string().describe('Content to write to the file'),
        }),
      }),
      
      appendFile: tool({
        description: 'Append content to a file',
        inputSchema: z.object({
          path: z.string().describe('Path to the file'),
          content: z.string().describe('Content to append'),
        }),
      }),
      
      listDirectory: tool({
        description: 'List contents of a directory',
        inputSchema: z.object({
          path: z.string().describe('Path to the directory'),
        }),
      }),
      
      createDirectory: tool({
        description: 'Create a new directory',
        inputSchema: z.object({
          path: z.string().describe('Path to the directory to create'),
        }),
      }),
      
      deleteFile: tool({
        description: 'Delete a file',
        inputSchema: z.object({
          path: z.string().describe('Path to the file to delete'),
        }),
      }),
      
      fileExists: tool({
        description: 'Check if a file or directory exists',
        inputSchema: z.object({
          path: z.string().describe('Path to check'),
        }),
      }),
      
      getFileStats: tool({
        description: 'Get file statistics (size, modified time, etc.)',
        inputSchema: z.object({
          path: z.string().describe('Path to the file'),
        }),
      }),

      // ============ Shell 命令工具 (4个) ============
      execCommand: tool({
        description: 'Execute a shell command and get its output',
        inputSchema: z.object({ 
          command: z.string().describe('The shell command to execute'),
          timeout: z.number().optional().describe('Timeout in milliseconds (default: 10000)'),
        }),
      }),
      
      getEnv: tool({
        description: 'Get an environment variable value',
        inputSchema: z.object({
          name: z.string().describe('Name of the environment variable'),
        }),
      }),
      
      getSystemInfo: tool({
        description: 'Get system information (platform, arch, hostname, etc.)',
        inputSchema: z.object({}),
      }),
      
      getCwd: tool({
        description: 'Get current working directory',
        inputSchema: z.object({}),
      }),
    };
  }

  /**
   * 执行工具调用
   */
  protected async executeToolCall(toolName: string, input: any): Promise<any> {
    try {
      switch (toolName) {
        // ============ 计算机控制工具 ============
        case 'moveMouse':
          return await this.moveMouse(input);
        case 'clickMouse':
          return await this.clickMouse(input);
        case 'typeText':
          return await this.typeText(input);
        case 'pressKey':
          return await this.pressKey(input);
        case 'takeScreenshot':
          return await this.takeScreenshot(input);

        // ============ 文件操作工具 ============
        case 'readFile':
          return await this.readFile(input);
        case 'writeFile':
          return await this.writeFile(input);
        case 'appendFile':
          return await this.appendFile(input);
        case 'listDirectory':
          return await this.listDirectory(input);
        case 'createDirectory':
          return await this.createDirectory(input);
        case 'deleteFile':
          return await this.deleteFile(input);
        case 'fileExists':
          return await this.fileExists(input);
        case 'getFileStats':
          return await this.getFileStats(input);

        // ============ Shell 命令工具 ============
        case 'execCommand':
          return await this.execCommand(input);
        case 'getEnv':
          return await this.getEnv(input);
        case 'getSystemInfo':
          return await this.getSystemInfo(input);
        case 'getCwd':
          return await this.getCwd(input);
          
        default:
          return {
            success: false,
            error: `Unknown tool: ${toolName}`,
            message: `Tool ${toolName} is not supported by NodeComputerAgent`
          };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `Error in ${toolName}: ${error.message}`
      };
    }
  }

  // ============ 计算机控制工具实现 ============

  /**
   * 移动鼠标
   */
  private async moveMouse(input: { x: number; y: number }): Promise<any> {
    try {
      robot.moveMouse(input.x, input.y);
      return { 
        success: true,
        x: input.x,
        y: input.y,
        message: `Moved mouse to (${input.x}, ${input.y})` 
      };
    } catch (error: any) {
      if (error.message?.includes('Cannot find module') || error.code === 'MODULE_NOT_FOUND') {
        return {
          success: false,
          error: 'Computer control library (robotjs) is not installed',
          message: 'Please install robotjs to use computer control features'
        };
      }
      throw error;
    }
  }

  /**
   * 点击鼠标
   */
  private async clickMouse(input: { button?: 'left' | 'right' | 'middle' }): Promise<any> {
    try {
      const buttonType = input.button || 'left';
      robot.mouseClick(buttonType);
      return { 
        success: true,
        button: buttonType,
        message: `Clicked ${buttonType} mouse button` 
      };
    } catch (error: any) {
      if (error.message?.includes('Cannot find module') || error.code === 'MODULE_NOT_FOUND') {
        return {
          success: false,
          error: 'Computer control library (robotjs) is not installed',
          message: 'Please install robotjs to use computer control features'
        };
      }
      throw error;
    }
  }

  /**
   * 键盘输入文本
   */
  private async typeText(input: { text: string }): Promise<any> {
    try {
      robot.typeString(input.text);
      return { 
        success: true,
        text: input.text,
        message: `Typed text: "${input.text}"` 
      };
    } catch (error: any) {
      if (error.message?.includes('Cannot find module') || error.code === 'MODULE_NOT_FOUND') {
        return {
          success: false,
          error: 'Computer control library (robotjs) is not installed',
          message: 'Please install robotjs to use computer control features'
        };
      }
      throw error;
    }
  }

  /**
   * 按键
   */
  private async pressKey(input: { key: string }): Promise<any> {
    try {
      robot.keyTap(input.key.toLowerCase());
      return { 
        success: true,
        key: input.key,
        message: `Pressed key: ${input.key}` 
      };
    } catch (error: any) {
      if (error.message?.includes('Cannot find module') || error.code === 'MODULE_NOT_FOUND') {
        return {
          success: false,
          error: 'Computer control library (robotjs) is not installed',
          message: 'Please install robotjs to use computer control features'
        };
      }
      return {
        success: false,
        error: `Failed to press key: ${error.message}`,
        message: `Key ${input.key} might not be supported`
      };
    }
  }

  /**
   * 截图
   */
  private async takeScreenshot(input: { region?: { x: number; y: number; width: number; height: number } }): Promise<any> {
    try {
      const bitmap = input.region 
        ? robot.screen.capture(input.region.x, input.region.y, input.region.width, input.region.height)
        : robot.screen.capture();
      
      // 转换为 base64
      const base64 = bitmap.image.toString('base64');
      
      return { 
        success: true,
        screenshot: base64,
        width: bitmap.width,
        height: bitmap.height,
        region: input.region,
        message: `Screenshot taken${input.region ? ' of specified region' : ''}` 
      };
    } catch (error: any) {
      if (error.message?.includes('Cannot find module') || error.code === 'MODULE_NOT_FOUND') {
        return {
          success: false,
          error: 'Computer control library (robotjs) is not installed',
          message: 'Please install robotjs to use computer control features'
        };
      }
      throw error;
    }
  }

  // ============ 文件操作工具实现 ============

  /**
   * 截断内容并添加提示信息
   */
  private truncateContent(content: string, maxLength: number): { content: string; truncated: boolean; originalLength: number } {
    const originalLength = content.length;
    if (originalLength <= maxLength) {
      return { content, truncated: false, originalLength };
    }
    
    const truncated = content.substring(0, maxLength);
    return {
      content: truncated + '\n\n[Content truncated. Original length: ' + originalLength + ' characters. Use maxLength parameter or read file in chunks.]',
      truncated: true,
      originalLength
    };
  }

  /**
   * 读取文件
   */
  private async readFile(input: { path: string; maxLength?: number; encoding?: 'utf-8' | 'base64' }): Promise<any> {
    try {
      this.validatePath(input.path);
      const encoding = input.encoding || 'utf-8';
      const maxLength = input.maxLength || 50000;
      
      // 先获取文件大小
      const stats = await fs.stat(input.path);
      const fileSize = stats.size;
      
      // 如果文件太大，给出警告
      if (fileSize > 1024 * 1024 && !input.maxLength) {
        return {
          success: false,
          error: 'File too large',
          fileSize,
          path: input.path,
          message: `File is ${Math.round(fileSize / 1024)}KB. Please specify maxLength parameter to read large files, or use a different approach.`
        };
      }
      
      let content = await fs.readFile(input.path, encoding);
      
      if (encoding === 'utf-8') {
        const { content: finalContent, truncated, originalLength } = this.truncateContent(content, maxLength);
        
        return { 
          success: true,
          content: finalContent,
          path: input.path,
          size: finalContent.length,
          originalSize: originalLength,
          fileSize,
          truncated,
          message: truncated 
            ? `Read ${finalContent.length} characters from ${input.path} (truncated from ${originalLength})`
            : `Read ${finalContent.length} characters from ${input.path}` 
        };
      } else {
        // base64 不截断
        return {
          success: true,
          content,
          path: input.path,
          size: content.length,
          fileSize,
          encoding: 'base64',
          message: `Read ${content.length} characters (base64) from ${input.path}`
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `Error reading file ${input.path}: ${error.message}`
      };
    }
  }

  /**
   * 写入文件
   */
  private async writeFile(input: { path: string; content: string }): Promise<any> {
    try {
      this.validatePath(input.path);
      await fs.writeFile(input.path, input.content, 'utf-8');
      return { 
        success: true,
        path: input.path,
        size: input.content.length,
        message: `Wrote ${input.content.length} characters to ${input.path}` 
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `Error writing file ${input.path}: ${error.message}`
      };
    }
  }

  /**
   * 追加文件
   */
  private async appendFile(input: { path: string; content: string }): Promise<any> {
    try {
      this.validatePath(input.path);
      await fs.appendFile(input.path, input.content, 'utf-8');
      return { 
        success: true,
        path: input.path,
        message: `Appended content to ${input.path}` 
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `Error appending to file ${input.path}: ${error.message}`
      };
    }
  }

  /**
   * 列出目录
   */
  private async listDirectory(input: { path: string }): Promise<any> {
    try {
      this.validatePath(input.path);
      const entries = await fs.readdir(input.path, { withFileTypes: true });
      const files = entries.map(entry => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: path.join(input.path, entry.name),
      }));
      return { 
        success: true,
        files,
        path: input.path,
        count: files.length,
        message: `Found ${files.length} items in ${input.path}` 
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `Error listing directory ${input.path}: ${error.message}`
      };
    }
  }

  /**
   * 创建目录
   */
  private async createDirectory(input: { path: string }): Promise<any> {
    try {
      this.validatePath(input.path);
      await fs.mkdir(input.path, { recursive: true });
      return { 
        success: true,
        path: input.path,
        message: `Created directory ${input.path}` 
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `Error creating directory ${input.path}: ${error.message}`
      };
    }
  }

  /**
   * 删除文件
   */
  private async deleteFile(input: { path: string }): Promise<any> {
    try {
      this.validatePath(input.path);
      await fs.unlink(input.path);
      return { 
        success: true,
        path: input.path,
        message: `Deleted file ${input.path}` 
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `Error deleting file ${input.path}: ${error.message}`
      };
    }
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(input: { path: string }): Promise<any> {
    try {
      this.validatePath(input.path);
      try {
        await fs.access(input.path);
        return { 
          success: true,
          exists: true,
          path: input.path,
          message: `File ${input.path} exists` 
        };
      } catch {
        return { 
          success: true,
          exists: false,
          path: input.path,
          message: `File ${input.path} does not exist` 
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `Error checking file existence ${input.path}: ${error.message}`
      };
    }
  }

  /**
   * 获取文件统计信息
   */
  private async getFileStats(input: { path: string }): Promise<any> {
    try {
      this.validatePath(input.path);
      const stats = await fs.stat(input.path);
      return { 
        success: true,
        size: stats.size,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        modified: stats.mtime.toISOString(),
        created: stats.birthtime.toISOString(),
        path: input.path,
        message: `Got stats for ${input.path}` 
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `Error getting file stats ${input.path}: ${error.message}`
      };
    }
  }

  // ============ Shell 命令工具实现 ============

  /**
   * 执行 Shell 命令
   */
  private async execCommand(input: { command: string; timeout?: number }): Promise<any> {
    try {
      this.validateCommand(input.command);
      
      const timeout = input.timeout || 10000;
      const maxOutputLength = 50000; // 最大输出长度
      
      const { stdout, stderr } = await execAsync(input.command, {
        timeout,
        maxBuffer: 1024 * 1024, // 1MB
      });
      
      // 截断输出
      const { content: truncatedStdout, truncated: stdoutTruncated, originalLength: stdoutOriginalLength } = 
        this.truncateContent(stdout.trim(), maxOutputLength);
      const { content: truncatedStderr, truncated: stderrTruncated, originalLength: stderrOriginalLength } = 
        this.truncateContent(stderr.trim(), maxOutputLength);
      
      return { 
        success: true,
        stdout: truncatedStdout,
        stderr: truncatedStderr,
        command: input.command,
        stdoutTruncated,
        stderrTruncated,
        stdoutOriginalLength,
        stderrOriginalLength,
        message: (stdoutTruncated || stderrTruncated)
          ? `Command executed with truncated output. stdout: ${truncatedStdout.length}/${stdoutOriginalLength}, stderr: ${truncatedStderr.length}/${stderrOriginalLength}`
          : `Command executed: ${input.command}` 
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `Error executing command: ${error.message}`
      };
    }
  }

  /**
   * 获取环境变量
   */
  private async getEnv(input: { name: string }): Promise<any> {
    const value = process.env[input.name];
    return { 
      success: true,
      name: input.name,
      value: value || null,
      exists: value !== undefined,
      message: value ? `Got environment variable ${input.name}` : `Environment variable ${input.name} not found` 
    };
  }

  /**
   * 获取系统信息
   */
  private async getSystemInfo(_input: {}): Promise<any> {
    return { 
      success: true,
      platform: process.platform,
      arch: process.arch,
      hostname: require('os').hostname(),
      type: require('os').type(),
      release: require('os').release(),
      cpus: require('os').cpus().length,
      totalMemory: require('os').totalmem(),
      freeMemory: require('os').freemem(),
      uptime: require('os').uptime(),
      nodeVersion: process.version,
      message: `System: ${process.platform} ${process.arch}` 
    };
  }

  /**
   * 获取当前工作目录
   */
  private async getCwd(_input: {}): Promise<any> {
    return { 
      success: true,
      cwd: process.cwd(),
      message: `Current working directory: ${process.cwd()}` 
    };
  }

  // ============ 安全验证方法 ============

  /**
   * 验证路径是否在白名单内
   */
  private validatePath(filePath: string): void {
    // 检测路径遍历模式
    if (filePath.includes('..') || filePath.includes('~')) {
      throw new Error('Path traversal patterns not allowed');
    }
    
    const resolved = path.resolve(filePath);
    const allowed = this.allowedDirectories.some(dir => 
      resolved.startsWith(dir)
    );
    
    if (!allowed) {
      throw new Error(`Access denied: ${filePath} is not in allowed directories. Allowed: ${this.allowedDirectories.join(', ')}`);
    }
  }

  /**
   * 验证命令是否允许执行
   */
  private validateCommand(command: string): void {
    // 规范化命令（移除多余空格）
    const normalized = command.replace(/\s+/g, ' ').trim().toLowerCase();
    
    // 检查是否包含危险命令
    for (const dangerous of this.dangerousCommands) {
      if (normalized.includes(dangerous)) {
        throw new Error(`Command not allowed: contains dangerous operation "${dangerous}"`);
      }
    }
    
    // 检查命令是否在白名单内
    const commandName = command.trim().split(' ')[0];
    const allowed = this.allowedCommands.some(allowedCmd => 
      commandName === allowedCmd || command.startsWith(allowedCmd + ' ')
    );
    
    if (!allowed) {
      throw new Error(`Command not allowed: "${commandName}" is not in whitelist. Allowed: ${this.allowedCommands.join(', ')}`);
    }
  }
}
