import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    // Inline CSS into JS for single file output
    cssCodeSplit: false,
    
    // Single output file configuration
    rollupOptions: {
      output: {
        // Disable code splitting - bundle everything into one file
        manualChunks: undefined,
        
        // Clean asset naming
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    },
    
    // Optimize for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true
      }
    },
    
    // Chunk size warning limit
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 5175,
    host: true, // Allow network access
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
});
