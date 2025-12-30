import { io, Socket } from 'socket.io-client';

type EventCallback = (data: any) => void;

class WebSocketClient {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  connect(url: string = window.location.origin) {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      // 增强稳定性配置
      reconnection: true,              // 启用自动重连
      reconnectionDelay: 1000,         // 首次重连延迟 1s
      reconnectionDelayMax: 5000,      // 最大重连延迟 5s
      reconnectionAttempts: Infinity,  // 无限重试
      timeout: 20000,                  // 连接超时 20s
      upgrade: true,                   // 允许升级传输方式
      // 长连接支持
      forceNew: false,                 // 复用现有连接
      multiplex: true,                 // 多路复用
    });

    this.setupListeners();
  }

  private setupListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.emit('connect');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected, reason:', reason);
      this.emit('disconnect', { reason });
    });
    
    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 WebSocket reconnected after ${attemptNumber} attempts`);
      this.emit('reconnect', { attemptNumber });
    });
    
    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 WebSocket reconnecting... (attempt ${attemptNumber})`);
    });
    
    this.socket.on('reconnect_error', (error) => {
      console.error('❌ WebSocket reconnect error:', error);
    });
    
    this.socket.on('reconnect_failed', () => {
      console.error('❌ WebSocket reconnect failed');
    });

    this.socket.on('stream', (data) => {
      this.emit('stream', data);
    });

    this.socket.on('agent:event', (data) => {
      console.log('🔔 WebSocket received agent:event:', data);
      
      // 分发 tool-input 相关事件
      switch (data.type) {
        case 'agent:tool-input-start':
          this.emit('tool-input-start', data);
          break;
        case 'agent:tool-input-progress':
          this.emit('tool-input-progress', data);
          break;
        case 'agent:tool-input-complete':
          this.emit('tool-input-complete', data);
          break;
      }
      
      this.emit('agent:event', data);
    });

    this.socket.on('response', (data) => {
      this.emit('response', data);
    });

    this.socket.on('workflow:event', (data) => {
      this.emit('workflow:event', data);
    });

    this.socket.on('error', (data) => {
      console.error('WebSocket error:', data);
      this.emit('error', data);
    });
  }

  sendChat(message: string) {
    if (!this.socket?.connected) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.emit('chat', {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      payload: { message },
    });
  }

  executeWorkflow(workflow: any, options?: {
    /** 单个Agent执行超时时间(毫秒)，默认5分钟 */
    agentTimeout?: number;
    /** 整体工作流超时时间(毫秒) */
    timeout?: number;
    /** 失败时是否继续 */
    continueOnError?: boolean;
    /** 最大重试次数 */
    maxRetries?: number;
  }) {
    if (!this.socket?.connected) {
      console.error('WebSocket not connected');
      return;
    }

    // 设置合理的默认超时
    const executionOptions = {
      agentTimeout: 10 * 60 * 1000,  // 默认 10 分钟
      timeout: 30 * 60 * 1000,       // 默认 30 分钟
      continueOnError: false,
      maxRetries: 1,
      ...options  // 允许覆盖
    };

    this.socket.emit('execute-workflow', {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      payload: { 
        workflow,
        options: executionOptions
      },
    });
  }

  requestFallback(artifactId: string, error: string) {
    if (!this.socket?.connected) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.emit('request-fallback', {
      id: `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      payload: { artifactId, error },
    });
  }

  on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback) {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data?: any) {
    this.listeners.get(event)?.forEach((callback) => callback(data));
  }

  disconnect() {
    this.socket?.disconnect();
    this.listeners.clear();
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const wsClient = new WebSocketClient();

