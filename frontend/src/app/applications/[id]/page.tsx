"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { CommandCenter } from "@/components/layout/CommandCenter";
import { ApplicationService } from "@/services/application.service";
import { ApplicationResponse } from "@/types/application";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
    ArrowLeft, ExternalLink, Briefcase, FileText, Download, BrainCircuit,
    Loader2, MessageSquare, AlertTriangle, RefreshCw,
    Plus, Trash2, HelpCircle, PenLine, Bot, RotateCcw,
    Minimize2, Target, Award, ThumbsUp, X
} from "lucide-react";
import { ResumeService } from "@/services/resume.service";
import { Resume, ResumeVersion } from "@/types/resume";
import { ResumeEditor } from "@/components/resume/ResumeEditor";
import { InterviewDashboard } from "@/components/interview/InterviewDashboard";
import { VersionBar } from "@/components/resume/VersionBar";
import { TailorRulesPanel } from "@/components/resume/TailorRulesPanel";
import { QuestionsService, ApplicationQuestion } from "@/services/questions.service";
import { CopyButton } from "@/components/shared/CopyButton";
import { SaveIndicator } from "@/components/shared/SaveIndicator";
import type { SaveStatus } from "@/components/shared/SaveIndicator";
import { MarkdownContent } from "@/components/shared/MarkdownContent";
import { SkeletonParagraph, SkeletonCard } from "@/components/shared/Skeletons";
import { useAutosave } from "@/hooks/useAutosave";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8921/api/v1";

interface PageProps {
    params: Promise<{ id: string }>;
}

interface Toast {
    id: string;
    message: string;
    variant: "default" | "error";
}

// Refine instruction presets
const REFINE_PRESETS = [
    { label: "Make Shorter", icon: Minimize2, instruction: "Make this answer shorter and more concise while keeping the key points." },
    { label: "More Specific", icon: Target, instruction: "Make this answer more specific with concrete examples and measurable outcomes." },
    { label: "More Professional", icon: Award, instruction: "Rewrite this answer with a more professional, polished tone suitable for a job application." },
];

