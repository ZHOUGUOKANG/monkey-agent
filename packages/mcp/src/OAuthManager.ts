/**
 * OAuth 2.0 认证管理器
 * 实现 OAuth 2.0 Authorization Code Flow with PKCE
 */

import type {
  OAuthServerMetadata,
  ProtectedResourceMetadata,
  ClientRegistrationRequest,
  ClientRegistrationResponse,
  OAuthClientConfig,
  TokenResponse,
  TokenInfo,
} from './types.js';

/**
 * 生成随机字符串
 */
function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomValues = new Uint8Array(length);
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues);
  } else {
    // Node.js fallback
    try {
      const nodeCrypto = require('crypto');
      nodeCrypto.randomFillSync(randomValues);
    } catch {
      // Fallback: 使用 Math.random (不够安全，仅用于测试)
      for (let i = 0; i < length; i++) {
        randomValues[i] = Math.floor(Math.random() * 256);
      }
    }
  }
  
  return Array.from(randomValues)
    .map((x) => charset[x % charset.length])
    .join('');
}

/**
 * 生成 PKCE code verifier
 */
function generateCodeVerifier(): string {
  return generateRandomString(128);
}

/**
 * 生成 PKCE code challenge
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    // 浏览器环境
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  } else {
    // Node.js 环境
    try {
      const nodeCrypto = require('crypto');
      const hash = nodeCrypto.createHash('sha256').update(verifier).digest('base64');
      return hash
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    } catch {
      throw new Error('未找到可用的加密库，无法生成 code challenge');
    }
  }
}

/**
 * OAuth 管理器配置
 */
export interface OAuthManagerConfig {
  /** MCP 服务器 URL */
  serverUrl: string;
  
  /** OAuth 客户端配置 */
  clientConfig?: OAuthClientConfig;
  
  /** 自定义 state 参数 */
  state?: string;
  
  /** 请求超时（毫秒） */
  timeout?: number;
}

/**
 * OAuth 认证管理器
 */
export class OAuthManager {
  private config: OAuthManagerConfig;
  private protectedResourceMetadata?: ProtectedResourceMetadata;
  private authServerMetadata?: OAuthServerMetadata;
  private clientInfo?: ClientRegistrationResponse;
  private tokenInfo?: TokenInfo;
  private codeVerifier?: string;
  private state: string;
  
  constructor(config: OAuthManagerConfig) {
    this.config = config;
    this.state = config.state || generateRandomString(32);
  }
  
