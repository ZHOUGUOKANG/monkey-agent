/**
 * MCP Client 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MCPClient } from '../MCPClient';
import type { MCPClientConfig } from '../types';

// Mock fetch
global.fetch = vi.fn();

describe('MCPClient', () => {
  let config: MCPClientConfig;
  
  beforeEach(() => {
    config = {
      serverUrl: 'http://localhost:3000',
      timeout: 5000,
    };
    
    // 重置 mock
    vi.clearAllMocks();
  });
  
  describe('基础功能', () => {
    it('应该正确创建客户端实例', () => {
      const client = new MCPClient(config);
      expect(client).toBeDefined();
    });
    
    it('应该能够设置认证回调', () => {
      const client = new MCPClient(config);
      const callback = vi.fn();
      
      client.setAuthCallback(callback);
      
      // 验证回调已设置（通过私有属性无法直接验证，但不会抛出错误）
      expect(() => client.setAuthCallback(callback)).not.toThrow();
    });
  });
  
  describe('连接功能', () => {
    it('应该能够连接到不需要认证的服务器', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // Mock 初始请求（不需要认证）
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Mcp-Session-Id': 'test-session-123',
        }),
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            serverInfo: {
              name: 'Test Server',
              version: '1.0.0',
            },
          },
        }),
      } as Response);
      
      // Mock initialized 通知
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);
      
      const client = new MCPClient(config);
      await client.connect();
      
      const initResult = client.getInitializeResult();
      expect(initResult).toBeDefined();
      expect(initResult?.serverInfo.name).toBe('Test Server');
    });
    
    it('应该能够检测需要认证的服务器', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // Mock 401 响应
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({
          'WWW-Authenticate': 'Bearer realm="mcp", resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource"',
        }),
      } as Response);
      
      const client = new MCPClient({
        ...config,
        oauth: {
          client_id: 'test-client',
          redirect_uri: 'http://localhost:8080/callback',
        },
      });
      
      // 应该抛出错误，因为没有设置认证回调
      await expect(client.connect()).rejects.toThrow();
    });
  });
  
  describe('工具操作', () => {
    let client: MCPClient;
    
    beforeEach(async () => {
      const mockFetch = vi.mocked(fetch);
      
      // Mock 初始化
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Mcp-Session-Id': 'test-session' }),
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'Test', version: '1.0.0' },
          },
        }),
      } as Response);
      
      // Mock initialized 通知
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);
      
      client = new MCPClient(config);
      await client.connect();
      
      vi.clearAllMocks();
    });
    
    it('应该能够列出工具', async () => {
      const mockFetch = vi.mocked(fetch);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 2,
          result: {
            tools: [
              {
                name: 'add',
                description: 'Add two numbers',
                inputSchema: {
                  type: 'object',
                  properties: {
                    a: { type: 'number' },
                    b: { type: 'number' },
                  },
                  required: ['a', 'b'],
                },
              },
            ],
          },
        }),
      } as Response);
      
      const tools = await client.listTools();
      
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('add');
      expect(tools[0].description).toBe('Add two numbers');
    });
    
    it('应该能够调用工具', async () => {
      const mockFetch = vi.mocked(fetch);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 2,
          result: {
            content: [
              {
                type: 'text',
                text: '10 + 20 = 30',
              },
            ],
          },
        }),
      } as Response);
      
      const result = await client.callTool('add', { a: 10, b: 20 });
      
      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe('10 + 20 = 30');
    });
  });
  
  describe('资源操作', () => {
    let client: MCPClient;
    
    beforeEach(async () => {
      const mockFetch = vi.mocked(fetch);
      
      // Mock 初始化
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Mcp-Session-Id': 'test-session' }),
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { resources: {} },
            serverInfo: { name: 'Test', version: '1.0.0' },
          },
        }),
      } as Response);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);
      
      client = new MCPClient(config);
      await client.connect();
      
      vi.clearAllMocks();
    });
    
    it('应该能够列出资源', async () => {
      const mockFetch = vi.mocked(fetch);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 2,
          result: {
            resources: [
              {
                uri: 'file:///test.txt',
                name: 'test.txt',
                description: 'Test file',
                mimeType: 'text/plain',
              },
            ],
          },
        }),
      } as Response);
      
      const resources = await client.listResources();
      
      expect(resources).toHaveLength(1);
      expect(resources[0].name).toBe('test.txt');
    });
    
    it('应该能够读取资源', async () => {
      const mockFetch = vi.mocked(fetch);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 2,
          result: {
            contents: [
              {
                uri: 'file:///test.txt',
                mimeType: 'text/plain',
                text: 'Hello, World!',
              },
            ],
          },
        }),
      } as Response);
      
      const contents = await client.readResource('file:///test.txt');
      
      expect(contents.contents).toHaveLength(1);
      expect(contents.contents[0].text).toBe('Hello, World!');
    });
  });
  
  describe('错误处理', () => {
    it('应该处理网络错误', async () => {
      const mockFetch = vi.mocked(fetch);
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const client = new MCPClient(config);
      
      await expect(client.connect()).rejects.toThrow('Network error');
    });
    
    it('应该处理 HTTP 错误', async () => {
      const mockFetch = vi.mocked(fetch);
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);
      
      const client = new MCPClient(config);
      
      await expect(client.connect()).rejects.toThrow();
    });
    
    it('应该处理 MCP 协议错误', async () => {
      const mockFetch = vi.mocked(fetch);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          error: {
            code: -32600,
            message: 'Invalid Request',
          },
        }),
      } as Response);
      
      const client = new MCPClient(config);
      
      await expect(client.connect()).rejects.toThrow('MCP Error -32600');
    });
  });
  
  describe('断开连接', () => {
    it('应该能够断开连接', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // Mock 初始化
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'Mcp-Session-Id': 'test-session' }),
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            serverInfo: { name: 'Test', version: '1.0.0' },
          },
        }),
      } as Response);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);
      
      const client = new MCPClient(config);
      await client.connect();
      
      expect(client.getInitializeResult()).toBeDefined();
      
      await client.disconnect();
      
      expect(client.getInitializeResult()).toBeUndefined();
    });
  });
});

