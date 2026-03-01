"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { InterviewService } from "@/services/interview.service";
import { InterviewSession } from "@/types/interview";
import { InterviewSessionView } from "@/components/interview/InterviewSessionView";
import { CommandCenter } from "@/components/layout/CommandCenter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface PageProps {
    params: Promise<{ id: string; sessionId: string }>;
}

export default function InterviewSessionPage({ params }: PageProps) {
    const { id, sessionId } = use(params);
    const router = useRouter();
    const [session, setSession] = useState<InterviewSession | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSession();
    }, [sessionId]);

    const loadSession = async () => {
        try {
            const data = await InterviewService.getSession(sessionId);
            setSession(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8">Loading session...</div>;
    if (!session) return <div className="p-8">Session not found</div>;

    return (
        <CommandCenter>
             <div className="flex flex-col h-[calc(100vh-8rem)]">
                <div className="flex items-center gap-4 border-b pb-4 mb-4">
                     <Button variant="ghost" size="icon" onClick={() => router.push(`/applications/${id}`)}>
                        <ArrowLeft className="h-4 w-4" />
                     </Button>
                     <div>
                        <h1 className="text-xl font-bold capitalize">{session.interview_type} Interview</h1>
                        <p className="text-sm text-muted-foreground">{session.persona}</p>
                     </div>
                </div>
                
                <InterviewSessionView session={session} onUpdate={loadSession} />
             </div>
        </CommandCenter>
    );
}
