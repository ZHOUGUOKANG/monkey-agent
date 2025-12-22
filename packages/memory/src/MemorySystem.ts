import { Memory } from '@monkey-agent/types';
import { VectorStorage } from './vector';

/**
 * 短期记忆
 * 
 * 存储最近的记忆，使用 FIFO 策略。
 * 当达到容量上限时，自动删除最旧的记忆。
 */
export class ShortTermMemory {
  private memories: Map<string, Memory> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  add(memory: Memory): void {
    if (this.memories.size >= this.maxSize) {
      // 删除最旧的记忆
      const firstKey = this.memories.keys().next().value;
      if (firstKey) {
        this.memories.delete(firstKey);
      }
    }
    this.memories.set(memory.id, memory);
  }

  get(id: string): Memory | undefined {
    const memory = this.memories.get(id);
    if (memory) {
      // 更新访问次数
      memory.accessCount = (memory.accessCount || 0) + 1;
    }
    return memory;
  }

  getRecent(limit: number = 10): Memory[] {
    return Array.from(this.memories.values()).slice(-limit);
  }

  getAll(): Memory[] {
    return Array.from(this.memories.values());
  }

  clear(): void {
    this.memories.clear();
  }

  size(): number {
    return this.memories.size;
  }
}

/**
 * 长期记忆
 * 
 * 使用向量存储实现语义搜索。
 * 记忆必须包含 embedding 才能被存储。
 */
export class LongTermMemory {
  private vectorStorage?: VectorStorage;
  private memories: Map<string, Memory> = new Map();

  constructor(vectorStorage?: VectorStorage) {
    this.vectorStorage = vectorStorage;
  }

  async add(memory: Memory): Promise<void> {
    // 存储到内存中
    this.memories.set(memory.id, memory);

    // 如果有向量存储且记忆包含 embedding，则存储到向量库
    if (this.vectorStorage && memory.embedding) {
      await this.vectorStorage.insert({
        id: memory.id,
        vector: memory.embedding,
        metadata: {
          type: memory.type,
          content: memory.content,
          createdAt: memory.createdAt,
          accessCount: memory.accessCount,
          ...memory.metadata,
        },
      });
    }
  }

  async get(id: string): Promise<Memory | undefined> {
    const memory = this.memories.get(id);
    if (memory) {
      // 更新访问次数
      memory.accessCount = (memory.accessCount || 0) + 1;
    }
    return memory;
  }

  async search(queryEmbedding: Float32Array, limit: number = 10, threshold: number = 0.7): Promise<Memory[]> {
    if (!this.vectorStorage) {
      // 如果没有向量存储，返回最近的记忆
      const allMemories = Array.from(this.memories.values());
      return allMemories.slice(-limit);
    }

    // 使用向量搜索
    const results = await this.vectorStorage.search({
      vector: queryEmbedding,
      limit,
      threshold,
    });

    // 根据搜索结果返回完整的记忆对象
    const memories: Memory[] = [];
    for (const result of results) {
      const memory = this.memories.get(result.id);
      if (memory) {
        // 更新访问次数
        memory.accessCount = (memory.accessCount || 0) + 1;
        memories.push(memory);
      }
    }

    return memories;
  }

  async delete(id: string): Promise<void> {
    this.memories.delete(id);
    if (this.vectorStorage) {
      await this.vectorStorage.delete(id);
    }
  }

  async clear(): Promise<void> {
    this.memories.clear();
    if (this.vectorStorage) {
      await this.vectorStorage.clear();
    }
  }

  getAll(): Memory[] {
    return Array.from(this.memories.values());
  }

  size(): number {
    return this.memories.size;
  }
}

/**
 * 工作记忆
 * 
 * 存储当前任务的上下文信息。
 */
export class WorkingMemory {
  private context: Map<string, any> = new Map();

  set(key: string, value: any): void {
    this.context.set(key, value);
  }

  get(key: string): any {
    return this.context.get(key);
  }

  has(key: string): boolean {
    return this.context.has(key);
  }

  delete(key: string): boolean {
    return this.context.delete(key);
  }

  clear(): void {
    this.context.clear();
  }

  getAll(): Record<string, any> {
    return Object.fromEntries(this.context);
  }

  keys(): string[] {
    return Array.from(this.context.keys());
  }

  size(): number {
    return this.context.size;
  }
}

/**
 * 语义记忆（知识库）
 * 
 * 存储领域知识和概念性信息。
 */
export class SemanticMemory {
  private knowledge: Map<string, any> = new Map();
  private vectorStorage?: VectorStorage;

  constructor(vectorStorage?: VectorStorage) {
    this.vectorStorage = vectorStorage;
  }

  async store(key: string, value: any, embedding?: Float32Array): Promise<void> {
    this.knowledge.set(key, value);

    // 如果提供了 embedding 和向量存储，则存储到向量库
    if (this.vectorStorage && embedding) {
      await this.vectorStorage.insert({
        id: key,
        vector: embedding,
        metadata: { value },
      });
    }
  }

