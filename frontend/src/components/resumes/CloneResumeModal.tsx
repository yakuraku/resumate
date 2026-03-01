"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Copy } from "lucide-react"

// Placeholder for now
interface CloneResumeModalProps {
    applicationId: string;
}

export function CloneResumeModal({ applicationId }: CloneResumeModalProps) {
    const [open, setOpen] = useState(false)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Copy className="h-4 w-4" />
                    Tailor Resume
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Tailor Resume</DialogTitle>
                    <DialogDescription>
                        Create a tailored version of your resume for this application.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Select Base Resume</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                            <option value="master">Master Resume (Default)</option>
                            <option disabled>Software Engineer v1 (Coming soon)</option>
                        </select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={() => setOpen(false)}>Create Tailored Version</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
