import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';

export default defineConfig({
  base: '/dist/',
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: 'node_modules/tinymce/skins', dest: 'tinymce' },
        { src: 'node_modules/tinymce/themes', dest: 'tinymce' },
        { src: 'node_modules/tinymce/icons', dest: 'tinymce' },
        { src: 'node_modules/tinymce/models', dest: 'tinymce' },
        { src: 'node_modules/tinymce/plugins', dest: 'tinymce' },
        { src: 'node_modules/tinymce/tinymce.min.js', dest: 'tinymce' },
        { src: 'node_modules/tinymce/tinymce.js', dest: 'tinymce' },
      ],
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'wwwroot/app/react') },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      // dev-only: forward /api to the .NET host (default Kestrel HTTPS port for dotnet run)
      '/api': { target: 'https://localhost:5001', changeOrigin: true, secure: false },
    },
  },
  build: {
    outDir: 'wwwroot/dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'wwwroot/app/react/index.tsx'),
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'app-[name].js',
        assetFileNames: (asset) => {
          if (asset.name && asset.name.endsWith('.css')) return 'app.css';
          return 'assets/[name][extname]';
        },
      },
    },
  },
});
