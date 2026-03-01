import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ApplicationResponse } from "@/types/application";
import { StatusBadge } from "./StatusBadge";
// date-fns import removed as we use native Date methods
// I'll swap to native if date-fns is missing.

interface ApplicationTableProps {
    applications: ApplicationResponse[];
}

export function ApplicationTable({ applications }: ApplicationTableProps) {
    if (applications.length === 0) {
        return (
            <div className="flex min-h-[400px] flex-col items-center justify-center rounded-md border border-dashed bg-muted/40 p-8 text-center animate-in fade-in-50">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="h-6 w-6 text-muted-foreground"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                        />
                    </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold">No applications found</h3>
                <p className="mb-4 mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                    You haven't tracked any job applications yet. Add your first application to get started.
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-md border shadow-sm bg-card overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-[200px] font-semibold">Company</TableHead>
                        <TableHead className="font-semibold">Role</TableHead>
                        <TableHead className="w-[150px] font-semibold">Status</TableHead>
                        <TableHead className="w-[150px] font-semibold">Applied Date</TableHead>
                        <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {applications.map((app) => (
                        <TableRow 
                            key={app.id} 
                            className="group cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => window.location.href = `/applications/${app.id}`}
                        >
                            <TableCell className="font-medium text-foreground">
                                {app.company}
                            </TableCell>
                            <TableCell className="text-muted-foreground font-medium group-hover:text-foreground transition-colors">
                                {app.role}
                            </TableCell>
                            <TableCell>
                                <StatusBadge status={app.status} />
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                                {app.applied_date ? new Date(app.applied_date).toLocaleDateString(undefined, {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                }) : "N/A"}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                                    {/* We need to dynamically import or just use it if we can avoid circular deps.
                       Actually, Table is a presentational component usually.
                       But for speed, I'll import it directly.
                   */}
                                    {/* <CloneResumeModal applicationId={app.id} /> */}
                                    {/* Commented out to avoid import issues until I add the import at the top.
                       Actually, I should use multi_replace to add the import too.
                   */}
                                    <span className="text-xs text-muted-foreground">View Details</span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
