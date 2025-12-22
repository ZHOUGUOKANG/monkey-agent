/**
 * ChatAgent 集成测试
 * 
 * 测试内容：
 * 1. 意图识别 (Intent Recognition)
 * 2. Workflow 生成 (Multi-Agent Workflow Generation)
 * 3. DAG 验证和拓扑排序
 * 4. 并行执行能力
 * 
 * 使用说明：
 * 1. 在项目根目录的 .env 文件中配置：
 *    OPENAI_API_KEY=your-key
 *    OPENAI_BASE_URL=your-url (可选)
 * 2. 运行测试：
 *    npm test -- chat-agent
 *    或
 *    npx tsx src/chat/__tests__/chat-agent.integration.test.ts
 */

import { ChatAgent, IntentType } from '../ChatAgent';
import { LLMClient } from '@monkey-agent/llm';
import { initEnv, printEnvHelp } from '@monkey-agent/utils';
import type { Workflow } from '@monkey-agent/types';

// ============================================
// 环境检查
// ============================================

const validation = initEnv();
if (!validation.valid) {
  console.error('\n❌ 错误: 未找到 API Key');
  console.error(validation.error);
  printEnvHelp();
  process.exit(1);
}

const apiKey = process.env.OPENROUTER_API_KEY;
const provider = "openrouter";
const baseURL = "https://openrouter.ai/api/v1";
const model = process.env.OPENROUTER_MODEL ;

console.log('\n🧪 ChatAgent 集成测试');
console.log('='.repeat(80));
console.log(`📡 Base URL: ${baseURL}`);
console.log(`🎯 模型: ${model}`);
console.log(`🔧 Provider: ${provider}`);
console.log('='.repeat(80));

// ============================================
// Mock Orchestrator
// ============================================

class MockOrchestrator {
  private agents = new Map();

  registerAgent(agent: any) {
    this.agents.set(agent.id, agent);
  }

  getAvailableAgentTypes(): string[] {
    return ['browser', 'crawler', 'code', 'file', 'image', 'shell', 'computer'];
  }

  getAllAgentInfo() {
    return [
      {
        type: 'browser',
        description: 'Browser automation for web navigation and interaction',
        capabilities: ['navigate', 'click', 'type', 'extract', 'screenshot'],
      },
      {
        type: 'crawler',
        description: 'Web scraping for structured data extraction',
        capabilities: ['extract-list', 'pagination', 'parse-html'],
      },
      {
        type: 'code',
        description: 'Code execution supporting Python, JavaScript, etc.',
        capabilities: ['execute-python', 'execute-js', 'analyze-data'],
      },
      {
        type: 'file',
        description: 'File system operations',
        capabilities: ['read', 'write', 'search', 'organize'],
      },
      {
        type: 'image',
        description: 'Image processing and generation',
        capabilities: ['generate', 'edit', 'analyze', 'convert'],
      },
      {
        type: 'shell',
        description: 'Shell command execution',
        capabilities: ['execute', 'pipe', 'background'],
      },
      {
        type: 'computer',
        description: 'Computer control (mouse, keyboard, screen)',
        capabilities: ['click', 'type', 'screenshot', 'move-mouse'],
      },
    ];
  }
}

// ============================================
// 辅助函数
// ============================================

/**
 * 可视化 Workflow
 */
function visualizeWorkflow(workflow: Workflow) {
  console.log('\n' + '='.repeat(80));
  console.log(`📊 Workflow: ${workflow.name}`);
  console.log('='.repeat(80));
  console.log(`ID: ${workflow.id}`);
  console.log(`Description: ${workflow.description}`);
  console.log(`Agents: ${workflow.agentGraph.length}`);

  // 拓扑排序分层
  const levels = topologicalSort(workflow);
  
  console.log(`\n🔄 Execution Levels: ${levels.length}`);
  levels.forEach((level, index) => {
    const parallel = level.length > 1;
    console.log(`\nLevel ${index + 1}${parallel ? ' ⚡ (Parallel)' : ''}:`);
    level.forEach(agentId => {
      const agent = workflow.agentGraph.find(a => a.id === agentId);
      if (agent) {
        console.log(`  🤖 ${agent.id} [${agent.type}] - ${agent.name}`);
        console.log(`     Steps: ${agent.steps.map(s => s.stepNumber).join(', ')}`);
        if (agent.dependencies.length > 0) {
          console.log(`     Depends on: ${agent.dependencies.join(', ')}`);
        }
      }
    });
  });

  console.log('\n' + '='.repeat(80));
}

