"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, ArrowRight } from "lucide-react";
import { ApplicationResponse, ApplicationStatus } from "@/types/application";
import { getRecentApplications } from "@/lib/utils/dashboardStats";
import { CreateApplicationModal } from "@/components/applications/CreateApplicationModal";
import { cn, getContrastColor } from "@/lib/utils";

interface TodaysFocusProps {
    applications: ApplicationResponse[];
    onRefetch: () => void;
}

// Hex fallback palette (used when app has no stored color)
const FALLBACK_COLORS = [
    "#3b82f6", // blue
    "#8b5cf6", // violet
    "#22c55e", // green
    "#f97316", // orange
    "#ec4899", // pink
    "#06b6d4", // cyan
];

function hashFallbackColor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length];
}

function getAppColor(app: ApplicationResponse): string {
    return app.color || hashFallbackColor(app.company);
}

function parseUtcDate(dateStr: string): Date {
    // If the string has no timezone indicator, treat it as UTC (backend stores UTC)
    if (dateStr && !dateStr.endsWith("Z") && !/[+-]\d{2}:?\d{2}$/.test(dateStr)) {
        return new Date(dateStr + "Z");
    }
    return new Date(dateStr);
}

function relativeTime(dateStr: string): string {
    const diff = Date.now() - parseUtcDate(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_LABELS: Record<string, string> = {
    [ApplicationStatus.DRAFT]: "Draft",
    [ApplicationStatus.APPLIED]: "Applied",
    [ApplicationStatus.SCREENING]: "Screening",
    [ApplicationStatus.INTERVIEWING]: "Interviewing",
    [ApplicationStatus.OFFER]: "Offer",
    [ApplicationStatus.REJECTED]: "Rejected",
    [ApplicationStatus.GHOSTED]: "Ghosted",
};

const STATUS_DOT: Record<string, string> = {
    [ApplicationStatus.DRAFT]: "bg-slate-400",
    [ApplicationStatus.APPLIED]: "bg-blue-400",
    [ApplicationStatus.SCREENING]: "bg-amber-400",
    [ApplicationStatus.INTERVIEWING]: "bg-violet-400",
    [ApplicationStatus.OFFER]: "bg-emerald-400",
    [ApplicationStatus.REJECTED]: "bg-red-400",
    [ApplicationStatus.GHOSTED]: "bg-gray-400",
};

export function TodaysFocus({ applications, onRefetch }: TodaysFocusProps) {
    const router = useRouter();
    const recent = useMemo(() => getRecentApplications(applications, 2), [applications]);

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div>
                <p className="text-sm font-semibold text-foreground">Today&apos;s Focus</p>
            </div>

            {/* Frosted glass CTA */}
            <CreateApplicationModal
                onSuccess={onRefetch}
                trigger={
                    <div className="relative overflow-hidden rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer group
                        bg-card/55 backdrop-blur-xl
                        border border-border/50
                        shadow-[0_4px_24px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.08)]
                        hover:bg-card/70 hover:border-border/70
                        hover:shadow-[0_8px_32px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.14)]
                        transition-all duration-300">
                        {/* Subtle shimmer accent */}
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full opacity-10 blur-2xl bg-primary group-hover:opacity-20 transition-opacity duration-300"
                        />
                        <div className="relative flex items-center justify-center size-12 rounded-xl bg-primary/10 backdrop-blur-sm border border-primary/20 mb-4 group-hover:bg-primary/15 transition-colors">
                            <ClipboardPaste size={20} className="text-primary" />
                        </div>
                        <h3 className="relative text-sm font-semibold text-foreground mb-1">
                            New Job Application
                        </h3>
                        <p className="relative text-xs text-muted-foreground max-w-xs">
                            AI will analyze fit and tailor your resume in seconds.
                        </p>
                    </div>
                }
            />

            {/* Recent application cards — 2-column grid */}
            {recent.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {recent.map((app) => {
                        const color = getAppColor(app);
                        return (
                            <button
                                key={app.id}
                                onClick={() => router.push(`/applications/${app.id}`)}
                                className="rounded-xl border border-border bg-card p-4 flex items-center gap-4 card-lift cursor-pointer text-left group overflow-hidden relative"
                                style={{
                                    borderLeftColor: color,
                                    borderLeftWidth: 3,
                                }}
                            >
                                {/* Subtle color wash behind the card */}
                                <div
                                    className="pointer-events-none absolute inset-0 opacity-[0.06] rounded-xl"
                                    style={{ backgroundColor: color }}
                                />
                                {/* Avatar */}
                                <div
                                    className="relative flex-shrink-0 flex items-center justify-center size-10 rounded-lg text-sm font-bold shadow-sm"
                                    style={{ backgroundColor: color, color: getContrastColor(color) }}
                                >
                                    {app.company.charAt(0).toUpperCase()}
                                </div>

                                {/* Text */}
                                <div className="relative min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                        {app.role}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                                        {app.company}
                                        <span className="mx-0.5">&bull;</span>
                                        <span className={cn("inline-block size-1.5 rounded-full flex-shrink-0", STATUS_DOT[app.status] ?? "bg-slate-400")} />
                                        {STATUS_LABELS[app.status] ?? app.status}
                                        <span className="mx-0.5">&bull;</span>
                                        {relativeTime(app.updated_at)}
                                    </p>
                                </div>

                                {/* Arrow */}
                                <ArrowRight size={14} className="relative text-muted-foreground/40 group-hover:text-primary/60 flex-shrink-0 transition-colors" />
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