export default function ApplicationWorkspacePage({ params }: PageProps) {
    const { id } = use(params);
    const router = useRouter();
    const [application, setApplication] = useState<ApplicationResponse | null>(null);
    const [resume, setResume] = useState<Resume | null>(null);
    const [loading, setLoading] = useState(true);
    const [tailoring, setTailoring] = useState(false);
    const [saving, setSaving] = useState(false);

    // JD Editing State
    const [isEditingJd, setIsEditingJd] = useState(false);
    const [editedJd, setEditedJd] = useState("");
    const [savingJd, setSavingJd] = useState(false);

    // PDF Preview State
    // null until resume loads — then set to a content-based key so the URL is
    // stable across page navigations when content hasn't changed.
    const [previewHash, setPreviewHash] = useState<number | null>(null);
    const [pdfLoading, setPdfLoading] = useState(false);

    // YAML Auto-Save State
    const [debouncedValue, setDebouncedValue] = useState<string>("");
    const [yamlSaveStatus, setYamlSaveStatus] = useState<SaveStatus>("idle");

    // Versioning State
    const [viewingVersionId, setViewingVersionId] = useState<string | null>(null);
    const [displayYaml, setDisplayYaml] = useState<string>("");
    const [activatingVersion, setActivatingVersion] = useState(false);
    const [savingVersion, setSavingVersion] = useState(false);

    // Floating tailor action bar (shown after AI tailor)
    const [showTailorBar, setShowTailorBar] = useState(false);

    // Toast notifications
    const [toasts, setToasts] = useState<Toast[]>([]);

    // Q&A State
    const [questions, setQuestions] = useState<ApplicationQuestion[]>([]);
    const [questionsLoading, setQuestionsLoading] = useState(false);
    const [newQuestionText, setNewQuestionText] = useState("");
    const [addingQuestion, setAddingQuestion] = useState(false);
    const [generatingAnswerFor, setGeneratingAnswerFor] = useState<string | null>(null);
    const [refiningAnswerFor, setRefiningAnswerFor] = useState<string | null>(null);
    const [editingAnswerFor, setEditingAnswerFor] = useState<string | null>(null);
    const [editingAnswerText, setEditingAnswerText] = useState("");
    const [savingAnswerFor, setSavingAnswerFor] = useState<string | null>(null);

    // Derived: is viewing the active version?
    const versions = resume?.versions ?? [];
    const viewingVersion = versions.find((v) => v.id === viewingVersionId);
    const isViewingActive = viewingVersion?.is_active ?? false;

    // Computed PDF src — uses version_id param for non-active version previews.
    // previewHash is null until the resume loads, preventing a premature request
    // with Date.now() that would bypass the server ETag cache on every navigation.
    const pdfVersionParam = !isViewingActive && viewingVersionId ? `&version_id=${viewingVersionId}` : "";
    const pdfSrc = resume && previewHash !== null
        ? `${API_URL}/resumes/${resume.id}/pdf?t=${previewHash}${pdfVersionParam}`
        : "";

    const showToast = useCallback((message: string, variant: Toast["variant"] = "default") => {
        const id = crypto.randomUUID();
        setToasts((prev) => [...prev, { id, message, variant }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    }, []);

    const triggerPdfRefresh = useCallback(() => {
        setPdfLoading(true);
        setPreviewHash(Date.now());
    }, []);

    // ── JD Autosave ────────────────────────────────────────────────────────────
    const saveJdSilently = useCallback(
        async (jd: string) => {
            if (!application) return;
            await ApplicationService.update(application.id, { job_description: jd });
            setApplication((prev) => (prev ? { ...prev, job_description: jd } : prev));
        },
        [application]
    );

    const { saveStatus: jdAutoSaveStatus } = useAutosave({
        value: editedJd,
        onSave: saveJdSilently,
        debounceMs: 2000,
        enabled: isEditingJd,
    });

    // ── Q&A Answer Autosave ───────────────────────────────────────────────────
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

    useEffect(() => {
        const loadData = async () => {
            try {
                const appData = await ApplicationService.getById(id);
                setApplication(appData);
                setEditedJd(appData.job_description || "");

                try {
                    const resumeData = await ResumeService.getByApplicationId(id);
                    setResume(resumeData);
                    const active = resumeData.versions?.find((v) => v.is_active);
                    if (active) {
                        setViewingVersionId(active.id);
                        setDisplayYaml(active.yaml_content);
                        // Use updated_at as the stable cache key — URL stays the
                        // same across navigations until content actually changes.
                        setPreviewHash(new Date(resumeData.updated_at).getTime());
                    } else if (resumeData.versions && resumeData.versions.length > 0) {
                        const last = resumeData.versions[resumeData.versions.length - 1];
                        setViewingVersionId(last.id);
                        setDisplayYaml(last.yaml_content);
                        setPreviewHash(new Date(resumeData.updated_at).getTime());
                    } else {
                        setDisplayYaml(resumeData.yaml_content);
                        setPreviewHash(new Date(resumeData.updated_at).getTime());
                    }
                } catch (e) {
                    console.log("Resume may not exist yet", e);
                }
            } catch (error) {
                console.error("Failed to fetch application", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [id, router]);

    // Load Q&A questions
    const loadQuestions = useCallback(async () => {
        setQuestionsLoading(true);
        try {
            const data = await QuestionsService.getByApplication(id);
            setQuestions(data);
        } catch (e) {
            console.error("Failed to load questions", e);
        } finally {
            setQuestionsLoading(false);
        }
    }, [id]);

    // Core YAML auto-save function
    const saveToBackend = useCallback(
        async (content: string): Promise<boolean> => {
            if (!resume || !isViewingActive) return false;
            setYamlSaveStatus("saving");
            try {
                const updated = await ResumeService.updateYaml(resume.id, content);
                setResume(updated);
                triggerPdfRefresh();
                setYamlSaveStatus("saved");
                setTimeout(() => setYamlSaveStatus("idle"), 2000);
                return true;
            } catch (e) {
                console.error("Auto-save failed", e);
                setYamlSaveStatus("error");
                return false;
            }
        },
        [resume, isViewingActive, triggerPdfRefresh]
    );

    // YAML Auto-Save Effect (debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (debouncedValue && resume && isViewingActive && debouncedValue !== resume.yaml_content) {
                saveToBackend(debouncedValue);
            }
        }, 1500);
        return () => clearTimeout(timer);
    }, [debouncedValue]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleResumeChange = (value: string | undefined) => {
        if (resume && value && isViewingActive) {
            setDisplayYaml(value);
            setDebouncedValue(value);
            // Auto-dismiss the tailor bar when user starts editing
            if (showTailorBar) setShowTailorBar(false);
        }
    };

    const handleSave = async () => {
        if (!resume || !application) return;
        setSaving(true);
        try {
            if (isViewingActive && displayYaml && displayYaml !== resume.yaml_content) {
                const updated = await ResumeService.updateYaml(resume.id, displayYaml);
                setResume(updated);
            }
            const blob = await ResumeService.downloadPdfBlob(resume.id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const company = (application.company || "company").replace(/[^a-z0-9]/gi, "_").toLowerCase();
            const role = (application.role || "resume").replace(/[^a-z0-9]/gi, "_").toLowerCase();
            a.href = url;
            a.download = `${company}_${role}_resume.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            triggerPdfRefresh();
            showToast("Resume PDF downloaded");
        } catch (e) {
            console.error("Download failed", e);
            showToast("Failed to download resume", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleTailor = async () => {
        if (!resume) return;
        if (!application?.job_description?.trim()) {
            showToast("A job description is required for AI tailoring. Add one in the Job Context tab.", "error");
            return;
        }
        setTailoring(true);
        setShowTailorBar(false);
        try {
            const tailored = await ResumeService.tailorResume(resume.id);
            setResume(tailored);
            const newActive = tailored.versions?.find((v) => v.is_active);
            if (newActive) {
                setViewingVersionId(newActive.id);
                setDisplayYaml(newActive.yaml_content);
            }
            triggerPdfRefresh();
            showToast("Resume tailored successfully");
            setShowTailorBar(true); // Show the action bar after successful tailor
        } catch (e) {
            console.error(e);
            showToast("Failed to tailor resume", "error");
        } finally {
            setTailoring(false);
        }
    };

    const handleVersionSelect = (version: ResumeVersion) => {
        setViewingVersionId(version.id);
        setDisplayYaml(version.yaml_content);
        setShowTailorBar(false);
        triggerPdfRefresh();
    };

    const handleActivateVersion = async (versionId: string) => {
        if (!resume) return;
        const targetVersion = resume.versions?.find((v) => v.id === versionId);
        if (!targetVersion) return;

        const prevResume = resume;
        const prevViewingVersionId = viewingVersionId;
        const prevDisplayYaml = displayYaml;

        const optimisticVersions = (resume.versions ?? []).map((v) => ({
            ...v,
            is_active: v.id === versionId,
        }));
        setResume({ ...resume, versions: optimisticVersions, yaml_content: targetVersion.yaml_content, current_version: targetVersion.version_number });
        setViewingVersionId(versionId);
        setDisplayYaml(targetVersion.yaml_content);
        setShowTailorBar(false);
        triggerPdfRefresh();

        setActivatingVersion(true);
        try {
            const updated = await ResumeService.activateVersion(resume.id, versionId);
            setResume(updated);
            const newActive = updated.versions?.find((v) => v.is_active);
            if (newActive) {
                setViewingVersionId(newActive.id);
                setDisplayYaml(newActive.yaml_content);
            }
        } catch (e) {
            console.error(e);
            setResume(prevResume);
            setViewingVersionId(prevViewingVersionId);
            setDisplayYaml(prevDisplayYaml);
            showToast("Failed to activate version", "error");
        } finally {
            setActivatingVersion(false);
        }
    };

    const handleSaveAsNewVersion = async (summary: string) => {
        if (!resume) return;
        setSavingVersion(true);
        try {
            const updated = await ResumeService.saveAsNewVersion(resume.id, summary);
            setResume(updated);
            const newActive = updated.versions?.find((v) => v.is_active);
            if (newActive) {
                setViewingVersionId(newActive.id);
                setDisplayYaml(newActive.yaml_content);
            }
            showToast("Version saved");
        } catch (e) {
            console.error(e);
            showToast("Failed to save version", "error");
        } finally {
            setSavingVersion(false);
        }
    };

    const handleCreateResume = async () => {
        if (!application) return null;
        setLoading(true);
        try {
            const newResume = await ResumeService.create(application.id);
            setResume(newResume);
            const active = newResume.versions?.find((v) => v.is_active);
            if (active) {
                setViewingVersionId(active.id);
                setDisplayYaml(active.yaml_content);
            } else {
                setDisplayYaml(newResume.yaml_content);
            }
            return newResume;
        } catch (e) {
            console.error("Failed to create resume", e);
            showToast("Failed to create resume", "error");
            return null;
        } finally {
            setLoading(false);
        }
    };

    const handleSaveJd = async () => {
        if (!application) return;
        setSavingJd(true);
        try {
            await ApplicationService.update(application.id, { job_description: editedJd });
            setApplication({ ...application, job_description: editedJd });
            setIsEditingJd(false);
            showToast("Job description updated");
        } catch (e) {
            console.error(e);
            showToast("Failed to update job description", "error");
        } finally {
            setSavingJd(false);
        }
    };

    // Q&A handlers
    const handleAddQuestion = async () => {
        if (!newQuestionText.trim()) return;
        setAddingQuestion(true);
        try {
            const created = await QuestionsService.create({
                application_id: id,
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

    if (loading) {
        return (
            <CommandCenter>
                <div className="flex h-full items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            </CommandCenter>
        );
    }

    if (!application) {
        return (
            <CommandCenter>
                <div className="flex flex-col items-center justify-center space-y-4">
                    <h2 className="text-xl font-bold">Application not found</h2>
                    <Button onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
                </div>
            </CommandCenter>
        );
    }

    return (
        <CommandCenter>
            <div className="flex flex-col space-y-6 h-[calc(100vh-8rem)]">
                {/* Header Section */}
                <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">{application.role}</h1>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <span className="font-medium text-foreground">{application.company}</span>
                                <span>•</span>
                                <Badge variant="outline" className="uppercase text-xs">{application.status}</Badge>
                                {application.source_url && (
                                    <a
                                        href={application.source_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 hover:text-primary transition-colors"
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                        <span className="text-sm">Original Post</span>
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <SaveIndicator status={yamlSaveStatus} />
                        <Button
                            variant="secondary"
                            size="sm"
                            className="gap-2"
                            onClick={handleTailor}
                            disabled={tailoring || !resume}
                        >
                            {tailoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                            AI Tailor
                        </Button>
                        <Button
                            size="sm"
                            className="gap-2"
                            onClick={handleSave}
                            disabled={saving || !resume}
                            title="Save current resume as PDF"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Save PDF
                        </Button>
                    </div>
                </div>

                {/* Main Workspace */}
                <Tabs defaultValue="editor" className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-4">
                        <TabsList>
                            <TabsTrigger value="job" className="gap-2">
                                <Briefcase className="h-4 w-4" /> Job Context
                            </TabsTrigger>
                            <TabsTrigger value="editor" className="gap-2">
                                <FileText className="h-4 w-4" /> Resume Editor
                            </TabsTrigger>
                            <TabsTrigger value="qa" className="gap-2" onClick={loadQuestions}>
                                <HelpCircle className="h-4 w-4" /> Q&amp;A Assistant
                            </TabsTrigger>
                            <TabsTrigger value="interview" className="gap-2">
                                <MessageSquare className="h-4 w-4" /> Interview Prep
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 min-h-0 bg-background/50 rounded-lg border relative overflow-hidden">

                        {/* ─── Job Context Tab ─── */}
                        <TabsContent value="job" className="m-0 h-full p-0 flex flex-col">
                            <ScrollArea className="h-full">
                                <div className="p-6 max-w-4xl mx-auto space-y-6">
                                    {/* Job Description Editor */}
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between">
                                            <CardTitle>Job Description</CardTitle>
                                            {!isEditingJd ? (
                                                <Button variant="outline" size="sm" onClick={() => setIsEditingJd(true)}>
                                                    Edit
                                                </Button>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <SaveIndicator status={jdAutoSaveStatus} />
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setIsEditingJd(false);
                                                            setEditedJd(application.job_description || "");
                                                        }}
                                                        disabled={savingJd}
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button size="sm" onClick={handleSaveJd} disabled={savingJd}>
                                                        {savingJd ? <Loader2 className="h-4 w-4 animate-spin" /> : "Done"}
                                                    </Button>
                                                </div>
                                            )}
                                        </CardHeader>
                                        <CardContent>
                                            {isEditingJd ? (
                                                <Textarea
                                                    value={editedJd}
                                                    onChange={(e) => setEditedJd(e.target.value)}
                                                    className="min-h-[400px] font-mono text-sm"
                                                    placeholder="Paste job description here..."
                                                />
                                            ) : application.job_description ? (
                                                <div className="whitespace-pre-wrap text-sm text-foreground/80 leading-relaxed">
                                                    {application.job_description}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                                                    <Briefcase className="h-10 w-10 text-muted-foreground opacity-30" />
                                                    <div>
                                                        <p className="text-sm font-medium text-muted-foreground">No job description added yet</p>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            A job description is required to use AI tailoring.
                                                        </p>
                                                    </div>
                                                    <Button variant="outline" size="sm" onClick={() => setIsEditingJd(true)}>
                                                        Add Job Description
                                                    </Button>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        {/* ─── Resume Editor Tab ─── */}
                        <TabsContent value="editor" className="m-0 h-full p-0 flex flex-col overflow-hidden">
                            {resume ? (
                                <div className="flex flex-col h-full">
                                    <VersionBar
                                        versions={versions}
                                        viewingVersionId={viewingVersionId}
                                        onVersionSelect={handleVersionSelect}
                                        onActivateVersion={handleActivateVersion}
                                        onSaveNewVersion={handleSaveAsNewVersion}
                                        activating={activatingVersion}
                                        savingVersion={savingVersion}
                                    />

                                    {/* Floating tailor bar */}
                                    {showTailorBar && (
                                        <div className="flex items-center justify-between px-4 py-2.5 bg-green-500/10 border-b border-green-500/20 text-sm">
                                            <span className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
                                                <ThumbsUp className="h-4 w-4" />
                                                Resume tailored! Happy with this version?
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 text-xs gap-1 text-green-700 dark:text-green-400 hover:bg-green-500/10"
                                                    onClick={() => setShowTailorBar(false)}
                                                >
                                                    Keep
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs gap-1"
                                                    onClick={handleTailor}
                                                    disabled={tailoring}
                                                >
                                                    {tailoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                                                    Re-Tailor
                                                </Button>
                                                <button
                                                    onClick={() => setShowTailorBar(false)}
                                                    className="text-muted-foreground hover:text-foreground ml-1"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {!isViewingActive && viewingVersion && (
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs">
                                            <AlertTriangle className="h-3 w-3 shrink-0" />
                                            <span>Viewing v{viewingVersion.version_number} (read-only). Click &quot;Set Active&quot; to restore this version for editing.</span>
                                        </div>
                                    )}

                                    <div className="flex flex-1 min-h-0">
                                        <div className="w-1/2 h-full border-r border-border flex flex-col">
                                            {/* YAML editor toolbar */}
                                            <div className="flex items-center justify-between px-3 py-1.5 border-b bg-background/80">
                                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                                    YAML Editor
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <SaveIndicator status={yamlSaveStatus} />
                                                    <CopyButton
                                                        text={displayYaml}
                                                        label="Copy All YAML"
                                                        className="text-xs border border-border rounded px-2 py-0.5"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex-1 min-h-0">
                                                <ResumeEditor
                                                    value={displayYaml}
                                                    onChange={handleResumeChange}
                                                    readOnly={!isViewingActive}
                                                />
                                            </div>
                                            <TailorRulesPanel applicationId={application.id} />
                                        </div>

                                        <div className="w-1/2 h-full bg-zinc-100 dark:bg-zinc-900 flex flex-col">
                                            <div className="p-2 border-b bg-background flex justify-between items-center">
                                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-2">
                                                    Live Preview
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {pdfLoading && (
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Loader2 className="h-3 w-3 animate-spin" />
                                                            Rendering…
                                                        </span>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-xs gap-1"
                                                        onClick={triggerPdfRefresh}
                                                        title="Refresh preview"
                                                    >
                                                        <RefreshCw className="h-3 w-3" />
                                                        Refresh
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="flex-1 relative">
                                                <iframe
                                                    src={pdfSrc}
                                                    className="absolute inset-0 w-full h-full border-none"
                                                    title="Resume Preview"
                                                    onLoad={() => setPdfLoading(false)}
                                                    onError={() => setPdfLoading(false)}
                                                />
                                                {pdfLoading && (
                                                    <div className="absolute inset-0 bg-background/60 flex flex-col items-center justify-center z-10 pointer-events-none gap-3">
                                                        {/* Skeleton document */}
                                                        <div className="w-3/4 bg-white dark:bg-zinc-800 rounded shadow-lg p-6 space-y-3 animate-pulse">
                                                            <div className="h-4 w-1/2 mx-auto bg-zinc-200 dark:bg-zinc-600 rounded" />
                                                            <div className="h-2 w-1/3 mx-auto bg-zinc-200 dark:bg-zinc-600 rounded" />
                                                            <div className="border-t border-zinc-200 dark:border-zinc-600 my-3" />
                                                            {[100, 80, 90, 70, 85].map((w, i) => (
                                                                <div key={i} className="h-2 bg-zinc-200 dark:bg-zinc-600 rounded" style={{ width: `${w}%` }} />
                                                            ))}
                                                            <div className="border-t border-zinc-200 dark:border-zinc-600 my-3" />
                                                            {[100, 75, 88, 60].map((w, i) => (
                                                                <div key={i} className="h-2 bg-zinc-200 dark:bg-zinc-600 rounded" style={{ width: `${w}%` }} />
                                                            ))}
                                                        </div>
                                                        <span className="text-sm text-muted-foreground">Rendering PDF…</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full space-y-4 max-w-md mx-auto text-center p-6">
                                    <FileText className="w-12 h-12 text-muted-foreground" />
                                    <h3 className="text-lg font-medium">No resume created yet</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Create a copy of your Master Resume for this application.
                                        <br />The master file remains untouched.
                                    </p>
                                    <div className="flex flex-col gap-2 w-full">
                                        <Button onClick={handleCreateResume} className="w-full">
                                            Create from Master Resume
                                        </Button>
                                        {application.job_description && (
                                            <Button
                                                variant="secondary"
                                                onClick={async () => {
                                                    const newResume = await handleCreateResume();
                                                    if (newResume) {
                                                        setTailoring(true);
                                                        try {
                                                            const tailored = await ResumeService.tailorResume(newResume.id);
                                                            setResume(tailored);
                                                            const newActive = tailored.versions?.find((v) => v.is_active);
                                                            if (newActive) {
                                                                setViewingVersionId(newActive.id);
                                                                setDisplayYaml(newActive.yaml_content);
                                                            }
                                                            triggerPdfRefresh();
                                                            showToast("Resume created and tailored");
                                                            setShowTailorBar(true);
                                                        } catch (e) {
                                                            console.error(e);
                                                            showToast("Resume created but tailoring failed", "error");
                                                        } finally {
                                                            setTailoring(false);
                                                        }
                                                    }
                                                }}
                                                className="w-full"
                                            >
                                                <BrainCircuit className="w-4 h-4 mr-2" />
                                                Create &amp; Auto-Tailor
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* ─── Q&A Assistant Tab ─── */}
                        <TabsContent value="qa" className="m-0 h-full p-0 flex flex-col">
                            <ScrollArea className="h-full">
                                <div className="p-6 max-w-3xl mx-auto space-y-6">
                                    {/* Header */}
                                    <div>
                                        <h2 className="text-lg font-semibold mb-1">Q&amp;A Assistant</h2>
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
                                                    {addingQuestion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
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
                                                                    {/* Copy button in top-right corner */}
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
                                                                    {/* Primary actions */}
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

                                                                    {/* Refine buttons (only for AI-generated answers with content) */}
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
                        </TabsContent>

                        {/* ─── Interview Prep Tab ─── */}
                        <TabsContent value="interview" className="m-0 h-full p-0 flex flex-col bg-background/50">
                            <InterviewDashboard applicationId={application.id} />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>

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
        </CommandCenter>
    );
}
