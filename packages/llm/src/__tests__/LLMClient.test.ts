/**
 * LLMClient 测试脚本
 * 
 * 测试内容：
 * 1. 基础对话能力 (chat)
 * 2. 流式对话能力 (stream, streamText)
 * 3. Tool Calling (Function Calling)
 * 4. 推理能力配置 (reasoning)
 * 5. 多模型兼容性测试
 * 6. 辅助方法 (buildAssistantMessage, buildToolResultMessage)
 * 
 * 使用说明：
 * 1. 在 .env 文件中配置：
 *    OPENAI_API_KEY=your-key
 *    OPENAI_BASE_URL=your-litellm-url
 * 2. 默认使用 anthropic/claude-sonnet-4.5
 * 3. 通过命令行参数指定模型：OPENAI_MODEL=google/gemini-2.5-pro tsx src/__tests__/LLMClient.test.ts
 */

import { LLMClient } from '../LLMClient';
import { tool } from 'ai';
import { z } from 'zod';
import type { ModelMessage } from 'ai';
import { initEnv, printEnvHelp } from '@monkey-agent/utils';

// ============================================
// 环境检查
// ============================================

// 加载并验证环境变量
const validation = initEnv();
if (!validation.valid) {
  console.error('\n❌ 错误: 未找到 API Key');
  console.error(validation.error);
  printEnvHelp();
  process.exit(1);
}

