import { AbstractXRequestClass } from '@ant-design/x-sdk';

import type { ChatPayload } from '../../../services/aiConfig';
import type { StreamChunkData } from '../types';
import type { IpcStreamInput } from './IpcChatProvider';

function createAbortError(message = 'Request aborted'): Error {
  // DOMException is available in browser contexts; fall back to Error.
  try {
    return new DOMException(message, 'AbortError');
  } catch {
    const err = new Error(message) as Error & { name: string };
    err.name = 'AbortError';
    return err;
  }
}

export class IpcStreamXRequest extends AbstractXRequestClass<IpcStreamInput, StreamChunkData> {
  private _asyncHandler: Promise<void> | null = null;
  private _isRequesting = false;
  private _aborted = false;

  private unsubscribeChunk: (() => void) | null = null;
  private unsubscribeDone: (() => void) | null = null;
  private unsubscribeError: (() => void) | null = null;

  private chunks: StreamChunkData[] = [];

  get asyncHandler(): Promise<unknown> {
    return this._asyncHandler ?? Promise.resolve();
  }

  get isTimeout(): boolean {
    return false;
  }

  get isStreamTimeout(): boolean {
    return false;
  }

  get isRequesting(): boolean {
    return this._isRequesting;
  }

  get manual(): boolean {
    return true;
  }

  run(params?: IpcStreamInput): void {
    if (!params) {
      throw new Error('IpcStreamXRequest.run requires params');
    }

    // If there is an in-flight request, abort it first.
    if (this._isRequesting) {
      this.abort();
    }

    this._isRequesting = true;
    this._aborted = false;
    this.chunks = [];

    this._asyncHandler = this.start(params);
  }

  abort(): void {
    if (!this._isRequesting) return;

    this._aborted = true;
    this.cleanupListeners();
    this._isRequesting = false;

    // Best-effort: ask main process to abort.
    try {
      void window.ai?.abortStream?.();
    } catch {
      // ignore
    }

    const error = createAbortError();
    this.options.callbacks?.onError(error);
  }

  private cleanupListeners() {
    this.unsubscribeChunk?.();
    this.unsubscribeDone?.();
    this.unsubscribeError?.();
    this.unsubscribeChunk = null;
    this.unsubscribeDone = null;
    this.unsubscribeError = null;
  }

  private async start(params: IpcStreamInput): Promise<void> {
    const callbacks = this.options.callbacks;
    if (!callbacks) {
      throw new Error('IpcStreamXRequest requires options.callbacks');
    }

    if (!window.ai?.chatStream || !window.ai?.onStreamChunk) {
      this._isRequesting = false;
      callbacks.onError(new Error('AI IPC API is not available'));
      return;
    }

    const headers = new Headers();

    this.unsubscribeChunk = window.ai.onStreamChunk((chunk) => {
      if (!this._isRequesting || this._aborted) return;
      this.chunks.push(chunk);
      callbacks.onUpdate?.(chunk, headers);
    });

    this.unsubscribeDone = window.ai.onStreamDone(() => {
      if (!this._isRequesting || this._aborted) return;
      this.cleanupListeners();
      this._isRequesting = false;
      callbacks.onSuccess(this.chunks, headers);
    });

    this.unsubscribeError = window.ai.onStreamError((data) => {
      if (!this._isRequesting || this._aborted) return;
      this.cleanupListeners();
      this._isRequesting = false;
      callbacks.onError(new Error(data?.error || 'Stream error'));
    });

    try {
      const payload: ChatPayload = {
        message: params.message,
        messages: params.messages,
        ragContext: params.ragContext, // 传递 RAG 上下文到主进程
      };
      const result = await window.ai.chatStream(payload);
      if (!result?.success) {
        throw new Error(result?.error || 'Stream request failed');
      }
    } catch (err) {
      if (!this._aborted) {
        this.cleanupListeners();
        this._isRequesting = false;
        callbacks.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }
}
