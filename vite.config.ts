import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5273 },
  preview: { port: 5273 },
  build: { target: 'es2022' },
})
