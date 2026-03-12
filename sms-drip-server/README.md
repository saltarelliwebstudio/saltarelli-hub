# Saltarelli Web Studio – SMS Drip Sequence Server

A persistent Node.js service that automatically fires a **45-day SMS drip sequence** via [OpenPhone](https://openphone.com) whenever a new lead is added to the `admin_leads` table in Supabase.

---

## How It Works

1. **Supabase Realtime** listens for `INSERT` events on `admin_leads`.
2. When a new lead arrives with a valid phone number, **Day 0 SMS is sent immediately**.
3. The lead's `sms_sequence_status` is set to `active` and `sms_next_send_date` is set to Day 3.
4. A **cron job runs every hour** to check for leads whose `sms_next_send_date` has passed and sends the next message in the sequence.
5. Every send is logged to `sms_drip_log` for full auditability.

### 45-Day Sequence

| Day | Message Theme |
|-----|--------------|
| 0   | Initial outreach – AI automation story |
| 3   | Soft follow-up – 5+ hours saved |
| 7   | Missed calls angle |
| 14  | Check-in |
| 21  | Social proof – concrete company |
| 30  | Timing nudge |
| 45  | Final message |

---

## Database Schema

### `admin_leads` (new columns)

| Column | Type | Description |
|--------|------|-------------|
| `sms_sequence_status` | TEXT | `none` / `active` / `completed` / `paused` / `opted_out` |
| `sms_sequence_day` | INTEGER | Last day number successfully sent |
| `sms_next_send_date` | TIMESTAMPTZ | When to send the next message |
| `sms_opt_out` | BOOLEAN | Set to `true` to permanently stop SMS for this lead |

### `sms_drip_log`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `lead_id` | UUID | FK → admin_leads.id |
| `day_number` | INTEGER | Which day in the sequence (0, 3, 7, 14, 21, 30, 45) |
| `message_content` | TEXT | Personalised message that was sent |
| `sent_at` | TIMESTAMPTZ | When the send was attempted |
| `status` | TEXT | `sent` / `delivered` / `failed` / `skipped` |
| `openphone_response` | JSONB | Raw API response from OpenPhone |
| `error_message` | TEXT | Error detail if status = `failed` |

---

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Lead has no phone number | Skipped silently |
| Lead status = `do_not_contact` | Skipped at enrolment; paused if changed later |
| `sms_opt_out = true` | Skipped at enrolment; sequence paused if changed later |
| Lead already in sequence | Skipped (idempotency check) |
| Day already sent | Skipped (idempotency check on `sms_drip_log`) |
| OpenPhone API failure | Logged as `failed`, retried in 1 hour |
| Server restart | Boot catch-up run sends any overdue messages immediately |

---

## Setup

### 1. Install dependencies

```bash
cd sms-drip-server
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Run the migration

The migration at `supabase/migrations/20260312000001_add_sms_drip_sequence.sql` must be applied to your Supabase project. Run it via the Supabase SQL editor or:

```bash
psql "postgresql://postgres.YOUR_REF@aws-1-ca-central-1.pooler.supabase.com:5432/postgres" \
  -f ../supabase/migrations/20260312000001_add_sms_drip_sequence.sql
```

### 4. Start the server

```bash
npm start
```

---

## Deployment (PM2)

For persistent deployment on a VPS or server:

```bash
npm install -g pm2
pm2 start index.js --name saltarelli-sms-drip
pm2 save
pm2 startup
```

To view logs:
```bash
pm2 logs saltarelli-sms-drip
```

---

## Health Check

The server exposes two HTTP endpoints:

- `GET /health` – Returns `200 OK` with DB connectivity status
- `GET /stats` – Returns active/completed sequence counts and recent message log

---

## Stopping a Lead's Sequence

To stop SMS for a specific lead:

```sql
-- Via Supabase SQL editor:
UPDATE admin_leads SET sms_opt_out = true WHERE id = 'lead-uuid-here';
-- or
UPDATE admin_leads SET sms_sequence_status = 'paused' WHERE id = 'lead-uuid-here';
```

Or set the lead's status to `do_not_contact` in the admin dashboard.
