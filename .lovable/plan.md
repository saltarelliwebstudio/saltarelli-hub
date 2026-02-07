

## Automatic Call Log Sync (Every 5 Minutes)

### What This Does

Sets up a scheduled job that automatically syncs call data from Retell AI every 5 minutes. This means new calls will appear in the dashboard within roughly 5 minutes of ending, without anyone needing to click a button.

---

### How It Works

Right now, call logs only update when an admin manually clicks "Sync Calls" on a client's page. After this change, a background task will run every 5 minutes and pull the latest calls from Retell AI for all active accounts automatically.

### Technical Details

**Database Migration**

Enable two required extensions (`pg_cron` for scheduling and `pg_net` for HTTP requests), then create a cron job that calls the `sync-retell-calls` backend function every 5 minutes:

```text
Schedule: */5 * * * *  (every 5 minutes)
Target:   sync-retell-calls function
Auth:     Uses the project's service key
```

The cron job sends an HTTP POST request to the sync function, which then queries Retell AI for all active accounts and inserts/updates any new call data.

**Modified File: `supabase/config.toml`**
- Ensure `sync-retell-calls` has `verify_jwt = false` so the scheduled job can call it without a user session (the function already uses the service role key internally for database operations).

**No frontend changes needed** -- the dashboard already reads from the `call_logs` table, so new calls will appear automatically on next page load or navigation.

### Notes
- The sync processes all active Retell accounts across all clients in a single run
- Existing calls are updated (transcript, summary, status) if they've changed; new calls are inserted
- The manual "Sync Calls" button on the admin page will continue to work for immediate on-demand syncs
- If you ever want to change the interval, this can be adjusted in the cron schedule

