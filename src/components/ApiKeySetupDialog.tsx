import { useState, FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ExternalLink, LogOut, Eye, EyeOff } from "lucide-react";

const OPENROUTER_KEY_REGEX = /^sk-or-v1-[A-Za-z0-9]{20,}$/;

interface Props {
  open: boolean;
  userId: string;
  onSaved: () => void;
  onSignOut: () => void;
}

export function ApiKeySetupDialog({ open, userId, onSaved, onSignOut }: Props) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (!OPENROUTER_KEY_REGEX.test(trimmed)) {
      setError("Invalid format. Please provide a valid OpenRouter API key (starts with sk-or-v1-)");
      return;
    }
    setError(null);
    setSaving(true);
    const { error: dbError } = await supabase
      .from("profiles")
      .update({ openrouter_api_key: trimmed })
      .eq("id", userId);
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    toast.success("API key saved");
    setKey("");
    onSaved();
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden backdrop-blur-sm"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Connect your OpenRouter account</DialogTitle>
          <DialogDescription>
            To start chatting, paste your OpenRouter API key. It's stored securely on your profile and used only to route your model requests.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                placeholder="sk-or-v1-..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoFocus
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Where do I find this? <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onSignOut} disabled={saving}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
            <Button type="submit" disabled={saving || !key.trim()}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                "Save key"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
