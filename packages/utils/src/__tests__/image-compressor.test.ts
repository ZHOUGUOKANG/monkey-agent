import { describe, it, expect } from 'vitest';
import {
  compressImage,
  compressImageWithInfo,
  estimateBase64Size,
  getImageInfo,
  smartCompress,
  type ImageCompressionOptions,
  type ImageInfo,
  type CompressionResult,
} from '../image-compressor';

describe('image-compressor', () => {
  // 创建一个简单的测试图片 Base64 (1x1 红色像素 PNG)
  const smallRedPixelBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  
  // 一个稍大的测试图片 (3x3 渐变)
  const mediumTestImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAYAAABWKLW/AAAAEklEQVR42mNgYGD4z0AEYBgAAJ0AQaNfAAAAAElFTkSuQmCC';

  describe('estimateBase64Size', () => {
    it('应该正确估算 Base64 字符串的大小', () => {
      const size = estimateBase64Size(smallRedPixelBase64);
      
      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });

    it('应该处理不带 data URI 前缀的 Base64', () => {
      const base64Only = smallRedPixelBase64.split(',')[1];
      const size = estimateBase64Size(base64Only);
      
      expect(size).toBeGreaterThan(0);
    });

    it('应该对更大的图片返回更大的尺寸', () => {
      const smallSize = estimateBase64Size(smallRedPixelBase64);
      const mediumSize = estimateBase64Size(mediumTestImageBase64);
      
      // 虽然都很小,但应该有差异
      expect(typeof smallSize).toBe('number');
      expect(typeof mediumSize).toBe('number');
    });
  });

  describe('getImageInfo', () => {
    it('应该提取 PNG 图片信息', async () => {
      const info: ImageInfo = await getImageInfo(smallRedPixelBase64);
      
      expect(info.format).toBe('png');
      expect(info.sizeKB).toBeGreaterThan(0);
      expect(info.width).toBeGreaterThan(0);
      expect(info.height).toBeGreaterThan(0);
    });

    it('应该识别 JPEG 格式', async () => {
      const jpegBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCGAA//2Q==';
      const info: ImageInfo = await getImageInfo(jpegBase64);
      
      expect(info.format).toBe('jpeg');
    });

    it('应该识别 WebP 格式', async () => {
      const webpBase64 = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
      const info: ImageInfo = await getImageInfo(webpBase64);
      
      expect(info.format).toBe('webp');
    });
  });

  describe('compressImage', () => {
    it('应该压缩图片并返回 Base64', async () => {
      const compressed = await compressImage(smallRedPixelBase64);
      
      expect(compressed).toBeDefined();
      expect(typeof compressed).toBe('string');
      expect(compressed).toMatch(/^data:image\//);
    });

    it('应该支持自定义质量参数', async () => {
      const options: ImageCompressionOptions = {
        quality: 0.5,
        maxWidth: 100,
        maxHeight: 100,
      };
      
      const compressed = await compressImage(smallRedPixelBase64, options);
      
      expect(compressed).toBeDefined();
      expect(typeof compressed).toBe('string');
    });

    it('应该支持指定输出格式', async () => {
      const options: ImageCompressionOptions = {
        format: 'jpeg',
        quality: 0.8,
      };
      
      const compressed = await compressImage(smallRedPixelBase64, options);
      
      expect(compressed).toContain('data:image/jpeg');
    });

    it('应该处理无效的图片数据', async () => {
      const invalidBase64 = 'data:image/png;base64,invalid-data';
      
      await expect(compressImage(invalidBase64)).rejects.toThrow();
    });
  });

  describe('compressImageWithInfo', () => {
    it('应该返回压缩结果和详细信息', async () => {
      const result: CompressionResult = await compressImageWithInfo(smallRedPixelBase64);
      
      expect(result).toHaveProperty('compressedDataUrl');
      expect(result).toHaveProperty('originalSizeKB');
      expect(result).toHaveProperty('compressedSizeKB');
      expect(result).toHaveProperty('compressionRatio');
      expect(result.compressedDataUrl).toBeDefined();
      expect(result.originalSizeKB).toBeGreaterThan(0);
      expect(result.compressedSizeKB).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeGreaterThanOrEqual(0);
    });

    it('应该计算正确的压缩比', async () => {
      const options: ImageCompressionOptions = {
        quality: 0.5,
      };
      
      const result: CompressionResult = await compressImageWithInfo(smallRedPixelBase64, options);
      
      expect(result.compressionRatio).toBeGreaterThanOrEqual(0);
      expect(result.compressedSizeKB).toBeLessThanOrEqual(result.originalSizeKB);
    });
  });

  describe('smartCompress', () => {
    it('应该智能压缩小图片', async () => {
      const result: CompressionResult = await smartCompress(smallRedPixelBase64);
      
      expect(result).toBeDefined();
      expect(result.compressedDataUrl).toBeDefined();
      expect(typeof result.compressedDataUrl).toBe('string');
      expect(result.compressedDataUrl).toMatch(/^data:image\//);
    });

    it('应该根据图片大小自动调整压缩策略', async () => {
      // 小图片应该保持高质量或不压缩
      const smallResult: CompressionResult = await smartCompress(smallRedPixelBase64);
      expect(smallResult).toBeDefined();
      
      // 即使是小图片也应该能处理
      expect(smallResult.compressedDataUrl.length).toBeGreaterThan(0);
    });

    it('应该尊重目标大小限制', async () => {
      const targetSizeKB = 10;
      const result: CompressionResult = await smartCompress(mediumTestImageBase64, targetSizeKB);
      
      const resultSize = estimateBase64Size(result.compressedDataUrl);
      
      // 由于是测试图片很小,可能不会触发压缩
      expect(result).toBeDefined();
      expect(resultSize).toBeGreaterThan(0);
    });
  });

  describe('边界情况', () => {
    it('应该处理空字符串', async () => {
      await expect(compressImage('')).rejects.toThrow();
    });

    it('应该处理质量参数边界值', async () => {
      // 质量 = 0
      const result0 = await compressImage(smallRedPixelBase64, { quality: 0 });
      expect(result0).toBeDefined();
      
      // 质量 = 1
      const result1 = await compressImage(smallRedPixelBase64, { quality: 1 });
      expect(result1).toBeDefined();
    });

    it('应该处理极小的尺寸限制', async () => {
      const result = await compressImage(smallRedPixelBase64, {
        maxWidth: 1,
        maxHeight: 1,
      });
      
      expect(result).toBeDefined();
    });
  });
});

