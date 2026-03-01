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
}

export const chatService = new ChatService();
