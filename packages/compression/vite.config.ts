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
      name: 'MonkeyAgentCompression',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['ai', '@monkey-agent/llm', '@monkey-agent/types'],
    },
  },
});
