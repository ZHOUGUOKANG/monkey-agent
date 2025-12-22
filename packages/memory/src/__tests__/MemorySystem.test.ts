import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemorySystem,
  ShortTermMemory,
  LongTermMemory,
  WorkingMemory,
  SemanticMemory,
} from '../MemorySystem';
import { SqliteVecStorage } from '../vector/SqliteVecStorage';
import { Memory } from '@monkey-agent/types';

describe('ShortTermMemory', () => {
  let memory: ShortTermMemory;

  beforeEach(() => {
    memory = new ShortTermMemory(5);
  });

  it('应该能添加记忆', () => {
    const mem: Memory = {
      id: '1',
      type: 'short-term',
      content: 'test content',
      createdAt: new Date(),
    };

    memory.add(mem);
    expect(memory.size()).toBe(1);
    expect(memory.get('1')).toEqual(expect.objectContaining({ id: '1' }));
  });

  it('应该在达到容量上限时删除最旧的记忆', () => {
    // 添加 6 个记忆，容量为 5
    for (let i = 1; i <= 6; i++) {
      memory.add({
        id: String(i),
        type: 'short-term',
        content: `content ${i}`,
        createdAt: new Date(),
      });
    }

    expect(memory.size()).toBe(5);
    expect(memory.get('1')).toBeUndefined(); // 最旧的应该被删除
    expect(memory.get('6')).toBeDefined();
  });

  it('应该能获取最近的 N 个记忆', () => {
    for (let i = 1; i <= 5; i++) {
      memory.add({
        id: String(i),
        type: 'short-term',
        content: `content ${i}`,
        createdAt: new Date(),
      });
    }

    const recent = memory.getRecent(3);
    expect(recent).toHaveLength(3);
    expect(recent[0].id).toBe('3');
    expect(recent[2].id).toBe('5');
  });

  it('应该能更新访问次数', () => {
    const mem: Memory = {
      id: '1',
      type: 'short-term',
      content: 'test',
      createdAt: new Date(),
      accessCount: 0,
    };

    memory.add(mem);
    
    memory.get('1');
    memory.get('1');
    
    const retrieved = memory.get('1');
    expect(retrieved?.accessCount).toBe(3);
  });

  it('应该能清空所有记忆', () => {
    memory.add({
      id: '1',
      type: 'short-term',
      content: 'test',
      createdAt: new Date(),
    });

    memory.clear();
    expect(memory.size()).toBe(0);
  });
});

