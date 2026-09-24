import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 47321,
    strictPort: false,
    allowedHosts: ['.loca.lt', '.trycloudflare.com'],
  },
  preview: {
    port: 47322,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
});
