import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { deleteOwnAccount } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/theme/ThemeProvider";
import { Switch } from "@/components/ui/switch";
import { Moon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  KeyRound,
  ExternalLink,
  Eye,
  EyeOff,
  Mail,
  Lock,
  Trash2,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings — Keychat" },
      { name: "description", content: "Manage your account, personalization, and API key." },
    ],
  }),
});

function SettingsPage() {
  const { session, user, loading } = useAuth();
  const navigate = useNavigate();
  const deleteAccountFn = useServerFn(deleteOwnAccount);
  const { isDark, toggleTheme } = useTheme();

  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [fullName, setFullName] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Account security
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Delete account
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/" });
  }, [session, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email ?? "");
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, openrouter_api_key")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setFullName(data.full_name ?? "");
        setHasKey(!!data.openrouter_api_key);
      }
      setFetching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    const update: { full_name: string; openrouter_api_key?: string } = { full_name: fullName };
    if (apiKey.trim()) update.openrouter_api_key = apiKey.trim();
    const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
    setSavingProfile(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    if (apiKey.trim()) {
      setHasKey(true);
      setApiKey("");
    }
  };

  const handleUpdateEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setSavingEmail(false);
    if (error) return toast.error(error.message);
    toast.success("Check your inbox to confirm the new email");
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setNewPassword("");
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccountFn();
      await supabase.auth.signOut();
      toast.success("Account deleted");
      navigate({ to: "/" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete account";
      toast.error(message);
      setDeleting(false);
    }
  };

  if (loading || fetching) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-screen p-6 sm:p-12 max-w-2xl mx-auto">
      <Link
        to="/chat"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to chat
      </Link>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account, personalization, and API key.
          </p>
        </div>

        {/* OpenRouter / Profile */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Profile & API key
            </CardTitle>
            <CardDescription>
              Required to send messages.{" "}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Get an OpenRouter key <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="key">
                  OpenRouter API key{" "}
                  {hasKey && (
                    <span className="text-xs text-muted-foreground">
                      (saved — enter a new one to replace)
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="key"
                    type={showApiKey ? "text" : "password"}
                    placeholder={hasKey ? "••••••••••••••••" : "sk-or-v1-…"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    autoComplete="off"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showApiKey ? "Hide API key" : "Show API key"}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-primary" /> Appearance
            </CardTitle>
            <CardDescription>Choose your preferred color theme.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <Label htmlFor="dark-mode">Dark mode</Label>
            <Switch id="dark-mode" checked={isDark} onCheckedChange={toggleTheme} />
          </CardContent>
        </Card>

        {/* Account Security */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" /> Account Security
            </CardTitle>
            <CardDescription>Update your email and password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleUpdateEmail} className="space-y-3">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <Button type="submit" variant="secondary" disabled={savingEmail}>
                {savingEmail ? "Updating…" : "Update email"}
              </Button>
            </form>

            <form onSubmit={handleUpdatePassword} className="space-y-3">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" /> New password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button type="submit" variant="secondary" disabled={savingPassword || !newPassword}>
                {savingPassword ? "Updating…" : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/40 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Danger Zone
            </CardTitle>
            <CardDescription>
              Permanently delete your account and all associated data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => {
                setConfirmText("");
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete account
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={deleteOpen} onOpenChange={(o) => !deleting && setDeleteOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Delete account?
            </DialogTitle>
            <DialogDescription>
              This permanently deletes your account, chats, messages, and presets. This action
              cannot be undone. Type <span className="font-mono font-semibold">CONFIRM</span> to
              proceed.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type CONFIRM"
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== "CONFIRM" || deleting}
              onClick={handleDeleteAccount}
            >
              {deleting ? "Deleting…" : "Delete forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
