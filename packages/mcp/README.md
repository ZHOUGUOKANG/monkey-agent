# @monkey-agent/mcp

MCP (Model Context Protocol) 客户端实现，支持完整的 OAuth 2.0 认证流程。

## 功能特性

### MCP 协议支持
- ✅ 初始化握手 (`initialize` / `initialized`)
- ✅ 工具操作 (`tools/list`, `tools/call`)
- ✅ 资源操作 (`resources/list`, `resources/read`)
- ✅ 提示词操作 (`prompts/list`, `prompts/get`)
- ✅ JSON-RPC 2.0 协议
- ✅ 会话管理 (`Mcp-Session-Id`)

### OAuth 2.0 认证
- ✅ Authorization Code Flow with PKCE (S256)
- ✅ 自动 Token 刷新和过期检测
- ✅ 动态客户端注册 (RFC 7591)
- ✅ 授权服务器发现 (RFC 8414)
- ✅ 受保护资源元数据 (RFC 9728)
- ✅ State 参数防 CSRF

### 跨环境支持
- ✅ 浏览器环境 (Web Crypto API)
- ✅ Node.js 环境 (crypto 模块)
- ✅ 统一的 API 接口

## 安装

```bash
yarn add @monkey-agent/mcp
```

## 快速开始

### 1. 无需认证的服务器

```typescript
import { MCPClient } from '@monkey-agent/mcp';

const client = new MCPClient({
  serverUrl: 'http://localhost:3000'
});

// 连接到服务器
await client.connect();

// 列出可用工具
const tools = await client.listTools();
console.log('可用工具:', tools);

// 调用工具
const result = await client.callTool('add', { a: 1, b: 2 });
console.log('结果:', result);
```

### 2. 需要 OAuth 认证的服务器（已有 Client ID）

```typescript
import { MCPClient } from '@monkey-agent/mcp';

const client = new MCPClient({
  serverUrl: 'http://localhost:3000',
  oauth: {
    client_id: 'your-client-id',
    client_secret: 'your-client-secret',
    redirect_uri: 'http://localhost:8080/callback',
    scope: 'mcp:tools'
  }
});

// 设置认证回调
client.setAuthCallback(async (authUrl) => {
  console.log('请访问以下 URL 完成认证:');
  console.log(authUrl);
  
  // 在实际应用中，你需要：
  // 1. 打开浏览器访问 authUrl
  // 2. 用户登录并授权
  // 3. 获取重定向回来的授权码
  
  // 这里模拟从回调 URL 中提取授权码
  const code = await waitForAuthorizationCode();
  return code;
});

// 连接（会自动执行认证流程）
await client.connect();

// 之后就可以正常使用了
const tools = await client.listTools();
```

### 3. 需要 OAuth 认证的服务器（动态注册）

```typescript
import { MCPClient } from '@monkey-agent/mcp';

const client = new MCPClient({
  serverUrl: 'http://localhost:3000',
  oauth: {
    client_name: 'My MCP Client',
    redirect_uri: 'http://localhost:8080/callback',
    scope: 'mcp:tools'
  }
});

client.setAuthCallback(async (authUrl) => {
  // 打开浏览器进行认证
  console.log('认证 URL:', authUrl);
  const code = await waitForAuthorizationCode();
  return code;
});

// 连接（会自动执行动态注册和认证）
await client.connect();
```

## 浏览器环境示例

### 使用弹窗认证

```typescript
import { MCPClient } from '@monkey-agent/mcp';

const client = new MCPClient({
  serverUrl: 'http://localhost:3000',
  oauth: {
    client_id: 'your-client-id',
    redirect_uri: 'http://localhost:8080/callback',
    scope: 'mcp:tools'
  }
});

// 浏览器环境的认证回调
client.setAuthCallback(async (authUrl) => {
  return new Promise((resolve) => {
    // 打开认证窗口
    const authWindow = window.open(
      authUrl,
      'MCP Auth',
      'width=500,height=600'
    );
    
    // 监听回调
    window.addEventListener('message', (event) => {
      if (event.data.type === 'mcp-auth') {
        authWindow?.close();
        resolve(event.data.code);
      }
    });
  });
});

await client.connect();
```

