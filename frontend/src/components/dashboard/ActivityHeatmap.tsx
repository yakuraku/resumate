"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ApplicationResponse } from "@/types/application";
import { getDailyCountsLast90Days } from "@/lib/utils/dashboardStats";
import { SkeletonBlock } from "@/components/shared/Skeletons";
import { cn } from "@/lib/utils";

interface ActivityHeatmapProps {
    applications: ApplicationResponse[];
    isLoading?: boolean;
}

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getCellColor(count: number, isToday: boolean): string {
    if (isToday) return "bg-card ring-2 ring-primary";
    if (count === 0) return "bg-muted/50";
    if (count <= 2) return "activity-low";
    if (count <= 5) return "activity-mid";
    return "bg-primary";
}

function getCellTextColor(count: number): string {
    if (count >= 6) return "text-primary-foreground font-semibold";
    return "text-foreground";
}

export function ActivityHeatmap({ applications, isLoading }: ActivityHeatmapProps) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [displayMonth, setDisplayMonth] = useState<Date>(() => {
        const d = new Date(today);
        d.setDate(1);
        return d;
    });

    // Build daily counts map from all applications (not just last 90 days, but we reuse the util)
    const dailyCounts = useMemo(() => {
        // Build our own map from all apps — not limited to 90 days
        const map = new Map<string, number>();
        applications.forEach((app) => {
            const dateStr = (app.applied_date || app.created_at.split("T")[0]);
            map.set(dateStr, (map.get(dateStr) || 0) + 1);
        });
        return map;
    }, [applications]);

    // Also keep getDailyCountsLast90Days for the total counter
    const last90 = useMemo(() => getDailyCountsLast90Days(applications), [applications]);
    const total90Days = useMemo(() => Array.from(last90.values()).reduce((s, v) => s + v, 0), [last90]);

    const { calendarDays, monthTitle } = useMemo(() => {
        const year = displayMonth.getFullYear();
        const month = displayMonth.getMonth();

        const title = displayMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const startDow = firstDayOfMonth.getDay(); // 0=Sun ... 6=Sat
        const daysInMonth = lastDayOfMonth.getDate();

        // Build array of cells: leading nulls + day numbers
        const cells: (number | null)[] = [];
        for (let i = 0; i < startDow; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);

        return { calendarDays: cells, monthTitle: title };
    }, [displayMonth]);

    const prevMonth = () => {
        setDisplayMonth((d) => {
            const nd = new Date(d);
            nd.setMonth(nd.getMonth() - 1);
            return nd;
        });
    };

    const nextMonth = () => {
        setDisplayMonth((d) => {
            const nd = new Date(d);
            nd.setMonth(nd.getMonth() + 1);
            return nd;
        });
    };

    const isCurrentMonth =
        displayMonth.getFullYear() === today.getFullYear() &&
        displayMonth.getMonth() === today.getMonth();

    if (isLoading) {
        return (
            <div className="rounded-xl border border-border bg-card p-6 h-full">
                <SkeletonBlock className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden h-full flex flex-col">
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={prevMonth}
                        className="flex items-center justify-center size-7 rounded-lg hover:bg-muted transition-colors"
                        aria-label="Previous month"
                    >
                        <ChevronLeft size={14} className="text-muted-foreground" />
                    </button>
                    <p className="text-sm font-semibold text-foreground min-w-[130px] text-center">
                        {monthTitle}
                    </p>
                    <button
                        onClick={nextMonth}
                        disabled={isCurrentMonth}
                        className="flex items-center justify-center size-7 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Next month"
                    >
                        <ChevronRight size={14} className="text-muted-foreground" />
                    </button>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>None</span>
                    <div className="size-3 rounded-sm bg-muted/50 border border-border" />
                    <div className="size-3 rounded-sm activity-low" />
                    <div className="size-3 rounded-sm activity-mid" />
                    <div className="size-3 rounded-sm bg-primary" />
                    <span>High</span>
                </div>
            </div>

            {/* Calendar grid */}
            <div className="p-4 flex-1">
                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                    {DAY_HEADERS.map((day) => (
                        <div key={day} className="text-center text-[10px] font-medium text-muted-foreground py-1">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, idx) => {
                        if (day === null) {
                            return <div key={`empty-${idx}`} className="h-10" />;
                        }

                        const year = displayMonth.getFullYear();
                        const month = displayMonth.getMonth();
                        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const count = dailyCounts.get(dateStr) || 0;

                        const isToday =
                            isCurrentMonth &&
                            day === today.getDate();

                        return (
                            <div
                                key={dateStr}
                                title={count > 0 ? `${count} application${count !== 1 ? "s" : ""}` : undefined}
                                className={cn(
                                    "h-10 rounded-lg flex flex-col items-center justify-center cursor-default transition-all",
                                    getCellColor(count, isToday)
                                )}
                            >
                                <span className={cn("text-xs leading-none", getCellTextColor(count), isToday && "text-primary font-semibold")}>
                                    {day}
                                </span>
                                {count > 0 && (
                                    <span className={cn("text-[9px] leading-none mt-0.5", count >= 6 ? "text-primary-foreground/80" : "text-primary/70")}>
                                        {count}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                    {total90Days} application{total90Days !== 1 ? "s" : ""} in the last 90 days
                </p>
            </div>
        </div>
    );
}
