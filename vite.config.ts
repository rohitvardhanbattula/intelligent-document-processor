import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // START FIX: Support Top-level await for pdfjs-dist
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext'
    }
  },
  build: {
    target: 'esnext'
  },
  // END FIX

  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '8080'),
    proxy: {
      '/sap': {
        target: 'https://demo21.answerthinkdemo.com',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "", 
        headers: {
          'Connection': 'keep-alive'
        },
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Remove sensitive headers that cause CORS/Auth failures with SAP
            proxyReq.removeHeader('Cookie');
            // proxyReq.removeHeader('Referer'); // Removed to allow Referer
            proxyReq.removeHeader('Origin');
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '8080'),
    allowedHosts: true,
    proxy: {
      '/sap': {
        target: 'https://demo21.answerthinkdemo.com',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "",
        headers: {
          'Connection': 'keep-alive'
        },
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Remove sensitive headers that cause CORS/Auth failures with SAP
            proxyReq.removeHeader('Cookie');
            // proxyReq.removeHeader('Referer'); // Removed to allow Referer
            proxyReq.removeHeader('Origin');
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  },
});