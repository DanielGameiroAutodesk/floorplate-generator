import { defineConfig } from 'vite';
import { resolve } from 'path';

// Vite configuration for Forma extension development
export default defineConfig({
  // Root directory for the extension source
  root: resolve(__dirname, 'src/extension'),

  // Development server configuration
  server: {
    port: 5173,
    cors: true,
    headers: {
      // Required for Forma to load the extension in an iframe
      'Access-Control-Allow-Origin': '*',
    },
  },

  // Build configuration
  build: {
    // Output directory for production build
    outDir: resolve(__dirname, 'dist-extension'),
    emptyOutDir: true,

    // Generate source maps for debugging
    sourcemap: true,

    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/extension/index.html'),
        'floorplate-panel': resolve(__dirname, 'src/extension/floorplate-panel.html'),
      },
    },
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  // Optimize dependencies
  optimizeDeps: {
    include: ['forma-embedded-view-sdk'],
  },
});
