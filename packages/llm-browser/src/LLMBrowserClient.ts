import type { LLMConfig } from '@monkey-agent/types';

/**
 * 简化的消息类型（浏览器环境）
 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 浏览器环境 LLM 客户端
 * 
 * 设计理念：
 * - 零 Node.js 依赖
 * - 只使用浏览器原生 API (fetch, Web Streams)
 * - 提供与 @monkey-agent/llm 类似的接口
 * - 支持流式输出
 * 
 * 限制：
 * - 不支持需要 SDK 的提供商 (Bedrock, Vertex)
 * - 不支持工具调用（简化版本）
 * - 其他提供商通过 HTTP API 直接调用
 */

export interface LLMChatResult {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class LLMBrowserClient {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.validateConfig(config);
    this.config = config;
  }

  private validateConfig(config: LLMConfig): void {
    const provider = config.provider ?? 'openai';
    
    // 不支持的提供商
    if (provider === 'bedrock') {
      throw new Error('Amazon Bedrock is not supported in browser. Use Anthropic API instead.');
    }
    if (provider === 'vertex') {
      throw new Error('Google Vertex AI is not supported in browser. Use Google Gemini API instead.');
    }
    
    // 验证 API Key（local 不需要）
    const needsApiKey = !['local', 'bedrock', 'vertex'].includes(provider as string);
    if (needsApiKey && !config.apiKey) {
      throw new Error(`API key is required for provider "${provider}"`);
    }
    
    // Azure 验证
    if (provider === 'azure' && !config.resourceName) {
      throw new Error('Azure OpenAI requires resourceName');
    }
  }

  /**
   * 非流式对话
   */
  async chat(messages: Message[], options?: { system?: string }): Promise<LLMChatResult> {
    const { provider = 'openai', apiKey, model, baseURL } = this.config;
    
    // OpenAI / DeepSeek / OpenRouter
    if (provider === 'openai' || provider === 'deepseek' || provider === 'openrouter') {
      const endpoint = baseURL || this.getDefaultEndpoint(provider);
      
      const response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          ...(provider === 'openrouter' && {
            'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
            'X-Title': 'Monkey Agent',
          }),
        },
        body: JSON.stringify({
          model,
          messages: this.formatMessages(messages, options?.system),
          temperature: this.config.temperature ?? 0.7,
          max_tokens: this.config.maxTokens ?? 4000,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(error.error?.message || `${provider} API error`);
      }

      const data = await response.json();
      return {
        text: data.choices[0].message.content,
        usage: data.usage && {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
      };
    }
    
    // Anthropic Claude
    else if (provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: this.config.maxTokens ?? 4096,
          system: options?.system,
          messages: this.formatMessagesForAnthropic(messages),
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(error.error?.message || 'Anthropic API error');
      }

      const data = await response.json();
      return {
        text: data.content[0].text,
        usage: data.usage && {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        },
      };
    }
    
    // Google Gemini
    else if (provider === 'google') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: this.formatMessagesForGemini(messages, options?.system),
            generationConfig: {
              temperature: this.config.temperature ?? 0.7,
              maxOutputTokens: this.config.maxTokens ?? 4096,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(error.error?.message || 'Google API error');
      }

      const data = await response.json();
      return {
        text: data.candidates[0].content.parts[0].text,
      };
    }
    
