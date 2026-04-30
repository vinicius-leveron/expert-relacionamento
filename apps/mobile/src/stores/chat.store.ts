import { create } from 'zustand';
import { api } from '@/api/client';
import * as FileSystem from 'expo-file-system';

export type AttachmentStatus =
  | 'pending_upload'
  | 'uploaded'
  | 'processing'
  | 'ready'
  | 'failed';

export interface ChatAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: AttachmentStatus;
  createdAt?: string;
  updatedAt?: string;
  progress?: number;
  localUri?: string;
  errorMessage?: string;
}

export type MessageClientState = 'sending' | 'failed';

export type MessageRetryPayload =
  | {
      type: 'text';
      content: string;
      attachmentIds: string[];
    }
  | {
      type: 'image';
      image: LocalImageInput;
    }
  | {
      type: 'audio';
      audio: LocalAudioInput;
    };

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  contentType?: 'text' | 'image' | 'audio';
  image?: {
    url: string;
    mimeType?: string;
  };
  audio?: {
    url: string;
    mimeType?: string;
    durationMs?: number;
  };
  createdAt: string;
  attachments?: ChatAttachment[];
  clientState?: MessageClientState;
  errorMessage?: string;
  retryPayload?: MessageRetryPayload;
}

export interface LocalAttachmentInput {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface LocalImageInput {
  uri: string;
  base64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  caption?: string;
}

export interface LocalAudioInput {
  uri: string;
  mimeType:
    | 'audio/mp4'
    | 'audio/mpeg'
    | 'audio/wav'
    | 'audio/x-wav'
    | 'audio/webm'
    | 'audio/ogg'
    | 'audio/aac';
  durationMs?: number;
  caption?: string;
}

interface ChatState {
  messages: Message[];
  pendingAttachments: ChatAttachment[];
  conversationId: string | null;
  isLoading: boolean;
  isUploadingAttachment: boolean;
  isConnected: boolean;
  eventSource: EventSource | null;

  sendMessage: (content: string) => Promise<void>;
  sendImageMessage: (image: LocalImageInput) => Promise<void>;
  sendAudioMessage: (audio: LocalAudioInput) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  uploadAttachment: (file: LocalAttachmentInput) => Promise<void>;
  retryAttachment: (attachmentId: string) => Promise<void>;
  removePendingAttachment: (attachmentId: string) => Promise<void>;
  loadMessages: () => Promise<void>;
  loadAttachments: () => Promise<void>;
  connectSSE: (accessToken: string) => void;
  disconnectSSE: () => void;
  addMessage: (message: Message) => void;
}

interface ConversationResponse {
  success: boolean;
  data: { id: string };
}

interface ServerAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: AttachmentStatus;
  createdAt?: string;
  updatedAt?: string;
}

interface MessagesResponse {
  success: boolean;
  data: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    contentType?: 'text' | 'image' | 'audio';
    image?: {
      url: string;
      mimeType?: string;
    } | null;
    audio?: {
      url: string;
      mimeType?: string;
      durationMs?: number;
    } | null;
    createdAt: string;
    attachments?: ServerAttachment[];
  }>;
}

interface AttachmentsResponse {
  success: boolean;
  data: ServerAttachment[];
}

interface CreateAttachmentUploadResponse {
  success: boolean;
  data: {
    attachment: ServerAttachment;
    upload: {
      signedUrl: string;
      token: string;
      path: string;
    };
  };
}

interface MutationResponse {
  success: boolean;
  data?: unknown;
  error?: {
    code?: string;
    message?: string;
  };
}

const POLL_INTERVAL_MS = 2500;

function mapServerAttachment(attachment: ServerAttachment): ChatAttachment {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    status: attachment.status,
    createdAt: attachment.createdAt,
    updatedAt: attachment.updatedAt,
  };
}

