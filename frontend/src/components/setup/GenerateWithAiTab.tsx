"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    AlertCircle,
    Bot,
    Check,
    CheckCircle2,
    ChevronRight,
    Copy,
    Loader2,
    RefreshCw,
    Sparkles,
    Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SetupService } from "@/services/setup.service";

// ── Types ──────────────────────────────────────────────────────────────────────

type GenPhase =
    | "idle"        // waiting for user input
    | "generating"  // first LLM call in progress
    | "retrying"    // subsequent fix attempt in progress
    | "success"     // validated and saved, PDF ready
    | "failed";     // all 3 attempts exhausted -- manual edit required

interface Props {
    /** True if an API key was saved in the previous wizard step. */
    apiKeyConfigured: boolean;
    /** Called whenever a new valid YAML has been saved (triggers PDF refresh). */
    onValidationSuccess: () => void;
}

// ── Prompt template for Path B (external LLM copy-paste flow) ─────────────────

const EXTERNAL_PROMPT = `Generate a professional master resume in RenderCV 2.3 YAML format.
RenderCV renders with Typst (not LaTeX). Return ONLY valid YAML -- no markdown fences, no explanation.

Required structure (include only sections for which real data exists):

cv:
  name: "Full Name"
  location: "City, State"
  email: email@example.com
  phone: "+1 555 000 0000"
  social_networks:
    - network: LinkedIn
      username: handle-only-not-full-url
    - network: GitHub
      username: handle-only-not-full-url

  sections:
    summary:
      - "One concise professional summary sentence."

    skills:
      - label: "Category Name"
        details: "skill1, skill2, skill3"

    experience:
      - company: "Company Name"
        position: "Job Title"
        location: "City, State"
        start_date: "YYYY-MM"
        end_date: "present"
        highlights:
          - "Action verb + what you achieved + measurable result"

    projects:
      - name: "Project Name"
        date: "YYYY"
        highlights:
          - "What it does and its impact"
        url: "https://..."

    education:
      - institution: "University Name"
        area: "Field of Study"
        degree: "BS"
        start_date: "YYYY-MM"
        end_date: "YYYY-MM"
        highlights:
          - "GPA: 3.9 / 4.0"

design:
  theme: classic
  page:
    show_last_updated_date: false

RULES:
1. Return ONLY the YAML. No \`\`\` fences. No text before or after.
2. Dates must be quoted strings: "YYYY-MM" (e.g. "2022-03") or "present".
3. Quote strings that contain colons, commas, hashes, or start with special characters.
4. social_networks: username/handle only -- never full URLs or domain names.
5. Only include sections with real data. Never invent or guess information.
6. skills must always use label+details pairs -- never plain strings.
7. For certifications, awards, or publications: use the projects format (name + date + highlights).
8. The design block is required -- always include it exactly as shown above.

Here is the information to convert:

`;

// ── Component ──────────────────────────────────────────────────────────────────

