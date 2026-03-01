"use client";

import { useMemo } from "react";
import { Rocket, Zap, TrendingUp, Flame, Target, Award, Lock } from "lucide-react";
import { ApplicationResponse } from "@/types/application";
import { ACHIEVEMENTS } from "@/lib/utils/achievements";
import { cn } from "@/lib/utils";

interface AchievementsBadgesProps {
    applications: ApplicationResponse[];
    currentStreak: number;
    longestStreak: number;
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    Rocket, Zap, TrendingUp, Flame, Target, Award,
};

// Map gradient strings to border/bg color classes for unlocked state
const BADGE_BORDER_COLORS: Record<string, string> = {
    "from-blue-400 to-indigo-600": "border-blue-500/50 bg-blue-500/10",
    "from-yellow-400 to-amber-500": "border-amber-500/50 bg-amber-500/10",
    "from-green-400 to-emerald-600": "border-emerald-500/50 bg-emerald-500/10",
    "from-orange-400 to-red-500": "border-orange-500/50 bg-orange-500/10",
    "from-purple-400 to-violet-600": "border-violet-500/50 bg-violet-500/10",
    "from-yellow-300 to-yellow-600": "border-yellow-500/50 bg-yellow-500/10",
};

export function AchievementsBadges({ applications, currentStreak, longestStreak }: AchievementsBadgesProps) {
    const unlockedIds = useMemo(
        () => new Set(ACHIEVEMENTS.filter((a) => a.check(applications, currentStreak, longestStreak)).map((a) => a.id)),
        [applications, currentStreak, longestStreak]
    );
    const unlockedCount = unlockedIds.size;

    return (
        <div className="rounded-xl border border-border bg-card p-5 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-foreground">Achievements</p>
                <span className="text-xs text-muted-foreground">
                    {unlockedCount} / {ACHIEVEMENTS.length}
                </span>
            </div>

            {/* Badge grid — 3 columns, 2 rows */}
            <div className="grid grid-cols-3 gap-3 flex-1">
                {ACHIEVEMENTS.map((achievement) => {
                    const unlocked = unlockedIds.has(achievement.id);
                    const IconComponent = ICON_MAP[achievement.icon];
                    const borderBg = BADGE_BORDER_COLORS[achievement.gradient] || "border-primary/50 bg-primary/10";

                    return (
                        <div
                            key={achievement.id}
                            title={achievement.description}
                            className={cn(
                                "flex flex-col items-center gap-2 text-center p-3 rounded-xl transition-all",
                                unlocked ? "opacity-100" : "opacity-30"
                            )}
                        >
                            {unlocked ? (
                                <div className={cn(
                                    "size-12 rounded-full border-2 flex items-center justify-center",
                                    borderBg
                                )}>
                                    {IconComponent && (
                                        <IconComponent size={20} className={achievement.iconColor} />
                                    )}
                                </div>
                            ) : (
                                <div className="size-12 rounded-full border-2 border-dashed border-border bg-muted/50 flex items-center justify-center">
                                    <Lock size={14} className="text-muted-foreground" />
                                </div>
                            )}
                            <p className="text-[10px] font-medium text-foreground leading-tight">
                                {achievement.name}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
