import { BaseAgent, BaseAgentConfig } from '@monkey-agent/base';
import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { z } from 'zod';

/**
 * File Agent 配置
 */
export interface FileAgentConfig extends Partial<BaseAgentConfig> {
  /** Computer Use Agent 服务器 WebSocket 地址 */
  computerServerUrl?: string;
  /** 默认工作目录 */
  workingDirectory?: string;
}

/**
 * File Agent
 * 
 * 核心能力：
 * - 文件读写（读取、写入、追加、删除）
 * - 文件搜索（按名称、内容、类型搜索）
 * - 目录管理（创建、删除、列出、遍历）
 * - 文件监控（监听文件变化）
 * - 文件信息（大小、修改时间、权限）
 * - 文件操作（复制、移动、重命名）
 * 
 * 执行环境：通过 Computer Use Agent 服务器执行文件系统操作
 * 
 * @example
 * ```typescript
 * const fileAgent = new FileAgent({
 *   llmConfig: {
 *     provider: 'openai',
 *     apiKey: 'sk-...',
 *     model: 'gpt-4',
 *   },
 *   computerServerUrl: 'ws://localhost:8080',
 *   workingDirectory: '/Users/username/projects',
 * });
 * 
 * await fileAgent.execute({
 *   id: 'task-1',
 *   type: 'file-operation',
 *   description: '读取配置文件并分析',
 *   parameters: {},
 * });
 * ```
 */
export class FileAgent extends BaseAgent {
  private computerServerUrl: string;
  private workingDirectory: string;
  private wsClient?: WebSocket;

  constructor(config?: FileAgentConfig) {
    super({
      id: config?.id || 'file-agent',
      name: config?.name || 'File Agent',
      description: config?.description || '文件系统 Agent，负责文件读写、搜索、监控和目录管理',
      capabilities: config?.capabilities || [
        'file-read',
        'file-write',
        'file-append',
        'file-delete',
        'file-copy',
        'file-move',
        'file-rename',
        'file-exists',
        'file-info',
        'file-search',
        'directory-create',
        'directory-delete',
        'directory-list',
        'directory-tree',
        'file-watch',
      ],
      llmClient: config?.llmClient,
      llmConfig: config?.llmConfig,
      systemPrompt: config?.systemPrompt,
      maxIterations: config?.maxIterations,
      enableReflection: config?.enableReflection,
      contextCompression: config?.contextCompression,
    });

    this.computerServerUrl = config?.computerServerUrl || 'ws://localhost:8080';
    this.workingDirectory = config?.workingDirectory || process.cwd?.() || '/';
  }

  /**
   * 构建系统提示词
   */
  protected buildSystemPrompt(): string {
    return `You are File Agent, an intelligent file system management assistant.

Your capabilities:
- Read, write, append, and delete files
- Search files by name, content, or type
- Create, delete, and manage directories
- Copy, move, and rename files
- Get file information (size, modification time, permissions)
- Watch for file changes

When managing files:
1. Always verify file paths before operations
2. Be careful with destructive operations (delete, overwrite)
3. Handle large files efficiently
4. Respect file permissions and security
5. Provide clear feedback on operations performed

IMPORTANT: Always be cautious with file operations.
Verify paths, check if files exist, and ask for confirmation before destructive operations.
Always provide clear explanations of what file operations you're performing and their results.`;
  }

