"use client";

import { useEffect, useState, useCallback, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { CommandCenter } from "@/components/layout/CommandCenter";
import { ApplicationService } from "@/services/application.service";
import { ApplicationResponse, ApplicationStatus } from "@/types/application";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
    ArrowLeft, ExternalLink, Briefcase, FileText, Download, BrainCircuit,
    Loader2, MessageSquare, AlertTriangle, RefreshCw,
    HelpCircle, RotateCcw, ThumbsUp, X, ChevronDown, Check, Info,
    BookOpen, Star, Pencil, MoreHorizontal, Trash2
} from "lucide-react";
import { ResumeTemplateService } from "@/services/resume-template.service";
import { DeleteApplicationModal } from "@/components/applications/DeleteApplicationModal";
import type { ResumeTemplate } from "@/types/resume-template";
import { cn, getContrastColor } from "@/lib/utils";
import { StatusBadge } from "@/components/applications/StatusBadge";
import { ResumeService } from "@/services/resume.service";
import { Resume, ResumeVersion } from "@/types/resume";
import { ResumeEditor } from "@/components/resume/ResumeEditor";
import { InterviewDashboard } from "@/components/interview/InterviewDashboard";
import { VersionBar } from "@/components/resume/VersionBar";
import { TailorRulesPanel } from "@/components/resume/TailorRulesPanel";
import { CopyButton } from "@/components/shared/CopyButton";
import { SaveIndicator } from "@/components/shared/SaveIndicator";
import type { SaveStatus } from "@/components/shared/SaveIndicator";
import { useAutosave } from "@/hooks/useAutosave";
import { QAAssistant } from "@/components/qa/QAAssistant";
import { CredentialCard } from "@/components/credentials/CredentialCard";
import { AgentProgressModal, type AgentEvent } from "@/components/resume/AgentProgressModal";
import { SettingsService } from "@/services/settings.service";
import { SavePdfButton } from "@/components/ui/SavePdfButton";
import { AiTailorButton } from "@/components/ui/AiTailorButton";
import { ColorPicker } from "@/components/shared/ColorPicker";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8921/api/v1";

interface PageProps {
    params: Promise<{ id: string }>;
}

interface Toast {
    id: string;
    message: string;
    variant: "default" | "error";
}

