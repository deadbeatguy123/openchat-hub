ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS global_persona text,
ADD COLUMN IF NOT EXISTS global_background text;