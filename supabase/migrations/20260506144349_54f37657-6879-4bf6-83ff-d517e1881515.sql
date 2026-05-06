-- Personality presets table
CREATE TABLE public.personality_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  model_name TEXT,
  personality TEXT,
  background TEXT,
  tone TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.personality_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own presets" ON public.personality_presets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own presets" ON public.personality_presets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own presets" ON public.personality_presets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own presets" ON public.personality_presets
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_presets_updated_at
  BEFORE UPDATE ON public.personality_presets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_presets_user ON public.personality_presets(user_id);

-- Add personalization columns to chats
ALTER TABLE public.chats
  ADD COLUMN preset_id UUID,
  ADD COLUMN custom_model_name TEXT,
  ADD COLUMN custom_personality TEXT,
  ADD COLUMN custom_background TEXT,
  ADD COLUMN custom_tone TEXT;