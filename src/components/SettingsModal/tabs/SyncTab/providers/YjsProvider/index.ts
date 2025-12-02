/**
 * Yjs CRDT Provider占位
 */

import type { SyncProvider } from '../types';
import ComingSoon from '../../components/ComingSoon';

export const YjsProvider: SyncProvider = {
  id: 'yjs',
  name: 'Yjs (CRDT)',
  icon: '🔗',
  description: 'P2P本地优先同步（即将推出）',
  status: 'upcoming',
  enabled: false, // 暂时禁用

  ConfigComponent: ComingSoon,

  capabilities: {
    autoSync: true,
    conflictResolution: true,
    bidirectional: true,
  },
};
