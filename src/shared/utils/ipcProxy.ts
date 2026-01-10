export interface IpcInvoker {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
}

/**
 * 创建 IPC Proxy
 * 将方法调用转换为 prefix:method 的 IPC invoke 调用
 * 支持 overrides 覆盖特定方法
 */
export function createProxy<T extends object>(
  invoker: IpcInvoker,
  prefix: string,
  overrides: Record<string, unknown> = {},
): T {
  return new Proxy(overrides, {
    get: (target, prop) => {
      if (prop in target) {
        return target[prop as keyof typeof target];
      }
      if (typeof prop === 'string') {
        return (...args: unknown[]) => invoker.invoke(`${prefix}:${prop}`, ...args);
      }
      return undefined;
    },
  }) as T;
}
