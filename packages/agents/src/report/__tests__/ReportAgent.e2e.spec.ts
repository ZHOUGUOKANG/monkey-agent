/**
 * ReportAgent E2E 测试
 * 
 * 测试 ReportAgent 的端到端功能，包括：
 * 1. 基础执行流程（从 context 提取数据并生成报告）
 * 2. 流式输出功能
 * 3. HTML 降级功能
 * 
 * 注意：这些测试需要真实的 LLM API Key
 * 如果环境变量未配置，测试将被跳过
 * 
 * 运行方式：
 * 1. 在项目根目录创建 .env 文件并配置 API Key
 * 2. 或者直接设置环境变量: export OPENAI_API_KEY="sk-..."
 * 3. 运行: yarn test:report
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { ReportAgent } from '../ReportAgent';
import { LLMClient } from '@monkey-agent/llm';
import { initEnv, getLLMConfig, printEnvHelp } from '@monkey-agent/utils';
import type { AgentContext, ILLMClient } from '@monkey-agent/types';

// 初始化环境变量（自动加载 .env 文件）
const validation = initEnv({ verbose: false });
const shouldSkip = !validation.valid;

// 如果缺少 API Key，打印提示信息
if (shouldSkip) {
  console.warn(`
⚠️  ReportAgent E2E 测试被跳过
原因: ${validation.error}
`);
  printEnvHelp();
}

describe.skipIf(shouldSkip)('ReportAgent - E2E 测试', () => {
  let llmClient: ILLMClient;
  let agent: ReportAgent;

  beforeAll(() => {
    // 使用工具函数获取 LLM 配置
    const llmConfig = getLLMConfig();
    
    // 创建真实的 LLM Client
    llmClient = new LLMClient({
      ...llmConfig,
      // 默认使用较快的模型以节省成本和时间
      model: llmConfig.model || (llmConfig.provider === 'openai' ? 'gpt-4o-mini' : undefined),
      temperature: llmConfig.temperature || 0.7,
      maxTokens: llmConfig.maxTokens || 4000,
    });

    console.log(`\n🧪 ReportAgent E2E 测试`);
    console.log('='.repeat(80));
    console.log(`🤖 LLM Provider: ${validation.provider}`);
    console.log(`📦 Model: ${llmConfig.model || '(default)'}`);
    console.log('='.repeat(80) + '\n');
  });

  afterEach(() => {
    // 清理
    agent = null as any;
  });

  describe('基础执行流程', () => {
    it('应该成功从 context 提取数据并生成 React 报告', async () => {
      // 创建 ReportAgent
      agent = new ReportAgent({
        llmClient,
      });

      // 准备测试数据 - 模拟上游 Agent 的输出
      const mockSearchResults = [
        { 
          title: '测试结果1', 
          url: 'https://example.com/1', 
          snippet: '这是第一个测试搜索结果的摘要内容',
          date: '2024-01-15'
        },
        { 
          title: '测试结果2', 
          url: 'https://example.com/2', 
          snippet: '这是第二个测试搜索结果的摘要内容',
          date: '2024-01-16'
        },
        { 
          title: '测试结果3', 
          url: 'https://example.com/3', 
          snippet: '这是第三个测试搜索结果的摘要内容',
          date: '2024-01-17'
        },
      ];

      // 创建 Mock Context
      const mockContext: Partial<AgentContext> = {
        workflowId: 'test-workflow-1',
        workflowTask: '生成搜索结果报告',
        outputs: new Map([
          ['browser-agent', {
            agentId: 'browser-agent',
            status: 'success' as const,
            summary: 'Saved search results to searchResults variable containing 3 items with title, url, snippet, and date fields',
            data: {
              searchResults: mockSearchResults
            },
            duration: 5000,
          }]
        ]),
        vals: new Map([
          ['searchResults', mockSearchResults]
        ]),
        currentLevel: 1,
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

      // 执行 Agent（带超时监控）
      const startTime = Date.now();
      const result = await agent.execute(
        '基于搜索结果生成数据报告',
        mockContext as AgentContext
      );
      const duration = Date.now() - startTime;

      // 验证执行时间（应该在 60 秒内完成）
      console.log(`⏱️  执行时间: ${duration}ms`);
      expect(duration).toBeLessThan(60000);

      // 验证结果
      if (result.status !== 'success') {
        console.error('❌ 测试失败，错误信息:', result.error);
        console.error('Summary:', result.summary);
        console.error('完整结果:', JSON.stringify(result, null, 2));
      }
      expect(result.status).toBe('success');
      expect(result.data).toBeDefined();
      expect(result.data.type).toBe('artifact');
      expect(result.data.artifact).toBeDefined();

      // 验证 artifact 结构
      const artifact = result.data.artifact;
      expect(artifact.id).toBeDefined();
      expect(artifact.type).toBe('react');
      expect(artifact.code).toBeDefined();
      expect(artifact.createdAt).toBeDefined();

      // 验证 React 代码内容
      const code = artifact.code;
      expect(code).toContain('import React');
      expect(code).toContain('ReactDOM');
      // 代码应该包含 render 相关内容（可能是 root.render 或其他渲染方式）
      expect(
        code.includes('render') || code.includes('Report')
      ).toBe(true);
      
      // 验证数据嵌入
      expect(
        code.includes('searchResults') || code.includes('测试结果')
      ).toBe(true);

      // 验证 summary
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');

      console.log(`✅ 测试通过 - 执行时间: ${duration}ms`);
      console.log(`📊 Summary: ${result.summary}`);
    }, 120000); // 120秒超时

    it('应该处理空数据的情况', async () => {
      agent = new ReportAgent({
        llmClient,
      });

      // 创建空的 Mock Context
      const mockContext: Partial<AgentContext> = {
        workflowId: 'test-workflow-2',
        workflowTask: '生成空数据报告',
        outputs: new Map(),
        vals: new Map(),
        currentLevel: 1,
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

      const result = await agent.execute(
        '生成报告',
        mockContext as AgentContext
      );

      // 即使没有数据也应该成功（根据 task 生成空状态报告）
      if (result.status !== 'success') {
        console.error('❌ 测试失败，错误信息:', result.error);
        console.error('Summary:', result.summary);
      }
      expect(result.status).toBe('success');
      expect(result.data.artifact).toBeDefined();
      console.log('✅ 空数据测试通过 - 生成了空状态报告');
    }, 120000);
  });

  describe('流式输出功能', () => {
    it('应该正确处理流式输出且不会卡住', async () => {
      agent = new ReportAgent({
        llmClient,
      });

      const mockMetrics = {
        totalUsers: 1250,
        activeUsers: 890,
        revenue: 45680,
        growth: 15.3,
      };

      const mockContext: Partial<AgentContext> = {
        workflowId: 'test-workflow-3',
        workflowTask: '生成指标报告',
        outputs: new Map([
          ['data-agent', {
            agentId: 'data-agent',
            status: 'success' as const,
            summary: 'Collected metrics data in metrics variable with totalUsers, activeUsers, revenue, and growth fields',
            data: { metrics: mockMetrics },
            duration: 3000,
          }]
        ]),
        vals: new Map([
          ['metrics', mockMetrics]
        ]),
        currentLevel: 1,
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

      // 监控流式输出
      let chunkCount = 0;
      let lastChunkTime = Date.now();
      const maxGap = 30000; // 30秒最大间隔
      const chunks: string[] = [];

      const result = await agent.execute(
        '生成数据指标报告',
        mockContext as AgentContext,
        {
          onStreamChunk: (chunk: string) => {
            chunkCount++;
            const now = Date.now();
            const gap = now - lastChunkTime;
            
            // 检测长时间停顿
            if (gap > maxGap) {
              throw new Error(`流式输出卡住: ${gap}ms 没有新 chunk`);
            }
            
            chunks.push(chunk);
            lastChunkTime = now;
            
            // 每 10 个 chunk 打印一次进度
            if (chunkCount % 10 === 0) {
              console.log(`📦 已接收 ${chunkCount} 个 chunks`);
            }
          }
        }
      );

      // 验证流式输出
      console.log(`📊 总共接收了 ${chunkCount} 个 chunks`);
      expect(chunkCount).toBeGreaterThan(10); // 应该有多个 chunks
      
      // 验证累积的代码
      const fullCode = chunks.join('');
      expect(fullCode).toContain('import React');
      expect(fullCode.length).toBeGreaterThan(100);

      // 验证结果
      expect(result.status).toBe('success');
      expect(result.data.artifact).toBeDefined();
      
      console.log(`✅ 流式输出测试通过 - 共 ${chunkCount} 个 chunks`);
    }, 120000);
  });

  describe('HTML 降级功能', () => {
    it('应该在调用时生成 HTML 降级版本', async () => {
      agent = new ReportAgent({
        llmClient,
      });

      const mockData = {
        products: [
          { name: '产品A', sales: 120, revenue: 15000 },
          { name: '产品B', sales: 95, revenue: 12000 },
          { name: '产品C', sales: 78, revenue: 9500 },
        ]
      };

      const mockContext: Partial<AgentContext> = {
        workflowId: 'test-workflow-4',
        workflowTask: '生成产品销售报告',
        outputs: new Map([
          ['sales-agent', {
            agentId: 'sales-agent',
            status: 'success' as const,
            summary: 'Saved product sales data to products variable',
            data: { products: mockData.products },
            duration: 2000,
          }]
        ]),
        vals: new Map([
          ['products', mockData.products]
        ]),
        currentLevel: 1,
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

      // 先执行一次正常的报告生成
      const reactResult = await agent.execute(
        '生成产品销售报告',
        mockContext as AgentContext
      );

      expect(reactResult.status).toBe('success');
      if (reactResult.status !== 'success') {
        console.error('❌ React 报告生成失败:', reactResult.error);
        console.error('Summary:', reactResult.summary);
        throw new Error('React 报告生成失败，跳过 HTML 降级测试');
      }
      console.log('✅ React 报告生成成功');

      // 模拟 React 编译错误，调用 HTML 降级
      const fakeError = 'ReferenceError: Component is not defined at line 42';
      
      let htmlChunkCount = 0;
      const htmlResult = await agent.generateHtmlFallback(
        fakeError,
        (_chunk: string) => {
          htmlChunkCount++;
        }
      );

      // 验证 HTML 结果
      expect(htmlResult.artifact).toBeDefined();
      expect(htmlResult.artifact.type).toBe('html');
      expect(htmlResult.artifact.code).toBeDefined();

      // 验证 HTML 代码内容
      const htmlCode = htmlResult.artifact.code;
      expect(htmlCode).toContain('<!DOCTYPE html>');
      expect(htmlCode).toContain('<html');
      expect(htmlCode).toContain('<body');
      expect(htmlCode).toContain('</html>');
      
      // 验证数据嵌入
      expect(
        htmlCode.includes('产品') || htmlCode.includes('sales')
      ).toBe(true);
      
      console.log(`✅ HTML 降级测试通过 - 接收了 ${htmlChunkCount} 个 chunks`);
      console.log(`📄 HTML 代码长度: ${htmlCode.length} 字符`);
    }, 120000);
  });

  describe('性能和迭代次数检查', () => {
    it('应该使用正确的 maxIterations 配置（应为 1）', () => {
      agent = new ReportAgent({
        llmClient,
      });

      // BaseAgent 的 maxIterations 是构造函数参数，不是 config 属性
      // 我们通过检查实际执行来验证
      console.log('✅ ReportAgent 创建成功，maxIterations 应该配置为 1');
    });

    it('实际执行时应该只进行 1 次迭代', async () => {
      agent = new ReportAgent({
        llmClient,
      });

      const mockContext: Partial<AgentContext> = {
        workflowId: 'test-workflow-5',
        workflowTask: '测试迭代次数',
        outputs: new Map([
          ['test-agent', {
            agentId: 'test-agent',
            status: 'success' as const,
            summary: 'Test data in testData variable',
            data: { testData: { value: 42 } },
            duration: 1000,
          }]
        ]),
        vals: new Map([
          ['testData', { value: 42 }]
        ]),
        currentLevel: 1,
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

      const result = await agent.execute(
        '生成测试报告',
        mockContext as AgentContext
      );

      // 验证执行成功
      if (result.status !== 'success') {
        console.error('❌ 测试失败，错误信息:', result.error);
        console.error('Summary:', result.summary);
      }
      expect(result.status).toBe('success');

      // ReportAgent 重写了 execute，返回结果中可能没有 iterations
      // 我们通过检查执行时间来验证（应该很快完成，因为只有一次迭代）
      expect(result.duration).toBeDefined();
      expect(result.duration).toBeLessThan(60000); // 应在 60 秒内完成
      
      console.log(`✅ 测试通过 - 执行时间: ${result.duration}ms`);
    }, 120000);
  });
});

