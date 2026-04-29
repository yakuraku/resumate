"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FileText,
  Settings,
  Menu,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"
import { SettingsService } from "@/services/settings.service"

interface CommandCenterProps {
  children: React.ReactNode
  /** When true, the main area becomes overflow-hidden (for editor-style pages) */
  fullHeight?: boolean
}

export function CommandCenter({ children, fullHeight = false }: CommandCenterProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  // Desktop collapsed state persisted in localStorage
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-collapsed") === "true"
    }
    return false
  })
  // Mobile open/close
  const [mobileOpen, setMobileOpen] = React.useState(false)
  // User menu (logout popup)
  const [showUserMenu, setShowUserMenu] = React.useState(false)
  const userMenuRef = React.useRef<HTMLDivElement>(null)
  const [preferredName, setPreferredName] = React.useState<string>("")

  React.useEffect(() => {
    if (!user) return
    SettingsService.get()
      .then(s => setPreferredName(s.preferred_name ?? ""))
      .catch(() => {})
  }, [user?.id])

  const toggleCollapsed = () => {
    setShowUserMenu(false)
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem("sidebar-collapsed", String(next))
      return next
    })
  }

  // Close user menu on click-outside or Escape
  React.useEffect(() => {
    if (!showUserMenu) return
    const onMouseDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowUserMenu(false)
    }
    document.addEventListener("mousedown", onMouseDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [showUserMenu])

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Resumes", href: "/resumes", icon: FileText },
    { name: "My Context", href: "/context", icon: User },
    { name: "Settings", href: "/settings", icon: Settings },
  ]

  return (
    // h-screen + overflow-hidden pins the layout to the viewport so the sidebar
    // never scrolls with the page — the main content area scrolls independently.
    <div className="h-screen overflow-hidden bg-background flex text-foreground">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 bg-card border-r border-border transition-all duration-300 ease-in-out flex flex-col",
          // Mobile: slide in/out; Desktop: narrow or wide
          "md:static md:inset-auto md:translate-x-0",
          mobileOpen ? "translate-x-0 w-64" : "-translate-x-full w-64 md:translate-x-0",
          // Desktop collapsed
          collapsed ? "md:w-16" : "md:w-64"
        )}
      >
        {/* Logo row */}
        <div className={cn(
          "flex h-16 items-center border-b border-border shrink-0 transition-all duration-300",
          collapsed ? "px-0 justify-center" : "px-5 gap-3"
        )}>
          <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-lg">R</span>
          </div>
          {!collapsed && (
            <span className="font-bold text-xl tracking-tight whitespace-nowrap overflow-hidden">ResuMate</span>
          )}
        </div>

        {/* Nav items — overflow-y-auto keeps user section always visible if nav grows */}
        <nav className={cn("p-2 space-y-1 flex-1 overflow-y-auto", collapsed && "flex flex-col items-center")}>
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.name : undefined}
                className={cn(
                  "flex items-center rounded-md text-sm font-medium transition-colors",
                  collapsed ? "justify-center w-10 h-10 p-0" : "gap-3 px-3 py-2.5 w-full",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && item.name}
              </Link>
            )
          })}
        </nav>

        {/* User + collapse toggle — shrink-0 keeps this pinned at the bottom */}
        <div className="p-2 border-t border-border shrink-0 space-y-2">

          {/* Expanded: clickable user card with logout dropdown */}
          {!collapsed && (
            <div ref={userMenuRef} className="relative">
              {showUserMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-1 p-1 bg-card border border-border rounded-lg shadow-lg z-50">
                  <button
                    onClick={async () => { setShowUserMenu(false); await logout() }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
              <div
                onClick={() => setShowUserMenu((v) => !v)}
                className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-lg border border-border cursor-pointer hover:bg-muted/50 transition-colors select-none"
              >
                <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center border border-border shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium truncate">{preferredName || user?.email?.split("@")[0] || "Account"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email ?? ""}</p>
                </div>
              </div>
            </div>
          )}

          {/* Collapsed: user icon button with logout dropdown */}
          {collapsed && (
            <div ref={userMenuRef} className="relative flex justify-center">
              {showUserMenu && (
                <div className="absolute bottom-full left-0 mb-1 p-1 bg-card border border-border rounded-lg shadow-lg z-50 w-36">
                  <button
                    onClick={async () => { setShowUserMenu(false); await logout() }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                title={preferredName || user?.email || "Account"}
                className="w-10 h-10 rounded-full bg-accent flex items-center justify-center border border-border hover:bg-muted transition-colors"
              >
                <User className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}

          {/* Collapse toggle — desktop only */}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "hidden md:flex items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
              collapsed ? "justify-center w-10 h-10 p-0 mx-auto" : "gap-2 px-3 py-2 w-full text-sm"
            )}
          >
            {collapsed
              ? <PanelLeftOpen className="h-4 w-4" />
              : <><PanelLeftClose className="h-4 w-4" /><span>Collapse</span></>
            }
          </button>
        </div>
      </aside>

      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden fixed top-3 left-3 z-50 bg-background/80 backdrop-blur-sm border border-border shadow-sm"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Main Content — overflow-hidden here so only the inner main scrolls */}
      <div className="flex-1 flex flex-col min-w-0 bg-muted/10 overflow-hidden">
        <main className={cn(
          "flex-1 p-6 md:p-8 animate-in fade-in zoom-in-95 duration-300",
          fullHeight ? "overflow-hidden" : "overflow-y-auto"
        )}>
          {children}
        </main>
      </div>
    </div>
  )
}
