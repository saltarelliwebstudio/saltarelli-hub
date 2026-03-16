-- Daily drip status text to Adam at 9am EST (14:00 UTC)
SELECT cron.schedule(
  'daily-drip-status',
  '0 14 * * *',
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
