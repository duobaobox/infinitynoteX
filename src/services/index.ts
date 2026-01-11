/**
 * Services - 服务层导出
 *
 * 架构说明（2026-01 决策）：
 * - 原有的"传声筒" Service（noteService, folderService 等）已删除
 * - 这些 Service 只是简单转发 IPC 调用，没有业务逻辑，属于过度设计
 * - 组件和 Store 直接调用 window.storage / window.ai 等 IPC API
 * - 此目录现在只保留有实际业务价值的服务（如 AI 配置、Provider 定义等）
 *
 * IPC 调用规范：
 * - 直接使用 window.storage.xxx() / window.ai.xxx() 等
 * - 类型声明在 src/vite-env.d.ts 和 src/types/electron.d.ts
 */

// 类型定义
export * from './types';

// AI 配置相关（有实际业务逻辑）
export * from './aiConfig';
export * from './aiProviders';
export * from './embeddingProviders';
export * from './knowledgeTypes';
