import axios from 'axios';

const API_URL = 'http://localhost:8921/api/v1/context';

export interface UserContextItem {
    id: string;
    key: string;
    value: string;
    category: string;
    description?: string;
    created_at: string;
    updated_at: string;
}

export interface ContextIngestRequest {
    text: string;
}

export const contextService = {
    async getAll(): Promise<UserContextItem[]> {
        const response = await axios.get<UserContextItem[]>(API_URL);
        return response.data;
    },

    async getByCategory(category: string): Promise<UserContextItem[]> {
        const response = await axios.get<UserContextItem[]>(`${API_URL}/?category=${category}`);
        return response.data;
    },

    async create(data: Partial<UserContextItem>): Promise<UserContextItem> {
        const response = await axios.post<UserContextItem>(API_URL, data);
        return response.data;
    },

    async update(key: string, data: Partial<UserContextItem>): Promise<UserContextItem> {
        const response = await axios.put<UserContextItem>(`${API_URL}/${key}`, data);
        return response.data;
    },

    async delete(key: string): Promise<void> {
        await axios.delete(`${API_URL}/${key}`);
    },

    async ingest(text: string): Promise<UserContextItem[]> {
        const response = await axios.post<UserContextItem[]>(`${API_URL}/ingest`, { text });
        return response.data;
    }
};
