-- Add website fields to pod_settings
ALTER TABLE public.pod_settings
  ADD COLUMN IF NOT EXISTS website_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS website_url TEXT;
