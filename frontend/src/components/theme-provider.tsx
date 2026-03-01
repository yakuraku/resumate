"use client"

import * as React from "react"

export type Theme = "dark" | "light" | "system" | "pastel" | "neutral" | "midnight"

type ThemeProviderProps = {
    children: React.ReactNode
    defaultTheme?: Theme
    storageKey?: string
}

type ThemeProviderState = {
    theme: Theme
    setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
    theme: "system",
    setTheme: () => null,
}

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState)

/** All HTML theme classes we manage */
const ALL_THEME_CLASSES = ["light", "dark", "pastel", "neutral", "midnight"]

/** Returns which HTML classes to apply for a given theme */
function getThemeClasses(theme: Theme, systemPrefersDark: boolean): string[] {
    switch (theme) {
        case "system":
            return [systemPrefersDark ? "dark" : "light"]
        case "midnight":
            return ["dark", "midnight"]
        default:
            return [theme]
    }
}

export function ThemeProvider({
    children,
    defaultTheme = "system",
    storageKey = "resumate-theme",
    ...props
}: ThemeProviderProps) {
    const [theme, setThemeState] = React.useState<Theme>(() => {
        if (typeof window === "undefined") return defaultTheme
        return (localStorage.getItem(storageKey) as Theme) || defaultTheme
    })

    const applyTheme = React.useCallback((t: Theme) => {
        const root = window.document.documentElement
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches

        // Trigger smooth transition
        root.classList.add("theme-switching")

        // Remove all existing theme classes then apply new ones
        ALL_THEME_CLASSES.forEach((cls) => root.classList.remove(cls))
        getThemeClasses(t, systemPrefersDark).forEach((cls) => root.classList.add(cls))

        // Remove transition class after animation
        const id = setTimeout(() => root.classList.remove("theme-switching"), 300)
        return () => clearTimeout(id)
    }, [])

    React.useEffect(() => {
        return applyTheme(theme)
    }, [theme, applyTheme])

    // Re-apply when OS preference changes (only matters for "system" theme)
    React.useEffect(() => {
        const mq = window.matchMedia("(prefers-color-scheme: dark)")
        const handler = () => { if (theme === "system") applyTheme("system") }
        mq.addEventListener("change", handler)
        return () => mq.removeEventListener("change", handler)
    }, [theme, applyTheme])

    const setTheme = React.useCallback(
        (newTheme: Theme) => {
            localStorage.setItem(storageKey, newTheme)
            setThemeState(newTheme)
        },
        [storageKey]
    )

    return (
        <ThemeProviderContext.Provider {...props} value={{ theme, setTheme }}>
            {children}
        </ThemeProviderContext.Provider>
    )
}

export const useTheme = () => {
    const context = React.useContext(ThemeProviderContext)
    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider")
    return context
}
