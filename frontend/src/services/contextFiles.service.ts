import { apiClient } from '@/lib/axios';

export interface ContextFileInfo {
  filename: string;
  size_bytes: number;
  modified_at: string;
  preview: string;
}

export interface ContextFileContent {
  filename: string;
  content: string;
  modified_at: string;
}

export interface ContextConfig {
  folder_path: string;
}

export const contextFilesService = {
  async getConfig(): Promise<ContextConfig> {
    const res = await apiClient.get('/context-files/config');
    return res.data;
  },

  async updateConfig(folderPath: string): Promise<ContextConfig> {
    const res = await apiClient.put('/context-files/config', { folder_path: folderPath });
    return res.data;
  },

  async listFiles(): Promise<ContextFileInfo[]> {
    const res = await apiClient.get('/context-files/');
    return res.data;
  },

  async getFile(filename: string): Promise<ContextFileContent> {
    const res = await apiClient.get(`/context-files/${encodeURIComponent(filename)}`);
    return res.data;
  },

  async createFile(filename: string, content: string): Promise<ContextFileContent> {
    const res = await apiClient.post('/context-files/', { filename, content });
    return res.data;
  },

  async updateFile(filename: string, content: string): Promise<ContextFileContent> {
    const res = await apiClient.put(`/context-files/${encodeURIComponent(filename)}`, { content });
    return res.data;
  },

  async deleteFile(filename: string): Promise<void> {
    await apiClient.delete(`/context-files/${encodeURIComponent(filename)}`);
  },

  async uploadFiles(files: File[]): Promise<{ results: Array<{ filename: string; status: string; reason?: string }> }> {
    const form = new FormData();
    for (const f of files) {
      form.append('files', f);
    }
    const res = await apiClient.post('/context-files/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async ingestToFile(text: string, filename?: string): Promise<ContextFileContent> {
    const res = await apiClient.post('/context-files/ingest', { text, filename });
    return res.data;
  },
};
