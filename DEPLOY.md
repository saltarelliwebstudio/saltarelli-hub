# Deploy SMS Drip Server to Render.com — 5 Minute Guide

## What This Does
This server runs permanently on Render's free tier. It:
- **Listens for new leads** added to Supabase in real-time and auto-enrolls them in the SMS drip sequence
- **Sends scheduled follow-up SMS messages** (Days 3, 7, 14, 21, 30, 45) via OpenPhone
- **Runs a health check endpoint** at `/health` so Render keeps it alive

---

## Deploy in 5 Minutes (One-Click Method)

### Step 1 — Create a Render Account
Go to [https://render.com](https://render.com) and sign up with **GitHub** using the `saltarelliwebstudio` GitHub account.

### Step 2 — Connect the GitHub Repo
After signing in, click **"New +"** → **"Web Service"** → **"Connect a repository"** → select `saltarelliwebstudio/saltarelli-hub`.

### Step 3 — Configure the Service
Fill in these settings:

| Setting | Value |
|---|---|
| **Name** | `saltarelli-sms-drip-server` |
| **Root Directory** | `sms-drip-server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node index.js` |
| **Plan** | `Free` |

### Step 4 — Add Environment Variables
Click **"Advanced"** → **"Add Environment Variable"** and add each of these:

| Key | Value |
|---|---|
| `SUPABASE_URL` | `https://veyhxazlqekiweynjxhf.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZleWh4YXpscWVraXdleW5qeGhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYwNTYwNSwiZXhwIjoyMDg2MTgxNjA1fQ.JCslH8SIyCp4yZ2DmtZlANB92ReCnuTBEag5zY55FOM` |
| `OPENPHONE_API_KEY` | `0d35e68462200a5af5edbad35b829ead37941cddca39db448c4b202b00d81024` |
| `OPENPHONE_PHONE_NUMBER` | `+12893029451` |
| `DATABASE_URL` | `postgresql://postgres.veyhxazlqekiweynjxhf:SALTARELLI0626!@aws-0-us-east-1.pooler.supabase.com:6543/postgres` |
| `NODE_ENV` | `production` |

### Step 5 — Deploy
Click **"Create Web Service"**. Render will build and deploy automatically. Takes ~2 minutes.

---

## Verify It's Working
Once deployed, visit your service URL + `/health`:
```
https://saltarelli-sms-drip-server.onrender.com/health
```
You should see:
```json
{"status":"ok","db":"connected","uptime":123,"service":"saltarelli-sms-drip-server"}
```

For stats on active sequences:
```
https://saltarelli-sms-drip-server.onrender.com/stats
```

---

## Alternative: One-Click Deploy Button
If the `render.yaml` file is in the repo root (it is — already committed), you can use this URL to deploy with one click:

```
https://render.com/deploy?repo=https://github.com/saltarelliwebstudio/saltarelli-hub
```

> **Note on Free Tier:** Render's free tier spins down after 15 minutes of inactivity. The server's built-in cron job (runs every hour) and Supabase Realtime listener will keep it active during business hours. If you need 24/7 guaranteed uptime, upgrade to Render's Starter plan ($7/month) or use Railway ($5/month).

---

## Troubleshooting
- **Build fails:** Make sure `rootDir` is set to `sms-drip-server` (not the repo root)
- **DB connection error:** Verify `SUPABASE_SERVICE_KEY` is correct (no extra spaces)
- **SMS not sending:** Check `OPENPHONE_API_KEY` — it should NOT have `Bearer ` prefix
