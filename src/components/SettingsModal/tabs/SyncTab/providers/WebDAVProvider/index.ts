/**
 * WebDAV Provider定义
 */

import type { SyncProvider } from '../types';
import WebDAVConfigComponent from './WebDAVConfig';
import { WebDAVConfigSchema, type WebDAVConfig } from './schema';

export const WebDAVProvider: SyncProvider<WebDAVConfig> = {
  id: 'webdav',
  name: 'WebDAV',
  icon: '🔄',
  description: '使用WebDAV协议同步到私有云或NAS',
  status: 'ready',
  enabled: true,

  ConfigComponent: WebDAVConfigComponent,
  configSchema: WebDAVConfigSchema,

  capabilities: {
    autoSync: true,
    conflictResolution: true,
    bidirectional: true,
  },

  syncHandler: 'sync:webdav',
};
