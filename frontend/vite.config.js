import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: '../backend/static',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api':    'http://localhost:5000',
      '/socket.io': { target: 'http://localhost:5000', ws: true },
      '/audio':  'http://localhost:5000',
      '/models': 'http://localhost:5000',
    },
  },
});
