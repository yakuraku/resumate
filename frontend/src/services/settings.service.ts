import { apiClient } from '@/lib/axios';

export interface AppSettings {
  llm_provider: string;
  llm_api_key: string;
  llm_api_key_openai: string;
  llm_api_key_openrouter: string;
  llm_api_key_gemini: string;
  llm_model: string;
  theme: string;
  default_master_resume_path: string;
  autosave_enabled: boolean;
  tailor_mode?: string;
  bg_animation_enabled: boolean;
  bg_animation_type: string;
  ghost_auto_enabled: boolean;
  ghost_applied_days: number;
  ghost_screening_days: number;
  ghost_interviewing_days: number;
  save_pdf_folder_enabled: boolean;
  save_pdf_folder_path: string;
  preferred_name: string;
}

export interface SettingsUpdate {
  llm_provider?: string;
  llm_api_key?: string;
  llm_api_key_openai?: string;
  llm_api_key_openrouter?: string;
  llm_api_key_gemini?: string;
  llm_model?: string;
  theme?: string;
  default_master_resume_path?: string;
  autosave_enabled?: boolean;
  tailor_mode?: string;
  bg_animation_enabled?: boolean;
  bg_animation_type?: string;
  ghost_auto_enabled?: boolean;
  ghost_applied_days?: number;
  ghost_screening_days?: number;
  ghost_interviewing_days?: number;
  save_pdf_folder_enabled?: boolean;
  save_pdf_folder_path?: string;
  preferred_name?: string;
}

export interface PromptInfo {
  key: string;
  default: string;
  custom: string | null;
  active: string;
}

export interface PromptsData {
  prompts: Record<string, PromptInfo>;
}

export const SettingsService = {
  get: async (): Promise<AppSettings> => {
    const response = await apiClient.get<AppSettings>('/settings');
    return response.data;
  },

  update: async (data: SettingsUpdate): Promise<AppSettings> => {
    const response = await apiClient.put<AppSettings>('/settings', data);
    return response.data;
  },

  getPrompts: async (): Promise<PromptsData> => {
    const response = await apiClient.get<PromptsData>('/settings/prompts');
    return response.data;
  },

  updatePrompt: async (key: string, value: string): Promise<void> => {
    await apiClient.put(`/settings/prompts/${key}`, { value });
  },

  resetPrompt: async (key: string): Promise<void> => {
    await apiClient.delete(`/settings/prompts/${key}`);
  },

  testLlm: async (provider: string, api_key: string, model: string): Promise<{ success: boolean; message: string; response_time_ms: number }> => {
    const response = await apiClient.post('/settings/test-llm', { provider, api_key, model });
    return response.data;
  },
};
