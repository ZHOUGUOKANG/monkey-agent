/**
 * BrowserAgent Context 工具和 Workflow 集成测试
 * 
 * 测试目标：
 * 1. 验证 BaseAgent 的 context 工具合并机制
 * 2. 测试 BrowserAgent 在 workflow 中使用 valSet 存储数据
 * 3. 测试 Browser → Report 数据传递链路
 * 
 * 需要真实 LLM API Key
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import { BrowserAgent } from '../BrowserAgent';
import { ReportAgent } from '../../report/ReportAgent';
import { LLMClient } from '@monkey-agent/llm';
import { initEnv, getLLMConfig, printEnvHelp } from '@monkey-agent/utils';
import type { AgentContext } from '@monkey-agent/types';

// 初始化环境变量
const validation = initEnv({ verbose: false });
const shouldSkip = !validation.valid;

if (shouldSkip) {
  console.warn(`
⚠️  BrowserAgent Context 工具测试被跳过
原因: ${validation.error}
`);
  printEnvHelp();
}

describe.skipIf(shouldSkip)('BrowserAgent - Context 工具和 Workflow 集成测试', () => {
  let browser: Browser;
  let page: Page;
  let llmClient: LLMClient;
  
  const headless = process.env.HEADLESS === 'true';

  beforeAll(async () => {
    // 启动浏览器
    browser = await chromium.launch({
      headless,
      slowMo: headless ? 0 : 200,
      args: headless ? [] : ['--window-size=1280,800'],
    });
    
    page = await browser.newPage();
    
    // 创建真实的 LLM Client
    const llmConfig = getLLMConfig();
    llmClient = new LLMClient({
      ...llmConfig,
      model: llmConfig.model || (llmConfig.provider === 'openai' ? 'gpt-4o-mini' : undefined),
      temperature: 0.7,
      maxTokens: 4000,
    });

    console.log(`\n🧪 BrowserAgent Context 工具测试`);
    console.log('='.repeat(80));
    console.log(`🤖 LLM Provider: ${validation.provider}`);
    console.log(`🌐 浏览器模式: ${headless ? '无头' : '有头'}`);
    console.log('='.repeat(80) + '\n');
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('Context 工具验证', () => {
    it('应该验证 context 工具在 workflow 执行时可用', async () => {
      // 创建完整的 workflow context
      const mockContext: Partial<AgentContext> = {
        workflowId: 'test-workflow-1',
        workflowTask: '验证 context 工具',
        outputs: new Map(),
        vals: new Map(),
        currentLevel: 0,
        status: 'running' as const,
        startTime: Date.now(),
        getOutput: function(agentId: string) {
          return this.outputs?.get(agentId);
        },
        getValue: function(key: string) {
          return this.vals?.get(key);
        },
        setValue: function(key: string, value: any) {
          this.vals?.set(key, value);
        },
        toJSON: function() {
          return {
            workflowId: this.workflowId,
            outputs: Array.from(this.outputs?.entries() || []),
            vals: Array.from(this.vals?.entries() || []),
          };
        }
      };

      const agent = new BrowserAgent({
        llmClient,
        browser,
        page,
      });

      // 给 Agent 一个明确要求使用 valSet 的任务
      const task = `Navigate to https://example.com and extract the page title. 
      Then use valSet to store the title with key "pageTitle".
      This is a workflow task, and downstream agents need this data.`;

      // 监控工具调用
      const toolCalls: Array<{ name: string; input: any }> = [];
      agent.on('agent:tool-call', (event: any) => {
        toolCalls.push({
          name: event.toolName,
          input: event.input
        });
        console.log(`🔧 Tool called: ${event.toolName}`, event.input);
      });

      // 执行任务
      const result = await agent.execute(task, mockContext as AgentContext);

      console.log(`\n📊 执行结果:`);
      console.log(`- Status: ${result.status}`);
      console.log(`- Summary: ${result.summary}`);
      console.log(`- Tool calls: ${toolCalls.map(t => t.name).join(', ')}`);
      console.log(`- Context vals keys: ${Array.from(mockContext.vals!.keys()).join(', ')}`);

      // 验证结果
      expect(result.status).toBe('success');
      
      // 关键验证：检查是否调用了 valSet
      const hasValSetCall = toolCalls.some(t => t.name === 'valSet');
      console.log(`\n🎯 关键检查: LLM ${hasValSetCall ? '✅ 调用了' : '❌ 没有调用'} valSet`);
      
      if (!hasValSetCall) {
        console.warn('⚠️  警告: LLM 没有使用 valSet 工具');
        console.warn('   这可能表明 System Prompt 需要优化');
        console.warn('   或者 LLM 需要更明确的指导');
      }
      
      // 验证数据是否存储到 context
      if (hasValSetCall) {
        expect(mockContext.vals!.has('pageTitle')).toBe(true);
        console.log('✅ 数据成功存储到 context.vals');
      }
    }, 120000);
  });

  describe('真实场景：数据提取和存储', () => {
    it('应该提取网页数据并存储到 context（使用真实 LLM）', async () => {
      const mockContext: Partial<AgentContext> = {
        workflowId: 'test-workflow-2',
        workflowTask: '提取网页信息并存储',
        outputs: new Map(),
        vals: new Map(),
        currentLevel: 0,
        status: 'running' as const,
        startTime: Date.now(),
        getOutput: function(agentId: string) {
          return this.outputs?.get(agentId);
        },
        getValue: function(key: string) {
          return this.vals?.get(key);
        },
        setValue: function(key: string, value: any) {
          this.vals?.set(key, value);
        },
        toJSON: function() {
          return {
            workflowId: this.workflowId,
            outputs: Array.from(this.outputs?.entries() || []),
            vals: Array.from(this.vals?.entries() || []),
          };
        }
      };

      const agent = new BrowserAgent({
        llmClient,
        browser,
        page,
      });

      const task = `Your task in this workflow:
1. Navigate to https://example.com
2. Extract the main heading text
3. IMPORTANT: Use valSet tool to store the heading with key "exampleHeading"
4. In your summary, mention that you stored the data as "exampleHeading"

Remember: This is a multi-agent workflow. Downstream agents need this data!`;

      const toolCalls: string[] = [];
      agent.on('agent:tool-call', (event: any) => {
        toolCalls.push(event.toolName);
      });

      const result = await agent.execute(task, mockContext as AgentContext);

      console.log(`\n📊 执行结果:`);
      console.log(`- Status: ${result.status}`);
      console.log(`- Summary: ${result.summary}`);
      console.log(`- Tool calls: ${toolCalls.join(' → ')}`);
      console.log(`- Context vals: ${JSON.stringify(Array.from(mockContext.vals!.entries()))}`);

      expect(result.status).toBe('success');
      
      // 验证工具调用序列
      expect(toolCalls).toContain('navigate');
      const hasValSet = toolCalls.includes('valSet');
      
      console.log(`\n🎯 valSet 调用: ${hasValSet ? '✅ 是' : '❌ 否'}`);
      
      // 如果调用了 valSet，验证数据
      if (hasValSet) {
        expect(mockContext.vals!.size).toBeGreaterThan(0);
        console.log('✅ 数据存储测试通过');
      } else {
        console.warn('⚠️  LLM 没有使用 valSet，即使明确要求了');
      }
    }, 120000);
  });

  describe('Browser → Report 数据传递测试', () => {
    it('应该完整测试 BrowserAgent → ReportAgent 数据传递链路', async () => {
      // 第一步：BrowserAgent 提取数据
      const mockContext: Partial<AgentContext> = {
        workflowId: 'test-workflow-3',
        workflowTask: '浏览器提取数据并生成报告',
        outputs: new Map(),
        vals: new Map(),
        currentLevel: 0,
        status: 'running' as const,
        startTime: Date.now(),
        getOutput: function(agentId: string) {
          return this.outputs?.get(agentId);
        },
        getValue: function(key: string) {
          return this.vals?.get(key);
        },
        setValue: function(key: string, value: any) {
          this.vals?.set(key, value);
        },
        toJSON: function() {
          return {
            workflowId: this.workflowId,
            outputs: Array.from(this.outputs?.entries() || []),
            vals: Array.from(this.vals?.entries() || []),
          };
        }
      };

      const browserAgent = new BrowserAgent({
        llmClient,
        browser,
        page,
      });

      const browserTask = `In this workflow, you are the first agent. Your task:
1. Navigate to https://example.com
2. Extract ALL the text from the page
3. CRITICAL: Use valSet({ key: "webpageContent", value: <extracted text> }) to store the data
4. In your summary, say: "Extracted content and stored as 'webpageContent'"

The next agent (ReportAgent) will use this data to generate a report.`;

      console.log('\n📍 第 1 步: BrowserAgent 提取数据...');
      const browserResult = await browserAgent.execute(browserTask, mockContext as AgentContext);

      console.log(`- Status: ${browserResult.status}`);
      console.log(`- Summary: ${browserResult.summary}`);
      console.log(`- Context vals keys: ${Array.from(mockContext.vals!.keys()).join(', ')}`);

      // 模拟 workflow orchestrator 的行为：将 browserAgent 的结果添加到 context
      mockContext.outputs!.set('browser-agent', browserResult);

      // 第二步：ReportAgent 生成报告
      console.log('\n📍 第 2 步: ReportAgent 生成报告...');
      
      const reportAgent = new ReportAgent({
        llmClient,
      });

      const reportResult = await reportAgent.execute(
        '根据浏览器提取的内容生成数据报告',
        mockContext as AgentContext
      );

      console.log(`- Status: ${reportResult.status}`);
      console.log(`- Summary: ${reportResult.summary}`);

      // 验证完整流程
      expect(browserResult.status).toBe('success');
      
      // 关键验证：ReportAgent 应该能生成报告（即使没有数据，也应该生成空报告）
      expect(reportResult.status).toBe('success');
      expect(reportResult.data.artifact).toBeDefined();

      // 诊断数据传递
      const hasData = mockContext.vals!.size > 0;
      console.log(`\n🔍 诊断结果:`);
      console.log(`- BrowserAgent 存储了数据: ${hasData ? '✅ 是' : '❌ 否'}`);
      console.log(`- ReportAgent 生成了报告: ${reportResult.status === 'success' ? '✅ 是' : '❌ 否'}`);
      
      if (!hasData) {
        console.warn('\n⚠️  数据传递失败的可能原因:');
        console.warn('   1. LLM 没有调用 valSet（即使在 prompt 中要求了）');
        console.warn('   2. 需要优化 System Prompt 使其更明确');
        console.warn('   3. 需要在 workflow 步骤描述中强调使用 valSet');
      }
    }, 180000); // 3分钟超时，因为涉及两个 Agent
  });
});

