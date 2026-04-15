"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { SetupService, SetupStatus } from "@/services/setup.service";
import { SettingsService } from "@/services/settings.service";
import { contextFilesService } from "@/services/contextFiles.service";
import { GenerateWithAiTab } from "@/components/setup/GenerateWithAiTab";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
    CheckCircle2,
    AlertCircle,
    Loader2,
    Upload,
    FileText,
    CloudUpload,
    ChevronRight,
    ChevronLeft,
    LayoutDashboard,
    Sparkles,
    Mic2,
    Brain,
    ClipboardList,
    KeyRound,
    Eye,
    EyeOff,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type StepId = "welcome" | "master-resume" | "context-files" | "api-key" | "done";

interface StepDef {
    id: StepId;
    label: string;
    icon: React.ElementType;
}

const ALL_STEPS: StepDef[] = [
    { id: "welcome",       label: "Welcome",        icon: Sparkles },
    { id: "api-key",       label: "AI Connection",  icon: KeyRound },
    { id: "master-resume", label: "Master Resume",  icon: FileText },
    { id: "context-files", label: "Context Files",  icon: Brain },
    { id: "done",          label: "All Set",         icon: CheckCircle2 },
];

// ── Small helpers ─────────────────────────────────────────────────────────────

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
    return (
        <div className={cn(
            "flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium",
            ok
                ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        )}>
            {ok
                ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                : <AlertCircle className="h-4 w-4 shrink-0" />}
            {label}
        </div>
    );
}

// ── Welcome step ─────────────────────────────────────────────────────────────

function WelcomeStep({ onNext, initialName }: { onNext: (name: string) => void; initialName: string }) {
    const [name, setName] = useState(initialName);
    const features = [
        {
            icon: ClipboardList,
            color: "text-blue-500",
            bg: "bg-blue-500/10 border-blue-500/20",
            title: "Track Applications",
            desc: "Every job, every status, every note -- one clean dashboard.",
        },
        {
            icon: Sparkles,
            color: "text-violet-500",
            bg: "bg-violet-500/10 border-violet-500/20",
            title: "AI Resume Tailoring",
            desc: "An AI agent reads your background and rewrites your resume for each role.",
        },
        {
            icon: Mic2,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10 border-emerald-500/20",
            title: "Interview War Room",
            desc: "Simulate interviews with custom personas. Get ready before the call.",
        },
        {
            icon: Brain,
            color: "text-amber-500",
            bg: "bg-amber-500/10 border-amber-500/20",
            title: "Smart Context",
            desc: "Feed the AI your experience, projects, and skills. Better context = better results.",
        },
    ];

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
                <h1 className="text-4xl font-bold tracking-tight text-foreground">
                    Welcome to ResuMate
                </h1>
                <p className="text-muted-foreground mt-2 text-lg">
                    Your AI-powered career command center. Let's get you set up.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {features.map((f) => (
                    <div
                        key={f.title}
                        className={cn(
                            "rounded-2xl border p-5 flex flex-col gap-3 transition-all hover:scale-[1.01]",
                            f.bg
                        )}
                    >
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center bg-background/60", f.color)}>
                            <f.icon className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="font-semibold text-foreground text-sm">{f.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Name input */}
            <div className="flex flex-col gap-2">
                <label htmlFor="setup-name" className="text-sm font-medium text-foreground">
                    What should we call you?
                </label>
                <input
                    id="setup-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") onNext(name.trim()); }}
                    placeholder="e.g. Alex"
                    className="h-11 w-full max-w-xs px-3.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                    Used for the dashboard greeting. You can change it in Settings later.
                </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
                <Button onClick={() => onNext(name.trim())} size="lg" className="gap-2">
                    Let's get you set up <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

// ── Master Resume step ────────────────────────────────────────────────────────

type MasterResumeTab = "upload" | "paste" | "detect" | "ai";

