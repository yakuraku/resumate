
import { apiClient } from '@/lib/axios';
import { Resume, ResumeUpdate, ResumeVersion } from '@/types/resume';

export type SavePdfResult =
    | { mode: 'folder'; savedTo: string }
    | { mode: 'download'; blob: Blob; filename: string };

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

    /**
     * Save PDF -- behavior depends on the user's "Save to Folder" setting:
     *
     * Folder mode (setting enabled + path configured on the server):
     *   The server saves the file and returns JSON { mode: "folder", saved_to: "..." }.
     *   A 409 is raised when the file already exists and force=false.
     *
     * Download mode (default):
     *   The server returns the PDF as application/pdf with attachment disposition.
     *   The browser download is triggered by the caller using the returned blob.
     */
    savePdf: async (
        resumeId: string,
        companyName: string,
        filename: string,
        force = false
    ): Promise<SavePdfResult> => {
        const response = await apiClient.post(
            `/resumes/${resumeId}/save-to-disk`,
            { company_name: companyName, filename, force },
            { responseType: 'blob' }
        );

        const contentType: string = response.headers['content-type'] ?? '';

        if (contentType.includes('application/json')) {
            // Folder-save mode: parse JSON from blob
            const text = await (response.data as Blob).text();
            const data = JSON.parse(text) as { mode: string; saved_to: string };
            return { mode: 'folder', savedTo: data.saved_to };
        }

        // Download mode: return blob to caller for browser download
        const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
        return { mode: 'download', blob, filename };
    },

    deleteVersion: async (resumeId: string, versionId: string): Promise<void> => {
        await apiClient.delete(`/resumes/${resumeId}/versions/${versionId}`);
    },
};
