import { create } from 'zustand';
import type { Message, Workflow, ExecutionEvent, IterationData } from '../types';
import type { ToolInputProgress } from '../types/toolInput';

interface WorkflowExecutionState {
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  currentAgent?: string;
  events: ExecutionEvent[];
  completedAgents: string[];
  failedAgents: string[];
  startTime: number;
  iterations: Record<string, IterationData[]>;  // 按 agent 和迭代组织数据 (nodeId -> iterations)
}

interface ChatEvent {
  id: string;
  type: string;
  timestamp: number;
  source: string; // 'user' | 'ai' | 'workflow' | 'agent' | 'system'
  data?: any;
  message?: string;
  count?: number;  // 新增：用于合并相同类型事件的计数
  lastUpdate?: number;  // 新增：最后更新时间
}

interface ChatStore {
  messages: Message[];
  isProcessing: boolean;
  currentWorkflow: Workflow | null;
  workflowExecution: WorkflowExecutionState | null;
  chatEvents: ChatEvent[]; // 新增：所有聊天相关事件
  toolInputs: Map<string, ToolInputProgress>; // 新增：工具参数接收进度
  addMessage: (message: Message) => void;
  updateLastMessage: (content: string) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void; // 新增
  appendToLastMessage: (chunk: string) => void;
  setProcessing: (isProcessing: boolean) => void;
  setWorkflow: (workflow: Workflow | null) => void;
  clearMessages: () => void;
  startWorkflowExecution: (workflowId: string) => void;
  addExecutionEvent: (event: ExecutionEvent) => void;
  completeWorkflowExecution: (status: 'completed' | 'failed') => void;
  addChatEvent: (event: Omit<ChatEvent, 'id' | 'timestamp'>) => void; // 新增
  // 新增：工具参数进度管理
  setToolInputStart: (id: string, toolName: string) => void;
  updateToolInputProgress: (id: string, charCount: number, delta: string) => void;
  setToolInputComplete: (id: string, duration: number) => void;
  clearToolInput: (id: string) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isProcessing: false,
  currentWorkflow: null,
  workflowExecution: null,
  chatEvents: [],
  toolInputs: new Map(),
  
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  
  updateLastMessage: (content) =>
    set((state) => {
      if (state.messages.length === 0) return state;
      const messages = [...state.messages];
      messages[messages.length - 1] = {
        ...messages[messages.length - 1],
        content,
      };
      return { messages };
    }),
  
  updateMessage: (id, updates) =>
    set((state) => {
      const messageIndex = state.messages.findIndex(m => m.id === id);
      if (messageIndex === -1) return state;
      
      const messages = [...state.messages];
      messages[messageIndex] = {
        ...messages[messageIndex],
        ...updates,
      };
      return { messages };
    }),
  
  appendToLastMessage: (chunk) =>
    set((state) => {
      if (state.messages.length === 0) return state;
      const messages = [...state.messages];
      const lastMessage = messages[messages.length - 1];
      messages[messages.length - 1] = {
        ...lastMessage,
        content: lastMessage.content + chunk,
      };
      return { messages };
    }),
  
  setProcessing: (isProcessing) => set({ isProcessing }),
  
  setWorkflow: (workflow) => set({ currentWorkflow: workflow }),
  
  clearMessages: () => set({ messages: [], currentWorkflow: null, workflowExecution: null, chatEvents: [] }),
  
  startWorkflowExecution: (workflowId) =>
    set({
      workflowExecution: {
        workflowId,
        status: 'running',
        events: [],
        completedAgents: [],
        failedAgents: [],
        startTime: Date.now(),
        iterations: {},  // 初始化为空对象
      },
    }),
  
