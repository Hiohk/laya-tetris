import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * 关键点：本地 Laya 决策服务（默认 http://localhost:8000）没有开启 CORS，
 * 浏览器直连会被同源策略拦截。因此这里用 Vite dev server 做代理：
 *   浏览器只请求同源相对路径  /v1/systemone
 *   Vite 在 Node 层转发到          http://localhost:8000/v1/systemone
 * 请求由 Node 发出，不受浏览器同源策略限制，模型服务无需任何改动。
 *
 * 想换目标地址：在项目根目录建 .env.local 写入 LAYA_TARGET=http://127.0.0.1:18110
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.LAYA_TARGET || 'http://localhost:8000'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      chunkSizeWarningLimit: 1200,
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: true,
      proxy: {
        '/v1': {
          target,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
