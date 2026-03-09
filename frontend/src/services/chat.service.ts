import { apiClient } from '@/lib/axios';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatConversationSummary {
  id: string;
  module: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  preview: string;
}

export interface ChatConversationFull {
  id: string;
  module: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

class ChatService {
  async getConversations(applicationId: string, module?: string): Promise<ChatConversationSummary[]> {
    const params: Record<string, string> = { application_id: applicationId };
    if (module) params.module = module;
    const { data } = await apiClient.get('/chat', { params });
    return data;
  }

  async createConversation(applicationId: string, module: string): Promise<ChatConversationFull> {
    const { data } = await apiClient.post('/chat', { application_id: applicationId, module });
    return data;
  }

  async getConversation(chatId: string): Promise<ChatConversationFull> {
    const { data } = await apiClient.get(`/chat/${chatId}`);
    return data;
  }

  async deleteConversation(chatId: string): Promise<void> {
    await apiClient.delete(`/chat/${chatId}`);
  }

  async sendMessage(chatId: string, content: string): Promise<ChatMessage> {
    const { data } = await apiClient.post(`/chat/${chatId}/message`, { content });
    return data;
  }

  async streamMessage(
    chatId: string,
    content: string,
    callbacks: {
      onDelta: (chunk: string) => void;
      onDone: () => void;
      onError: (message: string) => void;
    },
    signal?: AbortSignal,
  ): Promise<void> {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8921/api/v1';
    const response = await fetch(`${apiBase}/chat/${chatId}/message/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let doneReceived = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(part.slice(6));
            if (event.type === 'delta' && event.content) {
              callbacks.onDelta(event.content);
            } else if (event.type === 'done') {
              doneReceived = true;
              callbacks.onDone();
            } else if (event.type === 'error') {
              callbacks.onError(event.message || 'Unknown error');
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
      // Stream ended without a "done" event (e.g. server closed connection early)
      if (!doneReceived) {
        callbacks.onError('Stream ended unexpectedly');
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export const chatService = new ChatService();
