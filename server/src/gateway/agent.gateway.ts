import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { AgentAdapter } from '../adapters/agent.adapter';
import { WorkflowEventLogger } from '../common/WorkflowEventLogger';
import type { ClientMessage, ChatPayload, WorkflowPayload } from './dto/message.dto';

/**
 * Agent Gateway
 * 
 * 职责：
 * - 接收客户端 WebSocket 消息
 * - 路由到对应的 Adapter
 * - 返回响应
 * 
 * ❌ 不包含业务逻辑
 */
@WebSocketGateway({ 
  cors: {
    origin: '*', // 开发环境，生产环境需要配置
  },
  // WebSocket 稳定性配置
  pingTimeout: 120000,       // 2 分钟无响应才断开（默认 60s）
  pingInterval: 25000,       // 每 25 秒发送 ping（默认 25s）
  maxHttpBufferSize: 1e8,    // 100MB 缓冲区（默认 1MB）
  connectTimeout: 45000,     // 连接超时 45s
  transports: ['websocket', 'polling'],  // 支持两种传输方式
})
export class AgentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AgentGateway.name);
  private readonly workflowLoggers = new Map<string, WorkflowEventLogger>();
  private readonly loggingEnabled = process.env.ENABLE_WORKFLOW_LOGGING === 'true';
  
  // 跟踪每个聊天会话的代码流状态
  private codeStreamStates = new Map<string, {
    isFirstChunk: boolean;
    accumulatedCode: string;
  }>();
  
  // Stream-text 批量缓冲器 - 减少网络请求
  private streamBuffers = new Map<string, {
    chunks: string[];
    timer: NodeJS.Timeout | null;
    lastFlush: number;
  }>();
  
  // 事件节流器 - 针对高频事件进行节流
  private eventThrottlers = new Map<string, {
    lastSent: number;
    pending: any;
    timer: NodeJS.Timeout | null;
  }>();
  
  // 高频事件类型列表
  private readonly HIGH_FREQUENCY_EVENTS = new Set([
    'agent:stream-text',
    'agent:tool-input-progress',
    'agent:thinking'
  ]);

  constructor(private readonly agentAdapter: AgentAdapter) {
    // 在构造函数中记录日志配置状态
    if (this.loggingEnabled) {
      this.logger.log('📝 Workflow logging is ENABLED');
    }
  }
  
  /**
   * 批量发送 stream-text 事件 - 减少网络请求
   * @param client Socket 客户端
   * @param id 请求 ID
   * @param chunk 文本片段
   * @param flushInterval 刷新间隔（毫秒），默认 50ms
   */
  private bufferStreamText(
    client: Socket,
    id: string,
    chunk: string,
    flushInterval = 50
  ) {
    const key = `${client.id}-${id}`;
    const buffer = this.streamBuffers.get(key) || {
      chunks: [],
      timer: null,
      lastFlush: Date.now()
    };
    
    buffer.chunks.push(chunk);
    
    // 如果有待发送的定时器，清除它
    if (buffer.timer) {
      clearTimeout(buffer.timer);
    }
    
    // 检查是否需要立即刷新
    const now = Date.now();
    const shouldFlushNow = 
      buffer.chunks.length >= 10 ||  // 累积 10 个 chunk
      (now - buffer.lastFlush) >= 200;  // 或超过 200ms
    
    if (shouldFlushNow) {
      // 立即发送
      const merged = buffer.chunks.join('');
      client.emit('stream', {
        id,
        payload: { 
          type: 'text',
          content: merged
        }
      });
      buffer.chunks = [];
      buffer.lastFlush = now;
      this.streamBuffers.set(key, buffer);
    } else {
      // 延迟发送
      buffer.timer = setTimeout(() => {
        if (buffer.chunks.length > 0) {
          const merged = buffer.chunks.join('');
          client.emit('stream', {
            id,
            payload: { 
              type: 'text',
              content: merged
            }
          });
          buffer.chunks = [];
          buffer.lastFlush = Date.now();
        }
        this.streamBuffers.delete(key);
      }, flushInterval);
      
      this.streamBuffers.set(key, buffer);
    }
  }
  
  /**
   * 强制刷新指定 stream 的缓冲区
   */
  private flushStreamBuffer(client: Socket, id: string) {
    const key = `${client.id}-${id}`;
    const buffer = this.streamBuffers.get(key);
    
    if (buffer) {
      if (buffer.timer) {
        clearTimeout(buffer.timer);
      }
      
      if (buffer.chunks.length > 0) {
        const merged = buffer.chunks.join('');
        client.emit('stream', {
          id,
          payload: { 
            type: 'text',
            content: merged
          }
        });
      }
      
      this.streamBuffers.delete(key);
    }
  }
  
  /**
   * 节流事件发送 - 针对高频事件
   * @param client Socket 客户端
   * @param eventType 事件类型
   * @param event 事件数据
   * @param id 请求 ID
   * @param interval 节流间隔（毫秒）
   */
  private throttleEvent(
    client: Socket, 
    eventType: string, 
    event: any, 
    id: string,
    interval = 100
  ) {
    const key = `${client.id}-${eventType}-${id}`;
    const throttler = this.eventThrottlers.get(key) || {
      lastSent: 0,
      pending: null,
      timer: null
    };
    
    const now = Date.now();
    throttler.pending = event;
    
    if (now - throttler.lastSent >= interval) {
      // 立即发送
      client.emit('workflow:event', { id, event });
      throttler.lastSent = now;
      throttler.pending = null;
    } else if (!throttler.timer) {
      // 设置延迟发送
      throttler.timer = setTimeout(() => {
        if (throttler.pending) {
          client.emit('workflow:event', { id, event: throttler.pending });
          throttler.lastSent = Date.now();
          throttler.pending = null;
        }
        throttler.timer = null;
        this.eventThrottlers.delete(key); // 清理
      }, interval - (now - throttler.lastSent));
    }
    
    this.eventThrottlers.set(key, throttler);
  }
  
  /**
   * 清理客户端的所有节流器和缓冲区
   */
  private clearThrottlersForClient(clientId: string) {
    // 清理节流器
    const keysToDelete: string[] = [];
    this.eventThrottlers.forEach((_, key) => {
      if (key.startsWith(clientId)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => {
      const throttler = this.eventThrottlers.get(key);
      if (throttler?.timer) {
        clearTimeout(throttler.timer);
      }
      this.eventThrottlers.delete(key);
    });
    
    // 清理 stream buffers
    const bufferKeysToDelete: string[] = [];
    this.streamBuffers.forEach((_, key) => {
      if (key.startsWith(clientId)) {
        bufferKeysToDelete.push(key);
      }
    });
    bufferKeysToDelete.forEach(key => {
      const buffer = this.streamBuffers.get(key);
      if (buffer?.timer) {
        clearTimeout(buffer.timer);
      }
      this.streamBuffers.delete(key);
    });
  }
  
  /**
   * 清理流式代码中的 markdown 标记
   */
  private cleanStreamedCode(chunk: string, isFirstChunk: boolean): string {
    let cleaned = chunk;
    
    // 第一个 chunk 可能包含开头的 markdown 标记
    if (isFirstChunk) {
      // 移除开头的 ```javascript 或 ```jsx 或 ```
      cleaned = cleaned.replace(/^```(?:javascript|jsx|js|react|typescript|tsx)?\s*\n?/i, '');
    }
    
    // 移除结尾的 ```
    cleaned = cleaned.replace(/\n?```\s*$/g, '');
    
    return cleaned;
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('connected', { clientId: client.id });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // 清理该客户端的所有节流器
    this.clearThrottlersForClient(client.id);
  }

  /**
   * 处理聊天消息（支持流式输出）
   */
  @SubscribeMessage('chat')
  async handleChat(
    @MessageBody() data: { id: string; payload: ChatPayload },
    @ConnectedSocket() client: Socket,
  ) {
    const { id, payload } = data;
    
    this.logger.log(`Chat request: ${id}`);
    
    try {
      // 初始化代码流状态
      if (!this.codeStreamStates.has(id)) {
        this.codeStreamStates.set(id, {
          isFirstChunk: true,
          accumulatedCode: ''
        });
      }
      const streamState = this.codeStreamStates.get(id)!;
      
      // 调用 AgentAdapter 的流式版本
      const result = await this.agentAdapter.chatWithStreaming(payload, {
        // 流式文本回调 - 使用批量发送
        onStreamChunk: (chunk: string) => {
          // 判断是否为代码（简单判断：包含 'import React' 的视为代码）
          const isCode = chunk.includes('import React') || chunk.includes('<!DOCTYPE html') || streamState.accumulatedCode.includes('import React');
          const type = chunk.includes('<!DOCTYPE html') || streamState.accumulatedCode.includes('<!DOCTYPE html') ? 'html' : (isCode ? 'code' : 'text');
          
          // 清理代码中的 markdown 标记
          let cleanedChunk = chunk;
          if (type === 'code' || type === 'html') {
            cleanedChunk = this.cleanStreamedCode(chunk, streamState.isFirstChunk);
            streamState.isFirstChunk = false;
            streamState.accumulatedCode += cleanedChunk;
            
            // 代码类型直接发送（不批量），保持实时性
            client.emit('stream', {
              id,
              payload: { 
                type,
                content: cleanedChunk,
                artifactId: type === 'code' || type === 'html' ? 'streaming-artifact' : undefined
              }
            });
          } else {
            // 文本类型使用批量发送
            this.bufferStreamText(client, id, cleanedChunk);
          }
        },
        // Agent 事件回调 - 转发所有重要事件
        onEvent: (event: any) => {
          // 转发所有 agent 事件，让前端可以显示进度
          this.logger.debug(`Forwarding agent event: ${event.type || event.agentId}`);
          client.emit('agent:event', { id, event });
          
          // 额外发送人类可读的状态更新
          if (event.type === 'agent:thinking') {
            client.emit('stream', {
              id,
              payload: { 
                type: 'status', 
                content: '🤔 AI 正在思考...',
                source: 'system'
              }
            });
          } else if (event.type === 'agent:tool-call') {
            const toolName = event.toolName || '工具';
            
            // 特殊处理意图识别和工作流生成工具
            let statusMessage = `🔧 调用工具: ${toolName}`;
            if (toolName === 'recognizeIntent') {
              statusMessage = '🎯 正在识别任务意图...';
            } else if (toolName === 'generateWorkflow') {
              statusMessage = '⚙️ 正在生成工作流...';
            }
            
            client.emit('stream', {
              id,
              payload: { 
                type: 'status', 
                content: statusMessage,
                source: 'system',
                loading: true,
                toolName: toolName
              }
            });
          } else if (event.type === 'agent:tool-result') {
            const toolName = event.toolName || '工具';
            
            // 特殊处理意图识别和工作流生成工具的结果
            let statusMessage = `✅ 工具执行完成`;
            if (toolName === 'recognizeIntent') {
              // 尝试从结果中提取意图类型
              const intentType = event.result?.intent?.type || event.result?.type;
              if (intentType) {
                const intentMap: Record<string, string> = {
                  'simple-query': '✅ 意图识别: 简单对话',
                  'task-execution': '✅ 意图识别: 任务执行 - 需要生成工作流',
                  'report-generation': '✅ 意图识别: 报告生成',
                  'data-analysis': '✅ 意图识别: 数据分析',
                };
                statusMessage = intentMap[intentType] || `✅ 意图识别完成: ${intentType}`;
              } else {
                statusMessage = '✅ 意图识别完成';
              }
            } else if (toolName === 'generateWorkflow') {
              statusMessage = '✅ 工作流生成完成';
            }
            
            client.emit('stream', {
              id,
              payload: { 
                type: 'status', 
                content: statusMessage,
                source: 'system',
                loading: false,
                toolName: toolName
              }
            });
          } else if (event.type === 'agent:tool-error') {
            client.emit('stream', {
              id,
              payload: { 
                type: 'status', 
                content: `❌ 工具执行失败`,
                source: 'system',
                loading: false
              }
            });
          }
        }
      });
      
      // 🔍 调试日志：打印完整结果
      this.logger.debug(`Chat result type: ${result.type}`);
      this.logger.debug(`Chat result data: ${JSON.stringify(result, null, 2)}`);
      
      // 判断结果类型
      if (result.type === 'workflow') {
        // 复杂任务 → 返回 Workflow 给 UI，等待用户手动点击运行
        this.logger.log(`Workflow generated for chat ${id}`);
        this.logger.debug(`Workflow details: ${JSON.stringify(result.workflow, null, 2)}`);
        
        // 验证 agentGraph 是数组
        if (!Array.isArray(result.workflow?.agentGraph)) {
          this.logger.error(`Invalid workflow structure: agentGraph is not an array`, {
            workflow: result.workflow,
            agentGraphType: typeof result.workflow?.agentGraph
          });
        }
        
        // 刷新缓冲区，确保所有文本都已发送
        this.flushStreamBuffer(client, id);
        
        const responsePayload = { 
          id, 
          payload: {
            type: 'workflow',
            workflow: result.workflow,
            done: true
          }
        };
        
        this.logger.debug(`Emitting response to client: ${JSON.stringify(responsePayload, null, 2)}`);
        client.emit('response', responsePayload);
        this.logger.log(`✅ Response emitted to client ${client.id}`);
      } else if (result.type === 'artifact') {
        // Artifact (报告/可视化) → 返回 artifact 给 UI
        this.logger.log(`Artifact generated for chat ${id}`);
        this.logger.debug(`Artifact details: ${JSON.stringify(result.artifact, null, 2)}`);
        
        // 刷新缓冲区
        this.flushStreamBuffer(client, id);
        
        client.emit('response', { 
          id, 
          payload: {
            type: 'artifact',
            artifact: result.artifact,
            done: true
          }
        });
        this.logger.log(`✅ Artifact emitted to client ${client.id}`);
      } else if (result.type === 'text') {
        // 简单对话 → 最后发送 done 信号
        this.logger.log(`Text response for chat ${id} completed`);
        
        // 刷新缓冲区
        this.flushStreamBuffer(client, id);
        
        client.emit('response', { id, payload: { done: true } });
      } else {
        // 未知类型，记录日志
        this.logger.warn(`Unknown result type from chat: ${JSON.stringify(result)}`);
        
        // 刷新缓冲区
        this.flushStreamBuffer(client, id);
        
        client.emit('response', { id, payload: { done: true } });
      }
      
      // 清理代码流状态和缓冲区
      this.codeStreamStates.delete(id);
    } catch (error: any) {
      this.logger.error(`Chat error: ${error.message}`);
      
      // 刷新缓冲区
      this.flushStreamBuffer(client, id);
      
      client.emit('error', { id, payload: { error: error.message } });
      // 清理代码流状态和缓冲区
      this.codeStreamStates.delete(id);
    }
  }

  /**
   * 处理工作流执行
   */
  @SubscribeMessage('execute-workflow')
  async handleWorkflow(
    @MessageBody() data: { id: string; payload: WorkflowPayload },
    @ConnectedSocket() client: Socket,
  ) {
    const { id, payload } = data;
    
    this.logger.log(`Workflow execution request: ${id}`);
    
    // 如果启用日志，创建 logger
    let workflowLogger: WorkflowEventLogger | null = null;
    if (this.loggingEnabled) {
      workflowLogger = new WorkflowEventLogger(payload.workflow.id);
      this.workflowLoggers.set(payload.workflow.id, workflowLogger);
      workflowLogger.log('workflow:start', { 
        workflow: payload.workflow,
        executionId: id,
        clientId: client.id
      });
    }
    
    try {
      const orchestrator = this.agentAdapter.getOrchestrator();
      
      // 监听并转发 Orchestrator 事件
      const eventHandlers = {
        'agent:start': (event: any) => {
          this.logger.debug(`Agent started: ${event.agentId}`);
          const { type, ...eventData } = event;  // 移除原有的 type，避免冲突
          client.emit('workflow:event', { 
            id, 
            event: { type: 'agent:start', ...eventData } 
          });
          workflowLogger?.log('agent:start', event);
        },
        'agent:complete': (event: any) => {
          this.logger.debug(`Agent completed: ${event.agentId}`);
          const { type, ...eventData } = event;  // 移除原有的 type，避免冲突
          client.emit('workflow:event', { 
            id, 
            event: { type: 'agent:complete', ...eventData } 
          });
          workflowLogger?.log('agent:complete', event);
        },
        'agent:error': (event: any) => {
          this.logger.warn(`Agent error: ${event.agentId}`);
          const { type, ...eventData } = event;  // 移除原有的 type，避免冲突
          client.emit('workflow:event', { 
            id, 
            event: { type: 'agent:error', ...eventData } 
          });
          workflowLogger?.log('agent:error', event);
        },
        // 新增：转发 agent 的详细执行事件
        'agent:thinking': (event: any) => {
          this.logger.debug(`Agent thinking: ${event.agentId}`);
          const { type, ...eventData } = event;
          client.emit('workflow:event', { 
            id, 
            event: { type: 'agent:thinking', ...eventData } 
          });
          workflowLogger?.log('agent:thinking', event);
        },
        'agent:tool-call': (event: any) => {
          this.logger.debug(`Agent tool call: ${event.toolName}`);
          const { type, ...eventData } = event;
          client.emit('workflow:event', { 
            id, 
            event: { type: 'agent:tool-call', ...eventData } 
          });
          workflowLogger?.log('agent:tool-call', event);
        },
        'agent:tool-result': (event: any) => {
          this.logger.debug(`Agent tool result: ${event.toolName}`);
          const { type, ...eventData } = event;
          client.emit('workflow:event', { 
            id, 
            event: { type: 'agent:tool-result', ...eventData } 
          });
          workflowLogger?.log('agent:tool-result', event);
        },
        'agent:tool-error': (event: any) => {
          this.logger.debug(`Agent tool error: ${event.toolName}`);
          const { type, ...eventData } = event;
          client.emit('workflow:event', { 
            id, 
            event: { type: 'agent:tool-error', ...eventData } 
          });
          workflowLogger?.log('agent:tool-error', event);
        },
        'agent:compressed': (event: any) => {
          this.logger.debug(`Agent compressed: ${event.agentId}`);
          const { type, ...eventData } = event;
          client.emit('workflow:event', { 
            id, 
            event: { type: 'agent:compressed', ...eventData } 
          });
          workflowLogger?.log('agent:compressed', event);
        },
        'agent:warning': (event: any) => {
          this.logger.warn(`Agent warning: ${event.message}`);
          const { type, ...eventData } = event;
          client.emit('workflow:event', { 
            id, 
            event: { type: 'agent:warning', ...eventData } 
          });
          workflowLogger?.log('agent:warning', event);
        },
        // 转发思考文本流式事件 - 使用节流
        'agent:stream-text': (event: any) => {
          const textPreview = event.textDelta?.substring(0, 50) || '';
          this.logger.debug(`Agent stream text: ${textPreview}${textPreview.length >= 50 ? '...' : ''}`);
          const { type, ...eventData } = event;
          
          // 使用节流机制，每 100ms 最多发送一次
          this.throttleEvent(client, 'agent:stream-text', { type: 'agent:stream-text', ...eventData }, id, 100);
          
          workflowLogger?.log('agent:stream-text', event);
        },
        'agent:stream-finish': (event: any) => {
          this.logger.debug(`Agent stream finish: ${event.agentId}`);
          const { type, ...eventData } = event;
          client.emit('workflow:event', { 
            id, 
            event: { type: 'agent:stream-finish', ...eventData } 
          });
          workflowLogger?.log('agent:stream-finish', event);
        },
        'agent:reflection': (event: any) => {
          this.logger.debug(`Agent reflection: ${event.agentId}`);
          const { type, ...eventData } = event;
          client.emit('workflow:event', { 
            id, 
            event: { type: 'agent:reflection', ...eventData } 
          });
          workflowLogger?.log('agent:reflection', event);
        },
        'agent:context-length-error': (event: any) => {
          this.logger.warn(`Agent context length error: ${event.agentId}`);
          const { type, ...eventData } = event;
          client.emit('workflow:event', { 
            id, 
            event: { type: 'agent:context-length-error', ...eventData } 
          });
          workflowLogger?.log('agent:context-length-error', event);
        },
        'agent:max-iterations': (event: any) => {
          this.logger.warn(`Agent max iterations: ${event.agentId}`);
          const { type, ...eventData } = event;
          client.emit('workflow:event', { 
            id, 
            event: { type: 'agent:max-iterations', ...eventData } 
          });
          workflowLogger?.log('agent:max-iterations', event);
        },
        'agent:task-complete': (event: any) => {
          this.logger.debug(`Agent task complete: ${event.agentId}`);
          const { type, ...eventData } = event;
          client.emit('workflow:event', { 
            id, 
            event: { type: 'agent:task-complete', ...eventData } 
          });
          workflowLogger?.log('agent:task-complete', event);
        },
        // 新增：转发 tool-input 事件（流式显示 LLM 生成参数的过程）
        'agent:tool-input-start': (event: any) => {
          this.logger.debug(`Agent tool input start: ${event.toolName}`);
          const { type, ...eventData } = event;
          client.emit('workflow:event', { 
            id, 
            event: { type: 'agent:tool-input-start', ...eventData } 
          });
          workflowLogger?.log('agent:tool-input-start', event);
        },
        'agent:tool-input-progress': (event: any) => {
          // 流式发送进度更新（高频事件，使用节流机制）
          const { type, ...eventData } = event;
          
          // 使用节流机制，每 150ms 最多发送一次
          this.throttleEvent(client, 'agent:tool-input-progress', { type: 'agent:tool-input-progress', ...eventData }, id, 150);
          
          // 不记录到文件日志（太频繁）
        },
        'agent:tool-input-complete': (event: any) => {
          this.logger.debug(`Agent tool input complete: ${event.toolName}, ${event.charCount} chars in ${event.duration}ms`);
          const { type, ...eventData } = event;
          client.emit('workflow:event', { 
            id, 
            event: { type: 'agent:tool-input-complete', ...eventData } 
          });
          workflowLogger?.log('agent:tool-input-complete', event);
        },
      };
      
      // 注册事件监听器
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        orchestrator.on(event, handler);
      });
      
      // 执行 Workflow
      const result = await this.agentAdapter.executeWorkflow(payload.workflow, payload.options);
      
      // 清理事件监听器
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        orchestrator.off(event, handler);
      });
      
      // 记录 workflow 完成
      workflowLogger?.log('workflow:complete', { 
        workflowId: payload.workflow.id,
        status: result.status,
        duration: result.duration,
        successCount: result.successCount,
        failureCount: result.failureCount
      });
      
      this.logger.log(`Workflow ${payload.workflow.id} completed: ${result.status}`);
      
      // 确保始终返回 response（即使有部分错误）
      if (!result.status) {
        this.logger.warn('Workflow result missing status, defaulting to "completed"');
        result.status = 'completed';
      }
      
      client.emit('response', { id, payload: result });
      
      // 关闭日志记录器
      if (workflowLogger) {
        await workflowLogger.close();
        this.workflowLoggers.delete(payload.workflow.id);
      }
    } catch (error: any) {
      this.logger.error(`Workflow error: ${error.message}`);
      
      // 记录错误
      workflowLogger?.log('workflow:error', {
        error: error.message,
        stack: error.stack
      });
      
      client.emit('error', { id, payload: { error: error.message } });
      
      // 关闭日志记录器
      if (workflowLogger) {
        await workflowLogger.close();
        this.workflowLoggers.delete(payload.workflow.id);
      }
    }
  }

  /**
   * 获取可用的 Agents
   */
  @SubscribeMessage('get-agents')
  async handleGetAgents(
    @MessageBody() data: { id: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { id } = data;
    
    try {
      // 调用 AgentAdapter
      const agents = this.agentAdapter.getAvailableAgents();
      
      client.emit('response', { id, payload: { agents } });
    } catch (error: any) {
      this.logger.error(`Get agents error: ${error.message}`);
      client.emit('error', { id, error: error.message });
    }
  }

  /**
   * 处理降级请求（React 编译失败时生成 HTML）
   */
  @SubscribeMessage('request-fallback')
  async handleFallbackRequest(
    @MessageBody() data: { id: string; payload: { artifactId: string; error: string } },
    @ConnectedSocket() client: Socket,
  ) {
    const { id, payload } = data;
    
    this.logger.log(`Fallback request for artifact: ${payload.artifactId}`);
    this.logger.log(`Error: ${payload.error}`);
    
    try {
      // 调用 AgentAdapter 重新生成 HTML 版本
      const htmlResult = await this.agentAdapter.generateHtmlFallback(
        payload.artifactId,
        payload.error,
        {
          onStreamChunk: (chunk: string) => {
            // HTML 代码直接发送（不批量），保持实时性
            client.emit('stream', {
              id,
              payload: { 
                type: 'html',
                content: chunk,
                artifactId: payload.artifactId
              }
            });
          }
        }
      );
      
      // 刷新缓冲区（虽然 HTML 不批量，但以防万一）
      this.flushStreamBuffer(client, id);
      
      // 发送最终的 HTML artifact
      client.emit('response', {
        id,
        payload: {
          type: 'artifact',
          artifact: {
            ...htmlResult.artifact,
            type: 'html',  // 标记为 HTML 类型
          },
          done: true
        }
      });
      
      this.logger.log(`HTML fallback generated successfully for artifact: ${payload.artifactId}`);
      
    } catch (error: any) {
      this.logger.error(`Fallback generation error: ${error.message}`);
      client.emit('error', { id, payload: { error: error.message } });
    }
  }
}

