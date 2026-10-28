import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// H5 本地开发固定端口与 /api 代理（与 src/manifest.json 的 h5.devServer 保持一致）
export default defineConfig({
  plugins: [uni()],
  // .env 统一放在项目根目录（前后端共用）；Vite 仅向客户端暴露 VITE_ 前缀变量
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:3300', changeOrigin: true }
    }
  }
})
