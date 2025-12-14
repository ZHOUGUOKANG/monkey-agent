/**
 * 图片压缩工具
 * 
 * 用于压缩截图等大型图片，防止上下文溢出
 * 支持浏览器环境（Canvas API）
 */

/**
 * 图片压缩配置
 */
export interface ImageCompressionOptions {
  /** 最大宽度，默认 1024 */
  maxWidth?: number;
  /** 最大高度，默认 1024 */
  maxHeight?: number;
  /** JPEG 质量 0-1，默认 0.7 */
  quality?: number;
  /** 输出格式，默认 jpeg */
  format?: 'jpeg' | 'png';
}

/**
 * 图片信息
 */
export interface ImageInfo {
  width: number;
  height: number;
  format: string;
  sizeKB: number;
}

/**
 * 压缩结果
 */
export interface CompressionResult {
  compressedDataUrl: string;
  originalSizeKB: number;
  compressedSizeKB: number;
  compressionRatio: number;
  width: number;
  height: number;
}

/**
 * 压缩图片
 * 
 * @param dataUrl 原始 base64 DataURL
 * @param options 压缩选项
 * @returns 压缩后的 DataURL
 */
export async function compressImage(
  dataUrl: string,
  options: ImageCompressionOptions = {}
): Promise<string> {
  const {
    maxWidth = 1024,
    maxHeight = 1024,
    quality = 0.7,
    format = 'jpeg',
  } = options;

  // 检查是否在 Service Worker 环境中（没有 document 但有 OffscreenCanvas）
  const isServiceWorker = typeof document === 'undefined' && typeof OffscreenCanvas !== 'undefined';

  if (isServiceWorker) {
    // Service Worker 环境：使用 OffscreenCanvas
    return await compressImageInServiceWorker(dataUrl, maxWidth, maxHeight, quality, format);
  } else {
    // 浏览器环境：使用 Image + Canvas
    return await compressImageInBrowser(dataUrl, maxWidth, maxHeight, quality, format);
  }
}

/**
 * 在浏览器环境中压缩图片（使用 Image + Canvas）
 */
async function compressImageInBrowser(
  dataUrl: string,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  format: 'jpeg' | 'png'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        // 计算缩放比例
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        // 创建 Canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // 绘制图片
        ctx.drawImage(img, 0, 0, width, height);

        // 导出压缩后的图片
        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        const compressed = canvas.toDataURL(mimeType, quality);

        resolve(compressed);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = dataUrl;
  });
}

/**
 * 在 Service Worker 环境中压缩图片（使用 OffscreenCanvas）
 */
async function compressImageInServiceWorker(
  dataUrl: string,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  format: 'jpeg' | 'png'
): Promise<string> {
  try {
    console.log('[Service Worker] Starting image compression', { maxWidth, maxHeight, quality, format });
    
    // 将 base64 转换为 Blob
    const base64Data = dataUrl.split(',')[1];
    const mimeType = dataUrl.match(/data:(.*?);/)?.[1] || 'image/png';
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });

    console.log('[Service Worker] Created blob', { size: blob.size, type: blob.type });

    // 使用 createImageBitmap 加载图片
    const imageBitmap = await createImageBitmap(blob);
    
    console.log('[Service Worker] Created ImageBitmap', { 
      originalWidth: imageBitmap.width, 
      originalHeight: imageBitmap.height 
    });

    // 计算缩放比例
    let { width, height } = imageBitmap;
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.floor(width * ratio);
      height = Math.floor(height * ratio);
    }

    console.log('[Service Worker] Target dimensions', { width, height });

    // 创建 OffscreenCanvas
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('OffscreenCanvas context not available');
    }

    // 绘制图片
    ctx.drawImage(imageBitmap, 0, 0, width, height);

    // 转换为 Blob
    const outputMimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const compressedBlob = await canvas.convertToBlob({
      type: outputMimeType,
      quality,
    });

    console.log('[Service Worker] Compressed blob', { 
      size: compressedBlob.size, 
      type: compressedBlob.type 
    });

    // 将 Blob 转换回 base64
    const arrayBuffer = await compressedBlob.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const result = `data:${outputMimeType};base64,${base64}`;
    console.log('[Service Worker] Compression complete', { 
      resultLength: result.length 
    });

    return result;
  } catch (error) {
    console.error('[Service Worker] Image compression failed:', error);
    throw new Error(`Service Worker image compression failed: ${error}`);
  }
}

/**
 * 压缩图片并返回详细信息
 * 
 * @param dataUrl 原始 base64 DataURL
 * @param options 压缩选项
 * @returns 压缩结果（包含详细信息）
 */
