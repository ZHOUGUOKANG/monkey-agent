// Workflow 类型定义
export interface Workflow {
  id: string;
  name: string;
  description: string;
  agentGraph: AgentNode[];
  estimatedDuration?: number;
}

export interface AgentNode {
  id: string;
  type: string;
  name: string;
  desc: string;
  steps: AgentNodeStep[];
  dependencies: string[];
}

export interface AgentNodeStep {
  stepNumber: number;
  desc: string;
}

// 消息类型
export interface Message {
  id: string;
  role: 'user' | 'ai' | 'system';  // 新增 system 角色用于显示 Agent 状态
  content: string;
  timestamp: number;
  workflow?: Workflow;
  artifact?: Artifact;
  // 新增：Agent 状态信息
  agentStatus?: {
    phase: 'thinking' | 'tool-call' | 'tool-result' | 'error' | 'compressed' | 'warning' | 'complete' | 'reflection';
    toolName?: string;
    details?: any;
    iteration?: number;
    agentId?: string;
  };
  // 新增：Loading 状态
  isLoading?: boolean;
  toolName?: string;  // 用于匹配和更新状态消息
}

// Artifact 类型（React 组件、HTML 等）
export interface Artifact {
  id: string;
  type: 'react' | 'html' | 'markdown';
  title: string;
  description?: string;
  code: string;
  createdAt: number;
  updatedAt?: number;
}

// 对话历史
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

// Workflow 执行状态
export interface WorkflowExecution {
  workflowId: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  currentAgent?: string;
  progress: number;
  startTime?: number;
  endTime?: number;
}

// 单个工具调用的数据
export interface ToolCallData {
  toolName: string;
  input: any;
  result?: any;
  error?: string;
  timestamp: number;
}

// 单个迭代的数据
export interface IterationData {
  iteration: number;
  thinkingText: string;  // 该迭代的思考文本
  toolCalls: ToolCallData[];
}

// Agent 执行事件
export interface ExecutionEvent {
  type: 
    | 'agent:start' 
    | 'agent:complete' 
    | 'agent:error' 
    | 'agent:thinking' 
    | 'agent:tool-call' 
    | 'agent:tool-result' 
    | 'agent:tool-error'
    | 'agent:compressed'
    | 'agent:stream-text'          // 思考文本流
    | 'agent:stream-finish'        // 流式输出完成
    | 'agent:reflection'           // 反思总结
    | 'agent:context-length-error' // 上下文长度错误
    | 'agent:max-iterations'       // 达到最大迭代次数
    | 'agent:task-complete';       // 任务完成
  nodeId: string;  // workflow 节点 ID（用于匹配 workflow 图）
  agentId?: string;  // 实际 agent ID（如 browser-agent）
  timestamp: number;
  data?: any;
}

// 日志条目
export interface LogEntry {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  source?: string;
}

// WebSocket 消息类型
export interface WSMessage {
  id: string;
  payload: any;
}

// 流式消息 Payload
export interface StreamPayload {
  type: 'text' | 'code' | 'html' | 'status';
  content: string;
  artifactId?: string;  // 用于代码流和 HTML 流
  source?: string;
}

// 连接状态
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

