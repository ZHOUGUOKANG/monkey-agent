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
 * 测试模型：
 * - anthropic/claude-sonnet-4.5 (默认)
 * - google/gemini-2.5-pro
 * - google/gemini-2.5-flash
 * - openai/gpt-4.1
 * - openai/gpt-4.1-mini
 * - openai/gpt-5
 * 
 * 使用说明：
 * 1. 在 .env 文件中配置：
 *    OPENAI_API_KEY=your-key
 *    OPENAI_BASE_URL=your-litellm-url
 * 2. 默认使用 anthropic/claude-sonnet-4.5
 * 3. 通过命令行参数指定模型：OPENAI_MODEL=google/gemini-2.5-pro yarn test:llm
 */

import { LLMClient } from '../llm/LLMClient';
import { initEnv, getLLMConfig, printEnvHelp } from '../utils/env-loader';
import { tool } from 'ai';
import { z } from 'zod';
import type { ModelMessage } from 'ai';

// ============================================
// 环境初始化
// ============================================

// 初始化环境变量
const validation = initEnv();
if (!validation.valid) {
  console.error(`❌ ${validation.error}`);
  printEnvHelp();
  process.exit(1);
}

// 获取配置（支持通过 OPENAI_MODEL 环境变量覆盖模型）
const baseConfig = getLLMConfig();
const model = 'anthropic/claude-sonnet-4.5';

console.log('\n🤖 LLMClient 测试');
console.log('='.repeat(60));
console.log(`📡 Base URL: ${baseConfig.baseURL || '(默认)'}`);
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
    unit: z.enum(['celsius', 'fahrenheit']).optional().describe('温度单位'),
  }),
  // @ts-expect-error - Parameter type inference issue
  execute: async ({ city, unit = 'celsius' }) => {
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
} as any);

/**
 * 计算器工具
 */
