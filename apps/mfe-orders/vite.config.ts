import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import federation from '@originjs/vite-plugin-federation'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'mfeOrders',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/App.tsx',
      },
      shared: ['react', 'react-dom', 'react-router-dom', '@auditoria/telemetry'],
    }),
  ],
  server: {
    port: 5175,
  },
  build: {
    target: 'esnext',
    minify: false,
  },
})
