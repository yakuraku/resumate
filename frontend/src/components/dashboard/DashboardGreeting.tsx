"use client";

import { useMemo } from "react";
import { ApplicationResponse } from "@/types/application";
import { getThisWeekCount } from "@/lib/utils/dashboardStats";
import { cn } from "@/lib/utils";

interface DashboardGreetingProps {
    applications: ApplicationResponse[];
    weeklyGoal?: number;
}

export function DashboardGreeting({ applications, weeklyGoal = 15 }: DashboardGreetingProps) {
    const weekCount = useMemo(() => getThisWeekCount(applications), [applications]);

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";
        return "Good evening";
    }, []);

    const goalMet = weekCount >= weeklyGoal;
    const remaining = weeklyGoal - weekCount;
    const progressPercent = Math.min(100, Math.round((weekCount / weeklyGoal) * 100));

    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

    return (
        <div className="flex items-center justify-between gap-6">
            {/* Left: greeting */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
                    {greeting},{" "}
                    <span className="text-primary">Yash</span>
                    <span className="text-muted-foreground/50"> ✦</span>
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground max-w-lg">
                    {goalMet
                        ? "You've crushed your weekly goal — keep the momentum going."
                        : `${weekCount} application${weekCount !== 1 ? "s" : ""} this week — ${remaining} more to hit your goal of ${weeklyGoal}.`}
                </p>
            </div>

            {/* Right: weekly goal widget */}
            <div className="flex-shrink-0 bg-card border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm">
                {/* SVG ring */}
                <div className="relative flex items-center justify-center">
                    <svg width="72" height="72" className="-rotate-90" aria-hidden="true">
                        <circle
                            cx="36" cy="36" r={radius}
                            fill="none" strokeWidth="5"
                            className="stroke-muted"
                        />
                        <circle
                            cx="36" cy="36" r={radius}
                            fill="none" strokeWidth="5"
                            strokeLinecap="round"
                            stroke={goalMet ? "var(--color-emerald-500, #10b981)" : "var(--primary)"}
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            style={{ transition: "stroke-dashoffset 0.8s ease, stroke 0.4s ease" }}
                        />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                        <span className={cn(
                            "text-lg font-bold leading-none tabular-nums",
                            goalMet ? "text-emerald-500" : "text-foreground"
                        )}>
                            {weekCount}
                        </span>
                        <span className="text-[9px] text-muted-foreground leading-tight">/{weeklyGoal}</span>
                    </div>
                </div>

                <div>
                    <p className="text-xs font-semibold text-foreground">Weekly Goal</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{progressPercent}% complete</p>
                    {goalMet ? (
                        <p className="text-[11px] text-emerald-500 font-semibold mt-0.5">Goal reached!</p>
                    ) : (
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5">{remaining} to go</p>
                    )}
                </div>
            </div>
        </div>
    );
}
