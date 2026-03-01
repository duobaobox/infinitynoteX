/**
 * 统一模块注册中心
 *
 * 所有数据模块在此注册，包括存储配置和同步配置
 * 新增模块只需在 STORAGE_MODULES 数组添加配置即可
 */

import { z } from 'zod';
import { NoteSchema, AIConversationSchema, TrashItemSchema, BrowserCardSchema } from '../schemas';

// ============ 类型定义 ============

/**
 * 存储模块特性配置
 */
export interface StorageModuleFeatures {
  /** 支持软删除（移入回收站） */
  softDelete: boolean;
  /** 生成摘要（用于索引） */
  generateExcerpt: boolean;
  /** 自定义排序字段 */
  sortField?: string;
  /** 是否参与索引 */
  hasIndex: boolean;
}

/**
 * 同步配置
 */
export interface SyncConfig {
  /** 是否启用同步 */
  enabled: boolean;
  /** 同步类型：单文件或目录 */
  type: 'file' | 'directory';
}

/**
 * 存储模块配置
 */
export interface StorageModuleConfig {
  /** 模块唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 目录名（如 'notes'）或文件名（如 'folders.json'） */
  path: string;
  /** 文件扩展名（目录类型时使用） */
  extension: string;
  /** 数据 Schema */
  schema: z.ZodSchema;
  /** 同步配置 */
  sync: SyncConfig;
  /** 特性配置 */
  features: StorageModuleFeatures;
  /** 描述说明 */
  description: string;
}

// ============ 模块注册 ============

/**
 * 已注册的存储模块
 *
 * 【如何添加新的数据模块】
 * 1. 在 schemas.ts 定义 Schema 和 IndexSchema
 * 2. 在此数组添加模块配置
 * 3. （可选）如需特殊逻辑，创建继承 BaseStorage 的子类
 */
export const STORAGE_MODULES: StorageModuleConfig[] = [
  // ============ 文件夹（目录存储，每个文件夹一个文件） ============
  {
    id: 'folders',
    name: '文件夹',
    path: 'folders',
    extension: '.json',
    schema: z.any(), // folders 使用特殊存储，不需要严格 schema
    sync: { enabled: true, type: 'directory' },
    features: {
      softDelete: false,
      generateExcerpt: false,
      sortField: 'order',
      hasIndex: true,
    },
    description: '文件夹配置信息',
  },

  // ============ 便签 ============
  {
    id: 'notes',
    name: '便签',
    path: 'notes',
    extension: '.json',
    schema: NoteSchema,
    sync: { enabled: true, type: 'directory' },
    features: {
      softDelete: true,
      generateExcerpt: true,
      sortField: 'createdAt',
      hasIndex: true,
    },
    description: '便签内容',
  },

  // ============ AI 对话 ============
  {
    id: 'ai-conversations',
    name: 'AI 对话',
    path: 'ai-conversations',
    extension: '.json',
    schema: AIConversationSchema,
    sync: { enabled: false, type: 'directory' },
    features: {
      softDelete: false,
      generateExcerpt: true,
      sortField: 'createdAt',
      hasIndex: true,
    },
    description: 'AI 助手对话记录（本地专用，不同步）',
  },

  // ============ 回收站（本地专用，不同步） ============
  {
    id: 'trash',
    name: '回收站',
    path: 'trash',
    extension: '.json',
    schema: TrashItemSchema,
    sync: { enabled: false, type: 'directory' },
    features: {
      softDelete: false,
      generateExcerpt: true,
      sortField: 'deletedAt',
      hasIndex: true,
    },
    description: '已删除便签（30天后自动清理）',
  },

  // ============ 附件（图片等二进制文件） ============
  {
    id: 'attachments',
    name: '附件',
    path: 'attachments',
    extension: '', // 允许任意扩展名（.webp, .png, .jpg 等）
    schema: z.any(), // 二进制文件不需要 schema 验证
    sync: { enabled: true, type: 'directory' },
    features: {
      softDelete: false,
      generateExcerpt: false,
      hasIndex: false,
    },
    description: '图片等附件文件',
  },

  // ============ 网页看板卡片 ============
  {
    id: 'browser-cards',
    name: '网页看板卡片',
    path: 'browser-cards',
    extension: '.json',
    schema: BrowserCardSchema,
    sync: { enabled: false, type: 'directory' },
    features: {
      softDelete: false,
      generateExcerpt: false,
      sortField: 'order',
      hasIndex: true,
    },
    description: '内置网页看板卡片（本地专用，不同步）',
  },

  // ============ Todo 清单 ============
  {
    id: 'todo-lists',
    name: 'Todo 清单',
    path: 'todo-lists',
    extension: '.json',
    schema: z.any(), // TodoListSchema 在 schemas.ts 中定义
    sync: { enabled: false, type: 'directory' },
    features: {
      softDelete: false,
      generateExcerpt: false,
      sortField: 'order',
      hasIndex: true,
    },
    description: 'Todo 清单列表（本地专用，不同步）',
  },

  // ============ 手动任务 ============
  {
    id: 'manual-tasks',
    name: '手动任务',
    path: 'manual-tasks',
    extension: '.json',
    schema: z.any(), // ManualTaskSchema 在 schemas.ts 中定义
    sync: { enabled: false, type: 'directory' },
    features: {
      softDelete: false,
      generateExcerpt: false,
      sortField: 'order',
      hasIndex: true,
    },
    description: 'Todo 手动任务（本地专用，不同步）',
  },

  // ============ 待办事项（旧版预留，暂未启用） ============
  // {
  //   id: 'todos',
  //   name: '待办事项',
  //   path: 'todos',
  //   extension: '.json',
  //   schema: TodoSchema,
  //   sync: { enabled: true, type: 'directory' },
  //   features: {
  //     softDelete: true,
  //     generateExcerpt: false,
  //     sortField: 'updatedAt',
  //     hasIndex: true,
  //   },
  //   description: '待办事项列表',
  // },
];

