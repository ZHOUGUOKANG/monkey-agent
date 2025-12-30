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
      rollupTypes: true,
      compilerOptions: {
        composite: false,
        skipLibCheck: true,
        declarationMap: true,
      },
    }),
  ],
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
