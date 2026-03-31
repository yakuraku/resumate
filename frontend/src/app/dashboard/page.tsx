"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo, useEffect, useRef } from "react";
import { Search, FileText, Plus, ArrowUpDown, LayoutDashboard, ScrollText, Settings, User, Pencil, X, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { ApplicationService } from "@/services/application.service";
import { CreateApplicationModal } from "@/components/applications/CreateApplicationModal";
import { DeleteApplicationModal } from "@/components/applications/DeleteApplicationModal";
import { ApplicationResponse, ApplicationStatus } from "@/types/application";
import { SkeletonTable } from "@/components/shared/Skeletons";
import { useDashboardData } from "@/hooks/useDashboardData";
import { getCurrentStreak, getLongestStreak, getPipelineCounts } from "@/lib/utils/dashboardStats";
import { DashboardGreeting } from "@/components/dashboard/DashboardGreeting";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { ActivityHeatmap } from "@/components/dashboard/ActivityHeatmap";
import { TodaysFocus } from "@/components/dashboard/TodaysFocus";
import { AchievementsBadges } from "@/components/dashboard/AchievementsBadges";
import { PipelineSummary } from "@/components/dashboard/PipelineSummary";
import { ThemeSelector } from "@/components/ThemeSelector";
import { DashboardBackground } from "@/components/dashboard/DashboardBackground";
import { cn, getContrastColor } from "@/lib/utils";

const PAGE_SIZE = 10;

type SortOption = "date_desc" | "date_asc" | "company_asc" | "company_desc" | "status";

const ALL_STATUSES = [
    ApplicationStatus.APPLIED,
    ApplicationStatus.SCREENING,
    ApplicationStatus.INTERVIEWING,
    ApplicationStatus.REJECTED,
    ApplicationStatus.GHOSTED,
    ApplicationStatus.DRAFT,
];

const SORT_LABELS: Record<SortOption, string> = {
    date_desc: "Date Applied (Newest)",
    date_asc: "Date Applied (Oldest)",
    company_asc: "Company A→Z",
    company_desc: "Company Z→A",
    status: "Status",
};

const STATUS_DOT_COLORS: Record<ApplicationStatus, string> = {
    [ApplicationStatus.APPLIED]: "bg-blue-400",
    [ApplicationStatus.SCREENING]: "bg-amber-400",
    [ApplicationStatus.INTERVIEWING]: "bg-violet-400",
    [ApplicationStatus.OFFER]: "bg-emerald-400",
    [ApplicationStatus.REJECTED]: "bg-red-400",
    [ApplicationStatus.GHOSTED]: "bg-gray-400",
    [ApplicationStatus.DRAFT]: "bg-slate-400",
};

const FALLBACK_COLORS = ["#3b82f6","#8b5cf6","#22c55e","#f97316","#ec4899","#06b6d4"];
function hashFallbackColor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length];
}
function getAppColor(app: { color?: string | null; company: string }): string {
    return app.color || hashFallbackColor(app.company);
}