/**
 * 拓扑排序
 */
function topologicalSort(workflow: Workflow): string[][] {
  const levels: string[][] = [];
  const visited = new Set<string>();
  const inDegree = new Map<string, number>();

  workflow.agentGraph.forEach(agent => {
    inDegree.set(agent.id, agent.dependencies.length);
  });

  while (visited.size < workflow.agentGraph.length) {
    const currentLevel: string[] = [];
    
    workflow.agentGraph.forEach(agent => {
      if (!visited.has(agent.id) && inDegree.get(agent.id) === 0) {
        currentLevel.push(agent.id);
      }
    });

    if (currentLevel.length === 0) break;

    levels.push(currentLevel);
    
    currentLevel.forEach(agentId => {
      visited.add(agentId);
      workflow.agentGraph.forEach(agent => {
        if (agent.dependencies.includes(agentId)) {
          inDegree.set(agent.id, (inDegree.get(agent.id) || 0) - 1);
        }
      });
    });
  }

  return levels;
}

/**
 * 验证 Workflow
 */
function validateWorkflow(workflow: Workflow): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. 基本字段检查
  if (!workflow.id) errors.push('Missing workflow ID');
  if (!workflow.name) errors.push('Missing workflow name');
  if (!workflow.agentGraph || workflow.agentGraph.length === 0) {
    errors.push('Empty agent graph');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // 2. 检查循环依赖
  const hasCycle = detectCycle(workflow.agentGraph);
  if (hasCycle) {
    errors.push('Circular dependency detected');
  }

  // 3. 检查依赖引用
  const allIds = new Set(workflow.agentGraph.map(a => a.id));
  for (const agent of workflow.agentGraph) {
    for (const dep of agent.dependencies) {
      if (!allIds.has(dep)) {
        errors.push(`Agent ${agent.id} depends on non-existent agent ${dep}`);
      }
    }
  }

  // 4. 检查入口节点
  const hasEntry = workflow.agentGraph.some(a => a.dependencies.length === 0);
  if (!hasEntry) {
    errors.push('No entry point (agent with no dependencies)');
  }

  // 5. 检查步骤编号
  const stepNumbers = workflow.agentGraph
    .flatMap(a => a.steps.map(s => s.stepNumber))
    .sort((a, b) => a - b);
  
  for (let i = 0; i < stepNumbers.length; i++) {
    if (stepNumbers[i] !== i + 1) {
      errors.push(`Step numbers not sequential: expected ${i + 1}, got ${stepNumbers[i]}`);
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 检测循环依赖
 */
function detectCycle(nodes: any[]): boolean {
  const graph = new Map<string, string[]>();
  nodes.forEach(node => graph.set(node.id, node.dependencies));

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    visited.add(nodeId);
    recStack.add(nodeId);

    const deps = graph.get(nodeId) || [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        if (hasCycle(dep)) return true;
      } else if (recStack.has(dep)) {
        return true;
      }
    }

    recStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (hasCycle(node.id)) return true;
    }
  }

  return false;
}

// ============================================
// 测试用例
// ============================================

const testCases = [
  {
    id: 1,
    name: '意图识别 - 信息查询',
    task: '你好，今天天气怎么样？',
    expectedIntent: IntentType.INFORMATION_QUERY, // 询问天气是信息查询
    expectedMultiAgent: false,
  },
  {
    id: 2,
    name: '意图识别 - 单一任务',
    task: '帮我爬取 https://example.com 网站首页的所有标题',
    expectedIntent: IntentType.SINGLE_TASK,
    expectedMultiAgent: false,
  },
  {
    id: 3,
    name: '意图识别 - 复杂工作流',
    task: '帮我爬取淘宝商品数据，用 Python 分析价格趋势，生成可视化图表，最后保存报告到本地',
    expectedIntent: IntentType.COMPLEX_WORKFLOW,
    expectedMultiAgent: true,
  },
  {
    id: 4,
    name: 'Workflow 生成 - 顺序执行',
    task: '从网页爬取文章内容，用 Python 进行文本分析，生成摘要报告并保存',
    expectedIntent: IntentType.COMPLEX_WORKFLOW,
    expectedMultiAgent: true,
    validateWorkflow: true,
  },
  {
    id: 5,
    name: 'Workflow 生成 - 并行执行',
    task: '抓取产品评论数据，同时进行情感分析和生成词云图，最后整合结果保存',
    expectedIntent: IntentType.COMPLEX_WORKFLOW,
    expectedMultiAgent: true,
    validateWorkflow: true,
    expectParallel: true,
  },
];

