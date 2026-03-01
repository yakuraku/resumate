import { apiClient } from '@/lib/axios';

export interface ApplicationQuestion {
  id: string;
  application_id: string;
  question_text: string;
  answer_text: string | null;
  is_ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuestionCreate {
  application_id: string;
  question_text: string;
  answer_text?: string;
}

export interface QuestionUpdate {
  question_text?: string;
  answer_text?: string;
}

export const QuestionsService = {
  getByApplication: async (applicationId: string): Promise<ApplicationQuestion[]> => {
    const response = await apiClient.get<ApplicationQuestion[]>('/questions', {
      params: { application_id: applicationId },
    });
    return response.data;
  },

  create: async (data: QuestionCreate): Promise<ApplicationQuestion> => {
    const response = await apiClient.post<ApplicationQuestion>('/questions', data);
    return response.data;
  },

  update: async (id: string, data: QuestionUpdate): Promise<ApplicationQuestion> => {
    const response = await apiClient.put<ApplicationQuestion>(`/questions/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/questions/${id}`);
  },

  generateAnswer: async (questionId: string): Promise<ApplicationQuestion> => {
    const response = await apiClient.post<ApplicationQuestion>(`/questions/${questionId}/generate`);
    return response.data;
  },

  refineAnswer: async (questionId: string, instruction: string): Promise<ApplicationQuestion> => {
    const response = await apiClient.post<ApplicationQuestion>(`/questions/${questionId}/refine`, { instruction });
    return response.data;
  },
};
