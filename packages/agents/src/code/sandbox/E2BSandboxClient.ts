import { Sandbox } from '@e2b/code-interpreter';
import type { Execution, Result, ExecutionError, OutputMessage } from '@e2b/code-interpreter';
import {
  BaseSandboxClient,
  CommandResult,
  CodeExecutionResult,
  OutputChunk,
  SandboxInfo,
} from './BaseSandboxClient';

/**
 * E2B Sandbox 客户端实现
 * 使用 E2B Code Interpreter SDK（TypeScript）
 */
export class E2BSandboxClient extends BaseSandboxClient {
  private apiKey: string;
  private _sandbox: Sandbox | null = null;

  constructor(apiKey?: string) {
    super();
    // 只接受显式传入的 apiKey，如果没有则从环境变量获取
    const key = apiKey !== undefined ? apiKey : process.env.E2B_API_KEY;
    if (!key || key.trim() === '') {
      throw new Error(
        'E2B API key is required. Provide it as argument or set E2B_API_KEY environment variable.'
      );
    }
    this.apiKey = key;
  }

  /**
   * 确保 Sandbox 已创建
   */
  private _ensureSandboxCreated(): void {
    if (this._sandbox === null) {
      throw new Error('Sandbox not created. Call create() first.');
    }
  }

  /**
   * 创建新的 E2B Sandbox
   */
  async create(
    template_id: string,
    user_id?: string,
    task_id?: string,
    metadata?: Record<string, string>
  ): Promise<void> {
    // 如果已有 Sandbox，先关闭
    if (this._sandbox !== null) {
      await this.close();
    }

    const sandboxMetadata = this._build_metadata(template_id, user_id, task_id, metadata);

    // 创建 Sandbox
    this._sandbox = await Sandbox.create({
      apiKey: this.apiKey,
      metadata: sandboxMetadata,
      timeoutMs: this.DEFAULT_TIMEOUT,
    });

    this._sandbox_id = this._sandbox.sandboxId;
  }

  /**
   * 连接到现有的 E2B Sandbox
   */
  async connect(sandbox_id: string): Promise<void> {
    if (this._sandbox !== null) {
      await this.close();
    }

    this._sandbox = await Sandbox.connect(sandbox_id, {
      apiKey: this.apiKey,
      timeoutMs: this.DEFAULT_TIMEOUT,
    });

    this._sandbox_id = this._sandbox.sandboxId;
  }

  /**
   * 关闭并清理 E2B Sandbox
   */
  async close(): Promise<void> {
    if (this._sandbox !== null) {
      await this._sandbox.kill();
      this._sandbox = null;
      this._sandbox_id = null;
    }
  }

  /**
   * 上传文件到 Sandbox
   */
  async uploadFile(local_path: string, remote_path: string): Promise<void> {
    this._ensureSandboxCreated();

    // 读取本地文件（Node.js 环境）
    const fs = await import('fs/promises');
    const content = await fs.readFile(local_path);

    // 写入到 Sandbox
    await this._sandbox!.files.write(remote_path, content);
  }

  /**
   * 从 Sandbox 下载文件
   */
  async downloadFile(remote_path: string): Promise<Uint8Array> {
    this._ensureSandboxCreated();

    const content = await this._sandbox!.files.read(remote_path, 'bytes');
    
    // 确保返回 Uint8Array
    if (typeof content === 'string') {
      // 如果返回的是字符串，转换为 Uint8Array
      const encoder = new TextEncoder();
      return encoder.encode(content);
    }
    
    return content;
  }

  /**
   * 列出可用的 E2B Sandbox
   */
  async list(user_id?: string, task_id?: string, template_id?: string): Promise<SandboxInfo[]> {
    // 构建元数据过滤器
    const metadataFilter: Record<string, string> = {};
    if (user_id) metadataFilter.user_id = user_id;
    if (task_id) metadataFilter.task_id = task_id;
    if (template_id) metadataFilter.template_id = template_id;

    // E2B SDK 的 list 方法返回一个 paginator
    const sandboxesPaginator = await Sandbox.list({
      apiKey: this.apiKey,
    });

    // 从 paginator 获取所有 sandbox
    const sandboxes: any[] = [];
    while (sandboxesPaginator.hasNext) {
      const items = await sandboxesPaginator.nextItems();
      sandboxes.push(...items);
    }

    // 过滤和映射结果
    const result: SandboxInfo[] = sandboxes
      .filter((sandbox) => {
        // 如果有过滤条件，检查元数据
        if (Object.keys(metadataFilter).length === 0) return true;
        
        const metadata = sandbox.metadata || {};
        return Object.entries(metadataFilter).every(
          ([key, value]) => metadata[key] === value
        );
      })
      .map((sandbox) => ({
        sandbox_id: sandbox.sandboxId,
        template_id: sandbox.templateId,
        metadata: sandbox.metadata,
        // E2B Sandbox 可能没有这些字段，根据实际 SDK 调整
        state: 'running', // E2B Sandbox 默认为运行状态
      }));

    return result;
  }

  /**
   * 在 Sandbox 中执行命令
   */
  async runCommand(
    command: string,
    stream: boolean = false
  ): Promise<CommandResult | AsyncIterableIterator<OutputChunk>> {
    this._ensureSandboxCreated();

    if (stream) {
      return this._runCommandStream(command);
    } else {
      return this._runCommandSync(command);
    }
  }

