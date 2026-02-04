
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: If your repo name is not 'hyrox-531-app', update this base path to match the repo name.
  base: '/hyrox-531-app/',
})
