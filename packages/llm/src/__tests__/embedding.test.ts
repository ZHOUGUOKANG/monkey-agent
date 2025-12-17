/**
 * Embedding 功能测试
 * 
 * 测试 LLMClient 的 embedding 支持
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { LLMClient } from '../LLMClient';
import { initEnv, printEnvHelp } from '@monkey-agent/utils';

// 全局变量
let OPENAI_API_KEY: string | undefined;

// 初始化环境变量
beforeAll(() => {
  const validation = initEnv({ 
    verbose: false,
    envPath: '../../.env'  // 相对于 packages/llm，指向项目根目录
  });
  
  if (!validation.valid || validation.provider !== 'openai') {
    console.error('错误: 需要 OpenAI API Key 来运行 embedding 测试');
    if (!validation.valid) {
      console.error(validation.error);
    }
    printEnvHelp();
    throw new Error('需要 OpenAI API Key');
  }
  
  OPENAI_API_KEY = validation.apiKey;
});

describe('LLMClient Embedding 功能', () => {
  test('单个文本 embedding', async () => {
    const client = new LLMClient({
      provider: 'openai',
      apiKey: OPENAI_API_KEY,
      model: 'gpt-4o', // 明确指定模型
    });

    const result = await client.embed('sunny day at the beach', {
      model: 'text-embedding-3-small', // 明确指定 embedding 模型
    });
    
    expect(result.embedding).toBeDefined();
    expect(result.embedding.length).toBeGreaterThan(0);
    expect(result.usage.tokens).toBeGreaterThan(0);
    expect(result.value).toBe('sunny day at the beach');
    
    console.log('✅ Embed 成功');
    console.log(`- Embedding 维度: ${result.embedding.length}`);
    console.log(`- Token 使用: ${result.usage.tokens}`);
  });

  test('批量文本 embedding', async () => {
    const client = new LLMClient({
      provider: 'openai',
      apiKey: OPENAI_API_KEY,
      model: 'gpt-4o', // 明确指定模型
    });

    const values = [
      'sunny day at the beach',
      'rainy afternoon in the city',
      'snowy night in the mountains',
    ];

    const result = await client.embedMany(values, {
      model: 'text-embedding-3-small', // 明确指定 embedding 模型
      maxParallelCalls: 2,
    });
    
    expect(result.embeddings).toBeDefined();
    expect(result.embeddings.length).toBe(3);
    expect(result.embeddings[0].length).toBeGreaterThan(0);
    expect(result.usage.tokens).toBeGreaterThan(0);
    expect(result.values).toEqual(values);
    
    console.log('✅ EmbedMany 成功');
    console.log(`- 文本数量: ${result.embeddings.length}`);
    console.log(`- Token 使用: ${result.usage.tokens}`);
  });

  test('余弦相似度计算', async () => {
    const client = new LLMClient({
      provider: 'openai',
      apiKey: OPENAI_API_KEY,
      model: 'gpt-4o', // 明确指定模型
    });

    const result = await client.embedMany([
      'sunny day at the beach',
      'rainy afternoon in the city',
    ], {
      model: 'text-embedding-3-small', // 明确指定 embedding 模型
    });

    const similarity = client.cosineSimilarity(
      result.embeddings[0],
      result.embeddings[1]
    );
    
    expect(similarity).toBeGreaterThanOrEqual(-1);
    expect(similarity).toBeLessThanOrEqual(1);
    
    console.log('✅ 相似度计算成功');
    console.log(`- 余弦相似度: ${similarity.toFixed(4)}`);
  });
});

// 可选的高级测试（需要真实 OpenAI API）
describe.skip('LLMClient Embedding 高级功能（需要真实 OpenAI API）', () => {
  test('自定义 embedding 模型', async () => {
    const client = new LLMClient({
      provider: 'openai',
      apiKey: OPENAI_API_KEY,
      model: 'gpt-4o', // 明确指定模型
    });

    const result = await client.embed('sunny day at the beach', {
      model: 'text-embedding-3-large',
    });
    
    expect(result.embedding).toBeDefined();
    expect(result.embedding.length).toBeGreaterThan(0);
    
    console.log('✅ 自定义模型成功');
    console.log(`- Embedding 维度: ${result.embedding.length}`);
  });

  test('Provider 选项配置', async () => {
    const client = new LLMClient({
      provider: 'openai',
      apiKey: OPENAI_API_KEY,
      model: 'gpt-4o', // 明确指定模型
    });

    const result = await client.embed('sunny day at the beach', {
      model: 'text-embedding-3-small',
      providerOptions: {
        openai: {
          dimensions: 512, // 减少到 512 维
        },
      },
    });
    
    expect(result.embedding).toBeDefined();
    expect(result.embedding.length).toBe(512);
    
    console.log('✅ Provider 选项成功');
    console.log(`- Embedding 维度: ${result.embedding.length}`);
  });
});
