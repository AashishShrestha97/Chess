import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { ViteDevServer } from 'vite'
import { createReadStream } from 'fs'
import path from 'path'

// Custom plugin to add COOP/COEP headers for SharedArrayBuffer support
const headerPlugin = {
  name: 'add-coop-coep-headers',
  apply: 'serve' as const,
  configureServer(server: ViteDevServer) {
    return () => {
      // Middleware to serve node_modules files (for Stockfish wasm wrapper)
      server.middlewares.use('/node_modules', (req, res, next) => {
        try {
          const filePath = path.join(process.cwd(), 'node_modules', req.url || '');
          createReadStream(filePath)
            .on('error', () => {
              res.statusCode = 404;
              res.end('Not found');
            })
            .pipe(res);
        } catch (e) {
          res.statusCode = 500;
          res.end('Server error');
        }
      });

      server.middlewares.use((req, res, next) => {
        // Add headers to ALL responses
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        next();
      });
    };
  }
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), headerPlugin],
  worker: {
    format: 'es'
  },
  server: {
    // Proxy /api and /oauth2 requests to the backend during local development
    // so the frontend and backend appear same-site and cookies can be sent.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
      '/oauth2': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
