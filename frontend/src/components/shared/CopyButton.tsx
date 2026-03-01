"use client";

import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
    text: string;
    className?: string;
    label?: string; // optional visible label
}

export function CopyButton({ text, className, label }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(
        async (e: React.MouseEvent) => {
            e.stopPropagation();
            try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch {
                // Fallback for browsers without clipboard API
                const ta = document.createElement("textarea");
                ta.value = text;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        },
        [text]
    );

    return (
        <button
            onClick={handleCopy}
            className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs",
                "text-muted-foreground hover:text-foreground hover:bg-muted",
                "transition-colors duration-150 select-none",
                copied && "text-green-600 dark:text-green-400",
                className
            )}
            title={copied ? "Copied!" : "Copy to clipboard"}
            type="button"
        >
            {copied ? (
                <>
                    <Check className="h-3.5 w-3.5 shrink-0" />
                    {label !== undefined ? <span>Copied!</span> : null}
                </>
            ) : (
                <>
                    <Copy className="h-3.5 w-3.5 shrink-0" />
                    {label !== undefined ? <span>{label}</span> : null}
                </>
            )}
        </button>
    );
}
