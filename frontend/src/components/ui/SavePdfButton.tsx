"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";

interface SavePdfButtonProps {
    onClick: () => void;
    disabled?: boolean;
    saving?: boolean;
}

export function SavePdfButton({ onClick, disabled, saving }: SavePdfButtonProps) {
    const [hovered, setHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title="Save current resume as PDF"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: "relative",
                height: 36,
                width: 140,
                cursor: disabled ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                border: "1px solid color-mix(in srgb, var(--primary) 85%, #000)",
                backgroundColor: hovered && !disabled ? "color-mix(in srgb, var(--primary) 85%, #000)" : "var(--primary)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                padding: 0,
                outline: "none",
                opacity: disabled ? 0.5 : 1,
                transition: "all 0.3s ease",
                flexShrink: 0,
            }}
        >
            {/* Text */}
            <span
                style={{
                    transform: "translateX(18px)",
                    color: hovered && !disabled ? "transparent" : "var(--primary-foreground)",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                    transition: "color 0.3s ease",
                }}
            >
                {saving ? "Saving…" : "Save PDF"}
            </span>

            {/* Icon panel */}
            <span
                style={{
                    position: "absolute",
                    right: 0,
                    height: "100%",
                    width: hovered && !disabled ? "100%" : 38,
                    backgroundColor: "color-mix(in srgb, var(--primary) 85%, #000)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                    transition: "width 0.3s ease",
                }}
            >
                {saving ? (
                    <Loader2 style={{ width: 16, height: 16, color: "var(--primary-foreground)", animation: "spin 1s linear infinite" }} />
                ) : (
                    <Download style={{ width: 16, height: 16, color: "var(--primary-foreground)" }} />
                )}
            </span>
        </button>
    );
}
