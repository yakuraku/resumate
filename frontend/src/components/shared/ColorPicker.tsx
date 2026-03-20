"use client";

import { useRef, useState, useEffect } from "react";
import { Pipette } from "lucide-react";
import { cn } from "@/lib/utils";

export const PRESET_COLORS = [
    "#ef4444", // red
    "#f97316", // orange
    "#eab308", // yellow
    "#22c55e", // green
    "#14b8a6", // teal
    "#3b82f6", // blue
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#f43f5e", // rose
    "#06b6d4", // cyan
    "#84cc16", // lime
    "#64748b", // slate
];

export function randomPresetColor(): string {
    return PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
}

interface ColorPickerProps {
    value: string | null | undefined;
    onChange: (color: string) => void;
    /**
     * Called with `true` when the native OS color picker dialog opens,
     * and `false` when it closes. Parents use this to suppress their
     * outside-click handler while the native dialog is active.
     */
    onNativePickerActiveChange?: (active: boolean) => void;
}

export function ColorPicker({ value, onChange, onNativePickerActiveChange }: ColorPickerProps) {
    const nativeInputRef = useRef<HTMLInputElement>(null);

    // Live preview value while the native dialog is open (updated on every drag).
    // We do NOT call the parent's onChange during live preview — only on commit
    // (the DOM "change" event), so the parent never closes the picker mid-interaction.
    const [liveValue, setLiveValue] = useState<string | null>(null);
    const displayValue = liveValue ?? value ?? "#3b82f6";

    // Use refs so the DOM event listener never captures a stale closure
    const onChangeRef = useRef(onChange);
    const onNativeRef = useRef(onNativePickerActiveChange);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
    useEffect(() => { onNativeRef.current = onNativePickerActiveChange; }, [onNativePickerActiveChange]);

    useEffect(() => {
        const input = nativeInputRef.current;
        if (!input) return;

        // DOM "change" fires exactly once when the color dialog is confirmed/closed.
        // This is the commit event — call the parent onChange here.
        const handleCommit = () => {
            onChangeRef.current(input.value);
            setLiveValue(null);
            onNativeRef.current?.(false);
        };

        // DOM "cancel" fires on some browsers when the dialog is dismissed without picking.
        const handleCancel = () => {
            setLiveValue(null);
            onNativeRef.current?.(false);
        };

        input.addEventListener("change", handleCommit);
        input.addEventListener("cancel", handleCancel);
        return () => {
            input.removeEventListener("change", handleCommit);
            input.removeEventListener("cancel", handleCancel);
        };
    }, []); // intentionally empty — uses refs for callbacks

    const openNativePicker = () => {
        onNativePickerActiveChange?.(true);
        setLiveValue(value ?? "#3b82f6");
        nativeInputRef.current?.click();
    };

    // React onChange fires on every DOM "input" event (every drag/keystroke inside
    // the native dialog). We use this ONLY for the local live preview swatch —
    // never to notify the parent, so the parent never closes the picker mid-drag.
    const handleLiveInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLiveValue(e.target.value);
    };

    // Fallback: if the browser fires blur when the dialog is dismissed
    const handleBlur = () => {
        setLiveValue(null);
        onNativePickerActiveChange?.(false);
    };

    return (
        <div className="p-3 bg-popover border border-border rounded-xl shadow-lg w-52">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5">
                Choose colour
            </p>
            <div className="grid grid-cols-6 gap-1.5 mb-2">
                {PRESET_COLORS.map((color) => (
                    <button
                        key={color}
                        type="button"
                        className={cn(
                            "size-6 rounded-md transition-transform hover:scale-110 focus:outline-none",
                            value === color
                                ? "ring-2 ring-white ring-offset-1 ring-offset-popover scale-110"
                                : ""
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => onChange(color)}
                        title={color}
                    />
                ))}
            </div>
            {/* Custom colour via native picker */}
            <button
                type="button"
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted cursor-pointer transition-colors"
                onClick={openNativePicker}
            >
                <Pipette size={12} />
                <span>Custom colour</span>
                {/* Swatch shows live preview while native dialog is open */}
                <span
                    className="ml-auto size-4 rounded-sm border border-border flex-shrink-0 transition-colors duration-100"
                    style={{ backgroundColor: displayValue }}
                />
            </button>
            <input
                ref={nativeInputRef}
                type="color"
                value={displayValue}
                onChange={handleLiveInput}
                onBlur={handleBlur}
                className="sr-only"
                tabIndex={-1}
            />
        </div>
    );
}