  /**
   * 定义文件操作工具
   */
  protected getToolDefinitions(): ToolSet {
    return {
      readFile: tool({
        description: 'Read contents of a file',
        inputSchema: z.object({
          path: z.string().describe('File path (absolute or relative to working directory)'),
          encoding: z.enum(['utf8', 'binary', 'base64']).optional().describe('File encoding (default: utf8)'),
          maxSize: z.number().optional().describe('Maximum size to read in bytes (prevent memory issues)'),
        }),
      }),

      writeFile: tool({
        description: 'Write content to a file (creates or overwrites)',
        inputSchema: z.object({
          path: z.string().describe('File path'),
          content: z.string().describe('Content to write'),
          encoding: z.enum(['utf8', 'binary', 'base64']).optional().describe('File encoding (default: utf8)'),
          createDirectories: z.boolean().optional().describe('Create parent directories if they don\'t exist'),
        }),
      }),

      appendFile: tool({
        description: 'Append content to the end of a file',
        inputSchema: z.object({
          path: z.string().describe('File path'),
          content: z.string().describe('Content to append'),
          encoding: z.enum(['utf8', 'binary', 'base64']).optional().describe('File encoding (default: utf8)'),
        }),
      }),

      deleteFile: tool({
        description: 'Delete a file',
        inputSchema: z.object({
          path: z.string().describe('File path'),
          force: z.boolean().optional().describe('Force delete without confirmation'),
        }),
      }),

      copyFile: tool({
        description: 'Copy a file to another location',
        inputSchema: z.object({
          source: z.string().describe('Source file path'),
          destination: z.string().describe('Destination file path'),
          overwrite: z.boolean().optional().describe('Overwrite if destination exists'),
        }),
      }),

      moveFile: tool({
        description: 'Move a file to another location',
        inputSchema: z.object({
          source: z.string().describe('Source file path'),
          destination: z.string().describe('Destination file path'),
          overwrite: z.boolean().optional().describe('Overwrite if destination exists'),
        }),
      }),

      renameFile: tool({
        description: 'Rename a file',
        inputSchema: z.object({
          path: z.string().describe('Current file path'),
          newName: z.string().describe('New file name (not full path)'),
        }),
      }),

      fileExists: tool({
        description: 'Check if a file or directory exists',
        inputSchema: z.object({
          path: z.string().describe('File or directory path'),
        }),
      }),

      getFileInfo: tool({
        description: 'Get information about a file (size, modification time, permissions)',
        inputSchema: z.object({
          path: z.string().describe('File path'),
        }),
      }),

      searchFiles: tool({
        description: 'Search for files by name, pattern, or content',
        inputSchema: z.object({
          directory: z.string().describe('Directory to search in'),
          pattern: z.string().optional().describe('File name pattern (glob or regex)'),
          content: z.string().optional().describe('Search for files containing this text'),
          fileType: z.string().optional().describe('Filter by file extension (e.g., ".js", ".txt")'),
          recursive: z.boolean().optional().describe('Search in subdirectories (default: true)'),
          maxResults: z.number().optional().describe('Maximum number of results to return'),
        }),
      }),

      createDirectory: tool({
        description: 'Create a new directory',
        inputSchema: z.object({
          path: z.string().describe('Directory path'),
          recursive: z.boolean().optional().describe('Create parent directories if needed (default: true)'),
        }),
      }),

      deleteDirectory: tool({
        description: 'Delete a directory',
        inputSchema: z.object({
          path: z.string().describe('Directory path'),
          recursive: z.boolean().optional().describe('Delete directory and all contents (default: false)'),
          force: z.boolean().optional().describe('Force delete without confirmation'),
        }),
      }),

      listDirectory: tool({
        description: 'List files and directories in a directory',
        inputSchema: z.object({
          path: z.string().describe('Directory path'),
          detailed: z.boolean().optional().describe('Include detailed information (size, modified time)'),
          showHidden: z.boolean().optional().describe('Include hidden files (default: false)'),
        }),
      }),

      getDirectoryTree: tool({
        description: 'Get a tree structure of a directory',
        inputSchema: z.object({
          path: z.string().describe('Directory path'),
          maxDepth: z.number().optional().describe('Maximum depth to traverse (default: 3)'),
          includeFiles: z.boolean().optional().describe('Include files in tree (default: true)'),
        }),
      }),

      watchFile: tool({
        description: 'Start watching a file or directory for changes',
        inputSchema: z.object({
          path: z.string().describe('File or directory path to watch'),
          events: z.array(z.enum(['create', 'modify', 'delete', 'rename'])).optional().describe('Events to watch for'),
        }),
      }),

      unwatchFile: tool({
        description: 'Stop watching a file or directory',
        inputSchema: z.object({
          path: z.string().describe('File or directory path to unwatch'),
        }),
      }),

      getWorkingDirectory: tool({
        description: 'Get the current working directory',
        inputSchema: z.object({}),
      }),

      setWorkingDirectory: tool({
        description: 'Set the working directory for subsequent operations',
        inputSchema: z.object({
          path: z.string().describe('New working directory path'),
        }),
      }),
    };
  }

  /**
   * 执行工具调用
   */
  protected async executeToolCall(toolName: string, input: any): Promise<any> {
    // 处理本地工具（不需要服务器）
    switch (toolName) {
      case 'getWorkingDirectory':
        return { path: this.workingDirectory };
      
      case 'setWorkingDirectory':
        this.workingDirectory = input.path;
        return { success: true, path: this.workingDirectory };
    }

    // 确保连接到 Computer Use Agent 服务器
    await this.ensureConnection();

    // 构建操作请求
    const request = {
      operation: 'file',
      action: toolName,
      parameters: {
        ...input,
        workingDirectory: this.workingDirectory,
      },
      request_id: `${Date.now()}-${Math.random()}`,
    };

    // 通过 WebSocket 发送请求
    return await this.sendRequest(request);
  }

  // ============ WebSocket 连接管理 ============

  /**
   * 确保与服务器的连接
   */
  private async ensureConnection(): Promise<void> {
    if (this.wsClient && this.wsClient.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.wsClient = new WebSocket(this.computerServerUrl);

        this.wsClient.onopen = () => {
          this.emit('computer-server:connected', { url: this.computerServerUrl });
          resolve();
        };

        this.wsClient.onerror = (error) => {
          this.emit('computer-server:error', { error });
          reject(new Error('Failed to connect to Computer Use Agent server'));
        };

        this.wsClient.onclose = () => {
          this.emit('computer-server:disconnected');
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 发送请求到服务器
   */
  private async sendRequest(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.wsClient || this.wsClient.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to Computer Use Agent server'));
        return;
      }

      // 设置超时
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 30000); // 30 秒超时

      // 监听响应
      const messageHandler = (event: MessageEvent) => {
        try {
          const response = JSON.parse(event.data);

          // 检查是否是当前请求的响应
          if (response.request_id === request.request_id) {
            clearTimeout(timeout);
            this.wsClient?.removeEventListener('message', messageHandler);

            if (response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response.error || 'Operation failed'));
            }
          }
        } catch (error) {
          // 忽略解析错误，可能是其他消息
        }
      };

      this.wsClient.addEventListener('message', messageHandler);

      // 发送请求
      this.wsClient.send(JSON.stringify(request));
      this.emit('computer-server:request-sent', { request });
    });
  }

  /**
   * 关闭连接
   */
  public disconnect(): void {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = undefined;
    }
  }
}
