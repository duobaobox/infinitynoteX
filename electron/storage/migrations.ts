/**
 * Schema 迁移框架
 * 用于数据版本升级和字段变更
 */

// ============ 迁移类型定义 ============

export interface Migration {
  /** 目标版本号 */
  version: number;
  /** 迁移描述 */
  name: string;
  /** 迁移函数 - 升级数据到新版本 */
  up: (data: unknown) => unknown;
  /** （可选）回滚函数 - 降级数据到旧版本 */
  down?: (data: unknown) => unknown;
}

// ============ 迁移定义 ============

/**
 * 所有迁移按版本号升序排列
 *
 * 添加新迁移的步骤：
 * 1. 在此数组末尾添加新迁移对象
 * 2. version 设置为上一个版本号 + 1
 * 3. 实现 up 函数，返回升级后的数据
 * 4. 更新 CURRENT_SCHEMA_VERSION 常量
 */
export const migrations: Migration[] = [
  // 示例迁移（从版本 1 升级到版本 2）
  // {
  //   version: 2,
  //   name: 'Add priority field to Note',
  //   up: (note: Note) => ({
  //     ...note,
  //     priority: 'medium', // 默认值
  //   }),
  //   down: (note: any) => {
  //     const { priority, ...rest } = note;
  //     return rest;
  //   },
  // },
];

// ============ 常量 ============

/** 当前 Schema 版本号 */
export const CURRENT_SCHEMA_VERSION = 1;

/** 初始 Schema 版本号 */
export const INITIAL_SCHEMA_VERSION = 1;

// ============ 迁移执行函数 ============

/**
 * 应用迁移到单个数据对象
 * @param data 原始数据
 * @param fromVersion 起始版本
 * @param toVersion 目标版本
 * @param dataType 数据类型（用于日志）
 * @returns 迁移后的数据
 */
export function applyMigrations(
  data: unknown,
  fromVersion: number,
  toVersion: number,
  dataType: string = 'data',
): unknown {
  let result: unknown = data;
  let appliedCount = 0;

  for (const migration of migrations) {
    if (migration.version > fromVersion && migration.version <= toVersion) {
      console.log(`[Migration] Applying ${dataType}: v${migration.version} - ${migration.name}`);
      // 迁移函数输入输出为 unknown，调用时按具体实现转换
      result = migration.up(result);
      appliedCount++;
    }
  }

  if (appliedCount > 0) {
    console.log(`[Migration] Applied ${appliedCount} migration(s) to ${dataType}`);
  }

  return result;
}

/**
 * 检查是否需要迁移
 * @param currentVersion 当前版本
 * @param targetVersion 目标版本
 * @returns 是否需要迁移
 */
export function needsMigration(currentVersion: number, targetVersion: number): boolean {
  return currentVersion < targetVersion;
}

/**
 * 获取待应用的迁移列表
 * @param fromVersion 起始版本
 * @param toVersion 目标版本
 * @returns 待应用的迁移列表
 */
export function getPendingMigrations(fromVersion: number, toVersion: number): Migration[] {
  return migrations.filter((m) => m.version > fromVersion && m.version <= toVersion);
}
