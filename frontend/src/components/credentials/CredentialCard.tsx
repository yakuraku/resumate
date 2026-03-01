"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Pencil,
  Trash2,
  Plus,
  RefreshCw,
} from "lucide-react";
import credentialService, {
  ApplicationCredential,
  CredentialCreate,
  CredentialUpdate,
} from "@/services/credential.service";

// ─── Auth method config ───────────────────────────────────────────────────────

type AuthMethod =
  | "email_password"
  | "google"
  | "apple"
  | "linkedin"
  | "indeed"
  | "seek"
  | "other";

const AUTH_METHOD_LABELS: Record<AuthMethod, string> = {
  email_password: "Email & Password",
  google: "Google",
  apple: "Apple",
  linkedin: "LinkedIn",
  indeed: "Indeed",
  seek: "Seek",
  other: "Other",
};

const AUTH_METHODS = Object.keys(AUTH_METHOD_LABELS) as AuthMethod[];

// Auth methods that use email+password
const PASSWORD_METHODS: AuthMethod[] = ["email_password", "other"];
// Auth methods that use an OAuth email
const OAUTH_METHODS: AuthMethod[] = [
  "google",
  "apple",
  "linkedin",
  "indeed",
  "seek",
];

// ─── Password generator ───────────────────────────────────────────────────────

const DEFAULT_SPECIAL = "!@#$%^&*()";

function generatePassword(
  length: number,
  useUpper: boolean,
  useLower: boolean,
  useNumbers: boolean,
  useSpecial: boolean,
  specialChars: string
): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";

  let charset = "";
  if (useUpper) charset += upper;
  if (useLower) charset += lower;
  if (useNumbers) charset += numbers;
  if (useSpecial && specialChars.length > 0) charset += specialChars;

  if (charset.length === 0) charset = lower + numbers;

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((val) => charset[val % charset.length])
    .join("");
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyIconButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      title="Copy"
      type="button"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ─── Password Generator Panel ─────────────────────────────────────────────────

interface PasswordGenPanelProps {
  onFill: (pw: string) => void;
}