### 回调页面 (callback.html)

```html
<!DOCTYPE html>
<html>
<head>
  <title>OAuth Callback</title>
</head>
<body>
  <script>
    // 从 URL 提取授权码
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    
    if (code) {
      // 发送消息给父窗口
      window.opener.postMessage({
        type: 'mcp-auth',
        code: code,
        state: state
      }, '*');
    }
  </script>
  <p>认证成功，正在跳转...</p>
</body>
</html>
```

## Node.js 环境示例

### 使用本地 HTTP 服务器接收回调

```typescript
import { MCPClient } from '@monkey-agent/mcp';
import http from 'http';
import { parse } from 'url';

async function waitForAuthorizationCode(): Promise<string> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const query = parse(req.url || '', true).query;
      const code = query.code as string;
      
      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>认证成功！</h1><p>你可以关闭此页面了。</p>');
        server.close();
        resolve(code);
      }
    });
    
    server.listen(8080);
  });
}

const client = new MCPClient({
  serverUrl: 'http://localhost:3000',
  oauth: {
    client_id: 'your-client-id',
    redirect_uri: 'http://localhost:8080/callback',
    scope: 'mcp:tools'
  }
});

client.setAuthCallback(async (authUrl) => {
  console.log('\n请在浏览器中打开以下 URL 完成认证:');
  console.log(authUrl);
  console.log('\n等待回调...\n');
  
  // 可选：自动打开浏览器
  const { exec } = await import('child_process');
  exec(`open "${authUrl}"`); // macOS
  // exec(`start "${authUrl}"`); // Windows
  // exec(`xdg-open "${authUrl}"`); // Linux
  
  return await waitForAuthorizationCode();
});

await client.connect();
```

## 认证流程说明

### 自动认证流程

客户端连接时自动执行以下步骤：

1. **检测认证需求** - 尝试连接，如收到 401 则提取元数据 URL
2. **获取资源元数据** - 从 `.well-known/oauth-protected-resource` 获取授权服务器信息
3. **获取服务器元数据** - 从 `.well-known/openid-configuration` 获取端点
4. **客户端注册**（可选）- 如未提供 `client_id` 则自动注册
5. **构建授权 URL** - 生成 PKCE 参数和 state
6. **用户认证** - 通过回调函数打开浏览器
7. **交换 Token** - 使用授权码换取访问令牌
8. **连接服务器** - 使用 Token 完成 MCP 初始化

### PKCE 安全机制

```typescript
// 自动生成 code_verifier (128位随机)
code_verifier = randomBase64Url(128)

// 计算 code_challenge (SHA-256)
code_challenge = SHA256(code_verifier) -> base64url

// 授权时发送 challenge
authorization_url += `&code_challenge=${code_challenge}&code_challenge_method=S256`

// Token 交换时发送 verifier
token_request.code_verifier = code_verifier
```

## API 文档

### MCPClient

#### 构造函数

```typescript
new MCPClient(config: MCPClientConfig)
```

**配置选项：**

```typescript
interface MCPClientConfig {
  serverUrl: string;              // MCP 服务器 URL
  oauth?: {
    client_id?: string;           // 客户端 ID（可选，未提供则自动注册）
    client_secret?: string;       // 客户端密钥（可选）
    redirect_uri?: string;        // 重定向 URI
    scope?: string;               // 请求的权限范围
    client_name?: string;         // 客户端名称（用于动态注册）
  };
  timeout?: number;               // 请求超时（毫秒，默认 30000）
  autoRefreshToken?: boolean;     // 自动刷新 token（默认 true）
  headers?: Record<string, string>; // 自定义请求头
}
```

#### 核心方法

**连接管理**
- `connect(): Promise<void>` - 连接到服务器（自动处理认证）
- `disconnect(): Promise<void>` - 断开连接

