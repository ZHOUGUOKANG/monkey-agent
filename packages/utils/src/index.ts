/**
 * 工具函数导出
 * 
 * 注意：env-loader 使用 Node.js 的 fs/path，仅在 Node.js 环境使用
 * 浏览器环境应该避免导入整个包，而是按需导入特定工具
 */

// 图片压缩工具（浏览器兼容）
export {
  compressImage,
  compressImageWithInfo,
  estimateBase64Size,
  getImageInfo,
  smartCompress,
  type ImageCompressionOptions,
  type ImageInfo,
  type CompressionResult,
} from './image-compressor';

// 环境变量加载（Node.js 专用）
export {
  loadEnvFile,
  validateApiKey,
  getLLMConfig,
  initEnv,
  printEnvHelp,
  type LLMProvider,
  type EnvLoaderOptions,
  type ApiKeyValidation,
} from './env-loader';