function PasswordGenPanel({ onFill }: PasswordGenPanelProps) {
  const [length, setLength] = useState(16);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSpecial, setUseSpecial] = useState(true);
  const [specialChars, setSpecialChars] = useState(DEFAULT_SPECIAL);
  const [preview, setPreview] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = useCallback(() => {
    const pw = generatePassword(
      length,
      useUpper,
      useLower,
      useNumbers,
      useSpecial,
      specialChars
    );
    setPreview(pw);
    setCopied(false);
  }, [length, useUpper, useLower, useNumbers, useSpecial, specialChars]);

  useEffect(() => {
    generate();
  }, [generate]);

  const handleCopy = async () => {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(preview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mt-3 p-3 rounded-lg border bg-muted/40 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Password Generator
      </p>

      {/* Length slider */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Length</span>
          <span className="font-mono font-medium text-foreground">{length}</span>
        </div>
        <input
          type="range"
          min={8}
          max={32}
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          className="w-full accent-primary h-1.5"
        />
      </div>

      {/* Checkboxes */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {(
          [
            ["Uppercase (A-Z)", useUpper, setUseUpper],
            ["Lowercase (a-z)", useLower, setUseLower],
            ["Numbers (0-9)", useNumbers, setUseNumbers],
            ["Special chars", useSpecial, setUseSpecial],
          ] as [string, boolean, (v: boolean) => void][]
        ).map(([label, val, setter]) => (
          <label key={label} className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={val}
              onChange={(e) => setter(e.target.checked)}
              className="accent-primary"
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      {/* Special chars customizer */}
      {useSpecial && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Special characters</Label>
          <Input
            value={specialChars}
            onChange={(e) => setSpecialChars(e.target.value)}
            className="h-7 text-xs font-mono"
          />
        </div>
      )}

      {/* Preview */}
      <div className="flex items-center gap-2">
        <div className="flex-1 font-mono text-xs bg-background border rounded px-2 py-1.5 overflow-hidden text-ellipsis whitespace-nowrap select-all">
          {preview || "—"}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title="Copy password"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={generate}
          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title="Regenerate"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Fill button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full h-7 text-xs"
        onClick={() => onFill(preview)}
        disabled={!preview}
      >
        Use this password
      </Button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface CredentialCardProps {
  applicationId: string;
}

interface FormState {
  auth_method: AuthMethod;
  email: string;
  username: string;
  password: string;
  oauth_email: string;
  notes: string;
}

const DEFAULT_FORM: FormState = {
  auth_method: "email_password",
  email: "",
  username: "",
  password: "",
  oauth_email: "",
  notes: "",
};

export function CredentialCard({ applicationId }: CredentialCardProps) {
  const [credential, setCredential] = useState<ApplicationCredential | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  // Load credential on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    credentialService
      .get(applicationId)
      .then((data) => {
        if (!cancelled) {
          setCredential(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const populateForm = (cred: ApplicationCredential) => {
    setForm({
      auth_method: (cred.auth_method as AuthMethod) || "email_password",
      email: cred.email || "",
      username: cred.username || "",
      password: cred.password || "",
      oauth_email: cred.oauth_email || "",
      notes: cred.notes || "",
    });
  };

  const handleEdit = () => {
    if (credential) populateForm(credential);
    setEditing(true);
    setShowGenerator(false);
    setShowPassword(false);
  };

  const handleStartCreate = () => {
    setForm(DEFAULT_FORM);
    setCreating(true);
    setShowGenerator(false);
    setShowPassword(false);
  };

  const handleCancel = () => {
    setEditing(false);
    setCreating(false);
    setShowGenerator(false);
    setConfirmDelete(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (creating) {
        const payload: CredentialCreate = {
          application_id: applicationId,
          auth_method: form.auth_method,
          email: form.email || undefined,
          username: form.username || undefined,
          password: form.password || undefined,
          oauth_email: form.oauth_email || undefined,
          notes: form.notes || undefined,
        };
        const created = await credentialService.create(payload);
        setCredential(created);
        setCreating(false);
      } else if (editing && credential) {
        const payload: CredentialUpdate = {
          auth_method: form.auth_method,
          email: form.email || undefined,
          username: form.username || undefined,
          password: form.password || undefined,
          oauth_email: form.oauth_email || undefined,
          notes: form.notes || undefined,
        };
        const updated = await credentialService.update(credential.id, payload);
        setCredential(updated);
        setEditing(false);
      }
    } catch {
      // silently fail — could add toast here if needed
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!credential) return;
    setDeleting(true);
    try {
      await credentialService.delete(credential.id);
      setCredential(null);
      setConfirmDelete(false);
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isOAuth = OAUTH_METHODS.includes(form.auth_method as AuthMethod);
  const isPasswordMethod = PASSWORD_METHODS.includes(form.auth_method as AuthMethod);

  // ─── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Credentials
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Empty state ────────────────────────────────────────────────────────────
  if (!credential && !creating) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Credentials
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
            <KeyRound className="h-10 w-10 text-muted-foreground opacity-30" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">No credentials stored</p>
              <p className="text-xs text-muted-foreground mt-1">
                Store login details for this application portal.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleStartCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Credentials
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-4">
            Credentials are stored locally and are not encrypted.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ─── Edit / Create form ─────────────────────────────────────────────────────
  if (editing || creating) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            {creating ? "Add Credentials" : "Edit Credentials"}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auth method */}
          <div className="space-y-1.5">
            <Label className="text-xs">Login Method</Label>
            <div className="flex flex-wrap gap-1.5">
              {AUTH_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => {
                    setField("auth_method", method);
                    setShowGenerator(false);
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    form.auth_method === method
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                  }`}
                >
                  {AUTH_METHOD_LABELS[method]}
                </button>
              ))}
            </div>
          </div>

          {/* Email (email_password or other) */}
          {isPasswordMethod && (
            <div className="space-y-1.5">
              <Label htmlFor="cred-email" className="text-xs">Email</Label>
              <Input
                id="cred-email"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="you@example.com"
                className="h-8 text-sm"
              />
            </div>
          )}

          {/* Username */}
          {isPasswordMethod && (
            <div className="space-y-1.5">
              <Label htmlFor="cred-username" className="text-xs">
                Username <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="cred-username"
                value={form.username}
                onChange={(e) => setField("username", e.target.value)}
                placeholder="username"
                className="h-8 text-sm"
              />
            </div>
          )}

          {/* OAuth email */}
          {isOAuth && (
            <div className="space-y-1.5">
              <Label htmlFor="cred-oauth" className="text-xs">
                {AUTH_METHOD_LABELS[form.auth_method as AuthMethod]} account email
              </Label>
              <Input
                id="cred-oauth"
                type="email"
                value={form.oauth_email}
                onChange={(e) => setField("oauth_email", e.target.value)}
                placeholder="you@gmail.com"
                className="h-8 text-sm"
              />
            </div>
          )}

          {/* Password */}
          {isPasswordMethod && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="cred-password" className="text-xs">Password</Label>
                <button
                  type="button"
                  onClick={() => setShowGenerator((v) => !v)}
                  className="text-xs text-primary hover:underline"
                >
                  {showGenerator ? "Hide generator" : "Generate password"}
                </button>
              </div>
              <div className="relative">
                <Input
                  id="cred-password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  placeholder="Password"
                  className="h-8 text-sm pr-8 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              {showGenerator && (
                <PasswordGenPanel onFill={(pw) => setField("password", pw)} />
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="cred-notes" className="text-xs">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="cred-notes"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Any extra login info, security questions, etc."
              className="text-sm min-h-[70px] resize-none"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Credentials are stored locally and are not encrypted.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ─── View mode ──────────────────────────────────────────────────────────────
  const method = credential!.auth_method as AuthMethod;
  const isViewOAuth = OAUTH_METHODS.includes(method);
  const isViewPassword = PASSWORD_METHODS.includes(method);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Credentials
        </CardTitle>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={handleEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {!confirmDelete ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-destructive font-medium">Delete?</span>
              <Button
                variant="destructive"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "..." : "Yes"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setConfirmDelete(false)}
              >
                No
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Auth method badge */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {AUTH_METHOD_LABELS[method] || method}
          </Badge>
        </div>

        {/* OAuth email */}
        {isViewOAuth && credential!.oauth_email && (
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Account email</p>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-mono">{credential!.oauth_email}</span>
              <CopyIconButton value={credential!.oauth_email} />
            </div>
          </div>
        )}

        {/* Email */}
        {isViewPassword && credential!.email && (
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Email</p>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-mono">{credential!.email}</span>
              <CopyIconButton value={credential!.email} />
            </div>
          </div>
        )}

        {/* Username */}
        {isViewPassword && credential!.username && (
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Username</p>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-mono">{credential!.username}</span>
              <CopyIconButton value={credential!.username} />
            </div>
          </div>
        )}

        {/* Password */}
        {isViewPassword && credential!.password && (
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Password</p>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-mono tracking-wider">
                {showPassword
                  ? credential!.password
                  : "•".repeat(Math.min(credential!.password.length, 16))}
              </span>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
              <CopyIconButton value={credential!.password} />
            </div>
          </div>
        )}

        {/* Notes */}
        {credential!.notes && (
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Notes</p>
            <p className="text-sm whitespace-pre-wrap text-foreground/80">
              {credential!.notes}
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground pt-1">
          Credentials are stored locally and are not encrypted.
        </p>
      </CardContent>
    </Card>
  );
}
