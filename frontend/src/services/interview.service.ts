import { apiClient } from "@/lib/axios";
import { CreateInterviewRequest, GenerateQuestionsRequest, InterviewSession, InterviewQuestion, InterviewAnswer } from "@/types/interview";

export const InterviewService = {
    async create(data: CreateInterviewRequest): Promise<InterviewSession> {
        const response = await apiClient.post<InterviewSession>("/interviews/", data);
        return response.data;
    },

    async getSession(sessionId: string): Promise<InterviewSession> {
        const response = await apiClient.get<InterviewSession>(`/interviews/${sessionId}`);
        return response.data;
    },

    async getByApplication(applicationId: string): Promise<InterviewSession[]> {
        const response = await apiClient.get<InterviewSession[]>(`/interviews/application/${applicationId}`);
        return response.data;
    },

    async generateQuestions(sessionId: string, data: GenerateQuestionsRequest): Promise<InterviewQuestion[]> {
        const response = await apiClient.post<InterviewQuestion[]>(`/interviews/${sessionId}/generate`, data);
        return response.data;
    },

    async submitAnswer(questionId: string, answerText: string): Promise<InterviewAnswer> {
        const response = await apiClient.post<InterviewAnswer>(`/interviews/questions/${questionId}/answer`, { answer_text: answerText });
        return response.data;
    }
};
