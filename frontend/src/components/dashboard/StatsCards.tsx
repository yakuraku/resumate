"use client";

import { useMemo } from "react";
import { ArrowUpRight, TrendingUp, Flame, Trophy } from "lucide-react";
import { ApplicationResponse } from "@/types/application";
import { getTodayCount, getThisWeekCount, getWeeklySparkline, getCurrentStreak, getLongestStreak } from "@/lib/utils/dashboardStats";
import { SkeletonStatCard } from "@/components/shared/Skeletons";
import { cn } from "@/lib/utils";

interface StatsCardsProps {
    applications: ApplicationResponse[];
    isLoading?: boolean;
}

export function StatsCards({ applications, isLoading }: StatsCardsProps) {
    const todayCount = useMemo(() => getTodayCount(applications), [applications]);
    const weekCount = useMemo(() => getThisWeekCount(applications), [applications]);
    const sparkline = useMemo(() => getWeeklySparkline(applications), [applications]);
    const currentStreak = useMemo(() => getCurrentStreak(applications), [applications]);
    const longestStreak = useMemo(() => getLongestStreak(applications), [applications]);

    const todayTarget = 5;
    const todayProgress = Math.min(100, Math.round((todayCount / todayTarget) * 100));
    const sparkMax = Math.max(...sparkline, 1);

    // Week-over-week change
    const prevWeekCount = sparkline[sparkline.length - 2] ?? 0;
    const weekChange = prevWeekCount === 0
        ? null
        : Math.round(((weekCount - prevWeekCount) / prevWeekCount) * 100);

    const streakDiff = longestStreak - currentStreak;

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
                <SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">

            {/* Card 1: Today's Applications */}
            <div className="bg-card border border-border rounded-xl p-5 card-lift flex flex-col justify-between">
                <div className="flex items-start justify-between mb-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Today&apos;s Applications
                    </p>
                    <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
                        <ArrowUpRight size={15} className="text-primary" />
                    </div>
                </div>
                <div>
                    <div className="flex items-baseline gap-1.5 mb-3">
                        <span className="text-3xl font-bold text-foreground">{todayCount}</span>
                        <span className="text-sm text-muted-foreground">/ {todayTarget} target</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-400 to-[#2dd4bf] transition-all duration-700"
                            style={{ width: `${todayProgress}%` }}
                        />
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">{todayProgress}% of daily target</p>
                </div>
            </div>

            {/* Card 2: This Week */}
            <div className="bg-card border border-border rounded-xl p-5 card-lift flex flex-col justify-between">
                <div className="flex items-start justify-between mb-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        This Week
                    </p>
                    <div className="flex items-center justify-center size-8 rounded-lg bg-violet-500/10">
                        <TrendingUp size={15} className="text-violet-400" />
                    </div>
                </div>
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-3xl font-bold text-foreground">{weekCount}</span>
                        <span className="text-xs text-muted-foreground">apps</span>
                        {weekChange !== null && (
                            <span className={cn(
                                "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                                weekChange >= 0
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : "bg-red-500/15 text-red-400"
                            )}>
                                {weekChange >= 0 ? "+" : ""}{weekChange}%
                            </span>
                        )}
                    </div>
                    {/* Sparkline */}
                    <div className="flex items-end gap-1 h-8">
                        {sparkline.map((val, i) => {
                            const heightPct = Math.max(12, Math.round((val / sparkMax) * 100));
                            const isLast = i === sparkline.length - 1;
                            return (
                                <div key={i} className="flex-1 flex flex-col justify-end">
                                    <div
                                        className={cn(
                                            "rounded-sm transition-all",
                                            isLast ? "bg-primary" : "bg-muted"
                                        )}
                                        style={{ height: `${heightPct}%` }}
                                        title={`Week ${i + 1}: ${val} apps`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Card 3: Current Streak */}
            <div className="bg-card border border-border rounded-xl p-5 card-lift flex flex-col justify-between">
                <div className="flex items-start justify-between mb-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Current Streak
                    </p>
                    <div className="flex items-center justify-center size-8 rounded-lg bg-orange-500/10">
                        <Flame size={15} className="text-orange-400" />
                    </div>
                </div>
                <div>
                    <div className="flex items-baseline gap-1.5 mb-1">
                        <span className="text-3xl font-bold text-foreground">{currentStreak}</span>
                        <span className="text-sm text-muted-foreground">days</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                        {currentStreak === 0
                            ? "Start your streak today!"
                            : streakDiff > 0
                            ? `${streakDiff} days away from your record`
                            : "Personal best — keep it up!"}
                    </p>
                </div>
            </div>

            {/* Card 4: Longest Streak */}
            <div className="bg-card border border-border rounded-xl p-5 card-lift flex flex-col justify-between">
                <div className="flex items-start justify-between mb-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Longest Streak
                    </p>
                    <div className="flex items-center justify-center size-8 rounded-lg bg-amber-500/10">
                        <Trophy size={15} className="text-amber-400" />
                    </div>
                </div>
                <div>
                    <div className="flex items-baseline gap-1.5 mb-1">
                        <span className="text-3xl font-bold text-foreground">{longestStreak}</span>
                        <span className="text-sm text-muted-foreground">days</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">All-time record</p>
                </div>
            </div>

        </div>
    );
}
