"use client";

import { cn } from "@/lib/utils";

// ── Primitive skeleton elements ──────────────────────────────────────────────

interface SkeletonProps {
    className?: string;
}

export function SkeletonLine({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                "h-3.5 rounded-full bg-muted animate-pulse",
                className
            )}
        />
    );
}

export function SkeletonBlock({ className }: SkeletonProps) {
    return (
        <div
            className={cn("rounded-lg bg-muted animate-pulse", className)}
        />
    );
}

// ── Skeleton Card: a box with a few lines inside ─────────────────────────────

interface SkeletonCardProps {
    lines?: number;
    className?: string;
    headerHeight?: string;
}

export function SkeletonCard({ lines = 3, className, headerHeight }: SkeletonCardProps) {
    return (
        <div
            className={cn(
                "rounded-lg border border-border bg-card p-4 space-y-3 animate-pulse",
                className
            )}
        >
            {headerHeight && <SkeletonBlock className={headerHeight} />}
            {Array.from({ length: lines }).map((_, i) => (
                <SkeletonLine
                    key={i}
                    className={i === lines - 1 ? "w-3/4" : i % 2 === 0 ? "w-full" : "w-5/6"}
                />
            ))}
        </div>
    );
}

// ── Skeleton Table: animated table rows ──────────────────────────────────────

interface SkeletonTableProps {
    rows?: number;
    cols?: number;
    className?: string;
}

export function SkeletonTable({ rows = 5, cols = 4, className }: SkeletonTableProps) {
    return (
        <div className={cn("animate-pulse", className)}>
            {Array.from({ length: rows }).map((_, rowIdx) => (
                <div
                    key={rowIdx}
                    className="flex items-center gap-4 border-b border-border px-6 py-4"
                >
                    {/* Avatar / icon column */}
                    <div className="h-10 w-10 rounded-lg bg-muted shrink-0" />
                    {/* Content columns */}
                    {Array.from({ length: cols - 1 }).map((_, colIdx) => (
                        <div key={colIdx} className="flex-1">
                            <SkeletonLine
                                className={
                                    colIdx === 0
                                        ? "w-32 mb-1.5"
                                        : colIdx === cols - 2
                                        ? "w-16"
                                        : "w-24"
                                }
                            />
                            {colIdx === 0 && <SkeletonLine className="w-20 mt-1" />}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

// ── Skeleton Paragraph: 3-4 lines of text ────────────────────────────────────

interface SkeletonParagraphProps {
    lines?: number;
    className?: string;
}

export function SkeletonParagraph({ lines = 4, className }: SkeletonParagraphProps) {
    return (
        <div className={cn("space-y-2 animate-pulse", className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <SkeletonLine
                    key={i}
                    className={i === lines - 1 ? "w-2/3" : "w-full"}
                />
            ))}
        </div>
    );
}

// ── Skeleton stat card ────────────────────────────────────────────────────────

export function SkeletonStatCard({ className }: SkeletonProps) {
    return (
        <div className={cn("rounded-lg border border-border bg-card p-5 animate-pulse space-y-3", className)}>
            <div className="flex items-center justify-between">
                <SkeletonLine className="w-28" />
                <div className="h-5 w-5 rounded bg-muted" />
            </div>
            <SkeletonLine className="w-16 h-8 rounded" />
        </div>
    );
}
