"use client";

import React from "react";

interface SwitchProps {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
}

export function Switch({ checked, onCheckedChange, disabled = false }: SwitchProps) {
    return (
        <button
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onCheckedChange(!checked)}
            className={`
                relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full
                border-2 border-transparent transition-colors duration-200 ease-in-out
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                disabled:cursor-not-allowed disabled:opacity-50
                ${checked ? "bg-primary" : "bg-muted"}
            `}
        >
            <span
                className={`
                    pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg
                    ring-0 transition duration-200 ease-in-out
                    ${checked ? "translate-x-4" : "translate-x-0"}
                `}
            />
        </button>
    );
}
