import { describe, it, expect } from 'vitest';
import { createContextTools, isContextTool, executeContextTool } from '../context-tools';
import type { WorkflowExecutionContext } from '../types';

// 创建模拟的执行上下文
function createMockContext(): WorkflowExecutionContext {
  return {
    workflowId: 'test-workflow',
    vals: new Map(),
    outputs: new Map(),
    workflowTask: 'Test task',
    currentLevel: 0,
    status: 'running',
    startTime: Date.now(),
    getOutput: function(agentId: string) {
      return this.outputs.get(agentId);
    },
    getValue: function(key: string) {
      return this.vals.get(key);
    },
    setValue: function(key: string, value: any) {
      this.vals.set(key, value);
    },
    toJSON: function() {
      return {
        workflowId: this.workflowId,
        vals: Array.from(this.vals.entries()),
        outputs: Array.from(this.outputs.entries()),
      };
    },
  };
}

describe('context-tools', () => {
  describe('createContextTools', () => {
    it('应该创建所有必需的上下文工具', () => {
      const context = createMockContext();
      const tools = createContextTools(context);
      
      expect(tools).toHaveProperty('valSet');
      expect(tools).toHaveProperty('valGet');
      expect(tools).toHaveProperty('valList');
    });

    it('工具应该有正确的结构', () => {
      const context = createMockContext();
      const tools = createContextTools(context);
      
      expect(tools.valSet).toHaveProperty('description');
      expect(tools.valSet).toHaveProperty('parameters');
      
      expect(tools.valGet).toHaveProperty('description');
      expect(tools.valGet).toHaveProperty('parameters');
      
      expect(tools.valList).toHaveProperty('description');
      expect(tools.valList).toHaveProperty('parameters');
    });
  });

  describe('isContextTool', () => {
    it('应该识别上下文工具', () => {
      expect(isContextTool('valSet')).toBe(true);
      expect(isContextTool('valGet')).toBe(true);
      expect(isContextTool('valList')).toBe(true);
    });

    it('应该拒绝非上下文工具', () => {
      expect(isContextTool('search')).toBe(false);
      expect(isContextTool('execute')).toBe(false);
      expect(isContextTool('unknown')).toBe(false);
    });
  });

  describe('executeContextTool - valSet', () => {
    it('应该设置字符串值', async () => {
      const context = createMockContext();
      
      const result = await executeContextTool('valSet', {
        key: 'testKey',
        value: 'testValue',
      }, context);
      
      expect(result.success).toBe(true);
      expect(context.vals.get('testKey')).toBe('testValue');
    });

    it('应该设置对象值', async () => {
      const context = createMockContext();
      const testData = { name: 'John', age: 30 };
      
      const result = await executeContextTool('valSet', {
        key: 'userData',
        value: testData,
      }, context);
      
      expect(result.success).toBe(true);
      expect(context.vals.get('userData')).toEqual(testData);
    });

    it('应该设置数组值', async () => {
      const context = createMockContext();
      const testArray = [1, 2, 3, 4, 5];
      
      const result = await executeContextTool('valSet', {
        key: 'numbers',
        value: testArray,
      }, context);
      
      expect(result.success).toBe(true);
      expect(context.vals.get('numbers')).toEqual(testArray);
    });

    it('应该覆盖已存在的值', async () => {
      const context = createMockContext();
      
      await executeContextTool('valSet', { key: 'test', value: 'old' }, context);
      await executeContextTool('valSet', { key: 'test', value: 'new' }, context);
      
      expect(context.vals.get('test')).toBe('new');
    });
  });

  describe('executeContextTool - valGet', () => {
    it('应该获取已存在的值', async () => {
      const context = createMockContext();
      context.vals.set('testKey', 'testValue');
      
      const result = await executeContextTool('valGet', {
        key: 'testKey',
      }, context);
      
      expect(result.success).toBe(true);
      expect(result.value).toBe('testValue');
    });

    it('应该处理不存在的键', async () => {
      const context = createMockContext();
      
      const result = await executeContextTool('valGet', {
        key: 'nonexistent',
      }, context);
      
      expect(result.success).toBe(false);
      expect(result.value).toBeNull();
      expect(result.message).toContain('not found');
    });

    it('应该获取复杂对象', async () => {
      const context = createMockContext();
      const complexData = {
        users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
        meta: { total: 2, page: 1 },
      };
      context.vals.set('data', complexData);
      
      const result = await executeContextTool('valGet', {
        key: 'data',
      }, context);
      
      expect(result.success).toBe(true);
      expect(result.value).toEqual(complexData);
    });
  });

  describe('executeContextTool - valList', () => {
    it('应该列出空上下文', async () => {
      const context = createMockContext();
      
      const result = await executeContextTool('valList', {}, context);
      
      expect(result.success).toBe(true);
      expect(result.keys).toEqual([]);
      expect(result.count).toBe(0);
    });

    it('应该列出所有变量键', async () => {
      const context = createMockContext();
      context.vals.set('key1', 'value1');
      context.vals.set('key2', 'value2');
      context.vals.set('key3', 'value3');
      
      const result = await executeContextTool('valList', {}, context);
      
      expect(result.success).toBe(true);
      expect(result.keys).toContain('key1');
      expect(result.keys).toContain('key2');
      expect(result.keys).toContain('key3');
      expect(result.count).toBe(3);
    });
  });

  describe('executeContextTool - 错误处理', () => {
    it('应该拒绝未知工具', async () => {
      const context = createMockContext();
      
      await expect(
        executeContextTool('unknownTool', {}, context)
      ).rejects.toThrow('Unknown context tool');
    });
  });

  describe('完整工作流场景', () => {
    it('应该支持多个 Agent 间的数据共享', async () => {
      const context = createMockContext();
      
      // Agent 1: 设置数据
      await executeContextTool('valSet', {
        key: 'fetchedData',
        value: { items: [1, 2, 3] },
      }, context);
      
      // Agent 2: 读取数据
      const getResult = await executeContextTool('valGet', {
        key: 'fetchedData',
      }, context);
      
      expect(getResult.success).toBe(true);
      expect(getResult.value).toEqual({ items: [1, 2, 3] });
      
      // Agent 3: 列出所有变量
      const listResult = await executeContextTool('valList', {}, context);
      
      expect(listResult.keys).toContain('fetchedData');
    });
  });
});

