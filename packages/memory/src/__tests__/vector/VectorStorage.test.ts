import { describe, it, expect, beforeEach } from 'vitest';
import { SqliteVecStorage } from '../../vector/SqliteVecStorage';
import { MilvusStorage } from '../../vector/MilvusStorage';
import { PgVectorStorage } from '../../vector/PgVectorStorage';
import { createVectorStorage } from '../../vector/VectorStorage';

describe('SqliteVecStorage', () => {
  let storage: SqliteVecStorage;

  beforeEach(async () => {
    storage = new SqliteVecStorage(':memory:');
    await storage.init();
  });

  it('应该能初始化存储', async () => {
    expect(storage).toBeDefined();
    expect(storage.size()).toBe(0);
  });

  it('应该能插入向量', async () => {
    await storage.insert({
      id: '1',
      vector: new Float32Array([0.1, 0.2, 0.3]),
      metadata: { text: 'test' },
    });

    expect(storage.size()).toBe(1);
    
    const item = await storage.get('1');
    expect(item).toBeDefined();
    expect(item?.id).toBe('1');
    expect(item?.vector).toEqual(new Float32Array([0.1, 0.2, 0.3]));
    expect(item?.metadata).toEqual({ text: 'test' });
  });

  it('应该能批量插入向量', async () => {
    await storage.insertMany([
      {
        id: '1',
        vector: new Float32Array([0.1, 0.2, 0.3]),
        metadata: { text: 'test1' },
      },
      {
        id: '2',
        vector: new Float32Array([0.4, 0.5, 0.6]),
        metadata: { text: 'test2' },
      },
    ]);

    expect(storage.size()).toBe(2);
  });

  it('应该能通过余弦相似度搜索向量', async () => {
    // 插入一些向量
    await storage.insert({
      id: '1',
      vector: new Float32Array([1.0, 0.0, 0.0]), // 完全在 x 轴
      metadata: { label: 'x-axis' },
    });

    await storage.insert({
      id: '2',
      vector: new Float32Array([0.9, 0.1, 0.0]), // 接近 x 轴
      metadata: { label: 'near-x' },
    });

    await storage.insert({
      id: '3',
      vector: new Float32Array([0.0, 1.0, 0.0]), // 完全在 y 轴
      metadata: { label: 'y-axis' },
    });

    // 搜索最接近 x 轴的向量
    const results = await storage.search({
      vector: new Float32Array([0.95, 0.05, 0.0]),
      limit: 2,
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe('1'); // x-axis 应该是最相似的
    expect(results[1].id).toBe('2'); // near-x 应该是第二相似的
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('应该能使用阈值过滤搜索结果', async () => {
    await storage.insert({
      id: '1',
      vector: new Float32Array([1.0, 0.0, 0.0]),
    });

    await storage.insert({
      id: '2',
      vector: new Float32Array([0.0, 1.0, 0.0]),
    });

    // 使用高阈值搜索
    const results = await storage.search({
      vector: new Float32Array([1.0, 0.0, 0.0]),
      limit: 10,
      threshold: 0.9, // 只返回相似度 >= 0.9 的结果
    });

    expect(results.length).toBe(1); // 只有完全匹配的应该被返回
    expect(results[0].id).toBe('1');
  });

  it('应该能删除向量', async () => {
    await storage.insert({
      id: '1',
      vector: new Float32Array([0.1, 0.2, 0.3]),
    });

    expect(storage.size()).toBe(1);

    await storage.delete('1');
    expect(storage.size()).toBe(0);
    expect(await storage.get('1')).toBeNull();
  });

  it('应该能清空所有向量', async () => {
    await storage.insertMany([
      { id: '1', vector: new Float32Array([0.1, 0.2, 0.3]) },
      { id: '2', vector: new Float32Array([0.4, 0.5, 0.6]) },
      { id: '3', vector: new Float32Array([0.7, 0.8, 0.9]) },
    ]);

    expect(storage.size()).toBe(3);

    await storage.clear();
    expect(storage.size()).toBe(0);
  });

  it('应该正确计算余弦相似度', async () => {
    // 两个相同的向量
    await storage.insert({
      id: '1',
      vector: new Float32Array([1.0, 0.0, 0.0]),
    });

    const results1 = await storage.search({
      vector: new Float32Array([1.0, 0.0, 0.0]),
      limit: 1,
    });

    expect(results1[0].score).toBeCloseTo(1.0, 5); // 相似度应该是 1.0

    // 两个正交的向量
    await storage.clear();
    await storage.insert({
      id: '2',
      vector: new Float32Array([1.0, 0.0, 0.0]),
    });

    const results2 = await storage.search({
      vector: new Float32Array([0.0, 1.0, 0.0]),
      limit: 1,
    });

    expect(results2[0].score).toBeCloseTo(0.0, 5); // 相似度应该是 0.0
  });
});

describe('MilvusStorage', () => {
  let storage: MilvusStorage;

  beforeEach(async () => {
    storage = new MilvusStorage({
      address: 'localhost:19530',
      collection: 'test_collection',
      dimension: 3,
    });
    await storage.init();
  });

  it('应该能初始化存储', () => {
    expect(storage).toBeDefined();
  });

  it('应该能插入向量', async () => {
    await storage.insert({
      id: '1',
      vector: new Float32Array([0.1, 0.2, 0.3]),
      metadata: { text: 'test' },
    });

    expect(storage.size()).toBe(1);
  });

  it('应该验证向量维度', async () => {
    await expect(
      storage.insert({
        id: '1',
        vector: new Float32Array([0.1, 0.2]), // 维度不匹配
        metadata: { text: 'test' },
      })
    ).rejects.toThrow('Vector dimension mismatch');
  });

  it('应该能搜索向量', async () => {
    await storage.insert({
      id: '1',
      vector: new Float32Array([1.0, 0.0, 0.0]),
    });

    await storage.insert({
      id: '2',
      vector: new Float32Array([0.9, 0.1, 0.0]),
    });

    const results = await storage.search({
      vector: new Float32Array([0.95, 0.05, 0.0]),
      limit: 2,
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe('1');
  });

  it('应该在搜索时验证查询向量维度', async () => {
    await expect(
      storage.search({
        vector: new Float32Array([0.1, 0.2]), // 维度不匹配
        limit: 10,
      })
    ).rejects.toThrow('Query vector dimension mismatch');
  });

  it('应该能批量插入向量', async () => {
    await storage.insertMany([
      { id: '1', vector: new Float32Array([0.1, 0.2, 0.3]) },
      { id: '2', vector: new Float32Array([0.4, 0.5, 0.6]) },
    ]);

    expect(storage.size()).toBe(2);
  });

  it('批量插入时应该验证所有向量维度', async () => {
    await expect(
      storage.insertMany([
        { id: '1', vector: new Float32Array([0.1, 0.2, 0.3]) },
        { id: '2', vector: new Float32Array([0.4, 0.5]) }, // 维度不匹配
      ])
    ).rejects.toThrow('Vector dimension mismatch');
  });

  it('应该能删除向量', async () => {
    await storage.insert({
      id: '1',
      vector: new Float32Array([0.1, 0.2, 0.3]),
    });

    await storage.delete('1');
    expect(await storage.get('1')).toBeNull();
  });

  it('应该能清空所有向量', async () => {
    await storage.insertMany([
      { id: '1', vector: new Float32Array([0.1, 0.2, 0.3]) },
      { id: '2', vector: new Float32Array([0.4, 0.5, 0.6]) },
    ]);

    await storage.clear();
    expect(storage.size()).toBe(0);
  });
});

describe('PgVectorStorage', () => {
  let storage: PgVectorStorage;

  beforeEach(async () => {
    storage = new PgVectorStorage({
      connectionString: 'postgresql://localhost:5432/test',
      tableName: 'test_vectors',
      dimension: 3,
    });
    await storage.init();
  });

  it('应该能初始化存储', () => {
    expect(storage).toBeDefined();
  });

  it('应该能插入向量', async () => {
    await storage.insert({
      id: '1',
      vector: new Float32Array([0.1, 0.2, 0.3]),
      metadata: { text: 'test' },
    });

    // PgVector 是 mock 实现，这里主要测试不会抛出错误
    expect(true).toBe(true);
  });

  it('应该验证向量维度', async () => {
    await expect(
      storage.insert({
        id: '1',
        vector: new Float32Array([0.1, 0.2]), // 维度不匹配
        metadata: { text: 'test' },
      })
    ).rejects.toThrow('Vector dimension mismatch');
  });

  it('应该能批量插入向量', async () => {
    await storage.insertMany([
      { id: '1', vector: new Float32Array([0.1, 0.2, 0.3]) },
      { id: '2', vector: new Float32Array([0.4, 0.5, 0.6]) },
    ]);

    expect(true).toBe(true);
  });

  it('批量插入时应该验证所有向量维度', async () => {
    await expect(
      storage.insertMany([
        { id: '1', vector: new Float32Array([0.1, 0.2, 0.3]) },
        { id: '2', vector: new Float32Array([0.4, 0.5]) }, // 维度不匹配
      ])
    ).rejects.toThrow('Vector dimension mismatch');
  });

  it('应该能搜索向量', async () => {
    const results = await storage.search({
      vector: new Float32Array([0.1, 0.2, 0.3]),
      limit: 10,
    });

    expect(Array.isArray(results)).toBe(true);
  });

  it('应该在搜索时验证查询向量维度', async () => {
    await expect(
      storage.search({
        vector: new Float32Array([0.1, 0.2]), // 维度不匹配
        limit: 10,
      })
    ).rejects.toThrow('Query vector dimension mismatch');
  });

  it('应该能删除向量', async () => {
    await storage.delete('1');
    expect(true).toBe(true);
  });

  it('应该能清空所有向量', async () => {
    await storage.clear();
    expect(true).toBe(true);
  });
});

describe('createVectorStorage', () => {
  it('应该能创建 SqliteVecStorage', async () => {
    const storage = await createVectorStorage({
      type: 'sqlite-vec',
      path: ':memory:',
    });

    expect(storage).toBeInstanceOf(SqliteVecStorage);
  });

  it('应该能创建 MilvusStorage', async () => {
    const storage = await createVectorStorage({
      type: 'milvus',
      address: 'localhost:19530',
      collection: 'test',
      dimension: 128,
    });

    expect(storage).toBeInstanceOf(MilvusStorage);
  });

  it('应该能创建 PgVectorStorage', async () => {
    const storage = await createVectorStorage({
      type: 'pgvector',
      connectionString: 'postgresql://localhost:5432/test',
      tableName: 'vectors',
      dimension: 128,
    });

    expect(storage).toBeInstanceOf(PgVectorStorage);
  });

  it('应该在提供不支持的类型时抛出错误', async () => {
    await expect(
      createVectorStorage({
        type: 'unsupported' as any,
      })
    ).rejects.toThrow('Unsupported vector storage type');
  });
});
