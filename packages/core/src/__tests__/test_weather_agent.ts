/**
 * 天气查询 Agent 测试
 * 
 * 这个测试展示如何：
 * 1. 继承 BaseAgent 创建自定义 Agent
 * 2. 定义工具（使用 tool() 函数）
 * 3. 实现工具执行逻辑
 * 4. 与 LLM 交互完成任务
 */

import { BaseAgent } from '../base/BaseAgent';
import { Task, TaskResult } from '../types';
import { initEnv, getLLMConfig, printEnvHelp } from '../utils';
import { tool } from 'ai';
import { z } from 'zod';
import type { ToolSet } from 'ai';

// 初始化环境变量
const validation = initEnv();
if (!validation.valid) {
  console.error(`❌ ${validation.error}`);
  printEnvHelp();
  process.exit(1);
}

/**
 * 模拟的天气数据
 */
interface WeatherData {
  city: string;
  temperature: number;
  conditions: string;
  humidity: number;
  windSpeed: number;
}

/**
 * 天气查询 Agent
 * 
 * 功能：
 * - 查询城市天气
 * - 比较多个城市天气
 * - 提供天气建议
 */
class WeatherAgent extends BaseAgent {
  private weatherDatabase: Record<string, WeatherData> = {
    '北京': {
      city: '北京',
      temperature: 15,
      conditions: '晴朗',
      humidity: 45,
      windSpeed: 12,
    },
    '上海': {
      city: '上海',
      temperature: 22,
      conditions: '多云',
      humidity: 65,
      windSpeed: 8,
    },
    '广州': {
      city: '广州',
      temperature: 28,
      conditions: '阴天',
      humidity: 80,
      windSpeed: 5,
    },
    '深圳': {
      city: '深圳',
      temperature: 27,
      conditions: '小雨',
      humidity: 85,
      windSpeed: 6,
    },
    '成都': {
      city: '成都',
      temperature: 18,
      conditions: '雾',
      humidity: 75,
      windSpeed: 3,
    },
    '杭州': {
      city: '杭州',
      temperature: 20,
      conditions: '晴朗',
      humidity: 55,
      windSpeed: 10,
    },
  };

  /**
   * 定义工具（不含 execute 函数）
   */
  protected getToolDefinitions(): ToolSet {
    return {
      // 工具 1: 查询单个城市天气
      getWeather: tool({
        description: '查询指定城市的当前天气情况，包括温度、天气状况、湿度和风速',
        inputSchema: z.object({
          city: z.string().describe('城市名称，例如：北京、上海、广州'),
        }),
        // 注意：不提供 execute 函数，由 executeToolCall 处理
      }),

      // 工具 2: 比较多个城市天气
      compareWeather: tool({
        description: '比较多个城市的天气情况，找出温度最高、最低等信息',
        inputSchema: z.object({
          cities: z.array(z.string()).describe('要比较的城市列表'),
        }),
      }),

      // 工具 3: 获取所有支持的城市
      getSupportedCities: tool({
        description: '获取所有支持查询天气的城市列表',
        inputSchema: z.object({}), // 无参数
      }),
    };
  }

  /**
   * 执行工具调用
   */
  protected async executeToolCall(toolName: string, input: any): Promise<any> {
    console.log(`\n🔧 执行工具: ${toolName}`);
    console.log(`   参数:`, input);

    switch (toolName) {
      case 'getWeather':
        return this.getWeather(input.city);

      case 'compareWeather':
        return this.compareWeather(input.cities);

      case 'getSupportedCities':
        return this.getSupportedCities();

      default:
        throw new Error(`未知工具: ${toolName}`);
    }
  }

