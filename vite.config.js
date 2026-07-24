import { defineConfig } from 'vite';

export default defineConfig({
  // rutas relativas: sirve igual en la raíz de un dominio o en un subdirectorio
  base: './',

  build: {
    target: 'es2022',
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        // three va en su propio chunk: cambia poco y se cachea aparte del código
        manualChunks: { three: ['three'] },
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]',
      },
    },
  },

  server: { port: 5173, open: true },
});
