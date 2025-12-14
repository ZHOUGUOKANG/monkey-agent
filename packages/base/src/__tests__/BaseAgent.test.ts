/**
 * BaseAgent 测试
 * 
 * 这个测试展示如何：
 * 1. 继承 BaseAgent 创建自定义 Agent
 * 2. 定义工具（使用 tool() 函数）
 * 3. 实现工具执行逻辑
 * 4. 与 LLM 交互完成任务（使用新的 Workflow API）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from '../BaseAgent';
import type { AgentNode, AgentExecutionResult, AgentContext, ILLMClient } from '@monkey-agent/types';
import { tool } from 'ai';
import { z } from 'zod';
import type { ToolSet } from 'ai';

/**
 * 创建测试用的 AgentContext
 */
function createTestContext(workflowTask: string): AgentContext {
  const outputs = new Map<string, AgentExecutionResult>();
  const vals = new Map<string, any>();
  
  return {
    workflowId: 'test-workflow',
    workflowTask,
    outputs,
    vals,
    currentLevel: 0,
    status: 'running',
    startTime: Date.now(),
    getOutput: (agentId: string) => outputs.get(agentId),
    getValue: (key: string) => vals.get(key),
    setValue: (key: string, value: any) => vals.set(key, value),
    toJSON: () => ({
      workflowId: 'test-workflow',
      workflowTask,
      currentLevel: 0,
      status: 'running',
      startTime: Date.now()
    })
  };
}

/**
 * Mock LLM 客户端
 */
function createMockLLMClient(): ILLMClient {
  const mockStream = {
    fullStream: (async function* () {
      yield { type: 'text-delta', textDelta: 'Task completed successfully' };
      yield { type: 'finish', finishReason: 'stop', totalUsage: { totalTokens: 100 } };
    })(),
    textStream: (async function* () {
      yield 'Task completed successfully';
    })(),
    usage: Promise.resolve({ totalTokens: 100 }),
  };

  return {
    chat: vi.fn().mockResolvedValue({
      text: 'Task completed successfully',
      finishReason: 'stop',
      usage: { totalTokens: 100 },
    }),
    stream: vi.fn().mockReturnValue(mockStream),
  } as any;
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
  };

  /**
   * 定义工具（不含 execute 函数）
   */
  public getToolDefinitions(): ToolSet {
    return {
      getWeather: tool({
        description: '查询指定城市的当前天气情况',
        inputSchema: z.object({
          city: z.string().describe('城市名称'),
        }),
      }),

      compareWeather: tool({
        description: '比较多个城市的天气情况',
        inputSchema: z.object({
          cities: z.array(z.string()).describe('要比较的城市列表'),
        }),
      }),

      getSupportedCities: tool({
        description: '获取所有支持查询天气的城市列表',
        inputSchema: z.object({}),
      }),
    };
  }

  /**
   * 执行工具调用
   */
  protected async executeToolCall(toolName: string, input: any): Promise<any> {
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

  private async getWeather(city: string): Promise<WeatherData | { error: string }> {
    const weather = this.weatherDatabase[city];
    if (!weather) {
      return { error: `未找到城市 "${city}"` };
    }
    return weather;
  }

  private async compareWeather(cities: string[]): Promise<any> {
    const weatherData: WeatherData[] = [];
    for (const city of cities) {
      const weather = this.weatherDatabase[city];
      if (weather) {
        weatherData.push(weather);
      }
    }

    if (weatherData.length === 0) {
      return { error: '没有找到任何城市的天气数据' };
    }

    const hottest = weatherData.reduce((prev, curr) =>
      curr.temperature > prev.temperature ? curr : prev
    );

    return {
      cities: weatherData,
      summary: {
        hottestCity: hottest.city,
        hottestTemp: hottest.temperature,
      },
    };
  }

  private async getSupportedCities(): Promise<{ cities: string[] }> {
    return { cities: Object.keys(this.weatherDatabase) };
  }
}