function MasterResumeStep({
    alreadyDone,
    onNext,
    onSkip,
    onStatusRefresh,
    onPdfReady,
    apiKeyConfigured,
}: {
    alreadyDone: boolean;
    onNext: () => void;
    onSkip: () => void;
    onStatusRefresh: () => void;
    onPdfReady: () => void;
    apiKeyConfigured: boolean;
}) {
    // Default to the AI tab when an API key is configured, otherwise upload.
    const [tab, setTab] = useState<MasterResumeTab>(apiKeyConfigured ? "ai" : "upload");
    const [dragging, setDragging] = useState(false);
    const [pasteContent, setPasteContent] = useState("");
    const [validating, setValidating] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const validate = useCallback(async (content: string) => {
        if (!content.trim()) return;
        setValidating(true);
        setResult(null);
        try {
            const res = await SetupService.saveMasterResume(content);
            if (res.valid) {
                setResult({ ok: true, msg: "Resume validated and saved successfully." });
                onStatusRefresh();
                onPdfReady();
            } else {
                setResult({ ok: false, msg: res.error || "Validation failed." });
            }
        } catch {
            setResult({ ok: false, msg: "Could not reach the server. Make sure the backend is running." });
        } finally {
            setValidating(false);
        }
    }, [onStatusRefresh]);

    const handleFile = async (file: File) => {
        if (!file.name.endsWith(".yaml") && !file.name.endsWith(".yml")) {
            setResult({ ok: false, msg: "Please upload a .yaml or .yml file." });
            return;
        }
        const content = await file.text();
        await validate(content);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) await handleFile(file);
    };

    const handleDetect = async () => {
        setValidating(true);
        setResult(null);
        try {
            const content = await SetupService.getMasterResume();
            if (content.trim().length > 10) {
                setResult({ ok: true, msg: "Existing master resume detected and confirmed." });
                onStatusRefresh();
            } else {
                setResult({ ok: false, msg: "No master resume found in data/. Try uploading or pasting one." });
            }
        } catch {
            setResult({ ok: false, msg: "Could not check for existing file." });
        } finally {
            setValidating(false);
        }
    };

    const tabs: { id: MasterResumeTab; label: string }[] = [
        { id: "ai",     label: "Generate with AI" },
        { id: "upload", label: "Upload file" },
        { id: "paste",  label: "Paste YAML" },
        { id: "detect", label: "Already in folder" },
    ];

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-3xl font-bold tracking-tight">Master Resume</h2>
                    {alreadyDone && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30">
                            Already configured
                        </span>
                    )}
                </div>
                <p className="text-muted-foreground">
                    Your source-of-truth resume in RenderCV YAML format. Every tailored version starts here.
                </p>
                {alreadyDone && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Your master resume is already set up. You can update it below or continue.
                    </div>
                )}
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => { setTab(t.id); setResult(null); }}
                        className={cn(
                            "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                            tab === t.id
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {tab === "upload" && (
                <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    className={cn(
                        "border-2 border-dashed rounded-2xl px-8 py-12 flex flex-col items-center gap-3 cursor-pointer transition-all",
                        dragging
                            ? "border-primary bg-primary/5 scale-[1.01]"
                            : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                    )}
                >
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".yaml,.yml"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                    />
                    {validating
                        ? <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                        : <CloudUpload className={cn("h-8 w-8", dragging ? "text-primary" : "text-muted-foreground")} />
                    }
                    <div className="text-center">
                        <p className="text-sm font-medium text-foreground">
                            {validating ? "Validating with RenderCV..." : "Drop your .yaml file here"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {validating ? "This may take 10-20 seconds" : "or click to browse"}
                        </p>
                    </div>
                </div>
            )}

            {tab === "paste" && (
                <div className="flex flex-col gap-3">
                    <Textarea
                        value={pasteContent}
                        onChange={(e) => setPasteContent(e.target.value)}
                        placeholder="Paste your RenderCV YAML here..."
                        className="min-h-[220px] font-mono text-xs resize-none bg-muted/20"
                    />
                    <div className="flex justify-end">
                        <Button
                            onClick={() => validate(pasteContent)}
                            disabled={validating || !pasteContent.trim()}
                            className="gap-2"
                        >
                            {validating
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Validating...</>
                                : <><Upload className="h-4 w-4" /> Validate & Save</>
                            }
                        </Button>
                    </div>
                </div>
            )}

            {tab === "detect" && (
                <div className="rounded-2xl border border-border bg-muted/20 p-6 flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-foreground">Already placed your file?</p>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                If you placed <code className="bg-muted px-1 rounded text-xs">master-resume_CV.yaml</code> in
                                the <code className="bg-muted px-1 rounded text-xs">data/</code> folder on your host machine,
                                click below to detect it.
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        onClick={handleDetect}
                        disabled={validating}
                        className="w-fit gap-2"
                    >
                        {validating
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking...</>
                            : "Detect File"
                        }
                    </Button>
                </div>
            )}

            {/* Generate with AI tab */}
            {tab === "ai" && (
                <GenerateWithAiTab
                    apiKeyConfigured={apiKeyConfigured}
                    onValidationSuccess={() => {
                        onStatusRefresh();
                        onPdfReady();
                        setResult({ ok: true, msg: "Resume validated and saved successfully." });
                    }}
                />
            )}

            {/* Validation result (upload / paste / detect tabs) */}
            {tab !== "ai" && result && (
                <div className={cn(
                    "flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm border",
                    result.ok
                        ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
                        : "bg-destructive/10 border-destructive/30 text-destructive"
                )}>
                    {result.ok
                        ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                        : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    }
                    <span className="leading-relaxed">{result.msg}</span>
                </div>
            )}

            <div className="flex items-center justify-between pt-2">
                <button
                    onClick={onSkip}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
                >
                    Skip for now
                </button>
                <Button onClick={onNext} disabled={!alreadyDone && !(result?.ok)} className="gap-2">
                    Continue <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

// ── Context Files step ────────────────────────────────────────────────────────

function ContextFilesStep({
    alreadyDone,
    onNext,
    onSkip,
    onStatusRefresh,
}: {
    alreadyDone: boolean;
    onNext: () => void;
    onSkip: () => void;
    onStatusRefresh: () => void;
}) {
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<{ ok: boolean; msg: string } | null>(null);
    const [fileCount, setFileCount] = useState<number | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const refreshCount = useCallback(async () => {
        try {
            const files = await contextFilesService.listFiles();
            setFileCount(files.length);
            if (files.length > 0) onStatusRefresh();
        } catch { /* ignore */ }
    }, [onStatusRefresh]);

    useEffect(() => { refreshCount(); }, [refreshCount]);

    const handleUpload = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        const mdFiles = Array.from(fileList).filter((f) => f.name.endsWith(".md"));
        if (mdFiles.length === 0) {
            setUploadResult({ ok: false, msg: "Only .md files are accepted." });
            return;
        }
        setUploading(true);
        setUploadResult(null);
        try {
            const { results } = await contextFilesService.uploadFiles(mdFiles);
            const created = results.filter((r: { status: string }) => r.status === "created").length;
            setUploadResult({
                ok: created > 0,
                msg: created > 0
                    ? `Uploaded ${created} file${created > 1 ? "s" : ""} successfully.`
                    : "All files already exist in the folder.",
            });
            await refreshCount();
        } catch {
            setUploadResult({ ok: false, msg: "Upload failed. Check that the backend is running." });
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        handleUpload(e.dataTransfer.files);
    };

    const hints = [
        { icon: "💼", text: "Work experience details and achievements" },
        { icon: "🚀", text: "Project summaries with tech stack and outcomes" },
        { icon: "🎓", text: "Education, certifications, and courses" },
        { icon: "⚡", text: "Skills, tools, and domain expertise" },
    ];

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-3xl font-bold tracking-tight">Context Files</h2>
                    {alreadyDone && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30">
                            Already configured
                        </span>
                    )}
                </div>
                <p className="text-muted-foreground">
                    Markdown files the AI reads to write richer, more targeted resume bullets.
                </p>
                {alreadyDone && fileCount !== null && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        {fileCount} context file{fileCount !== 1 ? "s" : ""} ready. You can add more or continue.
                    </div>
                )}
            </div>

            {/* What to include */}
            <div className="grid grid-cols-2 gap-2">
                {hints.map((h) => (
                    <div key={h.text} className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                        <span className="text-base">{h.icon}</span>
                        {h.text}
                    </div>
                ))}
            </div>

            {/* Upload zone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                    "border-2 border-dashed rounded-2xl px-8 py-10 flex flex-col items-center gap-3 cursor-pointer transition-all",
                    dragging
                        ? "border-primary bg-primary/5 scale-[1.01]"
                        : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                )}
            >
                <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept=".md"
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files)}
                />
                {uploading
                    ? <Loader2 className="h-7 w-7 text-muted-foreground animate-spin" />
                    : <CloudUpload className={cn("h-7 w-7", dragging ? "text-primary" : "text-muted-foreground")} />
                }
                <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                        {uploading ? "Uploading..." : "Drop .md files here"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {uploading ? "Please wait" : "or click to browse — one or more files"}
                    </p>
                </div>
            </div>

            {fileCount !== null && fileCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4 text-green-500" />
                    {fileCount} file{fileCount !== 1 ? "s" : ""} in context folder.
                    <a href="/context" className="text-primary hover:underline text-xs ml-1" target="_blank">
                        Manage in Context Manager
                    </a>
                </div>
            )}

            {uploadResult && (
                <div className={cn(
                    "flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm border",
                    uploadResult.ok
                        ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
                        : "bg-destructive/10 border-destructive/30 text-destructive"
                )}>
                    {uploadResult.ok
                        ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                        : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    }
                    {uploadResult.msg}
                </div>
            )}

            <div className="flex items-center justify-between pt-2">
                <button
                    onClick={onSkip}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
                >
                    Skip for now
                </button>
                <Button onClick={onNext} disabled={!alreadyDone && !(fileCount !== null && fileCount > 0)} className="gap-2">
                    Continue <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

// ── API Key step ─────────────────────────────────────────────────────────────

type Provider = "openai" | "openrouter" | "gemini";

const PROVIDER_LABELS: Record<Provider, string> = {
    openai: "OpenAI",
    openrouter: "OpenRouter",
    gemini: "Google Gemini",
};

const PROVIDER_MODELS: Record<Provider, string> = {
    openai: "gpt-5-mini",
    openrouter: "anthropic/claude-sonnet-4",
    gemini: "gemini-2.5-flash",
};

function ApiKeyStep({
    alreadyDone,
    onNext,
    onSkip,
    onStatusRefresh,
}: {
    alreadyDone: boolean;
    onNext: () => void;
    onSkip: () => void;
    onStatusRefresh: () => void;
}) {
    const [provider, setProvider] = useState<Provider>("openai");
    const [apiKey, setApiKey] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

    const handleSaveAndTest = async () => {
        if (!apiKey.trim()) return;
        setSaving(true);
        setTestResult(null);
        try {
            const keyUpdate: Record<string, string> = {
                llm_provider: provider,
                llm_model: PROVIDER_MODELS[provider],
                [`llm_api_key_${provider}`]: apiKey.trim(),
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await SettingsService.update(keyUpdate as any);
            setSaving(false);
            setTesting(true);
            const result = await SettingsService.testLlm(provider, apiKey.trim(), PROVIDER_MODELS[provider]);
            setTestResult({
                ok: result.success,
                msg: result.success
                    ? `Connected successfully. Response time: ${result.response_time_ms}ms`
                    : result.message,
            });
            if (result.success) onStatusRefresh();
        } catch {
            setTestResult({ ok: false, msg: "Connection test failed. Check your API key and try again." });
        } finally {
            setSaving(false);
            setTesting(false);
        }
    };

    const providers: Provider[] = ["openai", "openrouter", "gemini"];

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-3xl font-bold tracking-tight">Connect Your AI</h2>
                    {alreadyDone && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30">
                            Already configured
                        </span>
                    )}
                </div>
                <p className="text-muted-foreground">
                    Pick an LLM provider and add your API key to enable AI tailoring and interview prep.
                </p>
                {alreadyDone && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        An API key is already configured. You can update it here or continue.
                    </div>
                )}
            </div>

            {/* Provider selection */}
            <div className="flex gap-2">
                {providers.map((p) => (
                    <button
                        key={p}
                        onClick={() => { setProvider(p); setTestResult(null); }}
                        className={cn(
                            "flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all",
                            provider === p
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
                        )}
                    >
                        {PROVIDER_LABELS[p]}
                    </button>
                ))}
            </div>

            {/* API key input */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground">
                    {PROVIDER_LABELS[provider]} API Key
                </label>
                <div className="relative">
                    <input
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={provider === "openai" ? "sk-proj-..." : provider === "openrouter" ? "sk-or-..." : "AIza..."}
                        className="w-full h-11 px-3.5 pr-10 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm font-mono"
                    />
                    <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
                <p className="text-xs text-muted-foreground">
                    Stored locally in your database -- never shared or transmitted to our servers.
                </p>
            </div>

            {/* Model info */}
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                Default model: <span className="font-mono text-foreground ml-1">{PROVIDER_MODELS[provider]}</span>
                <span className="ml-1 text-xs">(changeable in Settings)</span>
            </div>

            {testResult && (
                <div className={cn(
                    "flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm border",
                    testResult.ok
                        ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
                        : "bg-destructive/10 border-destructive/30 text-destructive"
                )}>
                    {testResult.ok
                        ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                        : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    }
                    {testResult.msg}
                </div>
            )}

            <div className="flex items-center justify-between pt-2">
                <button
                    onClick={onSkip}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
                >
                    Skip for now
                </button>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        onClick={handleSaveAndTest}
                        disabled={!apiKey.trim() || saving || testing}
                        className="gap-2"
                    >
                        {(saving || testing)
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> {saving ? "Saving..." : "Testing..."}</>
                            : "Save & Test"
                        }
                    </Button>
                    <Button onClick={onNext} disabled={!alreadyDone && !testResult?.ok} className="gap-2">
                        Continue <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── Done step ─────────────────────────────────────────────────────────────────

function DoneStep({ status }: { status: SetupStatus | null }) {
    const router = useRouter();

    const items = [
        { label: "Master Resume", ok: status?.master_resume_exists ?? false, desc: "Source-of-truth YAML resume" },
        { label: "Context Files", ok: status?.context_files_exist ?? false, desc: "AI background knowledge" },
        { label: "AI Connection", ok: status?.api_key_configured ?? false, desc: "LLM provider + API key" },
    ];

    const allGood = items.every((i) => i.ok);
    const anyGood = items.some((i) => i.ok);

    const handleDone = async () => {
        await SetupService.dismissWizard();
        router.push("/dashboard");
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center">
                <div className="text-6xl mb-4">{allGood ? "🎉" : anyGood ? "🚀" : "👋"}</div>
                <h2 className="text-3xl font-bold tracking-tight">
                    {allGood ? "You're fully set up!" : "You're good to go!"}
                </h2>
                <p className="text-muted-foreground mt-2">
                    {allGood
                        ? "All systems ready. Start tracking applications and let the AI do the heavy lifting."
                        : "You can always complete the remaining setup from Settings at any time."}
                </p>
            </div>

            <div className="flex flex-col gap-3">
                {items.map((item) => (
                    <div
                        key={item.label}
                        className={cn(
                            "flex items-center justify-between rounded-2xl border px-5 py-4",
                            item.ok
                                ? "border-green-500/30 bg-green-500/5"
                                : "border-amber-500/30 bg-amber-500/5"
                        )}
                    >
                        <div>
                            <p className="text-sm font-semibold text-foreground">{item.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                        </div>
                        {item.ok
                            ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                            : <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                        }
                    </div>
                ))}
            </div>

            {!allGood && (
                <p className="text-xs text-muted-foreground text-center">
                    Missing items will show a reminder banner in the app. Go to{" "}
                    <a href="/settings" className="text-primary hover:underline">Settings</a> to complete them anytime.
                </p>
            )}

            <div className="flex justify-center">
                <Button size="lg" onClick={handleDone} className="gap-2 px-8">
                    <LayoutDashboard className="h-4 w-4" />
                    Open Dashboard
                </Button>
            </div>
        </div>
    );
}

// ── Main SetupPage ─────────────────────────────────────────────────────────────

export default function SetupPage() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [status, setStatus] = useState<SetupStatus | null>(null);
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [currentStep, setCurrentStep] = useState(0);
    // Non-null when a valid master resume PDF is available -- triggers split layout.
    const [masterPdfHash, setMasterPdfHash] = useState<string | null>(null);
    const [preferredName, setPreferredName] = useState("");

    useEffect(() => { setMounted(true); }, []);

    const refreshStatus = useCallback(async () => {
        try {
            const s = await SetupService.getStatus();
            setStatus(s);
        } catch { /* keep last known */ }
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const [s, appSettings] = await Promise.all([
                    SetupService.getStatus(),
                    SettingsService.get(),
                ]);
                setStatus(s);
                setPreferredName(appSettings.preferred_name ?? "");
                // If a preview PDF already exists from a previous session, show it.
                if (s.master_resume_exists) {
                    setMasterPdfHash(Date.now().toString());
                }
            } finally {
                setLoadingStatus(false);
            }
        })();
    }, []);

    const handlePdfReady = useCallback(() => {
        setMasterPdfHash(Date.now().toString());
    }, []);

    // Called by WelcomeStep when the user clicks "Let's get you set up".
    // Saves the name (if non-empty) then advances to the next step.
    const handleWelcomeNext = useCallback(async (name: string) => {
        const trimmed = name.trim();
        if (trimmed) {
            setPreferredName(trimmed);
            try {
                await SettingsService.update({ preferred_name: trimmed });
            } catch { /* non-blocking -- name can be updated in Settings */ }
        }
        setCurrentStep((s) => Math.min(s + 1, stepDefs.length - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const activeSteps: StepId[] = [
        "welcome",
        "api-key",
        "master-resume",
        "context-files",
        "done",
    ];

    const stepDefs = ALL_STEPS.filter((s) => activeSteps.includes(s.id));

    const goNext = () => setCurrentStep((s) => Math.min(s + 1, stepDefs.length - 1));
    const goPrev = () => setCurrentStep((s) => Math.max(s - 1, 0));
    const goSkip = () => goNext();

    if (!mounted) return null;

    const stepId = stepDefs[currentStep]?.id;

    return (
        <div className="min-h-screen bg-background text-foreground flex relative overflow-hidden">
            {/* Mesh background */}
            <div className="absolute inset-0 pointer-events-none z-0">
                <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[60%] bg-primary/8 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[50%] bg-primary/5 rounded-full blur-[100px]" />
            </div>

            {/* Left sidebar */}
            <aside className="relative z-10 w-72 shrink-0 flex flex-col border-r border-border/60 bg-background/80 backdrop-blur-sm px-6 py-8">
                {/* Logo */}
                <div className="flex items-center gap-2.5 mb-10">
                    <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-sm font-bold">
                        R
                    </div>
                    <span className="font-bold text-foreground">ResuMate</span>
                </div>

                {/* Steps */}
                <nav className="flex flex-col gap-1 flex-1">
                    {stepDefs.map((step, idx) => {
                        const isDone = idx < currentStep;
                        const isActive = idx === currentStep;
                        const isPending = idx > currentStep;

                        // Check if step is already configured
                        const stepConfigured =
                            step.id === "master-resume" ? status?.master_resume_exists :
                            step.id === "context-files" ? status?.context_files_exist :
                            step.id === "api-key" ? status?.api_key_configured :
                            true;

                        return (
                            <button
                                key={step.id}
                                onClick={() => setCurrentStep(idx)}
                                className={cn(
                                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all text-left",
                                    isActive
                                        ? "bg-primary/10 text-primary font-semibold"
                                        : isDone
                                        ? "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                        : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/20"
                                )}
                            >
                                <div className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border transition-all",
                                    isActive
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : isDone || stepConfigured
                                        ? "border-green-500 bg-green-500/20 text-green-600"
                                        : "border-border bg-muted/30 text-muted-foreground"
                                )}>
                                    {(isDone || (stepConfigured && !isActive && step.id !== "welcome" && step.id !== "done"))
                                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                        : idx + 1
                                    }
                                </div>
                                <span>{step.label}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="mt-6 space-y-2">
                    <button
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <span className="material-symbols-outlined text-[16px]">
                            {theme === "dark" ? "light_mode" : "dark_mode"}
                        </span>
                        Toggle theme
                    </button>
                </div>
            </aside>

            {/* Right content -- split when a master resume PDF preview is available */}
            <main className="relative z-10 flex-1 flex overflow-hidden">

                {/* Step content panel (left in split mode, full-width otherwise) */}
                <div className={cn(
                    "flex flex-col overflow-y-auto",
                    masterPdfHash && stepId === "master-resume"
                        ? "w-1/2 border-r border-border/50"
                        : "flex-1",
                )}>
                    <div className="flex-1 flex items-start justify-center px-8 py-12">
                        <div className={cn(
                            "w-full",
                            masterPdfHash && stepId === "master-resume" ? "" : "max-w-xl",
                        )}>
                        {loadingStatus ? (
                            <div className="flex items-center gap-3 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Loading setup status...
                            </div>
                        ) : (
                            <>
                                {stepId === "welcome" && (
                                    <WelcomeStep onNext={handleWelcomeNext} initialName={preferredName} />
                                )}
                                {stepId === "master-resume" && (
                                    <MasterResumeStep
                                        alreadyDone={status?.master_resume_exists ?? false}
                                        onNext={goNext}
                                        onSkip={goSkip}
                                        onStatusRefresh={refreshStatus}
                                        onPdfReady={handlePdfReady}
                                        apiKeyConfigured={status?.api_key_configured ?? false}
                                    />
                                )}
                                {stepId === "context-files" && (
                                    <ContextFilesStep
                                        alreadyDone={status?.context_files_exist ?? false}
                                        onNext={goNext}
                                        onSkip={goSkip}
                                        onStatusRefresh={refreshStatus}
                                    />
                                )}
                                {stepId === "api-key" && (
                                    <ApiKeyStep
                                        alreadyDone={status?.api_key_configured ?? false}
                                        onNext={goNext}
                                        onSkip={goSkip}
                                        onStatusRefresh={refreshStatus}
                                    />
                                )}
                                {stepId === "done" && (
                                    <DoneStep status={status} />
                                )}

                                {/* Back button (not on welcome or done) */}
                                {currentStep > 0 && stepId !== "done" && (
                                    <button
                                        onClick={goPrev}
                                        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-8"
                                    >
                                        <ChevronLeft className="h-4 w-4" /> Back
                                    </button>
                                )}
                            </>
                        )}
                        </div>
                    </div>

                    {/* Bottom progress bar */}
                    <div className="h-1 bg-muted/40 shrink-0">
                        <div
                            className="h-full bg-primary transition-all duration-500"
                            style={{ width: `${((currentStep + 1) / stepDefs.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* PDF preview panel -- shown alongside the master resume step */}
                {masterPdfHash && stepId === "master-resume" && (
                    <div className="w-1/2 flex flex-col shrink-0 bg-muted/10 border-l border-border/50">
                        <div className="px-4 py-2.5 border-b border-border/50 flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0">
                            <FileText className="h-3.5 w-3.5" />
                            Resume Preview
                        </div>
                        <iframe
                            key={masterPdfHash}
                            src={SetupService.masterResumePdfUrl(masterPdfHash)}
                            className="flex-1 w-full border-0"
                            title="Master Resume Preview"
                        />
                    </div>
                )}
            </main>
        </div>
    );
}
