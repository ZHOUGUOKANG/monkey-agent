/**
 * MCP (Model Context Protocol) 客户端
 * 支持 OAuth 2.0 认证
 */

import type {
  MCPClientConfig,
  MCPRequest,
  MCPResponse,
  InitializeResult,
  MCPTool,
  MCPResource,
  MCPPrompt,
  ToolCallResult,
  ResourceContents,
  AuthState,
  AuthCallback,
} from './types.js';
import { OAuthManager } from './OAuthManager.js';

/**
 * MCP 客户端
 */
export class MCPClient {
  private config: MCPClientConfig;
  private oauthManager?: OAuthManager;
  private sessionId?: string;
  private requestId: number = 0;
  private initializeResult?: InitializeResult;
  private authCallback?: AuthCallback;
  
  constructor(config: MCPClientConfig) {
    this.config = {
      timeout: 30000,
      autoRefreshToken: true,
      ...config,
    };
  }
  
  /**
   * 设置认证回调函数
   * 当需要用户认证时调用此回调，返回授权码
   */
  setAuthCallback(callback: AuthCallback): void {
    this.authCallback = callback;
  }
  
  /**
   * 连接到 MCP 服务器
   */
  async connect(): Promise<void> {
    // 1. 检查是否需要认证
    const oauthManager = new OAuthManager({
      serverUrl: this.config.serverUrl,
      clientConfig: this.config.oauth,
      timeout: this.config.timeout,
    });
    
    const authCheck = await oauthManager.checkAuthRequired();
    
    if (authCheck.required) {
      // 需要认证
      this.oauthManager = oauthManager;
      
      // 2. 获取受保护资源元数据
      await this.oauthManager.fetchProtectedResourceMetadata(authCheck.resourceMetadataUrl);
      
      // 3. 获取授权服务器元数据
      await this.oauthManager.fetchAuthServerMetadata();
      
      // 4. 客户端注册（如果需要）
      if (!this.config.oauth?.client_id) {
        const metadata = this.oauthManager.getAuthServerMetadata();
        if (metadata?.registration_endpoint) {
          await this.oauthManager.registerClient();
        } else {
          throw new Error('服务器需要认证但未提供 client_id 且不支持动态注册');
        }
      }
      
      // 5. 执行认证流程
      await this.authenticate();
    }
    
    // 6. 初始化 MCP 连接
    await this.initialize();
  }
  
  /**
   * 执行 OAuth 认证流程
   */
  private async authenticate(): Promise<void> {
    if (!this.oauthManager) {
      throw new Error('OAuth 管理器未初始化');
    }
    
    // 构建授权 URL
    const authUrl = await this.oauthManager.buildAuthorizationUrl();
    
    if (!this.authCallback) {
      throw new Error('未设置认证回调函数，无法完成认证流程。请使用 setAuthCallback() 设置回调函数');
    }
    
    // 调用回调函数，让用户完成认证并获取授权码
    console.log('请访问以下 URL 完成认证:', authUrl);
    const code = await this.authCallback(authUrl);
    
    // 使用授权码交换 token
    await this.oauthManager.exchangeCodeForToken(code);
  }
  
