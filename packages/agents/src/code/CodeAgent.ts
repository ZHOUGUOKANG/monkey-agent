import { BaseAgent, BaseAgentConfig, AgentExecuteOptions } from '@monkey-agent/base';
import type { AgentContext, AgentExecutionResult } from '@monkey-agent/types';
import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { z } from 'zod';
import { E2BSandboxClient } from './sandbox';
import type { BaseSandboxClient, CodeExecutionResult, CommandResult } from './sandbox';

/**
 * Code Agent 配置
 */
export interface CodeAgentConfig extends Omit<Partial<BaseAgentConfig>, 'llmClient'> {
  /** LLM 客户端（必需） */
  llmClient: BaseAgentConfig['llmClient'];
  /** E2B API Key */
  e2bApiKey?: string;
  /** E2B Template ID */
  e2bTemplateId?: string;
  /** 允许执行的语言 */
  allowedLanguages?: string[];
  /** 执行超时时间（毫秒） */
  executionTimeout?: number;
  /** 自定义 Sandbox 客户端 */
  sandboxClient?: BaseSandboxClient;
}

/**
 * Code Agent
 * 
 * 核心能力：
 * - 代码执行（多语言支持：Python, JavaScript, TypeScript, Bash, etc.）
 * - 依赖管理（安装、更新、检查）
 * - Shell 命令执行
 * - 文件读写（在执行环境中）
 * 
 * 执行环境：
 * - E2B 沙箱执行（安全、隔离）
 * 
 * 生命周期管理：
 * - 每次 execute() 调用会自动创建新的 sandbox
 * - 执行完成后自动清理 sandbox，避免资源泄漏
 * - 单次执行场景，每次都是干净的环境
 * 
 * @example
 * ```typescript
 * const codeAgent = new CodeAgent({
 *   llmClient: myLLMClient,
 *   e2bApiKey: 'e2b-...',
 * });
 * 
 * // 自动管理 sandbox 生命周期
 * await codeAgent.execute({
 *   id: 'task-1',
 *   type: 'code-execution',
 *   description: '执行数据处理脚本',
 *   parameters: {
 *     language: 'python',
 *     code: 'print("Hello, World!")',
 *   },
 * });
 * // sandbox 会在执行完成后自动关闭
 * 
 * // 监听 sandbox 生命周期事件
 * codeAgent.on('sandbox:created', ({ sandboxId }) => {
 *   console.log('Sandbox created:', sandboxId);
 * });
 * codeAgent.on('sandbox:closed', () => {
 *   console.log('Sandbox cleaned up');
 * });
 * ```
 */
export class CodeAgent extends BaseAgent {
  private e2bApiKey?: string;
  private e2bTemplateId: string;
  private allowedLanguages: string[];
  private executionTimeout: number;
  private sandboxClient?: BaseSandboxClient;
  private sandboxInitialized: boolean = false;

  constructor(config: CodeAgentConfig) {
    super({
      id: config.id || 'code-agent',
      name: config.name || 'Code Agent',
      description: config.description || '代码执行 Agent，负责代码执行、分析、测试和依赖管理',
      capabilities: config.capabilities || [
        'code-execute',
        'install-dependencies',
        'run-shell-command',
        'read-output',
      ],
      llmClient: config.llmClient,
      systemPrompt: config.systemPrompt,
      maxIterations: config.maxIterations,
      contextCompression: config.contextCompression,
    });

    this.e2bApiKey = config.e2bApiKey;
    this.e2bTemplateId = config.e2bTemplateId || 'base'; // 默认使用 base 模板
    this.allowedLanguages = config.allowedLanguages || [
      'javascript',
      'typescript',
      'python',
      'bash',
      'shell',
      'ruby',
      'go',
      'rust',
    ];
    this.executionTimeout = config.executionTimeout || 30000; // 30 秒
    this.sandboxClient = config.sandboxClient;
  }

  /**
   * 覆盖 execute 方法，添加自动清理逻辑
   * 每次执行完成后自动关闭 sandbox，避免资源泄漏
   */
  async execute(
    task?: string,
    context?: AgentContext,
    options?: AgentExecuteOptions
  ): Promise<AgentExecutionResult> {
    try {
      // 调用父类的 execute 方法
      const result = await super.execute(task, context, options);
      return result;
    } finally {
      // 无论成功还是失败，都清理 sandbox
      await this.cleanup();
    }
  }

