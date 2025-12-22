import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MonkeyAgentOrchestrator',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        '@monkey-agent/base',
        '@monkey-agent/types',
        '@monkey-agent/agents',
        'eventemitter3',
        /^node:.*/,
      ],
    },
  },
});
