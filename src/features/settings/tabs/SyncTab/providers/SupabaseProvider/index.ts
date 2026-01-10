/**
 * Supabase Provider占位
 */

import type { SyncProvider } from '../types';
import ComingSoon from '../../components/ComingSoon';

export const SupabaseProvider: SyncProvider = {
  id: 'supabase',
  name: 'Supabase + PowerSync',
  icon: '☁️',
  description: '云端同步，支持离线优先（即将推出）',
  status: 'upcoming',
  enabled: false, // 暂时禁用

  ConfigComponent: ComingSoon,

  capabilities: {
    autoSync: true,
    conflictResolution: true,
    bidirectional: true,
  },
};
