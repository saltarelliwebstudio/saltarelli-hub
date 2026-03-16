-- Fix DST issue: 9 AM EDT = 13:00 UTC (was 14:00 UTC = 9 AM EST)
-- DST started March 9, Ontario is now EDT (UTC-4) until November
-- Note: pg_cron on this Supabase instance doesn't support timezone column,
-- so we use a fixed UTC offset. Will need updating when DST ends in November.

SELECT cron.unschedule('daily-drip-status');

SELECT cron.schedule(
  'daily-drip-status',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://veyhxazlqekiweynjxhf.supabase.co/functions/v1/daily-drip-status',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
