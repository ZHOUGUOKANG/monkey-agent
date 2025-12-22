/**
 * MCP Client 类型定义
 */

/**
 * OAuth 服务器元数据 (RFC 8414)
 */
export interface OAuthServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  token_endpoint_auth_methods_supported?: string[];
  response_types_supported?: string[];
  grant_types_supported?: string[];
  scopes_supported?: string[];
  [key: string]: any;
}

/**
 * 受保护资源元数据 (RFC 9728)
 */
export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported?: string[];
  bearer_methods_supported?: string[];
  resource_signing_alg_values_supported?: string[];
  resource_documentation?: string;
  resource_policy_uri?: string;
  [key: string]: any;
}

/**
 * 客户端注册信息 (RFC 7591)
 */
export interface ClientRegistrationRequest {
  client_name: string;
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
  token_endpoint_auth_method?: string;
  [key: string]: any;
}

/**
 * 客户端注册响应
 */
export interface ClientRegistrationResponse {
  client_id: string;
  client_secret?: string;
  client_id_issued_at?: number;
  client_secret_expires_at?: number;
  registration_access_token?: string;
  registration_client_uri?: string;
  [key: string]: any;
}

/**
 * OAuth 客户端配置
 */
export interface OAuthClientConfig {
  client_id?: string;
  client_secret?: string;
  redirect_uri?: string;
  scope?: string;
  client_name?: string;
}

/**
 * Token 响应
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  [key: string]: any;
}

/**
 * Token 信息
 */
export interface TokenInfo {
  access_token: string;
  token_type: string;
  expires_at?: number;
  refresh_token?: string;
  scope?: string;
}

/**
 * MCP 客户端配置
 */
export interface MCPClientConfig {
  /** MCP 服务器 URL */
  serverUrl: string;
  
  /** OAuth 配置（可选） */
  oauth?: OAuthClientConfig;
  
  /** 请求超时时间（毫秒） */
  timeout?: number;
  
  /** 是否自动刷新 token */
  autoRefreshToken?: boolean;
  
  /** 自定义请求头 */
  headers?: Record<string, string>;
}

/**
 * MCP Tool 定义
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
}

/**
 * MCP Resource 定义
 */
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  [key: string]: any;
}

/**
 * MCP Prompt 定义
 */
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * MCP 请求消息
 */
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

/**
 * MCP 响应消息
 */
export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * MCP 初始化结果
 */
export interface InitializeResult {
  protocolVersion: string;
  capabilities: {
    tools?: {};
    resources?: {};
    prompts?: {};
    [key: string]: any;
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

/**
 * Tool 调用结果
 */
export interface ToolCallResult {
  content: Array<{
    type: string;
    text?: string;
    data?: any;
    [key: string]: any;
  }>;
  isError?: boolean;
}

/**
 * Resource 读取结果
 */
export interface ResourceContents {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
    [key: string]: any;
  }>;
}

/**
 * 认证状态
 */
export interface AuthState {
  /** 是否已认证 */
  authenticated: boolean;
  
  /** 认证 URL（用户需要访问的 URL） */
  authUrl?: string;
  
  /** Token 信息 */
  token?: TokenInfo;
  
  /** 错误信息 */
  error?: string;
}

/**
 * 认证回调函数
 */
export type AuthCallback = (authUrl: string) => Promise<string>;

