"use client";

import React from "react";
import { BrainCircuit, Loader2 } from "lucide-react";

interface AiTailorButtonProps {
    onClick: () => void;
    disabled?: boolean;
    tailoring?: boolean;
}

export function AiTailorButton({ onClick, disabled, tailoring }: AiTailorButtonProps) {
    return (
        <>
            {/* Scoped styles for keyframes + pseudo-elements that can't be inline */}
            <style>{`
                .ai-tailor-space-btn {
                    display: inline-flex;
                    justify-content: center;
                    align-items: center;
                    gap: 8px;
                    overflow: hidden;
                    height: 36px;
                    padding: 0 16px;
                    background-size: 300% 300%;
                    cursor: pointer;
                    backdrop-filter: blur(1rem);
                    border-radius: var(--radius-md);
                    transition: 0.5s;
                    animation: aitGradient 5s ease infinite;
                    border: double 3px transparent;
                    background-image:
                        linear-gradient(var(--secondary), var(--secondary)),
                        linear-gradient(137.48deg,
                            color-mix(in srgb, var(--primary) 90%, #ffdb3b) 10%,
                            var(--primary) 45%,
                            color-mix(in srgb, var(--primary) 60%, #8f51ea) 67%,
                            color-mix(in srgb, var(--primary) 70%, #0044ff) 87%
                        );
                    background-origin: border-box;
                    background-clip: content-box, border-box;
                    position: relative;
                    outline: none;
                    flex-shrink: 0;
                    font-size: 0.875rem;
                    font-weight: 500;
                }
                .ai-tailor-space-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    animation: none;
                }
                .ai-tailor-space-btn strong {
                    z-index: 2;
                    font-size: 0.875rem;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    color: var(--secondary-foreground);
                    text-shadow: none;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                }
                .ai-tailor-space-btn .ait-icon {
                    z-index: 2;
                    color: var(--secondary-foreground);
                    width: 16px;
                    height: 16px;
                    flex-shrink: 0;
                }
                .ai-tailor-space-btn #ait-container-stars {
                    position: absolute;
                    z-index: -1;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                    transition: 0.5s;
                    backdrop-filter: blur(1rem);
                    border-radius: var(--radius-md);
                }
                .ai-tailor-space-btn #ait-stars {
                    position: relative;
                    background: transparent;
                    width: 200rem;
                    height: 200rem;
                }
                .ai-tailor-space-btn #ait-stars::after {
                    content: "";
                    position: absolute;
                    top: -10rem;
                    left: -100rem;
                    width: 100%;
                    height: 100%;
                    animation: aitStarRotate 90s linear infinite;
                    background-image: radial-gradient(#ffffff 1px, transparent 1%);
                    background-size: 50px 50px;
                }
                .ai-tailor-space-btn #ait-stars::before {
                    content: "";
                    position: absolute;
                    top: 0;
                    left: -50%;
                    width: 170%;
                    height: 500%;
                    animation: aitStar 60s linear infinite;
                    background-image: radial-gradient(#ffffff 1px, transparent 1%);
                    background-size: 50px 50px;
                    opacity: 0.5;
                }
                .ai-tailor-space-btn #ait-glow {
                    position: absolute;
                    display: flex;
                    width: 10rem;
                }
                .ai-tailor-space-btn .ait-circle {
                    width: 100%;
                    height: 24px;
                    filter: blur(1.5rem);
                    animation: aitPulse 4s infinite;
                    z-index: -1;
                }
                .ai-tailor-space-btn .ait-circle:nth-of-type(1) {
                    background: color-mix(in srgb, var(--primary) 60%, transparent);
                }
                .ai-tailor-space-btn .ait-circle:nth-of-type(2) {
                    background: color-mix(in srgb, var(--primary) 50%, #8f51ea80);
                }
                .ai-tailor-space-btn:hover:not(:disabled) #ait-container-stars {
                    z-index: 1;
                    background-color: var(--secondary);
                }
                .ai-tailor-space-btn:hover:not(:disabled) {
                    transform: scale(1.05);
                }
                .ai-tailor-space-btn:active:not(:disabled) {
                    border: double 3px var(--primary);
                    background-origin: border-box;
                    background-clip: content-box, border-box;
                    animation: none;
                }
                .ai-tailor-space-btn:active:not(:disabled) .ait-circle {
                    background: var(--primary);
                }
                .ai-tailor-space-btn:focus-visible {
                    outline: 2px solid var(--ring);
                    outline-offset: 2px;
                }
                @keyframes aitStar {
                    from { transform: translateY(0); }
                    to { transform: translateY(-135rem); }
                }
                @keyframes aitStarRotate {
                    from { transform: rotate(360deg); }
                    to { transform: rotate(0); }
                }
                @keyframes aitGradient {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                @keyframes aitPulse {
                    0% { transform: scale(0.75); box-shadow: 0 0 0 0 rgba(0,0,0,0.7); }
                    70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(0,0,0,0); }
                    100% { transform: scale(0.75); box-shadow: 0 0 0 0 rgba(0,0,0,0); }
                }
            `}</style>

            <button
                type="button"
                className="ai-tailor-space-btn"
                onClick={onClick}
                disabled={disabled}
            >
                <strong>
                    {tailoring ? (
                        <Loader2 className="ait-icon" style={{ animation: "spin 1s linear infinite" }} />
                    ) : (
                        <BrainCircuit className="ait-icon" />
                    )}
                    {tailoring ? "Tailoring…" : "AI Tailor"}
                </strong>

                {!tailoring && (
                    <>
                        <div id="ait-container-stars">
                            <div id="ait-stars" />
                        </div>
                        <div id="ait-glow">
                            <div className="ait-circle" />
                            <div className="ait-circle" />
                        </div>
                    </>
                )}
            </button>
        </>
    );
}
