import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MonkeyAgentExperience',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['@monkey-agent/types'],
    },
  },
});
