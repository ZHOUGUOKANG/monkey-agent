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
      staticImport: true,
      compilerOptions: {
        composite: false,
        skipLibCheck: true,
      },
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'browser/index': resolve(__dirname, 'src/browser/index.ts'),
        'chat/index': resolve(__dirname, 'src/chat/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        '@monkey-agent/base',
        '@monkey-agent/types',
        '@monkey-agent/utils',
        '@monkey-agent/context',
        '@monkey-agent/orchestrator',
        '@e2b/code-interpreter',
        'robotjs',
        'ai',
        'eventemitter3',
        'zod',
        /^node:.*/,
        'fs/promises',
        'fs',
        'os',
        'path',
        'child_process',
        'util',
        'playwright',
      ],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
      },
    },
  },
});
