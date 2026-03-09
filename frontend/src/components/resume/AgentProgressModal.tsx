"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AgentEvent =
  | { type: "start"; model: string }
  | { type: "tool_call"; tool: string; args: Record<string, unknown> }
  | { type: "tool_result"; tool: string; summary: string; ok?: boolean }
  | { type: "complete"; yaml_content: string; reasoning: string }
  | { type: "persisted"; resume: unknown }
  | { type: "error"; message: string };

interface AgentProgressModalProps {
  open: boolean;
  events: AgentEvent[];
  model: string;
  onClose: () => void;
  onCheckResume: () => void;
  isComplete: boolean;
  hasError: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  read_tailor_helper: "Reading tailor helper...",
  list_context_files: "Listing context files...",
  read_context_file: "Reading context file",
  validate_yaml: "Validating YAML with RenderCV...",
  submit_tailored_resume: "Submitting tailored resume...",
};

function TerminalLine({ event }: { event: AgentEvent }) {
  if (event.type === "start") {
    return (
      <div className="flex gap-3 items-baseline">
        <span className="text-primary/60 font-mono text-xs select-none">$</span>
        <span className="text-muted-foreground text-xs">Initializing agentic tailor loop...</span>
      </div>
    );
  }

  if (event.type === "tool_call") {
    const label = TOOL_LABELS[event.tool] || `Calling ${event.tool}...`;
    const fileArg = (event.args as Record<string, string>).filename;
    return (
      <div className="flex gap-3 items-baseline">
        <span className="text-primary/60 font-mono text-xs select-none">$</span>
        <span className="text-foreground/80 text-xs">
          {label}
          {fileArg && <span className="text-primary ml-1 font-mono">{fileArg}</span>}
        </span>
      </div>
    );
  }

  if (event.type === "tool_result") {
    const isValidate = event.tool === "validate_yaml";
    const isError = isValidate && event.ok === false;
    return (
      <>
        <div className="flex gap-3 items-baseline">
          <span className={cn("text-xs select-none", isError ? "text-destructive" : "text-primary/60 font-mono")}>
            {isError ? "!" : "✓"}
          </span>
          <span className={cn("text-xs", isError ? "text-destructive/80" : "text-muted-foreground")}>
            {event.summary}
          </span>
          <span className={cn("ml-auto text-xs font-semibold", isError ? "text-destructive" : "text-emerald-500 dark:text-emerald-400")}>
            {isError ? "RETRYING" : "OK"}
          </span>
        </div>
        {isError && (
          <div className="pl-6 text-destructive/70 text-xs leading-relaxed font-mono mt-0.5">
            {event.summary.slice(0, 200)}
          </div>
        )}
      </>
    );
  }

  if (event.type === "complete") {
    return (
      <div className="flex gap-3 items-baseline">
        <span className="text-emerald-500 text-xs">✓</span>
        <span className="text-foreground text-xs font-semibold">Resume tailored successfully</span>
        <span className="ml-auto text-xs font-bold text-emerald-500">SUCCESS</span>
      </div>
    );
  }

  if (event.type === "error") {
    return (
      <div className="flex gap-3 items-baseline">
        <span className="text-destructive text-xs">✗</span>
        <span className="text-destructive/80 text-xs">{event.message.slice(0, 200)}</span>
      </div>
    );
  }

  return null;
}

