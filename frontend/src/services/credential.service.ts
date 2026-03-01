import { apiClient } from '@/lib/axios';

export interface ApplicationCredential {
  id: string;
  application_id: string;
  auth_method: string;
  email?: string;
  username?: string;
  password?: string;
  oauth_email?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CredentialCreate {
  application_id: string;
  auth_method: string;
  email?: string;
  username?: string;
  password?: string;
  oauth_email?: string;
  notes?: string;
}

export interface CredentialUpdate {
  auth_method?: string;
  email?: string;
  username?: string;
  password?: string;
  oauth_email?: string;
  notes?: string;
}

const credentialService = {
  async get(applicationId: string): Promise<ApplicationCredential | null> {
    const res = await apiClient.get('/credentials', { params: { application_id: applicationId } });
    return res.data;
  },
  async create(data: CredentialCreate): Promise<ApplicationCredential> {
    const res = await apiClient.post('/credentials', data);
    return res.data;
  },
  async update(id: string, data: CredentialUpdate): Promise<ApplicationCredential> {
    const res = await apiClient.put(`/credentials/${id}`, data);
    return res.data;
  },
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/credentials/${id}`);
  },
};

export default credentialService;
