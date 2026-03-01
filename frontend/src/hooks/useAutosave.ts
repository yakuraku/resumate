import { useState, useEffect, useRef, useCallback } from "react";
import type { SaveStatus } from "@/components/shared/SaveIndicator";

interface UseAutosaveOptions<T> {
    value: T;
    onSave: (value: T) => Promise<void>;
    debounceMs?: number;
    enabled?: boolean;
}

export function useAutosave<T>({
    value,
    onSave,
    debounceMs = 1500,
    enabled = true,
}: UseAutosaveOptions<T>) {
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
    const lastSavedRef = useRef<T>(value);
    const onSaveRef = useRef(onSave);
    const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Keep onSave ref current to avoid stale closure
    useEffect(() => {
        onSaveRef.current = onSave;
    });

    const clearSavedTimer = useCallback(() => {
        if (savedTimerRef.current) {
            clearTimeout(savedTimerRef.current);
            savedTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;

        // Don't trigger if value hasn't changed from last saved value
        if (value === lastSavedRef.current) return;

        setSaveStatus("saving");

        const timer = setTimeout(async () => {
            try {
                await onSaveRef.current(value);
                lastSavedRef.current = value;
                setSaveStatus("saved");

                clearSavedTimer();
                savedTimerRef.current = setTimeout(() => {
                    setSaveStatus("idle");
                }, 2000);
            } catch {
                setSaveStatus("error");

                // Retry once after 2 seconds
                setTimeout(async () => {
                    try {
                        await onSaveRef.current(value);
                        lastSavedRef.current = value;
                        setSaveStatus("saved");
                        clearSavedTimer();
                        savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
                    } catch {
                        setSaveStatus("error");
                    }
                }, 2000);
            }
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [value, debounceMs, enabled, clearSavedTimer]);

    // Reset lastSavedRef when enabled changes (e.g., entering edit mode with fresh value)
    useEffect(() => {
        if (enabled) {
            lastSavedRef.current = value;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    return { saveStatus };
}
