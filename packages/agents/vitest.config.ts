import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 集成测试通常需要更长的超时时间
    testTimeout: 60000,
    hookTimeout: 60000,
    // 限制并发数量，避免 E2B rate limit
    // 每个测试文件最多同时运行 2 个测试
    maxConcurrency: 2,
    // 文件并发数也限制为 1，确保测试串行执行
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/__tests__/**',
      ],
    },
  },
});