// ============================================
// 运行测试
// ============================================

async function runTests() {
  console.log('\n🚀 开始测试...\n');

  // 创建 LLM Client
  const llmClient = new LLMClient({
    provider: provider as any,
    apiKey,
    model,
    baseURL,
    // temperature: 0.7,
    maxTokens: 15000, // 增加 token 限制以支持复杂 workflow 生成
  });

  // 创建 ChatAgent
  const orchestrator = new MockOrchestrator();
  const chatAgent = new ChatAgent({
    llmClient,
    orchestrator,
  });

  console.log('✅ ChatAgent 初始化成功\n');

  let passedTests = 0;
  let failedTests = 0;

  // 执行测试用例
  for (const testCase of testCases) {
    console.log('\n' + '█'.repeat(80));
    console.log(`📋 Test ${testCase.id}: ${testCase.name}`);
    console.log('█'.repeat(80));
    console.log(`\n💬 Task: ${testCase.task}\n`);

    try {
      // 步骤 1: 意图识别
      console.log('⏳ 步骤 1: 分析意图...');
      const intentResult = await chatAgent.analyzeIntent(testCase.task);
      
      console.log(`\n✅ 意图识别完成:`);
      console.log(`   Intent: ${intentResult.intent}`);
      console.log(`   Confidence: ${(intentResult.confidence * 100).toFixed(1)}%`);
      console.log(`   Needs Multi-Agent: ${intentResult.needsMultiAgent ? '✅' : '❌'}`);
      console.log(`   Explanation: ${intentResult.explanation}`);

      // 验证意图
      const intentMatch = intentResult.intent === testCase.expectedIntent;
      const multiAgentMatch = intentResult.needsMultiAgent === testCase.expectedMultiAgent;

      if (!intentMatch) {
        console.warn(`   ⚠️  Expected intent: ${testCase.expectedIntent}, got: ${intentResult.intent}`);
      }
      if (!multiAgentMatch) {
        console.warn(`   ⚠️  Expected multi-agent: ${testCase.expectedMultiAgent}, got: ${intentResult.needsMultiAgent}`);
      }

      // 步骤 2: Workflow 生成（如果需要）
      if (testCase.validateWorkflow && intentResult.needsMultiAgent) {
        console.log('\n⏳ 步骤 2: 生成工作流...');
        const workflow = await chatAgent.createWorkflow(testCase.task);

        console.log('\n✅ 工作流生成成功!');
        
        // 验证 Workflow
        const validation = validateWorkflow(workflow);
        if (!validation.valid) {
          console.error(`\n❌ Workflow 验证失败:`);
          validation.errors.forEach(err => console.error(`   - ${err}`));
          failedTests++;
          continue;
        } else {
          console.log('✅ Workflow 验证通过');
        }

        // 可视化
        visualizeWorkflow(workflow);

        // 检查并行执行
        const levels = topologicalSort(workflow);
        const hasParallel = levels.some(level => level.length > 1);
        
        if (testCase.expectParallel && !hasParallel) {
          console.warn('   ⚠️  Expected parallel execution but none found');
        }
        
        if (hasParallel) {
          console.log('\n✅ 包含并行执行层级');
        }
      }

      console.log('\n✅ 测试通过');
      passedTests++;

    } catch (error: any) {
      console.error(`\n❌ 测试失败: ${error.message}`);
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
      failedTests++;
    }

    // 只运行前 3 个测试以节省成本
    // if (testCase.id === 3) {
    //   console.log('\n\n💡 Note: 只运行前 3 个测试用例以节省 API 成本');
    //   console.log('   如需测试所有用例，请删除此限制');
    //   break;
    // }
  }

  // 输出测试摘要
  console.log('\n' + '='.repeat(80));
  console.log('📊 测试摘要');
  console.log('='.repeat(80));
  console.log(`✅ 通过: ${passedTests}`);
  console.log(`❌ 失败: ${failedTests}`);
  console.log(`📋 总计: ${passedTests + failedTests}`);
  console.log('='.repeat(80) + '\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

// ============================================
// 执行
// ============================================

runTests().catch(error => {
  console.error('\n❌ 测试运行失败:', error);
  process.exit(1);
});

