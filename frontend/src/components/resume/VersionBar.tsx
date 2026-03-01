"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResumeVersion } from "@/types/resume";
import { ChevronLeft, ChevronRight, Save, List, Check, Loader2 } from "lucide-react";

interface VersionBarProps {
    versions: ResumeVersion[];
    viewingVersionId: string | null;
    onVersionSelect: (version: ResumeVersion) => void;
    onActivateVersion: (versionId: string) => void;
    onSaveNewVersion: (summary: string) => void;
    activating: boolean;
    savingVersion: boolean;
}

export function VersionBar({
    versions,
    viewingVersionId,
    onVersionSelect,
    onActivateVersion,
    onSaveNewVersion,
    activating,
    savingVersion,
}: VersionBarProps) {
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [changeSummary, setChangeSummary] = useState("");
    const [pickerOpen, setPickerOpen] = useState(false);

    const sorted = [...versions].sort((a, b) => a.version_number - b.version_number);
    const currentIdx = sorted.findIndex((v) => v.id === viewingVersionId);
    const currentVersion = currentIdx >= 0 ? sorted[currentIdx] : null;
    const activeVersion = sorted.find((v) => v.is_active);
    const isViewingActive = currentVersion?.is_active ?? false;

    const goPrev = () => {
        if (currentIdx > 0) onVersionSelect(sorted[currentIdx - 1]);
    };
    const goNext = () => {
        if (currentIdx < sorted.length - 1) onVersionSelect(sorted[currentIdx + 1]);
    };

    const handleSave = () => {
        onSaveNewVersion(changeSummary || "Manual save");
        setChangeSummary("");
        setSaveDialogOpen(false);
    };

    const sourceBadgeColor = (source: string) => {
        switch (source) {
            case "ai_tailored": return "bg-purple-500/10 text-purple-400 border-purple-500/20";
            case "master": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
            default: return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
        }
    };

    return (
        <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30 gap-2">
            {/* Left: Navigation */}
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goPrev} disabled={currentIdx <= 0}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Version picker dialog */}
                <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs font-mono">
                            <List className="h-3 w-3" />
                            v{currentVersion?.version_number ?? "?"} of {sorted.length}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Version History</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="max-h-[400px]">
                            <div className="space-y-1 p-1">
                                {[...sorted].reverse().map((v) => (
                                    <button
                                        key={v.id}
                                        onClick={() => { onVersionSelect(v); setPickerOpen(false); }}
                                        className={`w-full text-left p-2 rounded-md text-sm hover:bg-accent transition-colors flex items-center justify-between ${
                                            v.id === viewingVersionId ? "bg-accent" : ""
                                        }`}
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-medium">v{v.version_number}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sourceBadgeColor(v.source)}`}>
                                                    {v.source}
                                                </span>
                                                {v.is_active && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                                                        active
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-muted-foreground">{v.change_summary || v.label}</span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground">
                                            {new Date(v.created_at).toLocaleDateString()}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </DialogContent>
                </Dialog>

                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goNext} disabled={currentIdx >= sorted.length - 1}>
                    <ChevronRight className="h-4 w-4" />
                </Button>

                {currentVersion && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sourceBadgeColor(currentVersion.source)}`}>
                        {currentVersion.label || currentVersion.source}
                    </span>
                )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1">
                {!isViewingActive && currentVersion && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => onActivateVersion(currentVersion.id)}
                        disabled={activating}
                    >
                        {activating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Set Active
                    </Button>
                )}

                <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                            <Save className="h-3 w-3" />
                            Save Version
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm">
                        <DialogHeader>
                            <DialogTitle>Save Version</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                            <Input
                                placeholder="Change summary (optional)"
                                value={changeSummary}
                                onChange={(e) => setChangeSummary(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                            />
                            <Button onClick={handleSave} disabled={savingVersion} className="w-full">
                                {savingVersion ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Save
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
