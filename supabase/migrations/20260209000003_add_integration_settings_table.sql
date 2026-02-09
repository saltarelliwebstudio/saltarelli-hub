-- ============================================
-- Integration Settings Table (global admin config)
-- ============================================
CREATE TABLE public.integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL DEFAULT '',
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS - admin only
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage integration settings" ON public.integration_settings
  FOR ALL USING (public.is_admin(auth.uid()));

-- Seed default keys
INSERT INTO public.integration_settings (key, value, description) VALUES
  ('retell_default_api_key', '', 'Default Retell AI API key for new clients'),
  ('twilio_account_sid', '', 'Twilio Account SID'),
  ('twilio_auth_token', '', 'Twilio Auth Token'),
  ('twilio_phone_number', '', 'Twilio phone number for sending SMS'),
  ('modal_api_url', '', 'Modal backend API base URL'),
  ('modal_auth_token', '', 'Modal API authentication token');

-- Updated at trigger
CREATE TRIGGER update_integration_settings_updated_at
  BEFORE UPDATE ON public.integration_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
