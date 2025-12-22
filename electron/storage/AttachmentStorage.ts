/**
 * 附件存储模块
 * 管理图片等二进制附件的存储、读取、删除
 *
 * 设计说明：
 * - 附件以独立文件形式存储在 attachments/ 目录
 * - 文件命名规则：img-{uuid}.{ext}
 * - 支持图片压缩（使用 sharp 库）
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { nativeImage } from 'electron';

/**
 * 压缩配置
 */
export interface CompressionConfig {
  /** 最大宽度，超过则按比例缩小 */
  maxWidth: number;
  /** WebP 质量 (1-100) */
  quality: number;
  /** 是否启用压缩 */
  enabled: boolean;
}

/**
 * 附件信息
 */
export interface AttachmentInfo {
  id: string;
  filename: string;
  size: number;
  createdAt: number;
}

/**
 * 默认压缩配置
 */
const DEFAULT_COMPRESSION: CompressionConfig = {
  maxWidth: 1920,
  quality: 85,
  enabled: true,
};

/**
 * 附件存储类
 */
export class AttachmentStorage {
  private attachmentsDir: string;
  private compression: CompressionConfig;

  constructor(storagePath: string, compression?: Partial<CompressionConfig>) {
    this.attachmentsDir = path.join(storagePath, 'attachments');
    this.compression = { ...DEFAULT_COMPRESSION, ...compression };
  }

  /**
   * 更新存储路径（用于路径迁移后）
   */
  setStoragePath(newPath: string): void {
    this.attachmentsDir = path.join(newPath, 'attachments');
  }

  /**
   * 确保附件目录存在
   */
  async ensureDir(): Promise<void> {
    await fs.mkdir(this.attachmentsDir, { recursive: true });
  }

  /**
   * 保存附件
   * @param data Base64 编码的图片数据（不含 data:image/xxx;base64, 前缀）
   * @param ext 文件扩展名 (png, jpg, webp 等)
   * @returns 附件 ID（不含扩展名）
   */
  async save(data: string, ext: string): Promise<string> {
    await this.ensureDir();

    // 解码 Base64
    const buffer = Buffer.from(data, 'base64');

    // 压缩图片（如果启用）
    let finalBuffer = buffer;
    let finalExt = ext;

    if (this.compression.enabled && this.isImage(ext)) {
      try {
        const compressed = await this.compressImage(buffer);
        finalBuffer = Buffer.from(compressed);
        finalExt = 'jpg'; // 压缩后统一使用 jpg 格式
      } catch (error) {
        console.warn('[AttachmentStorage] Compression failed, using original:', error);
        // 压缩失败时使用原始数据
      }
    }

    // 生成唯一 ID
    const id = `img-${uuidv4()}`;
    const filename = `${id}.${finalExt}`;
    const filePath = path.join(this.attachmentsDir, filename);

    // 写入文件
    await fs.writeFile(filePath, finalBuffer);

    console.log(`[AttachmentStorage] Saved: ${filename} (${finalBuffer.length} bytes)`);

    return id;
  }

  /**
   * 从完整 Base64 Data URL 保存
   * @param dataUrl 形如 data:image/png;base64,xxxxx 的字符串
   * @returns 附件 ID
   */
  async saveFromDataUrl(dataUrl: string): Promise<string> {
    // 解析 data URL
    const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid data URL format');
    }

    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const data = match[2];

    return this.save(data, ext);
  }

  /**
   * 获取附件的完整文件路径
   * @param id 附件 ID（不含扩展名）
   * @returns 完整路径，如果找不到则返回 null
   */
  async getPath(id: string): Promise<string | null> {
    try {
      const files = await fs.readdir(this.attachmentsDir);
      const match = files.find((f) => f.startsWith(`${id}.`));
      if (match) {
        return path.join(this.attachmentsDir, match);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 同步获取附件路径（假设为 webp 格式，用于协议处理）
   */
  getPathSync(id: string): string {
    // 先尝试 jpg（压缩后的格式）
    return path.join(this.attachmentsDir, `${id}.jpg`);
  }

  /**
   * 删除附件
   */
  async delete(id: string): Promise<void> {
    const filePath = await this.getPath(id);
    if (filePath) {
      await fs.unlink(filePath);
      console.log(`[AttachmentStorage] Deleted: ${id}`);
    }
  }

  /**
   * 列出所有附件
   */
  async list(): Promise<AttachmentInfo[]> {
    try {
      const files = await fs.readdir(this.attachmentsDir);
      const attachments: AttachmentInfo[] = [];

      for (const filename of files) {
        // 跳过非图片文件
        if (!filename.startsWith('img-')) continue;

        const filePath = path.join(this.attachmentsDir, filename);
        try {
          const stat = await fs.stat(filePath);
          const id = filename.split('.')[0];
          attachments.push({
            id,
            filename,
            size: stat.size,
            createdAt: stat.birthtimeMs,
          });
        } catch {
          // 跳过无法读取的文件
        }
      }

      return attachments;
    } catch {
      return [];
    }
  }

  /**
   * 检查附件是否存在
   */
  async exists(id: string): Promise<boolean> {
    const filePath = await this.getPath(id);
    return filePath !== null;
  }

  /**
   * 获取附件目录路径
   */
  getDir(): string {
    return this.attachmentsDir;
  }

  /**
   * 读取附件内容
   */
  async read(id: string): Promise<Buffer | null> {
    const filePath = await this.getPath(id);
    if (!filePath) return null;
    return fs.readFile(filePath);
  }

  // ============ 私有方法 ============

  /**
   * 判断是否为图片文件
   */
  private isImage(ext: string): boolean {
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff'];
    return imageExts.includes(ext.toLowerCase());
  }

  /**
   * 压缩图片（使用 Electron nativeImage）
   */
  private async compressImage(buffer: Buffer): Promise<Buffer> {
    const image = nativeImage.createFromBuffer(buffer);

    if (image.isEmpty()) {
      throw new Error('Failed to create image from buffer');
    }

    const size = image.getSize();

    // 如果宽度超过最大值，则缩小
    if (size.width > this.compression.maxWidth) {
      const scale = this.compression.maxWidth / size.width;
      const newWidth = Math.round(size.width * scale);
      const newHeight = Math.round(size.height * scale);
      const resized = image.resize({ width: newWidth, height: newHeight });
      // 转换为 JPEG 格式（nativeImage 不支持 WebP 输出）
      return resized.toJPEG(this.compression.quality);
    }

    // 不需要缩放，直接转 JPEG
    return image.toJPEG(this.compression.quality);
  }
}
