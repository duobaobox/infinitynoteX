/**
 * AI IPC Handlers
 * AI 相关 IPC 处理器 - 从 main.ts 抽离
 */

import { ipcMain } from 'electron';
import type { AIConfig, ChatPayload } from '../../src/services/aiConfig';
import { IPC_CHANNELS, getIpcProxyChannel } from '../../src/shared/types/ipc';
import type { IpcProxyMethod } from '../../src/shared/types/ipc';
import { readAIConfig, writeAIConfig, createAdapter } from '../ai';

const aiChannel = (method: IpcProxyMethod<'ai'>) => getIpcProxyChannel('ai', method);

// 流式请求中止控制器
const aiStreamAbortControllers = new Map<number, AbortController>();

/**
 * 注册 AI 相关 IPC 处理器
 */
export function registerAIHandlers(): void {
  ipcMain.handle(aiChannel('getConfig'), async () => {
    const config = await readAIConfig();
    return config;
  });

  ipcMain.handle(aiChannel('setConfig'), async (_, config: AIConfig) => {
    await writeAIConfig(config);
  });

  ipcMain.handle(aiChannel('testConnection'), async () => {
    try {
      const config = await readAIConfig();
      if (!config) {
        return { ok: false, message: '未找到 AI 配置，请先设置' };
      }
      const adapter = createAdapter(config);
      return await adapter.testConnection();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `连接测试失败：${msg}` };
    }
  });

  ipcMain.handle(aiChannel('chat'), async (_, payload: ChatPayload) => {
    try {
      const config = await readAIConfig();
      if (!config) {
        throw new Error('未找到 AI 配置，请先在设置中配置 AI');
      }
      const adapter = createAdapter(config);
      const response = await adapter.chat(payload);
      return { success: true, content: response.content };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle(aiChannel('chatStream'), async (event, payload: ChatPayload) => {
    try {
      const config = await readAIConfig();
      if (!config) {
        throw new Error('未找到 AI 配置，请先在设置中配置 AI');
      }
      const adapter = createAdapter(config);

      const wcId = event.sender.id;
      const previous = aiStreamAbortControllers.get(wcId);
      if (previous) {
        previous.abort();
        aiStreamAbortControllers.delete(wcId);
      }
      const abortController = new AbortController();
      aiStreamAbortControllers.set(wcId, abortController);

      (async () => {
        try {
          for await (const chunk of adapter.chatStream(payload, {
            signal: abortController.signal,
          })) {
            event.sender.send(IPC_CHANNELS.aiStreamChunk, chunk);
          }
          event.sender.send(IPC_CHANNELS.aiStreamDone, { success: true });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          event.sender.send(IPC_CHANNELS.aiStreamError, { error: msg });
        } finally {
          const current = aiStreamAbortControllers.get(wcId);
          if (current === abortController) {
            aiStreamAbortControllers.delete(wcId);
          }
        }
      })();

      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle(aiChannel('abortStream'), (event) => {
    const wcId = event.sender.id;
    const controller = aiStreamAbortControllers.get(wcId);
    if (!controller) {
      return { success: false, error: 'no in-flight stream' };
    }
    controller.abort();
    aiStreamAbortControllers.delete(wcId);
    return { success: true };
  });
}
