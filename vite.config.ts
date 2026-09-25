import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...(mode === 'production' ? {} : { audio: resolve(__dirname, 'audio.html') }),
      },
    },
  },
}));
