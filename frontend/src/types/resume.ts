
export type VersionSource = "master" | "manual_edit" | "ai_tailored";

export interface ResumeVersion {
    id: string;
    resume_id: string;
    version_number: number;
    yaml_content: string;
    change_summary: string;
    source: VersionSource;
    is_active: boolean;
    label: string | null;
    created_at: string;
}

export interface Resume {
    id: string;
    application_id: string;
    yaml_content: string;
    current_version: number;
    created_at: string;
    updated_at: string;
    versions?: ResumeVersion[];
}

export interface ResumeUpdate {
    yaml_content: string;
    change_summary?: string;
}
