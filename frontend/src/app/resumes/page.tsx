"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  FileText,
  Star,
  MoreHorizontal,
  Plus,
  Search,
  RefreshCw,
  X,
  AlertTriangle,
  Loader2,
  ChevronRight,
} from "lucide-react"
import { CommandCenter } from "@/components/layout/CommandCenter"
import { ResumeEditor } from "@/components/resume/ResumeEditor"
import { SaveIndicator } from "@/components/shared/SaveIndicator"
import { StatusBadge } from "@/components/applications/StatusBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { ResumeTemplateService } from "@/services/resume-template.service"
import type { ResumeTemplate, ResumeTemplateDetail, LinkedApplicationSummary } from "@/types/resume-template"
import { ApplicationStatus } from "@/types/application"

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast {
  id: string
  message: string
  variant: "default" | "error"
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? "1 month ago" : `${months} months ago`
}

function sortTemplates(templates: ResumeTemplate[]): ResumeTemplate[] {
  return [...templates].sort((a, b) => {
    if (a.is_master !== b.is_master) return a.is_master ? -1 : 1
    if (a.is_starred !== b.is_starred) return a.is_starred ? -1 : 1
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })
}

// ─── Skeleton Card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 animate-pulse space-y-3">
      <div className="h-4 w-3/4 bg-muted rounded" />
      <div className="h-3 w-1/2 bg-muted rounded" />
      <div className="h-3 w-1/3 bg-muted rounded" />
    </div>
  )
}

// ─── 3-dot Menu ───────────────────────────────────────────────────────────────

interface MenuOption {
  label: string
  onClick: () => void
  variant?: "destructive"
  disabled?: boolean
}