export default function ApplicationWorkspacePage({ params }: PageProps) {
    const { id } = use(params);
    const router = useRouter();
    const [application, setApplication] = useState<ApplicationResponse | null>(null);
    const [resume, setResume] = useState<Resume | null>(null);
    const [loading, setLoading] = useState(true);
    const [tailoring, setTailoring] = useState(false);
    const [agentModalOpen, setAgentModalOpen] = useState(false);
    const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
    const [agentModel, setAgentModel] = useState("");
    const [agentComplete, setAgentComplete] = useState(false);
    const [agentPersisted, setAgentPersisted] = useState(false);
    const [agentError, setAgentError] = useState(false);
    const [activeTab, setActiveTab] = useState("editor");
    const abortControllerRef = useRef<AbortController | null>(null);
    // Stores the last persisted resume from the agentic SSE stream so onCheckResume
    // can re-apply it reliably even if the SSE state updates raced with the click.
    const lastTailoredResumeRef = useRef<Resume | null>(null);
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

    // Status management state
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);
    const [showAppliedConfirm, setShowAppliedConfirm] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<string | null>(null);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const statusDropdownRef = useRef<HTMLDivElement>(null);

    // Template selector state
    const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
    const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
    const [switchingTemplate, setSwitchingTemplate] = useState(false);
    const templateDropdownRef = useRef<HTMLDivElement>(null);
    const [showTemplateSwitchConfirm, setShowTemplateSwitchConfirm] = useState(false);
    const [pendingTemplateSwitch, setPendingTemplateSwitch] = useState<ResumeTemplate | null>(null);

    // Save as template (from tailor bar) state
    const [tailoredYaml, setTailoredYaml] = useState<string | null>(null);
    const [showSaveAsTemplateDialog, setShowSaveAsTemplateDialog] = useState(false);
    const [saveAsTemplateName, setSaveAsTemplateName] = useState("");
    const [savingAsTemplate, setSavingAsTemplate] = useState(false);

    // Frozen resume edit mode state
    const [frozenEditMode, setFrozenEditMode] = useState(false);
    const [showSaveFrozenDialog, setShowSaveFrozenDialog] = useState(false);
    const [frozenSaveName, setFrozenSaveName] = useState("");
    const [savingFrozen, setSavingFrozen] = useState(false);

    // Overwrite PDF confirmation state
    const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
    const [overwriteFilePath, setOverwriteFilePath] = useState("");
    const [pendingOverwriteArgs, setPendingOverwriteArgs] = useState<{ company: string; filename: string } | null>(null);

    // Rename (role / company) state
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editRole, setEditRole] = useState("");
    const [editCompany, setEditCompany] = useState("");
    const [savingTitle, setSavingTitle] = useState(false);

    // Colour picker state
    const [colorPickerOpen, setColorPickerOpen] = useState(false);
    const colorPickerRef = useRef<HTMLDivElement>(null);
    const nativeColorPickerActive = useRef(false);

    // Edit dropdown & delete modal state
    const [editDropdownOpen, setEditDropdownOpen] = useState(false);
    const editDropdownRef = useRef<HTMLDivElement>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (editDropdownRef.current && !editDropdownRef.current.contains(e.target as Node)) {
                setEditDropdownOpen(false);
            }
        };
        if (editDropdownOpen) document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [editDropdownOpen]);

    const handleDeleteConfirm = async () => {
        if (!application) return;
        const result = await ApplicationService.delete(application.id);
        setDeleteModalOpen(false);
        if (result.saved_template_name) {
            showToast(`Application deleted. Tailored resume saved as "${result.saved_template_name}" in Resume Templates.`);
        }
        // Navigate back after a brief moment so the toast is visible
        setTimeout(() => router.push("/dashboard"), 800);
    };

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

    // Close status dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
                setShowStatusDropdown(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Close template dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (templateDropdownRef.current && !templateDropdownRef.current.contains(e.target as Node)) {
                setShowTemplateDropdown(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Close colour picker on outside click
    useEffect(() => {
        if (!colorPickerOpen) return;
        const handler = (e: MouseEvent) => {
            // Suppress while the native OS color dialog is open — Chrome fires
            // mousedown on underlying DOM elements while the user drags the picker
            if (nativeColorPickerActive.current) return;
            if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
                setColorPickerOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [colorPickerOpen]);

    const handleColorChange = useCallback(async (color: string) => {
        if (!application) return;
        setColorPickerOpen(false);
        // Optimistic update
        setApplication((prev) => prev ? { ...prev, color } : prev);
        try {
            const updated = await ApplicationService.updateColor(application.id, color);
            setApplication(updated);
        } catch (e) {
            console.error(e);
            showToast("Failed to update colour", "error");
        }
    }, [application, showToast]);

    const doStatusUpdate = useCallback(async (status: string) => {
        if (!application) return;
        setUpdatingStatus(true);
        try {
            const updated = await ApplicationService.updateStatus(application.id, status);
            setApplication(updated);
            showToast(`Status updated to ${status}`);
        } catch (e) {
            console.error(e);
            showToast("Failed to update status", "error");
        } finally {
            setUpdatingStatus(false);
        }
    }, [application, showToast]);

    const handleStatusChange = (newStatus: string) => {
        setShowStatusDropdown(false);
        if (newStatus === ApplicationStatus.APPLIED && application?.status !== ApplicationStatus.APPLIED) {
            setPendingStatus(newStatus);
            setShowAppliedConfirm(true);
            return;
        }
        doStatusUpdate(newStatus);
    };

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

    useEffect(() => {
        const loadData = async () => {
            try {
                const appData = await ApplicationService.getById(id);
                setApplication(appData);
                setEditedJd(appData.job_description || "");

                try {
                    const tmplData = await ResumeTemplateService.getAll();
                    setTemplates(tmplData);
                } catch (e) {
                    console.log("Could not load templates", e);
                }

                let loadedResume = null;
                try {
                    const resumeData = await ResumeService.getByApplicationId(id);
                    loadedResume = resumeData;
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

                // If no resume exists yet but the application has a linked template,
                // auto-create the resume from that template so the user lands directly
                // in the editor rather than seeing the "No resume created yet" screen.
                if (!loadedResume && appData.resume_template_id) {
                    try {
                        const autoResume = await ResumeService.create(id);
                        setResume(autoResume);
                        const active = autoResume.versions?.find((v) => v.is_active);
                        if (active) {
                            setViewingVersionId(active.id);
                            setDisplayYaml(active.yaml_content);
                            setPreviewHash(new Date(autoResume.updated_at).getTime());
                        } else {
                            setDisplayYaml(autoResume.yaml_content);
                            setPreviewHash(new Date(autoResume.updated_at).getTime());
                        }
                    } catch (autoErr) {
                        console.log("Could not auto-create resume from template", autoErr);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch application", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [id, router]);

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

    const _triggerBrowserDownload = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleSave = async () => {
        if (!resume || !application) return;
        setSaving(true);
        try {
            if (isViewingActive && displayYaml && displayYaml !== resume.yaml_content) {
                const updated = await ResumeService.updateYaml(resume.id, displayYaml);
                setResume(updated);
            }
            const company = (application.company || "company").replace(/[^a-z0-9]/gi, "_").toLowerCase();
            const role = (application.role || "resume").replace(/[^a-z0-9]/gi, "_").toLowerCase();
            const filename = `${company}_${role}_resume.pdf`;
            const companyName = application.company || "Unknown";
            try {
                const result = await ResumeService.savePdf(resume.id, companyName, filename, false);
                triggerPdfRefresh();
                if (result.mode === "folder") {
                    showToast(`PDF saved to ${result.savedTo}`);
                } else {
                    _triggerBrowserDownload(result.blob, result.filename);
                    showToast("PDF downloaded successfully");
                }
            } catch (err: any) {
                if (err?.response?.status === 409) {
                    // Only possible in folder-save mode
                    const blobText = await (err.response.data as Blob)?.text?.();
                    let path = "";
                    try { path = JSON.parse(blobText ?? "")?.detail?.path ?? ""; } catch { /* ignore */ }
                    setOverwriteFilePath(path);
                    setPendingOverwriteArgs({ company: companyName, filename });
                    setShowOverwriteDialog(true);
                    return;
                }
                throw err;
            }
        } catch (e) {
            console.error("Save PDF failed", e);
            showToast("Failed to save resume PDF", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleOverwriteConfirm = async () => {
        if (!resume || !pendingOverwriteArgs) return;
        setShowOverwriteDialog(false);
        setSaving(true);
        try {
            const result = await ResumeService.savePdf(
                resume.id,
                pendingOverwriteArgs.company,
                pendingOverwriteArgs.filename,
                true,
            );
            triggerPdfRefresh();
            if (result.mode === "folder") {
                showToast(`PDF saved to ${result.savedTo}`);
            } else {
                _triggerBrowserDownload(result.blob, result.filename);
                showToast("PDF downloaded successfully");
            }
        } catch (e) {
            console.error("Save PDF failed", e);
            showToast("Failed to save resume PDF", "error");
        } finally {
            setSaving(false);
            setPendingOverwriteArgs(null);
        }
    };

    const handleTailor = async () => {
        if (!resume) return;
        if (!application?.job_description) {
            showToast("A job description is required for AI tailoring. Add one in the Job Context tab.", "error");
            return;
        }

        // Check tailoring mode from settings
        let tailorMode = "agentic";
        try {
            const s = await SettingsService.get();
            tailorMode = (s as typeof s & { tailor_mode?: string }).tailor_mode || "agentic";
        } catch {
            // default to agentic
        }

        if (tailorMode === "standard") {
            // Original single-call flow
            setTailoring(true);
            try {
                const tailored = await ResumeService.tailorResume(resume.id);
                setResume(tailored);
                const newActive = tailored.versions?.find((v) => v.is_active);
                if (newActive) {
                    setViewingVersionId(newActive.id);
                    setDisplayYaml(newActive.yaml_content);
                    triggerPdfRefresh();
                }
                showToast("Resume tailored successfully");
                setShowTailorBar(true);
            } catch {
                showToast("Failed to tailor resume", "error");
            } finally {
                setTailoring(false);
            }
            return;
        }

        // Agentic SSE flow
        setAgentEvents([]);
        setAgentComplete(false);
        setAgentPersisted(false);
        setAgentError(false);
        setAgentModel("");
        setAgentModalOpen(true);
        setTailoring(true);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8921/api/v1";
            const response = await fetch(`${apiBase}/resumes/${resume.id}/tailor/stream`, {
                method: "POST",
                signal: controller.signal,
            });

            if (!response.ok) {
                const err = await response.text();
                setAgentEvents((prev) => [...prev, { type: "error", message: err.slice(0, 300) }]);
                setAgentError(true);
                setTailoring(false);
                return;
            }

            const reader = response.body?.getReader();
            if (!reader) {
                setAgentError(true);
                setTailoring(false);
                return;
            }

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    try {
                        const event: AgentEvent = JSON.parse(line.slice(6));
                        setAgentEvents((prev) => [...prev, event]);

                        if (event.type === "start") {
                            setAgentModel(event.model);
                        } else if (event.type === "complete") {
                            setAgentComplete(true);
                        } else if (event.type === "persisted") {
                            // Update resume state with the newly saved version
                            const updatedResume = (event as { type: "persisted"; resume: Resume }).resume;
                            // Store in ref so onCheckResume can re-apply it reliably
                            lastTailoredResumeRef.current = updatedResume;
                            setResume(updatedResume);
                            const newActive = updatedResume.versions?.find((v: ResumeVersion) => v.is_active);
                            if (newActive) {
                                setViewingVersionId(newActive.id);
                                setDisplayYaml(newActive.yaml_content);
                                triggerPdfRefresh();
                            }
                            setAgentPersisted(true);
                            setShowTailorBar(true);
                        } else if (event.type === "error") {
                            setAgentError(true);
                        }
                    } catch {
                        // ignore parse errors
                    }
                }
            }
        } catch (err: unknown) {
            if (err instanceof Error && err.name !== "AbortError") {
                setAgentEvents((prev) => [...prev, { type: "error", message: err.message }]);
                setAgentError(true);
            }
        } finally {
            setTailoring(false);
            abortControllerRef.current = null;
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

    const handleTemplateSwitch = (template: ResumeTemplate) => {
        setShowTemplateDropdown(false);
        if (!application) return;

        const isDraft = application.status === ApplicationStatus.DRAFT;
        if (!isDraft) {
            showToast("Resume template can only be switched for draft applications", "error");
            return;
        }

        // Show confirmation dialog — switching will auto-preserve current content first
        setPendingTemplateSwitch(template);
        setShowTemplateSwitchConfirm(true);
    };

    const handleTemplateSwitchConfirm = async () => {
        if (!pendingTemplateSwitch || !application || !resume) return;
        // Close dialog immediately; loading indicator shows on the toolbar button
        setShowTemplateSwitchConfirm(false);
        const template = pendingTemplateSwitch;
        setPendingTemplateSwitch(null);

        setSwitchingTemplate(true);
        try {
            // Step 1: Snapshot current content as a new inactive version so it is
            // always recoverable from version history (preserves AI-tailored work etc.)
            await ResumeService.saveAsNewVersion(
                resume.id,
                `Auto-saved before switching to "${template.name}"`
            );

            // Step 2: Overwrite the newly-active version's content with the template YAML.
            // This also deletes the stale PDF so the next preview re-renders fresh.
            const updatedResume = await ResumeService.updateYaml(resume.id, template.yaml_content);

            // Step 3: Record the new template link on the application
            const updatedApp = await ApplicationService.updateResumeTemplate(application.id, template.id);

            // Sync frontend state
            const newActive = updatedResume.versions?.find((v) => v.is_active);
            setResume(updatedResume);
            if (newActive) {
                setViewingVersionId(newActive.id);
                setDisplayYaml(newActive.yaml_content);
                // Match debouncedValue to prevent the debounce timer from auto-saving stale content
                setDebouncedValue(newActive.yaml_content);
            }
            setApplication(updatedApp);
            setShowTailorBar(false);
            triggerPdfRefresh();
            showToast(`Switched to "${template.name}" — previous resume preserved in version history`);
        } catch (e) {
            console.error(e);
            showToast("Failed to switch template", "error");
        } finally {
            setSwitchingTemplate(false);
        }
    };

    const openSaveAsTemplateDialog = () => {
        const suggestion = [application?.role, application?.company]
            .filter(Boolean)
            .join(" - ");
        setSaveAsTemplateName(suggestion || "");
        setShowSaveAsTemplateDialog(true);
    };

    const handleSaveAsTemplate = async () => {
        if (!saveAsTemplateName.trim() || !tailoredYaml || !application) return;
        if (saveAsTemplateName.trim().toLowerCase() === "master") {
            showToast("Cannot use 'Master' as a template name", "error");
            return;
        }
        setSavingAsTemplate(true);
        try {
            const newTemplate = await ResumeTemplateService.create({
                name: saveAsTemplateName.trim(),
                yaml_content: tailoredYaml
            });
            const updatedApp = await ApplicationService.updateResumeTemplate(application.id, newTemplate.id);
            setApplication(updatedApp);
            setTemplates(prev => [...prev, newTemplate]);
            setShowSaveAsTemplateDialog(false);
            setShowTailorBar(false);
            setTailoredYaml(null);
            showToast(`Resume saved as "${newTemplate.name}"`);
        } catch (e: unknown) {
            console.error(e);
            const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to save resume";
            showToast(msg, "error");
        } finally {
            setSavingAsTemplate(false);
        }
    };

    const handleSaveFrozenEdit = async () => {
        if (!frozenSaveName.trim() || !application) return;
        if (frozenSaveName.trim().toLowerCase() === "master") {
            showToast("Cannot use 'Master' as a name", "error");
            return;
        }
        setSavingFrozen(true);
        try {
            const newTemplate = await ResumeTemplateService.create({
                name: frozenSaveName.trim(),
                yaml_content: displayYaml
            });
            setTemplates(prev => [...prev, newTemplate]);
            setShowSaveFrozenDialog(false);
            setFrozenEditMode(false);
            setDisplayYaml(application.resume_snapshot_yaml!);
            showToast(`Saved as "${newTemplate.name}" — snapshot unchanged`);
        } catch (e: unknown) {
            console.error(e);
            const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to save";
            showToast(msg, "error");
        } finally {
            setSavingFrozen(false);
        }
    };

    const handleSaveTitle = async () => {
        if (!application) return;
        const trimmedRole = editRole.trim();
        const trimmedCompany = editCompany.trim();
        if (!trimmedRole || !trimmedCompany) {
            showToast("Role and company cannot be empty", "error");
            return;
        }
        if (trimmedRole === application.role && trimmedCompany === application.company) {
            setIsEditingTitle(false);
            return;
        }
        setSavingTitle(true);
        try {
            const updated = await ApplicationService.update(application.id, {
                role: trimmedRole,
                company: trimmedCompany,
            });
            setApplication(updated);
            setIsEditingTitle(false);
            showToast("Application updated");
        } catch {
            showToast("Failed to update application", "error");
        } finally {
            setSavingTitle(false);
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
        <CommandCenter fullHeight>
            <div className="relative flex flex-col space-y-6 h-full">
                {/* 3px company accent bar — spans full main width by breaking out of padding */}
                <div
                    className="absolute -top-6 md:-top-8 -left-6 md:-left-8 -right-6 md:-right-8 h-[3px] pointer-events-none z-10 transition-colors duration-500"
                    style={{ backgroundColor: application.color || 'transparent' }}
                />

                {/* Header Section */}
                <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            {isEditingTitle ? (
                                <div className="flex flex-col gap-1.5">
                                    <input
                                        autoFocus
                                        value={editRole}
                                        onChange={(e) => setEditRole(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleSaveTitle();
                                            if (e.key === "Escape") setIsEditingTitle(false);
                                        }}
                                        className="text-2xl font-bold tracking-tight bg-transparent border-b border-primary focus:outline-none w-full"
                                        placeholder="Job title"
                                        disabled={savingTitle}
                                    />
                                    <div className="flex items-center gap-2">
                                        <input
                                            value={editCompany}
                                            onChange={(e) => setEditCompany(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleSaveTitle();
                                                if (e.key === "Escape") setIsEditingTitle(false);
                                            }}
                                            className="text-sm font-medium bg-transparent border-b border-primary/50 focus:outline-none focus:border-primary"
                                            placeholder="Company"
                                            disabled={savingTitle}
                                        />
                                        <button
                                            onClick={handleSaveTitle}
                                            disabled={savingTitle}
                                            className="text-xs px-2 py-0.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                        >
                                            {savingTitle ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                                        </button>
                                        <button
                                            onClick={() => setIsEditingTitle(false)}
                                            disabled={savingTitle}
                                            className="text-xs px-2 py-0.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="group/title">
                                    <div className="flex items-center gap-1.5">
                                        <h1 className="text-2xl font-bold tracking-tight">{application.role}</h1>
                                        <div
                                            className="relative opacity-0 group-hover/title:opacity-100 transition-opacity"
                                            ref={editDropdownRef}
                                        >
                                            <button
                                                onClick={() => setEditDropdownOpen((v) => !v)}
                                                title="Edit application"
                                                className="p-1 rounded hover:bg-muted"
                                            >
                                                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                                            </button>
                                            {editDropdownOpen && (
                                                <div className="absolute left-0 top-full mt-1 z-30 w-44 rounded-lg border border-border bg-card shadow-lg py-1">
                                                    <button
                                                        onClick={() => {
                                                            setEditDropdownOpen(false);
                                                            setEditRole(application.role);
                                                            setEditCompany(application.company);
                                                            setIsEditingTitle(true);
                                                        }}
                                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                                                    >
                                                        <Pencil size={13} />
                                                        Edit Details
                                                    </button>
                                                    <div className="my-1 border-t border-border" />
                                                    <button
                                                        onClick={() => {
                                                            setEditDropdownOpen(false);
                                                            setDeleteModalOpen(true);
                                                        }}
                                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                                                    >
                                                        <Trash2 size={13} />
                                                        Delete Application
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        {/* Coloured avatar — click to change colour */}
                                        <div className="relative" ref={colorPickerRef}>
                                            <button
                                                type="button"
                                                title="Change application colour"
                                                onClick={() => setColorPickerOpen(v => !v)}
                                                className="flex items-center justify-center size-6 rounded-md text-xs font-bold shadow-sm hover:opacity-80 transition-opacity flex-shrink-0"
                                                style={{
                                                    backgroundColor: application.color || "#64748b",
                                                    color: getContrastColor(application.color || "#64748b"),
                                                }}
                                            >
                                                {application.company.charAt(0).toUpperCase()}
                                            </button>
                                            {colorPickerOpen && (
                                                <div className="absolute top-full left-0 mt-1.5 z-50">
                                                    <ColorPicker
                                                        value={application.color}
                                                        onChange={handleColorChange}
                                                        onNativePickerActiveChange={(active) => {
                                                            nativeColorPickerActive.current = active;
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <span className="font-medium text-foreground">{application.company}</span>
                                        <span>•</span>
                                {/* Clickable status selector */}
                                <div className="relative" ref={statusDropdownRef}>
                                    <button
                                        onClick={() => setShowStatusDropdown((v) => !v)}
                                        className="flex items-center gap-1.5 text-sm rounded-md px-2 py-1 hover:bg-muted transition-colors"
                                        aria-label="Change application status"
                                        disabled={updatingStatus}
                                    >
                                        <StatusBadge status={application.status as ApplicationStatus} />
                                        {updatingStatus
                                            ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                            : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                        }
                                    </button>
                                    {showStatusDropdown && (
                                        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
                                            {Object.values(ApplicationStatus).map((status) => (
                                                <button
                                                    key={status}
                                                    onClick={() => handleStatusChange(status)}
                                                    className={cn(
                                                        "w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2",
                                                        status === application.status && "bg-muted/50"
                                                    )}
                                                >
                                                    <StatusBadge status={status} />
                                                    {status === application.status && (
                                                        <Check className="h-3 w-3 ml-auto text-primary" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
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
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <SaveIndicator status={yamlSaveStatus} />
                        <AiTailorButton
                            onClick={handleTailor}
                            disabled={tailoring || !resume}
                            tailoring={tailoring}
                            accentColor={application.color || undefined}
                        />
                        <SavePdfButton
                            onClick={handleSave}
                            disabled={saving || !resume}
                            saving={saving}
                            accentColor={application.color || undefined}
                        />
                    </div>
                </div>

                {/* Main Workspace */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-4">
                        <TabsList>
                            {([
                                { value: "job", icon: Briefcase, label: "Job Context" },
                                { value: "editor", icon: FileText, label: "Resume Editor" },
                                { value: "qa", icon: HelpCircle, label: "Q & A" },
                                { value: "interview", icon: MessageSquare, label: "Interview Prep" },
                            ] as const).map(({ value, icon: Icon, label }) => (
                                <div key={value} className="relative">
                                    <TabsTrigger value={value} className="gap-2">
                                        <Icon className="h-4 w-4" /> {label}
                                    </TabsTrigger>
                                    {activeTab === value && application.color && (
                                        <div
                                            className="absolute bottom-0.5 left-1.5 right-1.5 h-[2px] rounded-full pointer-events-none"
                                            style={{ backgroundColor: application.color }}
                                        />
                                    )}
                                </div>
                            ))}
                        </TabsList>
                    </div>

                    <div className="flex-1 min-h-0 bg-background/50 rounded-lg border relative overflow-hidden">

                        {/* ─── Job Context Tab ─── */}
                        <TabsContent value="job" className="m-0 h-full p-0 flex flex-col">
                            <ScrollArea className="h-full">
                                <div className="p-6">
                                    <div className="flex flex-col lg:flex-row gap-6">
                                        {/* Left column - Job Description */}
                                        <div className="flex-1 min-w-0">
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
                                        {/* Right column - Credentials */}
                                        <div className="w-full lg:w-[38%]">
                                            <CredentialCard applicationId={application.id} />
                                        </div>
                                    </div>
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

                                    {/* Enhanced frozen resume banner */}
                                    {application?.status !== ApplicationStatus.DRAFT && application?.resume_snapshot_yaml && (
                                        <div className={cn(
                                            "flex items-center justify-between px-3 py-1.5 border-b text-xs",
                                            frozenEditMode
                                                ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400"
                                                : "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400"
                                        )}>
                                            <span className="flex items-center gap-2">
                                                <Info className="h-3 w-3 shrink-0" />
                                                {frozenEditMode
                                                    ? "Edit mode — click \"Save as Resume\" to keep your changes (snapshot is unchanged)"
                                                    : "Resume snapshot — saved when you applied. Read-only to preserve your record."
                                                }
                                            </span>
                                            <div className="flex items-center gap-2 ml-2 shrink-0">
                                                {frozenEditMode ? (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-6 text-xs px-2"
                                                            onClick={() => {
                                                                setFrozenEditMode(false);
                                                                setDisplayYaml(application.resume_snapshot_yaml!);
                                                            }}
                                                        >
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 text-xs px-2"
                                                            onClick={() => {
                                                                const suggestion = [application?.role, application?.company].filter(Boolean).join(" - ");
                                                                setFrozenSaveName(suggestion || "");
                                                                setShowSaveFrozenDialog(true);
                                                            }}
                                                        >
                                                            Save as Resume
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <button
                                                        className="underline underline-offset-2 hover:opacity-80 transition-opacity"
                                                        onClick={() => setFrozenEditMode(true)}
                                                    >
                                                        Edit a copy
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

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
                                                    variant="outline"
                                                    className="h-7 text-xs gap-1 border-green-500/30 text-green-700 dark:text-green-400 hover:bg-green-500/10"
                                                    onClick={openSaveAsTemplateDialog}
                                                >
                                                    <FileText className="h-3 w-3" />
                                                    Save as Resume
                                                </Button>
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
                                                {/* Template selector */}
                                                <div className="relative flex items-center gap-2" ref={templateDropdownRef}>
                                                    <button
                                                        onClick={() => application?.status === ApplicationStatus.DRAFT && setShowTemplateDropdown(v => !v)}
                                                        disabled={switchingTemplate || application?.status !== ApplicationStatus.DRAFT}
                                                        className={cn(
                                                            "flex items-center gap-1.5 text-xs rounded px-2 py-1 transition-colors max-w-[200px]",
                                                            application?.status === ApplicationStatus.DRAFT
                                                                ? "hover:bg-muted cursor-pointer text-muted-foreground hover:text-foreground"
                                                                : "cursor-default text-muted-foreground"
                                                        )}
                                                        aria-label="Switch base template"
                                                        title={application?.status !== ApplicationStatus.DRAFT ? "Template can only be switched for draft applications" : "Switch base template — loads a saved template into the editor. Your current resume is preserved in version history."}
                                                    >
                                                        <BookOpen className="h-3 w-3 shrink-0" />
                                                        <span className="truncate font-medium">
                                                            {templates.find(t => t.id === application?.resume_template_id)?.name ?? "Master"}
                                                        </span>
                                                        {switchingTemplate
                                                            ? <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                                                            : application?.status === ApplicationStatus.DRAFT && <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                                                        }
                                                    </button>

                                                    {showTemplateDropdown && (
                                                        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 w-56 max-h-64 overflow-y-auto">
                                                            {templates.length === 0 ? (
                                                                <div className="px-3 py-2 text-xs text-muted-foreground">No templates found</div>
                                                            ) : (
                                                                templates.map(t => (
                                                                    <button
                                                                        key={t.id}
                                                                        onClick={() => handleTemplateSwitch(t)}
                                                                        className={cn(
                                                                            "w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2",
                                                                            t.id === application?.resume_template_id && "bg-muted/50"
                                                                        )}
                                                                    >
                                                                        <BookOpen className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-1">
                                                                                <span className="truncate font-medium">{t.name}</span>
                                                                                {t.is_starred && <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400 shrink-0" />}
                                                                                {t.is_master && <span className="text-[10px] bg-primary/10 text-primary rounded px-1">Master</span>}
                                                                            </div>
                                                                        </div>
                                                                        {t.id === application?.resume_template_id && <Check className="h-3 w-3 ml-auto text-primary shrink-0" />}
                                                                    </button>
                                                                ))
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
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
                                                    readOnly={!isViewingActive || (application?.status !== ApplicationStatus.DRAFT && !frozenEditMode && !!application?.resume_snapshot_yaml)}
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
                            <QAAssistant applicationId={application.id} />
                        </TabsContent>

                        {/* ─── Interview Prep Tab ─── */}
                        <TabsContent value="interview" className="m-0 h-full p-0 flex flex-col bg-background/50">
                            <InterviewDashboard applicationId={application.id} />
                        </TabsContent>
                    </div>
                </Tabs>
            </div>

            {/* Save as Template Dialog (from tailor bar) */}
            {showSaveAsTemplateDialog && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold">Save Tailored Resume</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Give this tailored resume a name. It will be saved to your Resumes library and linked to this application.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Resume name</label>
                            <input
                                type="text"
                                value={saveAsTemplateName}
                                onChange={e => setSaveAsTemplateName(e.target.value)}
                                placeholder="e.g. Software Engineer - Google"
                                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                autoFocus
                                onKeyDown={e => { if (e.key === "Enter") handleSaveAsTemplate(); }}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setShowSaveAsTemplateDialog(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveAsTemplate}
                                disabled={savingAsTemplate || !saveAsTemplateName.trim()}
                            >
                                {savingAsTemplate ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Save Resume
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Save Frozen Edit Dialog */}
            {showSaveFrozenDialog && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold">Save as New Resume</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                This will save your edits as a new resume in your library. The original snapshot for this application remains unchanged.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Resume name</label>
                            <input
                                type="text"
                                value={frozenSaveName}
                                onChange={e => setFrozenSaveName(e.target.value)}
                                placeholder="e.g. Software Engineer - Google (revised)"
                                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                autoFocus
                                onKeyDown={e => { if (e.key === "Enter") handleSaveFrozenEdit(); }}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setShowSaveFrozenDialog(false)}>Cancel</Button>
                            <Button
                                onClick={handleSaveFrozenEdit}
                                disabled={savingFrozen || !frozenSaveName.trim()}
                            >
                                {savingFrozen ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Save Resume
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Overwrite PDF Dialog */}
            {showOverwriteDialog && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold">File Already Exists</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                A PDF already exists at this location. Do you want to overwrite it?
                            </p>
                            {overwriteFilePath && (
                                <p className="text-xs font-mono text-muted-foreground mt-2 break-all bg-muted px-2 py-1.5 rounded-md">
                                    {overwriteFilePath}
                                </p>
                            )}
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setShowOverwriteDialog(false);
                                    setPendingOverwriteArgs(null);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleOverwriteConfirm}
                                style={application?.color ? {
                                    backgroundColor: application.color,
                                    color: getContrastColor(application.color),
                                    borderColor: application.color,
                                } : undefined}
                            >
                                Overwrite
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Template Switch Confirmation Dialog */}
            {showTemplateSwitchConfirm && pendingTemplateSwitch && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold">Switch Base Template?</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                This will load <span className="font-medium text-foreground">&quot;{pendingTemplateSwitch.name}&quot;</span> into the editor.
                                Your current resume content will be automatically saved as a version first, so you can always restore it from version history.
                            </p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setShowTemplateSwitchConfirm(false);
                                    setPendingTemplateSwitch(null);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleTemplateSwitchConfirm}>
                                Switch Template
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Applied Confirmation Dialog */}
            {showAppliedConfirm && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
                        <div>
                            <h3 className="text-lg font-semibold">Mark as Applied?</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Your current resume will be saved as a snapshot for this application. This records your resume at the time you applied.
                            </p>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setShowAppliedConfirm(false);
                                    setPendingStatus(null);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={async () => {
                                    setShowAppliedConfirm(false);
                                    if (pendingStatus) await doStatusUpdate(pendingStatus);
                                    setPendingStatus(null);
                                }}
                                disabled={updatingStatus}
                            >
                                {updatingStatus ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Mark as Applied
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {application && (
                <DeleteApplicationModal
                    open={deleteModalOpen}
                    onClose={() => setDeleteModalOpen(false)}
                    onConfirm={handleDeleteConfirm}
                    application={application}
                />
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

            {/* Agent Progress Modal */}
            <AgentProgressModal
                open={agentModalOpen}
                events={agentEvents}
                model={agentModel}
                onClose={() => {
                    if (!agentComplete && abortControllerRef.current) {
                        abortControllerRef.current.abort();
                    }
                    setAgentModalOpen(false);
                }}
                onCheckResume={() => {
                    // Re-apply persisted resume state from the ref to guarantee the editor
                    // and version bar reflect the tailored result even if React batching
                    // didn't fully commit the SSE state updates before the click.
                    const stored = lastTailoredResumeRef.current;
                    if (stored) {
                        const newActive = stored.versions?.find((v) => v.is_active);
                        setResume(stored);
                        if (newActive) {
                            setViewingVersionId(newActive.id);
                            setDisplayYaml(newActive.yaml_content);
                        }
                        lastTailoredResumeRef.current = null;
                    }
                    setAgentModalOpen(false);
                    setActiveTab("editor");
                    triggerPdfRefresh();
                }}
                isComplete={agentComplete}
                isPersisted={agentPersisted}
                hasError={agentError}
            />
        </CommandCenter>
    );
}