const calculatorTool = tool({
  description: '执行数学计算',
  inputSchema: z.object({
    expression: z.string().describe('数学表达式，例如：2 + 2, 10 * 5'),
  }),
  // @ts-expect-error - Parameter type inference issue
  execute: async ({ expression }) => {
    try {
      // 简单的安全计算（仅用于演示）
      const result = Function(`"use strict"; return (${expression})`)();
      return { expression, result };
    } catch (error) {
      return { expression, error: '计算错误' };
    }
  },
} as any);

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
    console.log(`📊 步骤数: ${result.steps.length}`);
    
    // 打印工具调用详情
    result.steps.forEach((step, index) => {
      if (step.toolCalls && step.toolCalls.length > 0) {
        console.log(`\n🔧 步骤 ${index + 1} - 工具调用:`);
        step.toolCalls.forEach(tc => {
          console.log(`  - ${tc.toolName}(${JSON.stringify((tc as any).args || (tc as any).input)})`);
        });
      }
      if (step.toolResults && step.toolResults.length > 0) {
        console.log(`📋 步骤 ${index + 1} - 工具结果:`);
        step.toolResults.forEach(tr => {
          console.log(`  - ${tr.toolName}: ${JSON.stringify((tr as any).result || (tr as any).output)}`);
        });
      }
    });
    
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
    console.log(`📊 步骤数: ${result.steps.length}`);
    
    // 统计工具调用
    let toolCallCount = 0;
    result.steps.forEach((step, index) => {
      if (step.toolCalls && step.toolCalls.length > 0) {
        toolCallCount += step.toolCalls.length;
        console.log(`\n🔧 步骤 ${index + 1} - ${step.toolCalls.length} 个工具调用:`);
        step.toolCalls.forEach(tc => {
          console.log(`  - ${tc.toolName}: ${JSON.stringify((tc as any).args || (tc as any).input)}`);
        });
      }
    });
    
    console.log(`\n🔢 总工具调用次数: ${toolCallCount}`);
    
    return true;
  } catch (error: any) {
    console.error(`❌ 失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试 6: Tool Calling - 流式 + 工具调用
 */
async function testStreamWithTools(client: LLMClient, testName: string) {
  console.log(`\n🌊 [${testName}] 测试 6: 流式 + 工具调用`);
  console.log('-'.repeat(60));
  
  try {
    const messages: ModelMessage[] = [
      { role: 'user', content: '查询巴黎的天气，并用华氏度告诉我温度。' },
    ];
    
    const result = client.stream(messages, {
      tools: { getWeather: getWeatherTool },
      maxSteps: 5,
    });
    
    // 监听完整事件流
    console.log('📤 事件流:');
    for await (const event of result.fullStream) {
      switch (event.type) {
        case 'text-delta':
          process.stdout.write((event as any).textDelta || (event as any).text || '');
          break;
        case 'tool-call':
          console.log(`\n🔧 工具调用: ${(event as any).toolName}(${JSON.stringify((event as any).args || (event as any).input)})`);
          break;
        case 'tool-result':
          console.log(`📋 工具结果: ${JSON.stringify((event as any).result || (event as any).output)}`);
          break;
        case 'finish':
          console.log(`\n🏁 完成: ${(event as any).finishReason}`);
          break;
      }
    }
    
    const finalText = await result.text;
    console.log(`\n✅ 最终文本: ${finalText}`);
    
    return true;
  } catch (error: any) {
    console.error(`\n❌ 失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试 7: 辅助方法 - buildAssistantMessage & buildToolResultMessage
 */
async function testHelperMethods(client: LLMClient, testName: string) {
  console.log(`\n🛠️  [${testName}] 测试 7: 辅助方法`);
  console.log('-'.repeat(60));
  
  try {
    // 第一轮：触发工具调用
    const messages: ModelMessage[] = [
      { role: 'user', content: '纽约今天天气怎么样？' },
    ];
    
    const result1 = await client.chat(messages, {
      tools: { getWeather: getWeatherTool },
      maxSteps: 1, // 只执行一步，不自动继续
    });
    
    if (!result1.toolCalls || result1.toolCalls.length === 0) {
      console.log('⚠️  未触发工具调用，跳过测试');
      return true;
    }
    
    console.log('✅ 第一轮完成，触发了工具调用');
    
    // 手动执行工具
    const toolCall = result1.toolCalls[0];
    const toolCallArgs = (toolCall as any).args || (toolCall as any).input;
    console.log(`🔧 手动执行工具: ${toolCall.toolName}(${JSON.stringify(toolCallArgs)})`);
    
    const toolResult = await (getWeatherTool as any).execute(toolCallArgs, {} as any);
    console.log(`📋 工具结果: ${JSON.stringify(toolResult)}`);
    
    // 使用辅助方法构建消息
    const assistantMessage = client.buildAssistantMessage([{
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      input: toolCallArgs,
    }]);
    
    const toolResultMessage = client.buildToolResultMessage(
      { toolCallId: toolCall.toolCallId, toolName: toolCall.toolName },
      toolResult
    );
    
    // 第二轮：继续对话（需要传递 tools 参数，某些模型如 Anthropic 要求）
    const messages2: ModelMessage[] = [
      ...messages,
      assistantMessage,
      toolResultMessage,
    ];
    
    const result2 = await client.chat(messages2, {
      tools: { getWeather: getWeatherTool },
    });
    
    console.log(`✅ 第二轮响应: ${result2.text}`);
    console.log('✅ 辅助方法测试通过');
    
    return true;
  } catch (error: any) {
    console.error(`❌ 失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试 8: 系统提示词
 */
async function testSystemPrompt(client: LLMClient, testName: string) {
  console.log(`\n📋 [${testName}] 测试 8: 系统提示词`);
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
 * 测试 9: 错误处理
 */
async function testErrorHandling(client: LLMClient, testName: string) {
  console.log(`\n⚠️  [${testName}] 测试 9: 错误处理`);
  console.log('-'.repeat(60));
  
  try {
    // 测试工具执行错误
    const errorTool = tool({
      description: '一个会抛出错误的工具',
      inputSchema: z.object({
        trigger: z.boolean(),
      }),
      // @ts-expect-error - Parameter type inference issue
      execute: async ({ trigger }) => {
        if (trigger) {
          throw new Error('故意触发的错误');
        }
        return { success: true };
      },
    } as any);
    
    const messages: ModelMessage[] = [
      { role: 'user', content: '请调用 error 工具，参数 trigger 设为 true' },
    ];
    
    const result = await client.chat(messages, {
      tools: { error: errorTool },
      maxSteps: 3,
    });
    
    // AI SDK 不会向上抛出工具执行错误，而是将错误包含在 content 中
    // 检查是否包含 tool-error 类型
    const hasToolError = result.content?.some((c: any) => c.type === 'tool-error');
    
    if (hasToolError) {
      const toolError = result.content?.find((c: any) => c.type === 'tool-error') as any;
      console.log(`✅ 工具错误已被捕获: ${toolError.toolName}`);
      console.log(`   错误信息: ${JSON.stringify(toolError.error)}`);
      return true;
    } else {
      console.log('⚠️  预期应该包含工具错误，但没有找到');
      return false;
    }
  } catch (error: any) {
    console.error(`❌ 测试失败: ${error.message}`);
    return false;
  }
}

/**
 * 测试 10: 多轮对话
 */
async function testMultiTurnConversation(client: LLMClient, testName: string) {
  console.log(`\n💬 [${testName}] 测试 10: 多轮对话`);
  console.log('-'.repeat(60));
  
  try {
    // 第一轮
    let messages: ModelMessage[] = [
      { role: 'user', content: '我想了解北京的天气' },
    ];
    
    const result1 = await client.chat(messages, {
      tools: { getWeather: getWeatherTool },
      maxSteps: 5,
    });
    
    console.log(`🤖 第一轮: ${result1.text}`);
    
    // 添加助手响应到历史
    messages.push({ role: 'assistant', content: result1.text });
    
    // 第二轮
    messages.push({ role: 'user', content: '那上海呢？' });
    
    const result2 = await client.chat(messages, {
      tools: { getWeather: getWeatherTool },
      maxSteps: 5,
    });
    
    console.log(`🤖 第二轮: ${result2.text}`);
    
    // 第三轮
    messages.push({ role: 'assistant', content: result2.text });
    messages.push({ role: 'user', content: '比较一下这两个城市的温度' });
    
    const result3 = await client.chat(messages);
    
    console.log(`🤖 第三轮: ${result3.text}`);
    console.log('✅ 多轮对话测试通过');
    
    return true;
  } catch (error: any) {
    console.error(`❌ 失败: ${error.message}`);
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
    ...baseConfig,
    model,
    // temperature: 0.7,
    maxTokens: 2000,
  });
  
  const tests = [
    { name: '基础对话', fn: testBasicChat },
    { name: '流式对话 (stream)', fn: testStreamWithFullResult },
    { name: '流式对话 (streamText)', fn: testStreamText },
    { name: 'Tool Calling - 单个工具', fn: testSingleToolCall },
    { name: 'Tool Calling - 多个工具', fn: testMultipleToolCalls },
    { name: '流式 + 工具调用', fn: testStreamWithTools },
    { name: '辅助方法', fn: testHelperMethods },
    { name: '系统提示词', fn: testSystemPrompt },
    { name: '错误处理', fn: testErrorHandling },
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
// 快速测试模式
// ============================================

/**
 * 快速测试（仅基础功能）
 */
async function runQuickTests(model: string) {
  const testName = model.replace(/\//g, '-');
  
  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`⚡ 快速测试模型: ${model}`);
  console.log('='.repeat(60));
  
  const client = new LLMClient({
    ...baseConfig,
    model,
    temperature: 0.7,
    maxTokens: 1000,
  });
  
  const tests = [
    { name: '基础对话', fn: testBasicChat },
    { name: 'Tool Calling', fn: testSingleToolCall },
    { name: '流式对话', fn: testStreamText },
  ];
  
  const results: { name: string; success: boolean }[] = [];
  
  for (const test of tests) {
    try {
      const success = await test.fn(client, testName);
      results.push({ name: test.name, success });
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      console.error(`\n❌ 测试 "${test.name}" 异常: ${error.message}`);
      results.push({ name: test.name, success: false });
    }
  }
  
  const passed = results.filter(r => r.success).length;
  console.log(`\n✅ ${model}: ${passed}/${results.length} 通过`);
  
  return { passed, failed: results.length - passed, total: results.length };
}

// ============================================
// 程序入口
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'single'; // single | quick | all
  
  try {
    if (mode === 'all') {
      // 测试所有模型（快速模式）
      console.log('\n🚀 批量测试模式（快速）');
      
      const models = [
        'anthropic/claude-sonnet-4.5',
        'google/gemini-2.5-pro',
        'google/gemini-2.5-flash',
        'openai/gpt-4.1',
        'openai/gpt-4.1-mini',
        'openai/gpt-5',
      ];
      
      const allResults = [];
      
      for (const model of models) {
        try {
          const result = await runQuickTests(model);
          allResults.push({ model, ...result });
        } catch (error: any) {
          console.error(`\n❌ ${model} 测试失败: ${error.message}\n`);
          allResults.push({ model, passed: 0, failed: 3, total: 3 });
        }
        
        // 模型之间的延迟
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // 打印总汇总
      console.log(`\n\n${'='.repeat(60)}`);
      console.log('📊 所有模型测试汇总');
      console.log('='.repeat(60));
      
      allResults.forEach(r => {
        const status = r.failed === 0 ? '✅' : r.passed > 0 ? '⚠️' : '❌';
        console.log(`${status} ${r.model}: ${r.passed}/${r.total} 通过`);
      });
      
      console.log('='.repeat(60));
      
    } else if (mode === 'quick') {
      // 快速测试当前模型
      await runQuickTests(model);
    } else {
      // 完整测试当前模型
      await runAllTests(model);
    }
    
    console.log('\n✅ 测试完成！\n');
    
  } catch (error: any) {
    console.error(`\n❌ 测试失败: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行测试
main();
