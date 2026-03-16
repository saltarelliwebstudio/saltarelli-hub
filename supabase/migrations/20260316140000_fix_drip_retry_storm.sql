-- Fix drip retry storm: change hourly cron to once daily at 9:30 AM EDT (13:30 UTC)
-- Also validate phone format on drip activation and clean up bad leads

-- 1. Replace hourly cron with daily cron (9:30 AM EDT = 13:30 UTC during DST)
SELECT cron.unschedule('drip-sms-hourly');

SELECT cron.schedule(
  'drip-sms-daily',
  '30 13 * * *',
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

-- 2. Update auto-activate trigger to validate phone is E.164-compatible
CREATE OR REPLACE FUNCTION public.auto_activate_drip()
RETURNS TRIGGER AS $$
DECLARE
  digits TEXT;
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.drip_active = false THEN
    -- Strip non-digits and check length (10 or 11 starting with 1)
    digits := regexp_replace(NEW.phone, '[^0-9]', '', 'g');
    IF length(digits) = 10 OR (length(digits) = 11 AND digits LIKE '1%') THEN
      NEW.drip_active := true;
    END IF;
    -- If phone doesn't match, drip stays false (invalid number)
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Deactivate drip for leads with invalid phone numbers
UPDATE public.admin_leads
SET drip_active = false
WHERE drip_active = true
  AND phone IS NOT NULL
  AND length(regexp_replace(phone, '[^0-9]', '', 'g')) NOT IN (10)
  AND NOT (length(regexp_replace(phone, '[^0-9]', '', 'g')) = 11
           AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE '1%');

-- 4. Deactivate drip for leads with 3+ failures on their next step
UPDATE public.admin_leads al
SET drip_active = false
WHERE al.drip_active = true
  AND (
    SELECT COUNT(*)
    FROM public.sms_drip_log sl
    WHERE sl.lead_id = al.id
      AND sl.step = al.drip_step + 1
      AND sl.status = 'failed'
  ) >= 3;

-- 5. Cap drip_step at 3 for any leads that were on steps 4-7
UPDATE public.admin_leads
SET drip_active = false
WHERE drip_step >= 3;