export async function compressImageWithInfo(
  dataUrl: string,
  options: ImageCompressionOptions = {}
): Promise<CompressionResult> {
  try {
    const originalSizeKB = estimateBase64Size(dataUrl);
    console.log('[compressImageWithInfo] Starting compression', { originalSizeKB, options });

    const compressedDataUrl = await compressImage(dataUrl, options);
    const compressedSizeKB = estimateBase64Size(compressedDataUrl);
    const compressionRatio = Math.round((1 - compressedSizeKB / originalSizeKB) * 100);

    console.log('[compressImageWithInfo] Compression complete', { 
      compressedSizeKB, 
      compressionRatio 
    });

    // 获取压缩后的尺寸
    const compressedInfo = await getImageInfo(compressedDataUrl);
    
    console.log('[compressImageWithInfo] Got image info', { 
      width: compressedInfo.width, 
      height: compressedInfo.height 
    });

    return {
      compressedDataUrl,
      originalSizeKB,
      compressedSizeKB,
      compressionRatio,
      width: compressedInfo.width,
      height: compressedInfo.height,
    };
  } catch (error) {
    console.error('[compressImageWithInfo] Error:', error);
    throw error;
  }
}

/**
 * 估算 base64 数据大小（KB）
 * 
 * @param dataUrl Base64 DataURL
 * @returns 大小（KB）
 */
export function estimateBase64Size(dataUrl: string): number {
  // Base64 编码后大小约为原始数据的 4/3
  // DataURL 格式：data:image/jpeg;base64,<data>
  const base64Data = dataUrl.split(',')[1] || dataUrl;
  return Math.round((base64Data.length * 3) / 4 / 1024);
}

/**
 * 获取图片信息
 * 
 * @param dataUrl Base64 DataURL
 * @returns 图片信息
 */
export async function getImageInfo(dataUrl: string): Promise<ImageInfo> {
  const isServiceWorker = typeof document === 'undefined' && typeof OffscreenCanvas !== 'undefined';

  if (isServiceWorker) {
    // Service Worker 环境：使用 createImageBitmap
    try {
      const base64Data = dataUrl.split(',')[1];
      const mimeType = dataUrl.match(/data:(.*?);/)?.[1] || 'image/png';
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      const imageBitmap = await createImageBitmap(blob);
      
      const format = dataUrl.match(/data:image\/(\w+);/)?.[1] || 'unknown';
      const sizeKB = estimateBase64Size(dataUrl);
      
      return {
        width: imageBitmap.width,
        height: imageBitmap.height,
        format,
        sizeKB,
      };
    } catch (error) {
      throw new Error(`Failed to get image info in Service Worker: ${error}`);
    }
  } else {
    // 浏览器环境：使用 Image
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        const format = dataUrl.match(/data:image\/(\w+);/)?.[1] || 'unknown';
        const sizeKB = estimateBase64Size(dataUrl);
        
        resolve({
          width: img.width,
          height: img.height,
          format,
          sizeKB,
        });
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }
}

/**
 * 智能压缩：自动调整参数以达到目标大小
 * 
 * @param dataUrl 原始 DataURL
 * @param targetSizeKB 目标大小（KB），默认 50KB
 * @returns 压缩结果
 */
export async function smartCompress(
  dataUrl: string,
  targetSizeKB: number = 50
): Promise<CompressionResult> {
  const originalSizeKB = estimateBase64Size(dataUrl);

  // 如果已经小于目标，直接返回
  if (originalSizeKB <= targetSizeKB) {
    const info = await getImageInfo(dataUrl);
    return {
      compressedDataUrl: dataUrl,
      originalSizeKB,
      compressedSizeKB: originalSizeKB,
      compressionRatio: 0,
      width: info.width,
      height: info.height,
    };
  }

  // 估算需要的质量
  const ratio = targetSizeKB / originalSizeKB;
  let quality = Math.max(0.3, Math.min(0.9, ratio * 1.2));

  // 第一次尝试
  let result = await compressImageWithInfo(dataUrl, {
    maxWidth: 1024,
    maxHeight: 1024,
    quality,
    format: 'jpeg',
  });

  // 如果还是太大，降低质量
  if (result.compressedSizeKB > targetSizeKB * 1.2 && quality > 0.4) {
    quality = Math.max(0.3, quality - 0.2);
    result = await compressImageWithInfo(dataUrl, {
      maxWidth: 1024,
      maxHeight: 1024,
      quality,
      format: 'jpeg',
    });
  }

  // 如果还是太大，降低分辨率
  if (result.compressedSizeKB > targetSizeKB * 1.5) {
    result = await compressImageWithInfo(dataUrl, {
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.6,
      format: 'jpeg',
    });
  }

  return result;
}

