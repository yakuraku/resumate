export enum InterviewType {
  BEHAVIORAL = "behavioral",
  TECHNICAL = "technical",
  MIXED = "mixed"
}

export interface InterviewAnswer {
  id: string;
  question_id: string;
  answer_text: string | null;
  feedback_text: string | null;
  score: number | null;
}

export interface InterviewQuestion {
  id: string;
  session_id: string;
  question_text: string;
  question_order: number;
  answer: InterviewAnswer | null;
}

export interface InterviewSession {
  id: string;
  application_id: string;
  interview_type: string;
  persona: string | null;
  questions: InterviewQuestion[];
}

export interface CreateInterviewRequest {
  application_id: string;
  interview_type: InterviewType;
  persona?: string;
}

export interface GenerateQuestionsRequest {
  num_questions: number;
}