  addExecutionEvent: (event) =>
    set((state) => {
      if (!state.workflowExecution) return state;
      
      const updatedExecution = { ...state.workflowExecution };
      updatedExecution.events = [...updatedExecution.events, event];
      
      // 使用 nodeId（workflow 节点 ID）
      const nodeId = event.nodeId;
      
      // 确保该节点的迭代数组存在
      if (!updatedExecution.iterations[nodeId]) {
        updatedExecution.iterations[nodeId] = [];
      }
      
      const nodeIterations = updatedExecution.iterations[nodeId];
      
      // 处理不同类型的事件
      if (event.type === 'agent:thinking') {
        // 创建新的迭代
        const iteration = event.data?.iteration || nodeIterations.length + 1;
        nodeIterations.push({
          iteration,
          thinkingText: '',
          toolCalls: []
        });
      } else if (event.type === 'agent:stream-text') {
        // 追加到当前迭代的思考文本
        const currentIter = nodeIterations[nodeIterations.length - 1];
        if (currentIter) {
          currentIter.thinkingText += event.data?.textDelta || '';
        }
      } else if (event.type === 'agent:tool-call') {
        // 添加工具调用
        const currentIter = nodeIterations[nodeIterations.length - 1];
        if (currentIter) {
          const toolCallId = event.data?.toolCallId || `${event.data?.toolName}-${event.timestamp}`;
          currentIter.toolCalls.push({
            toolName: event.data?.toolName,
            input: event.data?.input,
            timestamp: event.timestamp,
            toolCallId // 保存工具调用 ID，用于匹配 toolInput
          });
        }
      } else if (event.type === 'agent:tool-result') {
        // 匹配工具结果到最后一个工具调用
        const currentIter = nodeIterations[nodeIterations.length - 1];
        if (currentIter && currentIter.toolCalls.length > 0) {
          const lastCall = currentIter.toolCalls[currentIter.toolCalls.length - 1];
          if (!lastCall.result && !lastCall.error) {
            lastCall.result = event.data?.result;
          }
        }
      } else if (event.type === 'agent:tool-error') {
        // 匹配工具错误到最后一个工具调用
        const currentIter = nodeIterations[nodeIterations.length - 1];
        if (currentIter && currentIter.toolCalls.length > 0) {
          const lastCall = currentIter.toolCalls[currentIter.toolCalls.length - 1];
          if (!lastCall.error) {
            lastCall.error = event.data?.error;
          }
        }
      }
      
      // 处理生命周期事件
      if (event.type === 'agent:start') {
        updatedExecution.currentAgent = nodeId;
      } else if (event.type === 'agent:complete') {
        updatedExecution.completedAgents = [...updatedExecution.completedAgents, nodeId];
        if (updatedExecution.currentAgent === nodeId) {
          updatedExecution.currentAgent = undefined;
        }
      } else if (event.type === 'agent:error') {
        updatedExecution.failedAgents = [...updatedExecution.failedAgents, nodeId];
        if (updatedExecution.currentAgent === nodeId) {
          updatedExecution.currentAgent = undefined;
        }
      }
      
      return { workflowExecution: updatedExecution };
    }),
  
  completeWorkflowExecution: (status) =>
    set((state) => {
      if (!state.workflowExecution) return state;
      return {
        workflowExecution: {
          ...state.workflowExecution,
          status,
        },
      };
    }),
  
