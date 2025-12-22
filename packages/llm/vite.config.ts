import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      outDir: 'dist',
      entryRoot: 'src',
      compilerOptions: {
        composite: false,
        skipLibCheck: true,
      },
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MonkeyAgentLLM',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        'ai',
        'zod',
        '@ai-sdk/amazon-bedrock',
        '@ai-sdk/anthropic',
        '@ai-sdk/azure',
        '@ai-sdk/deepseek',
        '@ai-sdk/google',
        '@ai-sdk/google-vertex',
        '@ai-sdk/openai',
        '@openrouter/ai-sdk-provider',
        '@monkey-agent/types'
      ],
    },
  },
});
