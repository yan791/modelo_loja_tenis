import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // caminhos relativos: o build funciona em qualquer hospedagem, inclusive em subpasta
  base: './',
  plugins: [react()],
  // o OneDrive transforma node_modules em atalhos de nuvem; sem isto o build perde os imports
  resolve: { preserveSymlinks: true },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
})
