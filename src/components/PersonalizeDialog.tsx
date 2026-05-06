import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Trash2, Sparkles } from "lucide-react";

export interface Preset {
  id: string;
  name: string;
  model_name: string | null;
  personality: string | null;
  background: string | null;
  tone: string | null;
  is_default: boolean;
}

export interface Personalization {
  custom_model_name: string | null;
  custom_personality: string | null;
  custom_background: string | null;
  custom_tone: string | null;
  preset_id: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onConfirm: (p: Personalization) => void;
}

type Mode = "default" | "preset" | "custom";

export function PersonalizeDialog({ open, onOpenChange, userId, onConfirm }: Props) {
  const [mode, setMode] = useState<Mode>("default");
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  // Custom fields
  const [presetName, setPresetName] = useState("");
  const [modelName, setModelName] = useState("");
  const [personality, setPersonality] = useState("");
  const [background, setBackground] = useState("");
  const [tone, setTone] = useState("");
  const [savePreset, setSavePreset] = useState(true);

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("personality_presets")
        .select("*")
        .eq("user_id", userId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      const list = (data ?? []) as Preset[];
      setPresets(list);
      const def = list.find((p) => p.is_default);
      if (def) {
        setMode("preset");
        setSelectedPresetId(def.id);
      } else {
        setMode("default");
      }
    })();
  }, [open, userId]);

  const reset = () => {
    setPresetName("");
    setModelName("");
    setPersonality("");
    setBackground("");
    setTone("");
    setSavePreset(true);
  };

  const handleDeletePreset = async (id: string) => {
    const { error } = await supabase.from("personality_presets").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPresets((prev) => prev.filter((p) => p.id !== id));
    if (selectedPresetId === id) setSelectedPresetId("");
    toast.success("Preset deleted");
  };

  const handleConfirm = async () => {
    if (mode === "default") {
      onConfirm({
        custom_model_name: null,
        custom_personality: null,
        custom_background: null,
        custom_tone: null,
        preset_id: null,
      });
      onOpenChange(false);
      return;
    }

    if (mode === "preset") {
      const preset = presets.find((p) => p.id === selectedPresetId);
      if (!preset) {
        toast.error("Pick a preset");
        return;
      }
      onConfirm({
        custom_model_name: preset.model_name,
        custom_personality: preset.personality,
        custom_background: preset.background,
        custom_tone: preset.tone,
        preset_id: preset.id,
      });
      onOpenChange(false);
      return;
    }

    // custom
    if (!personality.trim() && !background.trim() && !tone.trim() && !modelName.trim()) {
      toast.error("Fill in at least one field");
      return;
    }

    let presetId: string | null = null;
    if (savePreset) {
      const name = presetName.trim() || modelName.trim() || "Untitled preset";
      setBusy(true);
      const { data, error } = await supabase
        .from("personality_presets")
        .insert({
          user_id: userId,
          name,
          model_name: modelName.trim() || null,
          personality: personality.trim() || null,
          background: background.trim() || null,
          tone: tone.trim() || null,
          is_default: presets.length === 0,
        })
        .select("id")
        .single();
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      presetId = data.id;
      toast.success("Preset saved");
    }

    onConfirm({
      custom_model_name: modelName.trim() || null,
      custom_personality: personality.trim() || null,
      custom_background: background.trim() || null,
      custom_tone: tone.trim() || null,
      preset_id: presetId,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Personalize this chat
          </DialogTitle>
          <DialogDescription>
            Choose how the AI should behave in this conversation.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="space-y-2">
          <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50">
            <RadioGroupItem value="default" id="mode-default" className="mt-1" />
            <div>
              <div className="font-medium text-sm">Use default</div>
              <p className="text-xs text-muted-foreground">No customization. The model behaves as-is.</p>
            </div>
          </label>

          {presets.length > 0 && (
            <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50">
              <RadioGroupItem value="preset" id="mode-preset" className="mt-1" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">Use a saved preset</div>
                <div className="mt-2 flex items-center gap-2">
                  <Select
                    value={selectedPresetId}
                    onValueChange={(v) => {
                      setSelectedPresetId(v);
                      setMode("preset");
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Pick a preset" />
                    </SelectTrigger>
                    <SelectContent>
                      {presets.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {p.is_default && "(default)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPresetId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeletePreset(selectedPresetId);
                      }}
                      aria-label="Delete preset"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </label>
          )}

          <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50">
            <RadioGroupItem value="custom" id="mode-custom" className="mt-1" />
            <div className="flex-1">
              <div className="font-medium text-sm">Customize</div>
              <p className="text-xs text-muted-foreground">Define a new persona for this chat.</p>
            </div>
          </label>
        </RadioGroup>

        {mode === "custom" && (
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-1.5">
              <Label htmlFor="model-name">Name in this chat</Label>
              <Input
                id="model-name"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g. Aria"
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="personality">Personality</Label>
              <Textarea
                id="personality"
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="e.g. Warm, witty, curious, encouraging"
                rows={2}
                maxLength={500}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="background">Background</Label>
              <Textarea
                id="background"
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                placeholder="e.g. A senior software engineer with 10 years of experience"
                rows={2}
                maxLength={500}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tone">Tone / response style</Label>
              <Textarea
                id="tone"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="e.g. Concise, friendly, uses examples and analogies"
                rows={2}
                maxLength={500}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preset-name">Preset name (optional)</Label>
              <Input
                id="preset-name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g. Friendly mentor"
                maxLength={80}
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={savePreset}
                onCheckedChange={(v) => setSavePreset(v === true)}
                id="save-preset"
              />
              <span>Save as preset for future chats</span>
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={busy}>
            {busy ? "Saving…" : "Start chat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
