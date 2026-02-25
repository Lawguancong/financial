import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  // 基础路径，设置为绝对路径；
  base: '/',
  // base: './', //基础路径，设置为相对路径；
  plugins: [
    react(),
    // 自定义插件，移除生成的HTML中资源引用的crossorigin属性和相关逻辑
    // {
    //   name: 'remove-crossorigin',
    //   transformIndexHtml(html) {
    //     return html
    //       // 移除HTML中的crossorigin属性
    //       .replace(/crossorigin\s*=\s*["'][^"']*["']/g, '') // 移除 crossorigin="xxx"
    //       .replace(/\scrossorigin(?!\w)/g, '') // 移除单独的 crossorigin 属性
    //       .replace(/crossorigin/g, '')
    //       .replace(/crossorigin="anonymous"/g, '')
    //       .replace(/crossorigin="use-credentials"/g, '')
    //       // 修改内联脚本，移除crossOrigin检查逻辑
    //       .replace(/s\.crossOrigin==="use-credentials"\?u\.credentials="include":s\.crossOrigin==="anonymous"\?u\.credentials="omit":u\.credentials="same-origin"/g, 'u.credentials="omit"');
    //   },
    // },
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
  // // 公共静态资源目录
  publicDir: 'public',
})
