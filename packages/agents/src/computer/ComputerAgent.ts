import { BaseAgent, BaseAgentConfig } from '@monkey-agent/base';
import type { ToolSet } from 'ai';
import { tool } from 'ai';
import { z } from 'zod';

/**
 * Computer Agent 配置
 */
export interface ComputerAgentConfig extends Partial<BaseAgentConfig> {
  /** Computer Use Agent 服务器 WebSocket 地址 */
  computerServerUrl?: string;
}

/**
 * Computer Agent
 * 
 * 核心能力：
 * - 鼠标操作（移动、点击、拖拽、滚轮）
 * - 键盘操作（输入、按键、快捷键）
 * - 屏幕控制（截图、录屏、分辨率）
 * - 窗口管理（聚焦、最小化、关闭）
 * - 剪贴板操作
 * 
 * 执行环境：通过 Computer Use Agent 服务器执行系统级操作
 * 
 * @example
 * ```typescript
 * const computerAgent = new ComputerAgent({
 *   llmConfig: {
 *     provider: 'openai',
 *     apiKey: 'sk-...',
 *     model: 'gpt-4',
 *   },
 *   computerServerUrl: 'ws://localhost:8080',
 * });
 * 
 * await computerAgent.execute({
 *   id: 'task-1',
 *   type: 'control',
 *   description: '打开浏览器并搜索',
 *   parameters: {},
 * });
 * ```
 */
export class ComputerAgent extends BaseAgent {
  private computerServerUrl: string;
  private wsClient?: WebSocket;

  constructor(config?: ComputerAgentConfig) {
    super({
      id: config?.id || 'computer-agent',
      name: config?.name || 'Computer Agent',
      description: config?.description || '系统控制 Agent，负责鼠标键盘操作、屏幕截图和窗口管理',
      capabilities: config?.capabilities || [
        'mouse-move',
        'mouse-click',
        'mouse-drag',
        'mouse-scroll',
        'keyboard-type',
        'keyboard-press',
        'keyboard-hotkey',
        'screenshot',
        'window-focus',
        'window-minimize',
        'window-close',
        'clipboard-read',
        'clipboard-write',
      ],
      llmClient: config?.llmClient,
      llmConfig: config?.llmConfig,
      systemPrompt: config?.systemPrompt,
      maxIterations: config?.maxIterations,
      enableReflection: config?.enableReflection,
      contextCompression: config?.contextCompression,
    });

    this.computerServerUrl = config?.computerServerUrl || 'ws://localhost:8080';
  }

  /**
   * 构建系统提示词
   */
  protected buildSystemPrompt(): string {
    return `You are Computer Agent, an intelligent system automation assistant.

Your capabilities:
- Control mouse (move, click, drag, scroll)
- Control keyboard (type, press keys, hotkeys)
- Take screenshots and analyze screen content
- Manage application windows (focus, minimize, close)
- Access clipboard (read and write)

When controlling the computer:
1. Plan your actions carefully before execution
2. Verify screen state with screenshots when needed
3. Use appropriate delays for UI responsiveness
4. Handle errors gracefully and retry if necessary
5. Provide clear feedback on what you're doing

IMPORTANT: Always consider user privacy and security.
Only perform actions that are explicitly requested or clearly needed for the task.
Always provide clear explanations of what system operations you're performing.`;
  }

