"use client";

import { useState, useEffect, useCallback } from "react";
import { ApplicationService } from "@/services/application.service";
import { ApplicationResponse } from "@/types/application";

export function useDashboardData() {
    const [applications, setApplications] = useState<ApplicationResponse[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await ApplicationService.getAll(1, 1000);
            setApplications(response.items);
        } catch (e) {
            setError("Failed to load applications");
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { applications, isLoading, error, refetch };
}
