/**
 * Embedding 功能测试
 * 
 * 测试 LLMClient 的 embedding 支持
 */

import { LLMClient } from '../LLMClient';
import { initEnv, printEnvHelp } from '@monkey-agent/utils';

// 初始化环境变量（指定 .env 路径为项目根目录）
const validation = initEnv({ 
  verbose: false,
  envPath: '.env'  // 相对于 cwd（项目根目录）
});
if (!validation.valid || validation.provider !== 'openai') {
  console.error('错误: 需要 OpenAI API Key 来运行 embedding 测试');
  if (!validation.valid) {
    console.error(validation.error);
  }
  printEnvHelp();
  process.exit(1);
}

// 从环境变量获取 API key
const OPENAI_API_KEY = validation.apiKey;

async function testEmbed() {
  console.log('\n========== 测试单个 Embedding ==========');
  
  const client = new LLMClient({
    provider: 'openai',
    apiKey: OPENAI_API_KEY,
  });

  try {
    const result = await client.embed('sunny day at the beach');
    
    console.log('✅ Embed 成功');
    console.log(`- Embedding 维度: ${result.embedding.length}`);
    console.log(`- Token 使用: ${result.usage.tokens}`);
    console.log(`- 前 5 个值: [${result.embedding.slice(0, 5).join(', ')}]`);
    console.log(`- 原始值: "${result.value}"`);
    
    // 获取模型信息（如果有）
    const model = result.response?.model || 'text-embedding-3-small (默认)';
    console.log(`- 模型: ${model}`);
    
    return result;
  } catch (error) {
    console.error('❌ Embed 失败:', error);
    throw error;
  }
}

async function testEmbedMany() {
  console.log('\n========== 测试批量 Embedding ==========');
  
  const client = new LLMClient({
    provider: 'openai',
    apiKey: OPENAI_API_KEY,
  });

  const values = [
    'sunny day at the beach',
    'rainy afternoon in the city',
    'snowy night in the mountains',
  ];

  try {
    const result = await client.embedMany(values, {
      maxParallelCalls: 2,
    });
    
    console.log('✅ EmbedMany 成功');
    console.log(`- 文本数量: ${result.embeddings.length}`);
    console.log(`- Embedding 维度: ${result.embeddings[0].length}`);
    console.log(`- Token 使用: ${result.usage.tokens}`);
    
    result.values.forEach((value, i) => {
      console.log(`- 文本 ${i + 1}: "${value}"`);
    });
    
    return result;
  } catch (error) {
    console.error('❌ EmbedMany 失败:', error);
    throw error;
  }
}

async function testCosineSimilarity() {
  console.log('\n========== 测试余弦相似度 ==========');
  
  const client = new LLMClient({
    provider: 'openai',
    apiKey: OPENAI_API_KEY,
  });

  try {
    const result = await client.embedMany([
      'sunny day at the beach',
      'rainy afternoon in the city',
    ]);

    const similarity = client.cosineSimilarity(
      result.embeddings[0],
      result.embeddings[1]
    );
    
    console.log('✅ 相似度计算成功');
    console.log(`- 文本 1: "${result.values[0]}"`);
    console.log(`- 文本 2: "${result.values[1]}"`);
    console.log(`- 余弦相似度: ${similarity.toFixed(4)}`);
    
    return similarity;
  } catch (error) {
    console.error('❌ 相似度计算失败:', error);
    throw error;
  }
}

async function testCustomModel() {
  console.log('\n========== 测试自定义 Embedding 模型 ==========');
  
  const client = new LLMClient({
    provider: 'openai',
    apiKey: OPENAI_API_KEY,
  });

  try {
    // 使用更大的 embedding 模型
    const result = await client.embed('sunny day at the beach', {
      model: 'text-embedding-3-large',
    });
    
    console.log('✅ 自定义模型成功');
    console.log(`- Embedding 维度: ${result.embedding.length}`);
    console.log(`- Token 使用: ${result.usage.tokens}`);
    
    return result;
  } catch (error) {
    console.error('❌ 自定义模型失败:', error);
    throw error;
  }
}

async function testProviderOptions() {
  console.log('\n========== 测试 Provider 选项 ==========');
  
  const client = new LLMClient({
    provider: 'openai',
    apiKey: OPENAI_API_KEY,
  });

  try {
    // 使用 providerOptions 减少 embedding 维度
    const result = await client.embed('sunny day at the beach', {
      model: 'text-embedding-3-small',
      providerOptions: {
        openai: {
          dimensions: 512, // 减少到 512 维
        },
      },
    });
    
    console.log('✅ Provider 选项成功');
    console.log(`- Embedding 维度: ${result.embedding.length}`);
    console.log(`- Token 使用: ${result.usage.tokens}`);
    
    return result;
  } catch (error) {
    console.error('❌ Provider 选项失败:', error);
    throw error;
  }
}

async function main() {
  console.log('开始测试 LLMClient Embedding 功能...');
  
  try {
    await testEmbed();
    await testEmbedMany();
    await testCosineSimilarity();
    
    // 注意：以下测试需要真实的 OpenAI API（不是 LiteLLM 代理）
    // 如果使用 LiteLLM 代理，这些测试可能会失败
    // await testCustomModel();  // 需要支持 text-embedding-3-large
    // await testProviderOptions();  // 需要支持 dimensions 参数
    
    console.log('\n========================================');
    console.log('✅ 所有测试通过！');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ 测试失败');
    process.exit(1);
  }
}

// 直接运行测试（如果是主模块）
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  testEmbed,
  testEmbedMany,
  testCosineSimilarity,
  testCustomModel,
  testProviderOptions,
};
