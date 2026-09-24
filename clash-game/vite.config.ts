import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 47321,
    strictPort: false,
  },
  preview: {
    port: 47322,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
});
