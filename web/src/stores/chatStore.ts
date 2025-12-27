import { create } from 'zustand';
import type { Message, Workflow, ExecutionEvent, IterationData } from '../types';

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
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isProcessing: false,
  currentWorkflow: null,
  workflowExecution: null,
  chatEvents: [],
  
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
          currentIter.toolCalls.push({
            toolName: event.data?.toolName,
            input: event.data?.input,
            timestamp: event.timestamp
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
      
      // 对于某些类型的事件，尝试合并而不是创建新的
      const shouldMerge = (type: string) => {
        return type === 'stream' || 
               type === 'agent:stream-text' || 
               type === 'agent:thinking';
      };
      
      if (shouldMerge(event.type)) {
        // 查找最近的相同类型事件（5秒内）
        const now = Date.now();
        const recentEventIndex = newEvents.findIndex(
          e => e.type === event.type && 
               e.source === event.source &&
               (now - (e.lastUpdate || e.timestamp)) < 5000
        );
        
        if (recentEventIndex !== -1) {
          // 更新现有事件
          const existingEvent = newEvents[recentEventIndex];
          newEvents[recentEventIndex] = {
            ...existingEvent,
            count: (existingEvent.count || 1) + 1,
            lastUpdate: now,
            message: event.message || existingEvent.message,
            data: event.data || existingEvent.data
          };
          return { chatEvents: newEvents };
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
      
      // 限制事件数量（保留最近 500 个）
      if (newEvents.length > 500) {
        return { chatEvents: newEvents.slice(-500) };
      }
      
      return { chatEvents: newEvents };
    }),
}));

