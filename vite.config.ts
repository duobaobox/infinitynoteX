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
              external: ['better-sqlite3', 'sqlite-vec'],
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
    rollupOptions: {
      external: ['electron-updater', 'electron'],
    },
  },
});
