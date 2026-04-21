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
            .catch((error) => {
                // Network error (backend not reachable): send to /setup so the
                // first-run wizard loads when the server comes up.
                // HTTP error with a response (e.g. 500): the server is up but
                // broken -- do NOT send to /setup (would look like a fresh install).
                // Redirect to /login so the user can try again once the server recovers.
                if (error?.response) {
                    router.replace("/login");
                } else {
                    router.replace("/setup");
                }
            });
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
    );
}
