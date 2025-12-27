import { defineConfig } from 'vite';
import path from 'node:path';
import electron from 'vite-plugin-electron/simple';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 1997,
  },
  resolve: {
    // 确保使用正确的 React 导出
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, 'src/tiptap'),
    },
  },
  plugins: [
    react(),
    electron({
      main: {
        // `build.lib.entry` 的快捷方式。
        entry: 'electron/main.ts',
        // 配置主进程的构建选项
        vite: {
          build: {
            rollupOptions: {
              // 将原生模块作为外部依赖，避免打包问题
              external: ['better-sqlite3', 'sqlite-vec', 'adm-zip', 'electron-log'],
            },
          },
        },
      },
      preload: {
        // `build.rollupOptions.input` 的快捷方式。
        // 预加载脚本可能包含 Web 资源，所以使用 `build.rollupOptions.input` 而不是 `build.lib.entry`。
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      // 为渲染进程填充 Electron 和 Node.js API。
      // 如果你想在渲染进程中使用 Node.js，需要在主进程中启用 `nodeIntegration`。
      // 参见 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer:
        process.env.NODE_ENV === 'test'
          ? // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
            undefined
          : {},
    }),
    // 打包体积分析（仅在生产构建时生成）
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  optimizeDeps: {
    include: ['@ant-design/x', '@ant-design/x-markdown'],
    esbuildOptions: {
      preserveSymlinks: true,
    },
  },
  define: {
    // 为生产构建提供 process polyfill
    'process.env': {},
    'process.versions': JSON.stringify({}),
  },
  build: {
    chunkSizeWarningLimit: 1500,
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 生产环境压缩配置 - 使用 esbuild（更快）
    minify: 'esbuild',
    rollupOptions: {
      external: ['electron-updater', 'electron'],
      output: {
        // 代码分割策略 - 使用函数形式更灵活
        manualChunks(id: string) {
          // Ant Design 相关
          if (id.includes('node_modules/antd/')) {
            return 'vendor-antd';
          }
          if (id.includes('node_modules/@ant-design/icons')) {
            return 'vendor-antd-icons';
          }
          if (id.includes('node_modules/@ant-design/x')) {
            return 'vendor-antd-x';
          }
          // Tiptap 富文本编辑器
          if (id.includes('node_modules/@tiptap/')) {
            return 'vendor-tiptap';
          }
          // 代码高亮
          if (id.includes('node_modules/highlight.js/') || id.includes('node_modules/lowlight/')) {
            return 'vendor-highlight';
          }
          // React 核心
          if (id.includes('node_modules/react-dom/') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          // Zustand
          if (id.includes('node_modules/zustand/')) {
            return 'vendor-zustand';
          }
          // Lucide 图标
          if (id.includes('node_modules/lucide-react/')) {
            return 'vendor-lucide';
          }
          // Radix UI
          if (id.includes('node_modules/@radix-ui/')) {
            return 'vendor-radix';
          }
          // Floating UI
          if (id.includes('node_modules/@floating-ui/')) {
            return 'vendor-floating';
          }
        },
        // 优化 chunk 命名
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // 启用 source map 便于调试（可根据需要关闭）
    sourcemap: false,
    // 输出目录清理
    emptyOutDir: true,
  },
});
