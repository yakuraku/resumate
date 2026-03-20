"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useBackgroundAnimation } from "@/hooks/useBackgroundAnimation";
import { CommandCenter } from "@/components/layout/CommandCenter";
import { useTheme } from "@/components/theme-provider";
import { SettingsService, AppSettings, SettingsUpdate, PromptsData } from "@/services/settings.service";
import { ApplicationService } from "@/services/application.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Loader2, Eye, EyeOff, AlertTriangle, Save, Download,
    CheckCircle, Plus, Trash2, RotateCcw, X, ChevronRight,
    FileEdit, MessageSquarePlus, Sparkles, BookMarked, Zap, ExternalLink
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { TailorRuleService } from "@/services/tailor-rule.service";
import { TailorRule } from "@/types/tailor-rule";

interface Toast {
    id: string;
    message: string;
    variant: "default" | "error" | "success";
}

const PROMPT_LABELS: Record<string, { title: string; description: string; icon: React.ElementType; color: string }> = {
    resume_tailoring: {
        title: "Resume Tailoring",
        description: "Tailors your resume YAML to match a target job description.",
        icon: FileEdit,
        color: "text-violet-500",
    },
    qa_generate: {
        title: "Q&A Generator",
        description: "Generates answers to application questions from your background.",
        icon: MessageSquarePlus,
        color: "text-blue-500",
    },
    qa_rewrite: {
        title: "Q&A Rewrite",
        description: "Rewrites and polishes rough drafts into professional prose.",
        icon: Sparkles,
        color: "text-amber-500",
    },
    qa_saved: {
        title: "Saved Answers",
        description: "Generates answers stored as saved responses for quick re-use.",
        icon: BookMarked,
        color: "text-emerald-500",
    },
};

const PROMPT_KEYS = ["resume_tailoring", "qa_generate", "qa_rewrite", "qa_saved"];

