"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    Loader2,
    Plus,
    Trash2,
    HelpCircle,
    PenLine,
    Bot,
    Sparkles,
    Minimize2,
    Target,
    Award,
    MessageSquare,
    History,
    Copy,
    Check,
    Send,
    RefreshCw,
} from "lucide-react";
import { chatService, ChatMessage, ChatConversationSummary } from "@/services/chat.service";
import { QuestionsService, ApplicationQuestion } from "@/services/questions.service";
import { CopyButton } from "@/components/shared/CopyButton";
import { SaveIndicator } from "@/components/shared/SaveIndicator";
import type { SaveStatus } from "@/components/shared/SaveIndicator";
import { MarkdownContent } from "@/components/shared/MarkdownContent";
import { SkeletonParagraph, SkeletonCard } from "@/components/shared/Skeletons";
import { useAutosave } from "@/hooks/useAutosave";

type SubView = "chat" | "saved";
type ChatMode = "qa_generate" | "qa_rewrite";

const REFINE_PRESETS = [
    { label: "Make Shorter", icon: Minimize2, instruction: "Make this answer shorter and more concise while keeping the key points." },
    { label: "More Specific", icon: Target, instruction: "Make this answer more specific with concrete examples and measurable outcomes." },
    { label: "More Professional", icon: Award, instruction: "Rewrite this answer with a more professional, polished tone suitable for a job application." },
];

interface Props {
    applicationId: string;
}

