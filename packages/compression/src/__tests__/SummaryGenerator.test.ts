/**
 * SummaryGenerator 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SummaryGenerator, summarizeMessages } from '../SummaryGenerator';
import type { ILLMClient } from '@monkey-agent/types';
import type { ModelMessage } from 'ai';

// 模拟 LLM 客户端
const createMockLLMClient = (mockResponse: string = 'Test summary'): ILLMClient => {
  return {
    chat: vi.fn().mockResolvedValue({ text: mockResponse }),
    stream: vi.fn(),
  } as any;
};

describe('SummaryGenerator', () => {
  let mockLLMClient: ILLMClient;
  let generator: SummaryGenerator;

  beforeEach(() => {
    mockLLMClient = createMockLLMClient();
    generator = new SummaryGenerator(mockLLMClient);
  });

  describe('summarizeMessages', () => {
    it('应该使用 LLM 生成摘要', async () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const summary = await generator.summarizeMessages(messages);
      
      expect(summary).toBe('Test summary');
      expect(mockLLMClient.chat).toHaveBeenCalledTimes(1);
    });

    it('应该格式化消息为文本', async () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'What is 2+2?' },
        { role: 'assistant', content: 'The answer is 4' },
      ];

      await generator.summarizeMessages(messages);
      
      const callArgs = (mockLLMClient.chat as any).mock.calls[0];
      const prompt = callArgs[0][0].content;
      
      expect(prompt).toContain('User:');
      expect(prompt).toContain('Assistant:');
      expect(prompt).toContain('2+2');
    });

    it('应该处理工具调用消息', async () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Navigate to example.com' },
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
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
              toolCallId: 'call-1',
              toolName: 'browser_navigate',
              output: 'Navigation successful',
            },
          ],
        },
      ];

      await generator.summarizeMessages(messages);
      
      const callArgs = (mockLLMClient.chat as any).mock.calls[0];
      const prompt = callArgs[0][0].content;
      
      expect(prompt).toContain('browser_navigate');
      expect(prompt).toContain('Tool Result:');
    });

    it('应该使用 maxSteps: 1 避免工具调用', async () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'test' },
      ];

      await generator.summarizeMessages(messages);
      
      const callArgs = (mockLLMClient.chat as any).mock.calls[0];
      const options = callArgs[1];
      
      expect(options.maxSteps).toBe(1);
    });

    it('应该处理空消息列表', async () => {
      const summary = await generator.summarizeMessages([]);
      
      expect(summary).toBe('Test summary');
    });

    it('应该处理复杂的消息内容', async () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'Test' },
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me help' },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              args: { key: 'value' },
            },
          ],
        },
      ];

      const summary = await generator.summarizeMessages(messages);
      
      expect(summary).toBe('Test summary');
      expect(mockLLMClient.chat).toHaveBeenCalled();
    });
  });

  describe('配置选项', () => {
    it('应该使用自定义 maxWords', async () => {
      const customGenerator = new SummaryGenerator(mockLLMClient, {
        maxWords: 100,
      });

      const messages: ModelMessage[] = [
        { role: 'user', content: 'test' },
      ];

      await customGenerator.summarizeMessages(messages);
      
      const callArgs = (mockLLMClient.chat as any).mock.calls[0];
      const prompt = callArgs[0][0].content;
      
      expect(prompt).toContain('100 words');
    });

    it('应该支持中文输出', async () => {
      const chineseGenerator = new SummaryGenerator(mockLLMClient, {
        language: 'chinese',
      });

      const messages: ModelMessage[] = [
        { role: 'user', content: '测试' },
      ];

      await chineseGenerator.summarizeMessages(messages);
      
      const callArgs = (mockLLMClient.chat as any).mock.calls[0];
      const prompt = callArgs[0][0].content;
      
      expect(prompt).toContain('in Chinese');
    });

    it('应该支持英文输出', async () => {
      const englishGenerator = new SummaryGenerator(mockLLMClient, {
        language: 'english',
      });

      const messages: ModelMessage[] = [
        { role: 'user', content: 'test' },
      ];

      await englishGenerator.summarizeMessages(messages);
      
      const callArgs = (mockLLMClient.chat as any).mock.calls[0];
      const prompt = callArgs[0][0].content;
      
      expect(prompt).toContain('in English');
    });

    it('应该支持自动语言检测', async () => {
      const autoGenerator = new SummaryGenerator(mockLLMClient, {
        language: 'auto',
      });

      const messages: ModelMessage[] = [
        { role: 'user', content: 'test' },
      ];

      await autoGenerator.summarizeMessages(messages);
      
      const callArgs = (mockLLMClient.chat as any).mock.calls[0];
      const prompt = callArgs[0][0].content;
      
      // auto 模式不应该包含语言指令
      expect(prompt).not.toContain('in Chinese');
      expect(prompt).not.toContain('in English');
    });

    it('应该支持不同的摘要策略', async () => {
      const strategies = ['concise', 'balanced', 'detailed'] as const;
      
      for (const strategy of strategies) {
        const client = createMockLLMClient();
        const gen = new SummaryGenerator(client, { strategy });
        
        await gen.summarizeMessages([{ role: 'user', content: 'test' }]);
        
        const callArgs = (client.chat as any).mock.calls[0];
        const prompt = callArgs[0][0].content;
        
        // 应该包含策略相关的词
        if (strategy === 'concise') {
          expect(prompt).toContain('brief');
        } else if (strategy === 'detailed') {
          expect(prompt).toContain('comprehensive');
        }
      }
    });

    it('应该支持自定义 prompt 模板', async () => {
      const customTemplate = 'Custom template with {messages} and {maxWords} words {language}';
      const customGenerator = new SummaryGenerator(mockLLMClient, {
        promptTemplate: customTemplate,
        maxWords: 150,
        language: 'chinese',
      });

      const messages: ModelMessage[] = [
        { role: 'user', content: 'test' },
      ];

      await customGenerator.summarizeMessages(messages);
      
      const callArgs = (mockLLMClient.chat as any).mock.calls[0];
      const prompt = callArgs[0][0].content;
      
      expect(prompt).toContain('Custom template');
      expect(prompt).toContain('150');
      expect(prompt).toContain('in Chinese');
    });
  });

  describe('快捷函数', () => {
    it('summarizeMessages 函数应该工作', async () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: 'test' },
      ];

      const summary = await summarizeMessages(messages, mockLLMClient);
      
      expect(summary).toBe('Test summary');
      expect(mockLLMClient.chat).toHaveBeenCalled();
    });
  });

  describe('错误处理', () => {
    it('应该传播 LLM 错误', async () => {
      const errorClient: ILLMClient = {
        chat: vi.fn().mockRejectedValue(new Error('LLM error')),
        stream: vi.fn(),
      } as any;

      const errorGenerator = new SummaryGenerator(errorClient);
      
      await expect(
        errorGenerator.summarizeMessages([{ role: 'user', content: 'test' }])
      ).rejects.toThrow('LLM error');
    });
  });

  describe('边界情况', () => {
    it('应该处理极长的消息', async () => {
      const longContent = 'a'.repeat(10000);
      const messages: ModelMessage[] = [
        { role: 'user', content: longContent },
      ];

      const summary = await generator.summarizeMessages(messages);
      
      expect(summary).toBe('Test summary');
    });

    it('应该处理特殊字符', async () => {
      const messages: ModelMessage[] = [
        { role: 'user', content: '特殊字符 !@#$%^&*()' },
        { role: 'assistant', content: 'Response with 中文 and emoji 🎉' },
      ];

      const summary = await generator.summarizeMessages(messages);
      
      expect(summary).toBe('Test summary');
    });

    it('应该处理未定义的内容部分', async () => {
      const messages: ModelMessage[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: undefined as any },
          ],
        },
      ];

      const summary = await generator.summarizeMessages(messages);
      
      expect(summary).toBe('Test summary');
    });

    it('应该截断过长的工具结果', async () => {
      const longOutput = 'x'.repeat(200);
      const messages: ModelMessage[] = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'tool1',
              output: longOutput,
            },
          ],
        },
      ];

      await generator.summarizeMessages(messages);
      
      const callArgs = (mockLLMClient.chat as any).mock.calls[0];
      const prompt = callArgs[0][0].content;
      
      // 应该被截断
      expect(prompt).toContain('...');
    });
  });
});

