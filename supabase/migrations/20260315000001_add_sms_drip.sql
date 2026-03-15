-- ============================================
-- SMS Drip Campaign — schema + pg_cron job
-- ============================================

-- 1. Add drip columns to admin_leads
ALTER TABLE public.admin_leads
  ADD COLUMN drip_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN drip_paused_at TIMESTAMPTZ,
  ADD COLUMN drip_step INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_admin_leads_drip_active ON public.admin_leads(drip_active) WHERE drip_active = true;

-- 2. Create sms_drip_log table
CREATE TABLE public.sms_drip_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.admin_leads(id) ON DELETE CASCADE,
  step INTEGER NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  openphone_message_id TEXT,
  error_message TEXT
);

ALTER TABLE public.sms_drip_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sms drip logs"
  ON public.sms_drip_log FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE INDEX idx_sms_drip_log_lead_id ON public.sms_drip_log(lead_id);
CREATE INDEX idx_sms_drip_log_sent_at ON public.sms_drip_log(sent_at DESC);

-- 3. Seed OpenPhone integration settings (if not already present)
INSERT INTO public.integration_settings (key, value, description) VALUES
  ('openphone_api_key', '', 'OpenPhone API key for sending SMS'),
  ('openphone_phone_number_id', '', 'OpenPhone phone number ID (sender)')
ON CONFLICT (key) DO NOTHING;

-- 4. pg_cron job — call process-drip-queue every hour
SELECT cron.schedule(
  'drip-sms-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lipahzaksypfqojqtwjr.supabase.co/functions/v1/process-drip-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 5. Trigger function: send step 1 immediately when drip_active is set to true on INSERT
CREATE OR REPLACE FUNCTION public.trigger_drip_step1()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.drip_active = true AND NEW.phone IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://lipahzaksypfqojqtwjr.supabase.co/functions/v1/send-drip-sms',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object('lead_id', NEW.id::text, 'step', 1)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER drip_step1_on_insert
  AFTER INSERT ON public.admin_leads
  FOR EACH ROW
  WHEN (NEW.drip_active = true)
  EXECUTE FUNCTION public.trigger_drip_step1();

-- Also fire when drip_active is toggled from false to true on UPDATE
CREATE TRIGGER drip_step1_on_activate
  AFTER UPDATE OF drip_active ON public.admin_leads
  FOR EACH ROW
  WHEN (OLD.drip_active = false AND NEW.drip_active = true AND NEW.drip_step = 0)
  EXECUTE FUNCTION public.trigger_drip_step1();
