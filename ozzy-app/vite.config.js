import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Dev-only reverse proxy. Ports must match how the backends are actually run
  // locally (and what Docker/nginx use in production):
  //   ozzy-api  → :5000   (auth, scans, history, Argus engines)
  //   ozzy-ai   → :7860   (RAG chat: /ask and /ask/stream)
  server: {
    proxy: {
      '/scan': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/ask': {
        target: 'http://localhost:7860',
        changeOrigin: true,
      },
    },
  }
});