    // Ollama
    else if (provider === 'local') {
      const endpoint = this.config.baseURL || 'http://localhost:11434';
      const response = await fetch(`${endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: this.formatMessages(messages, options?.system),
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Ollama API error');
      }

      const data = await response.json();
      return {
        text: data.message.content,
      };
    }
    
    // Azure OpenAI
    else if (provider === 'azure') {
      const { resourceName } = this.config;
      if (!resourceName) {
        throw new Error('Azure resource name not configured');
      }
      
      const endpoint = baseURL || 
        `https://${resourceName}.openai.azure.com/openai/deployments/${model}/chat/completions?api-version=2024-08-01-preview`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey!,
        },
        body: JSON.stringify({
          messages: this.formatMessages(messages, options?.system),
          temperature: this.config.temperature ?? 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(error.error?.message || 'Azure OpenAI API error');
      }

      const data = await response.json();
      return {
        text: data.choices[0].message.content,
        usage: data.usage && {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
      };
    }
    
    else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * 流式对话
   */
  async *streamText(messages: Message[], options?: { system?: string }): AsyncIterableIterator<string> {
    const { provider = 'openai', apiKey, model, baseURL } = this.config;
    
    let response: Response;
    
    // OpenAI / DeepSeek / OpenRouter
    if (provider === 'openai' || provider === 'deepseek' || provider === 'openrouter') {
      const endpoint = baseURL || this.getDefaultEndpoint(provider);
      
      response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          ...(provider === 'openrouter' && {
            'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
            'X-Title': 'Monkey Agent',
          }),
        },
        body: JSON.stringify({
          model,
          messages: this.formatMessages(messages, options?.system),
          temperature: this.config.temperature ?? 0.7,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(error.error?.message || `${provider} API error`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // 解析 SSE 流
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              const content = json.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    }
    
    // Anthropic Claude
    else if (provider === 'anthropic') {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: this.config.maxTokens ?? 4096,
          system: options?.system,
          messages: this.formatMessagesForAnthropic(messages),
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(error.error?.message || 'Anthropic API error');
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const json = JSON.parse(data);
              if (json.type === 'content_block_delta' && json.delta?.text) {
                yield json.delta.text;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    }
    
    // Google Gemini
    else if (provider === 'google') {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: this.formatMessagesForGemini(messages, options?.system),
            generationConfig: {
              temperature: this.config.temperature ?? 0.7,
              maxOutputTokens: this.config.maxTokens ?? 4096,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(error.error?.message || 'Google API error');
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const json = JSON.parse(line);
              const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                yield text;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    }
    
    // Ollama
    else if (provider === 'local') {
      const endpoint = this.config.baseURL || 'http://localhost:11434';
      response = await fetch(`${endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: this.formatMessages(messages, options?.system),
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Ollama API error');
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const json = JSON.parse(line);
              if (json.message?.content) {
                yield json.message.content;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    }
    
    // Azure
    else if (provider === 'azure') {
      const { resourceName } = this.config;
      if (!resourceName) {
        throw new Error('Azure resource name not configured');
      }
      
      const endpoint = baseURL || 
        `https://${resourceName}.openai.azure.com/openai/deployments/${model}/chat/completions?api-version=2024-08-01-preview`;
      
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey!,
        },
        body: JSON.stringify({
          messages: this.formatMessages(messages, options?.system),
          temperature: this.config.temperature ?? 0.7,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(error.error?.message || 'Azure OpenAI API error');
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              const content = json.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    }
    
    else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  /**
   * 流式对话（包装版）- 返回 textStream 和 fullText
   */
  stream(messages: Message[], options?: { system?: string }) {
    const textStream = this.streamText(messages, options);
    
    const fullText = (async () => {
      let result = '';
      for await (const chunk of this.streamText(messages, options)) {
        result += chunk;
      }
      return result;
    })();

    return {
      textStream,
      fullText,
    };
  }

  // ============ 辅助方法 ============

  private getDefaultEndpoint(provider: string): string {
    switch (provider) {
      case 'openai':
        return 'https://api.openai.com/v1';
      case 'deepseek':
        return 'https://api.deepseek.com';
      case 'openrouter':
        return 'https://openrouter.ai/api/v1';
      default:
        return 'https://api.openai.com/v1';
    }
  }

  private formatMessages(messages: Message[], system?: string): any[] {
    const formatted: any[] = [];
    
    if (system) {
      formatted.push({ role: 'system', content: system });
    }
    
    for (const msg of messages) {
      formatted.push({
        role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
        content: msg.content,
      });
    }
    
    return formatted;
  }

  private formatMessagesForAnthropic(messages: Message[]): any[] {
    return messages
      .filter(m => m.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));
  }

  private formatMessagesForGemini(messages: Message[], system?: string): any[] {
    let combinedText = '';
    if (system) {
      combinedText += system + '\n\n';
    }
    
    for (const msg of messages) {
      combinedText += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`;
    }
    
    return [{ parts: [{ text: combinedText }] }];
  }
}

