import type {
  NoteSyncPayload,
  RendererIpcEventChannel,
  RendererIpcEventPayloadMap,
} from '../types/ipc';

type RendererIpcListener<C extends RendererIpcEventChannel> = (
  event: unknown,
  ...args: RendererIpcEventPayloadMap[C]
) => void;

const rendererSourceId = (() => {
  try {
    return crypto.randomUUID();
  } catch {
    return `renderer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
})();

let noteRevision = 0;

interface NoteSyncPayloadOptions {
  taskChanged?: boolean;
}

/**
 * 当前渲染进程唯一来源 ID（用于跨窗口同步去重）
 */
export function getRendererIpcSourceId(): string {
  return rendererSourceId;
}

/**
 * 创建便签同步载荷（带来源和递增版本）
 */
export function createNoteSyncPayload(
  noteId: string,
  options?: NoteSyncPayloadOptions,
): NoteSyncPayload {
  noteRevision += 1;
  const { taskChanged = true } = options || {};
  return {
    noteId,
    sourceId: rendererSourceId,
    revision: noteRevision,
    taskChanged,
  };
}

/**
 * 订阅渲染进程 IPC 事件，返回取消订阅函数
 */
export function onRendererIpc<C extends RendererIpcEventChannel>(
  channel: C,
  listener: RendererIpcListener<C>,
): () => void {
  window.ipcRenderer?.on(channel, listener as (...args: unknown[]) => void);
  return () => {
    window.ipcRenderer?.off(channel, listener as (...args: unknown[]) => void);
  };
}

/**
 * 发送渲染进程 IPC 事件
 */
export function sendRendererIpc<C extends RendererIpcEventChannel>(
  channel: C,
  ...args: RendererIpcEventPayloadMap[C]
): void {
  window.ipcRenderer?.send(channel, ...args);
}
