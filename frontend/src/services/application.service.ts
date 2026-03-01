import { apiClient } from '@/lib/axios';
import {
  ApplicationCreate,
  ApplicationUpdate,
  ApplicationResponse,
  ApplicationListResponse
} from '@/types/application';

export interface JobKeyword {
  keyword: string;
  category: 'technical_skills' | 'soft_skills' | 'tools' | 'certifications' | 'experience_requirements';
  in_resume?: boolean;
}

export interface JobAnalysisResult {
  job_title?: string;
  company_name?: string;
  jd_summary?: string;
  experience_level?: string;
  keywords: JobKeyword[];
  overall_match_score: number;
  category_scores: {
    technical: number;
    soft_skills: number;
    tools: number;
    experience: number;
  };
  error?: string;
}

export const ApplicationService = {
  // Get all applications with pagination support
  getAll: async (page: number = 1, pageSize: number = 10): Promise<ApplicationListResponse> => {
    const response = await apiClient.get<ApplicationListResponse>(`/applications`, {
      params: { page, page_size: pageSize }
    });
    return response.data;
  },

  // Get a single application by ID
  getById: async (id: string): Promise<ApplicationResponse> => {
    const response = await apiClient.get<ApplicationResponse>(`/applications/${id}`);
    return response.data;
  },

  // Create a new application
  create: async (data: ApplicationCreate): Promise<ApplicationResponse> => {
    const response = await apiClient.post<ApplicationResponse>('/applications', data);
    return response.data;
  },

  // Update an existing application
  update: async (id: string, data: ApplicationUpdate): Promise<ApplicationResponse> => {
    const response = await apiClient.patch<ApplicationResponse>(`/applications/${id}`, data);
    return response.data;
  },

  // Delete an application
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/applications/${id}`);
  },

  // Analyze the job description for keywords and match score
  analyzeJob: async (id: string): Promise<JobAnalysisResult> => {
    const response = await apiClient.post<JobAnalysisResult>(`/applications/${id}/analyze_job`);
    return response.data;
  },

  // Update application status (PATCH /applications/{id}/status)
  updateStatus: async (id: string, status: string): Promise<ApplicationResponse> => {
    const response = await apiClient.patch<ApplicationResponse>(`/applications/${id}/status`, { status });
    return response.data;
  },

  // Update application resume template (PUT /applications/{id}/resume-template)
  updateResumeTemplate: async (id: string, resume_template_id: string): Promise<ApplicationResponse> => {
    const response = await apiClient.put<ApplicationResponse>(`/applications/${id}/resume-template`, { resume_template_id });
    return response.data;
  },
};