  /**
   * 检查服务器是否需要认证
   */
  async checkAuthRequired(): Promise<{ required: boolean; resourceMetadataUrl?: string }> {
    try {
      const response = await this.fetch(this.config.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'MCP Client', version: '1.0.0' }
          }
        })
      });
      
      if (response.status === 401) {
        const authHeader = response.headers.get('WWW-Authenticate');
        if (authHeader) {
          const match = authHeader.match(/resource_metadata="([^"]+)"/);
          if (match) {
            return { required: true, resourceMetadataUrl: match[1] };
          }
        }
      }
      
      return { required: false };
    } catch (error) {
      console.error('检查认证要求失败:', error);
      throw error;
    }
  }
  
  /**
   * 1. 获取受保护资源元数据 (RFC 9728)
   */
  async fetchProtectedResourceMetadata(url?: string): Promise<ProtectedResourceMetadata> {
    const metadataUrl = url || `${this.config.serverUrl}/.well-known/oauth-protected-resource`;
    
    try {
      const response = await this.fetch(metadataUrl);
      const metadata = await response.json();
      this.protectedResourceMetadata = metadata;
      return metadata;
    } catch (error) {
      console.error('获取受保护资源元数据失败:', error);
      throw new Error(`Failed to fetch protected resource metadata: ${error}`);
    }
  }
  
  /**
   * 2. 获取授权服务器元数据 (RFC 8414)
   */
  async fetchAuthServerMetadata(authServerUrl?: string): Promise<OAuthServerMetadata> {
    if (!authServerUrl && !this.protectedResourceMetadata) {
      throw new Error('需要先获取受保护资源元数据或提供授权服务器 URL');
    }
    
    const serverUrl = authServerUrl || this.protectedResourceMetadata!.authorization_servers[0];
    
    // 尝试 OIDC Discovery
    const oidcUrl = new URL('/.well-known/openid-configuration', serverUrl).toString();
    
    try {
      const response = await this.fetch(oidcUrl);
      const metadata = await response.json();
      this.authServerMetadata = metadata;
      return metadata;
    } catch (oidcError) {
      // 回退到 OAuth 2.0 Metadata
      try {
        const oauthUrl = new URL('/.well-known/oauth-authorization-server', serverUrl).toString();
        const response = await this.fetch(oauthUrl);
        const metadata = await response.json();
        this.authServerMetadata = metadata;
        return metadata;
      } catch (error) {
        console.error('获取授权服务器元数据失败:', error);
        throw new Error(`Failed to fetch authorization server metadata: ${error}`);
      }
    }
  }
  
  /**
   * 3. 动态客户端注册 (RFC 7591)
   */
  async registerClient(registrationRequest?: ClientRegistrationRequest): Promise<ClientRegistrationResponse> {
    if (!this.authServerMetadata?.registration_endpoint) {
      throw new Error('授权服务器不支持动态客户端注册');
    }
    
    const request: ClientRegistrationRequest = registrationRequest || {
      client_name: this.config.clientConfig?.client_name || 'MCP Client',
      redirect_uris: [this.config.clientConfig?.redirect_uri || 'http://localhost:3000/callback'],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_basic',
    };
    
    if (this.config.clientConfig?.scope) {
      request.scope = this.config.clientConfig.scope;
    }
    
    try {
      const response = await this.fetch(this.authServerMetadata.registration_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      
      const clientInfo = await response.json();
      this.clientInfo = clientInfo;
      return clientInfo;
    } catch (error) {
      console.error('客户端注册失败:', error);
      throw new Error(`Client registration failed: ${error}`);
    }
  }
  
  /**
   * 4. 构建授权 URL (Authorization Code Flow with PKCE)
   */
  async buildAuthorizationUrl(): Promise<string> {
    if (!this.authServerMetadata?.authorization_endpoint) {
      throw new Error('缺少授权端点');
    }
    
    // 确定客户端信息
    const clientId = this.config.clientConfig?.client_id || this.clientInfo?.client_id;
    if (!clientId) {
      throw new Error('缺少 client_id，需要预注册或先调用 registerClient()');
    }
    
    const redirectUri = this.config.clientConfig?.redirect_uri || this.clientInfo?.redirect_uris?.[0];
    if (!redirectUri) {
      throw new Error('缺少 redirect_uri');
    }
    
    // 生成 PKCE 参数
    this.codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(this.codeVerifier);
    
    // 构建授权 URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state: this.state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    
    // 添加 scope
    if (this.config.clientConfig?.scope) {
      params.append('scope', this.config.clientConfig.scope);
    } else if (this.protectedResourceMetadata?.scopes_supported?.length) {
      params.append('scope', this.protectedResourceMetadata.scopes_supported.join(' '));
    }
    
    return `${this.authServerMetadata.authorization_endpoint}?${params.toString()}`;
  }
  
  /**
   * 5. 使用授权码交换 token
   */
  async exchangeCodeForToken(code: string, receivedState?: string): Promise<TokenInfo> {
    // 验证 state
    if (receivedState && receivedState !== this.state) {
      throw new Error('State 不匹配，可能存在 CSRF 攻击');
    }
    
    if (!this.authServerMetadata?.token_endpoint) {
      throw new Error('缺少 token 端点');
    }
    
    if (!this.codeVerifier) {
      throw new Error('缺少 code_verifier');
    }
    
    const clientId = this.config.clientConfig?.client_id || this.clientInfo?.client_id;
    const clientSecret = this.config.clientConfig?.client_secret || this.clientInfo?.client_secret;
    const redirectUri = this.config.clientConfig?.redirect_uri || this.clientInfo?.redirect_uris?.[0];
    
    if (!clientId) {
      throw new Error('缺少 client_id');
    }
    
    // 构建 token 请求
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri!,
      client_id: clientId,
      code_verifier: this.codeVerifier,
    });
    
    if (clientSecret) {
      params.append('client_secret', clientSecret);
    }
    
    try {
      const response = await this.fetch(this.authServerMetadata.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      
      const tokenResponse: TokenResponse = await response.json();
      
      // 保存 token 信息
      this.tokenInfo = {
        access_token: tokenResponse.access_token,
        token_type: tokenResponse.token_type,
        expires_at: tokenResponse.expires_in 
          ? Date.now() + tokenResponse.expires_in * 1000 
          : undefined,
        refresh_token: tokenResponse.refresh_token,
        scope: tokenResponse.scope,
      };
      
      return this.tokenInfo;
    } catch (error) {
      console.error('Token 交换失败:', error);
      throw new Error(`Token exchange failed: ${error}`);
    }
  }
  
  /**
   * 6. 刷新 token
   */
  async refreshToken(refreshToken?: string): Promise<TokenInfo> {
    if (!this.authServerMetadata?.token_endpoint) {
      throw new Error('缺少 token 端点');
    }
    
    const token = refreshToken || this.tokenInfo?.refresh_token;
    if (!token) {
      throw new Error('缺少 refresh_token');
    }
    
    const clientId = this.config.clientConfig?.client_id || this.clientInfo?.client_id;
    const clientSecret = this.config.clientConfig?.client_secret || this.clientInfo?.client_secret;
    
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token,
      client_id: clientId!,
    });
    
    if (clientSecret) {
      params.append('client_secret', clientSecret);
    }
    
    try {
      const response = await this.fetch(this.authServerMetadata.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      
      const tokenResponse: TokenResponse = await response.json();
      
      this.tokenInfo = {
        access_token: tokenResponse.access_token,
        token_type: tokenResponse.token_type,
        expires_at: tokenResponse.expires_in 
          ? Date.now() + tokenResponse.expires_in * 1000 
          : undefined,
        refresh_token: tokenResponse.refresh_token || token,
        scope: tokenResponse.scope,
      };
      
      return this.tokenInfo;
    } catch (error) {
      console.error('Token 刷新失败:', error);
      throw new Error(`Token refresh failed: ${error}`);
    }
  }
  
  /**
   * 检查 token 是否过期
   */
  isTokenExpired(): boolean {
    if (!this.tokenInfo?.expires_at) {
      return false; // 没有过期时间信息，假设未过期
    }
    
    // 提前 5 分钟认为已过期
    return Date.now() >= this.tokenInfo.expires_at - 5 * 60 * 1000;
  }
  
  /**
   * 获取当前 token
   */
  getToken(): TokenInfo | undefined {
    return this.tokenInfo;
  }
  
  /**
   * 设置 token（用于外部持久化后恢复）
   */
  setToken(token: TokenInfo): void {
    this.tokenInfo = token;
  }
  
  /**
   * 清除认证信息
   */
  clearAuth(): void {
    this.tokenInfo = undefined;
    this.codeVerifier = undefined;
  }
  
  /**
   * 统一的 fetch 封装
   */
  private async fetch(url: string, options?: RequestInit): Promise<Response> {
    const timeout = this.config.timeout || 30000;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  /**
   * 获取受保护资源元数据（如已获取）
   */
  getProtectedResourceMetadata(): ProtectedResourceMetadata | undefined {
    return this.protectedResourceMetadata;
  }
  
  /**
   * 获取授权服务器元数据（如已获取）
   */
  getAuthServerMetadata(): OAuthServerMetadata | undefined {
    return this.authServerMetadata;
  }
  
  /**
   * 获取客户端信息（如已注册）
   */
  getClientInfo(): ClientRegistrationResponse | undefined {
    return this.clientInfo;
  }
}