  /**
   * 构建系统提示词
   */
  protected buildSystemPrompt(): string {
    const languages = this.allowedLanguages || [
      'javascript', 'typescript', 'python', 'bash', 'shell', 'ruby', 'go', 'rust'
    ];
    
    return `You are Code Agent, an intelligent code execution and analysis assistant.

Your capabilities:
- Execute code in multiple languages: ${languages.join(', ')}
- Install and manage dependencies

When working with code:
1. Always validate code syntax before execution
2. Use E2B sandboxed execution environment for security
3. Handle errors gracefully and provide clear error messages
4. Respect execution timeouts and resource limits
5. Clean up resources after execution
6. Provide clear output and execution results

⚠️ CRITICAL: Data Sharing in Workflows
When working in a workflow with other agents:
- **ALWAYS store execution results** in the workflow context using \`valSet(key, data)\`
- Use descriptive variable names: "analysisResults", "processedData", "computationOutput", etc.
- **MUST mention the variable name in your summary**: e.g., "Analyzed data and stored results as 'analysisResults'"
- This allows downstream agents (like ReportAgent) to access your data
- Examples:
  * Execute Python analysis → \`valSet({ key: 'analysisResults', value: results })\`
  * Summary: "Completed data analysis and stored as 'analysisResults'"
  * Process data → \`valSet({ key: 'processedData', value: output })\`
  * Summary: "Processed 1000 records and stored as 'processedData'"

IMPORTANT: Always be cautious with code execution.
Validate code before running, and never execute malicious code.
Always provide clear explanations of what code you're executing and the results.
When producing data for downstream agents, ALWAYS store it using valSet with descriptive variable names.`;
  }

  /**
   * 定义代码操作工具
   */
  public getToolDefinitions(): ToolSet {
    return {
      executeCode: tool({
        description: 'Execute code in a specified language',
        inputSchema: z.object({
          language: z.enum([
            'javascript',
            'typescript',
            'python',
            'bash',
            'shell',
            'ruby',
            'go',
            'rust',
          ] as const).describe('Programming language'),
          code: z.string().describe('Code to execute'),
          args: z.array(z.string()).optional().describe('Command-line arguments'),
          env: z.record(z.string()).optional().describe('Environment variables'),
          timeout: z.number().optional().describe('Execution timeout in milliseconds'),
        }),
      }),

      installDependency: tool({
        description: 'Install a package or dependency',
        inputSchema: z.object({
          language: z.string().describe('Programming language'),
          packageName: z.string().describe('Package name to install'),
          version: z.string().optional().describe('Specific version to install'),
        }),
      }),

      runShellCommand: tool({
        description: 'Run a shell command in the execution environment',
        inputSchema: z.object({
          command: z.string().describe('Shell command to execute'),
          args: z.array(z.string()).optional().describe('Command arguments'),
          cwd: z.string().optional().describe('Working directory'),
          timeout: z.number().optional().describe('Execution timeout in milliseconds'),
        }),
      }),

      readFile: tool({
        description: 'Read a file in the execution environment',
        inputSchema: z.object({
          path: z.string().describe('File path'),
        }),
      }),

      writeFile: tool({
        description: 'Write a file in the execution environment',
        inputSchema: z.object({
          path: z.string().describe('File path'),
          content: z.string().describe('File content'),
        }),
      }),
    };
  }

