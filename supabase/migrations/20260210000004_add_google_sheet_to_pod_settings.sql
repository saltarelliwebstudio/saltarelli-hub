-- Add google_sheet_url to pod_settings for client analytics sheet link
ALTER TABLE public.pod_settings
  ADD COLUMN IF NOT EXISTS google_sheet_url TEXT;
