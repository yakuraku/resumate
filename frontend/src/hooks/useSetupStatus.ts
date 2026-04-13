"use client";

import { useCallback, useEffect, useState } from "react";
import { SetupService, SetupStatus } from "@/services/setup.service";

interface UseSetupStatusReturn {
    status: SetupStatus | null;
    loading: boolean;
    refresh: () => Promise<void>;
    /** True if any AI-dependent feature is blocked */
    aiBlocked: boolean;
    /** True if PDF/tailor is blocked (no master resume) */
    tailorBlocked: boolean;
    /** Human-readable list of what is missing */
    missingItems: string[];
}

export function useSetupStatus(): UseSetupStatusReturn {
    const [status, setStatus] = useState<SetupStatus | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const s = await SetupService.getStatus();
            setStatus(s);
        } catch {
            // Backend not ready yet -- treat as fully missing
            setStatus({
                master_resume_exists: false,
                context_files_exist: false,
                api_key_configured: false,
                wizard_dismissed: false,
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const missingItems: string[] = [];
    if (status && !status.master_resume_exists) missingItems.push("Master Resume");
    if (status && !status.context_files_exist) missingItems.push("Context Files");
    if (status && !status.api_key_configured) missingItems.push("API Key");

    const aiBlocked = !status || !status.api_key_configured || !status.master_resume_exists;
    const tailorBlocked = !status || !status.master_resume_exists;

    return { status, loading, refresh, aiBlocked, tailorBlocked, missingItems };
}
