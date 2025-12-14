/**
 * 设备标识管理器
 *
 * 管理设备唯一标识和设备信息
 * 用于多设备同步时的冲突追踪和来源标识
 */

import fs from 'node:fs/promises';
import { v4 as uuidv4 } from 'uuid';
import os from 'node:os';

export interface DeviceInfo {
  /** 设备唯一标识 */
  deviceId: string;
  /** 设备名称（用户可修改） */
  deviceName: string;
  /** 创建时间 */
  createdAt: number;
  /** 最后活跃时间 */
  lastActiveAt: number;
}

export class DeviceManager {
  private devicePath: string;
  private deviceInfo: DeviceInfo | null = null;

  constructor(devicePath: string) {
    this.devicePath = devicePath;
  }

  /**
   * 初始化设备标识
   * 如果不存在则自动创建
   */
  async initialize(): Promise<DeviceInfo> {
    try {
      const content = await fs.readFile(this.devicePath, 'utf-8');
      this.deviceInfo = JSON.parse(content) as DeviceInfo;
      // 更新最后活跃时间
      this.deviceInfo.lastActiveAt = Date.now();
      await this.save();
    } catch {
      // 文件不存在，创建新的设备标识
      this.deviceInfo = {
        deviceId: uuidv4(),
        deviceName: this.getDefaultDeviceName(),
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      };
      await this.save();
    }
    return this.deviceInfo;
  }

  /**
   * 获取设备标识
   */
  getDeviceId(): string {
    if (!this.deviceInfo) {
      throw new Error('DeviceManager not initialized');
    }
    return this.deviceInfo.deviceId;
  }

  /**
   * 获取设备信息
   */
  getDeviceInfo(): DeviceInfo {
    if (!this.deviceInfo) {
      throw new Error('DeviceManager not initialized');
    }
    return { ...this.deviceInfo };
  }

  /**
   * 设置设备名称
   */
  async setDeviceName(name: string): Promise<void> {
    if (!this.deviceInfo) {
      throw new Error('DeviceManager not initialized');
    }
    this.deviceInfo.deviceName = name;
    await this.save();
  }

  /**
   * 保存设备信息
   */
  private async save(): Promise<void> {
    if (!this.deviceInfo) return;
    await fs.writeFile(this.devicePath, JSON.stringify(this.deviceInfo, null, 2), 'utf-8');
  }

  /**
   * 获取默认设备名称
   */
  private getDefaultDeviceName(): string {
    const hostname = os.hostname();
    const platform = os.platform();

    const platformNames: Record<string, string> = {
      darwin: 'Mac',
      win32: 'Windows',
      linux: 'Linux',
    };

    const platformName = platformNames[platform] || platform;

    // 尝试生成友好的名称
    if (hostname) {
      // 移除常见的后缀
      const cleanName = hostname
        .replace(/\.local$/, '')
        .replace(/\.lan$/, '')
        .replace(/\.home$/, '');
      return cleanName || `${platformName} Device`;
    }

    return `${platformName} Device`;
  }
}
