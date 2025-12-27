/**
 * WebSocket 消息 DTO
 */

export interface ClientMessage {
  id: string;
  type: 'chat' | 'execute-workflow' | 'get-agents';
  payload: any;
}

export interface ServerMessage {
  id: string;
  type: 'response' | 'stream' | 'event' | 'error';
  payload: any;
}

/**
 * Chat 消息
 */
export interface ChatPayload {
  message: string;
  conversationId?: string;
  context?: any;
}

/**
 * Workflow 执行消息
 */
export interface WorkflowPayload {
  workflow: any;
  options?: any;
}

