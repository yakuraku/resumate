export enum ApplicationStatus {
  DRAFT = "draft",
  APPLIED = "applied",
  INTERVIEWING = "interviewing",
  OFFER = "offer",
  REJECTED = "rejected",
  GHOSTED = "ghosted"
}

export interface ApplicationBase {
  company: string;
  role: string;
  status: ApplicationStatus;
  job_description?: string;
  location?: string;
  source_url?: string;
  notes?: string;
  applied_date?: string; // Date string YYYY-MM-DD
}

export type ApplicationCreate = ApplicationBase;

export interface ApplicationUpdate {
  company?: string;
  role?: string;
  status?: ApplicationStatus;
  job_description?: string;
  location?: string;
  source_url?: string;
  notes?: string;
  applied_date?: string;
}

export interface ApplicationResponse extends ApplicationBase {
  id: string;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
  resume_template_id?: string | null;
  resume_snapshot_yaml?: string | null;
}

export interface ApplicationListResponse {
  items: ApplicationResponse[];
  total: number;
  page: number;
  page_size: number;
}