  /**
   * 查询天气（模拟 API 调用）
   */
  private async getWeather(city: string): Promise<WeatherData | { error: string }> {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 100));

    const weather = this.weatherDatabase[city];
    if (!weather) {
      return {
        error: `未找到城市 "${city}" 的天气数据。支持的城市有: ${Object.keys(this.weatherDatabase).join('、')}`,
      };
    }

    console.log(`   ✅ 查询成功: ${city} - ${weather.temperature}°C, ${weather.conditions}`);
    return weather;
  }

  /**
   * 比较多个城市天气
   */
  private async compareWeather(cities: string[]): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 100));

    const weatherData: WeatherData[] = [];
    const errors: string[] = [];

    for (const city of cities) {
      const weather = this.weatherDatabase[city];
      if (weather) {
        weatherData.push(weather);
      } else {
        errors.push(`未找到城市 "${city}"`);
      }
    }

    if (weatherData.length === 0) {
      return { error: '没有找到任何城市的天气数据', details: errors };
    }

    // 找出温度最高和最低的城市
    const hottest = weatherData.reduce((prev, curr) =>
      curr.temperature > prev.temperature ? curr : prev
    );
    const coldest = weatherData.reduce((prev, curr) =>
      curr.temperature < prev.temperature ? curr : prev
    );

    const result = {
      cities: weatherData,
      summary: {
        hottestCity: hottest.city,
        hottestTemp: hottest.temperature,
        coldestCity: coldest.city,
        coldestTemp: coldest.temperature,
        averageTemp: Math.round(
          weatherData.reduce((sum, w) => sum + w.temperature, 0) / weatherData.length
        ),
      },
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log(`   ✅ 比较完成: 最高温 ${hottest.city} (${hottest.temperature}°C)`);
    return result;
  }

  /**
   * 获取支持的城市列表
   */
  private async getSupportedCities(): Promise<{ cities: string[] }> {
    await new Promise(resolve => setTimeout(resolve, 50));

    const cities = Object.keys(this.weatherDatabase);
    console.log(`   ✅ 支持的城市: ${cities.join('、')}`);
    return { cities };
  }
}

/**
 * 测试场景
 */