  /**
   * 初始化 MCP 连接
   */
  private async initialize(): Promise<void> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.nextRequestId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: { listChanged: true },
          sampling: {},
        },
        clientInfo: {
          name: 'MCP Client',
          version: '1.0.0',
        },
      },
    };
    
    const response = await this.sendRequest<InitializeResult>(request);
    this.initializeResult = response;
    
    // 发送 initialized 通知
    await this.sendNotification('notifications/initialized');
  }
  
  /**
   * 获取认证状态
   */
  getAuthState(): AuthState {
    if (!this.oauthManager) {
      return { authenticated: true };
    }
    
    const token = this.oauthManager.getToken();
    if (token) {
      return {
        authenticated: true,
        token,
      };
    }
    
    return {
      authenticated: false,
    };
  }
  
  /**
   * 手动设置 token（用于恢复会话）
   */
  setToken(accessToken: string, refreshToken?: string, expiresAt?: number): void {
    if (!this.oauthManager) {
      this.oauthManager = new OAuthManager({
        serverUrl: this.config.serverUrl,
        clientConfig: this.config.oauth,
        timeout: this.config.timeout,
      });
    }
    
    this.oauthManager.setToken({
      access_token: accessToken,
      token_type: 'Bearer',
      refresh_token: refreshToken,
      expires_at: expiresAt,
    });
  }
  
  /**
   * 列出可用工具
   */
  async listTools(): Promise<MCPTool[]> {
    const response = await this.sendRequest<{ tools: MCPTool[] }>({
      jsonrpc: '2.0',
      id: this.nextRequestId(),
      method: 'tools/list',
    });
    
    return response.tools || [];
  }
  
  /**
   * 调用工具
   */
  async callTool(name: string, args?: Record<string, any>): Promise<ToolCallResult> {
    const response = await this.sendRequest<ToolCallResult>({
      jsonrpc: '2.0',
      id: this.nextRequestId(),
      method: 'tools/call',
      params: {
        name,
        arguments: args || {},
      },
    });
    
    return response;
  }
  
  /**
   * 列出可用资源
   */
  async listResources(): Promise<MCPResource[]> {
    const response = await this.sendRequest<{ resources: MCPResource[] }>({
      jsonrpc: '2.0',
      id: this.nextRequestId(),
      method: 'resources/list',
    });
    
    return response.resources || [];
  }
  
  /**
   * 读取资源
   */
  async readResource(uri: string): Promise<ResourceContents> {
    const response = await this.sendRequest<ResourceContents>({
      jsonrpc: '2.0',
      id: this.nextRequestId(),
      method: 'resources/read',
      params: { uri },
    });
    
    return response;
  }
  
  /**
   * 列出可用提示词
   */
  async listPrompts(): Promise<MCPPrompt[]> {
    const response = await this.sendRequest<{ prompts: MCPPrompt[] }>({
      jsonrpc: '2.0',
      id: this.nextRequestId(),
      method: 'prompts/list',
    });
    
    return response.prompts || [];
  }
  
  /**
   * 获取提示词
   */
  async getPrompt(name: string, args?: Record<string, any>): Promise<any> {
    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.nextRequestId(),
      method: 'prompts/get',
      params: {
        name,
        arguments: args || {},
      },
    });
    
    return response;
  }
  
  /**
   * 发送请求到 MCP 服务器
   */
  private async sendRequest<T = any>(request: MCPRequest): Promise<T> {
    // 检查并刷新 token（如果需要）
    if (this.oauthManager && this.config.autoRefreshToken) {
      if (this.oauthManager.isTokenExpired()) {
        await this.oauthManager.refreshToken();
      }
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };
    
    // 添加认证头
    if (this.oauthManager) {
      const token = this.oauthManager.getToken();
      if (token) {
        headers['Authorization'] = `${token.token_type} ${token.access_token}`;
      }
    }
    
    // 添加会话 ID
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const response = await fetch(this.config.serverUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      
      // 提取会话 ID
      const sessionHeader = response.headers.get('Mcp-Session-Id');
      if (sessionHeader) {
        this.sessionId = sessionHeader;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const mcpResponse: MCPResponse = await response.json();
      
      if (mcpResponse.error) {
        throw new Error(
          `MCP Error ${mcpResponse.error.code}: ${mcpResponse.error.message}`
        );
      }
      
      return mcpResponse.result as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('请求超时');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  /**
   * 发送通知（无需响应）
   */
  private async sendNotification(method: string, params?: any): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };
    
    if (this.oauthManager) {
      const token = this.oauthManager.getToken();
      if (token) {
        headers['Authorization'] = `${token.token_type} ${token.access_token}`;
      }
    }
    
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }
    
    await fetch(this.config.serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
      }),
    });
  }
  
  /**
   * 获取初始化结果
   */
  getInitializeResult(): InitializeResult | undefined {
    return this.initializeResult;
  }
  
  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.sessionId = undefined;
    this.initializeResult = undefined;
    if (this.oauthManager) {
      this.oauthManager.clearAuth();
    }
  }
  
  /**
   * 生成下一个请求 ID
   */
  private nextRequestId(): number {
    return ++this.requestId;
  }
}

