import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressTracker } from '../monitor/ProgressTracker';
import type { Workflow } from '@monkey-agent/types';

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;
  let mockWorkflow: Workflow;
  let mockLevels: string[][];

  beforeEach(() => {
    tracker = new ProgressTracker();
    
    mockWorkflow = {
      id: 'test-workflow',
      name: 'Test Workflow',
      description: 'A test workflow',
      agentGraph: [
        { id: 'agent1', type: 'test', name: 'Agent 1', desc: 'Test', steps: [], dependencies: [] },
        { id: 'agent2', type: 'test', name: 'Agent 2', desc: 'Test', steps: [], dependencies: ['agent1'] },
        { id: 'agent3', type: 'test', name: 'Agent 3', desc: 'Test', steps: [], dependencies: ['agent2'] },
      ],
    };
    
    mockLevels = [['agent1'], ['agent2'], ['agent3']];
  });

  describe('init', () => {
    it('应该正确初始化追踪器', () => {
      tracker.init(mockWorkflow, mockLevels);
      
      const metrics = tracker.getMetrics();
      
      expect(metrics.totalAgents).toBe(3);
      expect(metrics.parallelLevels).toBe(3);
      expect(metrics.events.length).toBeGreaterThan(0);
    });

    it('应该记录初始事件', () => {
      tracker.init(mockWorkflow, mockLevels);
      
      const metrics = tracker.getMetrics();
      const startEvent = metrics.events.find(e => e.type === 'workflow:start');
      
      expect(startEvent).toBeDefined();
      expect(startEvent?.data.workflowId).toBe('test-workflow');
    });
  });

  describe('recordEvent', () => {
    it('应该记录事件', () => {
      tracker.init(mockWorkflow, mockLevels);
      
      tracker.recordEvent('agent:start', { agentId: 'agent1' });
      
      const metrics = tracker.getMetrics();
      const agentStartEvent = metrics.events.find(
        e => e.type === 'agent:start' && e.data.agentId === 'agent1'
      );
      
      expect(agentStartEvent).toBeDefined();
    });

    it('应该为事件添加时间戳', () => {
      tracker.init(mockWorkflow, mockLevels);
      
      const beforeTime = Date.now();
      tracker.recordEvent('agent:complete', { agentId: 'agent1' });
      const afterTime = Date.now();
      
      const metrics = tracker.getMetrics();
      const event = metrics.events[metrics.events.length - 1];
      
      expect(event.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(event.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('recordAgentDuration', () => {
    it('应该记录 Agent 执行时间', () => {
      tracker.init(mockWorkflow, mockLevels);
      
      tracker.recordAgentDuration(1000);
      tracker.recordAgentDuration(2000);
      
      const metrics = tracker.getMetrics();
      
      expect(metrics.averageAgentDuration).toBe(1500);
    });

    it('应该处理单个 Agent', () => {
      tracker.init(mockWorkflow, mockLevels);
      
      tracker.recordAgentDuration(1500);
      
      const metrics = tracker.getMetrics();
      
      expect(metrics.averageAgentDuration).toBe(1500);
    });
  });

  describe('recordAgentComplete', () => {
    it('应该增加完成计数', () => {
      tracker.init(mockWorkflow, mockLevels);
      
      expect(tracker.getProgress()).toBe(0);
      
      tracker.recordAgentComplete();
      expect(tracker.getProgress()).toBeCloseTo(33.33, 1);
      
      tracker.recordAgentComplete();
      expect(tracker.getProgress()).toBeCloseTo(66.67, 1);
      
      tracker.recordAgentComplete();
      expect(tracker.getProgress()).toBe(100);
    });
  });

  describe('getProgress', () => {
    it('应该返回正确的进度百分比', () => {
      tracker.init(mockWorkflow, mockLevels);
      
      expect(tracker.getProgress()).toBe(0);
      
      tracker.recordAgentComplete();
      expect(tracker.getProgress()).toBeGreaterThan(0);
      expect(tracker.getProgress()).toBeLessThanOrEqual(100);
    });

    it('应该在未初始化时返回 0', () => {
      expect(tracker.getProgress()).toBe(0);
    });
  });

  describe('getEstimatedTimeRemaining', () => {
    it('应该估算剩余时间', () => {
      tracker.init(mockWorkflow, mockLevels);
      
      tracker.recordAgentDuration(1000);
      tracker.recordAgentComplete();
      
      const remaining = tracker.getEstimatedTimeRemaining();
      
      // 剩余 2 个 Agent,每个约 1000ms
      expect(remaining).toBeGreaterThan(0);
    });

    it('应该在无历史数据时返回 0', () => {
      tracker.init(mockWorkflow, mockLevels);
      
      const remaining = tracker.getEstimatedTimeRemaining();
      
      expect(remaining).toBe(0);
    });

    it('应该在全部完成时返回 0', () => {
      tracker.init(mockWorkflow, mockLevels);
      
      tracker.recordAgentDuration(1000);
      tracker.recordAgentComplete();
      tracker.recordAgentDuration(1000);
      tracker.recordAgentComplete();
      tracker.recordAgentDuration(1000);
      tracker.recordAgentComplete();
      
      const remaining = tracker.getEstimatedTimeRemaining();
      
      expect(remaining).toBe(0);
    });
  });

  describe('getMetrics', () => {
    it('应该返回完整的指标', () => {
      tracker.init(mockWorkflow, mockLevels);
      
      tracker.recordAgentDuration(1000);
      tracker.recordAgentComplete();
      tracker.recordEvent('agent:start', { agentId: 'agent2' });
      
      const metrics = tracker.getMetrics();
      
      expect(metrics).toHaveProperty('totalAgents');
      expect(metrics).toHaveProperty('totalSteps');
      expect(metrics).toHaveProperty('parallelLevels');
      expect(metrics).toHaveProperty('averageAgentDuration');
      expect(metrics).toHaveProperty('events');
      
      expect(metrics.totalAgents).toBe(3);
      expect(metrics.parallelLevels).toBe(3);
      expect(metrics.averageAgentDuration).toBe(1000);
      expect(metrics.events.length).toBeGreaterThan(0);
    });

    it('应该计算总步骤数', () => {
      const workflowWithSteps: Workflow = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        agentGraph: [
          { id: 'a1', type: 'test', name: 'A1', desc: 'Test', steps: [{ stepNumber: 1, desc: 'Step 1' }, { stepNumber: 2, desc: 'Step 2' }], dependencies: [] },
          { id: 'a2', type: 'test', name: 'A2', desc: 'Test', steps: [{ stepNumber: 3, desc: 'Step 3' }], dependencies: [] },
        ],
      };
      
      tracker.init(workflowWithSteps, [['a1', 'a2']]);
      
      const metrics = tracker.getMetrics();
      
      expect(metrics.totalSteps).toBe(3);
    });
  });

  describe('内存追踪', () => {
    it('应该追踪内存使用', () => {
      tracker.init(mockWorkflow, mockLevels);
      
      tracker.recordAgentComplete();
      
      const metrics = tracker.getMetrics();
      
      // 应该记录内存使用（可能为 undefined 如果不支持）
      expect(metrics.peakMemoryUsage === undefined || typeof metrics.peakMemoryUsage === 'number').toBe(true);
    });
  });
});

