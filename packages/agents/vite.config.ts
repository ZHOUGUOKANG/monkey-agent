import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MonkeyAgentAgents',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        '@monkey-agent/base',
        '@monkey-agent/types',
        '@monkey-agent/utils',
        '@e2b/code-interpreter',
        'ai',
        'eventemitter3',
        'zod',
        /^node:.*/,
        'fs/promises',
        'fs',
        'os',
        'path',
      ],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
      },
    },
  },
});
