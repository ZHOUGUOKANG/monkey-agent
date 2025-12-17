import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // 排除手动运行的测试脚本（使用 tsx 直接运行，不是 vitest 测试）
      'src/__tests__/LLMClient.test.ts',
    ],
  },
});