// ============ 便捷方法 ============

/**
 * 根据 ID 获取模块配置
 */
export function getModuleConfig(moduleId: string): StorageModuleConfig | undefined {
  return STORAGE_MODULES.find((m) => m.id === moduleId);
}

/**
 * 获取所有启用同步的模块
 */
export function getSyncEnabledModules(): StorageModuleConfig[] {
  return STORAGE_MODULES.filter((m) => m.sync.enabled);
}

/**
 * 获取所有目录类型的模块
 */
export function getDirectoryModules(): StorageModuleConfig[] {
  return STORAGE_MODULES.filter((m) => m.sync.type === 'directory');
}

/**
 * 获取所有文件类型的模块
 */
export function getFileModules(): StorageModuleConfig[] {
  return STORAGE_MODULES.filter((m) => m.sync.type === 'file');
}

/**
 * 获取需要同步的文件列表（单文件类型）
 */
export function getSyncFiles(): string[] {
  return STORAGE_MODULES.filter((m) => m.sync.enabled && m.sync.type === 'file').map((m) => m.path);
}

/**
 * 获取需要同步的目录列表
 */
export function getSyncDirectories(): string[] {
  return STORAGE_MODULES.filter((m) => m.sync.enabled && m.sync.type === 'directory').map(
    (m) => m.path,
  );
}

/**
 * 检查路径是否在同步范围内
 */
export function isPathInSyncScope(relativePath: string): boolean {
  // 排除冲突备份文件
  if (relativePath.includes('.conflict-')) {
    return false;
  }

  for (const mod of STORAGE_MODULES) {
    if (!mod.sync.enabled) continue;

    if (mod.sync.type === 'file' && mod.path === relativePath) {
      return true;
    }

    if (mod.sync.type === 'directory') {
      if (relativePath.startsWith(`${mod.path}/`) && relativePath.endsWith(mod.extension)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 根据路径获取所属模块
 */
export function getModuleByPath(relativePath: string): StorageModuleConfig | undefined {
  for (const mod of STORAGE_MODULES) {
    if (mod.sync.type === 'file' && mod.path === relativePath) {
      return mod;
    }
    if (mod.sync.type === 'directory') {
      if (relativePath.startsWith(`${mod.path}/`) && relativePath.endsWith(mod.extension)) {
        return mod;
      }
    }
  }
  return undefined;
}

/**
 * 获取所有需要创建的目录列表
 */
export function getAllDirectories(): string[] {
  const dirs = new Set<string>();
  // 系统目录
  dirs.add('temp');
  dirs.add('backups');
  // 模块目录
  for (const mod of STORAGE_MODULES) {
    if (mod.sync.type === 'directory') {
      dirs.add(mod.path);
    }
  }
  return Array.from(dirs);
}