export default function SettingsPage() {
    const { theme, setTheme } = useTheme();
    const { enabled: bgEnabled, animationType, setEnabled: setBgEnabled, setAnimationType } = useBackgroundAnimation();
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);

    // Local form state
    const [form, setForm] = useState<SettingsUpdate>({});
    const [dirty, setDirty] = useState(false);

    // Test connection state
    const [testingConnection, setTestingConnection] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string; response_time_ms: number } | null>(null);

    // Global tailor rules state
    const [globalRules, setGlobalRules] = useState<TailorRule[]>([]);
    const [loadingGlobalRules, setLoadingGlobalRules] = useState(true);
    const [newGlobalRuleText, setNewGlobalRuleText] = useState("");
    const [addingGlobalRule, setAddingGlobalRule] = useState(false);

    // Prompts state
    const [promptsData, setPromptsData] = useState<PromptsData | null>(null);
    const [loadingPrompts, setLoadingPrompts] = useState(false);
    const [promptEdits, setPromptEdits] = useState<Record<string, string>>({});
    const [savingPrompt, setSavingPrompt] = useState<string | null>(null);
    const [resettingPrompt, setResettingPrompt] = useState<string | null>(null);
    const [globalRulesPreview, setGlobalRulesPreview] = useState<string[]>([]);
    const [openPromptKey, setOpenPromptKey] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("general");
    const [highlightGlobalRules, setHighlightGlobalRules] = useState(false);
    const globalRulesRef = React.useRef<HTMLElement | null>(null);

    const handleGoToGlobalRules = useCallback(() => {
        setOpenPromptKey(null);
        setActiveTab("ai");
        // Wait for tab to render, then scroll + highlight
        setTimeout(() => {
            globalRulesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            setHighlightGlobalRules(true);
            setTimeout(() => setHighlightGlobalRules(false), 2000);
        }, 150);
    }, []);

    const showToast = useCallback((message: string, variant: Toast["variant"] = "default") => {
        const id = crypto.randomUUID();
        setToasts((prev) => [...prev, { id, message, variant }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await SettingsService.get();
                setSettings(data);
                setForm({
                    llm_provider: data.llm_provider,
                    llm_api_key: data.llm_api_key,
                    llm_api_key_openai: data.llm_api_key_openai,
                    llm_api_key_openrouter: data.llm_api_key_openrouter,
                    llm_api_key_gemini: data.llm_api_key_gemini,
                    llm_model: data.llm_model,
                    theme: data.theme,
                    default_master_resume_path: data.default_master_resume_path,
                    autosave_enabled: data.autosave_enabled,
                    tailor_mode: data.tailor_mode || "agentic",
                });
            } catch (e) {
                showToast("Failed to load settings", "error");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [showToast]);

    useEffect(() => {
        const loadRules = async () => {
            try {
                const all = await TailorRuleService.getAll();
                const globals = all.filter((r) => r.application_id === null);
                setGlobalRules(globals);
                setGlobalRulesPreview(globals.filter((r) => r.is_enabled).map((r) => r.rule_text));
            } catch (e) {
                console.error("Failed to load global tailor rules", e);
            } finally {
                setLoadingGlobalRules(false);
            }
        };
        loadRules();
    }, []);

    const loadPrompts = useCallback(async () => {
        setLoadingPrompts(true);
        try {
            const data = await SettingsService.getPrompts();
            setPromptsData(data);
            // Initialize edits with the active values
            const edits: Record<string, string> = {};
            for (const key of PROMPT_KEYS) {
                edits[key] = data.prompts[key]?.active || "";
            }
            setPromptEdits(edits);
        } catch (e) {
            showToast("Failed to load prompts", "error");
        } finally {
            setLoadingPrompts(false);
        }
    }, [showToast]);

    const handleAddGlobalRule = async () => {
        if (!newGlobalRuleText.trim()) return;
        setAddingGlobalRule(true);
        try {
            const created = await TailorRuleService.create({ rule_text: newGlobalRuleText.trim(), application_id: null });
            const updatedRules = [...globalRules, created];
            setGlobalRules(updatedRules);
            setGlobalRulesPreview(updatedRules.filter((r) => r.is_enabled).map((r) => r.rule_text));
            setNewGlobalRuleText("");
        } catch (e) {
            showToast("Failed to add rule", "error");
        } finally {
            setAddingGlobalRule(false);
        }
    };

    const handleToggleGlobalRule = async (rule: TailorRule) => {
        try {
            const updated = await TailorRuleService.update(rule.id, { is_enabled: !rule.is_enabled });
            const updatedRules = globalRules.map((r) => (r.id === updated.id ? updated : r));
            setGlobalRules(updatedRules);
            setGlobalRulesPreview(updatedRules.filter((r) => r.is_enabled).map((r) => r.rule_text));
        } catch (e) {
            showToast("Failed to update rule", "error");
        }
    };

    const handleDeleteGlobalRule = async (id: string) => {
        try {
            await TailorRuleService.delete(id);
            const updatedRules = globalRules.filter((r) => r.id !== id);
            setGlobalRules(updatedRules);
            setGlobalRulesPreview(updatedRules.filter((r) => r.is_enabled).map((r) => r.rule_text));
        } catch (e) {
            showToast("Failed to delete rule", "error");
        }
    };

    const getProviderApiKeyField = (provider: string): keyof SettingsUpdate => {
        if (provider === "openrouter") return "llm_api_key_openrouter";
        if (provider === "gemini") return "llm_api_key_gemini";
        return "llm_api_key_openai";
    };

    const handleChange = (key: keyof SettingsUpdate, value: string | boolean) => {
        setForm((prev) => {
            const next = { ...prev, [key]: value };
            // When provider switches, load that provider's stored key into llm_api_key
            if (key === "llm_provider" && typeof value === "string") {
                const providerKeyField = getProviderApiKeyField(value);
                next.llm_api_key = (prev[providerKeyField] as string) || "";
            }
            // When API key changes, mirror it to the provider-specific field
            if (key === "llm_api_key" && typeof value === "string") {
                const providerKeyField = getProviderApiKeyField(prev.llm_provider || "openai");
                (next as Record<string, unknown>)[providerKeyField] = value;
            }
            return next;
        });
        setDirty(true);
        if (key === "theme") {
            setTheme(value as "light" | "dark" | "system");
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = await SettingsService.update(form);
            setSettings(updated);
            setDirty(false);
            showToast("Settings saved", "success");
        } catch (e) {
            showToast("Failed to save settings", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleSavePrompt = async (key: string) => {
        setSavingPrompt(key);
        try {
            await SettingsService.updatePrompt(key, promptEdits[key]);
            await loadPrompts();
            showToast("Prompt saved", "success");
        } catch (e) {
            showToast("Failed to save prompt", "error");
        } finally {
            setSavingPrompt(null);
        }
    };

    const handleResetPrompt = async (key: string) => {
        setResettingPrompt(key);
        try {
            await SettingsService.resetPrompt(key);
            await loadPrompts();
            showToast("Prompt reset to default", "success");
        } catch (e) {
            showToast("Failed to reset prompt", "error");
        } finally {
            setResettingPrompt(null);
        }
    };

    const handleExportData = async () => {
        try {
            showToast("Preparing export…");
            const appsResponse = await ApplicationService.getAll(1, 1000);
            const exportData = {
                exported_at: new Date().toISOString(),
                version: "1.0",
                applications: appsResponse.items,
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `resumate_export_${new Date().toISOString().split("T")[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast("Data exported successfully", "success");
        } catch (e) {
            showToast("Export failed", "error");
        }
    };

    if (loading) {
        return (
            <CommandCenter>
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </CommandCenter>
        );
    }

    const current = { ...settings, ...form } as AppSettings;

    return (
        <CommandCenter>
            <div className="max-w-4xl mx-auto pb-16">
                {/* Page header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                    <p className="text-sm text-muted-foreground mt-1">Configure AI providers, appearance, and data preferences.</p>
                </div>

                <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === "prompts" && !promptsData) loadPrompts(); }}>
                    <TabsList className="mb-8">
                        <TabsTrigger value="general">General</TabsTrigger>
                        <TabsTrigger value="ai">AI &amp; Resume</TabsTrigger>
                        <TabsTrigger value="data">Data</TabsTrigger>
                        <TabsTrigger value="prompts">Prompts</TabsTrigger>
                    </TabsList>

                    {/* ─────────── GENERAL TAB ─────────── */}
                    <TabsContent value="general" className="space-y-0">
                        {/* Appearance */}
                        <section className="flex flex-col md:flex-row md:gap-12 gap-6 py-10 border-b border-border">
                            <div className="md:w-1/3">
                                <h3 className="text-base font-semibold">Appearance</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Choose your preferred color theme.</p>
                            </div>
                            <div className="md:w-2/3 space-y-4">
                                <div className="space-y-2">
                                    <Label>Theme</Label>
                                    <div className="flex gap-2">
                                        {(["light", "dark", "system"] as const).map((t) => (
                                            <button
                                                key={t}
                                                onClick={() => handleChange("theme", t)}
                                                className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium capitalize transition-colors ${
                                                    current.theme === t
                                                        ? "border-primary bg-primary/10 text-primary"
                                                        : "border-border text-muted-foreground hover:border-primary/50"
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Background Animation */}
                        <section className="flex flex-col md:flex-row md:gap-12 gap-6 py-10 border-b border-border">
                            <div className="md:w-1/3">
                                <h3 className="text-base font-semibold">Background Animation</h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Animated background on the dashboard. Purely visual — does not affect performance on modern hardware.
                                </p>
                            </div>
                            <div className="md:w-2/3 space-y-5">
                                {/* Toggle */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">Enable Animation</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Show an animated background on the dashboard.</p>
                                    </div>
                                    <Switch
                                        checked={bgEnabled}
                                        onCheckedChange={setBgEnabled}
                                    />
                                </div>

                                {/* Animation type picker — only shown when enabled */}
                                {bgEnabled && (
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">Animation Style</p>
                                        <div className="flex gap-2 p-1 rounded-lg bg-muted/60 border border-border w-fit">
                                            {(["particles", "galaxy"] as const).map((type) => (
                                                <button
                                                    key={type}
                                                    onClick={() => setAnimationType(type)}
                                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${
                                                        animationType === type
                                                            ? "bg-card text-foreground shadow-sm border border-border"
                                                            : "text-muted-foreground hover:text-foreground"
                                                    }`}
                                                >
                                                    {type === "particles" ? "✦ Particles" : "✺ Galaxy"}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {animationType === "particles"
                                                ? "Floating 3D point cloud that drifts and rotates. Colors follow your active theme."
                                                : "Procedural star field with twinkling and depth layers. Hue-shifts to match your theme."}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Autosave */}
                        <section className="flex flex-col md:flex-row md:gap-12 gap-6 py-10 border-b border-border">
                            <div className="md:w-1/3">
                                <h3 className="text-base font-semibold">Auto-save</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Automatically save resume edits after a short pause.</p>
                            </div>
                            <div className="md:w-2/3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">Auto-save Resume</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Saves after 1.5 seconds of inactivity.</p>
                                </div>
                                <Switch
                                    checked={current.autosave_enabled}
                                    onCheckedChange={(checked) => handleChange("autosave_enabled", checked)}
                                />
                            </div>
                        </section>

                        {/* Resume Defaults */}
                        <section className="flex flex-col md:flex-row md:gap-12 gap-6 py-10">
                            <div className="md:w-1/3">
                                <h3 className="text-base font-semibold">Resume Defaults</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Configure default file paths and templates.</p>
                            </div>
                            <div className="md:w-2/3 space-y-2">
                                <Label htmlFor="master_resume">Default Master Resume Path</Label>
                                <Input
                                    id="master_resume"
                                    value={current.default_master_resume_path || ""}
                                    onChange={(e) => handleChange("default_master_resume_path", e.target.value)}
                                    placeholder="master-resume_CV.yaml"
                                    className="font-mono text-sm"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Path relative to the project root. New applications will clone from this file.
                                </p>
                            </div>
                        </section>
                    </TabsContent>

                    {/* ─────────── AI & RESUME TAB ─────────── */}
                    <TabsContent value="ai" className="space-y-0">
                        {/* LLM Provider */}
                        <section className="flex flex-col md:flex-row md:gap-12 gap-6 py-10 border-b border-border">
                            <div className="md:w-1/3">
                                <h3 className="text-base font-semibold">LLM Provider</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Configure your AI provider and credentials. Falls back to .env if left empty.</p>
                            </div>
                            <div className="md:w-2/3 space-y-6">
                                {!current.llm_api_key && (
                                    <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 p-3">
                                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-sm text-amber-700 dark:text-amber-300">
                                            AI features require an API key. Add your key below to enable resume tailoring and Q&amp;A generation.
                                        </p>
                                    </div>
                                )}

                                {/* Provider cards */}
                                <div className="space-y-2">
                                    <Label>Provider</Label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {([
                                            {
                                                id: "openai",
                                                name: "OpenAI",
                                                description: "GPT-4o, GPT-5, o3, o4-mini",
                                                icon: "⚡",
                                                keyHint: "sk-...",
                                                keyUrl: "https://platform.openai.com/api-keys",
                                            },
                                            {
                                                id: "openrouter",
                                                name: "OpenRouter",
                                                description: "Access 200+ models via unified API",
                                                icon: "🔀",
                                                keyHint: "sk-or-...",
                                                keyUrl: "https://openrouter.ai/keys",
                                            },
                                            {
                                                id: "gemini",
                                                name: "Google Gemini",
                                                description: "Gemini 2.5 Flash & Pro",
                                                icon: "✦",
                                                keyHint: "AIza...",
                                                keyUrl: "https://aistudio.google.com/apikey",
                                            },
                                        ] as const).map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => {
                                                    handleChange("llm_provider", p.id);
                                                    setTestResult(null);
                                                }}
                                                className={`flex items-center gap-4 p-4 rounded-lg border text-left transition-all ${
                                                    current.llm_provider === p.id
                                                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                                        : "border-border hover:border-primary/40 hover:bg-muted/30"
                                                }`}
                                            >
                                                <span className="text-xl w-8 text-center shrink-0">{p.icon}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-semibold ${current.llm_provider === p.id ? "text-primary" : ""}`}>{p.name}</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                                                </div>
                                                {current.llm_provider === p.id && (
                                                    <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* API Key */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="llm_api_key">API Key</Label>
                                        {(() => {
                                            const urls: Record<string, string> = {
                                                openai: "https://platform.openai.com/api-keys",
                                                openrouter: "https://openrouter.ai/keys",
                                                gemini: "https://aistudio.google.com/apikey",
                                            };
                                            const url = urls[current.llm_provider];
                                            return url ? (
                                                <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                                                    Get API key <ExternalLink className="h-3 w-3" />
                                                </a>
                                            ) : null;
                                        })()}
                                    </div>
                                    <div className="relative">
                                        <Input
                                            id="llm_api_key"
                                            type={showApiKey ? "text" : "password"}
                                            value={current.llm_api_key || ""}
                                            onChange={(e) => { handleChange("llm_api_key", e.target.value); setTestResult(null); }}
                                            placeholder={
                                                current.llm_provider === "openai" ? "sk-..." :
                                                current.llm_provider === "openrouter" ? "sk-or-..." :
                                                "AIza..."
                                            }
                                            className="pr-10 font-mono text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowApiKey((v) => !v)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Model */}
                                <div className="space-y-2">
                                    <Label htmlFor="llm_model">Model</Label>
                                    <Input
                                        id="llm_model"
                                        value={current.llm_model || ""}
                                        onChange={(e) => { handleChange("llm_model", e.target.value); setTestResult(null); }}
                                        placeholder={
                                            current.llm_provider === "openai" ? "gpt-4o-mini" :
                                            current.llm_provider === "openrouter" ? "anthropic/claude-sonnet-4" :
                                            "gemini-2.5-flash"
                                        }
                                        className="font-mono text-sm"
                                    />
                                    {/* Suggested model chips */}
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        <span className="text-xs text-muted-foreground self-center">Suggested:</span>
                                        {(
                                            current.llm_provider === "openai"
                                                ? ["gpt-5", "gpt-5-mini", "gpt-5.1", "gpt-5.2"]
                                                : current.llm_provider === "openrouter"
                                                ? ["anthropic/claude-sonnet-4-5", "anthropic/claude-haiku-4-5", "google/gemini-2.5-flash", "meta-llama/llama-4-maverick"]
                                                : ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-lite"]
                                        ).map((m) => (
                                            <button
                                                key={m}
                                                onClick={() => { handleChange("llm_model", m); setTestResult(null); }}
                                                className="px-2 py-0.5 rounded-md bg-muted hover:bg-primary/10 hover:text-primary border border-border text-xs font-mono transition-colors"
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Test Connection */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2"
                                            disabled={testingConnection || !current.llm_api_key || !current.llm_model}
                                            onClick={async () => {
                                                setTestingConnection(true);
                                                setTestResult(null);
                                                try {
                                                    const result = await SettingsService.testLlm(
                                                        current.llm_provider,
                                                        current.llm_api_key || "",
                                                        current.llm_model || ""
                                                    );
                                                    setTestResult(result);
                                                } catch (e: unknown) {
                                                    const msg = e instanceof Error ? e.message : "Unknown error";
                                                    setTestResult({ success: false, message: msg, response_time_ms: 0 });
                                                } finally {
                                                    setTestingConnection(false);
                                                }
                                            }}
                                        >
                                            {testingConnection ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                                            Test Connection
                                        </Button>
                                        {testResult && (
                                            <span className={`text-xs flex items-center gap-1.5 ${testResult.success ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                                                {testResult.success
                                                    ? <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                                                    : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                                                {testResult.message}
                                                {testResult.success && testResult.response_time_ms > 0 && (
                                                    <span className="text-muted-foreground">({testResult.response_time_ms}ms)</span>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Tailoring Mode */}
                        <section className="flex flex-col md:flex-row md:gap-12 gap-6 py-10 border-b border-border">
                            <div className="md:w-1/3">
                                <h3 className="text-base font-semibold">Tailoring Mode</h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Agentic mode runs a multi-step loop: the AI reads your context files, validates the YAML, and self-heals errors before submitting. Standard mode is a single fast LLM call.
                                </p>
                            </div>
                            <div className="md:w-2/3 space-y-3">
                                {(["agentic", "standard"] as const).map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => handleChange("tailor_mode", mode)}
                                        className={`w-full flex items-start gap-4 p-4 rounded-lg border text-left transition-all ${
                                            (current as AppSettings & { tailor_mode?: string }).tailor_mode === mode || (!((current as AppSettings & { tailor_mode?: string }).tailor_mode) && mode === "agentic")
                                                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                                : "border-border hover:border-primary/40 hover:bg-muted/30"
                                        }`}
                                    >
                                        <div className="mt-0.5 shrink-0">
                                            {mode === "agentic" ? (
                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                                    (current as AppSettings & { tailor_mode?: string }).tailor_mode === mode || (!((current as AppSettings & { tailor_mode?: string }).tailor_mode) && mode === "agentic")
                                                        ? "border-primary" : "border-muted-foreground"
                                                }`}>
                                                    {((current as AppSettings & { tailor_mode?: string }).tailor_mode === mode || (!((current as AppSettings & { tailor_mode?: string }).tailor_mode) && mode === "agentic")) && (
                                                        <div className="w-2 h-2 rounded-full bg-primary" />
                                                    )}
                                                </div>
                                            ) : (
                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                                    (current as AppSettings & { tailor_mode?: string }).tailor_mode === mode
                                                        ? "border-primary" : "border-muted-foreground"
                                                }`}>
                                                    {(current as AppSettings & { tailor_mode?: string }).tailor_mode === mode && (
                                                        <div className="w-2 h-2 rounded-full bg-primary" />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className={`text-sm font-semibold capitalize ${
                                                (current as AppSettings & { tailor_mode?: string }).tailor_mode === mode || (!((current as AppSettings & { tailor_mode?: string }).tailor_mode) && mode === "agentic")
                                                    ? "text-primary" : ""
                                            }`}>
                                                {mode === "agentic" ? "Agentic (Recommended)" : "Standard"}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {mode === "agentic"
                                                    ? "Multi-step loop · Reads context selectively · Self-heals YAML errors · Writes learnings to helper"
                                                    : "Single LLM call · Faster · No self-healing · All context loaded at once"}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Global AI Rules */}
                        <section
                            ref={globalRulesRef}
                            className={`flex flex-col md:flex-row md:gap-12 gap-6 py-10 rounded-lg transition-all duration-700 ${highlightGlobalRules ? "bg-primary/5 ring-1 ring-primary/20 px-4 -mx-4" : ""}`}
                        >
                            <div className="md:w-1/3">
                                <h3 className="text-base font-semibold">Global AI Rules</h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Rules applied to every AI request — resume tailoring, Q&amp;A generation, and chat. Add app-specific rules inside each job application.
                                </p>
                            </div>
                            <div className="md:w-2/3 space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder='e.g. NEVER use em dash (—) anywhere'
                                        value={newGlobalRuleText}
                                        onChange={(e) => setNewGlobalRuleText(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleAddGlobalRule()}
                                        className="flex-1"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={handleAddGlobalRule}
                                        disabled={addingGlobalRule || !newGlobalRuleText.trim()}
                                    >
                                        {addingGlobalRule ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    </Button>
                                </div>

                                {loadingGlobalRules ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : globalRules.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        No global rules yet. Rules you add here apply to all AI requests.
                                    </p>
                                ) : (
                                    <div className="space-y-1">
                                        {globalRules.map((rule) => (
                                            <div key={rule.id} className="flex items-center gap-3 py-2 px-1 group rounded-md hover:bg-muted/50">
                                                <Switch
                                                    checked={rule.is_enabled}
                                                    onCheckedChange={() => handleToggleGlobalRule(rule)}
                                                />
                                                <span className={`flex-1 text-sm ${rule.is_enabled ? "text-foreground" : "text-muted-foreground line-through"}`}>
                                                    {rule.rule_text}
                                                </span>
                                                <button
                                                    onClick={() => handleDeleteGlobalRule(rule.id)}
                                                    className="text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>
                    </TabsContent>

                    {/* ─────────── DATA TAB ─────────── */}
                    <TabsContent value="data" className="space-y-0">
                        {/* Export */}
                        <section className="flex flex-col md:flex-row md:gap-12 gap-6 py-10 border-b border-border">
                            <div className="md:w-1/3">
                                <h3 className="text-base font-semibold">Export</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Download all your application data.</p>
                            </div>
                            <div className="md:w-2/3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">Export All Data</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Download all applications as a JSON file.</p>
                                    </div>
                                    <Button variant="outline" size="sm" className="gap-2" onClick={handleExportData}>
                                        <Download className="h-4 w-4" />
                                        Export
                                    </Button>
                                </div>
                            </div>
                        </section>

                        {/* About */}
                        <section className="flex flex-col md:flex-row md:gap-12 gap-6 py-10">
                            <div className="md:w-1/3">
                                <h3 className="text-base font-semibold">About</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Application version and stack information.</p>
                            </div>
                            <div className="md:w-2/3 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Application</span>
                                    <span className="font-medium">ResuMate Career OS</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Version</span>
                                    <Badge variant="secondary">v0.1.0</Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Stack</span>
                                    <span className="text-muted-foreground">Next.js 16 + FastAPI</span>
                                </div>
                            </div>
                        </section>
                    </TabsContent>

                    {/* ─────────── PROMPTS TAB ─────────── */}
                    <TabsContent value="prompts" className="space-y-0">
                        <div className="py-6 border-b border-border mb-6">
                            <p className="text-sm text-muted-foreground">
                                System prompts sent to the LLM for each feature. Global rules are automatically appended.
                                Click a prompt to view or customize it — changes take effect on the next AI call.
                            </p>
                        </div>

                        {loadingPrompts ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : !promptsData ? (
                            <div className="py-16 text-center text-sm text-muted-foreground">
                                Click the Prompts tab to load prompts.
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                {PROMPT_KEYS.map((key) => {
                                    const info = promptsData.prompts[key];
                                    const label = PROMPT_LABELS[key];
                                    const isCustom = !!info?.custom;
                                    const Icon = label.icon;

                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setOpenPromptKey(key)}
                                            className="flex flex-col items-start gap-3 p-5 rounded-xl border border-border bg-card hover:bg-muted/40 hover:border-primary/30 hover:shadow-sm transition-all text-left group"
                                        >
                                            <div className={`p-2 rounded-lg bg-muted ${label.color}`}>
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-semibold">{label.title}</span>
                                                    {isCustom && (
                                                        <Badge variant="secondary" className="text-xs">Custom</Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{label.description}</p>
                                            </div>
                                            <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                                                Edit prompt <ChevronRight className="h-3 w-3" />
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </TabsContent>

                    {/* ─────────── PROMPT EDIT DIALOG ─────────── */}
                    {promptsData && openPromptKey && (() => {
                        const key = openPromptKey;
                        const info = promptsData.prompts[key];
                        const label = PROMPT_LABELS[key];
                        const isCustom = !!info?.custom;
                        const currentText = promptEdits[key] ?? info?.active ?? "";

                        return (
                            <Dialog open={true} onOpenChange={(open) => { if (!open) setOpenPromptKey(null); }}>
                                <DialogContent
                                    className="flex flex-col gap-0 p-0 overflow-hidden"
                                    style={{ maxWidth: "min(900px, 90vw)", width: "90vw", height: "min(820px, 90vh)", maxHeight: "90vh" }}
                                >
                                    <DialogHeader className="px-7 py-5 border-b border-border shrink-0">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg bg-muted ${label.color}`}>
                                                <label.icon className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <DialogTitle className="text-base font-semibold">{label.title}</DialogTitle>
                                                    {isCustom && (
                                                        <Badge variant="secondary" className="text-xs">Custom</Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5">{label.description}</p>
                                            </div>
                                        </div>
                                    </DialogHeader>

                                    <div className="flex-1 overflow-auto flex flex-col px-7 py-5 gap-4 min-h-0">
                                        <Textarea
                                            value={currentText}
                                            onChange={(e) =>
                                                setPromptEdits((prev) => ({ ...prev, [key]: e.target.value }))
                                            }
                                            className="font-mono text-xs resize-none w-full"
                                            spellCheck={false}
                                            style={{ flex: 1, minHeight: "360px" }}
                                        />

                                        <p className="text-xs text-muted-foreground shrink-0">
                                            Your{" "}
                                            <button
                                                onClick={handleGoToGlobalRules}
                                                className="underline underline-offset-2 decoration-muted-foreground/50 hover:text-foreground hover:decoration-foreground transition-colors"
                                            >
                                                Global Rules
                                            </button>
                                            {" "}are automatically appended to this prompt.
                                        </p>
                                    </div>

                                    <DialogFooter className="px-7 py-4 border-t border-border shrink-0 flex items-center justify-between sm:justify-between">
                                        <div>
                                            {isCustom && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleResetPrompt(key)}
                                                    disabled={resettingPrompt === key}
                                                    className="gap-1.5 text-muted-foreground"
                                                >
                                                    {resettingPrompt === key ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <RotateCcw className="h-3 w-3" />
                                                    )}
                                                    Reset to Default
                                                </Button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button size="sm" variant="ghost" onClick={() => setOpenPromptKey(null)}>
                                                Cancel
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={async () => { await handleSavePrompt(key); setOpenPromptKey(null); }}
                                                disabled={savingPrompt === key || currentText === info?.active}
                                                className="gap-1.5"
                                            >
                                                {savingPrompt === key ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Save className="h-3 w-3" />
                                                )}
                                                Save
                                            </Button>
                                        </div>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        );
                    })()}
                </Tabs>
            </div>

            {/* Floating save bar for General and AI tabs */}
            {dirty && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                    <div className="flex items-center gap-3 bg-foreground text-background px-4 py-2.5 rounded-full shadow-lg text-sm font-medium animate-in slide-in-from-bottom-2">
                        <span>You have unsaved changes</span>
                        <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 rounded-full px-3 bg-background text-foreground hover:bg-muted">
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                        </Button>
                    </div>
                </div>
            )}

            {/* Toast Notifications */}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-bottom-2 fade-in duration-200 flex items-center gap-2 ${
                            toast.variant === "error"
                                ? "bg-destructive text-destructive-foreground"
                                : toast.variant === "success"
                                ? "bg-green-600 text-white"
                                : "bg-foreground text-background"
                        }`}
                    >
                        {toast.variant === "success" && <CheckCircle className="h-4 w-4" />}
                        {toast.message}
                    </div>
                ))}
            </div>
        </CommandCenter>
    );
}
