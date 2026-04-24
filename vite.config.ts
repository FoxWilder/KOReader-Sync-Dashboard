import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    build: {
      minify: 'esbuild',
      cssMinify: true,
      reportCompressedSize: false, // Speed up build
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        maxParallelFileOps: 2, // Reduce FS load
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'motion', 'lucide-react'],
          },
        },
      },
    },
    worker: {
      format: 'es',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
