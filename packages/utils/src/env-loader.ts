/**
 * 环境变量加载工具
 * 
 * 提供统一的环境变量加载和验证功能
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * 支持的 LLM Provider 类型
 */
export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'bedrock' | 'azure' | 'vertex' | 'deepseek';

/**
 * 环境变量加载选项
 */
export interface EnvLoaderOptions {
  /** .env 文件路径（相对于当前工作目录） */
  envPath?: string;
  /** 是否打印加载信息 */
  verbose?: boolean;
  /** 是否覆盖已存在的环境变量 */
  override?: boolean;
}

/**
 * API Key 验证结果
 */
export interface ApiKeyValidation {
  /** 是否有效 */
  valid: boolean;
  /** 使用的 Provider */
  provider?: LLMProvider;
  /** API Key（如果有效） */
  apiKey?: string;
  /** 错误信息（如果无效） */
  error?: string;
}

/**
 * 加载 .env 文件
 * 
 * @param options 加载选项
 * @returns 是否成功加载
 * 
 * @example
 * ```typescript
 * // 默认加载根目录的 .env
 * loadEnvFile();
 * 
 * // 指定路径
 * loadEnvFile({ envPath: '.env.local' });
 * 
 * // 静默模式
 * loadEnvFile({ verbose: false });
 * ```
 */
export function loadEnvFile(options: EnvLoaderOptions = {}): boolean {
  const {
    envPath = '../../.env',
    verbose = true,
    override = false,
  } = options;

  const resolvedPath = path.resolve(process.cwd(), envPath);
  
  if (!fs.existsSync(resolvedPath)) {
    if (verbose) {
      console.log(`⚠️  未找到 .env 文件: ${resolvedPath}`);
    }
    return false;
  }

  try {
    const envContent = fs.readFileSync(resolvedPath, 'utf-8');
    let loadedCount = 0;

    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      
      // 跳过空行和注释
      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }

      // 解析 KEY=VALUE
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) {
        return;
      }

      const key = trimmed.substring(0, equalIndex).trim();
      let value = trimmed.substring(equalIndex + 1).trim();

      // 移除引号
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }

      // 设置环境变量（如果不存在或允许覆盖）
      if (key && value && (override || !process.env[key])) {
        process.env[key] = value;
        loadedCount++;
      }
    });

    if (verbose) {
      console.log(`✅ 已加载 .env 文件 (${loadedCount} 个变量)`);
    }
    return true;
  } catch (error) {
    if (verbose) {
      console.error(`❌ 加载 .env 文件失败:`, error);
    }
    return false;
  }
}

/**
 * 验证 API Key 是否有效
 * 
 * @param provider 指定的 Provider（可选）
 * @returns 验证结果
 * 
 * @example
 * ```typescript
 * // 自动检测可用的 Provider
 * const validation = validateApiKey();
 * if (validation.valid) {
 *   console.log(`使用 ${validation.provider}`);
 * }
 * 
 * // 验证特定 Provider
 * const validation = validateApiKey('openai');
 * ```
 */
export function validateApiKey(provider?: LLMProvider): ApiKeyValidation {
  // 无效的占位符 API Key
  const invalidKeys = ['sk-xxx', 'sk-ant-xxx', 'xxx', '', undefined];

  // 如果指定了 Provider，只检查该 Provider
  if (provider) {
    const envKey = `${provider.toUpperCase()}_API_KEY`;
    const apiKey = process.env[envKey];
    
    if (!apiKey || invalidKeys.includes(apiKey)) {
      return {
        valid: false,
        error: `未找到有效的 ${provider.toUpperCase()} API Key`,
      };
    }

    return {
      valid: true,
      provider,
      apiKey,
    };
  }

  // 按优先级检查所有 Provider
  const providers: LLMProvider[] = ['openai', 'anthropic', 'google', 'openrouter', 'deepseek', 'azure', 'bedrock', 'vertex'];
  
  for (const p of providers) {
    // Bedrock 和 Vertex 使用不同的认证方式
    if (p === 'bedrock') {
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      if (accessKeyId && secretAccessKey && 
          !invalidKeys.includes(accessKeyId) && 
          !invalidKeys.includes(secretAccessKey)) {
        return {
          valid: true,
          provider: p,
          apiKey: accessKeyId, // 返回 access key 作为标识
        };
      }
    } else if (p === 'vertex') {
      const project = process.env.GOOGLE_VERTEX_PROJECT;
      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      if (project && clientEmail && 
          !invalidKeys.includes(project) && 
          !invalidKeys.includes(clientEmail)) {
        return {
          valid: true,
          provider: p,
          apiKey: project, // 返回 project 作为标识
        };
      }
    } else {
      const envKey = `${p.toUpperCase()}_API_KEY`;
      const apiKey = process.env[envKey];
      
      if (apiKey && !invalidKeys.includes(apiKey)) {
        return {
          valid: true,
          provider: p,
          apiKey,
        };
      }
    }
  }

  return {
    valid: false,
    error: '未找到任何有效的 API Key (OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, DEEPSEEK_API_KEY, AZURE_API_KEY, AWS_ACCESS_KEY_ID, GOOGLE_VERTEX_PROJECT)',
  };
}