describe('BaseAgent', () => {
  let llmClient: ILLMClient;
  let agent: WeatherAgent;

  beforeEach(() => {
    llmClient = createMockLLMClient();
    agent = new WeatherAgent({
      id: 'weather-agent',
      name: 'Weather Agent',
      description: '天气查询助手',
      capabilities: ['查询天气', '比较天气'],
      llmClient,
      enableStreaming: false,
      maxIterations: 1,
    });
  });

  describe('Tool Definitions', () => {
    it('should define weather tools correctly', () => {
      const tools = agent.getToolDefinitions();
      
      expect(tools.getWeather).toBeDefined();
      expect(tools.compareWeather).toBeDefined();
      expect(tools.getSupportedCities).toBeDefined();
    });
  });

  describe('Tool Execution', () => {
    it('should execute getWeather tool', async () => {
      const result = await agent['executeToolCall']('getWeather', { city: '北京' });
      
      expect(result).toHaveProperty('city', '北京');
      expect(result).toHaveProperty('temperature', 15);
      expect(result).toHaveProperty('conditions', '晴朗');
    });

    it('should handle unknown city', async () => {
      const result = await agent['executeToolCall']('getWeather', { city: '不存在的城市' });
      
      expect(result).toHaveProperty('error');
    });

    it('should execute compareWeather tool', async () => {
      const result = await agent['executeToolCall']('compareWeather', { 
        cities: ['北京', '上海', '广州'] 
      });
      
      expect(result.cities).toHaveLength(3);
      expect(result.summary.hottestCity).toBe('广州');
      expect(result.summary.hottestTemp).toBe(28);
    });

    it('should execute getSupportedCities tool', async () => {
      const result = await agent['executeToolCall']('getSupportedCities', {});
      
      expect(result.cities).toContain('北京');
      expect(result.cities).toContain('上海');
      expect(result.cities).toContain('广州');
    });
  });

  describe('Agent Execution', () => {
    it('should execute simple task', async () => {
      const result = await agent.execute('查询北京天气');
      
      expect(result.status).toBe('success');
      expect(result.agentId).toBe('weather-agent');
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should execute with context', async () => {
      const context = createTestContext('天气查询任务');
      const result = await agent.execute('查询上海天气', context);
      
      expect(result.status).toBe('success');
      expect(result.agentId).toBe('weather-agent');
    });

    it('should execute with structured steps', async () => {
      const result = await agent.execute('比较北京和上海的天气', undefined, {
        agentNode: {
          steps: [
            { stepNumber: 1, desc: '查询城市天气' },
            { stepNumber: 2, desc: '比较结果' },
          ]
        }
      });
      
      expect(result.status).toBe('success');
    });

    it('should execute with full agent node', async () => {
      const agentNode: AgentNode = {
        id: 'test-node',
        type: 'weather',
        name: 'Weather Task',
        desc: '获取支持的城市列表',
        steps: [
          { stepNumber: 1, desc: '查询城市列表' }
        ],
        dependencies: []
      };

      const context = createTestContext('测试任务');
      const result = await agent.execute(agentNode.desc, context, {
        agentNode: agentNode
      });
      
      expect(result.status).toBe('success');
    });
  });

  describe('Context Tools Integration', () => {
    it('should have context tools injected', async () => {
      const context = createTestContext('测试');
      await agent.execute('测试任务', context);
      
      // 验证 LLM 被调用时包含了 context tools
      expect(llmClient.chat).toHaveBeenCalled();
      const callArgs = (llmClient.chat as any).mock.calls[0];
      const options = callArgs[1];
      
      // 检查工具集包含 context tools
      expect(options.tools).toBeDefined();
      expect(options.tools.valSet).toBeDefined();
      expect(options.tools.valGet).toBeDefined();
      expect(options.tools.valList).toBeDefined();
      
      // 同时也应该包含 agent 自己的工具
      expect(options.tools.getWeather).toBeDefined();
      expect(options.tools.compareWeather).toBeDefined();
    });
  });
});
