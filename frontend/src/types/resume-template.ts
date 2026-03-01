export interface ResumeTemplate {
  id: string
  name: string
  yaml_content: string
  is_master: boolean
  is_starred: boolean
  created_at: string
  updated_at: string
  linked_application_count: number
}

export interface ResumeTemplateDetail extends ResumeTemplate {
  linked_applications: LinkedApplicationSummary[]
}

export interface LinkedApplicationSummary {
  id: string
  job_title: string | null
  company: string | null
  status: string
}

export interface ResumeTemplateCreate {
  name: string
  yaml_content?: string
}

export interface ResumeTemplateUpdate {
  name?: string
  yaml_content?: string
  is_starred?: boolean
}
