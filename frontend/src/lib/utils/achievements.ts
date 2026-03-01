import { ApplicationResponse, ApplicationStatus } from "@/types/application";

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    gradient: string;
    iconColor: string;
    check: (apps: ApplicationResponse[], currentStreak: number, longestStreak: number) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
    {
        id: "first_app",
        name: "First App",
        description: "Submit your first application",
        icon: "Rocket",
        gradient: "from-blue-400 to-indigo-600",
        iconColor: "text-blue-400",
        check: (apps) => apps.length >= 1,
    },
    {
        id: "getting_started",
        name: "Getting Started",
        description: "Reach 5 total applications",
        icon: "Zap",
        gradient: "from-yellow-400 to-amber-500",
        iconColor: "text-yellow-400",
        check: (apps) => apps.length >= 5,
    },
    {
        id: "momentum",
        name: "Momentum",
        description: "Reach 25 total applications",
        icon: "TrendingUp",
        gradient: "from-green-400 to-emerald-600",
        iconColor: "text-green-400",
        check: (apps) => apps.length >= 25,
    },
    {
        id: "streak_7",
        name: "7-Day Streak",
        description: "Apply 7 days in a row",
        icon: "Flame",
        gradient: "from-orange-400 to-red-500",
        iconColor: "text-orange-400",
        check: (_apps, streak) => streak >= 7,
    },
    {
        id: "daily_grinder",
        name: "Daily Grinder",
        description: "Submit 5+ applications in a single day",
        icon: "Target",
        gradient: "from-purple-400 to-violet-600",
        iconColor: "text-purple-400",
        check: (apps) => {
            const counts: Record<string, number> = {};
            apps.forEach((a) => {
                const d = a.applied_date || a.created_at.split("T")[0];
                counts[d] = (counts[d] || 0) + 1;
            });
            return Object.values(counts).some((c) => c >= 5);
        },
    },
    {
        id: "hired",
        name: "Hired!",
        description: "Receive a job offer",
        icon: "Award",
        gradient: "from-yellow-300 to-yellow-600",
        iconColor: "text-yellow-400",
        check: (apps) => apps.some((a) => a.status === ApplicationStatus.OFFER),
    },
];
