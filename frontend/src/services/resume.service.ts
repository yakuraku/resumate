
import { apiClient } from '@/lib/axios';
import { Resume, ResumeUpdate, ResumeVersion } from '@/types/resume';

export const ResumeService = {
    getAll: async (): Promise<Resume[]> => {
        const response = await apiClient.get<Resume[]>('/resumes');
        return response.data;
    },

    getById: async (id: string): Promise<Resume> => {
        const response = await apiClient.get<Resume>(`/resumes/${id}`);
        return response.data;
    },

    getByApplicationId: async (applicationId: string): Promise<Resume> => {
        const response = await apiClient.get<Resume>(`/applications/${applicationId}/resume`);
        return response.data;
    },

    create: async (applicationId: string, cloneFromId?: string): Promise<Resume> => {
        const response = await apiClient.post<Resume>(`/applications/${applicationId}/resume`, { clone_from_id: cloneFromId });
        return response.data;
    },

    /** Auto-save: updates yaml_content of Resume + active version in-place. No new version. */
    updateYaml: async (id: string, yamlContent: string, changeSummary?: string): Promise<Resume> => {
        const response = await apiClient.put<Resume>(`/resumes/${id}/yaml`, {
            yaml_content: yamlContent,
            change_summary: changeSummary
        });
        return response.data;
    },

    /** Update a specific version's yaml_content in-place (active version only). */
    updateVersionContent: async (resumeId: string, versionId: string, yamlContent: string): Promise<Resume> => {
        const response = await apiClient.put<Resume>(`/resumes/${resumeId}/versions/${versionId}/content`, {
            yaml_content: yamlContent,
        });
        return response.data;
    },

    saveAsNewVersion: async (id: string, changeSummary?: string): Promise<Resume> => {
        const response = await apiClient.post<Resume>(`/resumes/${id}/versions`, {
            change_summary: changeSummary || "Manual save"
        });
        return response.data;
    },

    activateVersion: async (resumeId: string, versionId: string): Promise<Resume> => {
        const response = await apiClient.put<Resume>(`/resumes/${resumeId}/versions/${versionId}/activate`);
        return response.data;
    },

    getVersions: async (resumeId: string): Promise<ResumeVersion[]> => {
        const response = await apiClient.get<ResumeVersion[]>(`/resumes/${resumeId}/versions`);
        return response.data;
    },

    tailorResume: async (id: string): Promise<Resume> => {
        const response = await apiClient.post<Resume>(`/resumes/${id}/tailor`);
        return response.data;
    },

    /** Fetch the current PDF as a Blob for client-side download. */
    downloadPdfBlob: async (resumeId: string): Promise<Blob> => {
        const response = await apiClient.get(`/resumes/${resumeId}/pdf`, {
            responseType: 'blob',
            params: { t: Date.now() },
        });
        return new Blob([response.data], { type: 'application/pdf' });
    },

    /** Save the current PDF directly to D:\JOB APPLICATIONS\{company}\ on disk. */
    savePdfToDisk: async (resumeId: string, companyName: string, filename: string, force = false): Promise<string> => {
        const response = await apiClient.post<{ saved_to: string }>(`/resumes/${resumeId}/save-to-disk`, {
            company_name: companyName,
            filename,
            force,
        });
        return response.data.saved_to;
    },
};
