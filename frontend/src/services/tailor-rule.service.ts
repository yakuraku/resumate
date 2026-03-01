import { apiClient } from '@/lib/axios';
import { TailorRule, TailorRuleCreate, TailorRuleUpdate } from '@/types/tailor-rule';

export const TailorRuleService = {
    getAll: async (applicationId?: string): Promise<TailorRule[]> => {
        const params = applicationId ? { application_id: applicationId } : {};
        const response = await apiClient.get<TailorRule[]>('/tailor-rules', { params });
        return response.data;
    },

    create: async (data: TailorRuleCreate): Promise<TailorRule> => {
        const response = await apiClient.post<TailorRule>('/tailor-rules', data);
        return response.data;
    },

    update: async (id: string, data: TailorRuleUpdate): Promise<TailorRule> => {
        const response = await apiClient.patch<TailorRule>(`/tailor-rules/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/tailor-rules/${id}`);
    },
};
