"use client";

import { useMemo } from "react";
import { ArrowUpRight, Layers, Flame, Trophy } from "lucide-react";
import { ApplicationResponse, ApplicationStatus } from "@/types/application";
import { getTodayCount, getCurrentStreak, getLongestStreak } from "@/lib/utils/dashboardStats";
import { SkeletonStatCard } from "@/components/shared/Skeletons";
import { cn } from "@/lib/utils";

interface StatsCardsProps {
    applications: ApplicationResponse[];
    isLoading?: boolean;
}

export function StatsCards({ applications, isLoading }: StatsCardsProps) {
    const todayCount = useMemo(() => getTodayCount(applications), [applications]);
    const totalCount = applications.length;
    const activeCount = useMemo(() => applications.filter(a =>
        a.status === ApplicationStatus.APPLIED || a.status === ApplicationStatus.SCREENING || a.status === ApplicationStatus.INTERVIEWING || a.status === ApplicationStatus.OFFER
    ).length, [applications]);
    const currentStreak = useMemo(() => getCurrentStreak(applications), [applications]);
    const longestStreak = useMemo(() => getLongestStreak(applications), [applications]);

    const todayTarget = 5;
    const todayProgress = Math.min(100, Math.round((todayCount / todayTarget) * 100));

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

            {/* Card 2: All Applications */}
            <div className="bg-card border border-border rounded-xl p-5 card-lift flex flex-col justify-between">
                <div className="flex items-start justify-between mb-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        All Applications
                    </p>
                    <div className="flex items-center justify-center size-8 rounded-lg bg-violet-500/10">
                        <Layers size={15} className="text-violet-400" />
                    </div>
                </div>
                <div>
                    <div className="flex items-baseline gap-1.5 mb-1">
                        <span className="text-3xl font-bold text-foreground">{totalCount}</span>
                        <span className="text-sm text-muted-foreground">total</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                        {activeCount} active in pipeline
                    </p>
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
