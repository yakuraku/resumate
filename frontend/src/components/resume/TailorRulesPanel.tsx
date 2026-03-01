"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TailorRule } from "@/types/tailor-rule";
import { TailorRuleService } from "@/services/tailor-rule.service";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";

interface TailorRulesPanelProps {
    applicationId: string;
}

export function TailorRulesPanel({ applicationId }: TailorRulesPanelProps) {
    const [collapsed, setCollapsed] = useState(true);
    const [rules, setRules] = useState<TailorRule[]>([]);
    const [newRuleText, setNewRuleText] = useState("");
    const [loading, setLoading] = useState(false);

    // Only app-specific rules
    const appRules = rules.filter((r) => r.application_id === applicationId);

    const fetchRules = async () => {
        setLoading(true);
        try {
            const data = await TailorRuleService.getAll(applicationId);
            setRules(data);
        } catch (e) {
            console.error("Failed to fetch tailor rules", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!collapsed) fetchRules();
    }, [collapsed, applicationId]);

    const handleAdd = async () => {
        if (!newRuleText.trim()) return;
        try {
            const created = await TailorRuleService.create({
                application_id: applicationId,
                rule_text: newRuleText.trim(),
            });
            setRules((prev) => [...prev, created]);
            setNewRuleText("");
        } catch (e) {
            console.error("Failed to create rule", e);
        }
    };

    const handleToggle = async (rule: TailorRule) => {
        try {
            const updated = await TailorRuleService.update(rule.id, { is_enabled: !rule.is_enabled });
            setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        } catch (e) {
            console.error("Failed to toggle rule", e);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await TailorRuleService.delete(id);
            setRules((prev) => prev.filter((r) => r.id !== id));
        } catch (e) {
            console.error("Failed to delete rule", e);
        }
    };

    const RuleRow = ({ rule }: { rule: TailorRule }) => (
        <div className="flex items-center gap-2 py-1 px-1 group">
            <Switch checked={rule.is_enabled} onCheckedChange={() => handleToggle(rule)} />
            <span className={`flex-1 text-xs ${rule.is_enabled ? "text-foreground" : "text-muted-foreground line-through"}`}>
                {rule.rule_text}
            </span>
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDelete(rule.id)}
            >
                <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
        </div>
    );

    return (
        <div className="border-t">
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
                {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                App-specific Tailor Rules ({appRules.length})
            </button>

            {!collapsed && (
                <div className="px-3 pb-3 space-y-3">
                    {/* Add rule */}
                    <div className="flex gap-1">
                        <Input
                            placeholder="Add a rule, e.g. 'Emphasize Python experience'"
                            value={newRuleText}
                            onChange={(e) => setNewRuleText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                            className="h-7 text-xs"
                        />
                        <Button variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={handleAdd}>
                            <Plus className="h-3 w-3" />
                        </Button>
                    </div>

                    {/* App-specific rules */}
                    {appRules.map((r) => <RuleRow key={r.id} rule={r} />)}

                    {appRules.length === 0 && !loading && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                            No rules for this application. Global rules from Settings still apply.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
