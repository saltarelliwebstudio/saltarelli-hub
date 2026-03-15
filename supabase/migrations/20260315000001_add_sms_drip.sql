-- ============================================
-- SMS Drip Campaign — add missing columns, pg_cron job, triggers
-- Builds on top of 20260312000001_add_sms_drip_sequence.sql
-- ============================================

-- 1. Add drip columns to admin_leads (IF NOT EXISTS)
ALTER TABLE public.admin_leads
  ADD COLUMN IF NOT EXISTS drip_active BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.admin_leads
  ADD COLUMN IF NOT EXISTS drip_paused_at TIMESTAMPTZ;
ALTER TABLE public.admin_leads
  ADD COLUMN IF NOT EXISTS drip_step INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_admin_leads_drip_active ON public.admin_leads(drip_active) WHERE drip_active = true;

-- 2. Add missing columns to sms_drip_log (existing table from 20260312 migration)
-- Add 'step' column (maps to day_number conceptually but used by Edge Functions)
ALTER TABLE public.sms_drip_log
  ADD COLUMN IF NOT EXISTS step INTEGER;
ALTER TABLE public.sms_drip_log
  ADD COLUMN IF NOT EXISTS message_body TEXT;
ALTER TABLE public.sms_drip_log
  ADD COLUMN IF NOT EXISTS openphone_message_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sms_drip_log_sent_at ON public.sms_drip_log(sent_at DESC);

-- Ensure admins can manage (not just read) sms_drip_log
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sms_drip_log'
    AND policyname = 'Admins can manage sms drip logs'
  ) THEN
    CREATE POLICY "Admins can manage sms drip logs"
      ON public.sms_drip_log FOR ALL
      USING (public.is_admin(auth.uid()));
  END IF;
END $$;

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
    url := 'https://veyhxazlqekiweynjxhf.supabase.co/functions/v1/process-drip-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 5. Trigger function: send step 1 immediately when drip_active is set to true
CREATE OR REPLACE FUNCTION public.trigger_drip_step1()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.drip_active = true AND NEW.phone IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://veyhxazlqekiweynjxhf.supabase.co/functions/v1/send-drip-sms',
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

-- Drop triggers first if they exist (idempotent)
DROP TRIGGER IF EXISTS drip_step1_on_insert ON public.admin_leads;
DROP TRIGGER IF EXISTS drip_step1_on_activate ON public.admin_leads;

CREATE TRIGGER drip_step1_on_insert
  AFTER INSERT ON public.admin_leads
  FOR EACH ROW
  WHEN (NEW.drip_active = true)
  EXECUTE FUNCTION public.trigger_drip_step1();

CREATE TRIGGER drip_step1_on_activate
  AFTER UPDATE OF drip_active ON public.admin_leads
  FOR EACH ROW
  WHEN (OLD.drip_active = false AND NEW.drip_active = true AND NEW.drip_step = 0)
  EXECUTE FUNCTION public.trigger_drip_step1();
