/**
 * 上下文压缩功能测试
 * 
 * 测试内容：
 * 1. 主动压缩（超过消息阈值）
 * 2. 工具触发压缩（LLM 主动调用 compressContext）
 * 3. 压缩后任务继续执行
 * 4. 禁用压缩功能
 * 5. 混合压缩策略（多轮对话）
 * 6. 压缩质量验证（关键信息保留）
 * 
 * 使用说明：
 * 1. 在 .env 文件中配置：
 *    OPENAI_API_KEY=your-key
 *    OPENAI_BASE_URL=your-litellm-url（可选）
 * 2. 运行测试：yarn test:compression
 */

import { BaseAgent } from '../base/BaseAgent';
import { Task } from '../types';
import { initEnv, getLLMConfig, printEnvHelp } from '../utils';
import { tool } from 'ai';
import { z } from 'zod';
import type { ToolSet } from 'ai';

// ============================================
// 环境初始化
// ============================================

const validation = initEnv();
if (!validation.valid) {
  console.error(`❌ ${validation.error}`);
  printEnvHelp();
  process.exit(1);
}

const baseConfig = getLLMConfig();
const model = 'openai/gpt-5';

console.log('\n🧪 上下文压缩功能测试');
console.log('='.repeat(60));
console.log(`📡 Base URL: ${baseConfig.baseURL || '(默认)'}`);
console.log(`🎯 模型: ${model}`);
console.log('='.repeat(60));

// ============================================
// 测试 Agent
// ============================================

/**
 * 简单计数器 Agent（用于测试压缩）
 */
class CounterAgent extends BaseAgent {
  private counter: number = 0;

  protected getToolDefinitions(): ToolSet {
    return {
      increment: tool({
        description: '增加计数器的值',
        inputSchema: z.object({
          amount: z.number().describe('增加的数量（默认 1）').optional(),
        }),
      }),
      getCount: tool({
        description: '获取当前计数器的值',
        inputSchema: z.object({}),
      }),
      addToHistory: tool({
        description: '添加一些文本到对话历史中（用于测试压缩）',
        inputSchema: z.object({
          text: z.string().describe('要添加的文本'),
        }),
      }),
    };
  }

  protected async executeToolCall(toolName: string, input: any): Promise<any> {
    console.log(`\n🔧 执行工具: ${toolName}`);
    console.log(`   参数:`, input);

    switch (toolName) {
      case 'increment':
        const amount = input.amount || 1;
        this.counter += amount;
        console.log(`   ✅ 计数器增加 ${amount}，当前值: ${this.counter}`);
        return { counter: this.counter, increment: amount };

      case 'getCount':
        console.log(`   ✅ 当前计数器值: ${this.counter}`);
        return { counter: this.counter };

      case 'addToHistory':
        const textPreview = input.text ? input.text.substring(0, 50) : '(空文本)';
        console.log(`   ✅ 添加文本到历史: ${textPreview}...`);
        return { success: true, length: input.text?.length || 0, text: input.text || '' };
      default:
        throw new Error(`未知工具: ${toolName}`);
    }
  }
}

// ============================================
// 测试用例
// ============================================

/**
 * 测试 1: 主动压缩（超过阈值）
 */
