import { describe, it, expect } from 'vitest';
import { TopologicalScheduler } from '../scheduler/TopologicalScheduler';
import type { AgentNode } from '@monkey-agent/types';

describe('TopologicalScheduler', () => {
  let scheduler: TopologicalScheduler;

  beforeEach(() => {
    scheduler = new TopologicalScheduler();
  });

  describe('schedule', () => {
    it('应该处理单个节点', () => {
      const nodes: AgentNode[] = [
        {
          id: 'node1',
          type: 'test',
          name: 'Node 1',
          desc: 'Test node',
          steps: [],
          dependencies: [],
        },
      ];

      const levels = scheduler.schedule(nodes);

      expect(levels).toEqual([['node1']]);
    });

    it('应该处理简单的线性依赖', () => {
      const nodes: AgentNode[] = [
        {
          id: 'node1',
          type: 'test',
          name: 'Node 1',
          desc: 'First',
          steps: [],
          dependencies: [],
        },
        {
          id: 'node2',
          type: 'test',
          name: 'Node 2',
          desc: 'Second',
          steps: [],
          dependencies: ['node1'],
        },
        {
          id: 'node3',
          type: 'test',
          name: 'Node 3',
          desc: 'Third',
          steps: [],
          dependencies: ['node2'],
        },
      ];

      const levels = scheduler.schedule(nodes);

      expect(levels).toEqual([
        ['node1'],
        ['node2'],
        ['node3'],
      ]);
    });

    it('应该识别可并行执行的节点', () => {
      const nodes: AgentNode[] = [
        {
          id: 'node1',
          type: 'test',
          name: 'Node 1',
          desc: 'Parallel 1',
          steps: [],
          dependencies: [],
        },
        {
          id: 'node2',
          type: 'test',
          name: 'Node 2',
          desc: 'Parallel 2',
          steps: [],
          dependencies: [],
        },
        {
          id: 'node3',
          type: 'test',
          name: 'Node 3',
          desc: 'Depends on both',
          steps: [],
          dependencies: ['node1', 'node2'],
        },
      ];

      const levels = scheduler.schedule(nodes);

      expect(levels).toHaveLength(2);
      expect(levels[0]).toContain('node1');
      expect(levels[0]).toContain('node2');
      expect(levels[0]).toHaveLength(2);
      expect(levels[1]).toEqual(['node3']);
    });

    it('应该处理复杂的 DAG', () => {
      const nodes: AgentNode[] = [
        { id: 'A', type: 'test', name: 'A', desc: 'A', steps: [], dependencies: [] },
        { id: 'B', type: 'test', name: 'B', desc: 'B', steps: [], dependencies: [] },
        { id: 'C', type: 'test', name: 'C', desc: 'C', steps: [], dependencies: ['A'] },
        { id: 'D', type: 'test', name: 'D', desc: 'D', steps: [], dependencies: ['B'] },
        { id: 'E', type: 'test', name: 'E', desc: 'E', steps: [], dependencies: ['C', 'D'] },
      ];

      const levels = scheduler.schedule(nodes);

      expect(levels).toHaveLength(3);
      expect(levels[0]).toContain('A');
      expect(levels[0]).toContain('B');
      expect(levels[1]).toContain('C');
      expect(levels[1]).toContain('D');
      expect(levels[2]).toEqual(['E']);
    });

    it('应该检测循环依赖', () => {
      const nodes: AgentNode[] = [
        {
          id: 'node1',
          type: 'test',
          name: 'Node 1',
          desc: 'First',
          steps: [],
          dependencies: ['node2'],
        },
        {
          id: 'node2',
          type: 'test',
          name: 'Node 2',
          desc: 'Second',
          steps: [],
          dependencies: ['node1'],
        },
      ];

      expect(() => scheduler.schedule(nodes)).toThrow('Circular dependency');
    });

    it('应该检测自循环依赖', () => {
      const nodes: AgentNode[] = [
        {
          id: 'node1',
          type: 'test',
          name: 'Node 1',
          desc: 'Self loop',
          steps: [],
          dependencies: ['node1'],
        },
      ];

      expect(() => scheduler.schedule(nodes)).toThrow();
    });

    it('应该处理空图', () => {
      const nodes: AgentNode[] = [];

      const levels = scheduler.schedule(nodes);

      expect(levels).toEqual([]);
    });

    it('应该检测不可达节点', () => {
      const nodes: AgentNode[] = [
        {
          id: 'node1',
          type: 'test',
          name: 'Node 1',
          desc: 'First',
          steps: [],
          dependencies: [],
        },
        {
          id: 'node2',
          type: 'test',
          name: 'Node 2',
          desc: 'Depends on nonexistent',
          steps: [],
          dependencies: ['nonexistent'],
        },
      ];

      // 由于 node2 依赖不存在的节点,它永远不会被调度
      expect(() => scheduler.schedule(nodes)).toThrow();
    });
  });

  describe('validate', () => {
    it('应该验证有效的 DAG', () => {
      const nodes: AgentNode[] = [
        { id: 'A', type: 'test', name: 'A', desc: 'A', steps: [], dependencies: [] },
        { id: 'B', type: 'test', name: 'B', desc: 'B', steps: [], dependencies: ['A'] },
      ];

      const result = scheduler.validate(nodes);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('应该拒绝包含循环的 DAG', () => {
      const nodes: AgentNode[] = [
        { id: 'A', type: 'test', name: 'A', desc: 'A', steps: [], dependencies: ['B'] },
        { id: 'B', type: 'test', name: 'B', desc: 'B', steps: [], dependencies: ['A'] },
      ];

      const result = scheduler.validate(nodes);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Circular dependency');
    });

    it('应该拒绝重复的节点 ID', () => {
      const nodes: AgentNode[] = [
        { id: 'A', type: 'test', name: 'A', desc: 'A', steps: [], dependencies: [] },
        { id: 'A', type: 'test', name: 'A duplicate', desc: 'A2', steps: [], dependencies: [] },
      ];

      const result = scheduler.validate(nodes);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Duplicate');
    });
  });
});

