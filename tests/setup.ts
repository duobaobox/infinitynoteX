/**
 * 全局测试配置
 * 在所有测试运行前执行
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';

// Mock Electron IPC and app
vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
  app: {
    getPath: vi.fn(() => path.join(os.tmpdir(), 'test-app-data')),
    getName: vi.fn(() => 'InfinityNoteX'),
    getVersion: vi.fn(() => '1.0.0'),
  },
  shell: {
    openExternal: vi.fn(),
    showItemInFolder: vi.fn(),
    openPath: vi.fn(),
  },
}));

// Mock window.electronAPI
const mockElectronAPI = {
  storage: {
    getNotes: vi.fn(),
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    getFolders: vi.fn(),
    createFolder: vi.fn(),
    updateFolder: vi.fn(),
    deleteFolder: vi.fn(),
  },
  ai: {
    getConversations: vi.fn(),
    createConversation: vi.fn(),
    updateConversation: vi.fn(),
    deleteConversation: vi.fn(),
  },
  config: {
    get: vi.fn(),
    set: vi.fn(),
  },
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// 导出 mock 供测试使用
export { mockElectronAPI };
