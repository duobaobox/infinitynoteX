import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx', 'electron/**/*.ts'],
      exclude: ['**/*.d.ts', '**/index.ts'],
    },
    // Skip tests that depend on native modules (better-sqlite3) that need rebuilding
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-electron/**',
      'tests/unit/main/storage/storageManager.test.ts', // Requires better-sqlite3
      'tests/unit/main/storage/noteStorage.test.ts', // Requires better-sqlite3 via IndexCache
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@electron': path.resolve(__dirname, './electron'),
    },
  },
});
