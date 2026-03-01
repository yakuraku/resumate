import { useState } from "react";
import { InterviewSession } from "@/types/interview";
import { InterviewService } from "@/services/interview.service";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Mic, Send, Play } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { MarkdownContent } from "@/components/shared/MarkdownContent";

interface Props {
    session: InterviewSession;
    onUpdate: () => void;
    showToast?: (message: string, variant?: "default" | "error") => void;
}

export function InterviewSessionView({ session, onUpdate, showToast }: Props) {
    const [generating, setGenerating] = useState(false);
    const [answering, setAnswering] = useState(false);
    const [currentAnswer, setCurrentAnswer] = useState("");

    const sortedQuestions = [...session.questions].sort(
        (a, b) => a.question_order - b.question_order
    );

    const activeQuestionIndex = sortedQuestions.findIndex((q) => !q.answer);
    const hasQuestions = sortedQuestions.length > 0;
    const isComplete = hasQuestions && activeQuestionIndex === -1;

    const currentQuestion =
        activeQuestionIndex !== -1 ? sortedQuestions[activeQuestionIndex] : null;

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            await InterviewService.generateQuestions(session.id, { num_questions: 5 });
            onUpdate();
        } catch (e) {
            console.error(e);
            showToast?.("Failed to generate questions", "error");
        } finally {
            setGenerating(false);
        }
    };

    const handleSubmit = async () => {
        if (!currentQuestion || !currentAnswer.trim()) return;
        setAnswering(true);
        try {
            await InterviewService.submitAnswer(currentQuestion.id, currentAnswer);
            setCurrentAnswer("");
            onUpdate();
        } catch (e) {
            console.error(e);
            showToast?.("Failed to submit answer", "error");
        } finally {
            setAnswering(false);
        }
    };

    if (!hasQuestions) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="bg-primary/10 p-6 rounded-full">
                    <Play className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Ready to begin?</h3>
                <p className="text-muted-foreground max-w-md">
                    The interviewer ({session.persona || "AI Recruiter"}) will analyze the job description
                    and your resume to ask relevant questions.
                </p>
                <Button size="lg" onClick={handleGenerate} disabled={generating}>
                    {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Generate Questions &amp; Start
                </Button>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 gap-4">
            {/* Main Chat/Question Area */}
            <ScrollArea className="flex-1 pr-4">
                <div className="space-y-6 max-w-3xl mx-auto pb-4">
                    {sortedQuestions.map((q) => (
                        <div key={q.id} className="space-y-4">
                            {/* Question Bubble */}
                            <div className="flex gap-4">
                                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                                    AI
                                </div>
                                <div className="bg-muted p-4 rounded-lg rounded-tl-none max-w-[80%] shadow-sm relative group">
                                    <p className="font-medium text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                                        Question {q.question_order}
                                    </p>
                                    <MarkdownContent content={q.question_text} className="text-sm" />
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <CopyButton text={q.question_text} />
                                    </div>
                                </div>
                            </div>

                            {/* Answer Bubble (if answered) */}
                            {q.answer && (
                                <div className="flex gap-4 flex-row-reverse">
                                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-xs font-bold shrink-0">
                                        ME
                                    </div>
                                    <div className="bg-primary/5 p-4 rounded-lg rounded-tr-none max-w-[80%] border border-primary/10 relative group">
                                        <p className="whitespace-pre-wrap leading-relaxed text-sm">
                                            {q.answer.answer_text}
                                        </p>
                                        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <CopyButton text={q.answer.answer_text ?? ""} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {isComplete && (
                        <div className="text-center py-8 text-muted-foreground">
                            All questions answered! Great job.
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Input Area */}
            {!isComplete && currentQuestion && (
                <div className="max-w-3xl mx-auto w-full pt-4 border-t bg-background">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">
                        Answering Question {currentQuestion.question_order}…
                    </p>
                    <div className="relative">
                        <Textarea
                            value={currentAnswer}
                            onChange={(e) => setCurrentAnswer(e.target.value)}
                            placeholder="Type your answer here..."
                            className="min-h-[100px] pr-24 resize-none text-base"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                            }}
                        />
                        <div className="absolute bottom-3 right-3 flex gap-2">
                            <Button size="icon" variant="ghost" title="Voice Input (Coming Soon)" disabled>
                                <Mic className="h-4 w-4" />
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSubmit}
                                disabled={answering || !currentAnswer.trim()}
                            >
                                {answering ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Tip: Press Ctrl+Enter to submit
                    </p>
                </div>
            )}
        </div>
    );
}
