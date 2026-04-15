"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SetupService } from "@/services/setup.service";

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        SetupService.getStatus()
            .then(async (status) => {
                // Treat the user as set up if the wizard was explicitly dismissed
                // OR if they already have a master resume and an API key configured
                // (handles existing users who never clicked the final "Open Dashboard" button).
                const isReady =
                    status.wizard_dismissed ||
                    (status.master_resume_exists && status.api_key_configured);
                if (isReady) {
                    // Persist the dismissed flag so future startups skip this compound check.
                    if (!status.wizard_dismissed) {
                        try { await SetupService.dismissWizard(); } catch { /* non-blocking */ }
                    }
                    router.replace("/dashboard");
                } else {
                    router.replace("/setup");
                }
            })
            .catch(() => {
                // Backend not reachable yet -- send to setup as the safe default.
                router.replace("/setup");
            });
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
    );
}
