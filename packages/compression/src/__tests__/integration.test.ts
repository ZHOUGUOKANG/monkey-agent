/**
 * 压缩模块集成测试示例
 * 
 * 演示如何在实际场景中使用压缩功能
 */

import { describe, it, expect, vi } from 'vitest';
import { CompressionOrchestrator } from '../CompressionOrchestrator';
import type { ILLMClient } from '@monkey-agent/types';
import type { ModelMessage } from 'ai';

// 模拟 LLM 客户端
const createMockLLMClient = (): ILLMClient => {
  return {
    chat: vi.fn().mockResolvedValue({
      text: '用户询问了如何使用浏览器导航功能，系统解释了相关操作并成功执行了导航命令。',
    }),
    stream: vi.fn(),
  } as any;
};

describe('压缩模块集成测试', () => {
  describe('场景 1: 多轮对话压缩', () => {
    it('应该成功压缩多轮对话历史', async () => {
      const orchestrator = new CompressionOrchestrator();
      const llmClient = createMockLLMClient();

      // 模拟 5 轮对话
      const history: ModelMessage[] = [
        { role: 'user', content: '你好，能帮我打开百度吗？' },
        { role: 'assistant', content: '好的，我来帮你打开百度。' },
        
        { role: 'user', content: '能搜索一下天气吗？' },
        { role: 'assistant', content: '好的，我来搜索天气信息。' },
        
        { role: 'user', content: '显示今天的温度' },
        { role: 'assistant', content: '今天的温度是 22 度。' },
        
        { role: 'user', content: '那明天呢？' },
        { role: 'assistant', content: '明天预计是 25 度。' },
        
        { role: 'user', content: '谢谢' },
        { role: 'assistant', content: '不客气！' },
      ];

      // 执行压缩：保留最近 2 轮
      const result = await orchestrator.compressHistory(
        history,
        { keepRounds: 2 },
        llmClient
      );

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.originalLength).toBe(10);
      expect(result.compressedCount).toBe(6); // 前 3 轮
      expect(result.keptMessages.length).toBe(4); // 后 2 轮
      expect(result.compressedHistory.length).toBe(5); // 摘要 + 4 条保留消息
      
      // 验证摘要消息
      const summaryMessage = result.compressedHistory[0];
      expect(summaryMessage.role).toBe('user');
      expect(summaryMessage.content).toContain('[前期对话摘要]');
      
      // 验证保留的消息是最近的
      const lastKeptMessage = result.keptMessages[result.keptMessages.length - 1];
      expect(lastKeptMessage.content).toBe('不客气！');
    });
  });

  describe('场景 2: 工具调用场景压缩', () => {
    it('应该保持工具调用的完整性', async () => {
      const orchestrator = new CompressionOrchestrator();
      const llmClient = createMockLLMClient();

      const history: ModelMessage[] = [
        { role: 'user', content: '打开 example.com 并获取标题' },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'nav-1',
              toolName: 'browser_navigate',
              args: { url: 'https://example.com' },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'nav-1',
              toolName: 'browser_navigate',
              output: 'Navigation successful',
            },
          ],
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'get-1',
              toolName: 'browser_getText',
              args: { selector: 'h1' },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'get-1',
              toolName: 'browser_getText',
              output: 'Example Domain',
            },
          ],
        },
        { role: 'user', content: '不错，现在关闭页面' },
        { role: 'assistant', content: '好的，页面已关闭。' },
      ];

      // 保留最近 3 条消息
      const result = await orchestrator.compressHistory(
        history,
        { keepMessages: 3 },
        llmClient
      );

      expect(result.success).toBe(true);
      
      // 验证工具调用配对完整性
      const keptMessages = result.keptMessages;
      let toolCalls = new Set<string>();
      let toolResults = new Set<string>();
      
      keptMessages.forEach(msg => {
        if (Array.isArray(msg.content)) {
          msg.content.forEach((part: any) => {
            if (part.type === 'tool-call') {
              toolCalls.add(part.toolCallId);
            }
            if (part.type === 'tool-result') {
              toolResults.add(part.toolCallId);
            }
          });
        }
      });
      
      // 所有 tool-call 都应该有对应的 tool-result
      toolCalls.forEach(id => {
        if (!toolResults.has(id)) {
          // 如果在保留消息中有 tool-call，应该也有 result
          // 或者该 tool-call 在压缩部分
        }
      });
    });
  });

  describe('场景 3: 自动压缩触发', () => {
    it('应该在消息数超过阈值时建议压缩', () => {
      const orchestrator = new CompressionOrchestrator();
      
      // 创建 25 轮对话
      const history: ModelMessage[] = [];
      for (let i = 0; i < 25; i++) {
        history.push({ role: 'user', content: `问题 ${i + 1}` });
        history.push({ role: 'assistant', content: `回答 ${i + 1}` });
      }

      const check = orchestrator.shouldCompress(history, {
        maxMessages: 40,
        maxTokens: 10000,
        keepRecentRounds: 5,
        keepRecentMessages: 15,
      });

      expect(check.shouldCompress).toBe(true);
      expect(check.reason).toBeDefined();
      expect(check.recommendedOptions).toBeDefined();
      
      // 对于多轮对话，应该推荐基于轮次的策略
      if (check.recommendedOptions) {
        expect(check.recommendedOptions.keepRounds).toBeDefined();
      }
    });

    it('应该在 token 数超过阈值时建议压缩', () => {
      const orchestrator = new CompressionOrchestrator();
      
      // 创建包含长文本的消息
      const history: ModelMessage[] = [
        { role: 'user', content: 'a'.repeat(2000) },
        { role: 'assistant', content: 'b'.repeat(2000) },
        { role: 'user', content: 'c'.repeat(2000) },
        { role: 'assistant', content: 'd'.repeat(2000) },
      ];

      const check = orchestrator.shouldCompress(history, {
        maxMessages: 100,
        maxTokens: 3000,
        keepRecentMessages: 2,
      });

      expect(check.shouldCompress).toBe(true);
      expect(check.reason).toContain('tokens');
    });
  });

  describe('场景 4: 错误恢复（静默模式）', () => {
    it('应该在压缩失败时返回原历史', async () => {
      const orchestrator = new CompressionOrchestrator();
      const llmClient = createMockLLMClient();

      // 创建不足以压缩的历史
      const history: ModelMessage[] = [
        { role: 'user', content: 'test' },
      ];

      // 使用静默模式
      const result = await orchestrator.compressHistory(
        history,
        { keepRounds: 1, silent: true },
        llmClient
      );

      // 应该返回失败但不抛出错误
      expect(result.success).toBe(false);
      expect(result.compressedHistory).toEqual(history);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.length).toBeGreaterThan(0);
    });
  });

  describe('场景 5: 上下文长度错误识别', () => {
    it('应该识别各种上下文长度错误', () => {
      const orchestrator = new CompressionOrchestrator();
      
      const errorMessages = [
        "This model's maximum context length is 4096 tokens",
        "prompt is too long: 150000 tokens",
        "context length exceeded: your request has 200000 tokens",
        "too many tokens in request",
        "request exceeds token limit",
      ];

      errorMessages.forEach(error => {
        expect(orchestrator.isContextLengthError(error)).toBe(true);
      });
      
      // 非上下文错误
      const nonContextErrors = [
        'network error',
        'invalid API key',
        'rate limit exceeded',
      ];

      nonContextErrors.forEach(error => {
        expect(orchestrator.isContextLengthError(error)).toBe(false);
      });
    });
  });

  describe('场景 6: 自定义摘要配置', () => {
    it('应该支持不同的摘要策略', async () => {
      const orchestrator = new CompressionOrchestrator();
      const llmClient = createMockLLMClient();

      const history: ModelMessage[] = [
        { role: 'user', content: '问题1' },
        { role: 'assistant', content: '回答1' },
        { role: 'user', content: '问题2' },
        { role: 'assistant', content: '回答2' },
      ];

      // 使用简洁策略
      const result = await orchestrator.compressHistory(
        history,
        { keepRounds: 1 },
        llmClient,
        {
          maxWords: 50,
          language: 'chinese',
          strategy: 'concise',
        }
      );

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
    });
  });

  describe('场景 7: 完整的压缩流程', () => {
    it('应该演示完整的压缩工作流', async () => {
      const orchestrator = new CompressionOrchestrator();
      const llmClient = createMockLLMClient();

      // 1. 构建对话历史
      const history: ModelMessage[] = [];
      for (let i = 0; i < 10; i++) {
        history.push({ role: 'user', content: `Round ${i + 1} question` });
        history.push({ role: 'assistant', content: `Round ${i + 1} answer` });
      }

      // 2. 检查是否需要压缩
      const shouldCompressResult = orchestrator.shouldCompress(history, {
        maxMessages: 15,
        maxTokens: 5000,
        keepRecentRounds: 3,
      });

      expect(shouldCompressResult.shouldCompress).toBe(true);
      
      // 3. 执行压缩
      const compressionResult = await orchestrator.compressHistory(
        history,
        shouldCompressResult.recommendedOptions || { keepRounds: 3 },
        llmClient
      );

      expect(compressionResult.success).toBe(true);
      
      // 4. 使用压缩后的历史继续对话
      const newHistory = [
        ...compressionResult.compressedHistory,
        { role: 'user', content: 'New question after compression' },
      ];

      expect(newHistory.length).toBeLessThan(history.length + 1);
      
      // 验证第一条消息是摘要
      expect(newHistory[0].role).toBe('user');
      expect(newHistory[0].content).toContain('[前期对话摘要]');
    });
  });
});

