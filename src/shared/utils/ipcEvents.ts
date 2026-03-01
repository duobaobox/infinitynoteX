import type { RendererIpcEventChannel, RendererIpcEventPayloadMap } from '../types/ipc';

type RendererIpcListener<C extends RendererIpcEventChannel> = (
  event: unknown,
  ...args: RendererIpcEventPayloadMap[C]
) => void;

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
