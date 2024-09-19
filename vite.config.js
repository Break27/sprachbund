import { defineConfig } from 'vite'
import sprachbund from './src/scripts/sprachbund'

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    assetsDir: '_assets',
    emptyOutDir: true
  },
  plugins: [
    sprachbund()
  ]
})
