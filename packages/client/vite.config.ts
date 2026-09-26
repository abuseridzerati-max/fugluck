import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { getClientDeployment } from './deploymentConfig.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const deployment = getClientDeployment({ ...loadEnv(mode, process.cwd(), ''), ...process.env });
  return {
  plugins: [react(), {
    name: 'fugluck-deployment-identity',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'deployment.json', source: JSON.stringify({ ...deployment, apiOrigin: process.env.VITE_API_URL ?? loadEnv(mode, process.cwd(), '').VITE_API_URL ?? 'local', commercialMoneyEnabled: false }) });
    },
  }],
  define: {
    'import.meta.env.VITE_BUILD_REVISION': JSON.stringify(deployment.revision),
    'import.meta.env.VITE_APP_ENV': JSON.stringify(deployment.environment),
  },
  server: {
    // Default (no host set) resolved "localhost" to IPv6-only (::1) on
    // this machine, so browsers trying IPv4 127.0.0.1 first got
    // ECONNREFUSED. Binding explicitly covers both.
    host: true,
  },
  }
})
