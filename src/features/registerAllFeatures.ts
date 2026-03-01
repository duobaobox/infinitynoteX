/**
 * Feature 统一注册入口
 *
 * 说明：
 * - 各 Feature 模块在导入时会执行 registerFeature() 副作用
 * - 通过本文件集中导入，确保只在应用入口处初始化一次
 */

import './note';
import './ai-workbench';
import './browser';
import './todo';
