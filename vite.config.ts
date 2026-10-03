import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { assetCatalog } from './plugin/asset-catalog.ts'

export default defineConfig({
  plugins: [assetCatalog(), react()],
  server: { port: 5273 },
  preview: { port: 5273 },
  build: { target: 'es2022' },
})