/**
 * 获取 LLM 配置
 * 
 * @param provider 指定的 Provider（可选，不指定则自动检测）
 * @returns LLM 配置对象
 * @throws 如果没有找到有效的 API Key
 * 
 * @example
 * ```typescript
 * // 自动检测
 * const config = getLLMConfig();
 * 
 * // 指定 Provider
 * const config = getLLMConfig('openai');
 * 
 * // 使用配置
 * const client = new LLMClient(config);
 * ```
 */
export function getLLMConfig(provider?: LLMProvider) {
  const validation = validateApiKey(provider);
  
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const selectedProvider = validation.provider!;
  const providerUpper = selectedProvider.toUpperCase();

  const config: any = {
    provider: selectedProvider,
  };

  // Provider 特定配置
  if (selectedProvider === 'bedrock') {
    // Amazon Bedrock 配置
    config.region = process.env.AWS_REGION;
    config.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    config.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    config.sessionToken = process.env.AWS_SESSION_TOKEN;
  } else if (selectedProvider === 'azure') {
    // Azure OpenAI 配置
    config.resourceName = process.env.AZURE_RESOURCE_NAME;
    config.apiKey = process.env.AZURE_API_KEY;
  } else if (selectedProvider === 'vertex') {
    // Google Vertex AI 配置
    config.project = process.env.GOOGLE_VERTEX_PROJECT;
    config.location = process.env.GOOGLE_VERTEX_LOCATION;
    // 如果有 Google Auth 凭证
    if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      config.googleAuthOptions = {
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
      };
    }
  } else {
    // 其他提供商使用标准 API Key
    config.apiKey = validation.apiKey;
  }

  // 添加可选配置
  const model = process.env[`${providerUpper}_MODEL`];
  if (model) {
    config.model = model;
  }

  const baseURL = process.env[`${providerUpper}_BASE_URL`];
  if (baseURL) {
    config.baseURL = baseURL;
  }

  const temperature = process.env[`${providerUpper}_TEMPERATURE`];
  if (temperature) {
    config.temperature = parseFloat(temperature);
  }

  const maxTokens = process.env[`${providerUpper}_MAX_TOKENS`];
  if (maxTokens) {
    config.maxTokens = parseInt(maxTokens, 10);
  }

  return config;
}

/**
 * 初始化环境变量（一步到位）
 * 
 * @param options 加载选项
 * @returns 验证结果
 * 
 * @example
 * ```typescript
 * const validation = initEnv();
 * if (!validation.valid) {
 *   console.error(validation.error);
 *   process.exit(1);
 * }
 * console.log(`✅ 使用 ${validation.provider}`);
 * ```
 */
export function initEnv(options: EnvLoaderOptions = {}): ApiKeyValidation {
  // 加载 .env 文件
  loadEnvFile(options);
  
  // 验证 API Key
  return validateApiKey();
}

/**
 * 打印环境变量帮助信息
 */
export function printEnvHelp() {
  console.log(`
📝 环境变量配置帮助

方式 1: 使用 .env 文件（推荐）
  在项目根目录创建 .env 文件：
  
  # OpenAI
  OPENAI_API_KEY=sk-your-openai-key
  OPENAI_MODEL=gpt-4o-mini
  OPENAI_BASE_URL=https://api.openai.com/v1  # 可选
  
  # Anthropic
  ANTHROPIC_API_KEY=sk-ant-your-key
  ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
  
  # Google Generative AI
  GOOGLE_API_KEY=your-google-key
  GOOGLE_MODEL=gemini-1.5-flash
  
  # DeepSeek
  DEEPSEEK_API_KEY=sk-your-deepseek-key
  DEEPSEEK_MODEL=deepseek-chat
  
  # Amazon Bedrock
  AWS_REGION=us-east-1
  AWS_ACCESS_KEY_ID=your-access-key-id
  AWS_SECRET_ACCESS_KEY=your-secret-access-key
  BEDROCK_MODEL=anthropic.claude-3-5-sonnet-20241022-v2:0
  
  # Azure OpenAI
  AZURE_RESOURCE_NAME=your-resource-name
  AZURE_API_KEY=your-azure-key
  AZURE_MODEL=gpt-4o  # deployment name
  
  # Google Vertex AI
  GOOGLE_VERTEX_PROJECT=your-project-id
  GOOGLE_VERTEX_LOCATION=us-central1
  GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
  GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
  VERTEX_MODEL=gemini-1.5-pro

方式 2: 使用环境变量
  export OPENAI_API_KEY=sk-your-key
  export OPENAI_MODEL=gpt-4o-mini
  
方式 3: 命令行传入
  OPENAI_API_KEY=sk-your-key yarn test
`);
}
