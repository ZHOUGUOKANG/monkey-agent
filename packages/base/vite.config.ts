import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MonkeyAgentBase',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        '@monkey-agent/types',
        '@monkey-agent/llm',
        '@monkey-agent/compression',
        'eventemitter3',
        'ai',
        'zod',
        /^node:.*/,
      ],
    },
  },
});
