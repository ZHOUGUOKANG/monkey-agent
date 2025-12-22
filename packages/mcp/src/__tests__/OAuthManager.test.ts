/**
 * OAuth Manager 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OAuthManager } from '../OAuthManager';
import type { OAuthManagerConfig } from '../OAuthManager';

// Mock fetch
global.fetch = vi.fn();

describe('OAuthManager', () => {
  let config: OAuthManagerConfig;
  
  beforeEach(() => {
    config = {
      serverUrl: 'http://localhost:3000',
      clientConfig: {
        client_id: 'test-client',
        client_secret: 'test-secret',
        redirect_uri: 'http://localhost:8080/callback',
        scope: 'mcp:tools',
      },
      timeout: 5000,
    };
    
    vi.clearAllMocks();
  });
  
  describe('初始化', () => {
    it('应该正确创建实例', () => {
      const oauth = new OAuthManager(config);
      expect(oauth).toBeDefined();
    });
  });
  
  describe('检查认证要求', () => {
    it('应该检测不需要认证的服务器', async () => {
      const mockFetch = vi.mocked(fetch);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
      } as Response);
      
      const oauth = new OAuthManager(config);
      const result = await oauth.checkAuthRequired();
      
      expect(result.required).toBe(false);
    });
    
    it('应该检测需要认证的服务器', async () => {
      const mockFetch = vi.mocked(fetch);
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({
          'WWW-Authenticate': 'Bearer realm="mcp", resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource"',
        }),
      } as Response);
      
      const oauth = new OAuthManager(config);
      const result = await oauth.checkAuthRequired();
      
      expect(result.required).toBe(true);
      expect(result.resourceMetadataUrl).toBe('http://localhost:3000/.well-known/oauth-protected-resource');
    });
  });
  
  describe('元数据获取', () => {
    it('应该能够获取受保护资源元数据', async () => {
      const mockFetch = vi.mocked(fetch);
      
      const metadata = {
        resource: 'http://localhost:3000',
        authorization_servers: ['http://localhost:8080/realms/master'],
        scopes_supported: ['mcp:tools'],
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => metadata,
      } as Response);
      
      const oauth = new OAuthManager(config);
      const result = await oauth.fetchProtectedResourceMetadata();
      
      expect(result).toEqual(metadata);
      expect(oauth.getProtectedResourceMetadata()).toEqual(metadata);
    });
    
    it('应该能够获取授权服务器元数据 (OIDC)', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // 先获取受保护资源元数据
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          resource: 'http://localhost:3000',
          authorization_servers: ['http://localhost:8080'],
        }),
      } as Response);
      
      // 获取 OIDC 配置
      const oidcMetadata = {
        issuer: 'http://localhost:8080',
        authorization_endpoint: 'http://localhost:8080/authorize',
        token_endpoint: 'http://localhost:8080/token',
        registration_endpoint: 'http://localhost:8080/register',
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => oidcMetadata,
      } as Response);
      
      const oauth = new OAuthManager(config);
      await oauth.fetchProtectedResourceMetadata();
      const result = await oauth.fetchAuthServerMetadata();
      
      expect(result.issuer).toBe('http://localhost:8080');
      expect(result.authorization_endpoint).toBe('http://localhost:8080/authorize');
    });
  });
  
  describe('客户端注册', () => {
    it('应该能够注册客户端', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // 设置授权服务器元数据
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          resource: 'http://localhost:3000',
          authorization_servers: ['http://localhost:8080'],
        }),
      } as Response);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          issuer: 'http://localhost:8080',
          registration_endpoint: 'http://localhost:8080/register',
        }),
      } as Response);
      
      // 注册响应
      const registrationResponse = {
        client_id: 'dynamic-client-123',
        client_secret: 'secret-456',
        client_id_issued_at: Date.now(),
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => registrationResponse,
      } as Response);
      
      const oauth = new OAuthManager({
        serverUrl: 'http://localhost:3000',
        clientConfig: {
          client_name: 'Test Client',
          redirect_uri: 'http://localhost:8080/callback',
        },
      });
      
      await oauth.fetchProtectedResourceMetadata();
      await oauth.fetchAuthServerMetadata();
      const result = await oauth.registerClient();
      
      expect(result.client_id).toBe('dynamic-client-123');
      expect(result.client_secret).toBe('secret-456');
    });
  });
  
  describe('授权 URL 构建', () => {
    it('应该能够构建授权 URL', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // 设置元数据
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          resource: 'http://localhost:3000',
          authorization_servers: ['http://localhost:8080'],
          scopes_supported: ['mcp:tools'],
        }),
      } as Response);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          issuer: 'http://localhost:8080',
          authorization_endpoint: 'http://localhost:8080/authorize',
        }),
      } as Response);
      
      const oauth = new OAuthManager(config);
      await oauth.fetchProtectedResourceMetadata();
      await oauth.fetchAuthServerMetadata();
      
      const authUrl = await oauth.buildAuthorizationUrl();
      
      expect(authUrl).toContain('http://localhost:8080/authorize');
      expect(authUrl).toContain('client_id=test-client');
      expect(authUrl).toContain('redirect_uri=');
      expect(authUrl).toContain('code_challenge=');
      expect(authUrl).toContain('code_challenge_method=S256');
      expect(authUrl).toContain('scope=mcp%3Atools');
    });
  });
  
  describe('Token 操作', () => {
    it('应该能够交换授权码获取 token', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // 设置元数据
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          resource: 'http://localhost:3000',
          authorization_servers: ['http://localhost:8080'],
        }),
      } as Response);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          issuer: 'http://localhost:8080',
          authorization_endpoint: 'http://localhost:8080/authorize',
          token_endpoint: 'http://localhost:8080/token',
        }),
      } as Response);
      
      const oauth = new OAuthManager(config);
      await oauth.fetchProtectedResourceMetadata();
      await oauth.fetchAuthServerMetadata();
      await oauth.buildAuthorizationUrl();
      
      // Mock token 响应
      const tokenResponse = {
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'test-refresh-token',
        scope: 'mcp:tools',
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => tokenResponse,
      } as Response);
      
      const token = await oauth.exchangeCodeForToken('test-code');
      
      expect(token.access_token).toBe('test-access-token');
      expect(token.refresh_token).toBe('test-refresh-token');
      expect(token.expires_at).toBeGreaterThan(Date.now());
    });
    
    it('应该能够刷新 token', async () => {
      const mockFetch = vi.mocked(fetch);
      
      // 设置元数据
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          resource: 'http://localhost:3000',
          authorization_servers: ['http://localhost:8080'],
        }),
      } as Response);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          issuer: 'http://localhost:8080',
          token_endpoint: 'http://localhost:8080/token',
        }),
      } as Response);
      
      const oauth = new OAuthManager(config);
      await oauth.fetchProtectedResourceMetadata();
      await oauth.fetchAuthServerMetadata();
      
      // 设置现有 token
      oauth.setToken({
        access_token: 'old-token',
        token_type: 'Bearer',
        refresh_token: 'refresh-token',
        expires_at: Date.now() - 1000, // 已过期
      });
      
      // Mock 刷新响应
      const refreshResponse = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'new-refresh-token',
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => refreshResponse,
      } as Response);
      
      const newToken = await oauth.refreshToken();
      
      expect(newToken.access_token).toBe('new-access-token');
      expect(newToken.refresh_token).toBe('new-refresh-token');
    });
    
    it('应该能够检测 token 是否过期', () => {
      const oauth = new OAuthManager(config);
      
      // 未过期的 token
      oauth.setToken({
        access_token: 'test-token',
        token_type: 'Bearer',
        expires_at: Date.now() + 10 * 60 * 1000, // 10 分钟后过期
      });
      
      expect(oauth.isTokenExpired()).toBe(false);
      
      // 已过期的 token
      oauth.setToken({
        access_token: 'test-token',
        token_type: 'Bearer',
        expires_at: Date.now() - 1000, // 已过期
      });
      
      expect(oauth.isTokenExpired()).toBe(true);
      
      // 即将过期的 token (5 分钟内)
      oauth.setToken({
        access_token: 'test-token',
        token_type: 'Bearer',
        expires_at: Date.now() + 3 * 60 * 1000, // 3 分钟后过期
      });
      
      expect(oauth.isTokenExpired()).toBe(true);
    });
  });
  
  describe('清除认证', () => {
    it('应该能够清除认证信息', async () => {
      const oauth = new OAuthManager(config);
      
      oauth.setToken({
        access_token: 'test-token',
        token_type: 'Bearer',
      });
      
      expect(oauth.getToken()).toBeDefined();
      
      oauth.clearAuth();
      
      expect(oauth.getToken()).toBeUndefined();
    });
  });
});

