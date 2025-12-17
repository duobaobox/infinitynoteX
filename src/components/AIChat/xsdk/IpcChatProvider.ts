import { AbstractChatProvider } from '@ant-design/x-sdk';
import type { XRequestOptions } from '@ant-design/x-sdk';

import { IpcStreamXRequest } from './IpcStreamXRequest';
import type { ChatPayload, AIMessage } from '../../../services/aiConfig';
import type { NoteReference, StreamChunkData } from '../types';

export type XChatMessage = {
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
  references?: NoteReference[];
};

/**
 * x-sdk provider Input type.
 *
 * It must be the type passed to `provider.request.run(input)`.
 * We keep it compatible with the main-process `ChatPayload` while attaching UI-only metadata.
 */
export type IpcStreamInput = ChatPayload & {
  /** The user-visible text (may include note context that UI later strips). */
  text: string;
  /** Optional note references to show as FileCard for the user message. */
  references?: NoteReference[];
  /** Alias for legacy naming, if provided. */
  historyMessages?: AIMessage[];
};

function sanitizeReasoningDelta(delta: string): string {
  return delta.replace(/\n\n+/g, '\n');
}

function isThinkOpen(content: string): boolean {
  const openIndex = content.lastIndexOf('<think>');
  if (openIndex < 0) return false;
  const closeIndex = content.lastIndexOf('</think>');
  return closeIndex < openIndex;
}

function appendStreamDelta(originContent: string, chunk: StreamChunkData): string {
  let next = originContent;

  if (chunk.reasoningDelta) {
    const sanitized = sanitizeReasoningDelta(chunk.reasoningDelta);
    if (isThinkOpen(next)) {
      next += sanitized;
    } else {
      next += `<think>${sanitized}`;
    }
  }

  if (chunk.delta) {
    if (isThinkOpen(next)) {
      next += `</think>\n${chunk.delta}`;
    } else {
      next += chunk.delta;
    }
  }

  return next;
}

export class IpcChatProvider extends AbstractChatProvider<
  XChatMessage,
  IpcStreamInput,
  StreamChunkData
> {
  constructor() {
    super({
      // baseURL is unused for IPC requests; required by AbstractXRequestClass
      request: new IpcStreamXRequest('ipc://ai', {
        manual: true,
      }),
    });
  }

  transformParams(
    requestParams: Partial<IpcStreamInput>,
    options: XRequestOptions<IpcStreamInput, StreamChunkData>,
  ): IpcStreamInput {
    void options;
    const message = requestParams.message ?? '';
    const messages = requestParams.messages ?? requestParams.historyMessages ?? [];

    return {
      message,
      messages,
      text: requestParams.text ?? '',
      references: requestParams.references,
    };
  }

  transformLocalMessage(requestParams: Partial<IpcStreamInput>): XChatMessage {
    return {
      role: 'user',
      content: requestParams.text ?? requestParams.message ?? '',
      timestamp: Date.now(),
      references: requestParams.references,
    };
  }

  transformMessage(info: {
    originMessage?: XChatMessage;
    chunk: StreamChunkData;
    chunks: StreamChunkData[];
    status: string;
    responseHeaders: Headers;
  }): XChatMessage {
    const origin = info.originMessage;
    const base: XChatMessage = origin
      ? { ...origin }
      : {
          role: 'ai',
          content: '',
          timestamp: Date.now(),
        };

    // Ensure assistant role
    base.role = 'ai';

    // Streaming update
    if (info.chunk) {
      base.content = appendStreamDelta(base.content, info.chunk);
    }

    // On success, ensure think tag is closed if still open
    if (info.status === 'success' && isThinkOpen(base.content)) {
      base.content += '</think>';
    }

    return base;
  }
}