const getStatusColor = (status: ApplicationStatus) => {
    switch (status) {
        case ApplicationStatus.APPLIED:
            return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
        case ApplicationStatus.SCREENING:
            return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
        case ApplicationStatus.INTERVIEWING:
            return "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800";
        case ApplicationStatus.OFFER:
            return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800";
        case ApplicationStatus.REJECTED:
            return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800";
        case ApplicationStatus.GHOSTED:
            return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700";
        default:
            return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
};

const getStatusDotColor = (status: ApplicationStatus) => {
    switch (status) {
        case ApplicationStatus.APPLIED: return "bg-blue-500";
        case ApplicationStatus.SCREENING: return "bg-amber-500";
        case ApplicationStatus.INTERVIEWING: return "bg-purple-500";
        case ApplicationStatus.OFFER: return "bg-green-500";
        case ApplicationStatus.REJECTED: return "bg-red-500";
        case ApplicationStatus.GHOSTED: return "bg-gray-500";
        default: return "bg-slate-500";
    }
};

export default function DashboardPage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    const { applications, isLoading, refetch } = useDashboardData();

    const [searchQuery, setSearchQuery] = useState("");
    const [sortOpen, setSortOpen] = useState(false);
    const [selectedStatuses, setSelectedStatuses] = useState<Set<ApplicationStatus>>(new Set());
    const [sortBy, setSortBy] = useState<SortOption>("date_desc");
    const [currentPage, setCurrentPage] = useState(1);
    const [pipelineFilter, setPipelineFilter] = useState<ApplicationStatus | null>(null);

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        const handler = () => setSortOpen(false);
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, []);

    // Toast
    const [toasts, setToasts] = useState<Array<{ id: string; message: string; variant: "default" | "error" }>>([]);
    const showToast = (message: string, variant: "default" | "error" = "default") => {
        const id = Math.random().toString(36).slice(2);
        setToasts((t) => [...t, { id, message, variant }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
    };

    // Delete modal
    const [deletingApp, setDeletingApp] = useState<ApplicationResponse | null>(null);
    const [editDropdownOpen, setEditDropdownOpen] = useState<string | null>(null);
    const editDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (editDropdownRef.current && !editDropdownRef.current.contains(e.target as Node)) {
                setEditDropdownOpen(null);
            }
        };
        if (editDropdownOpen) document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [editDropdownOpen]);

    const handleDeleteConfirm = async () => {
        if (!deletingApp) return;
        const result = await ApplicationService.delete(deletingApp.id);
        setDeletingApp(null);
        refetch();
        if (result.saved_template_name) {
            showToast(`Application deleted. Tailored resume saved as "${result.saved_template_name}" in Resume Templates.`);
        } else {
            showToast("Application deleted successfully.");
        }
    };

    // Rename state
    const [renamingApp, setRenamingApp] = useState<ApplicationResponse | null>(null);
    const [renameRole, setRenameRole] = useState("");
    const [renameCompany, setRenameCompany] = useState("");
    const [savingRename, setSavingRename] = useState(false);

    const openRenameModal = (app: ApplicationResponse, e: React.MouseEvent) => {
        e.stopPropagation();
        setRenamingApp(app);
        setRenameRole(app.role);
        setRenameCompany(app.company);
    };

    const handleRename = async () => {
        if (!renamingApp) return;
        const trimmedRole = renameRole.trim();
        const trimmedCompany = renameCompany.trim();
        if (!trimmedRole || !trimmedCompany) return;
        setSavingRename(true);
        try {
            await ApplicationService.update(renamingApp.id, { role: trimmedRole, company: trimmedCompany });
            setRenamingApp(null);
            refetch();
        } catch (error) {
            console.error("Failed to rename application:", error);
        } finally {
            setSavingRename(false);
        }
    };

    const toggleStatus = (status: ApplicationStatus) => {
        setSelectedStatuses((prev) => {
            const next = new Set(prev);
            if (next.has(status)) next.delete(status);
            else next.add(status);
            return next;
        });
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setSelectedStatuses(new Set());
        setPipelineFilter(null);
        setCurrentPage(1);
    };

    const handlePipelineFilter = (status: ApplicationStatus | null) => {
        setPipelineFilter(status);
        setSelectedStatuses(status === null ? new Set() : new Set([status]));
        setCurrentPage(1);
    };

    const filteredAndSorted = useMemo(() => {
        let list = [...applications];

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (app) =>
                    app.company.toLowerCase().includes(q) ||
                    app.role.toLowerCase().includes(q) ||
                    app.status.toLowerCase().includes(q)
            );
        }

        if (selectedStatuses.size > 0) {
            list = list.filter((app) => selectedStatuses.has(app.status as ApplicationStatus));
        }

        list.sort((a, b) => {
            switch (sortBy) {
                case "date_desc": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                case "date_asc": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                case "company_asc": return a.company.localeCompare(b.company);
                case "company_desc": return b.company.localeCompare(a.company);
                case "status": return a.status.localeCompare(b.status);
                default: return 0;
            }
        });

        return list;
    }, [applications, searchQuery, selectedStatuses, sortBy]);

    const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
    const pagedApplications = filteredAndSorted.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE
    );

    const totalApplications = applications.length;
    const currentStreak = useMemo(() => getCurrentStreak(applications), [applications]);
    const longestStreak = useMemo(() => getLongestStreak(applications), [applications]);
    const pipelineCounts = useMemo(() => getPipelineCounts(applications), [applications]);

    // suppress unused warnings
    void toggleStatus;
    void clearFilters;

    if (!mounted) return null;

    return (
        <div className="relative min-h-screen bg-background antialiased">
            {/* Background animation — type and enabled state from localStorage */}
            <DashboardBackground />

            {/* ── Header ── */}
            <header className="sticky top-0 z-50 w-full border-b border-border bg-background/85 backdrop-blur-md">
                <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8">
                    {/* Logo */}
                    <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center size-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
                            <FileText size={14} />
                        </div>
                        <span className="text-base font-bold tracking-tight text-foreground">
                            Resu<span className="text-primary">Mate</span>
                        </span>
                    </div>

                    {/* Nav + controls */}
                    <div className="flex items-center gap-1 sm:gap-2">
                        <nav className="hidden lg:flex items-center mr-3">
                            <Link
                                href="/dashboard"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-foreground bg-muted transition-colors"
                            >
                                <LayoutDashboard size={13} />
                                Dashboard
                            </Link>
                            <Link
                                href="/resumes"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                            >
                                <ScrollText size={13} />
                                Resumes
                            </Link>
                            <Link
                                href="/context"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                            >
                                <User size={13} />
                                My Context
                            </Link>
                            <Link
                                href="/settings"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                            >
                                <Settings size={13} />
                                Settings
                            </Link>
                        </nav>

                        <ThemeSelector />
                    </div>
                </div>
            </header>

            {/* ── Main ── */}
            <main className="relative z-10 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

                {/* Row 1: Greeting */}
                <DashboardGreeting applications={applications} />

                {/* Row 2: Stats + Heatmap */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5">
                        <StatsCards applications={applications} isLoading={isLoading} />
                    </div>
                    <div className="lg:col-span-7">
                        <ActivityHeatmap applications={applications} isLoading={isLoading} />
                    </div>
                </div>

                {/* Row 3: Today's Focus + Achievements */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8">
                        <TodaysFocus applications={applications} onRefetch={refetch} />
                    </div>
                    <div className="lg:col-span-4">
                        <AchievementsBadges
                            applications={applications}
                            currentStreak={currentStreak}
                            longestStreak={longestStreak}
                        />
                    </div>
                </div>

                {/* Row 4: Pipeline */}
                <PipelineSummary
                    applications={applications}
                    onStatusFilter={handlePipelineFilter}
                    activeFilter={pipelineFilter}
                />

                {/* Row 5: Applications Table */}
                <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                    {/* Table header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-b border-border">
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-sm font-semibold text-foreground">All Applications</h2>
                            <span className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                                {totalApplications}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            {/* Search */}
                            <div className="relative flex-1 sm:flex-initial">
                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/50 w-full sm:w-44 transition-colors"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                />
                            </div>

                            {/* Sort */}
                            <div className="relative" onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={() => setSortOpen((v) => !v)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted/50 transition-colors"
                                >
                                    <ArrowUpDown size={13} />
                                    <span className="hidden sm:inline">Sort</span>
                                </button>
                                {sortOpen && (
                                    <div className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-border bg-popover shadow-xl z-20 p-1.5">
                                        <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                            Sort by
                                        </p>
                                        {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([key, label]) => (
                                            <button
                                                key={key}
                                                onClick={() => { setSortBy(key); setSortOpen(false); }}
                                                className={cn(
                                                    "w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors",
                                                    sortBy === key
                                                        ? "bg-primary/10 text-primary font-medium"
                                                        : "text-foreground hover:bg-muted/60"
                                                )}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* New Application */}
                            <CreateApplicationModal
                                onSuccess={refetch}
                                trigger={
                                    <button className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm ml-auto sm:ml-0">
                                        <Plus size={14} />
                                        <span className="hidden sm:inline">New</span>
                                    </button>
                                }
                            />
                        </div>
                    </div>

                    {/* Status filter pills */}
                    <div className="px-6 py-2.5 border-b border-border flex items-center gap-1.5 overflow-x-auto">
                        <button
                            onClick={() => handlePipelineFilter(null)}
                            className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                                pipelineFilter === null
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            All
                            <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-full",
                                pipelineFilter === null ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                            )}>
                                {totalApplications}
                            </span>
                        </button>

                        {ALL_STATUSES.map((status) => (
                            <button
                                key={status}
                                onClick={() => handlePipelineFilter(pipelineFilter === status ? null : status)}
                                className={cn(
                                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                                    pipelineFilter === status
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", STATUS_DOT_COLORS[status])} />
                                {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
                                <span className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded-full",
                                    pipelineFilter === status ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                                )}>
                                    {pipelineCounts[status]}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/30">
                                <tr>
                                    <th className="py-2.5 px-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground" scope="col">
                                        Role &amp; Company
                                    </th>
                                    <th className="py-2.5 px-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground" scope="col">
                                        Status
                                    </th>
                                    <th className="py-2.5 px-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground" scope="col">
                                        Date Applied
                                    </th>
                                    <th className="py-2.5 px-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground" scope="col">
                                        Location
                                    </th>
                                    <th className="py-2.5 px-6 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground" scope="col">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="p-0">
                                            <SkeletonTable rows={6} cols={5} />
                                        </td>
                                    </tr>
                                ) : pagedApplications.length === 0 ? (
                                    <tr>
                                        <td colSpan={5}>
                                            {filteredAndSorted.length === 0 && (selectedStatuses.size > 0 || searchQuery) ? (
                                                <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                                                    No applications match your filters.
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-4">
                                                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                                                        <FileText size={28} className="text-muted-foreground" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-base font-semibold text-foreground">No applications yet</h3>
                                                        <p className="mt-1 text-sm text-muted-foreground">
                                                            Start your job search by adding your first application.
                                                        </p>
                                                    </div>
                                                    <CreateApplicationModal
                                                        onSuccess={refetch}
                                                        trigger={
                                                            <button className="inline-flex items-center gap-2 rounded-lg bg-primary hover:bg-primary/90 px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors shadow-sm">
                                                                <Plus size={16} />
                                                                New Application
                                                            </button>
                                                        }
                                                    />
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ) : (
                                    pagedApplications.map((app) => (
                                        <tr
                                            key={app.id}
                                            onClick={() => router.push(`/applications/${app.id}`)}
                                            className="hover:bg-muted/25 transition-colors group cursor-pointer"
                                        >
                                            <td className="px-6 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="flex h-8 w-8 flex-none items-center justify-center rounded-lg font-bold text-xs shadow-sm"
                                                        style={{
                                                            backgroundColor: getAppColor(app),
                                                            color: getContrastColor(getAppColor(app)),
                                                        }}
                                                    >
                                                        {app.company.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-sm text-foreground leading-tight">
                                                            {app.role}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground mt-0.5">
                                                            {app.company}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <span className={cn(
                                                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border",
                                                    getStatusColor(app.status as ApplicationStatus)
                                                )}>
                                                    <span className={cn("h-1.5 w-1.5 rounded-full", getStatusDotColor(app.status as ApplicationStatus))} />
                                                    {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5 whitespace-nowrap text-sm text-muted-foreground">
                                                {app.applied_date
                                                    ? new Date(app.applied_date).toLocaleDateString()
                                                    : "—"}
                                            </td>
                                            <td className="px-6 py-3.5 whitespace-nowrap text-sm text-muted-foreground">
                                                {app.location || <span className="text-muted-foreground/40 italic text-xs">Not specified</span>}
                                            </td>
                                            <td className="px-6 py-3.5 text-right">
                                                <div
                                                    className="relative flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity"
                                                    ref={editDropdownOpen === app.id ? editDropdownRef : undefined}
                                                >
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditDropdownOpen(editDropdownOpen === app.id ? null : app.id);
                                                        }}
                                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                                        title="Edit"
                                                    >
                                                        <MoreHorizontal size={14} />
                                                    </button>
                                                    {editDropdownOpen === app.id && (
                                                        <div
                                                            className="absolute right-0 top-full mt-1 z-30 w-40 rounded-lg border border-border bg-card shadow-lg py-1"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button
                                                                onClick={(e) => {
                                                                    setEditDropdownOpen(null);
                                                                    openRenameModal(app, e);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                                                            >
                                                                <Pencil size={13} />
                                                                Edit Details
                                                            </button>
                                                            <div className="my-1 border-t border-border" />
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditDropdownOpen(null);
                                                                    setDeletingApp(app);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                                                            >
                                                                <Trash2 size={13} />
                                                                Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between border-t border-border bg-muted/20 px-6 py-3">
                        <p className="text-xs text-muted-foreground">
                            {filteredAndSorted.length === 0 ? (
                                "No results"
                            ) : (
                                <>
                                    Showing{" "}
                                    <span className="font-medium text-foreground">{(currentPage - 1) * PAGE_SIZE + 1}</span>
                                    {" "}–{" "}
                                    <span className="font-medium text-foreground">{Math.min(currentPage * PAGE_SIZE, filteredAndSorted.length)}</span>
                                    {" "}of{" "}
                                    <span className="font-medium text-foreground">{filteredAndSorted.length}</span>
                                    {selectedStatuses.size > 0 || searchQuery ? ` (filtered from ${totalApplications})` : ""}
                                </>
                            )}
                        </p>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="rounded-lg border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-muted/50 disabled:opacity-40 transition-colors"
                            >
                                Previous
                            </button>
                            <span className="text-xs text-muted-foreground px-1.5 tabular-nums">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="rounded-lg border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-muted/50 disabled:opacity-40 transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Delete Modal */}
            {deletingApp && (
                <DeleteApplicationModal
                    open={true}
                    onClose={() => setDeletingApp(null)}
                    onConfirm={handleDeleteConfirm}
                    application={deletingApp}
                />
            )}

            {/* Toasts */}
            <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={[
                            "px-4 py-3 rounded-lg border shadow-lg text-sm max-w-sm pointer-events-auto",
                            t.variant === "error"
                                ? "bg-red-900/90 border-red-700 text-red-100"
                                : "bg-card border-border text-foreground",
                        ].join(" ")}
                    >
                        {t.message}
                    </div>
                ))}
            </div>

            {/* Rename Modal */}
            {renamingApp && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={() => !savingRename && setRenamingApp(null)}
                >
                    <div
                        className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl p-6 space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-semibold text-foreground">Rename Application</h2>
                            <button
                                onClick={() => setRenamingApp(null)}
                                disabled={savingRename}
                                className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Role / Job Title</label>
                                <input
                                    autoFocus
                                    value={renameRole}
                                    onChange={(e) => setRenameRole(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenamingApp(null); }}
                                    className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/50 transition-colors"
                                    placeholder="e.g. Senior Software Engineer"
                                    disabled={savingRename}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Company</label>
                                <input
                                    value={renameCompany}
                                    onChange={(e) => setRenameCompany(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenamingApp(null); }}
                                    className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/50 transition-colors"
                                    placeholder="e.g. Acme Corp"
                                    disabled={savingRename}
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                                onClick={() => setRenamingApp(null)}
                                disabled={savingRename}
                                className="px-3 py-1.5 text-sm rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRename}
                                disabled={savingRename || !renameRole.trim() || !renameCompany.trim()}
                                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                            >
                                {savingRename && <Loader2 size={13} className="animate-spin" />}
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