function ThreeDotMenu({ options, disabled }: { options: MenuOption[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="More options"
        onClick={(e) => { e.stopPropagation(); setOpen((p) => !p) }}
        disabled={disabled}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-card border border-border rounded-lg shadow-lg py-1 animate-in fade-in zoom-in-95 duration-100">
          {options.map((opt) => (
            <button
              key={opt.label}
              disabled={opt.disabled}
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                opt.onClick()
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm transition-colors",
                opt.disabled
                  ? "text-muted-foreground cursor-not-allowed opacity-50"
                  : opt.variant === "destructive"
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-foreground hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Resume Card ──────────────────────────────────────────────────────────────

interface ResumeCardProps {
  template: ResumeTemplate
  onOpen: () => void
  onStar: () => void
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMoreInfo: () => void
}

function ResumeCard({
  template,
  onOpen,
  onStar,
  onRename,
  onDuplicate,
  onDelete,
  onMoreInfo,
}: ResumeCardProps) {
  const menuOptions: MenuOption[] = [
    { label: "More Info", onClick: onMoreInfo },
    ...(template.is_master ? [] : [{ label: "Rename", onClick: onRename }]),
    {
      label: template.is_starred ? "Unstar" : "Star",
      onClick: onStar,
    },
    { label: "Duplicate", onClick: onDuplicate },
    ...(template.is_master
      ? []
      : [{ label: "Delete", onClick: onDelete, variant: "destructive" as const }]),
  ]

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="group relative rounded-xl border border-border bg-card p-5 cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-5 w-5 text-primary shrink-0" />
          <span className="font-semibold text-base leading-tight truncate">{template.name}</span>
        </div>
        <div
          className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <ThreeDotMenu options={menuOptions} />
        </div>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {template.is_master && (
          <Badge className="text-xs font-medium bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
            Master
          </Badge>
        )}
        {template.is_starred && (
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
        )}
        {template.linked_application_count > 0 && (
          <span className="text-xs text-muted-foreground">
            {template.linked_application_count} application{template.linked_application_count !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Updated {timeAgo(template.updated_at)}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
      </div>
    </div>
  )
}

// ─── Editor Modal ─────────────────────────────────────────────────────────────

interface EditorModalProps {
  template: ResumeTemplate
  open: boolean
  onClose: () => void
  onSaved: (updatedAt: string, newYaml: string) => void
  showToast: (msg: string, variant?: "default" | "error") => void
}

function EditorModal({ template, open, onClose, onSaved, showToast }: EditorModalProps) {
  const [yaml, setYaml] = useState(template.yaml_content)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfRendering, setPdfRendering] = useState(false)
  const [masterBannerDismissed, setMasterBannerDismissed] = useState(false)
  const [hasUnsaved, setHasUnsaved] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [inlineName, setInlineName] = useState(template.name)
  const [editingName, setEditingName] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedYamlRef = useRef(template.yaml_content)

  // Reset state when template changes
  useEffect(() => {
    setYaml(template.yaml_content)
    savedYamlRef.current = template.yaml_content
    setInlineName(template.name)
    setHasUnsaved(false)
    setSaveStatus("idle")
  }, [template.id, template.yaml_content, template.name])

  // Auto-save debounce
  useEffect(() => {
    if (yaml === savedYamlRef.current) return
    setHasUnsaved(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaveStatus("saving")
      try {
        const res = await ResumeTemplateService.saveYaml(template.id, yaml)
        savedYamlRef.current = yaml
        setHasUnsaved(false)
        setSaveStatus("saved")
        onSaved(res.updated_at, yaml)
        // After auto-save, re-render PDF
        renderPdf()
        setTimeout(() => setSaveStatus("idle"), 2000)
      } catch {
        setSaveStatus("error")
        showToast("Auto-save failed", "error")
      }
    }, 1500)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yaml, template.id])

  const renderPdf = useCallback(async () => {
    setPdfRendering(true)
    try {
      const blob = await ResumeTemplateService.renderPdf(template.id)
      const url = URL.createObjectURL(blob)
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
    } catch {
      showToast("PDF render failed", "error")
    } finally {
      setPdfRendering(false)
    }
  }, [template.id, showToast])

  // Render PDF on open
  useEffect(() => {
    if (open) renderPdf()
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleClose = () => {
    if (hasUnsaved) {
      setConfirmClose(true)
    } else {
      onClose()
    }
  }

  const handleForceClose = () => {
    setConfirmClose(false)
    onClose()
  }

  const handleNameSave = async () => {
    const trimmed = inlineName.trim()
    if (!trimmed || trimmed.toLowerCase() === "master") {
      setInlineName(template.name)
      setEditingName(false)
      return
    }
    try {
      await ResumeTemplateService.update(template.id, { name: trimmed })
      showToast("Renamed successfully")
    } catch {
      setInlineName(template.name)
      showToast("Rename failed", "error")
    }
    setEditingName(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="h-5 w-5 text-primary shrink-0" />
              {template.is_master || !editingName ? (
                <span
                  className={cn(
                    "font-semibold text-base truncate",
                    !template.is_master && "cursor-pointer hover:text-primary transition-colors"
                  )}
                  onClick={() => !template.is_master && setEditingName(true)}
                  title={template.is_master ? undefined : "Click to rename"}
                >
                  {inlineName}
                </span>
              ) : (
                <input
                  autoFocus
                  value={inlineName}
                  onChange={(e) => setInlineName(e.target.value)}
                  onBlur={handleNameSave}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleNameSave()
                    if (e.key === "Escape") { setInlineName(template.name); setEditingName(false) }
                  }}
                  className="font-semibold text-base bg-transparent border-b border-primary outline-none px-0 min-w-0 w-48"
                />
              )}
              {template.is_master && (
                <Badge className="text-xs bg-primary/10 text-primary border-primary/20">Master</Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <SaveIndicator status={saveStatus} />
              <button
                onClick={handleClose}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Close editor"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Master banner */}
          {template.is_master && !masterBannerDismissed && (
            <div className="flex items-start justify-between gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  This is your <strong>Master Resume</strong> — the base template for all new resumes. Changes here do not affect existing application resumes.
                </span>
              </div>
              <button
                onClick={() => setMasterBannerDismissed(true)}
                className="shrink-0 p-0.5 rounded hover:bg-amber-200/50 dark:hover:bg-amber-800/50 transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Editor + Preview — desktop side by side, mobile tabs */}
          <div className="flex-1 min-h-0 hidden md:flex">
            {/* Left: Editor */}
            <div className="w-1/2 flex flex-col border-r border-border min-h-0">
              <div className="px-3 py-2 border-b border-border shrink-0">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">YAML Editor</span>
              </div>
              <div className="flex-1 min-h-0 p-2">
                <ResumeEditor
                  value={yaml}
                  onChange={(v) => setYaml(v ?? "")}
                />
              </div>
            </div>

            {/* Right: PDF Preview */}
            <div className="w-1/2 flex flex-col min-h-0">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between shrink-0">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">PDF Preview</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={renderPdf}
                  disabled={pdfRendering}
                  className="h-7 px-2 text-xs gap-1"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", pdfRendering && "animate-spin")} />
                  {pdfRendering ? "Rendering…" : "Refresh"}
                </Button>
              </div>
              <div className="flex-1 min-h-0 relative">
                {pdfRendering && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Rendering PDF…</span>
                  </div>
                )}
                {pdfUrl ? (
                  <iframe
                    src={pdfUrl}
                    className="w-full h-full border-0"
                    title="PDF Preview"
                  />
                ) : (
                  !pdfRendering && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                      <FileText className="h-10 w-10" />
                      <span className="text-sm">No preview yet</span>
                      <Button variant="outline" size="sm" onClick={renderPdf}>
                        Render PDF
                      </Button>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Mobile: Tabs */}
          <div className="flex-1 min-h-0 flex flex-col md:hidden">
            <Tabs defaultValue="editor" className="flex-1 flex flex-col min-h-0">
              <TabsList className="mx-3 mt-2 shrink-0">
                <TabsTrigger value="editor" className="flex-1">Editor</TabsTrigger>
                <TabsTrigger value="preview" className="flex-1">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="editor" className="flex-1 min-h-0 p-2 data-[state=active]:flex data-[state=active]:flex-col">
                <div className="flex-1 min-h-0">
                  <ResumeEditor value={yaml} onChange={(v) => setYaml(v ?? "")} />
                </div>
              </TabsContent>
              <TabsContent value="preview" className="flex-1 min-h-0 relative data-[state=active]:flex data-[state=active]:flex-col">
                {pdfRendering && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Rendering PDF…</span>
                  </div>
                )}
                {pdfUrl ? (
                  <iframe src={pdfUrl} className="w-full flex-1 border-0" title="PDF Preview" />
                ) : (
                  !pdfRendering && (
                    <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
                      <FileText className="h-10 w-10" />
                      <Button variant="outline" size="sm" onClick={renderPdf}>Render PDF</Button>
                    </div>
                  )
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm close dialog */}
      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You have unsaved changes. Are you sure you want to close? Changes will be lost.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmClose(false)}>Stay</Button>
            <Button variant="destructive" onClick={handleForceClose}>Close anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── More Info Dialog ─────────────────────────────────────────────────────────

interface MoreInfoDialogProps {
  open: boolean
  onClose: () => void
  templateName: string
  linkedApps: LinkedApplicationSummary[]
  loading: boolean
}

function MoreInfoDialog({ open, onClose, templateName, linkedApps, loading }: MoreInfoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Linked Applications — {templateName}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : linkedApps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No applications using this resume.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {linkedApps.map((app) => (
              <div key={app.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-muted/40 border border-border">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{app.job_title ?? "Untitled Role"}</p>
                  <p className="text-xs text-muted-foreground truncate">{app.company ?? "Unknown Company"}</p>
                </div>
                <StatusBadge status={app.status as ApplicationStatus} />
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Rename Dialog ─────────────────────────────────────────────────────────────

interface RenameDialogProps {
  open: boolean
  onClose: () => void
  currentName: string
  onSubmit: (name: string) => Promise<void>
}

function RenameDialog({ open, onClose, currentName, onSubmit }: RenameDialogProps) {
  const [name, setName] = useState(currentName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => { if (open) { setName(currentName); setError("") } }, [open, currentName])

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError("Name cannot be empty."); return }
    if (trimmed.toLowerCase() === "master") { setError('Name cannot be "Master".'); return }
    setLoading(true)
    try {
      await onSubmit(trimmed)
      onClose()
    } catch {
      setError("Failed to rename.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename Resume</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="rename-input">New name</Label>
          <Input
            id="rename-input"
            value={name}
            onChange={(e) => { setName(e.target.value); setError("") }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !name.trim()}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Duplicate Dialog ─────────────────────────────────────────────────────────

interface DuplicateDialogProps {
  open: boolean
  onClose: () => void
  sourceName: string
  onSubmit: (name: string) => Promise<void>
}

function DuplicateDialog({ open, onClose, sourceName, onSubmit }: DuplicateDialogProps) {
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) { setName(`${sourceName} (copy)`); setError("") }
  }, [open, sourceName])

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError("Name cannot be empty."); return }
    if (trimmed.toLowerCase() === "master") { setError('Name cannot be "Master".'); return }
    setLoading(true)
    try {
      await onSubmit(trimmed)
      onClose()
    } catch {
      setError("Failed to duplicate.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Duplicate Resume</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="dup-input">Name for copy</Label>
          <Input
            id="dup-input"
            value={name}
            onChange={(e) => { setName(e.target.value); setError("") }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !name.trim()}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Duplicate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── New Resume Dialog ─────────────────────────────────────────────────────────

interface NewResumeDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (template: ResumeTemplate) => void
  showToast: (msg: string, variant?: "default" | "error") => void
}

function NewResumeDialog({ open, onClose, onCreated, showToast }: NewResumeDialogProps) {
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => { if (open) { setName(""); setError("") } }, [open])

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError("Name cannot be empty."); return }
    if (trimmed.toLowerCase() === "master") { setError('Name cannot be "Master".'); return }
    setLoading(true)
    try {
      const created = await ResumeTemplateService.create({ name: trimmed })
      showToast("Resume created")
      onCreated(created)
      onClose()
    } catch {
      setError("Failed to create resume.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Resume</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">
          A new resume will be created as a copy of your Master resume.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="new-resume-input">Name</Label>
          <Input
            id="new-resume-input"
            placeholder="e.g. Software Engineer Resume"
            value={name}
            onChange={(e) => { setName(e.target.value); setError("") }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !name.trim()}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete Dialog ─────────────────────────────────────────────────────────────

interface DeleteDialogProps {
  open: boolean
  onClose: () => void
  templateName: string
  onConfirm: (force: boolean) => Promise<void>
}

type DeleteStage = "confirm" | "conflict"

function DeleteDialog({ open, onClose, templateName, onConfirm }: DeleteDialogProps) {
  const [stage, setStage] = useState<DeleteStage>("confirm")
  const [conflictCount, setConflictCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (open) setStage("confirm") }, [open])

  const handleDelete = async (force: boolean) => {
    setLoading(true)
    try {
      await onConfirm(force)
      onClose()
    } catch (err: unknown) {
      // Check if it's a 409 conflict
      const axiosErr = err as { response?: { status?: number; data?: { linked_draft_count?: number } } }
      if (axiosErr?.response?.status === 409 && axiosErr.response.data?.linked_draft_count !== undefined) {
        setConflictCount(axiosErr.response.data.linked_draft_count ?? 0)
        setStage("conflict")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Resume</DialogTitle>
        </DialogHeader>
        {stage === "confirm" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>{templateName}</strong>? This action cannot be undone.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button variant="destructive" onClick={() => handleDelete(false)} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                Delete
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex gap-3 items-start p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                This resume is linked to <strong>{conflictCount}</strong> draft application{conflictCount !== 1 ? "s" : ""}. They will be reassigned to your Master resume if you proceed.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button variant="destructive" onClick={() => handleDelete(true)} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                Delete anyway
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ResumesPage() {
  const [templates, setTemplates] = useState<ResumeTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [toasts, setToasts] = useState<Toast[]>([])

  // Dialog state
  const [editorTarget, setEditorTarget] = useState<ResumeTemplate | null>(null)
  const [newResumeOpen, setNewResumeOpen] = useState(false)
  const [moreInfoTarget, setMoreInfoTarget] = useState<ResumeTemplate | null>(null)
  const [moreInfoDetail, setMoreInfoDetail] = useState<LinkedApplicationSummary[]>([])
  const [moreInfoLoading, setMoreInfoLoading] = useState(false)
  const [renameTarget, setRenameTarget] = useState<ResumeTemplate | null>(null)
  const [duplicateTarget, setDuplicateTarget] = useState<ResumeTemplate | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ResumeTemplate | null>(null)

  const showToast = (message: string, variant: "default" | "error" = "default") => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }

  // Fetch templates
  const fetchTemplates = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      const data = await ResumeTemplateService.getAll(q)
      setTemplates(data)
    } catch {
      showToast("Failed to load resumes", "error")
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  // Debounced server-side search
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => {
      fetchTemplates(search || undefined)
    }, 400)
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current) }
  }, [search, fetchTemplates])

  // Client-side filter on top of server results
  const filtered = sortTemplates(
    templates.filter((t) =>
      !search || t.name.toLowerCase().includes(search.toLowerCase())
    )
  )

  // ── Handlers ──

  const handleMoreInfo = async (template: ResumeTemplate) => {
    setMoreInfoTarget(template)
    setMoreInfoLoading(true)
    try {
      const detail = await ResumeTemplateService.getById(template.id)
      setMoreInfoDetail(detail.linked_applications)
    } catch {
      setMoreInfoDetail([])
      showToast("Failed to load details", "error")
    } finally {
      setMoreInfoLoading(false)
    }
  }

  const handleStar = async (template: ResumeTemplate) => {
    // Optimistic update
    setTemplates((prev) =>
      prev.map((t) => (t.id === template.id ? { ...t, is_starred: !t.is_starred } : t))
    )
    try {
      await ResumeTemplateService.update(template.id, { is_starred: !template.is_starred })
    } catch {
      // Revert
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, is_starred: template.is_starred } : t))
      )
      showToast("Failed to update", "error")
    }
  }

  const handleRename = async (template: ResumeTemplate, newName: string) => {
    await ResumeTemplateService.update(template.id, { name: newName })
    setTemplates((prev) =>
      prev.map((t) => (t.id === template.id ? { ...t, name: newName } : t))
    )
    showToast("Renamed successfully")
  }

  const handleDuplicate = async (template: ResumeTemplate, name: string) => {
    const created = await ResumeTemplateService.duplicate(template.id, name)
    setTemplates((prev) => [...prev, created])
    showToast("Duplicated successfully")
  }

  const handleDelete = async (template: ResumeTemplate, force: boolean) => {
    await ResumeTemplateService.delete(template.id, force)
    setTemplates((prev) => prev.filter((t) => t.id !== template.id))
    showToast("Deleted")
  }

  const handleEditorSaved = (id: string, updatedAt: string, newYaml: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, yaml_content: newYaml, updated_at: updatedAt } : t))
    )
  }

  const nonMasterTemplates = filtered.filter((t) => !t.is_master)
  const masterTemplate = filtered.find((t) => t.is_master)

  return (
    <CommandCenter>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Resumes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage your resume templates</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search resumes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-56"
              />
            </div>
            <Button onClick={() => setNewResumeOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Resume
            </Button>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed border-border">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No resumes found</h3>
            <p className="text-muted-foreground text-sm mb-6">
              {search ? "Try a different search term." : "Create your first resume to get started."}
            </p>
            {!search && (
              <Button onClick={() => setNewResumeOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Create Resume
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Master template */}
            {masterTemplate && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Master Template</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <ResumeCard
                    template={masterTemplate}
                    onOpen={() => setEditorTarget(masterTemplate)}
                    onStar={() => handleStar(masterTemplate)}
                    onRename={() => setRenameTarget(masterTemplate)}
                    onDuplicate={() => setDuplicateTarget(masterTemplate)}
                    onDelete={() => setDeleteTarget(masterTemplate)}
                    onMoreInfo={() => handleMoreInfo(masterTemplate)}
                  />
                </div>
              </div>
            )}

            {/* Other resumes */}
            {nonMasterTemplates.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Resumes ({nonMasterTemplates.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {nonMasterTemplates.map((t) => (
                    <ResumeCard
                      key={t.id}
                      template={t}
                      onOpen={() => setEditorTarget(t)}
                      onStar={() => handleStar(t)}
                      onRename={() => setRenameTarget(t)}
                      onDuplicate={() => setDuplicateTarget(t)}
                      onDelete={() => setDeleteTarget(t)}
                      onMoreInfo={() => handleMoreInfo(t)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}

      {editorTarget && (
        <EditorModal
          key={editorTarget.id}
          template={editorTarget}
          open={!!editorTarget}
          onClose={() => setEditorTarget(null)}
          onSaved={(updatedAt, newYaml) => handleEditorSaved(editorTarget.id, updatedAt, newYaml)}
          showToast={showToast}
        />
      )}

      <NewResumeDialog
        open={newResumeOpen}
        onClose={() => setNewResumeOpen(false)}
        onCreated={(created) => {
          setTemplates((prev) => [...prev, created])
          setEditorTarget(created)
        }}
        showToast={showToast}
      />

      <MoreInfoDialog
        open={!!moreInfoTarget}
        onClose={() => setMoreInfoTarget(null)}
        templateName={moreInfoTarget?.name ?? ""}
        linkedApps={moreInfoDetail}
        loading={moreInfoLoading}
      />

      {renameTarget && (
        <RenameDialog
          open={!!renameTarget}
          onClose={() => setRenameTarget(null)}
          currentName={renameTarget.name}
          onSubmit={(name) => handleRename(renameTarget, name)}
        />
      )}

      {duplicateTarget && (
        <DuplicateDialog
          open={!!duplicateTarget}
          onClose={() => setDuplicateTarget(null)}
          sourceName={duplicateTarget.name}
          onSubmit={(name) => handleDuplicate(duplicateTarget, name)}
        />
      )}

      {deleteTarget && (
        <DeleteDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          templateName={deleteTarget.name}
          onConfirm={(force) => handleDelete(deleteTarget, force)}
        />
      )}

      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-bottom-2 fade-in duration-200",
              t.variant === "error"
                ? "bg-destructive text-destructive-foreground"
                : "bg-foreground text-background"
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </CommandCenter>
  )
}