  addChatEvent: (event) =>
    set((state) => {
      const newEvents = [...state.chatEvents];
      
      // 高频事件类型列表 - 需要更激进的合并策略
      const highFrequencyEvents = new Set([
        'agent:stream-text',
        'agent:tool-input-progress',
        'agent:thinking',
        'stream'
      ]);
      
      // 中频事件类型 - 适度合并
      const mediumFrequencyEvents = new Set([
        'agent:tool-call',
        'agent:tool-result',
        'workflow:event'
      ]);
      
      const isHighFrequency = highFrequencyEvents.has(event.type);
      const isMediumFrequency = mediumFrequencyEvents.has(event.type);
      
      if (isHighFrequency || isMediumFrequency) {
        // 查找最近的相同类型事件
        const now = Date.now();
        const mergeWindow = isHighFrequency ? 10000 : 3000; // 高频事件 10 秒，中频 3 秒
        
        // 从数组末尾开始查找（最近的事件）
        for (let i = newEvents.length - 1; i >= 0; i--) {
          const existingEvent = newEvents[i];
          const timeDiff = now - (existingEvent.lastUpdate || existingEvent.timestamp);
          
          // 如果超过时间窗口，停止查找
          if (timeDiff > mergeWindow) break;
          
          // 检查是否可以合并
          if (existingEvent.type === event.type && existingEvent.source === event.source) {
            // 合并事件
            newEvents[i] = {
              ...existingEvent,
              count: (existingEvent.count || 1) + 1,
              lastUpdate: now,
              message: event.message || existingEvent.message,
              data: event.data || existingEvent.data
            };
            
            // 优化：不创建新数组，直接返回
            return { chatEvents: newEvents };
          }
        }
      }
      
      // 创建新事件
      const newEvent = {
        ...event,
        id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        count: 1,
        lastUpdate: Date.now()
      };
      
      newEvents.push(newEvent);
      
      // 限制事件数量（保留最近 300 个，减少内存占用）
      if (newEvents.length > 300) {
        // 优化：使用 slice 而不是删除前面的元素
        return { chatEvents: newEvents.slice(-300) };
      }
      
      return { chatEvents: newEvents };
    }),
  
  // 新增：工具参数进度管理
  setToolInputStart: (id, toolName) =>
    set((state) => {
      console.log('🎬 Setting tool input start:', id, toolName);
      const newInputs = new Map(state.toolInputs);
      const existing = newInputs.get(id);
      
      if (existing) {
        newInputs.set(id, { ...existing, toolName });
      } else {
        newInputs.set(id, {
          id,
          toolName,
          status: 'receiving',
          charCount: 0,
          fullContent: ''
        });
      }
      return { toolInputs: newInputs };
    }),
  
  updateToolInputProgress: (id, charCount, delta) =>
    set((state) => {
      const newInputs = new Map(state.toolInputs);
      const input = newInputs.get(id);
      if (input) {
        // 前端累积 delta
        const newFullContent = input.fullContent + (delta || '');
        
        newInputs.set(id, { 
          ...input, 
          charCount, 
          fullContent: newFullContent
        });
        return { toolInputs: newInputs };
      } else {
        // 如果还没有 start 事件，自动创建
        console.warn('⚠️ Tool input not found for update, creating placeholder:', id);
        newInputs.set(id, {
          id,
          toolName: '(接收中...)',
          status: 'receiving',
          charCount,
          fullContent: delta || ''
        });
        return { toolInputs: newInputs };
      }
    }),
  
  setToolInputComplete: (id, duration) =>
    set((state) => {
      const newInputs = new Map(state.toolInputs);
      const input = newInputs.get(id);
      if (input) {
        newInputs.set(id, { ...input, status: 'complete', duration });
        
        // 将完整的 input 内容更新到对应的 toolCall 中
        if (state.workflowExecution) {
          const updatedExecution = { ...state.workflowExecution };
          
          // 遍历所有迭代，找到匹配的 toolCall
          Object.keys(updatedExecution.iterations).forEach(nodeId => {
            const iterations = updatedExecution.iterations[nodeId];
            iterations.forEach(iteration => {
              iteration.toolCalls.forEach(toolCall => {
                if (toolCall.toolCallId === id && !toolCall.input) {
                  // 解析完整的 input（fullContent 包含完整累积内容）
                  try {
                    toolCall.input = JSON.parse(input.fullContent);
                  } catch {
                    toolCall.input = input.fullContent; // 如果不是 JSON，直接保存字符串
                  }
                }
              });
            });
          });
          
          return { toolInputs: newInputs, workflowExecution: updatedExecution };
        }
      }
      return { toolInputs: newInputs };
    }),
  
  clearToolInput: (id) =>
    set((state) => {
      const newInputs = new Map(state.toolInputs);
      newInputs.delete(id);
      return { toolInputs: newInputs };
    }),
}));

