"use client"

import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ApplicationService } from "@/services/application.service"
import { ApplicationStatus } from "@/types/application"
import { Plus, Loader2 } from "lucide-react"
import { ResumeTemplateService } from "@/services/resume-template.service"
import type { ResumeTemplate } from "@/types/resume-template"
import { ColorPicker, PRESET_COLORS, randomPresetColor } from "@/components/shared/ColorPicker"
import { getContrastColor } from "@/lib/utils"

interface CreateApplicationModalProps {
  onSuccess?: () => void
  trigger?: React.ReactNode
}

export function CreateApplicationModal({ onSuccess, trigger }: CreateApplicationModalProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<ResumeTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [selectedColor, setSelectedColor] = useState<string>(randomPresetColor())
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const colorPickerRef = useRef<HTMLDivElement>(null)
  const nativeColorPickerActive = useRef(false)

  const [formData, setFormData] = useState({
    company: "",
    role: "",
    location: "",
    source_url: "",
    job_description: "",
    notes: ""
  })

  useEffect(() => {
    if (!open) return
    // Pick a fresh random color each time the modal opens
    setSelectedColor(randomPresetColor())
    setLoadingTemplates(true)
    ResumeTemplateService.getAll()
      .then(data => {
        setTemplates(data)
        const master = data.find(t => t.is_master)
        if (master) setSelectedTemplateId(master.id)
      })
      .catch(e => console.error("Could not load templates", e))
      .finally(() => setLoadingTemplates(false))
  }, [open])

  // Close color picker when clicking outside
  useEffect(() => {
    if (!colorPickerOpen) return
    const handler = (e: MouseEvent) => {
      // Suppress while the native OS color dialog is active
      if (nativeColorPickerActive.current) return
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [colorPickerOpen])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await ApplicationService.create({
        company: formData.company,
        role: formData.role,
        status: ApplicationStatus.DRAFT,
        location: formData.location || undefined,
        source_url: formData.source_url || undefined,
        job_description: formData.job_description || undefined,
        notes: formData.notes || undefined,
        applied_date: new Date().toISOString().split('T')[0],
        color: selectedColor,
      })

      // Link the selected template if one is chosen
      if (selectedTemplateId) {
        try {
          await ApplicationService.updateResumeTemplate(response.id, selectedTemplateId)
        } catch (e) {
          console.error("Could not set template", e)
        }
      }

      setOpen(false)
      setFormData({
        company: "",
        role: "",
        location: "",
        source_url: "",
        job_description: "",
        notes: ""
      })
      setSelectedTemplateId("")

      if (onSuccess) {
        onSuccess()
      }

      window.location.href = `/applications/${response.id}`;
    } catch (err) {
      setError("Failed to create application. Please try again.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Application
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto"
        style={{
          background: `color-mix(in srgb, ${selectedColor} 10%, var(--background))`,
        }}
      >
        <DialogHeader>
          <DialogTitle>Add New Application</DialogTitle>
          <DialogDescription>
            Enter the details of the job you are applying for. ResuMate will help you tailor your resume.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {error && (
            <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="company">Company *</Label>
              <Input
                id="company"
                name="company"
                value={formData.company}
                onChange={handleChange}
                placeholder="e.g. Google"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role *</Label>
              <Input
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                placeholder="e.g. Frontend Engineer"
                required
              />
            </div>
          </div>

          {/* Colour picker */}
          <div className="grid gap-2">
            <Label>Application Colour</Label>
            <div className="relative" ref={colorPickerRef}>
              <button
                type="button"
                onClick={() => setColorPickerOpen(v => !v)}
                className="flex items-center gap-3 h-9 w-full rounded-md border border-input bg-background/60 px-3 py-1 text-sm hover:bg-muted/40 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <span
                  className="size-4 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: selectedColor }}
                />
                <span className="text-muted-foreground">
                  {PRESET_COLORS.includes(selectedColor) ? selectedColor : selectedColor}
                </span>
                <span className="ml-auto text-muted-foreground text-xs">click to change</span>
              </button>
              {colorPickerOpen && (
                <div className="absolute top-full left-0 mt-1 z-50">
                  <ColorPicker
                    value={selectedColor}
                    onChange={(c) => { setSelectedColor(c); setColorPickerOpen(false); }}
                    onNativePickerActiveChange={(active) => {
                      nativeColorPickerActive.current = active;
                    }}
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Used to identify this company across all your applications.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="template">Starting Resume</Label>
            {loadingTemplates ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground h-9">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading templates...
              </div>
            ) : (
              <select
                id="template"
                value={selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {templates.filter(t => t.is_master).map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} (Master){t.is_starred ? " ⭐" : ""}
                  </option>
                ))}
                <option value="">— Choose Later —</option>
                {templates.filter(t => !t.is_master).map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.is_starred ? " ⭐" : ""}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-muted-foreground">Choose which resume to start from for this application.</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g. Remote, New York NY, London UK"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="source_url">Post/Job URL</Label>
            <Input
              id="source_url"
              name="source_url"
              value={formData.source_url}
              onChange={handleChange}
              placeholder="https://linkedin.com/jobs/..."
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="job_description">Job Description</Label>
            <Textarea
              id="job_description"
              name="job_description"
              value={formData.job_description}
              onChange={handleChange}
              placeholder="Paste the full job description here..."
              className="min-h-[150px]"
            />
            <p className="text-xs text-muted-foreground">
              Paste the JD here so our agents can analyze it for you.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Referral name, salary range, specific instructions..."
              className="min-h-[80px]"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: selectedColor,
                borderColor: selectedColor,
                color: getContrastColor(selectedColor),
              }}
            >
              {loading ? "Creating..." : "Create Application"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
