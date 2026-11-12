import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rolldownOptions: {
      input:{
        sidepanel: 'index.html',
        'service-worker': 'src/background/service-worker.ts',
      },
      output:{
        entryFileNames: (chunk) => chunk.name === 'service-worker' ? 'service-worker.js' : 'assets/[name]-[hash].js'
      },
    },
  },
})
