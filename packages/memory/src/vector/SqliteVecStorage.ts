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

/**
 * SQLite-vec 存储实现
 * 
 * 这是一个简化的内存版本实现，用于开发和测试。
 * 生产环境中应该使用真实的 sqlite-vec 或其他向量数据库。
 * 
 * 特性：
 * - 内存存储，重启后数据丢失
 * - 使用余弦相似度进行向量搜索
 * - 支持元数据存储
 */
export class SqliteVecStorage implements VectorStorage {
  private vectors: Map<string, VectorItem> = new Map();
  private path: string;
  private initialized: boolean = false;

  constructor(path: string = '/agent-memory.db') {
    this.path = path;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    // 简化实现：使用内存存储
    // 生产环境中应该：
    // 1. 浏览器环境：使用 sql.js-httpvfs + OPFS 持久化
    // 2. Node.js 环境：使用 better-sqlite3 + sqlite-vec 扩展
    console.log(`[SqliteVecStorage] Initializing in-memory storage at ${this.path}`);
    
    this.vectors = new Map();
    this.initialized = true;
  }

  async insert(item: {
    id: string;
    vector: Float32Array;
    metadata?: any;
  }): Promise<void> {
    if (!this.initialized) await this.init();
    
    this.vectors.set(item.id, {
      id: item.id,
      vector: item.vector,
      metadata: item.metadata,
    });
  }

  async insertMany(items: Array<{
    id: string;
    vector: Float32Array;
    metadata?: any;
  }>): Promise<void> {
    if (!this.initialized) await this.init();
    
    for (const item of items) {
      await this.insert(item);
    }
  }

  async get(id: string): Promise<VectorItem | null> {
    if (!this.initialized) await this.init();
    
    return this.vectors.get(id) || null;
  }

  async search(query: {
    vector: Float32Array;
    limit?: number;
    threshold?: number;
  }): Promise<SearchResult[]> {
    if (!this.initialized) await this.init();
    
    const limit = query.limit || 10;
    const threshold = query.threshold || 0;

    // 计算所有向量的相似度
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

    // 按相似度降序排序
    results.sort((a, b) => b.score - a.score);

    // 返回前 N 个结果
    return results.slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    if (!this.initialized) await this.init();
    
    this.vectors.delete(id);
  }

  async clear(): Promise<void> {
    if (!this.initialized) await this.init();
    
    this.vectors.clear();
  }

  /**
   * 获取存储的向量数量
   */
  size(): number {
    return this.vectors.size;
  }
}