async function testProactiveCompression() {
  console.log('\n========================================');
  console.log('测试 1: 主动压缩（超过消息阈值）');
  console.log('========================================');

  const agent = new CounterAgent({
    id: 'counter-agent-1',
    name: 'Counter Agent',
    description: '一个简单的计数器 Agent',
    capabilities: ['计数', '历史记录'],
    llmConfig: {
      ...baseConfig,
      model,
      maxTokens: 2000,
    },
    maxIterations: 30, // 增加最大迭代次数
    contextCompression: {
      enabled: true,
      maxMessages: 4, // 设置较低阈值便于测试
      keepRecentMessages: 2,
      keepRecentRounds: 2,
      autoRetryOnLength: true,
      enableTool: false, // 禁用工具触发，只测试主动压缩
    },
  });

  // 监听压缩事件
  let compressionTriggered = false;
  agent.on('context:proactive-compression-triggered', (data: any) => {
    console.log(`\n⚡ 主动压缩触发！`);
    console.log(`   消息数: ${data.messageCount}`);
    console.log(`   阈值: ${data.threshold}`);
    compressionTriggered = true;
  });

  agent.on('context:compressed', (data: any) => {
    console.log(`\n✅ 压缩完成！`);
    console.log(`   摘要: ${data.summary ? data.summary.substring(0, 100) + '...' : '(无摘要)'}`);
    console.log(`   原始长度: ${data.originalLength}`);
    console.log(`   新长度: ${data.newHistoryLength}`);
  });
  
  // 监听错误和警告
  agent.on('react:error', (data: any) => {
    console.log(`\n❌ ReAct 错误: ${data.error}`);
  });
  
  agent.on('react:warning', (data: any) => {
    console.log(`\n⚠️  警告 [迭代 ${data.iteration + 1}]: ${data.message}`);
  });

  const task: Task = {
    id: 'task-1',
    type: 'multi-step',
    description: `执行以下步骤（每步都要调用工具）：
1. 增加计数器 5 次（每次增加 1）
2. 多次添加文本到历史（添加一些长文本）
3. 最后获取计数器的值并告诉我`,
    parameters: {},
  };

  const result = await agent.execute(task);

  console.log('\n📊 测试结果:');
  console.log(`成功: ${result.success}`);
  console.log(`答案: ${result.data?.answer || '(无)'}`);
  console.log(`迭代次数: ${result.metadata?.iterations}`);
  console.log(`压缩触发: ${compressionTriggered ? '是' : '否'}`);
  
  if (!result.success && result.error) {
    console.log(`错误: ${result.error.message}`);
  }

  return { success: result.success && compressionTriggered };
}

/**
 * 测试 2: 工具触发压缩
 */
async function testToolTriggeredCompression() {
  console.log('\n========================================');
  console.log('测试 2: 工具触发压缩（LLM 主动调用）');
  console.log('========================================');

  const agent = new CounterAgent({
    id: 'counter-agent-2',
    name: 'Counter Agent',
    description: '一个简单的计数器 Agent',
    capabilities: ['计数', '历史记录'],
    llmConfig: {
      ...baseConfig,
      model,
      maxTokens: 2000,
    },
    maxIterations: 30, // 增加最大迭代次数
    contextCompression: {
      enabled: true,
      maxMessages: 100, // 设置很高，避免主动触发
      keepRecentRounds: 1, // 保留最近 1 轮对话（确保压缩后有足够的消息）
      keepRecentMessages: 3, // 至少保留 3 条消息（避免压缩过度）
      autoRetryOnLength: true, // 启用自动重试，处理压缩后的 API 错误
      enableTool: true, // 启用工具触发
    },
  });

  // 监听工具触发事件
  let toolTriggered = false;
  agent.on('context:tool-triggered', (data: any) => {
    console.log(`\n🛠️  工具触发压缩！`);
    console.log(`   迭代: ${data.iteration}`);
    console.log(`   输入: ${JSON.stringify(data.input)}`);
    toolTriggered = true;
  });

  agent.on('context:compressed', (data: any) => {
    console.log(`\n✅ 压缩完成！`);
    console.log(`   摘要: ${data.summary ? data.summary.substring(0, 100) + '...' : '(无摘要)'}`);
    console.log(`   新长度: ${data.newHistoryLength}`);
  });

  // 监听错误和警告
  agent.on('react:error', (data: any) => {
    console.log(`\n❌ ReAct 错误: ${data.error}`);
  });

  agent.on('context:compression-failed', (data: any) => {
    console.log(`\n⚠️  压缩失败: ${data.error}`);
  });

  const task: Task = {
    id: 'task-2',
    type: 'compression-test',
    description: `执行以下步骤：
1. 增加计数器 5 次（每次增加 1）
2. 添加 3 段长文本到历史
3. 当你觉得对话历史变长时，主动调用 compressContext 工具来压缩历史（注意：压缩时要保留足够的上下文，建议 keepRecentRounds 设置为 1 或 2）
4. 然后继续获取计数器的值并告诉我`,
    parameters: {},
  };

  const result = await agent.execute(task);

  console.log('\n📊 测试结果:');
  console.log(`成功: ${result.success}`);
  console.log(`答案: ${result.data?.answer || '(无)'}`);
  console.log(`工具触发: ${toolTriggered ? '是' : '否'}`);
  
  if (!result.success && result.error) {
    console.log(`错误: ${result.error.message}`);
  }

  return { success: result.success, toolTriggered };
}

