import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

/** `npm run build:single` → dist-single/index.html : the whole site in ONE file (open it, e-mail it, or host it anywhere). */
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { outDir: 'dist-single', chunkSizeWarningLimit: 5000, rollupOptions: { output: { inlineDynamicImports: true } } },
})
