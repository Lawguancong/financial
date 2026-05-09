import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'


// https://vite.dev/config/
export default defineConfig({
  // 基础路径，设置为绝对路径；
  base: '/',
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // 输出目录，使用新的目录名避免权限问题
    outDir: 'dist',
    // 静态资源目录，设置为空字符串表示在根目录
    assetsDir: 'assets',
    // 内联静态资源的大小限制，增加限制以尝试内联更多资源
    assetsInlineLimit: 1024 * 1024 * 3, // 3MB
    // 生成源映射
    sourcemap: false,
    // 最小化，使用默认的esbuild
    minify: 'esbuild',
  },

  // 开发服务器配置
  server: {},
  
  // 公共静态资源目录
  publicDir: 'public',
})
