/**
 * BaseAgent 测试
 * 
 * 这个测试展示如何：
 * 1. 继承 BaseAgent 创建自定义 Agent
 * 2. 定义工具（使用 tool() 函数）
 * 3. 实现工具执行逻辑
 * 4. 与 LLM 交互完成任务
 */

import { BaseAgent } from '../BaseAgent';
import type { Task, TaskResult } from '@monkey-agent/types';
import { tool } from 'ai';
import { z } from 'zod';
import type { ToolSet } from 'ai';
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

const apiKey = validation.apiKey;
const provider = validation.provider;
const baseURL = process.env.OPENAI_BASE_URL || 
  (process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : 
  (provider === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1'));
const model = process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || 
  process.env.ANTHROPIC_MODEL || 'anthropic/claude-3.5-sonnet';

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
        parameters: z.object({
          city: z.string().describe('城市名称，例如：北京、上海、广州'),
        }),
      }),

      // 工具 2: 比较多个城市天气
      compareWeather: tool({
        description: '比较多个城市的天气情况，找出温度最高、最低等信息',
        parameters: z.object({
          cities: z.array(z.string()).describe('要比较的城市列表'),
        }),
      }),

      // 工具 3: 获取所有支持的城市
      getSupportedCities: tool({
        description: '获取所有支持查询天气的城市列表',
        parameters: z.object({}),
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

  console.log(`🤖 使用模型: ${model}`);
  console.log(`📡 Base URL: ${baseURL}\n`);

  // 创建 Weather Agent
  const agent = new WeatherAgent({
    id: 'weather-agent-001',
    name: 'Weather Assistant',
    description: '一个智能天气助手，可以查询和比较城市天气',
    capabilities: ['查询天气', '比较天气', '天气建议'],
    llmConfig: {
      provider: 'openai',
      apiKey: apiKey!,
      baseURL,
      model,
      maxTokens: 1000,
    },
  });

  // 监听事件
  agent.on('task:start', (task: Task) => {
    console.log('📋 任务开始:', task.description);
  });

  agent.on('react:iteration', ({ iteration }: { iteration: number }) => {
    console.log(`\n🔄 ReAct 迭代 ${iteration + 1}`);
  });

  agent.on('task:complete', (result: TaskResult) => {
    console.log('\n✅ 任务完成');
    console.log(`   耗时: ${result.duration}ms`);
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

  // ============ 输出统计 ============
  console.log('\n========================================');
  console.log('📊 测试统计');
  console.log('========================================');
  console.log(`总任务数: 3`);
  console.log(`成功: ${result1.success && result2.success && result3.success ? 3 : '部分失败'}`);
  console.log(`总耗时: ${(result1.duration || 0) + (result2.duration || 0) + (result3.duration || 0)}ms`);

  console.log('\n✨ 所有测试完成！\n');
}

// 运行测试
runTests().catch(error => {
  console.error('\n❌ 测试失败:', error);
  process.exit(1);
});

export { WeatherAgent, runTests };