  /**
   * 定义系统控制工具
   */
  protected getToolDefinitions(): ToolSet {
    return {
      mouseMove: tool({
        description: 'Move mouse cursor to specified coordinates',
        inputSchema: z.object({
          x: z.number().describe('X coordinate (pixels from left)'),
          y: z.number().describe('Y coordinate (pixels from top)'),
          smooth: z.boolean().optional().describe('Whether to move smoothly (animated)'),
        }),
      }),

      mouseClick: tool({
        description: 'Click mouse button at current position or specified coordinates',
        inputSchema: z.object({
          button: z.enum(['left', 'right', 'middle']).optional().describe('Mouse button (default: left)'),
          x: z.number().optional().describe('X coordinate (if not provided, click at current position)'),
          y: z.number().optional().describe('Y coordinate'),
          doubleClick: z.boolean().optional().describe('Whether to double-click'),
        }),
      }),

      mouseDrag: tool({
        description: 'Drag mouse from one position to another',
        inputSchema: z.object({
          fromX: z.number().describe('Starting X coordinate'),
          fromY: z.number().describe('Starting Y coordinate'),
          toX: z.number().describe('Ending X coordinate'),
          toY: z.number().describe('Ending Y coordinate'),
          button: z.enum(['left', 'right', 'middle']).optional().describe('Mouse button (default: left)'),
        }),
      }),

      mouseScroll: tool({
        description: 'Scroll mouse wheel',
        inputSchema: z.object({
          direction: z.enum(['up', 'down', 'left', 'right']).describe('Scroll direction'),
          amount: z.number().optional().describe('Scroll amount (default: 3)'),
        }),
      }),

      keyboardType: tool({
        description: 'Type text as if typing on keyboard',
        inputSchema: z.object({
          text: z.string().describe('Text to type'),
          delay: z.number().optional().describe('Delay between keystrokes in ms (default: 10)'),
        }),
      }),

      keyboardPress: tool({
        description: 'Press a keyboard key',
        inputSchema: z.object({
          key: z.string().describe('Key name (e.g., "enter", "escape", "tab", "space")'),
          modifiers: z.array(z.enum(['ctrl', 'alt', 'shift', 'meta'])).optional().describe('Modifier keys to hold'),
        }),
      }),

      keyboardHotkey: tool({
        description: 'Execute a keyboard hotkey (shortcut)',
        inputSchema: z.object({
          keys: z.string().describe('Hotkey combination (e.g., "ctrl+c", "cmd+v", "alt+tab")'),
        }),
      }),

      screenshot: tool({
        description: 'Take a screenshot of the screen',
        inputSchema: z.object({
          region: z.object({
            x: z.number(),
            y: z.number(),
            width: z.number(),
            height: z.number(),
          }).optional().describe('Capture specific region (omit for full screen)'),
          format: z.enum(['png', 'jpeg']).optional().describe('Image format (default: png)'),
        }),
      }),

      focusWindow: tool({
        description: 'Focus (bring to front) a window by title or process name',
        inputSchema: z.object({
          identifier: z.string().describe('Window title or process name'),
          exact: z.boolean().optional().describe('Whether to match exactly (default: false)'),
        }),
      }),

      minimizeWindow: tool({
        description: 'Minimize a window',
        inputSchema: z.object({
          identifier: z.string().describe('Window title or process name'),
        }),
      }),

      closeWindow: tool({
        description: 'Close a window',
        inputSchema: z.object({
          identifier: z.string().describe('Window title or process name'),
          force: z.boolean().optional().describe('Force close without confirmation'),
        }),
      }),

      getClipboard: tool({
        description: 'Read text from clipboard',
        inputSchema: z.object({}),
      }),

      setClipboard: tool({
        description: 'Write text to clipboard',
        inputSchema: z.object({
          text: z.string().describe('Text to copy to clipboard'),
        }),
      }),

      getScreenSize: tool({
        description: 'Get screen resolution (width and height)',
        inputSchema: z.object({}),
      }),

      delay: tool({
        description: 'Wait for a specified duration (useful for UI responsiveness)',
        inputSchema: z.object({
          ms: z.number().describe('Milliseconds to wait'),
        }),
      }),
    };
  }

  /**
   * 执行工具调用
   */
  protected async executeToolCall(toolName: string, input: any): Promise<any> {
    // 确保连接到 Computer Use Agent 服务器
    await this.ensureConnection();

    // 构建操作请求
    const request = {
      operation: 'computer',
      action: toolName,
      parameters: input,
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
