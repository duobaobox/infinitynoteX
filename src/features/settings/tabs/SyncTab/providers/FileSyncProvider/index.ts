/**
 * 文件同步 Provider占位
 */

import type { SyncProvider } from '../types';
import ComingSoon from '../../components/ComingSoon';

export const FileSyncProvider: SyncProvider = {
  id: 'filesync',
  name: '文件同步',
  icon: '📁',
  description: 'iCloud/Dropbox文件夹同步（即将推出）',
  status: 'upcoming',
  enabled: false, // 暂时禁用

  ConfigComponent: ComingSoon,

  capabilities: {
    autoSync: true,
    conflictResolution: false,
    bidirectional: true,
  },
};
