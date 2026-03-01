import { apiClient } from "@/lib/axios"
import type {
  ResumeTemplate,
  ResumeTemplateDetail,
  ResumeTemplateCreate,
  ResumeTemplateUpdate,
} from "@/types/resume-template"

export const ResumeTemplateService = {
  async getAll(search?: string): Promise<ResumeTemplate[]> {
    const params = search ? { search } : {}
    const res = await apiClient.get<ResumeTemplate[]>("/resume-templates", { params })
    return res.data
  },

  async getById(id: string): Promise<ResumeTemplateDetail> {
    const res = await apiClient.get<ResumeTemplateDetail>(`/resume-templates/${id}`)
    return res.data
  },

  async create(data: ResumeTemplateCreate): Promise<ResumeTemplate> {
    const res = await apiClient.post<ResumeTemplate>("/resume-templates", data)
    return res.data
  },

  async update(id: string, data: ResumeTemplateUpdate): Promise<ResumeTemplate> {
    const res = await apiClient.put<ResumeTemplate>(`/resume-templates/${id}`, data)
    return res.data
  },

  async delete(id: string, force?: boolean): Promise<void> {
    const params = force ? { force: true } : {}
    await apiClient.delete(`/resume-templates/${id}`, { params })
  },

  async saveYaml(
    id: string,
    yaml_content: string
  ): Promise<{ success: boolean; updated_at: string }> {
    const res = await apiClient.put<{ success: boolean; updated_at: string }>(
      `/resume-templates/${id}/yaml`,
      { yaml_content }
    )
    return res.data
  },

  async duplicate(id: string, name: string): Promise<ResumeTemplate> {
    const res = await apiClient.post<ResumeTemplate>(`/resume-templates/${id}/duplicate`, { name })
    return res.data
  },

  async renderPdf(id: string): Promise<Blob> {
    const res = await apiClient.post(`/resume-templates/${id}/render-pdf`, null, {
      responseType: "blob",
    })
    return res.data as Blob
  },
}
