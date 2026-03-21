-- Remove auto-drip trigger to comply with CASL (Canadian Anti-Spam Law).
-- Only audit form leads (source = 'after-hours-audit') should have drip_active = true,
-- which is set explicitly by the notify-audit-lead edge function.
-- Manual/imported leads must not be auto-enrolled.

DROP TRIGGER IF EXISTS auto_drip_on_insert ON public.admin_leads;
DROP FUNCTION IF EXISTS public.auto_activate_drip();

-- Safety: deactivate drip for any non-audit leads that may have been auto-enrolled
UPDATE admin_leads
SET drip_active = false
WHERE drip_active = true
  AND (source IS NULL OR source != 'after-hours-audit');
