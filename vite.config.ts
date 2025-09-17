import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: '0.0.0.0',
    allowedHosts: ['util', 'localhost', '127.0.0.1'],
        proxy: {
          '/r1': {
            target: 'https://api.ruckus.cloud',
            changeOrigin: true,
            secure: true,
            rewrite: (path) => path.replace(/^\/r1/, ''),
            headers: {
              origin: 'https://api.ruckus.cloud',
            },
            configure: (proxy: any) => {
              proxy.on('proxyReq', (proxyReq: any) => {
                try { 
                  proxyReq.removeHeader('origin') 
                } catch {
                  // Ignore if header doesn't exist
                }
                try { 
                  proxyReq.removeHeader('referer') 
                } catch {
                  // Ignore if header doesn't exist
                }
                console.log('Sending Request to the Target:', proxyReq.method, proxyReq.path);
              });
              proxy.on('proxyRes', (proxyRes: any, req: any) => {
                console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
              });
            },
          },
          '/r1-eu': {
            target: 'https://api.eu.ruckus.cloud',
            changeOrigin: true,
            secure: true,
            rewrite: (path) => path.replace(/^\/r1-eu/, ''),
            headers: {
              origin: 'https://api.eu.ruckus.cloud',
            },
            configure: (proxy: any) => {
              proxy.on('proxyReq', (proxyReq: any) => {
                try { 
                  proxyReq.removeHeader('origin') 
                } catch {
                  // Ignore if header doesn't exist
                }
                try { 
                  proxyReq.removeHeader('referer') 
                } catch {
                  // Ignore if header doesn't exist
                }
              });
            },
          },
          '/r1-asia': {
            target: 'https://api.asia.ruckus.cloud',
            changeOrigin: true,
            secure: true,
            rewrite: (path) => path.replace(/^\/r1-asia/, ''),
            headers: {
              origin: 'https://api.asia.ruckus.cloud',
            },
            configure: (proxy: any) => {
              proxy.on('proxyReq', (proxyReq: any) => {
                try { 
                  proxyReq.removeHeader('origin') 
                } catch {
                  // Ignore if header doesn't exist
                }
                try { 
                  proxyReq.removeHeader('referer') 
                } catch {
                  // Ignore if header doesn't exist
                }
              });
            },
          },
        }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
