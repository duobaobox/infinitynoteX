import type { IpcProxyMethod, IpcProxyNamespace } from '../types/ipc';
import { getIpcProxyChannel } from '../types/ipc';

export interface IpcInvoker {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
}

/**
 * 创建 IPC Proxy
 * 将方法调用转换为 prefix:method 的 IPC invoke 调用
 * 支持 overrides 覆盖特定方法
 *
 * 注意：不能使用 JavaScript Proxy，因为 Electron contextBridge 不支持 Proxy 对象
 * 必须显式传入方法名列表来生成普通对象
 */
export function createProxy<T extends object, N extends IpcProxyNamespace>(
  invoker: IpcInvoker,
  prefix: N,
  methods: readonly IpcProxyMethod<N>[],
  overrides: Record<string, unknown> = {},
): T {
  const obj = { ...overrides } as Record<string, unknown>;
  for (const method of methods) {
    if (!(method in obj)) {
      obj[method] = (...args: unknown[]) =>
        invoker.invoke(getIpcProxyChannel(prefix, method), ...args);
    }
  }
  return obj as T;
}
