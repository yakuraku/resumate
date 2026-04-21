"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  contextFilesService,
  ContextFileInfo,
  ContextFileContent,
} from "@/services/contextFiles.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FolderOpen,
  Pencil,
  Save,
  Upload,
  CloudUpload,
  FilePlus,
  FileText,
  Trash2,
  Edit2,
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────
interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ensureMd(name: string) {
  return name.endsWith(".md") ? name : `${name}.md`;
}

// ── Main Component ─────────────────────────────────────────────────────────
export function ContextManager() {
  const [files, setFiles] = useState<ContextFileInfo[]>([]);
  const [folderPath, setFolderPath] = useState("");
  const [editingPath, setEditingPath] = useState(false);
  const [pathDraft, setPathDraft] = useState("");
  const [loading, setLoading] = useState(true);

  // Editor state
  const [selectedFile, setSelectedFile] = useState<ContextFileContent | null>(null);
  const [isNewFile, setIsNewFile] = useState(false);
  const [newFilename, setNewFilename] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [savingEditor, setSavingEditor] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Upload
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Ingest
  const [ingestOpen, setIngestOpen] = useState(false);
  const [ingestText, setIngestText] = useState("");
  const [ingesting, setIngesting] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  // ── Data loading ─────────────────────────────────────────────────────────
  const loadFiles = useCallback(async () => {
    try {
      const data = await contextFilesService.listFiles();
      setFiles(data);
    } catch {
      showToast("Failed to load files", "error");
    }
  }, [showToast]);

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await contextFilesService.getConfig();
      setFolderPath(cfg.folder_path);
      setPathDraft(cfg.folder_path);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadFiles(), loadConfig()]);
      setLoading(false);
    })();
  }, [loadFiles, loadConfig]);

  // ── Config ───────────────────────────────────────────────────────────────
  const handleSavePath = async () => {
    try {
      const cfg = await contextFilesService.updateConfig(pathDraft);
      setFolderPath(cfg.folder_path);
      setEditingPath(false);
      await loadFiles();
      showToast("Folder path updated");
    } catch {
      showToast("Failed to update folder path", "error");
    }
  };

  // ── Upload ───────────────────────────────────────────────────────────────
  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const mdFiles = Array.from(fileList).filter((f) => f.name.endsWith(".md"));
    if (mdFiles.length === 0) {
      showToast("Only .md files are accepted", "error");
      return;
    }
    setUploading(true);
    try {
      const { results } = await contextFilesService.uploadFiles(mdFiles);
      const created = results.filter((r) => r.status === "created").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      showToast(
        created > 0
          ? `Uploaded ${created} file${created > 1 ? "s" : ""}${skipped > 0 ? `, ${skipped} skipped` : ""}`
          : `All files skipped (already exist)`,
        created > 0 ? "success" : "error"
      );
      await loadFiles();
    } catch {
      showToast("Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleUpload(e.dataTransfer.files);
  };

  // ── File selection ────────────────────────────────────────────────────────
  const handleSelectFile = async (filename: string) => {
    try {
      const content = await contextFilesService.getFile(filename);
      setSelectedFile(content);
      setEditorContent(content.content);
      setIsNewFile(false);
    } catch {
      showToast("Failed to open file", "error");
    }
  };

  const handleNewFile = () => {
    setSelectedFile(null);
    setIsNewFile(true);
    setNewFilename("");
    setEditorContent("");
  };

  const handleCloseEditor = () => {
    setSelectedFile(null);
    setIsNewFile(false);
    setNewFilename("");
    setEditorContent("");
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSavingEditor(true);
    try {
      if (isNewFile) {
        const fname = ensureMd(newFilename.trim());
        if (!fname || fname === ".md") {
          showToast("Please enter a valid filename", "error");
          return;
        }
        const created = await contextFilesService.createFile(fname, editorContent);
        setSelectedFile(created);
        setIsNewFile(false);
        showToast(`Created ${fname}`);
      } else if (selectedFile) {
        await contextFilesService.updateFile(selectedFile.filename, editorContent);
        showToast(`Saved ${selectedFile.filename}`);
      }
      await loadFiles();
    } catch (err: any) {
      const msg = err?.response?.status === 409
        ? "A file with that name already exists"
        : "Failed to save file";
      showToast(msg, "error");
    } finally {
      setSavingEditor(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await contextFilesService.deleteFile(deleteTarget);
      if (selectedFile?.filename === deleteTarget) handleCloseEditor();
      await loadFiles();
      showToast(`Deleted ${deleteTarget}`);
    } catch {
      showToast("Failed to delete file", "error");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // ── AI Ingest ─────────────────────────────────────────────────────────────
  const handleIngest = async () => {
    if (!ingestText.trim()) return;
    setIngesting(true);
    try {
      const result = await contextFilesService.ingestToFile(ingestText);
      showToast(`Extracted context saved to ${result.filename}`);
      setIngestText("");
      setIngestOpen(false);
      await loadFiles();
    } catch {
      showToast("AI extraction failed", "error");
    } finally {
      setIngesting(false);
    }
  };

  const editorOpen = isNewFile || selectedFile !== null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Folder Configuration ── */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <FolderOpen className="h-4 w-4 text-muted-foreground mt-2.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <Label className="text-xs font-medium text-muted-foreground mb-1 block">
                Context Folder
              </Label>
              {editingPath ? (
                <div className="flex gap-2">
                  <Input
                    value={pathDraft}
                    onChange={(e) => setPathDraft(e.target.value)}
                    className="h-8 text-sm font-mono"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleSavePath()}
                  />
                  <Button size="sm" onClick={handleSavePath} className="h-8">
                    <Save className="h-3.5 w-3.5 mr-1" /> Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    onClick={() => { setEditingPath(false); setPathDraft(folderPath); }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <code className="text-sm text-foreground bg-muted px-2 py-1 rounded font-mono flex-1 truncate block">
                    {folderPath || "Loading…"}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={() => { setEditingPath(true); setPathDraft(folderPath); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                This is the folder ResuMate reads for AI context
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Upload Zone ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg px-6 py-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".md"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        {uploading ? (
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
        ) : (
          <CloudUpload className={cn("h-6 w-6", dragging ? "text-primary" : "text-muted-foreground")} />
        )}
        <p className="text-sm text-muted-foreground text-center">
          {uploading
            ? "Uploading…"
            : <><span className="font-medium text-foreground">Drop .md files here</span> or click to browse</>
          }
        </p>
      </div>

      {/* ── File List + Editor ── */}
      <div className={cn(
        "grid gap-4",
        editorOpen ? "md:grid-cols-[35%_1fr]" : "grid-cols-1"
      )}>
        {/* File List */}
        <Card className="flex flex-col min-h-[420px]">
          <CardHeader className="pb-2 pt-3 px-4 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Files</CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleNewFile}>
                <FilePlus className="h-3.5 w-3.5 mr-1" /> New File
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
            {loading ? (
              <div className="flex items-center justify-center h-full py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No .md files in this folder</p>
                <p className="text-xs text-muted-foreground">Upload files or create a new one above</p>
              </div>
            ) : (
              files.map((file) => {
                const isActive = selectedFile?.filename === file.filename;
                return (
                  <div
                    key={file.filename}
                    className={cn(
                      "group rounded-md border p-3 cursor-pointer transition-colors",
                      isActive
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:border-border hover:bg-muted/40"
                    )}
                    onClick={() => handleSelectFile(file.filename)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", isActive ? "text-primary" : "text-muted-foreground")} />
                        <div className="min-w-0">
                          <p className={cn("text-sm font-medium truncate", isActive ? "text-primary" : "text-foreground")}>
                            {file.filename}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(file.modified_at)} · {(file.size_bytes / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); handleSelectFile(file.filename); }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(file.filename); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {file.preview && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed pl-5">
                        {file.preview}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Editor Panel */}
        {editorOpen && (
          <Card className="flex flex-col min-h-[420px]">
            <CardHeader className="pb-2 pt-3 px-4 shrink-0 border-b">
              <div className="flex items-center justify-between gap-2">
                {isNewFile ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FilePlus className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      placeholder="filename.md"
                      value={newFilename}
                      onChange={(e) => setNewFilename(e.target.value)}
                      className="h-7 text-sm"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate">{selectedFile?.filename}</span>
                  </div>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleCloseEditor}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 p-3 flex flex-col gap-3">
              <Textarea
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                className="flex-1 font-mono text-sm resize-none min-h-[360px] bg-muted/20 border-muted"
                placeholder="Write your context in Markdown…"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleCloseEditor}>
                  Discard
                </Button>
                <Button size="sm" onClick={handleSave} disabled={savingEditor}>
                  {savingEditor ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Saving…</>
                  ) : (
                    <><Save className="h-3.5 w-3.5 mr-1" /> Save</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── AI Extract (collapsible) ── */}
      <Card>
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors rounded-lg"
          onClick={() => setIngestOpen(!ingestOpen)}
        >
          <span className="flex items-center gap-2">
            <span className="text-base">✨</span> AI Extract Context
          </span>
          {ingestOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>

        {ingestOpen && (
          <CardContent className="pt-0 pb-4 px-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Paste your resume, bio, or any career text. The AI will extract key facts and save them as a new .md file.
            </p>
            <Textarea
              value={ingestText}
              onChange={(e) => setIngestText(e.target.value)}
              placeholder="Paste resume, LinkedIn bio, cover letter, or any career text here…"
              className="min-h-[140px] text-sm resize-none"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleIngest}
                disabled={ingesting || !ingestText.trim()}
              >
                {ingesting ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Extracting…</>
                ) : (
                  "Extract & Save as .md"
                )}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete file?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-mono font-medium text-foreground">{deleteTarget}</span>? This cannot be undone.
          </p>
          <DialogFooter className="mt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Toast Notifications ── */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium border animate-in slide-in-from-bottom-2 fade-in duration-200",
              t.type === "success"
                ? "bg-background border-border text-foreground"
                : "bg-destructive/10 border-destructive/30 text-destructive"
            )}
          >
            {t.type === "success"
              ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              : <AlertCircle className="h-4 w-4 shrink-0" />
            }
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
