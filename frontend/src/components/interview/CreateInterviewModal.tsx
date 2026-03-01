import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { InterviewService } from "@/services/interview.service";
import { InterviewType } from "@/types/interview";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    applicationId: string;
    onSuccess: (sessionId: string) => void;
}

export function CreateInterviewModal({ open, onOpenChange, applicationId, onSuccess }: Props) {
    const [type, setType] = useState<InterviewType>(InterviewType.MIXED);
    const [persona, setPersona] = useState("Friendly Recruiter");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const session = await InterviewService.create({
                application_id: applicationId,
                interview_type: type,
                persona
            });
            onSuccess(session.id);
            onOpenChange(false);
        } catch (e) {
            console.error(e);
            alert("Failed to create session");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Start New Interview Session</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Interview Type</Label>
                        <select 
                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={type} 
                            onChange={(e) => setType(e.target.value as InterviewType)}
                        >
                            <option value={InterviewType.BEHAVIORAL}>Behavioral</option>
                            <option value={InterviewType.TECHNICAL}>Technical</option>
                            <option value={InterviewType.MIXED}>Mixed</option>
                        </select>
                    </div>
                   <div className="grid gap-2">
                        <Label>Interviewer Persona</Label>
                        <Input value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="e.g. Strict Tech Lead" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>{loading ? "Creating..." : "Start"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