  async retrieve(key: string): Promise<any> {
    return this.knowledge.get(key);
  }

  async search(queryEmbedding: Float32Array, limit: number = 10, threshold: number = 0.7): Promise<any[]> {
    if (!this.vectorStorage) {
      // 如果没有向量存储，返回所有知识的前 N 项
      return Array.from(this.knowledge.values()).slice(0, limit);
    }

    // 使用向量搜索
    const results = await this.vectorStorage.search({
      vector: queryEmbedding,
      limit,
      threshold,
    });

    // 返回搜索结果
    return results.map(r => ({
      key: r.id,
      value: this.knowledge.get(r.id),
      score: r.score,
      metadata: r.metadata,
    }));
  }

  async delete(key: string): Promise<void> {
    this.knowledge.delete(key);
    if (this.vectorStorage) {
      await this.vectorStorage.delete(key);
    }
  }

  async clear(): Promise<void> {
    this.knowledge.clear();
    if (this.vectorStorage) {
      await this.vectorStorage.clear();
    }
  }

  getAll(): Map<string, any> {
    return new Map(this.knowledge);
  }

  size(): number {
    return this.knowledge.size;
  }
}

/**
 * 记忆系统配置
 */
export interface MemorySystemConfig {
  shortTermMaxSize?: number;
  longTermVectorStorage?: VectorStorage;
  semanticVectorStorage?: VectorStorage;
  importanceThreshold?: number;
}

/**
 * 记忆系统
 * 
 * 整合多种记忆类型，提供统一的记忆管理接口。
 */
export class MemorySystem {
  public shortTerm: ShortTermMemory;
  public longTerm: LongTermMemory;
  public working: WorkingMemory;
  public semantic: SemanticMemory;
  
  private importanceThreshold: number;

  constructor(config: MemorySystemConfig = {}) {
    this.shortTerm = new ShortTermMemory(config.shortTermMaxSize);
    this.longTerm = new LongTermMemory(config.longTermVectorStorage);
    this.working = new WorkingMemory();
    this.semantic = new SemanticMemory(config.semanticVectorStorage);
    this.importanceThreshold = config.importanceThreshold ?? 3;
  }

  /**
   * 记录新记忆
   */
  async remember(memory: Memory): Promise<void> {
    // 添加到短期记忆
    this.shortTerm.add(memory);

    // 重要的记忆添加到长期记忆
    if (this.isImportant(memory)) {
      await this.longTerm.add(memory);
    }
  }

  /**
   * 检索相关记忆
   * 
   * @param queryEmbedding - 查询的向量表示
   * @param limit - 返回结果数量
   * @param threshold - 相似度阈值
   */
  async recall(
    queryEmbedding: Float32Array,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<Memory[]> {
    // 从长期记忆搜索
    const longTermResults = await this.longTerm.search(queryEmbedding, limit, threshold);
    
    // 从短期记忆获取最近的记忆
    const recentMemories = this.shortTerm.getRecent(Math.min(limit, 5));
    
    // 合并去重
    const allMemories = [...longTermResults, ...recentMemories];
    const uniqueMemories = Array.from(
      new Map(allMemories.map((m) => [m.id, m])).values()
    );
    
    // 按访问次数和时间排序
    uniqueMemories.sort((a, b) => {
      const scoreA = (a.accessCount || 0) * 0.7 + (a.createdAt.getTime() / 1000000000);
      const scoreB = (b.accessCount || 0) * 0.7 + (b.createdAt.getTime() / 1000000000);
      return scoreB - scoreA;
    });
    
    return uniqueMemories.slice(0, limit);
  }

  /**
   * 根据 ID 获取记忆
   */
  async get(id: string): Promise<Memory | undefined> {
    // 先从短期记忆查找
    let memory = this.shortTerm.get(id);
    if (memory) return memory;

    // 再从长期记忆查找
    return await this.longTerm.get(id);
  }

  /**
   * 删除记忆
   */
  async forget(id: string): Promise<void> {
    await this.longTerm.delete(id);
    // 短期记忆会自动过期，不需要手动删除
  }

  /**
   * 清空所有记忆
   */
  async clear(): Promise<void> {
    this.shortTerm.clear();
    await this.longTerm.clear();
    this.working.clear();
    await this.semantic.clear();
  }

  /**
   * 判断记忆是否重要
   */
  private isImportant(memory: Memory): boolean {
    // 策略1：访问次数超过阈值
    if ((memory.accessCount || 0) >= this.importanceThreshold) {
      return true;
    }

    // 策略2：元数据标记为重要
    if (memory.metadata?.important === true) {
      return true;
    }

    // 策略3：长期记忆类型
    if (memory.type === 'long-term') {
      return true;
    }

    return false;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    shortTerm: number;
    longTerm: number;
    working: number;
    semantic: number;
  } {
    return {
      shortTerm: this.shortTerm.size(),
      longTerm: this.longTerm.size(),
      working: this.working.size(),
      semantic: this.semantic.size(),
    };
  }
}
