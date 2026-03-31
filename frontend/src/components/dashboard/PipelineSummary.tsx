"use client";

import { useMemo } from "react";
import { ApplicationResponse, ApplicationStatus } from "@/types/application";
import { getPipelineCounts } from "@/lib/utils/dashboardStats";
import { cn } from "@/lib/utils";

interface PipelineSummaryProps {
    applications: ApplicationResponse[];
    onStatusFilter?: (status: ApplicationStatus | null) => void;
    activeFilter?: ApplicationStatus | null;
}

const PIPELINE_SEGMENTS = [
    {
        status: ApplicationStatus.DRAFT,
        label: "Draft",
        dotColor: "bg-emerald-400",
        countColor: "text-emerald-400",
    },
    {
        status: ApplicationStatus.APPLIED,
        label: "Applied",
        dotColor: "bg-blue-400",
        countColor: "text-blue-400",
    },
    {
        status: ApplicationStatus.SCREENING,
        label: "Screening",
        dotColor: "bg-amber-400",
        countColor: "text-amber-400",
    },
    {
        status: ApplicationStatus.INTERVIEWING,
        label: "Interview",
        dotColor: "bg-primary",
        countColor: "text-primary",
    },
    {
        status: ApplicationStatus.REJECTED,
        label: "Rejected",
        dotColor: "bg-red-400",
        countColor: "text-red-400",
    },
    {
        status: ApplicationStatus.GHOSTED,
        label: "Ghosted",
        dotColor: "bg-gray-400",
        countColor: "text-muted-foreground",
    },
];

export function PipelineSummary({ applications, onStatusFilter, activeFilter }: PipelineSummaryProps) {
    const counts = useMemo(() => getPipelineCounts(applications), [applications]);

    const handleClick = (status: ApplicationStatus) => {
        if (!onStatusFilter) return;
        onStatusFilter(activeFilter === status ? null : status);
    };

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
                <p className="text-sm font-semibold text-foreground">Application Pipeline</p>
            </div>

            {/* Horizontal segments */}
            <div className="flex divide-x divide-border">
                {PIPELINE_SEGMENTS.map(({ status, label, dotColor, countColor }) => {
                    const count = counts[status];
                    const isActive = activeFilter === status;

                    return (
                        <button
                            key={status}
                            onClick={() => handleClick(status)}
                            className={cn(
                                "flex-1 py-5 px-3 text-center cursor-pointer transition-colors relative",
                                isActive ? "bg-muted" : "hover:bg-muted/60"
                            )}
                        >
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
                                {label}
                            </p>
                            <p className={cn("text-2xl font-bold leading-none", countColor)}>
                                {count}
                            </p>
                            {/* Bottom dot indicator */}
                            <div className="flex justify-center mt-3">
                                <div className={cn("h-1.5 w-4 rounded-full", isActive ? dotColor : "bg-border")} />
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
