"use client";

import { useMemo } from "react";
import { ApplicationResponse } from "@/types/application";
import { getThisWeekCount } from "@/lib/utils/dashboardStats";
import { cn } from "@/lib/utils";

// ── Greeting pools ─────────────────────────────────────────────────────────
const GREETING_POOLS: Record<"night" | "morning" | "afternoon" | "evening", string[]> = {
    night: [
        "Burning midnight oil",
        "The world sleeps, legends don't",
        "Night owl mode activated",
        "Stars out, hustle on",
        "Late night, big moves",
    ],
    morning: [
        "Rise and conquer",
        "Fresh start incoming",
        "The early bird gets the offer letter",
        "Morning energy unlocked",
        "First one in, last one standing",
    ],
    afternoon: [
        "Midday momentum loading",
        "Afternoon grind, full power",
        "Lunch was fuel — now let's go",
        "Still crushing it",
        "Half the day gone, zero drive lost",
    ],
    evening: [
        "Evening shift, same hustle",
        "Golden hour grind",
        "Day's not done yet",
        "Still hunting, still winning",
        "The best moves happen after dark",
    ],
};

function getTimePeriod(): "night" | "morning" | "afternoon" | "evening" {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 22) return "evening";
    return "night";
}

// ── Sub-messages based on application state ────────────────────────────────
function getSubMessage(weekCount: number, remaining: number, goalMet: boolean, weeklyGoal: number) {
    if (goalMet) {
        const wins = [
            "You've crushed your weekly goal — keep the momentum going.",
            "Weekly goal smashed. You're on a different level.",
            "Goal reached. Now go for more.",
        ];
        return wins[weekCount % wins.length];
    }
    if (weekCount === 0) {
        return "No applications yet this week — let's change that today.";
    }
    if (remaining === 1) {
        return `One more application and you hit your weekly goal of ${weeklyGoal}. So close.`;
    }
    return `${weekCount} application${weekCount !== 1 ? "s" : ""} this week — ${remaining} more to hit your goal of ${weeklyGoal}.`;
}

// ── Component ───────────────────────────────────────────────────────────────

interface DashboardGreetingProps {
    applications: ApplicationResponse[];
    weeklyGoal?: number;
}

export function DashboardGreeting({ applications, weeklyGoal = 15 }: DashboardGreetingProps) {
    const weekCount = useMemo(() => getThisWeekCount(applications), [applications]);

    const greeting = useMemo(() => {
        const period = getTimePeriod();
        const pool = GREETING_POOLS[period];
        // Stable per hour — changes each hour so it feels fresh
        const idx = Math.floor(Date.now() / (1000 * 60 * 60)) % pool.length;
        return pool[idx];
    }, []);

    const goalMet = weekCount >= weeklyGoal;
    const remaining = weeklyGoal - weekCount;
    const progressPercent = Math.min(100, Math.round((weekCount / weeklyGoal) * 100));

    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

    const subMessage = useMemo(
        () => getSubMessage(weekCount, remaining, goalMet, weeklyGoal),
        [weekCount, remaining, goalMet, weeklyGoal]
    );

    return (
        <div className="flex items-center justify-between gap-6">
            {/* Left: greeting */}
            <div className="greeting-animate">
                {/* Subtle depth glow behind the heading */}
                <div className="relative inline-block">
                    {/* Blurred background glow — two layers for depth */}
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -inset-x-6 -inset-y-3 rounded-3xl opacity-25 blur-2xl"
                        style={{ background: "var(--primary)" }}
                    />
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -inset-x-2 -inset-y-1 rounded-xl opacity-10 blur-md"
                        style={{ background: "var(--primary)" }}
                    />
                    <h1 className="relative text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
                        {greeting},{" "}
                        <span className="shiny-name" style={{ fontWeight: "inherit", fontSize: "inherit" }}>
                            Yash
                        </span>
                        <span
                            className="text-muted-foreground/40"
                            style={{ WebkitTextFillColor: "unset" }}
                        >
                            {" "}✦
                        </span>
                    </h1>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground max-w-lg">
                    {subMessage}
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