**认证管理**
- `setAuthCallback(callback: AuthCallback): void` - 设置认证回调
- `getAuthState(): AuthState` - 获取认证状态
- `setToken(accessToken, refreshToken?, expiresAt?): void` - 手动设置 token

**MCP 操作**
- `listTools(): Promise<MCPTool[]>` - 列出可用工具
- `callTool(name, args?): Promise<ToolCallResult>` - 调用工具
- `listResources(): Promise<MCPResource[]>` - 列出可用资源
- `readResource(uri): Promise<ResourceContents>` - 读取资源
- `listPrompts(): Promise<MCPPrompt[]>` - 列出可用提示词
- `getPrompt(name, args?): Promise<any>` - 获取提示词

## Token 持久化

```typescript
import { MCPClient } from '@monkey-agent/mcp';

// 1. 首次认证
const client = new MCPClient({ /* config */ });
await client.connect();

// 2. 保存 token
const authState = client.getAuthState();
if (authState.token) {
  localStorage.setItem('mcp-token', JSON.stringify(authState.token));
}

// 3. 后续使用时恢复 token
const savedToken = JSON.parse(localStorage.getItem('mcp-token') || '{}');
if (savedToken.access_token) {
  client.setToken(
    savedToken.access_token,
    savedToken.refresh_token,
    savedToken.expires_at
  );
}
```

## 文件结构

```
packages/mcp/
├── src/
│   ├── types.ts              # TypeScript 类型定义
│   ├── OAuthManager.ts       # OAuth 认证管理器
│   ├── MCPClient.ts          # MCP 客户端主类
│   ├── MCPAdapter.ts         # MCP 适配器
│   ├── index.ts              # 导出接口
│   └── __tests__/            # 测试文件
└── examples/
    ├── basic-client.ts       # 基础客户端示例
    ├── oauth-client.ts       # OAuth 认证客户端
    ├── browser-client.html   # 浏览器环境示例
    └── callback.html         # OAuth 回调页面
```

## 测试

```bash
# 运行所有测试
cd packages/mcp
yarn test

# 运行特定测试
yarn test MCPClient.test.ts
yarn test OAuthManager.test.ts
```

## 兼容性

| 环境 | 支持版本 |
|------|---------|
| Chrome/Edge | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Node.js | 18+ |

**支持的规范**
- MCP Protocol Version 2024-11-05
- OAuth 2.1 (draft)
- RFC 7636 - PKCE
- RFC 7591 - 动态客户端注册
- RFC 8414 - 授权服务器元数据
- RFC 9728 - 受保护资源元数据

## 安全特性

### PKCE (Proof Key for Code Exchange)
- ✅ 使用 S256 方法（SHA-256 哈希）
- ✅ 防止授权码拦截攻击
- ✅ 适用于公共客户端（浏览器/移动应用）

### State 参数
- ✅ 防止 CSRF 攻击
- ✅ 自动生成和验证 128 位随机值

### 其他安全措施
- ✅ Token 不在 URL 中传递
- ✅ 请求超时保护（默认 30 秒）
- ✅ 详细的错误处理
- ✅ 支持加密 Token 存储（应用层实现）

### 安全建议

1. **不要在客户端代码中硬编码 `client_secret`**
2. **生产环境必须使用 HTTPS**
3. **使用加密存储保存 Token**
4. **遵循最小权限原则** - 只请求必要的 scope
5. **定期刷新 Token** - 使用短期 access token

## 相关文档

- [MCP 协议规范](https://modelcontextprotocol.io/)
- [MCP Authorization 教程](https://modelcontextprotocol.io/docs/tutorials/security/authorization)
- [OAuth 2.1 规范](https://oauth.net/2.1/)
- [RFC 7636 - PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [RFC 7591 - 动态客户端注册](https://datatracker.ietf.org/doc/html/rfc7591)
- [RFC 8414 - 授权服务器元数据](https://datatracker.ietf.org/doc/html/rfc8414)
- [RFC 9728 - 受保护资源元数据](https://datatracker.ietf.org/doc/html/rfc9728)

## License

MIT

