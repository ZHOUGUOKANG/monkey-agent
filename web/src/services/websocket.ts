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
    });

    this.setupListeners();
  }

  private setupListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.emit('connect');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      this.emit('disconnect');
    });

    this.socket.on('stream', (data) => {
      this.emit('stream', data);
    });

    this.socket.on('agent:event', (data) => {
      console.log('🔔 WebSocket received agent:event:', data);
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

  executeWorkflow(workflow: any) {
    if (!this.socket?.connected) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.emit('execute-workflow', {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      payload: { workflow },
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