  /**
   * 同步执行命令（等待完成）
   */
  private async _runCommandSync(command: string): Promise<CommandResult> {
    try {
      const process = await this._sandbox!.commands.run(command, {
        timeoutMs: this.DEFAULT_TIMEOUT,
      });

      return {
        stdout: process.stdout || '',
        stderr: process.stderr || '',
        exit_code: process.exitCode !== undefined ? process.exitCode : 0,
        error: process.error || undefined,
      };
    } catch (error) {
      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exit_code: -1,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 流式执行命令
   */
  private async *_runCommandStream(command: string): AsyncIterableIterator<OutputChunk> {
    try {
      let hasOutput = false;
      const process = await this._sandbox!.commands.run(command, {
        onStdout: (output) => {
          hasOutput = true;
        },
        onStderr: (output) => {
          hasOutput = true;
        },
        timeoutMs: this.DEFAULT_TIMEOUT,
      });

      // 命令执行完毕后，生成输出 chunks
      if (process.stdout) {
        yield {
          type: 'stdout',
          content: process.stdout,
          timestamp: new Date().toISOString(),
        };
      }

      if (process.stderr) {
        yield {
          type: 'stderr',
          content: process.stderr,
          timestamp: new Date().toISOString(),
        };
      }

      // 返回退出状态
      yield {
        type: 'exit',
        content: '',
        timestamp: new Date().toISOString(),
        exit_code: process.exitCode,
      };
    } catch (error) {
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 在 Sandbox 中执行代码
   */
  async runCode(
    code: string,
    language?: string,
    stream: boolean = false
  ): Promise<CodeExecutionResult | AsyncIterableIterator<OutputChunk>> {
    this._ensureSandboxCreated();

    if (stream) {
      return this._runCodeStream(code, language);
    } else {
      return this._runCodeSync(code, language);
    }
  }

  /**
   * 同步执行代码（等待完成）
   */
  private async _runCodeSync(code: string, language?: string): Promise<CodeExecutionResult> {
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const resultChunks: string[] = [];
    let executionError: ExecutionError | undefined;

    try {
      const execution = await this._sandbox!.runCode(code, {
        language,
        onStdout: (msg: OutputMessage) => {
          stdoutChunks.push(msg.line);
        },
        onStderr: (msg: OutputMessage) => {
          stderrChunks.push(msg.line);
        },
        onResult: (result: Result) => {
          resultChunks.push(result.text || String(result));
        },
        onError: (error: ExecutionError) => {
          executionError = error;
        },
        timeoutMs: this.DEFAULT_TIMEOUT,
      });

      // 收集所有输出 - E2B 的 execution 对象本身也包含输出
      const callbackStdout = stdoutChunks.join('\n');
      const callbackStderr = stderrChunks.join('\n');
      const logsStdout = execution.logs?.stdout?.join('\n') || '';
      const logsStderr = execution.logs?.stderr?.join('\n') || '';
      const resultText = resultChunks.join('\n') || execution.text || '';
      
      // 优先使用回调收集的输出，如果为空则使用 logs
      const stdout = callbackStdout || logsStdout;
      const stderr = callbackStderr || logsStderr;
      
      // 构建结果 - result 字段包含所有输出
      // 优先使用 stdout（print 输出），如果为空则使用 resultText（表达式结果）
      const result: CodeExecutionResult = {
        stdout,
        stderr,
        result: stdout || resultText,
      };

      // 添加错误信息
      if (execution.error || executionError) {
        const error = execution.error || executionError!;
        result.error = {
          name: error.name,
          value: error.value,
          traceback: error.traceback,
        };
      }

      return result;
    } catch (error) {
      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        result: '',
        error: {
          name: 'ExecutionError',
          value: error instanceof Error ? error.message : String(error),
          traceback: '',
        },
      };
    }
  }

  /**
   * 流式执行代码
   */
  private async *_runCodeStream(
    code: string,
    language?: string
  ): AsyncIterableIterator<OutputChunk> {
    const outputChunks: OutputChunk[] = [];

    try {
      await this._sandbox!.runCode(code, {
        language,
        onStdout: (msg: OutputMessage) => {
          outputChunks.push({
            type: 'stdout',
            content: msg.line,
            timestamp: new Date().toISOString(),
          });
        },
        onStderr: (msg: OutputMessage) => {
          outputChunks.push({
            type: 'stderr',
            content: msg.line,
            timestamp: new Date().toISOString(),
          });
        },
        onResult: (result: Result) => {
          outputChunks.push({
            type: 'result',
            content: result.text || String(result),
            timestamp: new Date().toISOString(),
          });
        },
        onError: (error: ExecutionError) => {
          outputChunks.push({
            type: 'error',
            content: `${error.name}: ${error.value}\n${error.traceback}`,
            timestamp: new Date().toISOString(),
            name: error.name,
            value: error.value,
            traceback: error.traceback,
          });
        },
        timeoutMs: this.DEFAULT_TIMEOUT,
      });

      // 返回所有收集的输出
      for (const chunk of outputChunks) {
        yield chunk;
      }
    } catch (error) {
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }
}
