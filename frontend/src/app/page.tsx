"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SetupService } from "@/services/setup.service";

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        SetupService.getStatus()
            .then((status) => {
                if (status.wizard_dismissed) {
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