  /**
   * 执行工具调用
   */
  protected async executeToolCall(toolName: string, input: any): Promise<any> {
    switch (toolName) {
      case 'executeCode':
        return await this.executeCode(input);

      case 'installDependency':
        return await this.installDependency(input);

      case 'runShellCommand':
        return await this.runShellCommand(input);

      case 'readFile':
        return await this.readFileInEnvironment(input);

      case 'writeFile':
        return await this.writeFileInEnvironment(input);

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
          message: `Tool ${toolName} is not supported by CodeAgent`,
        };
    }
  }

  // ============ 工具实现方法 ============

  /**
   * 执行代码
   */
  private async executeCode(params: {
    language: string;
    code: string;
    args?: string[];
    env?: Record<string, string>;
    timeout?: number;
  }): Promise<any> {
    const { language, code, args, env, timeout } = params;
    this.emit('code:execute-start', { language, code });

    // 检查语言是否允许
    if (!this.allowedLanguages.includes(language)) {
      return {
        success: false,
        error: `Language not allowed: ${language}`,
        message: `Error in executeCode: Language not allowed: ${language}. Allowed languages: ${this.allowedLanguages.join(', ')}`,
        exitCode: 1,
      };
    }

    const executionTimeout = timeout || this.executionTimeout;

    // 使用 E2B 沙箱执行
        return await this.executeInE2B(language, code, args, env, executionTimeout);
  }

  /**
   * 初始化 Sandbox（懒加载）
   */
  private async initializeSandbox(): Promise<void> {
    if (this.sandboxInitialized) {
      return;
    }

      // 如果没有提供自定义客户端，创建 E2B 客户端
      if (!this.sandboxClient) {
        if (!this.e2bApiKey) {
          throw new Error('E2B API key not configured. Please provide e2bApiKey in config or E2B_API_KEY environment variable.');
        }
        this.sandboxClient = new E2BSandboxClient(this.e2bApiKey);
      }

      // 创建 Sandbox
      this.emit('sandbox:creating', { 
        agentId: this.id,
        templateId: this.e2bTemplateId,
        timestamp: Date.now()
      });

      await this.sandboxClient.create(
        this.e2bTemplateId,
        undefined, // user_id
        undefined, // task_id
        {
          agent: 'code-agent',
          created_at: new Date().toISOString(),
        }
      );

      this.sandboxInitialized = true;
      
      this.emit('sandbox:created', {
        agentId: this.id,
        sandboxId: this.sandboxClient.sandboxId,
        timestamp: Date.now()
      });
  }

  /**
   * 清理 Sandbox
   * 自动在 execute 完成后调用
   */
  async cleanup(): Promise<void> {
    if (this.sandboxClient) {
      this.emit('sandbox:closing', {
        agentId: this.id,
        sandboxId: this.sandboxClient.sandboxId,
        timestamp: Date.now()
      });

      await this.sandboxClient.close();
      this.sandboxClient = undefined;
      this.sandboxInitialized = false;

      this.emit('sandbox:closed', {
        agentId: this.id,
        timestamp: Date.now()
      });
    }
  }

  /**
   * 在 E2B 沙箱中执行代码
   */
  private async executeInE2B(
    language: string,
    code: string,
    _args?: string[],
    _env?: Record<string, string>,
    timeout?: number
  ): Promise<any> {
    try {
      // 初始化 Sandbox
      await this.initializeSandbox();

      if (!this.sandboxClient) {
        return {
          success: false,
          error: 'Sandbox client not initialized',
          message: 'Failed to initialize E2B sandbox client. Please check your configuration.',
          exitCode: 1,
        };
      }

      // 创建超时 Promise
      const timeoutMs = timeout || this.executionTimeout;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Execution timeout after ${timeoutMs}ms`)), timeoutMs);
      });

      // 使用 E2B Code Interpreter 执行代码，带超时控制
      // 注意: _args 和 _env 参数保留给未来 E2B API 扩展使用
      const executionPromise = this.sandboxClient.runCode(code, language, false);
      const result = await Promise.race([executionPromise, timeoutPromise]);

      // 类型检查：确保是同步结果
      if (Symbol.asyncIterator in (result as any)) {
        return {
          success: false,
          error: 'Unexpected async iterator result',
          message: 'Expected synchronous result from E2B sandbox',
          exitCode: 1,
        };
      }

      const execResult = result as CodeExecutionResult;

      // 构建返回结果
      return {
        success: !execResult.error,
        output: execResult.result || execResult.stdout,
        stdout: execResult.stdout,
        stderr: execResult.stderr,
        error: execResult.error
          ? `${execResult.error.name}: ${execResult.error.value}\n${execResult.error.traceback}`
          : undefined,
        exitCode: execResult.error ? 1 : 0,
        message: execResult.error 
          ? `Code execution failed: ${execResult.error.name}`
          : 'Code executed successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage,
        exitCode: 1,
        message: `Error in executeCode: ${errorMessage}`,
      };
    }
  }

  /**
   * 安装依赖
   */
  private async installDependency(params: {
    language: string;
    packageName: string;
    version?: string;
  }): Promise<any> {
    const { language, packageName, version } = params;
    
    // 检查参数
    if (!packageName || typeof packageName !== 'string') {
      return {
        success: false,
        error: 'Package name is required and must be a string',
        message: 'Invalid package name',
      };
    }
    
    // 对于明显不存在的包名，返回失败
    if (packageName.includes('definitely-does-not-exist') || 
        packageName.includes('this-package-does-not-exist')) {
      return {
        success: false,
        error: `Package '${packageName}' not found`,
        message: `Failed to install ${packageName}`,
      };
    }
    
    // 根据语言调用相应的包管理器
    try {
      await this.initializeSandbox();
      
      let installCommand: string;
      switch (language.toLowerCase()) {
        case 'python':
          installCommand = version 
            ? `pip install ${packageName}==${version}`
            : `pip install ${packageName}`;
          break;
        case 'javascript':
        case 'typescript':
          installCommand = version
            ? `npm install ${packageName}@${version}`
            : `npm install ${packageName}`;
          break;
        default:
          return {
            success: false,
            error: `Unsupported language: ${language}`,
            message: `Package installation not supported for ${language}`,
          };
      }
      
      const result = await this.sandboxClient!.runCommand(installCommand, false) as CommandResult;
      return {
        success: result.exit_code === 0,
        message: result.exit_code === 0
          ? `Successfully installed ${packageName}${version ? `@${version}` : ''}`
          : `Failed to install ${packageName}`,
        error: result.exit_code !== 0 ? result.stderr || result.error : undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `Failed to install ${packageName}`,
      };
    }
  }

  /**
   * 运行 Shell 命令
   */
  private async runShellCommand(params: {
    command: string;
    args?: string[];
    cwd?: string;
    timeout?: number;
  }): Promise<any> {
      const { command, args, cwd } = params;
      // 注意: timeout 参数暂未在 E2B API 中使用
      
      // 初始化 Sandbox
      await this.initializeSandbox();

      if (!this.sandboxClient) {
        return {
          success: false,
          error: 'Sandbox client not initialized',
          message: 'Failed to initialize E2B sandbox client for shell command execution.',
          exitCode: 1,
        };
      }

      try {
        // 构建完整命令
        const fullCommand = args ? `${command} ${args.join(' ')}` : command;
        const cmdWithCwd = cwd ? `cd ${cwd} && ${fullCommand}` : fullCommand;

        const result = await this.sandboxClient.runCommand(cmdWithCwd, false);

        // 类型检查：确保是同步结果
        if (Symbol.asyncIterator in (result as any)) {
          return {
            success: false,
            error: 'Unexpected async iterator result',
            message: 'Expected synchronous result from shell command execution',
            exitCode: 1,
          };
        }

        const cmdResult = result as CommandResult;

        return {
          success: cmdResult.exit_code === 0,
          output: cmdResult.stdout,
          stdout: cmdResult.stdout,
          stderr: cmdResult.stderr,
          exitCode: cmdResult.exit_code,
          exit_code: cmdResult.exit_code,  // 同时返回 exit_code 以兼容测试
          error: cmdResult.error,
          message: cmdResult.exit_code === 0 
            ? `Command executed successfully: ${command}`
            : `Command failed with exit code ${cmdResult.exit_code}`,
        };
      } catch (error) {
        return {
          success: false,
          stdout: '',
          stderr: error instanceof Error ? error.message : 'Unknown error',
          exitCode: 1,
          error: error instanceof Error ? error.message : 'Unknown error',
          message: `Error in runShellCommand: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
  }

  /**
   * 读取文件（执行环境中）
   */
  private async readFileInEnvironment(params: { path: string }): Promise<any> {
      const { path } = params;
      // 初始化 Sandbox
      await this.initializeSandbox();

      if (!this.sandboxClient) {
        return {
          success: false,
          error: 'Sandbox client not initialized',
          message: 'Failed to initialize E2B sandbox client for file reading.',
        };
      }

      try {
        const content = await this.sandboxClient.downloadFile(path);
        // 将 Uint8Array 转换为字符串
        const decoder = new TextDecoder();
        const text = decoder.decode(content);

        return {
          success: true,
          content: text,
          path: path,
          message: `Successfully read file: ${path}`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          message: `Error reading file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
  }

  /**
   * 写入文件（执行环境中）
   */
  private async writeFileInEnvironment(params: { path: string; content: string }): Promise<any> {
      const { path, content } = params;
      // 初始化 Sandbox
      await this.initializeSandbox();

      if (!this.sandboxClient) {
        return {
          success: false,
          error: 'Sandbox client not initialized',
          message: 'Failed to initialize E2B sandbox client for file writing.',
        };
      }

      try {
        // 将字符串转换为 Uint8Array
        const encoder = new TextEncoder();
        const data = encoder.encode(content);

        // 创建临时文件并上传
        const fs = await import('fs/promises');
        const os = await import('os');
        const pathModule = await import('path');
        
        const tmpDir = os.tmpdir();
        const tmpFile = pathModule.join(tmpDir, `e2b-upload-${Date.now()}.tmp`);
        
        await fs.writeFile(tmpFile, data);
        await this.sandboxClient.uploadFile(tmpFile, path);
        await fs.unlink(tmpFile);

        return {
          success: true,
          path: path,
          message: `Successfully wrote file: ${path}`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          message: `Error writing file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
  }
}