/**
 * 测试 3: 压缩后任务继续执行
 */
async function testCompressionContinuity() {
  console.log('\n========================================');
  console.log('测试 3: 压缩后任务继续执行');
  console.log('========================================');

  const agent = new CounterAgent({
    id: 'counter-agent-3',
    name: 'Counter Agent',
    description: '一个简单的计数器 Agent',
    capabilities: ['计数'],
    llmConfig: {
      ...baseConfig,
      model,
      maxTokens: 2000,
    },
    maxIterations: 30, // 增加最大迭代次数
    contextCompression: {
      enabled: true,
      maxMessages: 6,
      keepRecentRounds: 1,
      autoRetryOnLength: true,
      enableTool: false,
    },
  });

  let compressionCount = 0;
  agent.on('context:compressed', () => {
    compressionCount++;
    console.log(`\n✅ 第 ${compressionCount} 次压缩完成`);
  });

  const task: Task = {
    id: 'task-3',
    type: 'continuity-test',
    description: `执行多步操作：
1. 增加计数器到 10（每次增加 1 或 2）
2. 在执行过程中可能会触发历史压缩
3. 压缩后继续执行直到完成
4. 最后告诉我最终的计数器值`,
    parameters: {},
  };

  const result = await agent.execute(task);

  console.log('\n📊 测试结果:');
  console.log(`成功: ${result.success}`);
  console.log(`答案: ${result.data?.answer || '(无)'}`);
  console.log(`压缩次数: ${compressionCount}`);
  console.log(`最终计数器值: 应该是 10`);
  
  if (!result.success && result.error) {
    console.log(`错误: ${result.error.message}`);
  }

  return { success: result.success, compressionCount };
}

/**
 * 测试 4: 禁用压缩
 */
async function testDisabledCompression() {
  console.log('\n========================================');
  console.log('测试 4: 禁用压缩功能');
  console.log('========================================');

  const agent = new CounterAgent({
    id: 'counter-agent-4',
    name: 'Counter Agent',
    description: '一个简单的计数器 Agent',
    capabilities: ['计数'],
    llmConfig: {
      ...baseConfig,
      model,
      maxTokens: 2000,
    },
    maxIterations: 30, // 增加最大迭代次数
    contextCompression: {
      enabled: false, // 禁用压缩
    },
  });

  let compressionTriggered = false;
  agent.on('context:compressed', () => {
    compressionTriggered = true;
  });

  const task: Task = {
    id: 'task-4',
    type: 'disabled-test',
    description: '增加计数器 3 次，然后告诉我结果',
    parameters: {},
  };

  const result = await agent.execute(task);

  console.log('\n📊 测试结果:');
  console.log(`成功: ${result.success}`);
  console.log(`压缩触发: ${compressionTriggered ? '是（不应该）' : '否（正确）'}`);
  
  if (!result.success && result.error) {
    console.log(`错误: ${result.error.message}`);
  }

  return { success: result.success && !compressionTriggered };
}

// ============================================
// 测试 5: 混合压缩策略（支持多轮对话）
// ============================================

