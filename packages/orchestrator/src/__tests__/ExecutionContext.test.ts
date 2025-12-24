import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionContext } from '../state/ExecutionContext';
import type { AgentExecutionResult } from '@monkey-agent/types';

describe('ExecutionContext', () => {
  let context: ExecutionContext;

  beforeEach(() => {
    context = new ExecutionContext('test-workflow', 'Test workflow task');
  });

  describe('构造函数', () => {
    it('应该正确初始化', () => {
      expect(context.workflowId).toBe('test-workflow');
      expect(context.workflowTask).toBe('Test workflow task');
      expect(context.status).toBe('running');
      expect(context.currentLevel).toBe(0);
    });

    it('应该创建空的输出和变量 Map', () => {
      expect(context.outputs.size).toBe(0);
      expect(context.vals.size).toBe(0);
    });
  });

  describe('getAgentState', () => {
    it('应该创建新的 Agent 状态', () => {
      const state = context.getAgentState('agent1');
      
      expect(state).toBeDefined();
      expect(state.agentId).toBe('agent1');
      expect(state.status).toBe('pending');
      expect(state.retryCount).toBe(0);
    });

    it('应该返回已存在的状态', () => {
      const state1 = context.getAgentState('agent1');
      state1.status = 'running';
      
      const state2 = context.getAgentState('agent1');
      
      expect(state2.status).toBe('running');
      expect(state1).toBe(state2);
    });
  });

  describe('setOutput', () => {
    it('应该设置 Agent 输出', () => {
      const output: AgentExecutionResult = {
        agentId: 'agent1',
        data: { result: 'test' },
        summary: 'Test completed',
        status: 'success',
      };
      
      context.setOutput('agent1', output);
      
      expect(context.outputs.get('agent1')).toEqual(output);
    });

    it('应该覆盖已存在的输出', () => {
      const output1: AgentExecutionResult = {
        agentId: 'agent1',
        data: { result: 'old' },
        summary: 'Old',
        status: 'success',
      };
      
      const output2: AgentExecutionResult = {
        agentId: 'agent1',
        data: { result: 'new' },
        summary: 'New',
        status: 'success',
      };
      
      context.setOutput('agent1', output1);
      context.setOutput('agent1', output2);
      
      expect(context.outputs.get('agent1')).toEqual(output2);
    });
  });

  describe('getOutput', () => {
    it('应该获取已设置的输出', () => {
      const output: AgentExecutionResult = {
        agentId: 'agent1',
        data: { test: 'data' },
        summary: 'Summary',
        status: 'success',
      };
      
      context.setOutput('agent1', output);
      
      const retrieved = context.getOutput('agent1');
      
      expect(retrieved).toEqual(output);
    });

    it('应该返回 undefined 对于不存在的输出', () => {
      const output = context.getOutput('nonexistent');
      
      expect(output).toBeUndefined();
    });
  });

  describe('getValue/setValue', () => {
    it('应该设置和获取变量', () => {
      context.setValue('key1', 'value1');
      
      expect(context.getValue('key1')).toBe('value1');
    });

    it('应该支持复杂对象', () => {
      const complexData = {
        users: [{ id: 1, name: 'Alice' }],
        meta: { count: 1 },
      };
      
      context.setValue('data', complexData);
      
      expect(context.getValue('data')).toEqual(complexData);
    });

    it('应该返回 undefined 对于不存在的变量', () => {
      expect(context.getValue('nonexistent')).toBeUndefined();
    });
  });

  describe('complete/fail', () => {
    it('应该标记为完成', () => {
      context.complete();
      
      expect(context.status).toBe('completed');
    });

    it('应该标记为失败', () => {
      const error = new Error('Test error');
      
      context.fail(error);
      
      expect(context.status).toBe('failed');
    });
  });

  describe('cancel', () => {
    it('应该触发取消', () => {
      expect(context.isCancelled).toBe(false);
      
      context.cancel();
      
      expect(context.isCancelled).toBe(true);
    });

    it('取消后信号应该被中止', () => {
      const signal = context.signal;
      
      expect(signal.aborted).toBe(false);
      
      context.cancel();
      
      expect(signal.aborted).toBe(true);
    });
  });

  describe('toJSON', () => {
    it('应该序列化为 JSON', () => {
      context.setValue('key1', 'value1');
      context.setOutput('agent1', {
        agentId: 'agent1',
        data: {},
        summary: 'Done',
        status: 'success',
      });
      
      const json = context.toJSON();
      
      expect(json).toHaveProperty('workflowId');
      expect(json).toHaveProperty('vals');
      expect(json).toHaveProperty('outputs');
      expect(json.workflowId).toBe('test-workflow');
    });
  });

  describe('getAllAgentStates', () => {
    it('应该返回所有 Agent 状态', () => {
      context.getAgentState('agent1');
      context.getAgentState('agent2');
      
      const states = context.getAllAgentStates();
      
      expect(states.size).toBe(2);
      expect(states.has('agent1')).toBe(true);
      expect(states.has('agent2')).toBe(true);
    });
  });
});

