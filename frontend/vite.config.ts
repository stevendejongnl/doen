import { defineConfig } from 'vite';
import { execSync } from 'child_process';

function getVersion(): string {
  try {
    return execSync('git describe --tags --abbrev=0 2>/dev/null', { encoding: 'utf-8' }).trim() || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(getVersion()),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    target: 'es2022',
  },
});
