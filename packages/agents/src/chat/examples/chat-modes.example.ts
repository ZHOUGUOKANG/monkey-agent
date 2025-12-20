/**
 * ChatAgent 使用示例
 * 
 * 展示两种模式：
 * 1. 简单对话模式（无需 orchestrator）
 * 2. 完整工作流生成模式（需要 orchestrator）
 */

import { ChatAgent } from '@monkey-agent/agents';
import { LLMClient } from '@monkey-agent/llm';
import { WorkflowOrchestrator } from '@monkey-agent/orchestrator';

// ============ 模式 1: 简单对话模式 ============

console.log('=== 模式 1: 简单对话（无需 Orchestrator）===\n');

// 创建 ChatAgent - 只需要 LLM 客户端
const simpleChatAgent = new ChatAgent({
  llmClient: new LLMClient({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || 'sk-...',
    model: 'gpt-4',
  }),
});

// 查看工具定义
const simpleTools = simpleChatAgent.getToolDefinitions();
console.log('Simple mode tools:', Object.keys(simpleTools));
// 输出: Simple mode tools: []

// 使用场景 1: 普通对话
async function simpleChatExample() {
  const result = await simpleChatAgent.execute('你好，今天天气怎么样？');
  console.log('Chat Response:', result.data);
}

// 使用场景 2: 意图识别（不需要 orchestrator）
async function intentExample() {
  const intent = await simpleChatAgent.analyzeIntent('帮我查一下今天的新闻');
  console.log('Intent:', intent);
}

// 使用场景 3: 尝试生成工作流会报错（友好提示）
async function workflowErrorExample() {
  try {
    await simpleChatAgent.createWorkflow('从网站爬取数据');
  } catch (error: any) {
    console.log('Expected Error:', error.message);
    // 输出: ChatAgent cannot generate workflow without orchestrator or getAgentsInfo.
    //       Please provide either orchestrator or getAgentsInfo in the config.
  }
}

// ============ 模式 2: 完整工作流生成模式 ============

console.log('\n=== 模式 2: 工作流生成（需要 Orchestrator）===\n');

// 创建 Orchestrator 并注册 Agents
const orchestrator = new WorkflowOrchestrator();
// orchestrator.registerAgent(new PlaywrightBrowserAgent({ ... }));
// orchestrator.registerAgent(new CodeAgent({ ... }));

// 创建 ChatAgent - 提供 orchestrator
const fullChatAgent = new ChatAgent({
  llmClient: new LLMClient({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || 'sk-...',
    model: 'gpt-4',
  }),
  orchestrator: orchestrator,
});

// 查看工具定义
const fullTools = fullChatAgent.getToolDefinitions();
console.log('Full mode tools:', Object.keys(fullTools));
// 输出: Full mode tools: ['recognizeIntent', 'generateWorkflow', 'chat']

// 使用场景 1: 生成并执行工作流
async function fullWorkflowExample() {
  // 1. 生成工作流
  const workflow = await fullChatAgent.createWorkflow(
    '从网站爬取产品数据，用Python分析价格趋势，生成可视化图表'
  );
  
  console.log('Generated Workflow:', workflow);
  
  // 2. 执行工作流
  const result = await orchestrator.executeWorkflow(workflow);
  console.log('Execution Result:', result);
}

// 使用场景 2: 动态添加 Agent
async function dynamicAgentExample() {
  // 稍后添加新的 Agent
  // orchestrator.registerAgent(new ImageAgent({ id: 'image' }));
  
  // ChatAgent 会自动感知新 Agent（因为使用函数注入）
  const workflow = await fullChatAgent.createWorkflow('生成一张图片');
  console.log('Workflow with new agent:', workflow);
}

// ============ 对比总结 ============

console.log('\n=== 配置对比 ===\n');

console.log(`
简单对话模式：
✅ 只需要 llmClient
✅ 无工具（空对象 {}）
✅ 简化的 system prompt
✅ 可以: 普通对话、意图识别
❌ 不可以: 生成工作流

完整工作流模式：
✅ 需要 llmClient + orchestrator
✅ 完整工具集（recognizeIntent, generateWorkflow, chat）
✅ 包含 Agent 信息的 system prompt
✅ 可以: 普通对话、意图识别、生成工作流
✅ 动态感知新注册的 Agent
`);

// 运行示例
async function main() {
  console.log('\n=== 运行示例 ===\n');
  
  // 模式 1 示例
  await simpleChatExample();
  await intentExample();
  await workflowErrorExample();
  
  // 模式 2 示例
  // await fullWorkflowExample();
  // await dynamicAgentExample();
}

// main().catch(console.error);

export {
  simpleChatAgent,
  fullChatAgent,
  simpleChatExample,
  intentExample,
  fullWorkflowExample,
};

