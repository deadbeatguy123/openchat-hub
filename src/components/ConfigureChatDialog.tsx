import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Settings } from "lucide-react";

export interface ChatConfiguration {
  preset_id: string | null;
  custom_model_name: string | null;
  custom_personality: string | null;
  custom_background: string | null;
  custom_tone: string | null;
}

interface ConfigureChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chat:
    | (ChatConfiguration & {
        id: string;
        title?: string | null;
      })
    | null;
  onSave: (configuration: ChatConfiguration) => Promise<boolean>;
}

export function ConfigureChatDialog({
  open,
  onOpenChange,
  chat,
  onSave,
}: ConfigureChatDialogProps) {
  const [modelName, setModelName] = useState("");
  const [personality, setPersonality] = useState("");
  const [background, setBackground] = useState("");
  const [tone, setTone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !chat) return;

    setModelName(chat.custom_model_name ?? "");
    setPersonality(chat.custom_personality ?? "");
    setBackground(chat.custom_background ?? "");
    setTone(chat.custom_tone ?? "");
  }, [open, chat]);

  const handleSave = async () => {
    if (!chat) return;

    setSaving(true);

    try {
      const success = await onSave({
        preset_id: null,
        custom_model_name: modelName.trim() || null,
        custom_personality: personality.trim() || null,
        custom_background: background.trim() || null,
        custom_tone: tone.trim() || null,
      });

      if (success) {
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!chat) return;

    setSaving(true);

    try {
      const success = await onSave({
        preset_id: null,
        custom_model_name: null,
        custom_personality: null,
        custom_background: null,
        custom_tone: null,
      });

      if (success) {
        setModelName("");
        setPersonality("");
        setBackground("");
        setTone("");
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Configure personality
          </DialogTitle>
          <DialogDescription>
            Change how this chat should behave. These settings affect future
            replies only.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label
              htmlFor="chat-bot-name"
              className="text-sm font-medium text-foreground"
            >
              Bot name
            </label>
            <Input
              id="chat-bot-name"
              value={modelName}
              onChange={(event) => setModelName(event.target.value)}
              placeholder="Example: Study Buddy, Luna, Debug Coach"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="chat-personality"
              className="text-sm font-medium text-foreground"
            >
              Personality
            </label>
            <Textarea
              id="chat-personality"
              value={personality}
              onChange={(event) => setPersonality(event.target.value)}
              placeholder="Example: Friendly, patient, concise, and encouraging."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="chat-background"
              className="text-sm font-medium text-foreground"
            >
              Background
            </label>
            <Textarea
              id="chat-background"
              value={background}
              onChange={(event) => setBackground(event.target.value)}
              placeholder="Example: A senior software engineer who explains React and Supabase clearly."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="chat-tone"
              className="text-sm font-medium text-foreground"
            >
              Tone
            </label>
            <Input
              id="chat-tone"
              value={tone}
              onChange={(event) => setTone(event.target.value)}
              placeholder="Example: casual, strict, academic, funny, supportive"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            disabled={saving || !chat}
          >
            Use default
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !chat}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
