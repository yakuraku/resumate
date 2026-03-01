"use client";

import { Loader2, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SaveIndicatorProps {
    status: SaveStatus;
    className?: string;
}

export function SaveIndicator({ status, className }: SaveIndicatorProps) {
    if (status === "idle") return null;

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 text-xs transition-opacity duration-300",
                status === "saving" && "text-muted-foreground",
                status === "saved" && "text-green-600 dark:text-green-400",
                status === "error" && "text-destructive",
                className
            )}
        >
            {status === "saving" && (
                <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving…
                </>
            )}
            {status === "saved" && (
                <>
                    <Check className="h-3 w-3" />
                    Saved
                </>
            )}
            {status === "error" && (
                <>
                    <AlertTriangle className="h-3 w-3" />
                    Save failed
                </>
            )}
        </span>
    );
}
