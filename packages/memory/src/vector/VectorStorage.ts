/**
 * 向量存储接口
 */

/**
 * 向量项
 */
export interface VectorItem {
  id: string;
  vector: Float32Array;
  metadata?: any;
}

/**
 * 搜索结果
 */
export interface SearchResult {
  id: string;
  score: number;
  metadata?: any;
}

/**
 * 向量存储接口
 */
export interface VectorStorage {
  /**
   * 插入单个向量
   */
  insert(item: {
    id: string;
    vector: Float32Array;
    metadata?: any;
  }): Promise<void>;

  /**
   * 向量搜索
   */
  search(query: {
    vector: Float32Array;
    limit?: number;
    threshold?: number;
  }): Promise<SearchResult[]>;

  /**
   * 删除向量
   */
  delete(id: string): Promise<void>;

  /**
   * 清空所有数据
   */
  clear(): Promise<void>;
}

/**
 * 向量存储配置
 */
export interface VectorStorageConfig {
  type: 'sqlite-vec' | 'milvus' | 'pgvector';
  
  // SQLite-vec 配置
  path?: string;
  
  // Milvus 配置
  address?: string;
  collection?: string;
  dimension?: number;
  
  // pgvector 配置
  connectionString?: string;
  tableName?: string;
}

/**
 * 创建向量存储实例
 */
export async function createVectorStorage(config: VectorStorageConfig): Promise<VectorStorage> {
  switch (config.type) {
    case 'sqlite-vec': {
      const { SqliteVecStorage } = await import('./SqliteVecStorage');
      const storage = new SqliteVecStorage(config.path);
      await storage.init();
      return storage;
    }
    case 'milvus': {
      const { MilvusStorage } = await import('./MilvusStorage');
      return new MilvusStorage({
        address: config.address!,
        collection: config.collection!,
        dimension: config.dimension!,
      });
    }
    case 'pgvector': {
      const { PgVectorStorage } = await import('./PgVectorStorage');
      const storage = new PgVectorStorage({
        connectionString: config.connectionString!,
        tableName: config.tableName || 'vectors',
        dimension: config.dimension!,
      });
      await storage.init();
      return storage;
    }
    default:
      throw new Error(`Unsupported vector storage type: ${(config as any).type}`);
  }
}