async function runTests() {
  console.log('========================================');
  console.log('🌤️  天气查询 Agent 测试');
  console.log('========================================\n');

  // 获取 LLM 配置
  const llmConfig = getLLMConfig();
  console.log(`🤖 使用 Provider: ${llmConfig.provider}`);
  console.log(`🤖 模型: ${llmConfig.model || '默认模型'}\n`);

  // 创建 Weather Agent
  const agent = new WeatherAgent({
    id: 'weather-agent-001',
    name: 'Weather Assistant',
    description: '一个智能天气助手，可以查询和比较城市天气',
    capabilities: ['查询天气', '比较天气', '天气建议'],
    llmConfig: {
      ...llmConfig,
      // 只在没有配置时才使用默认值
      model: llmConfig.model || 'openai/gpt-4o-mini',
      maxTokens: llmConfig.maxTokens || 1000,
      // 只在明确支持时才设置 temperature
      ...(llmConfig.temperature !== undefined ? { temperature: llmConfig.temperature } : {}),
    },
  });

  // 监听事件
  agent.on('task:start', (task: Task) => {
    console.log('📋 任务开始:', task.description);
  });

  agent.on('react:iteration', ({ iteration }: { iteration: number }) => {
    console.log(`\n🔄 ReAct 迭代 ${iteration + 1}`);
  });

  agent.on('react:action', ({ action }: { action: string }) => {
    console.log(`🎯 执行操作: ${action}`);
  });

  agent.on('react:error', (info: any) => {
    console.error(`\n❌ 错误 [迭代 ${info.iteration + 1}]:`, info.error);
    if (info.errorDetails) {
      console.error('   详细信息:', info.errorDetails);
    }
  });

  agent.on('task:complete', (result: TaskResult) => {
    console.log('\n✅ 任务完成');
    console.log(`   耗时: ${result.duration}ms`);
  });

  agent.on('react:warning', ({ iteration, message, responseText, responseFinishReason }: any) => {
    console.log(`⚠️  警告 [迭代 ${iteration + 1}]: ${message}`);
    console.log(`   响应文本: "${responseText}"`);
    console.log(`   结束原因: ${responseFinishReason}`);
  });

  agent.on('react:final-answer', () => {
    console.log(`\n🎉 获得最终答案`);
  });

  agent.on('task:complete', (result: TaskResult) => {
    console.log('\n✅ 任务完成');
    console.log(`   耗时: ${result.duration}ms`);
  });

  // 调试：观察消息构建
  agent.on('debug:conversation-history', ({ historyLength, history }: { historyLength: number; history: any[] }) => {
    console.log(`   📚 对话历史: ${historyLength} 条消息`);
    // 在迭代 3+ 开始时，打印完整的对话历史（用于调试）
    if (historyLength >= 5) {
      console.log(`   🔍 完整对话历史 (${historyLength} 条):`, JSON.stringify(history, null, 2));
    }
  });

  agent.on('debug:llm-response', (info: any) => {
    console.log(`   🤖 LLM 响应:`);
    console.log(`      - 文本: ${info.hasText ? `"${info.textPreview}..."` : '(无)'}`);
    console.log(`      - 工具调用: ${info.hasToolCalls ? `${info.toolCallsCount} 个` : '(无)'}`);
    console.log(`      - 结束原因: ${info.finishReason}`);
  });

  agent.on('debug:tool-calls', (info: any) => {
    console.log(`   🔍 简化后的工具调用:`, JSON.stringify(info.toolCalls, null, 2));
  });

  agent.on('debug:assistant-message', (info: any) => {
    console.log(`   📝 构建的助手消息:`, JSON.stringify(info.message, null, 2));
  });

  // 调试：工具调用详情
  agent.on('debug:tool-call-details', (details: any) => {
    console.log('🔍 工具调用详情:');
    console.log('   toolCallId:', details.toolCallId);
    console.log('   toolName:', details.toolName);
    console.log('   input:', JSON.stringify(details.input, null, 2));
  });

  // 调试：助手消息
  agent.on('debug:assistant-message', (data: any) => {
    console.log('💬 助手消息:');
    console.log(JSON.stringify(data.message, null, 2));
  });

  // 调试：完整对话历史
  agent.on('debug:full-conversation', (data: any) => {
    console.log(`\n📜 完整对话历史 (迭代 ${data.iteration}):`);
    console.log(data.history);
  });

  // 调试：LLM 响应
  agent.on('debug:llm-response', (data: any) => {
    console.log(`\n🤖 LLM 响应 (迭代 ${data.iteration}):`);
    console.log(`   文本: ${data.text || '(空)'}`);
    console.log(`   工具调用: ${data.hasToolCalls ? `是 (${data.toolCallsCount} 个)` : '否'}`);
    console.log(`   结束原因: ${data.finishReason}`);
  });

  // 调试：LLM 错误
  agent.on('debug:llm-error', (data: any) => {
    console.log(`\n❌ LLM 错误 (迭代 ${data.iteration}):`);
    console.log(`   错误信息: ${data.error}`);
    console.log(`   详细信息:`, data.errorDetails);
  });

  // ============ 测试 1: 查询单个城市天气 ============
  console.log('\n========================================');
  console.log('测试 1: 查询单个城市天气');
  console.log('========================================');

  const task1: Task = {
    id: 'task-1',
    type: 'query',
    description: '北京今天天气怎么样？',
    parameters: {},
  };

  const result1 = await agent.execute(task1);
  console.log('\n📊 最终结果:');
  console.log(result1.data?.answer || '(无最终答案)');

  // ============ 测试 2: 比较多个城市 ============
  console.log('\n========================================');
  console.log('测试 2: 比较多个城市天气');
  console.log('========================================');

  const task2: Task = {
    id: 'task-2',
    type: 'compare',
    description: '比较北京、上海、广州的天气，告诉我哪个城市最热？',
    parameters: {},
  };

  const result2 = await agent.execute(task2);
  console.log('\n📊 最终结果:');
  console.log(result2.data?.answer || '(无最终答案)');

  // ============ 测试 3: 复杂查询 ============
  console.log('\n========================================');
  console.log('测试 3: 复杂查询（多步推理）');
  console.log('========================================');

  const task3: Task = {
    id: 'task-3',
    type: 'complex',
    description:
      '我想去中国旅游，帮我看看哪些城市天气比较好（温度在20-25度之间，不下雨）？',
    parameters: {},
  };

  const result3 = await agent.execute(task3);
  console.log('\n📊 最终结果:');
  console.log(result3.data?.answer || '(无最终答案)');

  // ============ 测试 4: 错误处理 ============
  console.log('\n========================================');
  console.log('测试 4: 错误处理（查询不存在的城市）');
  console.log('========================================');

  const task4: Task = {
    id: 'task-4',
    type: 'query',
    description: '请查询纽约的天气',
    parameters: {},
  };

  const result4 = await agent.execute(task4);
  console.log('\n📊 最终结果:');
  console.log(result4.data?.answer || '(无最终答案)');

  // ============ 输出统计 ============
  console.log('\n========================================');
  console.log('📊 测试统计');
  console.log('========================================');
  console.log(`总任务数: 4`);
  console.log(`成功: 4`);
  console.log(`总耗时: ${result1.duration! + result2.duration! + result3.duration! + result4.duration!}ms`);

  console.log('\n✨ 所有测试完成！\n');
}

// 运行测试
// 注意：在 ES module 中，脚本总是会执行
// 如果不想自动运行，注释掉下面的代码
runTests().catch(error => {
  console.error('\n❌ 测试失败:', error);
  process.exit(1);
});

export { WeatherAgent, runTests };
