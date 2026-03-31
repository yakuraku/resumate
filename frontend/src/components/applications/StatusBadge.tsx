import { Badge } from "@/components/ui/badge";
import { ApplicationStatus } from "@/types/application";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
    status: ApplicationStatus;
    className?: string;
}

const statusStyles: Record<ApplicationStatus, string> = {
    [ApplicationStatus.DRAFT]: "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    [ApplicationStatus.APPLIED]: "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    [ApplicationStatus.SCREENING]: "bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
    [ApplicationStatus.INTERVIEWING]: "bg-violet-100 text-violet-700 hover:bg-violet-200 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800",
    [ApplicationStatus.OFFER]: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
    [ApplicationStatus.REJECTED]: "bg-red-100 text-red-700 hover:bg-red-200 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
    [ApplicationStatus.GHOSTED]: "bg-gray-100 text-gray-500 hover:bg-gray-200 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
};

const statusLabels: Record<ApplicationStatus, string> = {
    [ApplicationStatus.DRAFT]: "Draft",
    [ApplicationStatus.APPLIED]: "Applied",
    [ApplicationStatus.SCREENING]: "Screening",
    [ApplicationStatus.INTERVIEWING]: "Interviewing",
    [ApplicationStatus.OFFER]: "Offer Received",
    [ApplicationStatus.REJECTED]: "Rejected",
    [ApplicationStatus.GHOSTED]: "Ghosted",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
    return (
        <Badge
            variant="outline"
            className={cn(
                "capitalize font-medium border shadow-sm transition-all duration-200",
                statusStyles[status],
                className
            )}
        >
            {statusLabels[status]}
        </Badge>
    );
}