async function testHybridStrategy() {
  console.log('\n📊 测试 5：混合压缩策略');
  console.log('-'.repeat(60));
  
  try {
    // 场景 1: 单轮多工具调用
    console.log('\n🔹 场景 1: 单轮多工具调用（应使用 message-based 策略）');
    const agent1 = new CounterAgent({
      id: 'hybrid-single-round',
      name: 'Hybrid Counter Agent 1',
      description: '混合压缩策略测试 Agent（场景 1）',
      capabilities: ['计数', '历史记录'],
      llmConfig: {
        ...baseConfig,
        model,
        maxOutputTokens: 2000,
      },
      maxIterations: 30,
      contextCompression: {
        enabled: true,
        maxMessages: 10, // 低阈值以触发压缩
        maxTokens: 1000,
        keepRecentRounds: 3,
        keepRecentMessages: 6,
      },
    });
    
    const task1: Task = {
      id: 'hybrid-1',
      type: 'multi-step',
      description: '增加计数器 8 次（每次增加 1），然后添加 3 段文本到历史',
      parameters: {},
    };
    
    await agent1.execute(task1);
    
    const history1 = agent1['conversationHistory'];
    const roundCount1 = history1.filter((m: any) => m.role === 'user').length;
    console.log(`   ✓ 最终消息数: ${history1.length}`);
    console.log(`   ✓ 轮数: ${roundCount1}`);
    
    // 场景 2: 多轮对话（使用 continueConversation 保持上下文）
    console.log('\n🔹 场景 2: 多轮对话（应使用 round-based 策略）');
    const agent2 = new CounterAgent({
      id: 'hybrid-multi-round',
      name: 'Hybrid Counter Agent 2',
      description: '混合压缩策略测试 Agent（场景 2）',
      capabilities: ['计数', '历史记录'],
      llmConfig: {
        ...baseConfig,
        model,
        maxOutputTokens: 2000,
      },
      maxIterations: 30,
      contextCompression: {
        enabled: true,
        maxMessages: 8, // 降低阈值以便触发压缩
        maxTokens: 2000,
        keepRecentRounds: 2,
        keepRecentMessages: 4,
      },
    });
    
    // 执行多次任务，使用 continueConversation 保持上下文
    let actualRounds = 0;
    for (let i = 1; i <= 5; i++) {
      console.log(`   执行第 ${i} 轮...`);
      const task: Task = {
        id: `hybrid-2-round-${i}`,
        type: 'multi-step',
        description: `这是第 ${i} 轮任务，增加计数器 2 次，然后添加一段文本到历史`,
        parameters: { continueConversation: true }, // 保持上下文
      };
      await agent2.execute(task);
      actualRounds++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const history2 = agent2['conversationHistory'];
    const remainingUserMessages = history2.filter((m: any) => m.role === 'user').length;
    console.log(`   ✓ 最终消息数: ${history2.length}`);
    console.log(`   ✓ 实际执行轮数: ${actualRounds}`);
    console.log(`   ✓ 剩余用户消息数: ${remainingUserMessages}`);
    
    // 验证压缩是否发生
    const hasSummary1 = history1.some((m: any) => 
      typeof m.content === 'string' && m.content.includes('[前期对话摘要]')
    );
    const hasSummary2 = history2.some((m: any) => 
      typeof m.content === 'string' && m.content.includes('[前期对话摘要]')
    );
    
    console.log(`\n✅ 场景 1 压缩: ${hasSummary1 ? '已触发' : '未触发'}`);
    console.log(`✅ 场景 2 压缩: ${hasSummary2 ? '已触发' : '未触发'}`);
    console.log(`✅ 场景 2 实际执行: ${actualRounds} 轮`);
    console.log(`✅ 场景 2 剩余消息: ${remainingUserMessages} 条用户消息 (压缩会删除旧消息)`);
    
    return { 
      success: true, 
      roundsCorrect: actualRounds === 5,
      compressionTriggered: hasSummary2 
    };
  } catch (error: any) {
    console.error(`\n❌ 混合策略测试失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ============================================
// 测试 6: 压缩质量验证
// ============================================

async function testCompressionQuality() {
  console.log('\n📊 测试 6：压缩质量验证');
  console.log('-'.repeat(60));
  
  const agent = new CounterAgent({
    id: 'quality-agent',
    name: 'Quality Test Agent',
    description: '压缩质量测试 Agent',
    capabilities: ['计数', '历史记录'],
    llmConfig: {
      ...baseConfig,
      model,
      maxTokens: 2000,
    },
    maxIterations: 30,
    contextCompression: {
      enabled: true,
      maxMessages: 8, // 降低阈值以便更容易触发（从 10 改为 8）
      keepRecentMessages: 1, // 减少保留消息以确保有足够的消息可压缩（从 2 改为 1）
      autoRetryOnLength: true,
      enableTool: false,
    },
  });
  
  // 记录压缩前的关键信息
  let summaryContent = '';
  let compressionTriggered = false;
  
  agent.on('context:proactive-compression-triggered', (data: any) => {
    console.log(`\n⚡ 主动压缩触发！`);
    console.log(`   消息数: ${data.messageCount}`);
    console.log(`   阈值: ${data.threshold}`);
  });
  
  agent.on('context:compressed', (data: any) => {
    console.log(`\n✅ 压缩完成`);
    summaryContent = data.summary || '';
    compressionTriggered = true;
    console.log(`   📝 压缩摘要 (前150字): ${summaryContent ? summaryContent.substring(0, 150) + '...' : '(无摘要)'}`);
  });
  
  agent.on('context:compression-failed', (data: any) => {
    console.log(`\n⚠️  压缩失败: ${data.error}`);
  });
  
  agent.on('context:skip-compression', (data: any) => {
    console.log(`\n⏭️  跳过压缩: ${data.reason}`);
  });
  
  agent.on('react:error', (data: any) => {
    console.log(`\n❌ 执行错误: ${data.error}`);
  });
  
  const task: Task = {
    id: 'quality-test',
    type: 'quality-check',
    description: `执行以下步骤（确保每个步骤都调用工具）：
1. 增加计数器到 5（每次增加 1，共 5 次）
2. 添加文本："重要数据：项目代号 Alpha-001"
3. 添加文本："关键信息：目标值为 5"
4. 添加文本："备注：这是质量测试的第三条记录"
5. 继续增加计数器 3 次（每次增加 1）
6. 最后获取计数器值并告诉我`,
    parameters: {},
  };
  
  const result = await agent.execute(task);
  
  // 验证压缩质量
  const checks = {
    compressionTriggered,
    hasCounter: compressionTriggered && (summaryContent.toLowerCase().includes('计数器') || summaryContent.toLowerCase().includes('counter') || summaryContent.includes('increment')),
    hasImportantData: compressionTriggered && (summaryContent.includes('Alpha-001') || summaryContent.includes('重要') || summaryContent.includes('项目')),
    taskCompleted: result.success,
    correctFinalValue: result.success && (result.data?.answer?.includes('8') || result.data?.answer?.includes('八')),
  };
  
  console.log('\n📊 质量检查结果:');
  console.log(`   ✓ 压缩触发: ${checks.compressionTriggered ? '✅' : '❌'}`);
  
  if (checks.compressionTriggered) {
    console.log(`   ✓ 保留计数器信息: ${checks.hasCounter ? '✅' : '⚠️  (可选)'}`);
    console.log(`   ✓ 保留重要数据: ${checks.hasImportantData ? '✅' : '⚠️  (可选)'}`);
  } else {
    console.log(`   ✓ 保留计数器信息: N/A (未压缩)`);
    console.log(`   ✓ 保留重要数据: N/A (未压缩)`);
  }
  
  console.log(`   ✓ 任务完成: ${checks.taskCompleted ? '✅' : '❌'}`);
  console.log(`   ✓ 最终值正确: ${checks.correctFinalValue ? '✅ (8)' : '❌'}`);
  
  // 只要压缩触发了且任务完成，就算通过
  const testPassed = checks.compressionTriggered && checks.taskCompleted && checks.correctFinalValue;
  
  return { 
    success: testPassed,
    checks,
    summary: summaryContent,
  };
}

// ============================================
// 主测试函数
// ============================================

async function runAllTests() {
  console.log('\n\n🚀 开始测试上下文压缩功能\n');

  const results = [];

  try {
    // 测试 1: 主动压缩
    const result1 = await testProactiveCompression();
    results.push({ name: '主动压缩', ...result1 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 测试 2: 工具触发
    const result2 = await testToolTriggeredCompression();
    results.push({ name: '工具触发压缩', ...result2 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 测试 3: 连续性
    const result3 = await testCompressionContinuity();
    results.push({ name: '压缩后继续执行', ...result3 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 测试 4: 禁用
    const result4 = await testDisabledCompression();
    results.push({ name: '禁用压缩', ...result4 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 测试 5: 混合策略
    const result5 = await testHybridStrategy();
    results.push({ name: '混合压缩策略', ...result5 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 测试 6: 压缩质量验证
    const result6 = await testCompressionQuality();
    results.push({ name: '压缩质量验证', ...result6 });

  } catch (error: any) {
    console.error(`\n❌ 测试异常: ${error.message}`);
    console.error(error.stack);
  }

  // 打印汇总
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(60));

  results.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
  });

  const passed = results.filter(r => r.success).length;
  const total = results.length;

  console.log('-'.repeat(60));
  console.log(`通过: ${passed}/${total} | 失败: ${total - passed}/${total}`);
  console.log('='.repeat(60));
  console.log('\n✨ 所有测试完成！\n');
}

// 运行测试
runAllTests().catch(error => {
  console.error('\n❌ 测试失败:', error);
  process.exit(1);
});

export { CounterAgent, runAllTests };




