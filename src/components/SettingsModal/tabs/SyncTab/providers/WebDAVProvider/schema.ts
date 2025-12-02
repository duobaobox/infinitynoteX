/**
 * WebDAV配置Schema
 */

import { z } from 'zod';

export const WebDAVConfigSchema = z.object({
  enabled: z.boolean().default(false),
  url: z.string().url('请输入有效的WebDAV服务器地址'),
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
  remotePath: z.string().default('/InfinityNoteX'),
  syncInterval: z.number().min(0).default(0), // 0 = 仅手动同步
  conflictStrategy: z.enum(['local', 'remote', 'ask']).default('ask'),
});

export type WebDAVConfig = z.infer<typeof WebDAVConfigSchema>;

// 默认配置
export const createDefaultWebDAVConfig = (): Partial<WebDAVConfig> => ({
  enabled: false,
  url: '',
  username: '',
  password: '',
  remotePath: '/InfinityNoteX',
  syncInterval: 0,
  conflictStrategy: 'ask',
});