function hasActiveAttachmentWork(
  messages: Message[],
  pendingAttachments: ChatAttachment[],
): boolean {
  if (
    pendingAttachments.some(
      (attachment) =>
        attachment.status === 'pending_upload' ||
        attachment.status === 'uploaded' ||
        attachment.status === 'processing',
    )
  ) {
    return true;
  }

  return messages.some((message) =>
    (message.attachments ?? []).some(
      (attachment) =>
        attachment.status === 'pending_upload' ||
        attachment.status === 'uploaded' ||
        attachment.status === 'processing',
    ),
  );
}

function getRequestErrorMessage(
  response: { status: number; data: MutationResponse },
  fallbackMessage: string,
): string {
  if (response.data?.success === false && response.data.error?.message) {
    return response.data.error.message;
  }

  if (response.status >= 400) {
    return fallbackMessage;
  }

  return '';
}

function mergeServerMessages(
  currentMessages: Message[],
  serverMessages: Message[],
): Message[] {
  const failedLocalMessages = currentMessages.filter(
    (message) => message.clientState === 'failed',
  );

  if (failedLocalMessages.length === 0) {
    return serverMessages;
  }

  return [...serverMessages, ...failedLocalMessages].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

async function ensureConversationId(
  conversationId: string | null,
  setConversationId: (conversationId: string) => void,
): Promise<string> {
  if (conversationId) {
    return conversationId;
  }

  const createResponse = await api.post<ConversationResponse>('/conversations');
  if (!createResponse.data.success) {
    throw new Error('Failed to create conversation');
  }

  const nextConversationId = createResponse.data.data.id;
  setConversationId(nextConversationId);
  return nextConversationId;
}

async function uploadFileToSignedUrl(params: {
  uri: string;
  mimeType: string;
  signedUrl: string;
}): Promise<void> {
  const fileResponse = await fetch(params.uri);
  if (!fileResponse.ok) {
    throw new Error('Failed to read attachment file');
  }

  const fileBlob = await fileResponse.blob();
  const uploadResponse = await fetch(params.signedUrl, {
    method: 'PUT',
    headers: {
      'content-type': params.mimeType,
    },
    body: fileBlob,
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload attachment');
  }
}

async function readFileAsBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  pendingAttachments: [],
  conversationId: null,
  isLoading: false,
  isUploadingAttachment: false,
  isConnected: false,
  eventSource: null,

  sendMessage: async (content: string) => {
    const trimmedContent = content.trim();
    const pendingAttachments = get().pendingAttachments.filter(
      (attachment) => attachment.status !== 'failed',
    );

    if (!trimmedContent && pendingAttachments.length === 0) {
      return;
    }

    const optimisticMessageId = `temp-${Date.now()}`;
    const optimisticUserMessage: Message = {
      id: optimisticMessageId,
      role: 'user',
      content: trimmedContent,
      contentType: 'text',
      createdAt: new Date().toISOString(),
      attachments: pendingAttachments.map((attachment) => ({
        ...attachment,
      })),
      clientState: 'sending',
      retryPayload: {
        type: 'text',
        content: trimmedContent,
        attachmentIds: pendingAttachments.map((attachment) => attachment.id),
      },
    };

    set((state) => ({
      messages: [...state.messages, optimisticUserMessage],
      pendingAttachments: state.pendingAttachments.filter(
        (attachment) =>
          !pendingAttachments.some((pending) => pending.id === attachment.id),
      ),
      isLoading: true,
    }));

    try {
      const conversationId = await ensureConversationId(get().conversationId, (nextConversationId) => {
        set({ conversationId: nextConversationId });
      });

      const response = await api.post<MutationResponse>(`/conversations/${conversationId}/messages`, {
        content: trimmedContent || undefined,
        attachmentIds: pendingAttachments.map((attachment) => attachment.id),
      });
      const errorMessage = getRequestErrorMessage(
        response,
        'Não foi possível enviar a mensagem.',
      );

      if (errorMessage) {
        throw new Error(errorMessage);
      }
    } catch (error) {
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === optimisticMessageId
            ? {
                ...message,
                clientState: 'failed',
                errorMessage:
                  error instanceof Error
                    ? error.message
                    : 'Não foi possível enviar a mensagem.',
              }
            : message,
        ),
        isLoading: false,
      }));
      throw error;
    }
  },

  sendImageMessage: async (image: LocalImageInput) => {
    const caption = image.caption?.trim();
    const optimisticMessageId = `temp-image-${Date.now()}`;
    const optimisticUserMessage: Message = {
      id: optimisticMessageId,
      role: 'user',
      content: caption && caption.length > 0 ? caption : '[Imagem enviada para análise]',
      contentType: 'image',
      image: {
        url: image.uri,
        mimeType: image.mediaType,
      },
      createdAt: new Date().toISOString(),
      clientState: 'sending',
      retryPayload: {
        type: 'image',
        image,
      },
    };

    set((state) => ({
      messages: [...state.messages, optimisticUserMessage],
      isLoading: true,
    }));

    try {
      const conversationId = await ensureConversationId(
        get().conversationId,
        (nextConversationId) => {
          set({ conversationId: nextConversationId });
        },
      );

      const response = await api.post<MutationResponse>(`/conversations/${conversationId}/messages`, {
        content: caption || undefined,
        image: {
          data: image.base64,
          mediaType: image.mediaType,
        },
      });
      const errorMessage = getRequestErrorMessage(
        response,
        'Não foi possível enviar a imagem.',
      );

      if (errorMessage) {
        throw new Error(errorMessage);
      }
    } catch (error) {
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === optimisticMessageId
            ? {
                ...message,
                clientState: 'failed',
                errorMessage:
                  error instanceof Error
                    ? error.message
                    : 'Não foi possível enviar a imagem.',
              }
            : message,
        ),
        isLoading: false,
      }));
      throw error;
    }
  },

  sendAudioMessage: async (audio: LocalAudioInput) => {
    const caption = audio.caption?.trim();
    const optimisticMessageId = `temp-audio-${Date.now()}`;
    const optimisticUserMessage: Message = {
      id: optimisticMessageId,
      role: 'user',
      content:
        caption && caption.length > 0
          ? caption
          : '[Áudio enviado para transcrição]',
      contentType: 'audio',
      audio: {
        url: audio.uri,
        mimeType: audio.mimeType,
        durationMs: audio.durationMs,
      },
      createdAt: new Date().toISOString(),
      clientState: 'sending',
      retryPayload: {
        type: 'audio',
        audio,
      },
    };

    set((state) => ({
      messages: [...state.messages, optimisticUserMessage],
      isLoading: true,
    }));

    try {
      const conversationId = await ensureConversationId(
        get().conversationId,
        (nextConversationId) => {
          set({ conversationId: nextConversationId });
        },
      );

      const base64 = await readFileAsBase64(audio.uri);
      const response = await api.post<MutationResponse>(
        `/conversations/${conversationId}/messages`,
        {
          content: caption || undefined,
          audio: {
            data: base64,
            mediaType: audio.mimeType,
            durationMs: audio.durationMs,
          },
        },
      );
      const errorMessage = getRequestErrorMessage(
        response,
        'Não foi possível enviar o áudio.',
      );

      if (errorMessage) {
        throw new Error(errorMessage);
      }
    } catch (error) {
      set((state) => ({
        messages: state.messages.map((message) =>
          message.id === optimisticMessageId
            ? {
                ...message,
                clientState: 'failed',
                errorMessage:
                  error instanceof Error
                    ? error.message
                    : 'Não foi possível enviar o áudio.',
              }
            : message,
        ),
        isLoading: false,
      }));
      throw error;
    }
  },

  retryMessage: async (messageId: string) => {
    const message = get().messages.find((item) => item.id === messageId);
    if (!message?.retryPayload) {
      return;
    }

    set((state) => ({
      messages: state.messages.map((item) =>
        item.id === messageId
          ? {
              ...item,
              clientState: 'sending',
              errorMessage: undefined,
            }
          : item,
      ),
      isLoading: true,
    }));

    try {
      const conversationId = await ensureConversationId(
        get().conversationId,
        (nextConversationId) => {
          set({ conversationId: nextConversationId });
        },
      );

      if (message.retryPayload.type === 'text') {
        const response = await api.post<MutationResponse>(
          `/conversations/${conversationId}/messages`,
          {
            content: message.retryPayload.content || undefined,
            attachmentIds:
              message.retryPayload.attachmentIds.length > 0
                ? message.retryPayload.attachmentIds
                : undefined,
          },
        );
        const errorMessage = getRequestErrorMessage(
          response,
          'Não foi possível reenviar a mensagem.',
        );

        if (errorMessage) {
          throw new Error(errorMessage);
        }

        return;
      }

      if (message.retryPayload.type === 'image') {
        const response = await api.post<MutationResponse>(
          `/conversations/${conversationId}/messages`,
          {
            content: message.retryPayload.image.caption?.trim() || undefined,
            image: {
              data: message.retryPayload.image.base64,
              mediaType: message.retryPayload.image.mediaType,
            },
          },
        );
        const errorMessage = getRequestErrorMessage(
          response,
          'Não foi possível reenviar a imagem.',
        );

        if (errorMessage) {
          throw new Error(errorMessage);
        }

        return;
      }

      const base64 = await readFileAsBase64(message.retryPayload.audio.uri);
      const response = await api.post<MutationResponse>(
        `/conversations/${conversationId}/messages`,
        {
          content: message.retryPayload.audio.caption?.trim() || undefined,
          audio: {
            data: base64,
            mediaType: message.retryPayload.audio.mimeType,
            durationMs: message.retryPayload.audio.durationMs,
          },
        },
      );
      const errorMessage = getRequestErrorMessage(
        response,
        'Não foi possível reenviar o áudio.',
      );

      if (errorMessage) {
        throw new Error(errorMessage);
      }
    } catch (error) {
      set((state) => ({
        messages: state.messages.map((item) =>
          item.id === messageId
            ? {
                ...item,
                clientState: 'failed',
                errorMessage:
                  error instanceof Error
                    ? error.message
                    : 'Não foi possível reenviar a mensagem.',
              }
            : item,
        ),
        isLoading: false,
      }));
      throw error;
    }
  },

  uploadAttachment: async (file: LocalAttachmentInput) => {
    set({ isUploadingAttachment: true });

    try {
      const conversationId = await ensureConversationId(get().conversationId, (nextConversationId) => {
        set({ conversationId: nextConversationId });
      });

      const createResponse = await api.post<CreateAttachmentUploadResponse>(
        `/conversations/${conversationId}/attachments`,
        {
          fileName: file.name,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
        },
      );

      if (!createResponse.data.success) {
        throw new Error('Failed to create attachment upload');
      }

      const optimisticAttachment: ChatAttachment = {
        ...mapServerAttachment(createResponse.data.data.attachment),
        localUri: file.uri,
        progress: 10,
      };

      set((state) => ({
        pendingAttachments: [...state.pendingAttachments, optimisticAttachment],
      }));

      set((state) => ({
        pendingAttachments: state.pendingAttachments.map((attachment) =>
          attachment.id === optimisticAttachment.id
            ? { ...attachment, progress: 40 }
            : attachment,
        ),
      }));

      await uploadFileToSignedUrl({
        uri: file.uri,
        mimeType: file.mimeType,
        signedUrl: createResponse.data.data.upload.signedUrl,
      });

      set((state) => ({
        pendingAttachments: state.pendingAttachments.map((attachment) =>
          attachment.id === optimisticAttachment.id
            ? { ...attachment, progress: 90 }
            : attachment,
        ),
      }));

      const completeResponse = await api.post<MutationResponse>(
        `/attachments/${optimisticAttachment.id}/complete`,
      );
      const completeErrorMessage = getRequestErrorMessage(
        completeResponse,
        'Failed to finalize attachment upload',
      );

      if (completeErrorMessage) {
        throw new Error(completeErrorMessage);
      }

      await get().loadAttachments();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to upload attachment';

      set((state) => ({
        pendingAttachments: state.pendingAttachments.map((attachment) =>
          attachment.localUri === file.uri
            ? {
                ...attachment,
                status: 'failed',
                progress: undefined,
                errorMessage: message,
              }
            : attachment,
        ),
      }));

      throw error;
    } finally {
      set({ isUploadingAttachment: false });
    }
  },

  retryAttachment: async (attachmentId: string) => {
    const attachment = get().pendingAttachments.find(
      (item) => item.id === attachmentId,
    );

    if (
      !attachment ||
      attachment.status !== 'failed' ||
      !attachment.localUri
    ) {
      return;
    }

    set((state) => ({
      pendingAttachments: state.pendingAttachments.filter(
        (item) => item.id !== attachmentId,
      ),
    }));

    try {
      await get().uploadAttachment({
        uri: attachment.localUri,
        name: attachment.fileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
      });
    } catch (error) {
      const hasReplacementAttachment = get().pendingAttachments.some(
        (item) => item.localUri === attachment.localUri,
      );

      if (!hasReplacementAttachment) {
        set((state) => ({
          pendingAttachments: [...state.pendingAttachments, attachment],
        }));
      }

      throw error;
    }
  },

  removePendingAttachment: async (attachmentId: string) => {
    const { conversationId } = get();
    const attachment = get().pendingAttachments.find((item) => item.id === attachmentId);

    set((state) => ({
      pendingAttachments: state.pendingAttachments.filter((item) => item.id !== attachmentId),
    }));

    if (!conversationId || !attachment) {
      return;
    }

    try {
      await api.delete(`/attachments/${attachmentId}`);
    } catch (error) {
      set((state) => ({
        pendingAttachments: [...state.pendingAttachments, attachment],
      }));
      throw error;
    }
  },

  loadMessages: async () => {
    const { conversationId } = get();
    if (!conversationId) return;

    try {
      const response = await api.get<MessagesResponse>(
        `/conversations/${conversationId}/messages`,
      );

      if (!response.data.success) {
        return;
      }

      const messages = response.data.data.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        contentType: message.contentType,
        image: message.image ?? undefined,
        audio: message.audio ?? undefined,
        createdAt: message.createdAt,
        attachments: (message.attachments ?? []).map(mapServerAttachment),
      }));

      set((state) => ({
        messages: mergeServerMessages(state.messages, messages),
        isLoading:
          messages[messages.length - 1]?.role === 'assistant'
            ? false
            : state.isLoading,
      }));
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  },

  loadAttachments: async () => {
    const { conversationId, pendingAttachments } = get();
    if (!conversationId || pendingAttachments.length === 0) return;

    try {
      const response = await api.get<AttachmentsResponse>(
        `/conversations/${conversationId}/attachments`,
      );

      if (!response.data.success) {
        return;
      }

      const attachmentMap = new Map(
        response.data.data.map((attachment) => [attachment.id, attachment]),
      );

      set((state) => ({
        pendingAttachments: state.pendingAttachments.map((attachment) => {
          const serverAttachment = attachmentMap.get(attachment.id);
          if (!serverAttachment) {
            return attachment;
          }

          return {
            ...attachment,
            ...mapServerAttachment(serverAttachment),
            localUri: attachment.localUri,
            progress:
              serverAttachment.status === 'ready'
                ? 100
                : attachment.progress,
          };
        }),
      }));
    } catch (error) {
      console.error('Failed to load attachments:', error);
    }
  },

  connectSSE: (_accessToken: string) => {
    const { eventSource: existing } = get();
    if (existing) {
      existing.close();
    }

    const pollInterval = setInterval(async () => {
      const { conversationId, isLoading, messages, pendingAttachments } = get();
      if (!conversationId) return;

      if (!isLoading && !hasActiveAttachmentWork(messages, pendingAttachments)) {
        return;
      }

      await Promise.all([get().loadMessages(), get().loadAttachments()]);
    }, POLL_INTERVAL_MS);

    set({
      isConnected: true,
      eventSource: { close: () => clearInterval(pollInterval) } as EventSource,
    });
  },

  disconnectSSE: () => {
    const { eventSource } = get();
    if (eventSource) {
      eventSource.close();
    }
    set({ isConnected: false, eventSource: null });
  },

  addMessage: (message: Message) => {
    set((state) => ({
      messages: [...state.messages, message],
      isLoading: false,
    }));
  },
}));
