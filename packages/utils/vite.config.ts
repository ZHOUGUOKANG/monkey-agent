import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      outDir: 'dist',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MonkeyAgentUtils',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['fs', 'path', 'fs/promises', /^node:.*/],
    },
  },
});
