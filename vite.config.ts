import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 1899,
        host: '0.0.0.0',
        proxy: {
          '/api/figma-mcp': {
            target: 'http://127.0.0.1:3845',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/figma-mcp/, '/mcp'),
            configure: (proxy, _options) => {
              proxy.on('error', (err, _req, _res) => {
                console.log('Figma MCP proxy error', err);
              });
              proxy.on('proxyReq', (proxyReq, req, _res) => {
                console.log('Proxying MCP request:', req.method, req.url);
              });
            },
          },
        },
      },
      // SPA fallback is enabled by default in Vite
      appType: 'spa',
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
        }
      },
      // Optimize Convex
      optimizeDeps: {
        include: ['convex/react', 'convex/browser'],
      },
      // Build config
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom'],
              convex: ['convex'],
            },
          },
        },
      },
    };
});
