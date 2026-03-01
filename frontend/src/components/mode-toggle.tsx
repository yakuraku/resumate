"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"

const CYCLE_ORDER = ["light", "dark", "system"] as const

export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    const idx = CYCLE_ORDER.indexOf(theme as (typeof CYCLE_ORDER)[number])
    const next = CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length]
    setTheme(next)
  }

  const isDarkLike = theme === "dark" || theme === "midnight"

  return (
    <Button variant="ghost" size="icon" onClick={cycleTheme} title={`Theme: ${theme}`}>
      {isDarkLike
        ? <Moon className="h-[1.2rem] w-[1.2rem]" />
        : theme === "system"
          ? <Monitor className="h-[1.2rem] w-[1.2rem]" />
          : <Sun className="h-[1.2rem] w-[1.2rem]" />
      }
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
