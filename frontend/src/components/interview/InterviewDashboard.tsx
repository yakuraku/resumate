import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InterviewService } from "@/services/interview.service";
import { InterviewSession } from "@/types/interview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, MessageSquare } from "lucide-react";
import { CreateInterviewModal } from "@/components/interview/CreateInterviewModal";
import { SkeletonCard } from "@/components/shared/Skeletons";

interface Props {
    applicationId: string;
}

export function InterviewDashboard({ applicationId }: Props) {
    const router = useRouter();
    const [sessions, setSessions] = useState<InterviewSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        loadSessions();
    }, [applicationId]);

    const loadSessions = async () => {
        try {
            const data = await InterviewService.getByApplication(applicationId);
            setSessions(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (sessionId: string) => {
        router.push(`/applications/${applicationId}/interview/${sessionId}`);
    };

    if (loading) {
        return (
            <div className="space-y-6 p-6 h-full overflow-y-auto">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="h-7 w-48 rounded bg-muted animate-pulse" />
                        <div className="h-4 w-72 rounded bg-muted animate-pulse" />
                    </div>
                    <div className="h-9 w-36 rounded-lg bg-muted animate-pulse" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <SkeletonCard key={i} lines={2} headerHeight="h-5 w-28" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6 h-full overflow-y-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Interview War Room</h2>
                    <p className="text-muted-foreground">Prepare for your interviews with AI-simulated sessions.</p>
                </div>
                <Button onClick={() => setShowCreateModal(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Start New Session
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sessions.map((session) => (
                    <Card
                        key={session.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors group"
                        onClick={() => router.push(`/applications/${applicationId}/interview/${session.id}`)}
                    >
                        <CardHeader>
                            <CardTitle className="capitalize flex items-center justify-between">
                                {session.interview_type}
                                <MessageSquare className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                            </CardTitle>
                            <CardDescription>{session.persona || "Standard Persona"}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-muted-foreground">
                                {session.questions.length} Questions
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {sessions.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 border border-dashed rounded-lg bg-muted/20 text-center space-y-4">
                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <MessageSquare className="h-8 w-8 text-primary/60" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">No interview sessions yet</h3>
                            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                                Practice makes perfect — start a mock interview tailored to this role and get AI feedback.
                            </p>
                        </div>
                        <Button onClick={() => setShowCreateModal(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Start First Session
                        </Button>
                    </div>
                )}
            </div>

            <CreateInterviewModal
                open={showCreateModal}
                onOpenChange={setShowCreateModal}
                applicationId={applicationId}
                onSuccess={handleCreate}
            />
        </div>
    );
}
