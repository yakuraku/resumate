"use client"

import * as React from "react"
import { Check, Palette } from "lucide-react"
import { useTheme, type Theme } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

interface ThemeOption {
    id: Theme
    name: string
    description: string
    preview: { bg: string; card: string; primary: string; border: string }
    isDark: boolean
}

const THEMES: ThemeOption[] = [
    {
        id: "light",
        name: "Light",
        description: "Clean & crisp",
        preview: { bg: "#fafafa", card: "#ffffff", primary: "#0d9488", border: "#e4e4e7" },
        isDark: false,
    },
    {
        id: "dark",
        name: "Dark",
        description: "Deep black",
        preview: { bg: "#09090b", card: "#0f0f0f", primary: "#2dd4bf", border: "#27272a" },
        isDark: true,
    },
    {
        id: "pastel",
        name: "Pastel",
        description: "Soft lavender",
        preview: { bg: "#f5f3ff", card: "#ffffff", primary: "#7c3aed", border: "#ddd6fe" },
        isDark: false,
    },
    {
        id: "neutral",
        name: "Neutral",
        description: "Warm stone",
        preview: { bg: "#f7f5f0", card: "#faf9f6", primary: "#b45309", border: "#d4cfc0" },
        isDark: false,
    },
    {
        id: "midnight",
        name: "Midnight",
        description: "Deep navy",
        preview: { bg: "#020817", card: "#0a1128", primary: "#60a5fa", border: "#1e2d4d" },
        isDark: true,
    },
]

export function ThemeSelector() {
    const { theme, setTheme } = useTheme()
    const [open, setOpen] = React.useState(false)
    const ref = React.useRef<HTMLDivElement>(null)

    // Close on outside click
    React.useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [open])

    // Close on Escape
    React.useEffect(() => {
        if (!open) return
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
        document.addEventListener("keydown", handler)
        return () => document.removeEventListener("keydown", handler)
    }, [open])

    const current = THEMES.find((t) => t.id === theme) ?? THEMES[0]

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm font-medium",
                    "bg-card text-foreground hover:bg-muted transition-colors",
                    open && "bg-muted"
                )}
                title={`Theme: ${current.name}`}
                aria-label="Select theme"
            >
                {/* Live preview swatch */}
                <span
                    className="w-3.5 h-3.5 rounded-full border border-border/50 flex-shrink-0"
                    style={{
                        background: `linear-gradient(135deg, ${current.preview.bg} 50%, ${current.preview.primary} 50%)`,
                    }}
                />
                <Palette size={13} className="text-muted-foreground" />
                <span className="hidden sm:inline text-xs">{current.name}</span>
            </button>

            {open && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

                    {/* Dropdown */}
                    <div
                        className={cn(
                            "absolute right-0 top-full mt-2 w-56 z-50",
                            "rounded-xl border border-border bg-popover shadow-xl",
                            "p-1.5"
                        )}
                        style={{
                            boxShadow: "0 8px 32px -4px rgba(0,0,0,0.18), 0 2px 8px -2px rgba(0,0,0,0.12)",
                        }}
                    >
                        <p className="px-2.5 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                            Appearance
                        </p>

                        {THEMES.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => { setTheme(t.id); setOpen(false) }}
                                className={cn(
                                    "w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-left",
                                    theme === t.id
                                        ? "bg-primary/10 text-foreground"
                                        : "hover:bg-muted text-foreground"
                                )}
                            >
                                {/* Color swatch — shows bg/card split + primary accent */}
                                <div
                                    className="flex-shrink-0 w-8 h-8 rounded-lg border border-border/60 overflow-hidden shadow-sm"
                                    style={{ background: t.preview.bg }}
                                >
                                    <div className="w-full h-full grid grid-cols-2 grid-rows-2">
                                        <div style={{ background: t.preview.card }} />
                                        <div style={{ background: t.preview.primary }} />
                                        <div style={{ background: t.preview.border }} />
                                        <div style={{ background: t.preview.bg }} />
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium leading-none">{t.name}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{t.description}</p>
                                </div>

                                {theme === t.id && (
                                    <Check size={13} className="text-primary flex-shrink-0" />
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
