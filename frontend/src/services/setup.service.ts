import { apiClient } from "@/lib/axios";

export interface SetupStatus {
    master_resume_exists: boolean;
    context_files_exist: boolean;
    api_key_configured: boolean;
    wizard_dismissed: boolean;
}

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

export const SetupService = {
    async getStatus(): Promise<SetupStatus> {
        const res = await apiClient.get<SetupStatus>("/setup/status");
        return res.data;
    },

    async getMasterResume(): Promise<string> {
        const res = await apiClient.get<{ content: string }>("/setup/master-resume");
        return res.data.content;
    },

    async saveMasterResume(content: string): Promise<ValidationResult> {
        const res = await apiClient.post<ValidationResult>("/setup/master-resume", { content });
        return res.data;
    },

    async dismissWizard(): Promise<void> {
        await apiClient.post("/setup/wizard/dismiss");
    },

    async generateResumeYaml(
        rawContent: string,
        previousYaml?: string,
        previousError?: string,
    ): Promise<{ yaml_content: string }> {
        const res = await apiClient.post<{ yaml_content: string }>(
            "/setup/generate-resume-yaml",
            {
                raw_content: rawContent,
                previous_yaml: previousYaml ?? null,
                previous_error: previousError ?? null,
            },
        );
        return res.data;
    },

    /** URL for the master resume preview PDF (add a cache-busting param). */
    masterResumePdfUrl(hash: string): string {
        return `/api/v1/setup/master-resume/pdf?t=${hash}`;
    },
};
