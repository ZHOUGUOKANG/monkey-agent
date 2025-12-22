/**
 * 基础 Sandbox 客户端接口
 * 定义了所有 Sandbox 客户端必须实现的通用操作
 */

/**
 * Sandbox 元数据
 */
export interface SandboxMetadata {
  sandbox_id?: string;
  template_id?: string;
  user_id?: string;
  task_id?: string;
  [key: string]: any;
}

/**
 * Sandbox 信息
 */
export interface SandboxInfo {
  sandbox_id: string;
  template_id?: string;
  name?: string;
  metadata?: Record<string, any>;
  state?: string;
  cpu_count?: number;
  memory_mb?: number;
  started_at?: string;
  end_at?: string;
}

/**
 * 命令执行结果
 */
export interface CommandResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  error?: string;
}

/**
 * 代码执行结果
 */
export interface CodeExecutionResult {
  stdout: string;
  stderr: string;
  result: string;
  error?: {
    name: string;
    value: string;
    traceback: string;
  };
}

/**
 * 输出块（流式输出）
 */
export interface OutputChunk {
  type: 'stdout' | 'stderr' | 'result' | 'error' | 'exit';
  content: string;
  timestamp: string;
  exit_code?: number;
  name?: string;
  value?: string;
  traceback?: string;
}

/**
 * 基础 Sandbox 客户端抽象类
 */
export abstract class BaseSandboxClient {
  protected _sandbox_id: string | null = null;
  protected readonly DEFAULT_TIMEOUT = 60_000; // 60 seconds

  /**
   * 获取当前 Sandbox ID
   */
  get sandboxId(): string | null {
    return this._sandbox_id;
  }

  /**
   * 创建新的 Sandbox
   * 
   * @param template_id - Sandbox 模板 ID
   * @param user_id - 可选的用户标识符
   * @param task_id - 可选的任务标识符
   * @param metadata - 可选的额外元数据
   */
  abstract create(
    template_id: string,
    user_id?: string,
    task_id?: string,
    metadata?: Record<string, string>
  ): Promise<void>;

  /**
   * 连接到现有的 Sandbox
   * 
   * @param sandbox_id - 要连接的 Sandbox ID
   */
  abstract connect(sandbox_id: string): Promise<void>;

  /**
   * 关闭并清理 Sandbox
   */
  abstract close(): Promise<void>;

  /**
   * 上传文件到 Sandbox
   * 
   * @param local_path - 本地文件路径
   * @param remote_path - Sandbox 中的目标路径
   */
  abstract uploadFile(local_path: string, remote_path: string): Promise<void>;

  /**
   * 从 Sandbox 下载文件
   * 
   * @param remote_path - Sandbox 中的文件路径
   * @returns 文件内容（字节）
   */
  abstract downloadFile(remote_path: string): Promise<Uint8Array>;

  /**
   * 列出可用的 Sandbox
   * 
   * @param user_id - 可选的用户 ID 过滤
   * @param task_id - 可选的任务 ID 过滤
   * @param template_id - 可选的模板 ID 过滤
   * @returns Sandbox 信息列表
   */
  abstract list(
    user_id?: string,
    task_id?: string,
    template_id?: string
  ): Promise<SandboxInfo[]>;

  /**
   * 在 Sandbox 中执行命令
   * 
   * @param command - 要执行的命令
   * @param stream - 是否流式返回输出
   * @returns 命令结果或输出流
   */
  abstract runCommand(
    command: string,
    stream?: boolean
  ): Promise<CommandResult | AsyncIterableIterator<OutputChunk>>;

  /**
   * 在 Sandbox 中执行代码
   * 
   * @param code - 要执行的代码
   * @param language - 可选的语言标识符
   * @param stream - 是否流式返回输出
   * @returns 执行结果或输出流
   */
  abstract runCode(
    code: string,
    language?: string,
    stream?: boolean
  ): Promise<CodeExecutionResult | AsyncIterableIterator<OutputChunk>>;

  /**
   * 构建 Sandbox 元数据
   * 
   * @param template_id - 模板 ID
   * @param user_id - 用户 ID
   * @param task_id - 任务 ID
   * @param metadata - 额外元数据
   * @returns 合并后的元数据对象
   */
  protected _build_metadata(
    template_id: string,
    user_id?: string,
    task_id?: string,
    metadata?: Record<string, string>
  ): Record<string, string> {
    const result: Record<string, string> = {
      template_id,
    };

    if (user_id) {
      result.user_id = user_id;
    }
    if (task_id) {
      result.task_id = task_id;
    }
    if (metadata) {
      Object.assign(result, metadata);
    }

    return result;
  }

  /**
   * 格式化输出块为 JSON 字符串
   * 
   * @param type - 输出类型
   * @param content - 输出内容
   * @param extras - 额外字段
   * @returns JSON 格式的输出块
   */
  protected _format_chunk(
    type: OutputChunk['type'],
    content: string,
    extras?: Partial<OutputChunk>
  ): string {
    const chunk: OutputChunk = {
      type,
      content,
      timestamp: new Date().toISOString(),
      ...extras,
    };
    return JSON.stringify(chunk);
  }

  /**
   * 格式化最终结果为 JSON 字符串
   * 
   * @param data - 结果数据
   * @returns JSON 格式的结果
   */
  protected _format_result(data: any): string {
    return JSON.stringify(data, null, 2);
  }
}
