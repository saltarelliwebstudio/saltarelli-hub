-- Migration: Add SMS drip sequence tracking to admin_leads and create sms_drip_log table
-- Applied: 2026-03-12
-- Purpose: Supports the automated 45-day SMS drip sequence via OpenPhone

-- 1. Add SMS tracking columns to admin_leads
ALTER TABLE public.admin_leads
  ADD COLUMN IF NOT EXISTS sms_sequence_status TEXT DEFAULT 'none'
    CHECK (sms_sequence_status IN ('none','active','completed','paused','opted_out'));

ALTER TABLE public.admin_leads
  ADD COLUMN IF NOT EXISTS sms_sequence_day INTEGER DEFAULT 0;

ALTER TABLE public.admin_leads
  ADD COLUMN IF NOT EXISTS sms_next_send_date TIMESTAMPTZ;

ALTER TABLE public.admin_leads
  ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN DEFAULT false;

-- 2. Create the sms_drip_log table for per-message tracking
CREATE TABLE IF NOT EXISTS public.sms_drip_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             UUID        NOT NULL REFERENCES public.admin_leads(id) ON DELETE CASCADE,
  day_number          INTEGER     NOT NULL,
  message_content     TEXT        NOT NULL,
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  status              TEXT        NOT NULL DEFAULT 'sent'
                                  CHECK (status IN ('sent','delivered','failed','skipped')),
  openphone_response  JSONB,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sms_drip_log_lead_id   ON public.sms_drip_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_sms_drip_log_day        ON public.sms_drip_log(day_number);
CREATE INDEX IF NOT EXISTS idx_admin_leads_sms_status  ON public.admin_leads(sms_sequence_status);
CREATE INDEX IF NOT EXISTS idx_admin_leads_sms_next    ON public.admin_leads(sms_next_send_date);

-- 4. Row Level Security
ALTER TABLE public.sms_drip_log ENABLE ROW LEVEL SECURITY;

-- Service role has full access (the drip server uses the service key)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sms_drip_log'
    AND policyname = 'Service role full access on sms_drip_log'
  ) THEN
    CREATE POLICY "Service role full access on sms_drip_log"
      ON public.sms_drip_log FOR ALL
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Admins can read the SMS log via the dashboard
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sms_drip_log'
    AND policyname = 'Admins can read sms_drip_log'
  ) THEN
    CREATE POLICY "Admins can read sms_drip_log"
      ON public.sms_drip_log FOR SELECT
      USING (public.is_admin(auth.uid()));
  END IF;
END $$;