export function GenerateWithAiTab({ apiKeyConfigured, onValidationSuccess }: Props) {
    // Shared input
    const [rawContent, setRawContent] = useState("");

    // Path A state (in-app generation)
    const [phase, setPhase] = useState<GenPhase>("idle");
    const [attempt, setAttempt] = useState(0);
    const [generatedYaml, setGeneratedYaml] = useState("");
    const [validationError, setValidationError] = useState<string | null>(null);

    // Path B state (external copy-prompt)
    const [copySuccess, setCopySuccess] = useState(false);
    const [externalYaml, setExternalYaml] = useState("");
    const [extValidating, setExtValidating] = useState(false);
    const [extError, setExtError] = useState<string | null>(null);

    // Debounce ref for YAML editor auto-save
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Path A: Generate + auto-retry ─────────────────────────────────────────

    const handleGenerate = useCallback(async () => {
        if (!rawContent.trim()) return;

        setPhase("generating");
        setAttempt(1);
        setValidationError(null);
        setGeneratedYaml("");

        let lastYaml = "";
        let lastError = "";

        for (let i = 1; i <= 3; i++) {
            setAttempt(i);
            if (i > 1) setPhase("retrying");

            // Step 1: call LLM to generate (or fix) YAML
            let yamlFromLlm = "";
            try {
                const res = await SetupService.generateResumeYaml(
                    rawContent,
                    i > 1 ? lastYaml : undefined,
                    i > 1 ? lastError : undefined,
                );
                yamlFromLlm = res.yaml_content;
            } catch (err: unknown) {
                const msg =
                    (err as { response?: { data?: { detail?: string } } })
                        ?.response?.data?.detail ?? "Failed to reach the AI service. Please check your API key in Settings.";
                setPhase("failed");
                setValidationError(msg);
                return;
            }

            lastYaml = yamlFromLlm;

            // Step 2: validate + save (backend strips fences automatically)
            let validation: { valid: boolean; error?: string };
            try {
                validation = await SetupService.saveMasterResume(yamlFromLlm);
            } catch {
                setPhase("failed");
                setValidationError("Could not reach the server. Make sure the backend is running.");
                return;
            }

            if (validation.valid) {
                setGeneratedYaml(yamlFromLlm);
                setPhase("success");
                onValidationSuccess();
                return;
            }

            lastError = validation.error ?? "Validation failed.";

            if (i === 3) {
                // All attempts exhausted -- show last YAML for manual editing
                setGeneratedYaml(yamlFromLlm);
                setValidationError(lastError);
                setPhase("failed");
            }
        }
    }, [rawContent, onValidationSuccess]);

    // ── Path A: Debounced re-validate on YAML edit ─────────────────────────────

    const handleYamlEdit = useCallback(
        (newYaml: string) => {
            setGeneratedYaml(newYaml);
            setValidationError(null);

            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(async () => {
                try {
                    const result = await SetupService.saveMasterResume(newYaml);
                    if (result.valid) {
                        setValidationError(null);
                        setPhase("success");
                        onValidationSuccess();
                    } else {
                        setValidationError(result.error ?? "Validation failed.");
                        setPhase("failed");
                    }
                } catch {
                    setValidationError("Could not reach the server.");
                }
            }, 1500);
        },
        [onValidationSuccess],
    );

    useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

    // ── Path B: External LLM validate ─────────────────────────────────────────

    const handleCopyPrompt = useCallback(async () => {
        const full = EXTERNAL_PROMPT + (rawContent.trim() || "[PASTE YOUR RESUME / DETAILS HERE]");
        try {
            await navigator.clipboard.writeText(full);
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2500);
        } catch {
            // Clipboard API blocked -- silently ignore, user can manually copy
        }
    }, [rawContent]);

    const handleExternalValidate = useCallback(async () => {
        if (!externalYaml.trim()) return;
        setExtValidating(true);
        setExtError(null);
        try {
            const result = await SetupService.saveMasterResume(externalYaml);
            if (result.valid) {
                onValidationSuccess();
            } else {
                setExtError(result.error ?? "Validation failed.");
            }
        } catch {
            setExtError("Could not reach the server. Make sure the backend is running.");
        } finally {
            setExtValidating(false);
        }
    }, [externalYaml, onValidationSuccess]);

    // ── Render ─────────────────────────────────────────────────────────────────

    const isGenerating = phase === "generating" || phase === "retrying";
    const showYamlEditor = phase === "success" || phase === "failed";

    // ── Path A ─────────────────────────────────────────────────────────────────
    if (apiKeyConfigured) {
        return (
            <div className="flex flex-col gap-5">
                {/* Raw content input */}
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary" />
                        Tell us about yourself
                    </label>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Paste anything -- your existing resume text, work history, skills, projects, education. The more detail you provide, the better the result.
                    </p>
                    <Textarea
                        value={rawContent}
                        onChange={(e) => setRawContent(e.target.value)}
                        placeholder={`Paste your resume, LinkedIn bio, or write out your experience:\n\nName: ...\nEmail: ...\nWork Experience:\n  - Company: ...\n    Role: ...\n    Dates: ...\n    What I did: ...\nSkills: ...\nProjects: ...\nEducation: ...`}
                        className="min-h-[160px] font-mono text-xs resize-none bg-muted/20 leading-relaxed"
                        disabled={isGenerating}
                    />
                </div>

                {/* Generate button */}
                {!showYamlEditor && (
                    <Button
                        onClick={handleGenerate}
                        disabled={!rawContent.trim() || isGenerating}
                        className="gap-2 self-start"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {phase === "retrying"
                                    ? `Fixing issues... (attempt ${attempt} of 3)`
                                    : "Generating your resume..."}
                            </>
                        ) : (
                            <>
                                <Wand2 className="h-4 w-4" />
                                Generate Master Resume
                            </>
                        )}
                    </Button>
                )}

                {/* Generating progress note */}
                {isGenerating && (
                    <p className="text-xs text-muted-foreground">
                        This may take 15-30 seconds. Validating with RenderCV after generation...
                    </p>
                )}

                {/* YAML editor (shown after first generation attempt) */}
                {showYamlEditor && (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-foreground">
                                Generated YAML
                                {phase === "success" && (
                                    <span className="ml-2 text-xs font-medium text-green-600 dark:text-green-400">
                                        -- validated
                                    </span>
                                )}
                            </label>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setPhase("idle"); setGeneratedYaml(""); setValidationError(null); }}
                                className="text-xs text-muted-foreground gap-1 h-7"
                            >
                                <RefreshCw className="h-3 w-3" />
                                Regenerate
                            </Button>
                        </div>

                        <Textarea
                            value={generatedYaml}
                            onChange={(e) => handleYamlEdit(e.target.value)}
                            className="min-h-[280px] font-mono text-xs resize-none bg-muted/10 leading-relaxed"
                            spellCheck={false}
                        />

                        <p className="text-xs text-muted-foreground">
                            Edits auto-save after 1.5s and refresh the preview on the right.
                        </p>

                        {/* Validation status */}
                        {phase === "failed" && validationError && (
                            <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                                <div className="flex items-center gap-2 font-medium text-destructive">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {attempt >= 3
                                        ? "Could not auto-generate a valid resume after 3 attempts. Edit the YAML above to fix the issue."
                                        : "Validation failed."}
                                </div>
                                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                                    {validationError}
                                </pre>
                            </div>
                        )}

                        {phase === "success" && (
                            <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-2.5 text-sm text-green-700 dark:text-green-400">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                Resume validated and saved. Preview is live on the right.
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ── Path B: No API key ─────────────────────────────────────────────────────
    return (
        <div className="flex flex-col gap-6">
            {/* Explanation */}
            <div className="rounded-2xl border border-border bg-muted/20 px-5 py-4 flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-medium text-foreground">No API key configured</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        You skipped the AI Connection step. You can still generate your resume using ChatGPT, Claude, or Gemini -- just copy the prompt below, paste it along with your details, and bring back the YAML.
                    </p>
                </div>
            </div>

            {/* Step 1: raw content */}
            <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">
                    Step 1 -- Paste your details (optional but recommended)
                </p>
                <Textarea
                    value={rawContent}
                    onChange={(e) => setRawContent(e.target.value)}
                    placeholder="Paste your resume text, work history, skills, etc. The prompt will include this automatically."
                    className="min-h-[120px] text-xs resize-none bg-muted/20"
                />
            </div>

            {/* Step 2: copy prompt */}
            <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">Step 2 -- Copy the complete prompt</p>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={handleCopyPrompt}
                        className="gap-2"
                    >
                        {copySuccess ? (
                            <><Check className="h-4 w-4 text-green-500" /> Copied!</>
                        ) : (
                            <><Copy className="h-4 w-4" /> Copy Prompt</>
                        )}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                        Works with ChatGPT, Claude, Gemini
                    </span>
                </div>
            </div>

            {/* Step 3: paste YAML back */}
            <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">Step 3 -- Paste the YAML the AI returned</p>
                <Textarea
                    value={externalYaml}
                    onChange={(e) => { setExternalYaml(e.target.value); setExtError(null); }}
                    placeholder="Paste the full YAML here..."
                    className="min-h-[200px] font-mono text-xs resize-none bg-muted/20"
                    spellCheck={false}
                />

                {extError && (
                    <div className="flex flex-col gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                        <div className="flex items-center gap-2 font-medium text-destructive">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            Validation failed
                        </div>
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                            {extError}
                        </pre>
                    </div>
                )}

                <Button
                    onClick={handleExternalValidate}
                    disabled={!externalYaml.trim() || extValidating}
                    className="gap-2 self-start"
                >
                    {extValidating ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Validating...</>
                    ) : (
                        <><ChevronRight className="h-4 w-4" /> Validate &amp; Preview</>
                    )}
                </Button>
            </div>
        </div>
    );
}
