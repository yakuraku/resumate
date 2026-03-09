"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, ArrowRight } from "lucide-react";
import { ApplicationResponse } from "@/types/application";
import { getRecentDrafts } from "@/lib/utils/dashboardStats";
import { CreateApplicationModal } from "@/components/applications/CreateApplicationModal";
import { cn } from "@/lib/utils";

interface TodaysFocusProps {
    applications: ApplicationResponse[];
    onRefetch: () => void;
}

const COMPANY_COLORS = [
    "bg-blue-500",
    "bg-violet-500",
    "bg-emerald-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-cyan-500",
];

function hashColor(name: string, arr: string[]): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return arr[Math.abs(h) % arr.length];
}

function relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export function TodaysFocus({ applications, onRefetch }: TodaysFocusProps) {
    const router = useRouter();
    const drafts = useMemo(() => getRecentDrafts(applications, 2), [applications]);

    return (
        <div className="flex flex-col gap-4">
            {/* Header */}
            <div>
                <p className="text-sm font-semibold text-foreground">Today&apos;s Focus</p>
            </div>

            {/* Dashed CTA */}
            <CreateApplicationModal
                onSuccess={onRefetch}
                trigger={
                    <div className="border border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-muted/60 cursor-pointer transition-colors group">
                        <div className="flex items-center justify-center size-12 rounded-xl bg-muted group-hover:bg-muted/80 mb-4 transition-colors">
                            <ClipboardPaste size={20} className="text-primary" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground mb-1">
                            New Job Application
                        </h3>
                        <p className="text-xs text-muted-foreground max-w-xs">
                            AI will analyze fit and tailor your resume in seconds.
                        </p>
                    </div>
                }
            />

            {/* Draft cards — 2-column grid */}
            {drafts.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {drafts.map((draft) => (
                        <button
                            key={draft.id}
                            onClick={() => router.push(`/applications/${draft.id}`)}
                            className="rounded-xl border border-border bg-card p-4 flex items-center gap-4 card-lift cursor-pointer text-left group"
                        >
                            {/* Avatar */}
                            <div className={cn(
                                "flex-shrink-0 flex items-center justify-center size-10 rounded-lg text-white text-sm font-bold shadow-sm",
                                hashColor(draft.company, COMPANY_COLORS)
                            )}>
                                {draft.company.charAt(0).toUpperCase()}
                            </div>

                            {/* Text */}
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                    {draft.role}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                    {draft.company} &bull; Draft &bull; Edited {relativeTime(draft.updated_at)}
                                </p>
                            </div>

                            {/* Arrow */}
                            <ArrowRight size={14} className="text-muted-foreground/40 group-hover:text-primary/60 flex-shrink-0 transition-colors" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