export function AgentProgressModal({
  open,
  events,
  model,
  onClose,
  onCheckResume,
  isComplete,
  hasError,
}: AgentProgressModalProps) {
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  if (!open) return null;

  const isRunning = !isComplete && !hasError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-[780px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 rounded-md">
              <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-foreground">AI Tailor — Agentic Mode</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col sm:flex-row h-[440px]">
          {/* Left panel — animated visualization */}
          <div className="w-full sm:w-[38%] bg-background border-r border-border flex flex-col items-center justify-center relative overflow-hidden p-6">
            {/* Dot grid background */}
            <div className="absolute inset-0 dot-grid opacity-40" />

            {/* Animated rings */}
            <div className="relative flex items-center justify-center w-28 h-28 z-10">
              <div className={cn(
                "absolute w-28 h-28 rounded-full border border-primary/20",
                isRunning && "animate-[spin_12s_linear_infinite]"
              )} />
              <div className={cn(
                "absolute w-20 h-20 rounded-full border-t-2 border-primary/50",
                isRunning && "animate-[spin_8s_linear_infinite_reverse]"
              )} />
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                isComplete ? "bg-emerald-500/10 border border-emerald-500/30" :
                hasError ? "bg-destructive/10 border border-destructive/30" :
                "bg-primary/10 border border-primary/30"
              )}>
                {isComplete ? (
                  <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : hasError ? (
                  <svg className="h-4 w-4 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4 text-primary animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                )}
              </div>
            </div>

            {/* Status text */}
            <div className="mt-6 text-center z-10 space-y-1">
              <p className="text-xs font-semibold text-foreground/80 uppercase tracking-widest">
                {isComplete ? "Complete" : hasError ? "Failed" : "Processing"}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[160px]">
                {isComplete
                  ? "Your resume has been tailored and saved."
                  : hasError
                  ? "An error occurred during tailoring."
                  : "Agent is reading your context and tailoring your resume."}
              </p>
            </div>

            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t border-l border-border/60" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b border-r border-border/60" />
          </div>

          {/* Right panel — terminal log */}
          <div className="flex-1 bg-[#09090b] flex flex-col font-mono text-xs relative overflow-hidden">
            {/* Scanline overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.03]"
              style={{
                backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.8) 3px, rgba(255,255,255,0.8) 4px)",
              }}
            />

            <div
              ref={logRef}
              className="flex-1 overflow-y-auto p-4 space-y-2 pr-3"
            >
              {events.length === 0 ? (
                <div className="flex gap-3">
                  <span className="text-primary/60">$</span>
                  <span className="text-muted-foreground">Starting agent...</span>
                  <span className="ml-auto text-primary animate-pulse font-bold">▋</span>
                </div>
              ) : (
                events.map((event, i) => (
                  <TerminalLine key={i} event={event} />
                ))
              )}
              {isRunning && (
                <div className="flex gap-2 items-center">
                  <span className="text-primary animate-pulse font-bold">▋</span>
                </div>
              )}
            </div>

            {/* Footer bar */}
            <div className="border-t border-white/5 px-4 py-2.5 flex items-center justify-between bg-black/30">
              <div className="flex items-center gap-2">
                {/* Three vertical bars animation (like old Facebook loading) */}
                {isRunning ? (
                  <div className="flex items-end gap-0.5 h-3.5">
                    <div
                      className="w-0.5 bg-emerald-500 rounded-full"
                      style={{ height: "100%", animation: "fbBar 0.9s ease-in-out infinite", animationDelay: "0s" }}
                    />
                    <div
                      className="w-0.5 bg-emerald-500 rounded-full"
                      style={{ height: "100%", animation: "fbBar 0.9s ease-in-out infinite", animationDelay: "0.2s" }}
                    />
                    <div
                      className="w-0.5 bg-emerald-500 rounded-full"
                      style={{ height: "100%", animation: "fbBar 0.9s ease-in-out infinite", animationDelay: "0.4s" }}
                    />
                  </div>
                ) : isComplete ? (
                  <div className="flex items-end gap-0.5 h-3.5">
                    <div className="w-0.5 h-full bg-emerald-500 rounded-full" />
                    <div className="w-0.5 h-full bg-emerald-500 rounded-full" />
                    <div className="w-0.5 h-full bg-emerald-500 rounded-full" />
                  </div>
                ) : (
                  <div className="flex items-end gap-0.5 h-3.5">
                    <div className="w-0.5 h-full bg-destructive rounded-full" />
                    <div className="w-0.5 h-full bg-destructive rounded-full" />
                    <div className="w-0.5 h-full bg-destructive rounded-full" />
                  </div>
                )}
                <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                  {model}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3.5 bg-background border-t border-border flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            {isComplete || hasError ? "Close" : "Abort"}
          </Button>
          <Button
            size="sm"
            onClick={onCheckResume}
            disabled={!isComplete}
            className={cn(
              "text-xs gap-2 transition-all",
              isComplete
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                : "opacity-40 cursor-not-allowed"
            )}
          >
            Check Resume
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </Button>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes fbBar {
          0%, 100% { transform: scaleY(0.3); opacity: 0.5; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