describe('LongTermMemory', () => {
  let memory: LongTermMemory;
  let vectorStorage: SqliteVecStorage;

  beforeEach(async () => {
    vectorStorage = new SqliteVecStorage(':memory:');
    await vectorStorage.init();
    memory = new LongTermMemory(vectorStorage);
  });

  it('应该能添加记忆', async () => {
    const mem: Memory = {
      id: '1',
      type: 'long-term',
      content: 'test content',
      embedding: new Float32Array([0.1, 0.2, 0.3]),
      createdAt: new Date(),
    };

    await memory.add(mem);
    expect(memory.size()).toBe(1);
    
    const retrieved = await memory.get('1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('1');
  });

  it('应该能通过向量搜索记忆', async () => {
    const mem1: Memory = {
      id: '1',
      type: 'long-term',
      content: 'apple',
      embedding: new Float32Array([0.9, 0.1, 0.1]),
      createdAt: new Date(),
    };

    const mem2: Memory = {
      id: '2',
      type: 'long-term',
      content: 'banana',
      embedding: new Float32Array([0.8, 0.2, 0.1]),
      createdAt: new Date(),
    };

    const mem3: Memory = {
      id: '3',
      type: 'long-term',
      content: 'car',
      embedding: new Float32Array([0.1, 0.1, 0.9]),
      createdAt: new Date(),
    };

    await memory.add(mem1);
    await memory.add(mem2);
    await memory.add(mem3);

    // 搜索与 apple 相似的记忆
    const results = await memory.search(
      new Float32Array([0.95, 0.05, 0.05]),
      2,
      0.5
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('1'); // apple 应该是最相似的
  });

  it('应该能删除记忆', async () => {
    const mem: Memory = {
      id: '1',
      type: 'long-term',
      content: 'test',
      embedding: new Float32Array([0.1, 0.2, 0.3]),
      createdAt: new Date(),
    };

    await memory.add(mem);
    expect(memory.size()).toBe(1);

    await memory.delete('1');
    expect(memory.size()).toBe(0);
    expect(await memory.get('1')).toBeUndefined();
  });

  it('应该能清空所有记忆', async () => {
    await memory.add({
      id: '1',
      type: 'long-term',
      content: 'test',
      embedding: new Float32Array([0.1, 0.2, 0.3]),
      createdAt: new Date(),
    });

    await memory.clear();
    expect(memory.size()).toBe(0);
  });

  it('没有向量存储时应该返回最近的记忆', async () => {
    const memoryNoVector = new LongTermMemory();
    
    await memoryNoVector.add({
      id: '1',
      type: 'long-term',
      content: 'test 1',
      createdAt: new Date(),
    });

    await memoryNoVector.add({
      id: '2',
      type: 'long-term',
      content: 'test 2',
      createdAt: new Date(),
    });

    const results = await memoryNoVector.search(
      new Float32Array([0.1, 0.2]),
      1
    );

    expect(results.length).toBeLessThanOrEqual(1);
  });
});

describe('WorkingMemory', () => {
  let memory: WorkingMemory;

  beforeEach(() => {
    memory = new WorkingMemory();
  });

  it('应该能设置和获取值', () => {
    memory.set('key1', 'value1');
    expect(memory.get('key1')).toBe('value1');
  });

  it('应该能检查键是否存在', () => {
    memory.set('key1', 'value1');
    expect(memory.has('key1')).toBe(true);
    expect(memory.has('key2')).toBe(false);
  });

  it('应该能删除键', () => {
    memory.set('key1', 'value1');
    expect(memory.delete('key1')).toBe(true);
    expect(memory.has('key1')).toBe(false);
  });

  it('应该能获取所有键', () => {
    memory.set('key1', 'value1');
    memory.set('key2', 'value2');
    
    const keys = memory.keys();
    expect(keys).toContain('key1');
    expect(keys).toContain('key2');
  });

  it('应该能获取所有值', () => {
    memory.set('key1', 'value1');
    memory.set('key2', 'value2');
    
    const all = memory.getAll();
    expect(all).toEqual({ key1: 'value1', key2: 'value2' });
  });

  it('应该能清空所有数据', () => {
    memory.set('key1', 'value1');
    memory.set('key2', 'value2');
    
    memory.clear();
    expect(memory.size()).toBe(0);
  });
});

describe('SemanticMemory', () => {
  let memory: SemanticMemory;
  let vectorStorage: SqliteVecStorage;

  beforeEach(async () => {
    vectorStorage = new SqliteVecStorage(':memory:');
    await vectorStorage.init();
    memory = new SemanticMemory(vectorStorage);
  });

  it('应该能存储和检索知识', async () => {
    await memory.store('concept1', { name: 'AI', description: 'Artificial Intelligence' });
    
    const retrieved = await memory.retrieve('concept1');
    expect(retrieved).toEqual({ name: 'AI', description: 'Artificial Intelligence' });
  });

  it('应该能通过向量搜索知识', async () => {
    await memory.store(
      'ai',
      { name: 'AI', type: 'technology' },
      new Float32Array([0.9, 0.1, 0.1])
    );

    await memory.store(
      'ml',
      { name: 'Machine Learning', type: 'technology' },
      new Float32Array([0.85, 0.15, 0.1])
    );

    const results = await memory.search(
      new Float32Array([0.95, 0.05, 0.05]),
      2,
      0.5
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].key).toBe('ai');
  });

  it('应该能删除知识', async () => {
    await memory.store('concept1', { name: 'test' });
    expect(memory.size()).toBe(1);

    await memory.delete('concept1');
    expect(memory.size()).toBe(0);
  });

  it('应该能清空所有知识', async () => {
    await memory.store('concept1', { name: 'test1' });
    await memory.store('concept2', { name: 'test2' });

    await memory.clear();
    expect(memory.size()).toBe(0);
  });
});

describe('MemorySystem', () => {
  let memorySystem: MemorySystem;

  beforeEach(async () => {
    const vectorStorage = new SqliteVecStorage(':memory:');
    await vectorStorage.init();
    
    memorySystem = new MemorySystem({
      shortTermMaxSize: 10,
      longTermVectorStorage: vectorStorage,
      importanceThreshold: 2,
    });
  });

  it('应该能记录新记忆', async () => {
    const mem: Memory = {
      id: '1',
      type: 'short-term',
      content: 'test content',
      createdAt: new Date(),
    };

    await memorySystem.remember(mem);
    
    const retrieved = await memorySystem.get('1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('1');
  });

  it('重要的记忆应该被添加到长期记忆', async () => {
    const mem: Memory = {
      id: '1',
      type: 'short-term',
      content: 'important memory',
      embedding: new Float32Array([0.1, 0.2, 0.3]),
      createdAt: new Date(),
      accessCount: 5, // 超过阈值
    };

    await memorySystem.remember(mem);
    
    const stats = memorySystem.getStats();
    expect(stats.longTerm).toBe(1);
  });

  it('标记为重要的记忆应该被添加到长期记忆', async () => {
    const mem: Memory = {
      id: '1',
      type: 'short-term',
      content: 'marked important',
      embedding: new Float32Array([0.1, 0.2, 0.3]),
      createdAt: new Date(),
      metadata: { important: true },
    };

    await memorySystem.remember(mem);
    
    const stats = memorySystem.getStats();
    expect(stats.longTerm).toBe(1);
  });

  it('长期类型的记忆应该被添加到长期记忆', async () => {
    const mem: Memory = {
      id: '1',
      type: 'long-term',
      content: 'long-term memory',
      embedding: new Float32Array([0.1, 0.2, 0.3]),
      createdAt: new Date(),
    };

    await memorySystem.remember(mem);
    
    const stats = memorySystem.getStats();
    expect(stats.longTerm).toBe(1);
  });

  it('应该能通过向量检索相关记忆', async () => {
    const mem1: Memory = {
      id: '1',
      type: 'long-term',
      content: 'apple fruit',
      embedding: new Float32Array([0.9, 0.1, 0.1]),
      createdAt: new Date(),
      accessCount: 5,
    };

    const mem2: Memory = {
      id: '2',
      type: 'long-term',
      content: 'car vehicle',
      embedding: new Float32Array([0.1, 0.1, 0.9]),
      createdAt: new Date(),
      accessCount: 5,
    };

    await memorySystem.remember(mem1);
    await memorySystem.remember(mem2);

    // 搜索与 apple 相似的记忆
    const results = await memorySystem.recall(
      new Float32Array([0.95, 0.05, 0.05]),
      2,
      0.5
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('1');
  });

  it('应该能忘记记忆', async () => {
    const mem: Memory = {
      id: '1',
      type: 'long-term',
      content: 'test',
      embedding: new Float32Array([0.1, 0.2, 0.3]),
      createdAt: new Date(),
      accessCount: 5,
    };

    await memorySystem.remember(mem);
    await memorySystem.forget('1');

    const stats = memorySystem.getStats();
    expect(stats.longTerm).toBe(0);
  });

  it('应该能清空所有记忆', async () => {
    await memorySystem.remember({
      id: '1',
      type: 'short-term',
      content: 'test1',
      createdAt: new Date(),
    });

    await memorySystem.remember({
      id: '2',
      type: 'long-term',
      content: 'test2',
      embedding: new Float32Array([0.1, 0.2, 0.3]),
      createdAt: new Date(),
      accessCount: 5,
    });

    memorySystem.working.set('key', 'value');

    await memorySystem.clear();

    const stats = memorySystem.getStats();
    expect(stats.shortTerm).toBe(0);
    expect(stats.longTerm).toBe(0);
    expect(stats.working).toBe(0);
  });

  it('应该能获取统计信息', async () => {
    await memorySystem.remember({
      id: '1',
      type: 'short-term',
      content: 'test1',
      createdAt: new Date(),
    });

    await memorySystem.remember({
      id: '2',
      type: 'long-term',
      content: 'test2',
      embedding: new Float32Array([0.1, 0.2, 0.3]),
      createdAt: new Date(),
      accessCount: 5,
    });

    memorySystem.working.set('key', 'value');

    const stats = memorySystem.getStats();
    expect(stats.shortTerm).toBe(2);
    expect(stats.longTerm).toBe(1);
    expect(stats.working).toBe(1);
    expect(stats.semantic).toBe(0);
  });
});
