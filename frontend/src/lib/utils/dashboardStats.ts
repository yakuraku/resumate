import { ApplicationResponse, ApplicationStatus } from "@/types/application";

function getAppDate(app: ApplicationResponse): string {
    return app.applied_date || app.created_at.split("T")[0];
}

function toDateString(date: Date): string {
    return date.toISOString().split("T")[0];
}

function getMondayOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun, 1=Mon, ...6=Sat
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function getTodayCount(apps: ApplicationResponse[]): number {
    const today = toDateString(new Date());
    return apps.filter((a) => getAppDate(a) === today).length;
}

export function getThisWeekCount(apps: ApplicationResponse[]): number {
    const now = new Date();
    const monday = getMondayOfWeek(now);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return apps.filter((a) => {
        const d = new Date(getAppDate(a));
        return d >= monday && d <= sunday;
    }).length;
}

export function getWeeklySparkline(apps: ApplicationResponse[]): number[] {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const weeks: number[] = [];
    for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - i * 7 - now.getDay() + (now.getDay() === 0 ? -6 : 1));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const count = apps.filter((a) => {
            const d = new Date(getAppDate(a));
            return d >= weekStart && d <= weekEnd;
        }).length;
        weeks.push(count);
    }
    return weeks;
}

export function getCurrentStreak(apps: ApplicationResponse[]): number {
    if (apps.length === 0) return 0;

    const dateset = new Set(apps.map((a) => getAppDate(a)));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if we have today or yesterday to start the streak
    const todayStr = toDateString(today);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = toDateString(yesterday);

    let startDay: Date;
    if (dateset.has(todayStr)) {
        startDay = today;
    } else if (dateset.has(yesterdayStr)) {
        startDay = yesterday;
    } else {
        return 0;
    }

    let streak = 0;
    const cursor = new Date(startDay);
    while (dateset.has(toDateString(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
}

export function getLongestStreak(apps: ApplicationResponse[]): number {
    if (apps.length === 0) return 0;

    const dateset = new Set(apps.map((a) => getAppDate(a)));
    const sorted = Array.from(dateset).sort();

    let longest = 0;
    let current = 0;
    let prevDate: Date | null = null;

    for (const dateStr of sorted) {
        const d = new Date(dateStr);
        if (prevDate === null) {
            current = 1;
        } else {
            const diffMs = d.getTime() - prevDate.getTime();
            const diffDays = Math.round(diffMs / 86400000);
            if (diffDays === 1) {
                current++;
            } else {
                current = 1;
            }
        }
        if (current > longest) longest = current;
        prevDate = d;
    }
    return longest;
}

export function getDailyCountsLast90Days(apps: ApplicationResponse[]): Map<string, number> {
    const map = new Map<string, number>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Pre-fill all 90 days with 0
    for (let i = 89; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        map.set(toDateString(d), 0);
    }

    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() - 89);

    apps.forEach((a) => {
        const dateStr = getAppDate(a);
        const d = new Date(dateStr);
        if (d >= cutoff && d <= today) {
            map.set(dateStr, (map.get(dateStr) || 0) + 1);
        }
    });

    return map;
}

export function getPipelineCounts(apps: ApplicationResponse[]): Record<ApplicationStatus, number> {
    const counts: Record<ApplicationStatus, number> = {
        [ApplicationStatus.DRAFT]: 0,
        [ApplicationStatus.APPLIED]: 0,
        [ApplicationStatus.SCREENING]: 0,
        [ApplicationStatus.INTERVIEWING]: 0,
        [ApplicationStatus.OFFER]: 0,
        [ApplicationStatus.REJECTED]: 0,
        [ApplicationStatus.GHOSTED]: 0,
    };
    apps.forEach((a) => {
        const s = a.status as ApplicationStatus;
        if (s in counts) counts[s]++;
    });
    return counts;
}

export function getRecentDrafts(apps: ApplicationResponse[], n = 2): ApplicationResponse[] {
    return [...apps]
        .filter((a) => a.status === ApplicationStatus.DRAFT)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, n);
}

export function getRecentApplications(apps: ApplicationResponse[], n = 3): ApplicationResponse[] {
    return [...apps]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, n);
}
