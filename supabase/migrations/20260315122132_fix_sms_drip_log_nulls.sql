-- Fix: make legacy NOT NULL columns nullable so new Edge Functions can write
ALTER TABLE public.sms_drip_log ALTER COLUMN day_number DROP NOT NULL;
ALTER TABLE public.sms_drip_log ALTER COLUMN message_content DROP NOT NULL;
