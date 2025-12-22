import { VectorStorage, SearchResult, VectorItem } from './VectorStorage';

/**
 * 计算余弦相似度
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

export interface MilvusConfig {
  address: string;
  collection: string;
  dimension: number;
  username?: string;
  password?: string;
  token?: string;
}

/**
 * Milvus 存储实现
 * 
 * 这是一个 Mock 实现，用于开发和测试。
 * 生产环境中需要安装 @zilliz/milvus2-sdk-node 并实现真实的 Milvus 连接。
 * 
 * 真实实现示例：
 * ```typescript
 * import { MilvusClient } from '@zilliz/milvus2-sdk-node';
 * 
 * const client = new MilvusClient({
 *   address: config.address,
 *   username: config.username,
 *   password: config.password,
 * });
 * 
 * await client.createCollection({
 *   collection_name: config.collection,
 *   fields: [
 *     { name: 'id', data_type: DataType.VarChar, is_primary_key: true },
 *     { name: 'vector', data_type: DataType.FloatVector, dim: config.dimension },
 *     { name: 'metadata', data_type: DataType.JSON },
 *   ],
 * });
 * ```
 */
export class MilvusStorage implements VectorStorage {
  private config: MilvusConfig;
  private vectors: Map<string, VectorItem> = new Map();
  private initialized: boolean = false;

  constructor(config: MilvusConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    console.log(`[MilvusStorage] Initializing mock connection to ${this.config.address}`);
    console.log(`[MilvusStorage] Collection: ${this.config.collection}, Dimension: ${this.config.dimension}`);
    
    // 在真实实现中：
    // 1. 连接到 Milvus 服务器
    // 2. 检查集合是否存在
    // 3. 如果不存在，创建集合和索引
    
    this.vectors = new Map();
    this.initialized = true;
  }

  async insert(item: {
    id: string;
    vector: Float32Array;
    metadata?: any;
  }): Promise<void> {
    if (!this.initialized) await this.init();
    
    if (item.vector.length !== this.config.dimension) {
      throw new Error(
        `Vector dimension mismatch: expected ${this.config.dimension}, got ${item.vector.length}`
      );
    }

    // Mock 实现：存储到内存
    this.vectors.set(item.id, {
      id: item.id,
      vector: item.vector,
      metadata: item.metadata,
    });

    // 在真实实现中：
    // await this.client.insert({
    //   collection_name: this.config.collection,
    //   data: [{
    //     id: item.id,
    //     vector: Array.from(item.vector),
    //     metadata: item.metadata,
    //   }],
    // });
  }

  async insertMany(items: Array<{
    id: string;
    vector: Float32Array;
    metadata?: any;
  }>): Promise<void> {
    if (!this.initialized) await this.init();

    for (const item of items) {
      if (item.vector.length !== this.config.dimension) {
        throw new Error(
          `Vector dimension mismatch for ${item.id}: expected ${this.config.dimension}, got ${item.vector.length}`
        );
      }
    }

    // Mock 实现
    for (const item of items) {
      this.vectors.set(item.id, {
        id: item.id,
        vector: item.vector,
        metadata: item.metadata,
      });
    }

    // 在真实实现中：使用批量插入
    // await this.client.insert({
    //   collection_name: this.config.collection,
    //   data: items.map(item => ({
    //     id: item.id,
    //     vector: Array.from(item.vector),
    //     metadata: item.metadata,
    //   })),
    // });
  }

  async get(id: string): Promise<VectorItem | null> {
    if (!this.initialized) await this.init();
    
    return this.vectors.get(id) || null;

    // 在真实实现中：
    // const result = await this.client.query({
    //   collection_name: this.config.collection,
    //   filter: `id == "${id}"`,
    //   output_fields: ['id', 'vector', 'metadata'],
    // });
    // return result.data[0] || null;
  }

  async search(query: {
    vector: Float32Array;
    limit?: number;
    threshold?: number;
  }): Promise<SearchResult[]> {
    if (!this.initialized) await this.init();
    
    const limit = query.limit || 10;
    const threshold = query.threshold || 0;

    if (query.vector.length !== this.config.dimension) {
      throw new Error(
        `Query vector dimension mismatch: expected ${this.config.dimension}, got ${query.vector.length}`
      );
    }

    // Mock 实现：使用余弦相似度
    const results: SearchResult[] = [];
    
    for (const [id, item] of this.vectors.entries()) {
      const score = cosineSimilarity(query.vector, item.vector);
      
      if (score >= threshold) {
        results.push({
          id,
          score,
          metadata: item.metadata,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);

    // 在真实实现中：
    // const result = await this.client.search({
    //   collection_name: this.config.collection,
    //   vector: Array.from(query.vector),
    //   limit,
    //   metric_type: 'COSINE',
    //   params: { nprobe: 10 },
    //   output_fields: ['id', 'metadata'],
    // });
    // 
    // return result.results
    //   .filter(r => r.score >= threshold)
    //   .map(r => ({
    //     id: r.id,
    //     score: r.score,
    //     metadata: r.metadata,
    //   }));
  }

  async delete(id: string): Promise<void> {
    if (!this.initialized) await this.init();
    
    this.vectors.delete(id);

    // 在真实实现中：
    // await this.client.delete({
    //   collection_name: this.config.collection,
    //   filter: `id == "${id}"`,
    // });
  }

  async clear(): Promise<void> {
    if (!this.initialized) await this.init();
    
    this.vectors.clear();

    // 在真实实现中：
    // await this.client.dropCollection({
    //   collection_name: this.config.collection,
    // });
    // 
    // // 重新创建集合
    // await this.init();
  }

  async close(): Promise<void> {
    // 在真实实现中：
    // await this.client.close();
    this.initialized = false;
  }

  /**
   * 获取存储的向量数量
   */
  size(): number {
    return this.vectors.size;
  }
}
