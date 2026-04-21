"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Trash2, BookOpen, MessageSquare, HelpCircle, Mic, AlertTriangle } from "lucide-react";
import { getContrastColor } from "@/lib/utils";

interface DeleteApplicationModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    application: {
        role: string;
        company: string;
        color?: string | null;
    };
}

const DELETION_ITEMS = [
    { icon: MessageSquare, label: "Chat history & drafting sessions" },
    { icon: Mic, label: "Interview sessions & recordings" },
    { icon: HelpCircle, label: "Saved Q&A answers" },
    { icon: BookOpen, label: "Application details & notes" },
];

export function DeleteApplicationModal({
    open,
    onClose,
    onConfirm,
    application,
}: DeleteApplicationModalProps) {
    const [confirmText, setConfirmText] = useState("");
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const isConfirmed = confirmText === "DELETE";
    const avatarColor = application.color || "#64748b";
    const avatarTextColor = getContrastColor(avatarColor);

    useEffect(() => {
        if (open) {
            setConfirmText("");
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 80);
        }
    }, [open]);

    const handleConfirm = async () => {
        if (!isConfirmed || loading) return;
        setLoading(true);
        try {
            await onConfirm();
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && isConfirmed) handleConfirm();
        if (e.key === "Escape") onClose();
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onKeyDown={handleKeyDown}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={loading ? undefined : onClose}
                aria-hidden="true"
            />

            {/* Modal */}
            <div
                className="relative w-full max-w-md"
                style={{ animation: "deleteModalIn 0.18s ease-out both" }}
            >
                {/* Red top-border accent */}
                <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent" />

                <div className="relative rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
                    {/* Subtle red glow in top-left corner */}
                    <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 rounded-full bg-red-500/8 blur-2xl" />

                    <div className="p-6 space-y-5">
                        {/* Header */}
                        <div className="flex items-start gap-4">
                            <div
                                className="flex-shrink-0 flex items-center justify-center size-10 rounded-lg"
                                style={{ background: "color-mix(in srgb, var(--destructive) 12%, transparent)" }}
                            >
                                <Trash2 className="size-5 text-destructive" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-base font-semibold text-foreground leading-tight">
                                    Delete Application
                                </h2>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    This action cannot be undone.
                                </p>
                            </div>
                        </div>

                        {/* Application identity */}
                        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3.5 py-3">
                            <div
                                className="flex-shrink-0 flex items-center justify-center size-8 rounded-md text-sm font-bold shadow-sm"
                                style={{ backgroundColor: avatarColor, color: avatarTextColor }}
                            >
                                {application.company.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate leading-tight">
                                    {application.role}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {application.company}
                                </p>
                            </div>
                        </div>

                        {/* What gets deleted */}
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                The following will be permanently deleted
                            </p>
                            <div className="rounded-lg border border-red-500/20 bg-red-500/5 divide-y divide-red-500/10">
                                {DELETION_ITEMS.map(({ icon: Icon, label }) => (
                                    <div key={label} className="flex items-center gap-2.5 px-3 py-2">
                                        <Icon className="size-3.5 text-red-400 flex-shrink-0" />
                                        <span className="text-xs text-red-300/90">{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Resume save note */}
                        <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2.5">
                            <AlertTriangle className="size-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-300/90 leading-relaxed">
                                Any tailored resume (manually edited or AI-tailored) will be
                                automatically saved to your{" "}
                                <span className="font-medium text-blue-300">Resume Templates</span>{" "}
                                before deletion.
                            </p>
                        </div>

                        {/* Confirm input */}
                        <div className="space-y-2">
                            <label
                                htmlFor="delete-confirm-input"
                                className="block text-xs text-muted-foreground"
                            >
                                Type{" "}
                                <span className="font-mono font-semibold text-foreground tracking-widest">
                                    DELETE
                                </span>{" "}
                                to confirm
                            </label>
                            <input
                                id="delete-confirm-input"
                                ref={inputRef}
                                type="text"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                                placeholder="DELETE"
                                disabled={loading}
                                autoComplete="off"
                                spellCheck={false}
                                className={[
                                    "w-full rounded-lg border bg-background/60 px-3 py-2 text-sm font-mono tracking-widest",
                                    "placeholder:text-muted-foreground/40 placeholder:font-normal placeholder:tracking-normal",
                                    "outline-none transition-colors disabled:opacity-50",
                                    isConfirmed
                                        ? "border-red-500/60 text-red-400 focus:border-red-500"
                                        : "border-border text-foreground focus:border-red-500/40",
                                ].join(" ")}
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2.5 pt-1">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="flex-1 rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors disabled:opacity-40"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={!isConfirmed || loading}
                                className={[
                                    "flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                                    isConfirmed && !loading
                                        ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/30 cursor-pointer"
                                        : "bg-red-900/30 text-red-400/50 cursor-not-allowed",
                                ].join(" ")}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="size-3.5 animate-spin" />
                                        Deleting…
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="size-3.5" />
                                        Delete Application
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes deleteModalIn {
                    from { opacity: 0; transform: translateY(-8px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0)   scale(1); }
                }
            `}</style>
        </div>
    );
}