// 获取配置
const apiKey = validation.apiKey;
const provider = validation.provider;
const baseURL = process.env.OPENAI_BASE_URL || 
  (process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : 
  (provider === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1'));
const model = process.env.OPENAI_MODEL|| process.env.OPENROUTER_MODEL  || 
  process.env.ANTHROPIC_MODEL || 'anthropic/claude-4.5-sonnet';

console.log('\n🤖 LLMClient 测试');
console.log('='.repeat(60));
console.log(`📡 Base URL: ${baseURL}`);
console.log(`🎯 模型: ${model}`);
console.log('='.repeat(60));

// ============================================
// 工具定义
// ============================================

/**
 * 天气查询工具
 */
const getWeatherTool = tool({
  description: '查询指定城市的天气信息',
  inputSchema: z.object({
    city: z.string().describe('城市名称，例如：北京、上海、纽约'),
    unit: z.enum(['celsius', 'fahrenheit']).describe('温度单位').default('celsius'),
  }),
  execute: async ({ city, unit }) => {
    // 模拟 API 调用延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 模拟天气数据
    const weatherData: Record<string, any> = {
      '北京': { temp: 15, conditions: '晴朗', humidity: 45 },
      '上海': { temp: 22, conditions: '多云', humidity: 65 },
      '纽约': { temp: 18, conditions: '阴天', humidity: 55 },
      'New York': { temp: 18, conditions: 'Cloudy', humidity: 55 },
      'Paris': { temp: 16, conditions: 'Rainy', humidity: 70 },
      '巴黎': { temp: 16, conditions: '小雨', humidity: 70 },
    };
    
    const data = weatherData[city] || { temp: 20, conditions: '未知', humidity: 50 };
    
    // 转换温度单位
    if (unit === 'fahrenheit') {
      data.temp = Math.round(data.temp * 9 / 5 + 32);
    }
    
    return {
      city,
      temperature: data.temp,
      conditions: data.conditions,
      humidity: data.humidity,
      unit: unit as string,
    };
  },
});

/**
 * 计算器工具
 */
const calculatorTool = tool({
  description: '执行数学计算',
  inputSchema: z.object({
    expression: z.string().describe('数学表达式，例如：2 + 2, 10 * 5'),
  }),
  execute: async ({ expression }) => {
    try {
      // 简单的安全计算（仅用于演示）
      const result = Function(`"use strict"; return (${expression})`)();
      return { expression, result };
    } catch (error) {
      return { expression, error: '计算错误' };
    }
  },
});

// ============================================
// 测试用例
// ============================================

/**
 * 测试 1: 基础对话
 */
async function testBasicChat(client: LLMClient, testName: string) {
  console.log(`\n📝 [${testName}] 测试 1: 基础对话`);
  console.log('-'.repeat(60));
  
  try {
    const messages: ModelMessage[] = [
      { role: 'user', content: '你好！请用一句话介绍你自己。' },
    ];
    
    const result = await client.chat(messages);
    
    console.log(`✅ 响应: ${result.text}`);
    console.log(`📊 Token 使用: ${result.usage.totalTokens}`);
    console.log(`🏁 结束原因: ${result.finishReason}`);
    
    return true;
  } catch (error: any) {
    console.error(`❌ 失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试 2: 流式对话 (使用 stream 方法)
 */
async function testStreamWithFullResult(client: LLMClient, testName: string) {
  console.log(`\n🌊 [${testName}] 测试 2: 流式对话 (stream 方法)`);
  console.log('-'.repeat(60));
  
  try {
    const messages: ModelMessage[] = [
      { role: 'user', content: '用三句话介绍 TypeScript 的优势。' },
    ];
    
    const result = client.stream(messages);
    
    // 使用 textStream
    process.stdout.write('📤 流式输出: ');
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
    }
    console.log('\n');
    
    // 等待完成并获取统计信息
    const usage = await result.usage;
    const finishReason = await result.finishReason;
    
    console.log(`📊 Token 使用: ${usage.totalTokens}`);
    console.log(`🏁 结束原因: ${finishReason}`);
    
    return true;
  } catch (error: any) {
    console.error(`\n❌ 失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试 3: 流式对话 (使用 streamText 便捷方法)
 */
async function testStreamText(client: LLMClient, testName: string) {
  console.log(`\n🌊 [${testName}] 测试 3: 流式对话 (streamText 便捷方法)`);
  console.log('-'.repeat(60));
  
  try {
    const messages: ModelMessage[] = [
      { role: 'user', content: '列举三个编程语言及其特点。' },
    ];
    
    process.stdout.write('📤 流式输出: ');
    for await (const chunk of client.streamText(messages)) {
      process.stdout.write(chunk);
    }
    console.log('\n✅ 完成');
    
    return true;
  } catch (error: any) {
    console.error(`\n❌ 失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试 4: Tool Calling - 单个工具
 */
async function testSingleToolCall(client: LLMClient, testName: string) {
  console.log(`\n🔧 [${testName}] 测试 4: Tool Calling - 单个工具`);
  console.log('-'.repeat(60));
  
  try {
    const messages: ModelMessage[] = [
      { role: 'user', content: '北京今天天气怎么样？' },
    ];
    
    const result = await client.chat(messages, {
      tools: { getWeather: getWeatherTool },
      maxSteps: 5,
    });
    
    console.log(`✅ 响应: ${result.text}`);
    console.log(`📊 工具调用次数: ${result.toolCalls?.length || 0}`);
    
    if (result.toolCalls && result.toolCalls.length > 0) {
      console.log(`🔧 调用的工具: ${result.toolCalls.map(tc => tc.toolName).join(', ')}`);
    }
    
    return true;
  } catch (error: any) {
    console.error(`❌ 失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试 5: Tool Calling - 多个工具并行
 */
async function testMultipleToolCalls(client: LLMClient, testName: string) {
  console.log(`\n🔧 [${testName}] 测试 5: Tool Calling - 多个工具并行`);
  console.log('-'.repeat(60));
  
  try {
    const messages: ModelMessage[] = [
      { role: 'user', content: '请告诉我北京和上海的天气，然后计算它们的平均温度。' },
    ];
    
    const result = await client.chat(messages, {
      tools: { 
        getWeather: getWeatherTool,
        calculator: calculatorTool,
      },
      maxSteps: 10,
    });
    
    console.log(`✅ 响应: ${result.text}`);
    console.log(`📊 工具调用次数: ${result.toolCalls?.length || 0}`);
    
    if (result.toolCalls && result.toolCalls.length > 0) {
      console.log(`🔧 调用的工具: ${result.toolCalls.map(tc => tc.toolName).join(', ')}`);
    }
    
    return true;
  } catch (error: any) {
    console.error(`❌ 失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试 6: 系统提示词
 */
async function testSystemPrompt(client: LLMClient, testName: string) {
  console.log(`\n📋 [${testName}] 测试 6: 系统提示词`);
  console.log('-'.repeat(60));
  
  try {
    const messages: ModelMessage[] = [
      { role: 'user', content: '介绍一下你自己' },
    ];
    
    const result = await client.chat(messages, {
      system: '你是一个专业的天气播报员，总是用诗意的语言描述天气。',
    });
    
    console.log(`✅ 响应: ${result.text}`);
    
    return true;
  } catch (error: any) {
    console.error(`❌ 失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试 7: 多轮对话
 */
async function testMultiTurnConversation(client: LLMClient, testName: string) {
  console.log(`\n💬 [${testName}] 测试 7: 多轮对话`);
  console.log('-'.repeat(60));
  
  try {
    // 第一轮 - 简单对话
    let messages: ModelMessage[] = [
      { role: 'user', content: '你好，请用一句话介绍北京' },
    ];
    
    const result1 = await client.chat(messages);
    console.log(`🤖 第一轮: ${result1.text.substring(0, 50)}...`);
    
    // 添加助手响应到历史
    messages = [
      ...messages,
      { 
        role: 'assistant' as const, 
        content: result1.text
      }
    ];
    
    // 第二轮
    messages.push({ role: 'user' as const, content: '那上海呢？也用一句话介绍' });
    
    const result2 = await client.chat(messages);
    console.log(`🤖 第二轮: ${result2.text.substring(0, 50)}...`);
    
    // 第三轮
    messages.push({ 
      role: 'assistant' as const, 
      content: result2.text
    });
    messages.push({ role: 'user' as const, content: '哪个城市更大？' });
    
    const result3 = await client.chat(messages);
    console.log(`🤖 第三轮: ${result3.text.substring(0, 50)}...`);
    console.log('✅ 多轮对话测试通过');
    
    return true;
  } catch (error: any) {
    console.error(`❌ 失败:`, error.message || error);
    return false;
  }
}

// ============================================
// 主测试函数
// ============================================

/**
 * 运行所有测试
 */
async function runAllTests(model: string) {
  const testName = model.replace(/\//g, '-');
  
  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`🧪 开始测试模型: ${model}`);
  console.log('='.repeat(60));
  
  // 创建 LLM 客户端
  const client = new LLMClient({
    provider: 'openai',
    apiKey: apiKey!,
    baseURL,
    model,
    maxTokens: 2000,
  });
  
  const tests = [
    { name: '基础对话', fn: testBasicChat },
    { name: '流式对话 (stream)', fn: testStreamWithFullResult },
    { name: '流式对话 (streamText)', fn: testStreamText },
    { name: 'Tool Calling - 单个工具', fn: testSingleToolCall },
    { name: 'Tool Calling - 多个工具', fn: testMultipleToolCalls },
    { name: '系统提示词', fn: testSystemPrompt },
    { name: '多轮对话', fn: testMultiTurnConversation },
  ];
  
  const results: { name: string; success: boolean }[] = [];
  
  for (const test of tests) {
    try {
      const success = await test.fn(client, testName);
      results.push({ name: test.name, success });
      
      // 测试之间的延迟，避免 API 限流
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`\n❌ 测试 "${test.name}" 异常: ${error.message}`);
      results.push({ name: test.name, success: false });
    }
  }
  
  // 打印汇总
  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`📊 ${model} 测试结果汇总`);
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
  });
  
  console.log('-'.repeat(60));
  console.log(`通过: ${passed}/${results.length} | 失败: ${failed}/${results.length}`);
  console.log('='.repeat(60));
  
  return { passed, failed, total: results.length };
}

// ============================================
// 程序入口
// ============================================

async function main() {
  try {
    await runAllTests(model);
    console.log('\n✅ 测试完成！\n');
  } catch (error: any) {
    console.error(`\n❌ 测试失败: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行测试
main();