function wordCount(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

export function QAAssistant({ applicationId }: Props) {
    // Sub-view state
    const [subView, setSubView] = useState<SubView>("chat");

    // ── Chat state ──────────────────────────────────────────────
    const [chatMode, setChatMode] = useState<ChatMode>("qa_generate");
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isCreatingChat, setIsCreatingChat] = useState(false);
    const [chatLoading, setChatLoading] = useState(false);

    // History sheet
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyConvos, setHistoryConvos] = useState<ChatConversationSummary[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Copy state for individual assistant messages
    const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // ── Saved Answers state ──────────────────────────────────────
    const [questions, setQuestions] = useState<ApplicationQuestion[]>([]);
    const [questionsLoading, setQuestionsLoading] = useState(false);
    const [newQuestionText, setNewQuestionText] = useState("");
    const [addingQuestion, setAddingQuestion] = useState(false);
    const [generatingAnswerFor, setGeneratingAnswerFor] = useState<string | null>(null);
    const [refiningAnswerFor, setRefiningAnswerFor] = useState<string | null>(null);
    const [editingAnswerFor, setEditingAnswerFor] = useState<string | null>(null);
    const [editingAnswerText, setEditingAnswerText] = useState("");
    const [savingAnswerFor, setSavingAnswerFor] = useState<string | null>(null);

    // Toast state
    const [toasts, setToasts] = useState<Array<{ id: string; message: string; variant: "default" | "error" }>>([]);

    const showToast = useCallback((message: string, variant: "default" | "error" = "default") => {
        const id = crypto.randomUUID();
        setToasts((prev) => [...prev, { id, message, variant }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    }, []);

    // ── Answer autosave ──────────────────────────────────────────
    const saveAnswerSilently = useCallback(
        async (text: string) => {
            if (!editingAnswerFor) return;
            const updated = await QuestionsService.update(editingAnswerFor, { answer_text: text });
            setQuestions((prev) => prev.map((q) => (q.id === editingAnswerFor ? updated : q)));
        },
        [editingAnswerFor]
    );

    const { saveStatus: answerAutoSaveStatus } = useAutosave({
        value: editingAnswerText,
        onSave: saveAnswerSilently,
        debounceMs: 1500,
        enabled: editingAnswerFor !== null,
    });

    // Auto-load last conversation for the current mode on mount / mode change
    useEffect(() => {
        const loadLastConversation = async () => {
            setChatLoading(true);
            setMessages([]);
            setCurrentChatId(null);
            try {
                const conversations = await chatService.getConversations(applicationId, chatMode);
                if (conversations.length > 0) {
                    const full = await chatService.getConversation(conversations[0].id);
                    setCurrentChatId(full.id);
                    setMessages(full.messages || []);
                }
            } catch (error) {
                console.error("Failed to load last conversation:", error);
            } finally {
                setChatLoading(false);
            }
        };
        loadLastConversation();
    }, [applicationId, chatMode]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isSending]);

    // Load questions when switching to saved view
    useEffect(() => {
        if (subView === "saved") {
            loadQuestions();
        }
    }, [subView]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadQuestions = async () => {
        setQuestionsLoading(true);
        try {
            const data = await QuestionsService.getByApplication(applicationId);
            setQuestions(data);
        } catch (e) {
            console.error("Failed to load questions", e);
        } finally {
            setQuestionsLoading(false);
        }
    };

    // ── Chat helpers ─────────────────────────────────────────────

    const handleNewChat = async () => {
        setIsCreatingChat(true);
        try {
            const convo = await chatService.createConversation(applicationId, chatMode);
            setCurrentChatId(convo.id);
            setMessages([]);
            setInputText("");
        } catch (e) {
            showToast("Failed to start a new chat", "error");
        } finally {
            setIsCreatingChat(false);
        }
    };

    const handleSendMessage = async () => {
        const content = inputText.trim();
        if (!content || isSending) return;

        let activeChatId = currentChatId;

        // Create a new conversation if none exists
        if (!activeChatId) {
            setIsCreatingChat(true);
            try {
                const convo = await chatService.createConversation(applicationId, chatMode);
                activeChatId = convo.id;
                setCurrentChatId(convo.id);
            } catch (e) {
                showToast("Failed to start conversation", "error");
                setIsCreatingChat(false);
                return;
            } finally {
                setIsCreatingChat(false);
            }
        }

        setInputText("");
        setMessages((prev) => [...prev, { role: "user", content }]);
        setIsSending(true);

        try {
            const response = await chatService.sendMessage(activeChatId, content);
            setMessages((prev) => [...prev, response]);
        } catch (e) {
            showToast("Failed to send message", "error");
            // Remove the optimistic user message
            setMessages((prev) => prev.slice(0, -1));
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleModeSwitch = (mode: ChatMode) => {
        if (mode === chatMode) return;
        setInputText("");
        setChatMode(mode); // useEffect[chatMode] will auto-load the last conversation for the new mode
    };

    const handleCopyMsg = async (content: string, idx: number) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedMsgIdx(idx);
            setTimeout(() => setCopiedMsgIdx(null), 2000);
        } catch {
            // Ignore
        }
    };

    // ── History ──────────────────────────────────────────────────

    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const data = await chatService.getConversations(applicationId, chatMode);
            setHistoryConvos(data);
        } catch (e) {
            console.error("Failed to load history", e);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleHistoryOpen = (open: boolean) => {
        setHistoryOpen(open);
        if (open) loadHistory();
    };

    const handleLoadConversation = async (id: string) => {
        try {
            const convo = await chatService.getConversation(id);
            setCurrentChatId(convo.id);
            setMessages(convo.messages);
            setHistoryOpen(false);
        } catch (e) {
            showToast("Failed to load conversation", "error");
        }
    };

    const handleDeleteConversation = async (id: string) => {
        setDeletingId(id);
        try {
            await chatService.deleteConversation(id);
            setHistoryConvos((prev) => prev.filter((c) => c.id !== id));
            if (currentChatId === id) {
                setCurrentChatId(null);
                setMessages([]);
            }
        } catch (e) {
            showToast("Failed to delete conversation", "error");
        } finally {
            setDeletingId(null);
        }
    };

    // ── Q&A Saved handlers ───────────────────────────────────────

    const handleAddQuestion = async () => {
        if (!newQuestionText.trim()) return;
        setAddingQuestion(true);
        try {
            const created = await QuestionsService.create({
                application_id: applicationId,
                question_text: newQuestionText.trim(),
            });
            setQuestions((prev) => [...prev, created]);
            setNewQuestionText("");
        } catch (e) {
            showToast("Failed to add question", "error");
        } finally {
            setAddingQuestion(false);
        }
    };

    const handleGenerateAnswer = async (questionId: string) => {
        setGeneratingAnswerFor(questionId);
        try {
            const updated = await QuestionsService.generateAnswer(questionId);
            setQuestions((prev) => prev.map((q) => (q.id === questionId ? updated : q)));
            showToast("Answer generated");
        } catch (e) {
            showToast("Failed to generate answer", "error");
        } finally {
            setGeneratingAnswerFor(null);
        }
    };

    const handleRefineAnswer = async (questionId: string, instruction: string) => {
        setRefiningAnswerFor(questionId);
        try {
            const updated = await QuestionsService.refineAnswer(questionId, instruction);
            setQuestions((prev) => prev.map((q) => (q.id === questionId ? updated : q)));
        } catch (e) {
            showToast("Failed to refine answer", "error");
        } finally {
            setRefiningAnswerFor(null);
        }
    };

    const handleDeleteQuestion = async (questionId: string) => {
        try {
            await QuestionsService.delete(questionId);
            setQuestions((prev) => prev.filter((q) => q.id !== questionId));
        } catch (e) {
            showToast("Failed to delete question", "error");
        }
    };

    const handleStartEditAnswer = (question: ApplicationQuestion) => {
        setEditingAnswerFor(question.id);
        setEditingAnswerText(question.answer_text || "");
    };

    const handleSaveAnswer = async (questionId: string) => {
        setSavingAnswerFor(questionId);
        try {
            const updated = await QuestionsService.update(questionId, { answer_text: editingAnswerText });
            setQuestions((prev) => prev.map((q) => (q.id === questionId ? updated : q)));
            setEditingAnswerFor(null);
            showToast("Answer saved");
        } catch (e) {
            showToast("Failed to save answer", "error");
        } finally {
            setSavingAnswerFor(null);
        }
    };

    // ── Render ───────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full">
            {/* Sub-view toggle header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-background/80">
                <button
                    onClick={() => setSubView("chat")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        subView === "chat"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Chat
                </button>
                <button
                    onClick={() => setSubView("saved")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        subView === "saved"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                >
                    <HelpCircle className="h-3.5 w-3.5" />
                    Saved Answers
                </button>
            </div>

            {/* ── Chat sub-view ── */}
            {subView === "chat" && (
                <div className="flex flex-col h-full min-h-0">
                    {/* Chat toolbar */}
                    <div className="flex items-center gap-2 px-4 py-2 border-b">
                        {/* Mode toggle */}
                        <div className="flex items-center rounded-md border overflow-hidden text-xs">
                            <button
                                onClick={() => handleModeSwitch("qa_generate")}
                                className={`px-3 py-1.5 transition-colors ${
                                    chatMode === "qa_generate"
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-muted"
                                }`}
                            >
                                Generate Answer
                            </button>
                            <button
                                onClick={() => handleModeSwitch("qa_rewrite")}
                                className={`px-3 py-1.5 transition-colors border-l ${
                                    chatMode === "qa_rewrite"
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-muted"
                                }`}
                            >
                                Rewrite / Polish
                            </button>
                        </div>

                        <div className="ml-auto flex items-center gap-2">
                            {/* New Chat */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 h-7 text-xs"
                                onClick={handleNewChat}
                                disabled={isCreatingChat}
                            >
                                {isCreatingChat ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <Plus className="h-3 w-3" />
                                )}
                                New Chat
                            </Button>

                            {/* History Sheet */}
                            <Sheet open={historyOpen} onOpenChange={handleHistoryOpen}>
                                <SheetTrigger asChild>
                                    <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs">
                                        <History className="h-3 w-3" />
                                        History
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="right" className="w-[360px] sm:w-[400px]">
                                    <SheetHeader>
                                        <SheetTitle>
                                            {chatMode === "qa_generate" ? "Generate Answer" : "Rewrite"} History
                                        </SheetTitle>
                                    </SheetHeader>
                                    <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(100vh-8rem)]">
                                        {historyLoading && (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                            </div>
                                        )}
                                        {!historyLoading && historyConvos.length === 0 && (
                                            <p className="text-sm text-muted-foreground text-center py-8">
                                                No past conversations yet.
                                            </p>
                                        )}
                                        {!historyLoading &&
                                            historyConvos.map((convo) => (
                                                <div
                                                    key={convo.id}
                                                    className={`flex items-start gap-2 p-3 rounded-md border cursor-pointer transition-colors hover:bg-muted group ${
                                                        convo.id === currentChatId ? "border-primary/40 bg-muted/50" : ""
                                                    }`}
                                                    onClick={() => handleLoadConversation(convo.id)}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{convo.preview}</p>
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {convo.message_count} message{convo.message_count !== 1 ? "s" : ""} &bull;{" "}
                                                            {new Date(convo.updated_at).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteConversation(convo.id);
                                                        }}
                                                        disabled={deletingId === convo.id}
                                                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                                                        title="Delete conversation"
                                                    >
                                                        {deletingId === convo.id ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        )}
                                                    </button>
                                                </div>
                                            ))}
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>
                    </div>

                    {/* Mode description */}
                    <div className="px-4 py-2 bg-muted/30 border-b">
                        <p className="text-xs text-muted-foreground">
                            {chatMode === "qa_generate"
                                ? "Paste a question from your job application. The AI will draft an answer in your voice using your resume and career context."
                                : "Paste rough notes or a draft. The AI will rewrite it into polished, professional language."}
                        </p>
                    </div>

                    {/* Messages area */}
                    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
                        {chatLoading && (
                            <div className="space-y-4 pt-4">
                                <SkeletonParagraph lines={3} />
                                <SkeletonParagraph lines={2} />
                            </div>
                        )}
                        {!chatLoading && messages.length === 0 && !isSending && (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-16">
                                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                                    <Bot className="h-7 w-7 text-muted-foreground opacity-60" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm">
                                        {chatMode === "qa_generate"
                                            ? "Ready to answer your application questions"
                                            : "Ready to polish your writing"}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                                        {chatMode === "qa_generate"
                                            ? "Paste any question from a job application form below and press Enter."
                                            : "Paste any draft text below and I'll rewrite it professionally."}
                                    </p>
                                </div>
                            </div>
                        )}

                        {!chatLoading && messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                {msg.role === "assistant" && (
                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1 mr-2">
                                        <Bot className="h-3.5 w-3.5 text-primary" />
                                    </div>
                                )}
                                <div
                                    className={`relative group max-w-[80%] rounded-lg px-3 py-2.5 ${
                                        msg.role === "user"
                                            ? "bg-primary text-primary-foreground text-sm"
                                            : "bg-muted text-foreground text-sm"
                                    }`}
                                >
                                    {msg.role === "assistant" ? (
                                        <MarkdownContent content={msg.content} className="prose-sm" />
                                    ) : (
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                    )}

                                    {msg.role === "assistant" && (
                                        <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-border/50">
                                            <span className="text-xs text-muted-foreground">
                                                {wordCount(msg.content)} words
                                            </span>
                                            <button
                                                onClick={() => handleCopyMsg(msg.content, idx)}
                                                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                                title="Copy response"
                                            >
                                                {copiedMsgIdx === idx ? (
                                                    <>
                                                        <Check className="h-3 w-3 text-green-500" />
                                                        <span className="text-green-500">Copied</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="h-3 w-3" />
                                                        Copy
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {isSending && (
                            <div className="flex justify-start">
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1 mr-2">
                                    <Bot className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                                    <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                                    <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input area */}
                    <div className="px-4 py-3 border-t bg-background">
                        <div className="flex gap-2 items-end">
                            <Textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={
                                    chatMode === "qa_generate"
                                        ? "Paste a question (e.g. \"Why do you want to work here?\") — Enter to send, Shift+Enter for new line"
                                        : "Paste your draft text to polish — Enter to send, Shift+Enter for new line"
                                }
                                className="flex-1 min-h-[60px] max-h-[180px] text-sm resize-none"
                                disabled={isSending || isCreatingChat}
                            />
                            <Button
                                onClick={handleSendMessage}
                                disabled={!inputText.trim() || isSending || isCreatingChat}
                                size="icon"
                                className="shrink-0 h-10 w-10"
                            >
                                {isSending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Saved Answers sub-view ── */}
            {subView === "saved" && (
                <ScrollArea className="flex-1">
                    <div className="p-6 max-w-3xl mx-auto space-y-6">
                        {/* Header */}
                        <div>
                            <h2 className="text-lg font-semibold mb-1">Saved Answers</h2>
                            <p className="text-sm text-muted-foreground">
                                Draft answers to application questions. AI uses your resume and career context to generate tailored responses.
                            </p>
                        </div>

                        {/* Add Question input */}
                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Paste an application question here…"
                                        value={newQuestionText}
                                        onChange={(e) => setNewQuestionText(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleAddQuestion();
                                            }
                                        }}
                                        className="flex-1"
                                    />
                                    <Button
                                        onClick={handleAddQuestion}
                                        disabled={addingQuestion || !newQuestionText.trim()}
                                        className="gap-2 shrink-0"
                                    >
                                        {addingQuestion ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Plus className="h-4 w-4" />
                                        )}
                                        Add
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Loading state */}
                        {questionsLoading && (
                            <div className="space-y-3">
                                {[1, 2].map((i) => (
                                    <SkeletonCard key={i} lines={4} headerHeight="h-4 w-3/4" />
                                ))}
                            </div>
                        )}

                        {/* Empty state */}
                        {!questionsLoading && questions.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                                    <HelpCircle className="h-8 w-8 text-muted-foreground opacity-50" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">No questions yet</h3>
                                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                                        Add questions from your job application form and let AI help you draft compelling STAR-method answers.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Question cards */}
                        {!questionsLoading &&
                            questions.map((q) => {
                                const isGenerating = generatingAnswerFor === q.id;
                                const isRefining = refiningAnswerFor === q.id;
                                const isEditingAnswer = editingAnswerFor === q.id;
                                const isSaving = savingAnswerFor === q.id;
                                const isAiWorking = isGenerating || isRefining;

                                return (
                                    <Card key={q.id} className="relative">
                                        <CardContent className="pt-4 space-y-3">
                                            {/* Question text */}
                                            <div className="flex items-start gap-2">
                                                <HelpCircle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                                                <p className="text-sm font-medium leading-relaxed flex-1">
                                                    {q.question_text}
                                                </p>
                                                <button
                                                    onClick={() => handleDeleteQuestion(q.id)}
                                                    className="text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                                                    title="Delete question"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>

                                            {/* Answer area */}
                                            <div className="pl-6 space-y-2">
                                                {isAiWorking ? (
                                                    <div className="space-y-2 rounded-md bg-muted/50 p-3 border border-border">
                                                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                                                            <Bot className="h-3.5 w-3.5 animate-bounce" />
                                                            {isGenerating ? "Generating answer…" : "Refining answer…"}
                                                        </div>
                                                        <SkeletonParagraph lines={4} />
                                                    </div>
                                                ) : isEditingAnswer ? (
                                                    <div className="space-y-2">
                                                        <Textarea
                                                            value={editingAnswerText}
                                                            onChange={(e) => setEditingAnswerText(e.target.value)}
                                                            className="min-h-[120px] text-sm"
                                                            placeholder="Write your answer here…"
                                                        />
                                                        <div className="flex items-center gap-2">
                                                            <SaveIndicator status={answerAutoSaveStatus} />
                                                            <div className="flex gap-2 ml-auto">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setEditingAnswerFor(null)}
                                                                    disabled={isSaving}
                                                                >
                                                                    Done
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => handleSaveAnswer(q.id)}
                                                                    disabled={isSaving}
                                                                >
                                                                    {isSaving ? (
                                                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                                    ) : null}
                                                                    Save
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : q.answer_text ? (
                                                    <div className="relative group">
                                                        <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                            <CopyButton text={q.answer_text} />
                                                            <button
                                                                onClick={() => handleStartEditAnswer(q)}
                                                                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
                                                                title="Edit answer"
                                                            >
                                                                <PenLine className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                        <MarkdownContent
                                                            content={q.answer_text}
                                                            className="pr-16"
                                                        />
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-muted-foreground italic">
                                                        No answer yet. Generate with AI or write your own.
                                                    </p>
                                                )}

                                                {/* Footer action row */}
                                                {!isEditingAnswer && !isAiWorking && (
                                                    <div className="space-y-2 pt-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="gap-1.5 text-xs"
                                                                onClick={() => handleGenerateAnswer(q.id)}
                                                                disabled={isGenerating}
                                                            >
                                                                <Sparkles className="h-3 w-3" />
                                                                {q.answer_text ? "Regenerate" : "Generate with AI"}
                                                            </Button>
                                                            {!isEditingAnswer && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="gap-1.5 text-xs"
                                                                    onClick={() => handleStartEditAnswer(q)}
                                                                >
                                                                    <PenLine className="h-3 w-3" />
                                                                    {q.answer_text ? "Edit" : "Write manually"}
                                                                </Button>
                                                            )}
                                                            {q.is_ai_generated && (
                                                                <Badge variant="secondary" className="text-xs gap-1 ml-auto">
                                                                    <Bot className="h-3 w-3" />
                                                                    AI generated
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        {/* Refine buttons */}
                                                        {q.answer_text && (
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="text-xs text-muted-foreground mr-0.5">Refine:</span>
                                                                {REFINE_PRESETS.map((preset) => {
                                                                    const Icon = preset.icon;
                                                                    return (
                                                                        <button
                                                                            key={preset.label}
                                                                            onClick={() => handleRefineAnswer(q.id, preset.instruction)}
                                                                            disabled={isRefining}
                                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        >
                                                                            <Icon className="h-3 w-3" />
                                                                            {preset.label}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                    </div>
                </ScrollArea>
            )}

            {/* Toast Notifications */}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-bottom-2 fade-in duration-200 ${
                            toast.variant === "error"
                                ? "bg-destructive text-destructive-foreground"
                                : "bg-foreground text-background"
                        }`}
                    >
                        {toast.message}
                    </div>
                ))}
            </div>
        </div>
    );
}
